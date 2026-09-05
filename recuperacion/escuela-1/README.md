# Escuela 1 · PCI-101 — reconstrucción forense

> Rama de recuperación. Este material **no modifica `main`** y no se escribió sobre `pci_proposals`.

## Objetivo

Reconstruir el estado de la antigua **Escuela 1 / PCI-101** a partir de fuentes independientes: capturas históricas, código congelado, catálogo de contenidos, la semilla histórica de laboratorios y estados posteriores que conservaron la misma propuesta curricular.

## Momento objetivo

La captura histórica de Supabase conserva para Escuela 1 el `updated_at`:

`2026-08-07 18:36:45.84+00`

Ese es el punto de referencia para una eventual restauración exacta mediante backup/PITR externo.

## Estructura de datos histórica

La aplicación usaba `pciAppV2` y luego snapshots por escuela. El estado compatible con la versión de agosto de 2026 tiene, como mínimo:

- `schemaVersion: 7`
- `current`
- `areas`
- por área: `closed` y `groups`
- por agrupamiento: `name`, `objective`, `context`, `type`, `term`, `custom`, `elective`, `items`
- campos temporales normalizados: `level`, `termStart`, `termEnd`, `weeklyHours`, `hours`, `hoursMode`, `hoursByTerm`
- en el mapa institucional también se utilizó `component` (`formacion_general` / `formacion_orientada`).

## Evidencia directa de Escuela 1

Una captura histórica del **Mapa Curricular Institucional · Escuela 1 · PCI-101** muestra directamente:

### Lengua y Literatura

- Nivel 1 · C1-C2: **2 contenidos**
- Nivel 2 · C3-C4: **1 contenido**
- Nivel 3 · C5-C6: en la parte visible figura **0 contenidos**

Una segunda captura del editor `PCI-101 · Matriz 1` muestra `70 visibles · 68 pendientes`, es decir, dos contenidos únicos utilizados en el área. Se ven asignados:

- `c859` — **Lectura de un subgénero narrativo moderno (policial, fantástico, ciencia ficción o terror).**
- `c878` — **Lectura, comentario y análisis de textos periodísticos de opinión (editorial y columna de opinión).**

La captura permite reconstruir con alta confianza:

- Nivel 1: `c878` + `c859`
- Nivel 2: `c859`

El contenido `c859` aparece repetido entre dos niveles, comportamiento permitido por la aplicación de esa etapa.

### Matemática

En la captura del mapa, C1-C5 aparecen como **Sin espacios**. No se fuerza una reconstrucción inventada de grupos no iniciados.

### Lenguas Adicionales

En la captura del mapa, C1-C5 aparecen como **Sin espacios**. No se fuerza una reconstrucción inventada de grupos no iniciados.

### Ciencias Sociales

La captura de Escuela 1 muestra de forma directa:

- C1 — **La invención de quedarse** — **11 contenidos**
- C2 — **La lista de los que cuentan** — **20 contenidos**
- C3 — **Dos mapas sobre el mismo suelo** — **10 contenidos**
- C4 — **Cadenas para el rey** — **18 contenidos**
- C5 — **Un país sin manual** — **32 contenidos**

La propuesta completa está corroborada por el documento `PCI Laboratorios CN CS.docx` y por un estado posterior de `school_id=4` que conserva nombres, contextos e IDs. La trayectoria documentada es:

1. C1 — La invención de quedarse — Obligatorio — 1.º — referencia pedagógica 9 h
2. C2 — La lista de los que cuentan — Electivo — 1.º — referencia pedagógica 9 h
3. C3 — Dos mapas sobre el mismo suelo — Obligatorio — 2.º — referencia pedagógica 9 h
4. C4 — Cadenas para el rey — Electivo — 2.º — referencia pedagógica 9 h
5. C5 — Un país sin manual — Obligatorio — 3.º — referencia pedagógica 9 h
6. C6 — Quién sostiene todo esto — Electivo — 3.º — referencia pedagógica 9 h
7. C7 — Con la ley en la mano — Obligatorio — 4.º — referencia pedagógica 6 h
8. C8 — Del suelo al bolsillo — Electivo — 4.º — referencia pedagógica 6 h
9. C9 — La caja de herramientas — Electivo — 5.º — referencia pedagógica 2 h

