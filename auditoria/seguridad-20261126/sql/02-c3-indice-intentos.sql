-- =====================================================================
-- 02 · C3 · Índice para contar intentos fallidos (lo usa limite-intentos.ts)
-- Solo agrega un índice parcial. No cambia datos ni permisos.
-- Reversión: 02-revertir-c3.sql
-- =====================================================================
create index concurrently if not exists pci_access_log_intentos_idx
  on public.pci_access_log (access_type, school_id, created_at desc)
  where success = false;
