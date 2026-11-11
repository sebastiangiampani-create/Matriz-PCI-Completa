-- Proyecto PCI multiinstitucional: contrato ADITIVO, pendiente de validación.
-- NO EJECUTAR en la base de producción hasta verificar recuperación, backup
-- externo, prueba de rollback y aprobación institucional. No altera filas viejas.
-- Requiere PostgreSQL 17. Los módulos de edición por unidad se encuentran en
-- migration/concurrencia/003_supabase_scoped_units.sql (también sin desplegar).
BEGIN;
CREATE SCHEMA IF NOT EXISTS pci_workspace;
REVOKE ALL ON SCHEMA pci_workspace FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS pci_workspace.legacy_snapshots (
  snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id integer NOT NULL REFERENCES public.pci_proposals(school_id) ON DELETE RESTRICT,
  source_updated_at timestamptz NOT NULL,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  source_data jsonb NOT NULL CHECK (jsonb_typeof(source_data)='object'),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(school_id,source_sha256),
  UNIQUE(snapshot_id,school_id)
);
-- Las instantáneas no sustituyen un backup privado y externo.
CREATE TABLE IF NOT EXISTS pci_workspace.pcis (
  pci_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id integer NOT NULL REFERENCES public.pci_proposals(school_id) ON DELETE RESTRICT,
  orientation_id text NOT NULL CHECK (orientation_id ~ '^[a-z][a-z0-9_]{2,79}$'),
  process_id text NOT NULL CHECK (length(process_id) BETWEEN 1 AND 160),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 150),
  model text NOT NULL DEFAULT 'comun' CHECK (model IN ('comun','tecnica')),
  shift_id text NOT NULL DEFAULT 'manana'
    CHECK (shift_id IN ('manana','tarde','vespertino','noche')),
  specialty_name text NULL,
  curriculum_status text NOT NULL DEFAULT 'ready'
    CHECK (curriculum_status IN ('ready','pending_rules')),
  legacy_source_model text NOT NULL DEFAULT 'comun'
    CHECK (legacy_source_model IN ('comun','tecnica')),
  CONSTRAINT pci_mixed_model_valid CHECK (
    (model='comun' AND specialty_name IS NULL) OR
    (model='tecnica' AND specialty_name IS NOT NULL
     AND length(btrim(specialty_name)) BETWEEN 3 AND 150)
  ),
  fg_catalog_version text NOT NULL DEFAULT 'fg-sec-aprende-v2/1',
  fo_catalog_version text NOT NULL DEFAULT 'fo-sec-aprende-v2/1',
  legacy_snapshot_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador','en_revision','publicado','archivado')),
  created_by text NOT NULL CHECK (length(created_by) BETWEEN 1 AND 180),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(school_id,orientation_id,process_id),
  FOREIGN KEY (legacy_snapshot_id,school_id)
    REFERENCES pci_workspace.legacy_snapshots(snapshot_id,school_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS pci_workspace_pcis_school_idx
  ON pci_workspace.pcis(school_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS pci_workspace.events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id integer NOT NULL REFERENCES public.pci_proposals(school_id) ON DELETE RESTRICT,
  pci_id uuid NULL REFERENCES pci_workspace.pcis(pci_id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  actor text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS pci_workspace_events_school_idx
  ON pci_workspace.events(school_id,created_at DESC);

ALTER TABLE pci_workspace.legacy_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE pci_workspace.legacy_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE pci_workspace.pcis ENABLE ROW LEVEL SECURITY;
ALTER TABLE pci_workspace.pcis FORCE ROW LEVEL SECURITY;
ALTER TABLE pci_workspace.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pci_workspace.events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA pci_workspace FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA pci_workspace FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA pci_workspace TO service_role;
GRANT SELECT,INSERT ON pci_workspace.legacy_snapshots TO service_role;
GRANT SELECT,INSERT,UPDATE ON pci_workspace.pcis TO service_role;
GRANT SELECT,INSERT ON pci_workspace.events TO service_role;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA pci_workspace TO service_role;

-- Nueva escuela: INSERT puro. No hace UPDATE/DELETE de las escuelas anteriores.
-- El Edge Function debe exigir rol de administrador verificado antes del RPC.
CREATE OR REPLACE FUNCTION public.pci_workspace_create_school_v1(
  p_name text, p_cue text, p_email text, p_year integer,
  p_edit_code text, p_primary_code text, p_actor text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $fn$
DECLARE v_id integer;
BEGIN
  IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 3 AND 150
    OR p_cue IS NULL OR p_cue !~ '^[A-Za-z0-9./_-]{3,35}$'
    OR p_email IS NULL OR length(p_email) > 180
    OR (p_email <> '' AND p_email NOT LIKE '%@%')
    OR p_year IS NULL OR p_year NOT BETWEEN 2020 AND 2100
    OR p_edit_code IS NULL OR p_edit_code !~ '^PCI-[0-9]{4}$'
    OR p_primary_code IS NULL OR p_primary_code !~ '^DIR-[A-F0-9]{8}$'
    OR p_actor IS NULL OR length(btrim(p_actor)) NOT BETWEEN 1 AND 180
  THEN RAISE EXCEPTION 'Datos de institución inválidos' USING ERRCODE='22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(201161106);
  IF EXISTS(SELECT 1 FROM public.pci_proposals
     WHERE lower(data #>> '{_meta,cue}')=lower(p_cue))
  THEN RAISE EXCEPTION 'El CUE ya existe' USING ERRCODE='23505';
  END IF;
  IF EXISTS(SELECT 1 FROM public.pci_proposals WHERE edit_code=p_edit_code OR primary_code=p_primary_code)
  THEN RAISE EXCEPTION 'Una clave ya existe' USING ERRCODE='23505';
  END IF;
  SELECT greatest(1001,coalesce(max(school_id),1000)+1) INTO v_id
  FROM public.pci_proposals WHERE school_id>=1001;
  INSERT INTO public.pci_proposals(school_id,data,edit_code,primary_code)
  VALUES (v_id,jsonb_build_object(
    'schoolName',btrim(p_name),'schemaVersion',10,'areas','{}'::jsonb,'current',null,
    '_meta',jsonb_build_object('cue',upper(p_cue),'email',btrim(p_email),
            'entry_year',p_year,'origin','alta_admin_multipci')
  ),p_edit_code,p_primary_code);
  INSERT INTO pci_workspace.events(school_id,event_type,actor,metadata)
  VALUES(v_id,'school_created',p_actor,jsonb_build_object('cue',upper(p_cue)));
  RETURN jsonb_build_object('ok',true,'school_id',v_id,'name',btrim(p_name));
END;
$fn$;

-- Cada escuela conserva su documento histórico y puede registrar PCI de
-- Media y Técnica, de turnos distintos o de la misma orientación.
-- El PCI técnico es exclusivamente una ficha INACTIVA para composición:
-- hasta recibir las reglas oficiales NO se le asigna el modelo Media.
CREATE OR REPLACE FUNCTION public.pci_workspace_create_pci_v2(
  p_school_id integer, p_orientation_id text, p_title text, p_actor text,
  p_model text, p_shift_id text, p_specialty_name text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $fn$
DECLARE
  v_original jsonb;
  v_updated_at timestamptz;
  v_hash text;
  v_snapshot uuid;
  v_pci_id uuid;
  v_process_id text;
  v_orientation_id text;
  v_source_model text;
  v_catalog_fg text;
  v_catalog_fo text;
  v_curriculum_status text;
BEGIN
  IF p_school_id IS NULL OR p_school_id<1001
    OR p_model IS NULL OR p_model NOT IN ('comun','tecnica')
    OR p_shift_id IS NULL OR p_shift_id NOT IN ('manana','tarde','vespertino','noche')
    OR p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 3 AND 150
    OR p_actor IS NULL OR length(btrim(p_actor)) NOT BETWEEN 1 AND 180
    OR (p_model='comun' AND (
      p_orientation_id IS NULL OR p_orientation_id !~ '^[a-z][a-z0-9_]{2,79}

CREATE OR REPLACE FUNCTION public.pci_workspace_list_pcis_v1(
  p_school_id integer
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $fn$
SELECT coalesce(jsonb_agg(jsonb_build_object(
  'pci_id',p.pci_id,'school_id',p.school_id,'orientation_id',p.orientation_id,
  'process_id',p.process_id,'title',p.title,'status',p.status,
  'model',p.model,'shift_id',p.shift_id,'specialty_name',p.specialty_name,
  'curriculum_status',p.curriculum_status,'legacy_source_model',p.legacy_source_model,
  'created_at',p.created_at,'updated_at',p.updated_at,
  'fg_catalog_version',p.fg_catalog_version,'fo_catalog_version',p.fo_catalog_version
) ORDER BY p.created_at,p.pci_id),'[]'::jsonb)
FROM pci_workspace.pcis p WHERE p.school_id=p_school_id;
$fn$;

-- Solo lectura para un PCI autorizado; exige que el Edge valide la escuela.
CREATE OR REPLACE FUNCTION public.pci_workspace_get_pci_v1(
  p_school_id integer,p_pci_id uuid
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $fn$
SELECT jsonb_build_object(
  'pci_id',p.pci_id,'school_id',p.school_id,'orientation_id',p.orientation_id,
  'process_id',p.process_id,'title',p.title,'status',p.status,
  'model',p.model,'shift_id',p.shift_id,'specialty_name',p.specialty_name,
  'curriculum_status',p.curriculum_status,'legacy_source_model',p.legacy_source_model,
  'fg_catalog_version',p.fg_catalog_version,'fo_catalog_version',p.fo_catalog_version,
  'legacy_state',s.source_data,'legacy_sha256',s.source_sha256,
  'legacy_source_updated_at',s.source_updated_at)
FROM pci_workspace.pcis p JOIN pci_workspace.legacy_snapshots s
  ON s.snapshot_id=p.legacy_snapshot_id AND s.school_id=p.school_id
WHERE p.school_id=p_school_id AND p.pci_id=p_pci_id;
$fn$;

REVOKE ALL ON FUNCTION public.pci_workspace_create_school_v1(
 text,text,text,integer,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pci_workspace_create_pci_v1(
 integer,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pci_workspace_create_pci_v2(
 integer,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pci_workspace_list_pcis_v1(integer)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pci_workspace_get_pci_v1(integer,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pci_workspace_create_school_v1(
 text,text,text,integer,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pci_workspace_create_pci_v1(
 integer,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pci_workspace_create_pci_v2(
 integer,text,text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pci_workspace_list_pcis_v1(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.pci_workspace_get_pci_v1(integer,uuid) TO service_role;
COMMENT ON SCHEMA pci_workspace IS 'Datos separados por PCI; los datos historicos de pci_proposals no se sobreescriben.';
COMMIT;

      OR p_specialty_name IS NOT NULL))
    OR (p_model='tecnica' AND (
      p_specialty_name IS NULL OR length(btrim(p_specialty_name)) NOT BETWEEN 3 AND 150))
  THEN RAISE EXCEPTION 'Identificación de PCI, turno o rama inválida' USING ERRCODE='22023';
  END IF;
  SELECT data,updated_at INTO v_original,v_updated_at
    FROM public.pci_proposals WHERE school_id=p_school_id FOR SHARE;
  IF NOT FOUND OR jsonb_typeof(v_original) <> 'object'
     OR jsonb_typeof(v_original->'areas') <> 'object'
  THEN RAISE EXCEPTION 'Escuela o documento histórico inválido' USING ERRCODE='22023';
  END IF;
  v_source_model=CASE WHEN v_original->>'profile'='tecnica'
    THEN 'tecnica' ELSE 'comun' END;
  -- Prefijo técnico no equivale a código oficial de especialidad:
  -- sirve únicamente para aislar registros hasta recibir las reglas.
  v_orientation_id=CASE WHEN p_model='tecnica' THEN
    'tecnica_' || substr(encode(pg_catalog.sha256(
      pg_catalog.convert_to(lower(btrim(p_specialty_name)),'UTF8')),'hex'),1,16)
    ELSE p_orientation_id END;
  v_curriculum_status=CASE WHEN p_model='tecnica' THEN 'pending_rules' ELSE 'ready' END;
  v_catalog_fg=CASE WHEN p_model='tecnica' THEN 'tecnica_reglas_pendientes/0'
    ELSE 'fg-sec-aprende-v2/1' END;
  v_catalog_fo=CASE WHEN p_model='tecnica' THEN 'tecnica_especialidades_pendientes/0'
    ELSE 'fo-sec-aprende-v2/1' END;
  v_hash=encode(pg_catalog.sha256(pg_catalog.convert_to(v_original::text,'UTF8')),'hex');
  INSERT INTO pci_workspace.legacy_snapshots(
    school_id,source_updated_at,source_sha256,source_data)
  VALUES(p_school_id,v_updated_at,v_hash,v_original)
  ON CONFLICT(school_id,source_sha256) DO NOTHING;
  SELECT snapshot_id INTO v_snapshot FROM pci_workspace.legacy_snapshots
    WHERE school_id=p_school_id AND source_sha256=v_hash;
  IF v_snapshot IS NULL THEN RAISE EXCEPTION 'Resguardo del PCI original no verificado';END IF;
  v_process_id=pg_catalog.gen_random_uuid()::text;
  INSERT INTO pci_workspace.pcis(
    school_id,orientation_id,process_id,title,model,shift_id,specialty_name,
    curriculum_status,legacy_source_model,fg_catalog_version,fo_catalog_version,
    legacy_snapshot_id,created_by)
  VALUES(p_school_id,v_orientation_id,v_process_id,btrim(p_title),p_model,p_shift_id,
    CASE WHEN p_model='tecnica' THEN btrim(p_specialty_name) ELSE NULL END,
    v_curriculum_status,v_source_model,v_catalog_fg,v_catalog_fo,
    v_snapshot,p_actor)
  RETURNING pci_id INTO v_pci_id;
  INSERT INTO pci_workspace.events(school_id,pci_id,event_type,actor,metadata)
  VALUES(p_school_id,v_pci_id,'pci_created',p_actor,
    jsonb_build_object('orientation_id',v_orientation_id,'source_sha256',v_hash,
      'model',p_model,'shift_id',p_shift_id,'legacy_source_model',v_source_model,
      'curriculum_status',v_curriculum_status));
  RETURN jsonb_build_object('ok',true,'school_id',p_school_id,
    'pci_id',v_pci_id,'process_id',v_process_id,'orientation_id',v_orientation_id,
    'model',p_model,'shift_id',p_shift_id,'specialty_name',
      CASE WHEN p_model='tecnica' THEN btrim(p_specialty_name) ELSE NULL END,
    'curriculum_status',v_curriculum_status,'legacy_source_model',v_source_model,
    'status','borrador','legacy_sha256',v_hash,'source_protected',true);
END;
$fn$;

-- Compatibilidad con integraciones antiguas que crean un PCI común simple.
-- Nunca altera el login, las claves ni el documento histórico.
CREATE OR REPLACE FUNCTION public.pci_workspace_create_pci_v1(
  p_school_id integer, p_orientation_id text, p_title text, p_actor text
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $fn$
  SELECT public.pci_workspace_create_pci_v2(
    p_school_id,p_orientation_id,p_title,p_actor,'comun','manana',NULL
  );
$fn$;

CREATE OR REPLACE FUNCTION public.pci_workspace_list_pcis_v1(
  p_school_id integer
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $fn$
SELECT coalesce(jsonb_agg(jsonb_build_object(
  'pci_id',p.pci_id,'school_id',p.school_id,'orientation_id',p.orientation_id,
  'process_id',p.process_id,'title',p.title,'status',p.status,
  'model',p.model,'created_at',p.created_at,'updated_at',p.updated_at,
  'fg_catalog_version',p.fg_catalog_version,'fo_catalog_version',p.fo_catalog_version
) ORDER BY p.created_at,p.pci_id),'[]'::jsonb)
FROM pci_workspace.pcis p WHERE p.school_id=p_school_id;
$fn$;

-- Solo lectura para un PCI autorizado; exige que el Edge valide la escuela.
CREATE OR REPLACE FUNCTION public.pci_workspace_get_pci_v1(
  p_school_id integer,p_pci_id uuid
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $fn$
SELECT jsonb_build_object(
  'pci_id',p.pci_id,'school_id',p.school_id,'orientation_id',p.orientation_id,
  'process_id',p.process_id,'title',p.title,'status',p.status,
  'fg_catalog_version',p.fg_catalog_version,'fo_catalog_version',p.fo_catalog_version,
  'legacy_state',s.source_data,'legacy_sha256',s.source_sha256,
  'legacy_source_updated_at',s.source_updated_at)
FROM pci_workspace.pcis p JOIN pci_workspace.legacy_snapshots s
  ON s.snapshot_id=p.legacy_snapshot_id AND s.school_id=p.school_id
WHERE p.school_id=p_school_id AND p.pci_id=p_pci_id;
$fn$;

REVOKE ALL ON FUNCTION public.pci_workspace_create_school_v1(
 text,text,text,integer,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pci_workspace_create_pci_v1(
 integer,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pci_workspace_list_pcis_v1(integer)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pci_workspace_get_pci_v1(integer,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pci_workspace_create_school_v1(
 text,text,text,integer,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pci_workspace_create_pci_v1(
 integer,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pci_workspace_list_pcis_v1(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.pci_workspace_get_pci_v1(integer,uuid) TO service_role;
COMMENT ON SCHEMA pci_workspace IS 'Datos separados por PCI; los datos historicos de pci_proposals no se sobreescriben.';
COMMIT;
