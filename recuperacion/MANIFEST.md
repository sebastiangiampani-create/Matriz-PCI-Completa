# Manifiesto integral de recuperación PCI

Fecha de consolidación: 5 de septiembre de 2026.

## Regla de seguridad

- **`main` no se modifica.**
- No se hace merge ni PR automático desde estas ramas.
- Supabase se consulta en **solo lectura** durante la recuperación.
- No se sobrescribe `pci_proposals` hasta contar con una copia verificable y una decisión explícita de restauración.
- No se publican claves de edición, códigos primarios ni otras credenciales dentro de los archivos de recuperación.

## Ramas de resguardo

### Repositorio `sebastiangiampani-create/Matriz-PCI`

- `recuperacion/congelada-original-20260804`
  - SHA base: `9e9b98d3d9b9a0a9ee0cde4cff78016860972b78`
  - Preserva la aplicación estable original y `data/school4-seed.json`.

### Repositorio `sebastiangiampani-create/Matriz-PCI-Completa`

- `recuperacion/datos-supabase-20260904`
  - rama principal de consolidación forense de datos y evidencia.
- `recuperacion/escuela1-codigo-viejo-20260905`
  - SHA base: `ff672f77ddbcd345b1d8db0c1e8bbc8b2f5dd40f`
  - preserva la etapa de código con las cuatro escuelas y almacenamiento separado por escuela.
- `recuperacion/supabase-4-escuelas-20260808`
- `recuperacion/supabase-4-escuelas-20260821`
- `recuperacion/supabase-2-muestras-20260821`
- `recuperar-escuela-1-vieja`
- `recuperar-dos-escuelas-muestra`

## Archivos consolidados

### Escuela 1 / PCI-101

`recuperacion/escuela-1/README.md`

Documento forense que fija:

- timestamp histórico objetivo;
- evidencias directas y secundarias;
- esquema histórico de la aplicación;
- diferencias que todavía no deben rellenarse por inferencia.

`recuperacion/escuela-1/datos-recuperados.json`

Contiene la recuperación estructurada de:

- Lengua y Literatura visible en las capturas de PCI-101;
- Ciencias Sociales C1-C9;
- Ciencias Naturales C1-C9;
- nombres, carácter, ubicación, IDs recuperados y contextos disponibles;
- discrepancias explícitas sin inventar datos.

`recuperacion/escuela-1/estado-reconstruido-schema7-NO_IMPORTAR.json`

Snapshot compatible con el esquema histórico de trabajo para poder abrir, comparar o transformar la reconstrucción. **No es una orden de restauración y no debe importarse automáticamente a producción.**

`recuperacion/escuela-1/c5-un-pais-diferencia-32-vs-29.md`

Acota la diferencia del C5 histórico. El mapa de PCI-101 muestra 32 contenidos y la copia sobreviviente conserva 29. Al cruzar el documento pedagógico con el catálogo completo, los tres contenidos históricos faltantes quedan reducidos a un conjunto de seis candidatos comprobados por contenido curricular:

`c275, c276, c292, c295, c296, c740`

Sabemos que **exactamente tres** de esos seis completaban los 32 del snapshot histórico, pero todavía no hay evidencia que permita elegir cuáles tres sin especular.

### Escuela 2 / PCI-102

`recuperacion/escuela-2/README.md`

Preserva:

- timestamp histórico exacto objetivo `2026-08-04 17:08:48.523+00`;
- pruebas de que PCI-102 fue una propuesta independiente;
- pruebas de la etapa de “Escuela de muestra 2” preservada;
- evidencia de su estructura posterior;
- distinción clara entre evidencia real y datos que no pueden reconstruirse todavía sin PITR/exportación/localStorage histórico.

### Supabase

`recuperacion/fuentes/estado-supabase-20260905.json`

Snapshot de metadatos forenses de las filas relevantes:

- tamaños;
- timestamps;
- hashes del JSON;
- estado de cada fuente.

