-- =====================================================================
-- 03 · M7 (parte segura) · Quitar permisos de tabla del rol anónimo y
-- authenticated sobre tablas que el navegador NUNCA usa directamente.
-- Hoy ya están bloqueadas por RLS sin políticas: el cambio es defensa en
-- profundidad, sin efecto visible. NO toca pci_proposals (ver script 04).
-- Las funciones Edge usan service_role: no se ven afectadas.
-- Reversión: 03-revertir-m7.sql (restaura el permiso por defecto de Supabase).
-- =====================================================================
begin;
create schema if not exists pci_resguardo_seguridad_20261126;
create table if not exists pci_resguardo_seguridad_20261126.permisos_previos as
  select c.relname, c.relacl::text as relacl, now() as resguardado_at
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','v');
alter table pci_resguardo_seguridad_20261126.permisos_previos enable row level security;

revoke all on public.pci_users, public.pci_user_schools, public.pci_system_settings,
              public.pci_security_audit_log, public.pci_audit_log, public.pci_access_log
  from anon, authenticated;

do $$
begin
  if has_table_privilege('anon','public.pci_users','SELECT')
     or not has_table_privilege('service_role','public.pci_access_log','INSERT') then
    raise exception 'Verificación posterior fallida. Se revierte la transacción.';
  end if;
end $$;
commit;
