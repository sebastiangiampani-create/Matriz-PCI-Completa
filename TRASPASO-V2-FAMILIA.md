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


## Actualización 22/11/2026 · Reconstrucción integral de la base técnica desde los PDF oficiales

**Decisión pedagógica:** no pedir a usuarios ni docentes que revisen 5.603 registros. El banco se reconstruye desde los documentos originales y no validando fragmentos incompletos.

### Banco recompuesto instalado en la rama PR #47

- Los 26 PDF oficiales (octubre 2026) se leen directamente con PyMuPDF, identificando las columnas **Contenidos** e **Indicadores de logro** por sus coordenadas x/y, sin mezclarlas.
- Se preservan títulos, cambios de materia dentro de una página (Música/Diseño p. 14), y la columna desplazada de **Prácticas Profesionalizantes** (Computación p. 97).
- Los 26 archivos están en data/tecnica/base-curricular/<especialidad>.json y su índice en data/tecnica/base-curricular/indice.json. Se regeneran con python scripts/reconstruir-base-tecnica.py.
- La versión actual produjo **61.114 registros** y **31.913 identificadores de concepto únicos**, con 1.111 secciones de materia en las 26 fuentes. Son registros extraídos del PDF, NO contenidos homologados oficialmente.
- Cada entrada tiene materia, año, campo, eje/subeje **solo si el PDF los identifica**, texto, página, ID estable, hash de concepto, URL y SHA del PDF. Sin ejes inventados: 12.432 entradas sin eje explícito y 28.857 sin subeje explícito.
- scripts/test-base-tecnica.py controla el catálogo 26/26, IDs, fuentes, separación de columnas, Música y Diseño en p. 14 y PP en p. 97.
- src/tecnica/base-contenidos-2026.mjs verifica el banco. src/v2-familia/catalogos-modalidad.mjs **lo prioriza en Fase 2**, conservando IDs anteriores para no perder los planes ya guardados. Se evitan repeticiones exactas por materia/año.
- La extracción vieja de 5.603 fragmentos y 163 referencias no es la fuente principal. Queda solamente como respaldo temporal si faltase la nueva base, y antecedente de auditoría.
- Fase 1 conserva 6 niveles y C1 a C12. No se alteran Media V2, BA+15, Supabase ni datos escolares.

### Verificación y pendientes reales

- GitHub Actions reconstruyó e instaló los 26 archivos en la rama de PR #47, **no en main**.
- Pruebas: python scripts/test-base-tecnica.py y node --test tests/tecnica-base-normalizada.test.mjs tests/tecnica-desagregacion-documental.test.mjs.
- La suite visual debe comprobar la carga efectiva en Fase 2, arrastre, restauración y múltiples PCI sin mezcla.
- La base es documental; no se afirma aprobación normativa del Ministerio.
- El PR sigue en borrador hasta resolver el guardián multi-PCI, verificar la interfaz y contar con una previsualización auténtica.

### No repetir

No solicitar aprobación individual de miles de registros. La tarea es **normalizar y cargar** el banco documental, conservando fuente y trazabilidad, sin cambiar la interfaz de Media ni los PCI escolares.
