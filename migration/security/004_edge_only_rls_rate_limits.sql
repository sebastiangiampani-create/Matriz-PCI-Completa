-- PCI security baseline. Additive for school data: NO UPDATE/DELETE of school documents.
-- Apply first in an isolated staging database. Production deployment is gated.
BEGIN;

ALTER TABLE public.pci_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura pública solo escuelas muestra" ON public.pci_proposals;
DROP POLICY IF EXISTS "Actualización pública solo escuelas muestra" ON public.pci_proposals;
REVOKE ALL PRIVILEGES ON TABLE public.pci_proposals FROM PUBLIC, anon, authenticated;

-- Fail-closed, service-only counters. No raw IPs, passwords or PCI codes are stored.
CREATE SCHEMA IF NOT EXISTS pci_security;
REVOKE ALL ON SCHEMA pci_security FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA pci_security TO service_role;

CREATE TABLE IF NOT EXISTS pci_security.login_counters (
  scope text NOT NULL CHECK (scope IN ('school','ip','school-admin','admin-user','admin-ip')),
  bucket text NOT NULL CHECK (char_length(bucket) BETWEEN 8 AND 128),
  attempts integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(scope,bucket)
);
ALTER TABLE pci_security.login_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE pci_security.login_counters FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE pci_security.login_counters TO service_role;

CREATE OR REPLACE FUNCTION public.pci_auth_consume_limit_v1(
  p_scope text,
  p_bucket text,
  p_max_attempts integer DEFAULT 8,
  p_window_seconds integer DEFAULT 900
) RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pci_security
AS $$
DECLARE
  count_now integer;
BEGIN
  IF p_scope NOT IN ('school','ip','school-admin','admin-user','admin-ip')
     OR char_length(p_bucket) < 8 OR char_length(p_bucket) > 128
     OR p_max_attempts < 1 OR p_max_attempts > 30
     OR p_window_seconds < 60 OR p_window_seconds > 3600
  THEN
    RAISE EXCEPTION 'Invalid login counter configuration';
  END IF;
  INSERT INTO pci_security.login_counters AS t(scope,bucket,attempts,reset_at)
    VALUES(p_scope,p_bucket,1,now()+make_interval(secs=>p_window_seconds))
    ON CONFLICT(scope,bucket) DO UPDATE SET
      attempts = CASE WHEN t.reset_at <= now() THEN 1 ELSE LEAST(t.attempts+1,32767) END,
      reset_at = CASE WHEN t.reset_at <= now()
                 THEN now()+make_interval(secs=>p_window_seconds) ELSE t.reset_at END
    RETURNING attempts INTO count_now;
  RETURN count_now <= p_max_attempts;
END;
$$;
REVOKE ALL ON FUNCTION public.pci_auth_consume_limit_v1(text,text,integer,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pci_auth_consume_limit_v1(text,text,integer,integer)
  TO service_role;

COMMIT;

-- Post-deployment checks (read-only):
-- SELECT relrowsecurity FROM pg_class WHERE oid='public.pci_proposals'::regclass;
-- SELECT has_table_privilege('anon','public.pci_proposals','SELECT');
-- SELECT has_table_privilege('authenticated','public.pci_proposals','UPDATE');
-- SELECT * FROM pg_policies WHERE schemaname='public' AND tablename='pci_proposals';
