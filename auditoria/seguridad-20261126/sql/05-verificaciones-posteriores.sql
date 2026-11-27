-- 05 · VERIFICACIÓN POSTERIOR (SOLO LECTURA)
-- Ejecutar después de 01, 02, 03; NO repetir 00 que exige que el
-- esquema de respaldo aún no exista. No requiere activar el opcional 04.
-- Guardar este resultado junto al 00 inicial y comparar ambas huellas.
WITH chequeos AS (
  SELECT 'Resguardo de clave maestra presente' AS chequeo,
         to_regclass('pci_resguardo_seguridad_20261126.pci_system_settings') IS NOT NULL AS ok
  UNION ALL
  SELECT 'Resguardo de ACL previo presente',
         to_regclass('pci_resguardo_seguridad_20261126.permisos_previos') IS NOT NULL
  UNION ALL
  SELECT 'Código maestro invalidado',
         EXISTS (SELECT 1 FROM public.pci_system_settings
                 WHERE setting_key='institutional_master_code'
                   AND setting_value LIKE 'DESACTIVADA-%')
  UNION ALL
  SELECT 'Resguardo inaccesible a anon y authenticated',
         NOT has_schema_privilege('anon','pci_resguardo_seguridad_20261126','USAGE')
         AND NOT has_schema_privilege('authenticated','pci_resguardo_seguridad_20261126','USAGE')
  UNION ALL
  SELECT 'Sin SELECT anónimo de usuarios y claves',
         NOT has_table_privilege('anon','public.pci_users','SELECT')
         AND NOT has_table_privilege('anon','public.pci_system_settings','SELECT')
  UNION ALL
  SELECT 'Sin SELECT authenticated de usuarios y claves',
         NOT has_table_privilege('authenticated','public.pci_users','SELECT')
         AND NOT has_table_privilege('authenticated','public.pci_system_settings','SELECT')
  UNION ALL
  SELECT 'service_role sigue pudiendo registrar accesos',
         has_table_privilege('service_role','public.pci_access_log','INSERT')
  UNION ALL
  SELECT 'Índice de intentos disponible',
         to_regclass('public.pci_access_log_intentos_idx') IS NOT NULL
  UNION ALL
  SELECT '235 claves escolares PCI y DIR conservadas',
         (SELECT count(*) FROM public.pci_proposals
          WHERE school_id>=1001 AND coalesce(edit_code,'')<>''
            AND coalesce(primary_code,'')<>'')=235
)
SELECT * FROM chequeos;

-- Las dos huellas de control deben ser IDENTICAS a las registradas con 00.
SELECT count(*) AS escuelas,
       md5(string_agg(school_id::text||':'||md5(data::text)||':'||edit_code||':'||primary_code, '|' ORDER BY school_id)) AS huella_escuelas
FROM public.pci_proposals;
SELECT count(*) AS unidades,
       md5(string_agg(school_id||':'||orientation_id||':'||process_id||':'||revision, '|' ORDER BY school_id, orientation_id, process_id)) AS huella_unidades
FROM pci_collaboration.units;

-- Comprobación externa adicional obligatoria: confirmar que pci-master
-- responde 404 tras su desactivación; ningún SQL puede verificar el
-- estado de despliegue de una función Edge por sí solo.
