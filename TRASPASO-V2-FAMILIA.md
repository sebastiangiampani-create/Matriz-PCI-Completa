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