**Importante:** el mapa histórico de Escuela 1 mostraba `0 h` en las tarjetas visibles. Por eso el archivo `estado-reconstruido-schema7.json` conserva `weeklyHours/hours = 0` para no mezclar el dato almacenado con las horas pedagógicas del documento. Las horas planificadas quedan sólo en metadatos de recuperación.

#### IDs recuperados de Ciencias Sociales

Coincidencia directa de cantidad entre la captura de Escuela 1 y el estado posterior preservado:

- La invención de quedarse (11): `c712,c713,c763,c764,c765,c766,c767,c804,c805,c806,c276`
- La lista de los que cuentan (20): `c715,c716,c717,c718,c719,c720,c721,c740,c768,c769,c770,c807,c808,c809,c810,c812,c813,c814,c815,c275`
- Dos mapas sobre el mismo suelo (10): `c731,c732,c733,c772,c816,c817,c818,c819,c820,c821`
- Cadenas para el rey (18): `c725,c726,c727,c728,c729,c730,c734,c735,c776,c777,c778,c779,c822,c823,c824,c825,c826,c827`

Para los laboratorios posteriores se preservan los IDs encontrados en la fuente secundaria:

- Un país sin manual: 29 IDs recuperados; la captura antigua exige 32. **Quedan 3 IDs por identificar antes de considerar este laboratorio exacto.**
- Quién sostiene todo esto: 26 IDs recuperados.
- Con la ley en la mano: 23 IDs recuperados.
- Del suelo al bolsillo: 16 IDs recuperados.
- La caja de herramientas: 4 IDs recuperados.

## Ciencias Naturales

La captura histórica de Escuela 1 muestra los nombres de C1-C5:

- C1 — Señales de vida
- C2 — Manual de un cuerpo nuevo
- C3 — El árbol de las mil ramas
- C4 — Viaje de un bocado
- C5 — El mensaje cifrado

El documento de laboratorios y la semilla `data/school4-seed.json` completan la misma trayectoria:

1. C1 — Señales de vida — Obligatorio — referencia pedagógica 4 h
2. C2 — Manual de un cuerpo nuevo — Electivo — referencia pedagógica 4 h
3. C3 — El árbol de las mil ramas — Obligatorio — referencia pedagógica 4 h
4. C4 — Viaje de un bocado — Electivo — referencia pedagógica 4 h
5. C5 — El mensaje cifrado — Obligatorio — referencia pedagógica 7 h
6. C6 — El margen estrecho — Electivo — referencia pedagógica 7 h
7. C7 — Nada se pierde, algo se desperdicia — Obligatorio — referencia pedagógica 3 h
8. C8 — Ocho minutos de viaje — Electivo — referencia pedagógica 3 h
9. C9 — La receta de las cosas — Electivo — referencia pedagógica 4 h

También se documenta para C10 el seminario integrado **Lo que se puede y lo que se debe**, Química-Filosofía, 6 h de referencia. No se inserta dentro de Ciencias Naturales del snapshot porque no hay evidencia directa suficiente de que ya estuviera materializado así en la fila PCI-101 del 7/8.

Los IDs de los nueve laboratorios de Naturales quedaron preservados en `estado-reconstruido-schema7.json` con trazabilidad en `_recovery.groupEvidence`.

## Otros formatos

Existe una captura posterior de **Escuela de muestra 1** con `Otro formato pedagógico 1`, Seminario, Electivo, Cuatrimestral, ubicado en C7. Se preserva como evidencia histórica separada, pero no se incorpora al snapshot objetivo del 7/8 porque todavía no se pudo demostrar que perteneciera exactamente a la misma versión de `PCI-101`.

## Grados de certeza

- **Directo:** visible en captura identificada explícitamente como Escuela 1 / PCI-101.
- **Muy alto:** captura + catálogo de IDs + coincidencia exacta de cantidades con otra copia preservada.
- **Alto:** documento conceptual + seed histórica + copia posterior coincidente.
- **Pendiente:** dato que no puede probarse todavía sin backup/PITR o exportación local histórica.

## Estado de la recuperación

El archivo `estado-reconstruido-schema7.json` es una **copia forense de trabajo**, no una restauración productiva. No se debe importar automáticamente a Supabase hasta cerrar las diferencias marcadas en `_recovery`, principalmente los 3 contenidos faltantes de `Un país sin manual` y cualquier diferencia que aparezca al localizar un snapshot antiguo real.