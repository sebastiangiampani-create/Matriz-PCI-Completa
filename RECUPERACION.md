# Recuperación histórica PCI — 2026-09-04

Esta rama existe exclusivamente para recuperación y resguardo. **No reemplaza ni modifica `main`**.

## Etapas históricas identificadas

### 1. Cuatro escuelas con persistencia en Supabase

La aplicación `escuela.html` trabajaba con `school_id` 1 a 4 y leía/escribía directamente `pci_proposals` en Supabase. Cada escuela tenía su propia fila y guardado online automático.

Referencias de GitHub preservadas:

- `42c927ed533974e1b8eae5768b574a50b6e06e11` — Agregar cuatro PCI institucionales
- `ae6cc0cebbfe2604ca5d254b72d5552c7dc9a528` — Habilitar acceso genérico a las cuatro escuelas
- `ddf8e31f4e63b3f690ee99990af3d2ac4bb41f99` — Habilitar las cuatro escuelas en la plataforma
- `7e777662a9e8fd3bdfb79ff544e61de61b270000` — acceso de cuatro escuelas con guardado online

Rama congelada creada para esta recuperación:

- `recuperacion/supabase-4-escuelas-20260821`

### 2. Etapa de dos escuelas muestra preservadas

Más adelante el portal multi-escuela mantuvo explícitamente Escuela 1 y Escuela 2 como escuelas muestra preservadas, mientras incorporaba el acceso general a escuelas reales.

Referencias:

- `964b5b58d2f68e1108d93cffdd525eaea4a1ec16` — Activar acceso operativo multi-escuela con roles y Supabase
- `7341d66b6ee4705c5ab8717a3261bd54d8bb037e` — Agregar PCI online con rol visible y guardado compartido
- `0d7d3fbdac45257b8fb02630016b791e20f9da9c` — Publicar portal multi-escuela como acceso principal

Rama congelada creada para esta recuperación:

- `recuperacion/supabase-2-muestras-20260821`

## Estado encontrado actualmente en Supabase

No se modificaron filas de `pci_proposals` durante esta recuperación.

- `school_id=1`: actualmente figura como **Modelo Escuela DEA**. Fue actualizado el 2026-09-04 y su estado actual es pequeño/casi base.
- `school_id=2`: actualmente figura como **Modelo Escuela DEA**. Fue actualizado el 2026-09-04 y su estado actual es pequeño/casi base.
- `school_id=3`: actualmente figura como **Modelo Escuela DET** y conserva algunos cambios.
- `school_id=4`: actualmente figura como **Media 1** y conserva un estado mucho más completo.

Los registros actuales de auditoría disponibles no contienen snapshots anteriores de las filas 1 y 2. Por ese motivo, sus versiones exactas previas deben buscarse mediante respaldos/PITR de Supabase o en otras copias históricas; no se deben sobrescribir las filas actuales durante la investigación.

## Ciencias Sociales recuperadas

### School 4 — Media 1

Se encontraron 12 laboratorios de Ciencias Sociales, con 9 laboratorios claramente trabajados. Entre los nombres conservados están:

- La lista de los que cuentan
- La invención de quedarse
- Dos mapas sobre el mismo suelo
- Cadenas para el rey
- Con la ley en la mano
- Un país sin manual
- Quién sostiene todo esto
- Del suelo al bolsillo
- La caja de herramientas

Además del nombre, el estado conserva en varios casos contexto problematizador, contenidos asignados por ID, contenidos fuente, ubicación temporal y carácter obligatorio/electivo.

La semilla histórica `data/school4-seed.json` también conserva la propuesta conceptual de Ciencias Sociales y Ciencias Naturales, por lo que funciona como segunda fuente independiente de recuperación.

### Otras escuelas con trabajo relevante detectado

- `school_id=1010` — Instituto Don Orione: 8 laboratorios de Ciencias Sociales claramente trabajados.
- `school_id=1105` — Esc. Técnica Nº 26 DE 06 Confederación Suiza: 8 agrupamientos de Ciencias Sociales con trabajo detectado.
- `school_id=3` — Modelo Escuela DET: algunos cambios en Ciencias Sociales.

Estos estados deben considerarse fuentes de rescate y compararse antes de descartar información.

## Regla de recuperación

1. No modificar `main`.
2. No sobrescribir `pci_proposals` durante la recuperación.
3. Preservar primero código, estados y semillas en ramas separadas.
4. Comparar las distintas fuentes antes de decidir cuál era Escuela 1 o Escuela 2 en cada momento histórico.
5. Restaurar sólo después de contar con una copia verificable de los datos recuperados.
