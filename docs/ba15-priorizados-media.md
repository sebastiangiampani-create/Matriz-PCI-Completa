# Base de priorizados para BA +15

La base de contenidos FG de BA +15 se deriva del catálogo de Formación General de Media V2 (FG v103, 1126 contenidos). Es una proyección independiente: no modifica los archivos ni los años originales de Media.

## Equivalencia de niveles

| Año de origen en Media / NES | Nivel de destino BA +15 |
|---|---:|
| 1.º y 2.º | 1 |
| 3.º | 2 |
| 4.º | 3 |
| 5.º | 4 |

## Datos que se conservan

Cada registro mantiene el ID original, área, asignatura, eje, subeje y texto. Además conserva `sourceYear` y agrega `ba15Level`, `sourceCatalog` y `baseVersion`. El campo `year` de la proyección representa el nivel BA +15, no el año original de Media.

## Uso

- Fase 1 mantiene la estructura propia BA +15: cuatro niveles, C1-C8, asignaturas y cargas del régimen BA +15.
- Fase 2 consulta esta nueva base para los contenidos FG del nivel del espacio seleccionado.
- Formación Orientada continúa utilizando el catálogo FO por orientación de V2, que no tiene asignación de año NES.
- Los IDs de contenidos son estables; los planes históricos que ya referencian IDs no necesitan migración.
- La carga exige los 1126 contenidos y rechaza IDs duplicados, años fuera de 1.º a 5.º o catálogos incompletos.

## Fuente

Catálogo: `PCI Aprende V2 - FG v103` (`data/integracion-curricular/referencia-v2/fg-all-p*.txt`).

Versión de la proyección: `ba15-fg-media-reindexada/1`.

La equivalencia de años es una regla de organización de BA +15 definida para esta plataforma; no modifica la denominación histórica de los contenidos fuente.
