#!/usr/bin/env bash
# Release de orientaciones: inactivo por defecto y datos viejos intocables.
set -euo pipefail
umask 077
fail(){ printf 'ERROR: %s\n' "$*" >&2; exit 1; }
cd "$(dirname "$0")/.."
: "$SUPABASE_PROJECT_REF"
: "$SUPABASE_DB_URL"
: "$PCI_ADMIN_HASH"
: "$PCI_DEPLOY_MODE"
[[ "$PCI_ADMIN_HASH" =~ ^[0-9a-fA-F]{64}$ ]] || fail "PCI_ADMIN_HASH debe ser un SHA256 provisto por un canal privado"
[[ "$SUPABASE_DB_URL" == *"$SUPABASE_PROJECT_REF"* ]] || fail "URL de base y Supabase project-ref no coinciden"
[[ "$PCI_DEPLOY_MODE" == "staging" || "$PCI_DEPLOY_MODE" == "production" ]] || fail "PCI_DEPLOY_MODE inválido"
PROD_REF=agmebsotbuurbnldxewf
if [[ "$SUPABASE_PROJECT_REF" == "$PROD_REF" || "$PCI_DEPLOY_MODE" == "production" ]]; then
  [[ "$SUPABASE_PROJECT_REF" == "$PROD_REF" && "$PCI_DEPLOY_MODE" == "production" ]] || fail "Proyecto de producción y modo no coinciden"
  : "$PCI_PUBLICACION_AUTORIZADA"
  : "$PCI_RESTAURACION_EXTERNA_VERIFICADA"
  [[ "$PCI_PUBLICACION_AUTORIZADA" == "SI" ]] || fail "Falta autorización de publicación"
  [[ "$PCI_RESTAURACION_EXTERNA_VERIFICADA" == "SI" ]] || fail "Falta prueba de restauración EXTERNA"
fi
for command in psql pg_dump pg_restore sha256sum supabase; do
  command -v "$command" >/dev/null || fail "Falta $command"
done
supabase --version
supabase functions deploy --help >/dev/null
supabase secrets set --help >/dev/null
OUT="$PWD/.private-backups-pci/$PCI_DEPLOY_MODE-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT"
chmod 700 "$OUT"
printf '1. Backup privado completo y archivo SHA256...\n'
pg_dump --dbname "$SUPABASE_DB_URL" --format=custom --no-owner --file "$OUT/before.pgdump"
pg_restore --list "$OUT/before.pgdump" > "$OUT/catalog.txt"
sha256sum "$OUT/before.pgdump" > "$OUT/before.sha256"
printf 'ATENCIÓN: pg_restore --list NO equivale a probar una restauración real.\n'
printf '2. Huella SHA256 de todos los PCI, antes de migrar...\n'
psql "$SUPABASE_DB_URL" -XAt -v ON_ERROR_STOP=1 -f deployment/pci-fingerprint.sql > "$OUT/pci-before.sha256"
printf '3. Esquemas privados, solo operaciones aditivas...\n'
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f migration/concurrencia/003_supabase_scoped_units.sql
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f migration/multipci/001_additive_school_pcis.sql
printf '4. Verificando PCI históricos sin cambios...\n'
psql "$SUPABASE_DB_URL" -XAt -v ON_ERROR_STOP=1 -f deployment/pci-fingerprint.sql > "$OUT/pci-after.sha256"
cmp -s "$OUT/pci-before.sha256" "$OUT/pci-after.sha256" || fail "Cambió la huella de los documentos PCI: investigar antes de publicar"
printf '5. Configuración secreta, con orientaciones DESACTIVADAS...\n'
printf 'PCI_ADMIN_HASH=%s\nPCI_ORIENTACIONES_ENABLED=false\n' "$PCI_ADMIN_HASH" > "$OUT/edge-secret.env"
chmod 600 "$OUT/edge-secret.env"
supabase secrets set --env-file "$OUT/edge-secret.env" --project-ref "$SUPABASE_PROJECT_REF"
rm -f "$OUT/edge-secret.env"
printf '6. Despliegue de pci-access completo (legacy + orientaciones apagadas)...\n'
supabase functions deploy pci-access --project-ref "$SUPABASE_PROJECT_REF" --no-verify-jwt
printf 'Código publicado, ORIENTACIONES APAGADAS. Probar accesos y guardado antiguo ANTES de activar.\n'
printf 'Backups y huellas privadas: %s\n' "$OUT"
printf 'Activar luego del piloto: supabase secrets set PCI_ORIENTACIONES_ENABLED=true --project-ref %s\n' "$SUPABASE_PROJECT_REF"
printf 'Detener sin borrar trabajos: supabase secrets set PCI_ORIENTACIONES_ENABLED=false --project-ref %s\n' "$SUPABASE_PROJECT_REF"
