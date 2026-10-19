-- PROPUESTA: NO EJECUTAR EN SUPABASE DE PRODUCCION.
-- Requiere revisión y base PostgreSQL de prueba aislada.
-- Sin modificación alguna a pci_proposals ni a sus RLS o filas.
BEGIN;
CREATE SCHEMA IF NOT EXISTS pci_collaboration;
REVOKE ALL ON SCHEMA pci_collaboration FROM PUBLIC;
CREATE TABLE IF NOT EXISTS pci_collaboration.scoped_documents (
 school_id integer NOT NULL,
 component text NOT NULL,
 orientation_id text NOT NULL,
 process_id text NOT NULL,
 unit_kind text NOT NULL,
 unit_id text NOT NULL,
 base_version text NOT NULL,
 revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1),
 document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
 updated_by text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (school_id,component,orientation_id,process_id,unit_kind,unit_id),
 CONSTRAINT scoped_documents_school_fk FOREIGN KEY (school_id)
   REFERENCES public.pci_proposals (school_id) ON DELETE RESTRICT,
 CONSTRAINT scoped_documents_component_check CHECK (component IN ('fg','fo','oferta','articulacion')),
 CONSTRAINT scoped_documents_base_check CHECK (
  (component='fg' AND base_version IN ('fg-matriz-historica/1','fg-sec-aprende-v2/1')) OR
  (component='fo' AND base_version='fo-sec-aprende-v2/1') OR
  (component='articulacion' AND base_version='pci-articulacion-fg-fo/1') OR
  (component='oferta' AND base_version LIKE 'oferta-%')
 )
);
CREATE TABLE IF NOT EXISTS pci_collaboration.scoped_document_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 school_id integer NOT NULL,
 component text NOT NULL,
 orientation_id text NOT NULL,
 process_id text NOT NULL,
 unit_kind text NOT NULL,
 unit_id text NOT NULL,
 base_version text NOT NULL,
 revision bigint NOT NULL,
 document jsonb NOT NULL,
 updated_by text NOT NULL,
 updated_at timestamptz NOT NULL,
 UNIQUE(school_id,component,orientation_id,process_id,unit_kind,unit_id,revision)
);
CREATE INDEX IF NOT EXISTS scoped_history_school_idx
 ON pci_collaboration.scoped_document_history (school_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS scoped_documents_process_idx
 ON pci_collaboration.scoped_documents (school_id,orientation_id,process_id);
ALTER TABLE pci_collaboration.scoped_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE pci_collaboration.scoped_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE pci_collaboration.scoped_document_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pci_collaboration.scoped_document_history FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA pci_collaboration FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA pci_collaboration FROM PUBLIC,anon,authenticated;
-- El rol técnico de la API requiere concesiones explícitas y sin BYPASSRLS.
-- El backend autenticado deberá ejecutar SQL parametrizado dentro de una
-- transacción validada con rol SQL restringido y políticas por escuela.
-- No activar la escritura hasta que estas políticas estén aprobadas/probadas.
COMMIT;
