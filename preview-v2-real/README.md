# Vista auténtica aislada de PCI Secundaria Aprende V2

**Únicamente rama de prueba de Matriz PCI Completa.** Origen consultado en modo lectura: `sebastiangiampani-create/pci-sec-aprendeV2`, commit `883707e281894990b537032880922f4c078689ad`.

Esta carpeta incluye una copia del **código ejecutable completo** de la aplicación original (pantallas, bolsa FG/FO, agrupamientos, drag & drop, reglas y Fase 2), además de sus bases curriculares FG v103 y FO v96. Se ejecuta en su propio subdirectorio, con archivos locales, y **no consulta Supabase ni las 233 escuelas**.

## Modificaciones de aislamiento frente al código original

- Se cambia **solamente en esta copia** el nombre de la clave de localStorage a `pci-matriz-fg-v2-original-preview-20261009` para impedir colisiones entre la prueba y PCI Aprende V2.
- Se resuelven los dos logotipos PNG ya existentes en Matriz como `../assets/ba-logo.png` y `../assets/ba-ciudad-footer.png`.
- El resto de las funciones originales se conserva sin rediseño. Las dos imágenes institucionales SVG están copiadas localmente.
- Esta versión **no recibe aún los agrupamientos de escuelas reales de Matriz**; ese adaptador se implementa y comprueba por separado, sin sobrescribir planes ni secuencias.

Abrir `preview-v2-real/app.html` desde un servidor HTTP estático en la rama de prueba. **No abrir como `file://`**, ya que `fetch()` necesita HTTP para cargar las bases.

### Aceptación mínima

Al cargar: selector original de orientaciones → Abrir PCI → Mapa de la Oferta. Deben aparecer la bolsa de materias de Formación General y Orientada (alternativas A/B) y la matriz de Nivel 1 a 5 con C1–C10 y controles originales de composición. El guardado es **local del navegador de prueba**, no la base de producción.

Los casos de pruebas de la carpeta se validan en `tests/integracion-v2-original.test.js` y `tests/integracion-v2-original-browser.mjs`.
