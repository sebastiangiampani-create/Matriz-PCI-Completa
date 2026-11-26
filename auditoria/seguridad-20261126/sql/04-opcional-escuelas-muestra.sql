-- =====================================================================
-- 04 · OPCIONAL · Cerrar las escuelas muestra 1–4 al acceso anónimo.
-- ATENCIÓN: escuela.html y escuela-muestra.html (páginas de demostración,
-- no enlazadas desde index.html) leen y guardan esas filas con la clave
-- pública. Después de este script DEJAN DE FUNCIONAR. Ejecutar solo si se
-- decide retirar esas demos. No afecta escuelas reales (school_id >= 1001).
-- Reversión: 04-revertir-escuelas-muestra.sql
-- =====================================================================
begin;
create schema if not exists pci_resguardo_seguridad_20261126;
create table if not exists pci_resguardo_seguridad_20261126.escuelas_muestra as
  select p.*, now() as resguardado_at from public.pci_proposals p where school_id between 1 and 4;
create table if not exists pci_resguardo_seguridad_20261126.politicas_previas as
  select polname, polcmd, pg_get_expr(polqual, polrelid) as qual,
         pg_get_expr(polwithcheck, polrelid) as chk, now() as resguardado_at
  from pg_policy where polrelid = 'public.pci_proposals'::regclass;
alter table pci_resguardo_seguridad_20261126.escuelas_muestra enable row level security;
alter table pci_resguardo_seguridad_20261126.politicas_previas enable row level security;

drop policy if exists "Lectura pública solo escuelas muestra" on public.pci_proposals;
drop policy if exists "Actualización pública solo escuelas muestra" on public.pci_proposals;
revoke all on public.pci_proposals from anon, authenticated;
commit;
