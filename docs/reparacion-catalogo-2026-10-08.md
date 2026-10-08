# Reparacion de Matriz PCI: catalogo de escuelas (08/10/2026)

## Diagnostico confirmado
- Proyecto Supabase: `agmebsotbuurbnldxewf` (Matriz-PCI).
- `public.pci_proposals`: 237 filas (233 escuelas reales, 4 de muestra).
- Los identificadores, nombres, CUE y referencias del catalogo concuerdan con `schools-catalog.csv`.
- La funcion `pci-access` v8 provoca HTTP 500 cuando `loadCatalog()` no puede descargar el CSV desde GitHub Pages.
- La base de datos **no necesita reconstruccion**.

## Correccion incluida en esta rama
- `scripts/patch-pci-catalog.mjs`: transforma solo las funciones `loadCatalog()` y `ensureSchools()` de la Edge Function descargada de Supabase. Consulta las escuelas existentes mediante la conexion de servidor, incluyendo nombre, CUE, correo y anio de ingreso.
- La consulta no hace `INSERT`, `UPDATE`, `UPSERT` ni regeneracion de claves.
- Se preservan el login, las politicas, el acceso por escuela, el guardado de PCI y la auditoria.
- `tests/pci-catalog-patch.test.js`: verifica la transformacion, 233 escuelas simuladas, ausencia de escrituras y manejo de errores.
- `.github/workflows/reparar-catalogo-pci.yml`: **ejecucion manual**, nunca despliegue automatico.

## Despliegue seguro
1. En el repositorio privado de GitHub, crear el secret de Actions `SUPABASE_ACCESS_TOKEN` (token de acceso de Supabase). **Nunca** pegarlo en codigo, chats, issues ni archivos versionados.
2. Abrir **Actions > Reparar catalogo de escuelas PCI (manual) > Run workflow**.
3. Ejecutar primero con `deploy=false` para comprobar que descarga la funcion, genera el parche y ejecuta los tests.
4. Si termina correctamente, volver a ejecutarlo con `deploy=true`. El flujo descarga la version vigente de `pci-access`, la comprueba y despliega exclusivamente esa funcion, conservando `--no-verify-jwt` porque usa sesiones y controles propios.
5. Comprobar en Supabase el numero de version, los logs de `pci-access`, la respuesta real de login y `list-schools`, y el conteo de 233 escuelas; verificar permisos y guardado en una escuela autorizada.

El codigo completo de `pci-access` se descarga en el runner de Actions y **no se incorpora al repositorio**; el codigo original permanece intacto en Supabase como version anterior para recuperacion. Si el codigo remoto cambia y la estructura esperada no coincide, el parche se detiene sin desplegar.

## Alcance y limitaciones
- El cambio en GitHub por si solo **no actualiza automaticamente Supabase**: es necesario ejecutar el flujo manual con las credenciales configuradas.
- La lista desplegable inicial de `index.html` aun usa el CSV local; su publicacion requiere que GitHub Pages este operativo. El fallo HTTP 500 de la Edge Function queda resuelto por separado al desplegar el parche.
- El alta de nuevas escuelas debera realizarse mediante una importacion explicita, nunca al iniciar sesion.
