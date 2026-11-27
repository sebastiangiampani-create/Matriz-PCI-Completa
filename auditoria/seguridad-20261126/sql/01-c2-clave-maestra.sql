-- =====================================================================
-- 01 · C2 · Invalidar la clave maestra institucional
-- No toca claves PCI ni DIR, sesiones de escuelas ni documentos.
-- Complemento obligatorio fuera de SQL (después de este script):
--   supabase functions download pci-master --project-ref agmebsotbuurbnldxewf
--   (guardar la carpeta descargada como respaldo)
--   supabase functions delete pci-master --project-ref agmebsotbuurbnldxewf
-- Sesiones: el único ingreso con clave maestra registrado es del 28/08/2026;
-- ningún token emitido por pci-master puede seguir vigente (duran 12 h).
-- Reversión: 01-revertir-c2.sql + volver a desplegar la carpeta respaldada.
-- =====================================================================
begin;
do $$
begin
  if not exists(select 1 from public.pci_system_settings where setting_key='institutional_master_code') then
    raise exception 'Condición previa: falta institutional_master_code. No se modificó nada.';
  end if;
end $$;

create schema if not exists pci_resguardo_seguridad_20261126;
revoke all on schema pci_resguardo_seguridad_20261126 from public, anon, authenticated;

create table if not exists pci_resguardo_seguridad_20261126.pci_system_settings as
  select s.*, now() as resguardado_at from public.pci_system_settings s;
alter table pci_resguardo_seguridad_20261126.pci_system_settings enable row level security;

update public.pci_system_settings
   set setting_value = 'DESACTIVADA-' || replace(gen_random_uuid()::text, '-', ''),
       updated_at = now()
 where setting_key = 'institutional_master_code';

do $$
begin
  if (select setting_value from public.pci_system_settings where setting_key='institutional_master_code') not like 'DESACTIVADA-%'
     or not exists(select 1 from pci_resguardo_seguridad_20261126.pci_system_settings where setting_key='institutional_master_code') then
    raise exception 'Verificación posterior fallida. Se revierte la transacción.';
  end if;
end $$;
commit;
