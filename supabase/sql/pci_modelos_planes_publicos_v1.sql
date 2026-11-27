-- Biblioteca de DOCUMENTOS de los modelos públicos (Media, Técnica, BA+15).
-- Aditiva: no modifica pci_proposals, pci_workspace, pci_collaboration ni roles escolares.
BEGIN;
CREATE TABLE IF NOT EXISTS public.pci_modelos_planes_publicos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 modalidad text NOT NULL CHECK(modalidad IN ('comun','tecnica','ba15')),
 titulo text NOT NULL CHECK(char_length(titulo) BETWEEN 3 AND 140),
 descripcion text NOT NULL DEFAULT '' CHECK(char_length(descripcion)<=2500),
 archivo_nombre text NOT NULL,
 archivo_ruta text NOT NULL UNIQUE,
 tipo_archivo text NOT NULL CHECK(tipo_archivo IN (
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
 )),
 publicado boolean NOT NULL DEFAULT false,
 archivado boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pci_modelos_planes_publicos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pci_modelos_planes_publicos FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.pci_modelos_planes_publicos TO service_role;
CREATE INDEX IF NOT EXISTS pci_modelos_planes_publicos_visible_idx
 ON public.pci_modelos_planes_publicos (modalidad,updated_at DESC)
 WHERE publicado=true AND archivado=false;

-- El fichero no se publica directamente; las lecturas usan URL firmada y temporal
-- emitida solo para registros publicados. Las cargas se autorizan en Edge Function.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES (
 'pci-modelos-planes-v2','pci-modelos-planes-v2',false,8388608,
 ARRAY[
 'application/pdf',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
 ]::text[]
)
ON CONFLICT(id) DO NOTHING;
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='pci-modelos-planes-v2' AND public=false)
  THEN RAISE EXCEPTION 'El bucket debe mantenerse privado'; END IF;
END $$;
COMMIT;
