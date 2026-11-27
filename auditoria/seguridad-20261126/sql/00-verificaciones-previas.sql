-- =====================================================================
-- 00 · Verificaciones previas (SOLO LECTURA). Ejecutar antes y guardar el
-- resultado. Cada fila debe mostrar ok = true para continuar.
-- SOLO ANTES DE LOS CAMBIOS: la condicion "No existe resguardo previo"
-- deja de cumplirse despues de crear el respaldo. Para comprobaciones
-- posteriores usar 05-verificaciones-posteriores.sql, NO repetir 00.
-- Proyecto: agmebsotbuurbnldxewf (Matriz-PCI). Fecha de preparación: 26/11/2026.
-- =====================================================================
with chequeos as (
  select 'Existe la clave maestra (C2)' as chequeo,
         exists(select 1 from public.pci_system_settings where setting_key='institutional_master_code') as ok
  union all
  select 'Ningún ingreso con clave maestra en los últimos 30 días',
         not exists(select 1 from public.pci_access_log
                    where metadata->>'source'='institutional_master' and created_at > now()-interval '30 days')
  union all
  select 'Sin usuarios en auth.users (revocar authenticated no afecta a nadie)',
         (select count(*) from auth.users)=0
  union all
  select 'Las funciones Edge usan service_role (permiso intacto en pci_proposals)',
         has_table_privilege('service_role','public.pci_proposals','UPDATE')
  union all
  select 'No existe resguardo previo con el mismo nombre',
         not exists(select 1 from pg_namespace where nspname='pci_resguardo_seguridad_20261126')
  union all
  select 'Las 235 escuelas reales conservan clave PCI y DIR',
         (select count(*) from public.pci_proposals where school_id>=1001
            and coalesce(edit_code,'')<>'' and coalesce(primary_code,'')<>'')=235
)
select * from chequeos;

-- Huella de control para comparar después (debe ser IDÉNTICA antes y después
-- de cada script: ningún script toca documentos ni claves escolares).
select count(*) as escuelas,
       md5(string_agg(school_id::text||':'||md5(data::text)||':'||edit_code||':'||primary_code, '|' order by school_id)) as huella_escuelas
from public.pci_proposals;
select count(*) as unidades,
       md5(string_agg(school_id||':'||orientation_id||':'||process_id||':'||revision, '|' order by school_id,orientation_id,process_id)) as huella_unidades
from pci_collaboration.units;
