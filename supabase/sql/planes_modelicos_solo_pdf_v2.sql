-- Ajuste correctivo: PLANES MODÉLICOS son PDF, no modelos de PCI.
-- Sin registros/objetos al crear este ajuste. Respeta los datos de las escuelas.
BEGIN;
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.pci_modelos_planes_publicos WHERE tipo_archivo <> 'application/pdf')
 THEN RAISE EXCEPTION 'Se detectaron documentos anteriores de otros formatos; conservarlos antes de modificar la restricción.'; END IF;
 IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='pci-modelos-planes-v2' AND coalesce(metadata->>'mimetype','') <> 'application/pdf')
 THEN RAISE EXCEPTION 'Hay objetos no PDF en el bucket; no se modificará automáticamente.'; END IF;
END $$;
ALTER TABLE public.pci_modelos_planes_publicos DROP CONSTRAINT pci_modelos_planes_publicos_modalidad_check;
ALTER TABLE public.pci_modelos_planes_publicos
 ADD CONSTRAINT pci_modelos_planes_publicos_modalidad_check
 CHECK (modalidad IN ('general','comun','tecnica','ba15'));
ALTER TABLE public.pci_modelos_planes_publicos DROP CONSTRAINT pci_modelos_planes_publicos_tipo_archivo_check;
ALTER TABLE public.pci_modelos_planes_publicos
 ADD CONSTRAINT pci_modelos_planes_publicos_tipo_archivo_check
 CHECK (tipo_archivo = 'application/pdf');
UPDATE storage.buckets SET allowed_mime_types=ARRAY['application/pdf']::text[]
 WHERE id='pci-modelos-planes-v2' AND public=false;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='pci-modelos-planes-v2' AND public=false AND allowed_mime_types=ARRAY['application/pdf']::text[])
 THEN RAISE EXCEPTION 'No se pudo verificar el bucket PDF privado'; END IF;
END $$;
COMMIT;
