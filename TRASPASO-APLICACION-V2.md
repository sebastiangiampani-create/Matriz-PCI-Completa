# Aplicación V2 con ingreso por escuela

## Recorrido

`index.html` autentica a la escuela con su código institucional. La sesión se
verifica nuevamente al abrir `pci-orientaciones.html`. La escuela muestra sus
PCI por turno, modalidad y orientación o especialidad.

Cada PCI ejecuta una sola instancia del motor V2 en el documento principal.
La navegación entre mapa, desarrollo curricular y gestión usa las pantallas
del motor. Volver a la escuela o cambiar de PCI carga un documento nuevo, para
evitar que los catálogos, variables globales y listeners de dos PCI se mezclen.
No se monta ningún iframe en este recorrido.

## Archivos

- `src/aplicacion-v2/entrada.mjs`: verifica sesión y alcance; obtiene PCI,
  vínculos históricos y estado; conecta el motor con el borrador.
- `src/aplicacion-v2/escuela.mjs`: portada institucional, selección de PCI,
  altas explícitas, vínculos y descarga de la fuente histórica inalterada.
- `src/aplicacion-v2/datos-escuela.mjs`: cliente del contrato institucional
  vigente; el token queda privado en su cierre.
- `src/aplicacion-v2/documentos.mjs`: identidad y estado completo de cada PCI.
- `src/aplicacion-v2/cargador.mjs`: ensambla el documento original y los módulos
  del manifiesto en su orden, con el catálogo de la modalidad.
- `src/aplicacion-v2/runtime-v2.js`: restauración, navegación y aviso de
  incorporación mediante llamadas directas al motor.
- `src/aplicacion-v2/recursos.mjs`: usa las copias locales de logos y bibliotecas
  de exportación, conservando sus licencias.
- `scripts/preparar-publicacion-aplicacion-v2.mjs`: genera la distribución
  estática con el acceso escolar real, sin sesiones ni datos de demostración.

V85 se deriva mediante `scripts/derivar-v2-familia.mjs`: bajo el arranque escolar
verificado no muestra el selector local de perfiles. Fuera de la aplicación
integrada conserva el funcionamiento previo. Los permisos de edición provienen
de la sesión institucional y del estado del PCI. `school_admin` no se convierte
en editor de contenidos.

## Estado y preservación

El borrador conserva todo el estado, incluida la raíz `institutional`. No se
restaura únicamente `maps[active]`. La clave identifica escuela, UUID del PCI,
modalidad, orientación, turno, proceso y procedencia histórica.

Un borrador ilegible o ajeno se conserva y detiene la edición. No se corrige su
identidad para hacerlo pasar como documento del PCI actual. Una revisión remota
distinta de la referencia del borrador requiere conciliación.

El aviso de incorporación usa el legado filtrado por los vínculos del PCI. La
aceptación conserva la semántica del migrador y adaptador aprobados, incluidos
conflictos, idempotencia, opción B de Sociales y planes por bimestre. La cobertura
sigue perteneciendo a V91. El histórico original no se modifica.

## Alcance del guardado

La aceptación y la edición curricular guardan exclusivamente un borrador en el
navegador. El servicio `pci-multipci` publicado, versión 4 verificada mediante
lectura de su fuente, todavía admite sólo los contratos de oferta anteriores.
Rechaza las unidades `v2-original-embedded-v1` y `v2-familia-*` utilizadas por el
frontend. No se presenta una confirmación de guardado remoto para ese formato.

No se desplegaron cambios de Edge ni SQL. Las altas de PCI y las asignaciones
institucionales ya soportadas se conservan como acciones explícitas del usuario.
Las pruebas interceptan esas APIs y nunca escriben en Supabase real.

## Verificación

```sh
node scripts/derivar-v2-familia.mjs --check
node --test tests/aplicacion-v2-documentos.test.mjs tests/pci-navegacion-admin.test.mjs tests/migracion-legado-fg.test.mjs tests/aplicar-migracion-v2.test.mjs tests/revision-aceptacion-v2.test.mjs tests/importacion-v2-prearmado.test.mjs tests/v2-familia-paridad.test.mjs
```

La prueba `tests/aplicacion-v2-browser.mjs` se ejecuta en el workflow aislado
`aplicacion-v2-integrada.yml`, con Playwright, APIs simuladas y catálogos locales.
Sus resultados y capturas quedan como artefactos del run. La rama principal no
se fusiona durante esta revisión.
