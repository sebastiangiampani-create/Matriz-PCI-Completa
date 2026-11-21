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

1. Catálogo de Técnica (Computación): faltan Lengua Adicional 1.º–5.º y cargas horarias; los tres espacios anuales figuran como integración.
2. Control `motor-curricular-y-resguardo`: decidir si se agrega `arts-multiple-workshops.js` a la lista del guardián o se revierte ese arreglo.
3. URL pública de prueba: requiere cambiar en GitHub la fuente de Pages a "GitHub Actions".
4. Botón "Volver al panel" tapado por el encabezado (también ocurre en V2 original).
