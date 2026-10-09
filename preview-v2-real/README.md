# Vista auténtica aislada de PCI Secundaria Aprende V2

**Únicamente rama de prueba de Matriz PCI Completa.** Origen consultado en modo lectura: `sebastiangiampani-create/pci-sec-aprendeV2`, commit `883707e281894990b537032880922f4c078689ad`.

Esta carpeta contiene **solo el subconjunto curricular necesario de PCI Aprende V2**: mapa de la oferta, bolsas FG/FO, reglas de composición, arrastre, desarrollo curricular, planes y cobertura. **No contiene ni carga los módulos de usuarios, permisos locales, perfiles, cargos, docentes, estudiantes o gestión institucional propios de V2**. Las bases de contenidos FG v103 y FO v96 se mantienen como referencia. Se ejecuta en su propio subdirectorio, con archivos locales, y **no consulta Supabase ni las 233 escuelas**.

## Modificaciones de aislamiento frente al código original

- Se cambia **solamente en esta copia** el nombre de la clave de localStorage a `pci-matriz-fg-v2-original-preview-20261009` para impedir colisiones entre la prueba y PCI Aprende V2.
- Se resuelven los dos logotipos PNG ya existentes en Matriz como `../assets/ba-logo.png` y `../assets/ba-ciudad-footer.png`.
- Se mantienen las funciones curriculares seleccionadas, sin rediseñar el mapa, y se **excluyen físicamente los 17 módulos de acceso/gestión ajenos a Matriz**. Las dos imágenes institucionales SVG se copian localmente.
- **Matriz PCI Completa conserva su propio acceso, escuela y autorizaciones**. Este simulador no crea usuarios, docentes ni sesiones institucionales; no está conectado todavía a las sesiones reales de Matriz. La clave local solo almacena decisiones curriculares de demostración.
- Esta versión **no recibe aún los agrupamientos de escuelas reales de Matriz**; ese adaptador se implementa y comprueba por separado, sin sobrescribir planes ni secuencias.

Abrir `preview-v2-real/app.html` desde un servidor HTTP estático en la rama de prueba. **No abrir como `file://`**, ya que `fetch()` necesita HTTP para cargar las bases.

### Aceptación mínima

Al cargar: selector original de orientaciones → Abrir PCI → Mapa de la Oferta. Deben aparecer la bolsa de materias de Formación General y Orientada (alternativas A/B) y la matriz de Nivel 1 a 5 con C1–C10 y controles originales de composición. El guardado es **local del navegador de prueba**, no la base de producción.

Los casos de pruebas de la carpeta se validan en `tests/integracion-v2-original.test.js` y `tests/integracion-v2-original-browser.mjs`.

## Alcance pedagógico sin calificaciones

**Calificaciones queda explícitamente excluido.** En la rama de prueba se eliminó físicamente `src/v114-plan-criteria-excel.js`, junto con su carga. No existe pantalla de calificaciones, calificación final, registro de notas ni exportación de planillas de calificación. Se mantienen los criterios de evaluación del **plan de aprendizaje** y las cuatro etapas de las secuencias (punto de partida, indagación, producción y evaluación), que son pedagógicos y no equivalen a calificaciones.

No se borran datos históricos ni se realiza ninguna migración sobre las escuelas. La única plataforma de acceso será Matriz PCI Completa una vez que la integración institucional esté verificada.

## Ajuste visual acotado a Matriz PCI (2026-10-09)

La copia adopta **la identidad visual de Matriz PCI Completa** (Archivo, azul institucional, banda celeste, bordes, botones redondeados, logos de encabezado y pie). Se agrego exclusivamente `estetica-matriz-compacta.css`, aplicado despues del CSS de V2. En el inicio se redujeron el campo de escuela, la grilla de orientaciones y el resumen de PCI activos. El selector mantiene sus 16 opciones y conserva su estado. **No se altero el motor curricular, la matriz de arrastre, las reglas ni las secuencias**. Los logos se resuelven desde `../assets` de Matriz, sin copiar nuevos usuarios. Todo sigue siendo una prueba local sin Supabase y sin publicacion en `main`.

## Corrección del inicio: retorno a la lógica de Matriz PCI

La anterior compactación por CSS resultó insuficiente: seguían visibles las 16 orientaciones de V2. Ahora el inicio se reorganiza con la **escuela como título**, un solo selector de **orientación activa**, y un único acceso al PCI en curso. Las 16 opciones oficiales siguen disponibles en **«Administrar orientaciones»**, plegado por defecto. La selección y los datos de otras orientaciones no se borran ni reinicializan. El campo duplicado de nombre de escuela se mantiene internamente para compatibilidad, pero ya no se solicita al usuario.

Este cambio afecta solo el inicio de la copia en pruebas. El motor C1-C10, la bolsa FG/FO, la composición y el desarrollo de secuencias siguen sin cambios.

## Inicio simplificado y texto operativo

Se conserva el encabezado y los colores de Matriz PCI, con **una única acción visible**: orientación de la escuela → Abrir PCI. Se quitó la duplicación de nombre de escuela, orientación y tarjeta de PCI. La configuración de orientaciones es secundaria y plegada por defecto, con explicación pedagógica clara. La pantalla indica expresamente que es una vista ficticia, no conectada a usuarios ni matrices reales. Se mantienen controles y nombres DOM que necesita el motor curricular, sin modificar la composición, el arrastre, la cobertura ni los planes.
