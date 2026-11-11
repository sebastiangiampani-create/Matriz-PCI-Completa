-- PCI: colaboración aislada por escuela, orientación, proceso y unidad curricular.
-- PROPUESTA NO APLICADA. SOLO DESPUES DE RESPALDO Y PRUEBA EN SUPABASE AISLADO.
-- No actualiza, migra, lee ni reinterpreta la FG histórica de pci_proposals.data.
-- No requiere Supabase Auth; la autorización institucional se verifica en Edge.
BEGIN;

CREATE SCHEMA IF NOT EXISTS pci_collaboration;
REVOKE ALL ON SCHEMA pci_collaboration FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS pci_collaboration.units (
  school_id integer NOT NULL CHECK (school_id >= 1001),
  orientation_id text NOT NULL CHECK (length(orientation_id) BETWEEN 1 AND 160),
  process_id text NOT NULL CHECK (length(process_id) BETWEEN 1 AND 160),
  component text NOT NULL CHECK (component IN ('fg','fo','articulacion','oferta')),
  unit_kind text NOT NULL CHECK (length(unit_kind) BETWEEN 1 AND 32),
  unit_id text NOT NULL CHECK (length(unit_id) BETWEEN 1 AND 240),
  base_version text NOT NULL CHECK (length(base_version) BETWEEN 1 AND 160),
  revision bigint NOT NULL CHECK (revision >= 1),
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  updated_by text NOT NULL CHECK (length(updated_by) BETWEEN 1 AND 180),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (school_id, orientation_id, process_id, component, unit_kind, unit_id),
  CONSTRAINT units_school_fk FOREIGN KEY (school_id)
    REFERENCES public.pci_proposals(school_id) ON DELETE RESTRICT,
  CONSTRAINT units_kind_check CHECK (
    (component='fg' AND unit_kind IN ('area','group','plan')) OR
    (component='fo' AND unit_kind IN ('space','group','plan')) OR
    (component='articulacion' AND unit_kind='link') OR
    (component='oferta' AND unit_kind='map')
  ),
  CONSTRAINT units_version_check CHECK (
    (component='fg' AND base_version IN ('fg-matriz-historica/1','fg-sec-aprende-v2/1')) OR
    (component='fo' AND base_version='fo-sec-aprende-v2/1' AND orientation_id <> '_general') OR
    (component='articulacion' AND base_version='pci-articulacion-fg-fo/1') OR
    (component='oferta' AND base_version LIKE 'oferta-%')
  )
);

