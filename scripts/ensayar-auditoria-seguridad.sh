#!/usr/bin/env bash
set -euo pipefail
# Solo corre en un contenedor descartable de GitHub Actions.
if [[ "$CI" != "true" || "$PGDATABASE" != "$PCI_AUDIT_EPHEMERAL_DB" || "$PGDATABASE" == "postgres" ]]; then
  echo "ERROR: sólo ejecutar en la base CI descartable" >&2; exit 1
fi
psqlc() { psql -X -v ON_ERROR_STOP=1 -q -A -t "$@"; }
root="$PWD"
sql="$root/auditoria/seguridad-20261126/sql"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

psqlc -f "$root/tests/seguridad-ci/fixture.sql" > "$tmp/fixture"
signature() {
  psqlc -c "SELECT md5(string_agg(school_id::text||':'||md5(data::text)||':'||edit_code||':'||primary_code, '|' ORDER BY school_id)) FROM public.pci_proposals;"
  psqlc -c "SELECT md5(string_agg(school_id||':'||orientation_id||':'||process_id||':'||revision, '|' ORDER BY school_id, orientation_id, process_id)) FROM pci_collaboration.units;"
}
privileges() {
  psqlc -c "SELECT string_agg(role_name||':'||table_name||':'||
    has_table_privilege(role_name,'public.'||table_name,'SELECT')::text,
    ',' ORDER BY role_name,table_name)
  FROM (SELECT unnest(ARRAY['anon','authenticated']) AS role_name) r
  CROSS JOIN (SELECT unnest(ARRAY['pci_users','pci_user_schools','pci_system_settings','pci_security_audit_log','pci_audit_log','pci_access_log']) AS table_name) t;"
}
before_sig="$(signature)"
before_acl="$(privileges)"
before_master="$(psqlc -c "SELECT setting_value FROM public.pci_system_settings WHERE setting_key='institutional_master_code';")"

echo '=== Verificación previa 00 ==='
psqlc -f "$sql/00-verificaciones-previas.sql" | tee "$tmp/previos"
if grep -Eq '\|f$' "$tmp/previos"; then echo 'FALLA: precondición falsa' >&2; exit 1; fi
echo '=== Simulación C2: invalidación + respaldo ==='
psqlc -f "$sql/01-c2-clave-maestra.sql" > "$tmp/c2"
echo '=== Simulación C3: índice parcial ==='
psqlc -f "$sql/02-c3-indice-intentos.sql" > "$tmp/c3"
echo '=== Simulación M7: privilegios ==='
psqlc -f "$sql/03-m7-permisos-tablas-sensibles.sql" > "$tmp/m7"
echo '=== Verificación posterior 05 ==='
psqlc -f "$sql/05-verificaciones-posteriores.sql" | tee "$tmp/posteriores"
if grep -Eq '\|f$' "$tmp/posteriores"; then echo 'FALLA: verificación posterior falsa' >&2; exit 1; fi
[[ "$(signature)" == "$before_sig" ]] || { echo 'FALLA: cambió contenido escolar' >&2; exit 1; }
[[ "$(psqlc -c "SELECT count(*) FROM public.pci_proposals")" == 239 ]] || exit 1
[[ "$(psqlc -c "SELECT count(*) FROM pci_collaboration.units")" == 6 ]] || exit 1
[[ "$(psqlc -c "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname='pci_access_log_intentos_idx'")" == 1 ]] || exit 1
echo '=== Reversiones: M7, C3, C2 ==='
psqlc -f "$sql/03-revertir-m7.sql" > "$tmp/restore-m7"
psqlc -f "$sql/02-revertir-c3.sql" > "$tmp/restore-c3"
psqlc -f "$sql/01-revertir-c2.sql" > "$tmp/restore-c2"
[[ "$(privileges)" == "$before_acl" ]] || { echo 'FALLA: privilegios no restaurados' >&2; exit 1; }
[[ "$(signature)" == "$before_sig" ]] || { echo 'FALLA: datos no restaurados' >&2; exit 1; }
[[ "$(psqlc -c "SELECT setting_value FROM public.pci_system_settings WHERE setting_key='institutional_master_code';")" == "$before_master" ]] || { echo 'FALLA: clave ficticia no restaurada' >&2; exit 1; }
[[ "$(psqlc -c "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname='pci_access_log_intentos_idx';")" == 0 ]] || { echo 'FALLA: índice persiste' >&2; exit 1; }
echo 'AUDITORIA SQL APROBADA: precondiciones, migraciones C2/C3/M7, control posterior, tres reversiones y huellas idénticas.'