Hallazgo crítico: las filas actuales 1 y 2 tienen **el mismo hash de `data`**, confirmando que ya no contienen sus estados históricos independientes.

### Ciencias Sociales · fuentes adicionales

`recuperacion/ciencias-sociales/fuentes-sobrevivientes.json`

Preserva IDs y estructura recuperable de:

- `school_id=3` — Modelo Escuela DET, incluidos dos fragmentos con contenidos y `Otra vez Ricky`;
- `school_id=4` — Media 1, nueve laboratorios trabajados y referencia a la semilla congelada;
- `school_id=1010` — Instituto Don Orione, ocho laboratorios con trabajo sustantivo e IDs de contenidos;
- `school_id=1105` — Técnica 26, ocho espacios de integración visibles aunque sin contenidos guardados en ese estado.

## Evidencia directa destacada de Escuela 1

### Lengua y Literatura

Capturas históricas permiten identificar:

- Nivel 1: `c878` + `c859`;
- Nivel 2: `c859`;
- Nivel 3 visible en C5: 0 contenidos en el recorte histórico.

### Ciencias Sociales

Mapa histórico de PCI-101:

- C1 — La invención de quedarse — 11 contenidos;
- C2 — La lista de los que cuentan — 20 contenidos;
- C3 — Dos mapas sobre el mismo suelo — 10 contenidos;
- C4 — Cadenas para el rey — 18 contenidos;
- C5 — Un país sin manual — 32 contenidos.

Los cuatro primeros conteos coinciden exactamente con la fuente secundaria preservada y sus IDs. Para `Un país sin manual` se recuperaron 29 IDs frente a los 32 visibles históricamente. El documento curricular completo contiene 35 IDs compatibles con ese laboratorio; comparado con los 29 sobrevivientes, quedan seis candidatos (`c275,c276,c292,c295,c296,c740`) y sabemos que tres de ellos pertenecían al estado de 32. No se eligen por inferencia.

## Evidencia directa destacada de Escuela 2

Se verificó:

- existencia independiente de PCI-102;
- persistencia online histórica;
- posterior designación como escuela muestra preservada;
- capturas con matriz C1-C10 y guardado automático;
- capturas del editor de espacios.

El contenido exacto del snapshot del 4/8 todavía necesita una fuente externa histórica para ser afirmado con certeza.

## Búsqueda de exportaciones locales

Se revisaron los archivos JSON/texto accesibles en la Biblioteca para el período de trabajo de agosto. No apareció una exportación identificable de `pciAppV2`, `PCI-101` o `PCI-102`. Los textos pegados del 10/8 corresponden a materiales de planes de aprendizaje, no a snapshots de la matriz. Esto sólo describe las fuentes accesibles durante la recuperación; no demuestra que nunca haya existido otra copia local.

## Puntos de restauración externos prioritarios

Si se obtiene acceso a backup/PITR de Supabase, usar como objetivos:

- Escuela 1 / PCI-101: `2026-08-07 18:36:45.840+00`
- Escuela 2 / PCI-102: `2026-08-04 17:08:48.523+00`
- Escuela 3 / PCI-103: `2026-08-03 15:34:38.982+00`
- Escuela 4 / PCI-104: `2026-08-08 01:35:58.058+00`

La restauración debe realizarse primero en un entorno aislado o como exportación de lectura, nunca directamente sobre las filas productivas actuales.

## Qué falta para una recuperación exacta al 100 %

1. Determinar cuáles tres de `c275,c276,c292,c295,c296,c740` completaban los 32 contenidos históricos de `Un país sin manual`.
2. El JSON antiguo completo de Escuela 2 / PCI-102.
3. Confirmación exacta de C6-C10 y simultaneidades de Escuela 1 mediante snapshot histórico, cuando no exista evidencia directa suficiente.
4. Cualquier dato que haya vivido sólo en una exportación local o en `localStorage` y no haya sido sincronizado antes de la sobrescritura.

Todo lo anterior se mantiene separado de `main` hasta nueva instrucción explícita.