CREATE TABLE IF NOT EXISTS pci_collaboration.unit_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id integer NOT NULL,
  orientation_id text NOT NULL,
  process_id text NOT NULL,
  component text NOT NULL,
  unit_kind text NOT NULL,
  unit_id text NOT NULL,
  base_version text NOT NULL,
  revision bigint NOT NULL CHECK (revision >= 1),
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (school_id,orientation_id,process_id,component,unit_kind,unit_id,revision),
  FOREIGN KEY (school_id,orientation_id,process_id,component,unit_kind,unit_id)
  REFERENCES pci_collaboration.units
    (school_id,orientation_id,process_id,component,unit_kind,unit_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS pci_collab_units_process_idx
  ON pci_collaboration.units (school_id,orientation_id,process_id);
CREATE INDEX IF NOT EXISTS pci_collab_history_school_idx
  ON pci_collaboration.unit_history (school_id,updated_at DESC);

ALTER TABLE pci_collaboration.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE pci_collaboration.units FORCE ROW LEVEL SECURITY;
ALTER TABLE pci_collaboration.unit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pci_collaboration.unit_history FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA pci_collaboration FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA pci_collaboration FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA pci_collaboration TO service_role;
GRANT SELECT,INSERT,UPDATE ON pci_collaboration.units TO service_role;
GRANT SELECT,INSERT ON pci_collaboration.unit_history TO service_role;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA pci_collaboration TO service_role;

-- PRIVATE-TO-SERVICE RPC. Caller has to be an Edge Function that has verified
-- a live PCI session (including active-user school-level permissions).
CREATE OR REPLACE FUNCTION public.pci_collab_get_unit_v1(
  p_school_id integer,
  p_orientation_id text,
  p_process_id text,
  p_component text,
  p_unit_kind text,
  p_unit_id text
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $rpc$
  SELECT COALESCE(
    (SELECT jsonb_build_object(
       'exists',true,'revision',u.revision,'base_version',u.base_version,
       'document',u.document,'updated_by',u.updated_by,'updated_at',u.updated_at)
     FROM pci_collaboration.units AS u
     WHERE u.school_id=p_school_id
       AND u.orientation_id=p_orientation_id AND u.process_id=p_process_id
       AND u.component=p_component AND u.unit_kind=p_unit_kind AND u.unit_id=p_unit_id),
    jsonb_build_object('exists',false,'revision',0)
  );
$rpc$;

CREATE OR REPLACE FUNCTION public.pci_collab_save_unit_v1(
  p_school_id integer,
  p_orientation_id text,
  p_process_id text,
  p_component text,
  p_unit_kind text,
  p_unit_id text,
  p_base_version text,
  p_expected_revision bigint,
  p_document jsonb,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $rpc$
DECLARE
  v_revision bigint;
  v_current_revision bigint;
  v_current_version text;
  v_updated_at timestamptz;
BEGIN
  IF p_school_id IS NULL OR p_school_id < 1001
     OR p_orientation_id IS NULL OR length(p_orientation_id) NOT BETWEEN 1 AND 160
     OR p_process_id IS NULL OR length(p_process_id) NOT BETWEEN 1 AND 160
     OR p_component IS NULL OR p_unit_kind IS NULL
     OR p_unit_id IS NULL OR length(p_unit_id) NOT BETWEEN 1 AND 240
     OR p_expected_revision IS NULL OR p_expected_revision < 0
     OR p_actor IS NULL OR length(p_actor) NOT BETWEEN 1 AND 180
     OR p_document IS NULL OR jsonb_typeof(p_document) <> 'object'
     OR pg_column_size(p_document) > 1048576
  THEN
    RAISE EXCEPTION 'Documento o alcance curricular inválido' USING ERRCODE = '22023';
  END IF;
  IF NOT (
    (p_component='fg' AND p_unit_kind IN ('area','group','plan')
      AND p_base_version IN ('fg-matriz-historica/1','fg-sec-aprende-v2/1')) OR
    (p_component='fo' AND p_unit_kind IN ('space','group','plan')
      AND p_base_version='fo-sec-aprende-v2/1' AND p_orientation_id <> '_general') OR
    (p_component='articulacion' AND p_unit_kind='link'
      AND p_base_version='pci-articulacion-fg-fo/1') OR
    (p_component='oferta' AND p_unit_kind='map'
      AND p_base_version LIKE 'oferta-%')
  ) THEN
    RAISE EXCEPTION 'Versión, orientación o tipo curricular incompatible' USING ERRCODE='22023';
  END IF;
  -- El primer editor puede crear la unidad si la revisión esperada es 0.
  IF p_expected_revision = 0 THEN
    INSERT INTO pci_collaboration.units AS u (
      school_id,orientation_id,process_id,component,unit_kind,unit_id,
      base_version,revision,document,updated_by,updated_at
    ) VALUES (
      p_school_id,p_orientation_id,p_process_id,p_component,p_unit_kind,p_unit_id,
      p_base_version,1,p_document,p_actor,clock_timestamp()
    ) ON CONFLICT (school_id,orientation_id,process_id,component,unit_kind,unit_id)
       DO NOTHING
    RETURNING u.revision,u.updated_at INTO v_revision,v_updated_at;
  ELSE
    -- Dos solicitudes sobre la MISMA unidad no pueden ganar con la misma revisión.
    -- Una unidad de otra orientación/proceso/área usa otra clave primaria.
    UPDATE pci_collaboration.units AS u
       SET document=p_document,revision=u.revision+1,
           updated_by=p_actor,updated_at=clock_timestamp()
     WHERE u.school_id=p_school_id AND u.orientation_id=p_orientation_id
       AND u.process_id=p_process_id AND u.component=p_component
       AND u.unit_kind=p_unit_kind AND u.unit_id=p_unit_id
       AND u.revision=p_expected_revision AND u.base_version=p_base_version
    RETURNING u.revision,u.updated_at INTO v_revision,v_updated_at;
  END IF;

  IF v_revision IS NULL THEN
    SELECT u.revision,u.base_version
      INTO v_current_revision,v_current_version
    FROM pci_collaboration.units AS u
    WHERE u.school_id=p_school_id AND u.orientation_id=p_orientation_id
      AND u.process_id=p_process_id AND u.component=p_component
      AND u.unit_kind=p_unit_kind AND u.unit_id=p_unit_id;
    RETURN jsonb_build_object('ok',false,'status',409,'code','stale_revision',
      'current_revision',v_current_revision,'current_base_version',v_current_version);
  END IF;

  -- Misma transacción: historial completo o ninguna escritura.
  INSERT INTO pci_collaboration.unit_history (
    school_id,orientation_id,process_id,component,unit_kind,unit_id,
    base_version,revision,document,updated_by,updated_at
  ) VALUES (
    p_school_id,p_orientation_id,p_process_id,p_component,p_unit_kind,p_unit_id,
    p_base_version,v_revision,p_document,p_actor,v_updated_at
  );
  RETURN jsonb_build_object('ok',true,'revision',v_revision,'updated_at',v_updated_at);
END;
$rpc$;

REVOKE ALL ON FUNCTION public.pci_collab_get_unit_v1(
  integer,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pci_collab_save_unit_v1(
  integer,text,text,text,text,text,text,bigint,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pci_collab_get_unit_v1(
  integer,text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pci_collab_save_unit_v1(
  integer,text,text,text,text,text,text,bigint,jsonb,text) TO service_role;

COMMENT ON FUNCTION public.pci_collab_save_unit_v1(
  integer,text,text,text,text,text,text,bigint,jsonb,text)
IS 'Solo API de colaboracion, con token PCI verificado por Edge. Nunca reemplaza pci_proposals.data.';
COMMIT;
