-- Postgres 17 EN CI, base efímera; no se conecta a Supabase real.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role BYPASSRLS LOGIN PASSWORD 'ci-only-test';
GRANT USAGE ON SCHEMA public TO service_role;
CREATE TABLE public.pci_proposals (
  school_id integer PRIMARY KEY,
  data jsonb NOT NULL,
  edit_code text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.pci_proposals (school_id,data,edit_code) VALUES
(1001,'{"schemaVersion":10,"areas":{"Ciencias Sociales":{"groups":[{"id":"s1","items":["h1"]}]},"Ciencias Naturales":{"groups":[{"id":"n1","items":["b1"]}]}}}'::jsonb,'CI-TEST-NO-REAL');
