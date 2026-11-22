# Traspaso: motor V2 para Técnica y BA +15

Rama: `fix/rescate-constructor-v2-reglas-20261119` · PR #47 (borrador).

## Reglas permanentes

- No modificar `pci-sec-aprendeV2` ni `vendor/pci-sec-aprende-v2/` (la prueba de paridad lo verifica por hash).
- No escribir en Supabase desde scripts ni pruebas. La persistencia existente (`src/orientaciones-online.mjs`) no se toca.
- No crear constructores alternativos: Técnica y BA +15 usan el mismo motor V2 que Media.
- Si se cambia algo de los módulos V2 derivados, se edita el generador, nunca los archivos de `src/v2-familia/derivados/`.

## Piezas

| Archivo | Función |
|---|---|
| `revision-v2-modalidad.html` | Carga Técnica/BA +15 con la misma secuencia de módulos que V2 (según el manifiesto). |
| `scripts/derivar-v2-familia.mjs` | Genera los derivados por modalidad y el manifiesto. `--check` verifica que estén al día. |
| `src/v2-familia/manifiesto-paridad-v2.json` | Estado de los 45 módulos de V2: original / derivado / derivado-previo / pendiente-normativa (con su equivalente por modalidad). |
| `src/v2-familia/v19-mapa-modalidad.js` | Filas del mapa y reglas: `techMember` (Técnica), `baMember` + `baEvaluate` (BA +15), validación en `validateOffer`. |
| `src/normativa/composicion-pci-20261117.mjs` | Validador puro de IF-2026-51169092-GCABA-SSPIE (Técnica y Media). |
| `src/v2-familia/catalogos-modalidad.mjs` | Catálogos de materias y contenidos por modalidad. |

## Normativa aplicada

- Técnica: IF-2026-51169092-GCABA-SSPIE, Anexo II, págs. 13–18.
- BA +15: RES-1375-MEDGC-25, Anexo I (6.3 estructura de 38 h, 6.5 áreas) y SSGDA-105-26 (turno noche: presencialidad).

## Pruebas

```
node scripts/derivar-v2-familia.mjs --check
node --test tests/v2-familia-paridad.test.mjs
node tests/v2-familia-modalidades-browser.mjs
node tests/v2-tecnica-norma-browser.mjs
node tests/v2-ba15-norma-browser.mjs
```

## Pendientes

1. Cargas horarias de Técnica por especialidad (sin ellas no se verifica el tope de 9 h).
2. Los espacios anuales de cada especialidad técnica figuran como integración en el catálogo (p. ej. Computación: Lab. de Algoritmos, Lab. Orientado a Objetos, Desarrollo de Sistemas).
3. URL pública de prueba: Pages con fuente "GitHub Actions" y publicación del PR en subcarpeta, sin cambiar la raíz.
4. Botón "Volver al panel" tapado por el encabezado (también en V2 original).
5. Revisión pedagógica e institucional con casos reales antes de fusionar.

## Hecho (no rehacer)

- Secuencia completa de módulos V2 en Técnica y BA +15 (generador + manifiesto).
- Reglas IF-2026-51169092 (Técnica) y RES-1375-MEDGC-25 (BA +15) en el mapa y en Validar Mapa.
- 16 orientaciones con bloque → eje → subeje en Media y BA +15 (derivado `derivados/media/v47-phase2-matrix.js`).
- Lengua Adicional 1.º–5.º en Técnica desde la NES.
- Ciclos de refresco del DOM corregidos (Tutoría y talleres de Artes); guardián actualizado con autorización.

## Actualización 22/11/2026 · Técnica: auditoría y protección de Fase 2
 
### Cambios de este ciclo (PR #47 sin fusionar)

- El motor V2 de Media permanece intacto; Técnica conserva 6 niveles y 12 cuatrimestres.
- Los 10.422 contenidos con cotejo textual previo se conservan; no se reescriben las fuentes.
- La segunda pasada reconoce 5.603 **fragmentos documentales provisionales** asociados a 1.042 referencias. Ninguno tiene el eje/subeje confirmado pedagógicamente; no llamarlos homologados.
- Permanecen 163 referencias sin desagregación segura. Incluyen casos sin año explícito (Música, Diseño), páginas sin texto extraído (p. ej. Computación p. 98) y páginas con indicadores que no permiten reconstruir contenidos inequívocos.
- Archivo de extracción conservadora: `src/tecnica/desagregacion-documental-2026.mjs`. Catálogo: `src/v2-familia/catalogos-modalidad.mjs`.
- Informe detallado reproducible (por especialidad, materia, año, motivo, fuente y página): `node scripts/qa-tecnica-priorizados.mjs`, produce `test-artifacts/tecnica/auditoria-pendientes-2026.json`.
- En Fase 2, las entradas provisionales están identificadas, llevan vínculo a página oficial del PDF y **no se incluyen en el porcentaje de cobertura cotejada**. No se borran las asignaciones guardadas.
- No se modificó `main`, el `vendor/pci-sec-aprende-v2` ni la persistencia de Supabase.

### Verificación

```bash
node scripts/derivar-v2-familia.mjs --check
node scripts/qa-tecnica-priorizados.mjs
node --test tests/tecnica-priorizados-2026.test.mjs tests/tecnica-contenidos-atomicos.test.mjs tests/tecnica-desagregacion-documental.test.mjs
node tests/v2-familia-modalidades-browser.mjs
node tests/aplicacion-v2-browser.mjs
node tests/v2-tecnica-norma-browser.mjs
```

Los workflows `Motor V2 real por tres modalidades` y `Rescate constructor PCI V2` ya usan las pruebas del **portal nativo**, no las del iframe obsoleto. Rescate constructor dio verde. El recorrido de Técnica y sus prescripciones también fue satisfactorio en el navegador; la suite global conserva un fallo separado en `v2-ba15-norma-browser.mjs` (validación visual de BA+15, fuera de este cierre de Técnica). El guardián aditivo multi-PCI continúa rojo por diferencias previas del PR en `panel-accesos.html`, `panel-usuarios.html` y `src/normativa/composicion-pci-20261117.mjs`; **no se relajó el guardián**. La URL pública de revisión no está desplegada: no presentar como preview funcionando.

### Bloqueos para dar por cerrada Técnica

1. Revisar contra las páginas oficiales los 5.603 fragmentos provisionales y establecer ejes/subejes confiables; sin esto no equivale a un banco curricular homologado.
2. Resolver o clasificar con evidencia las 163 referencias restantes, sin inventar año ni contenido. Hay referencias con página sin texto, no necesariamente una omisión curricular.
3. Reconciliar el diff del PR para cumplir el guardián de integración multi-PCI y publicar una preview aislada verificable **antes** de fusionar.
4. No trabajar BA+15 hasta cerrar la auditoría y las pruebas propias de Técnica.
