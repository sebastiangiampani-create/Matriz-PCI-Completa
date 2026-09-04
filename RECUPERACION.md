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

Ramas congeladas creadas para esta recuperación:

- `recuperacion/supabase-4-escuelas-20260808`
- `recuperacion/supabase-4-escuelas-20260821`

### 2. Etapa de dos escuelas muestra preservadas

Más adelante el portal multi-escuela mantuvo explícitamente Escuela 1 y Escuela 2 como escuelas muestra preservadas, mientras incorporaba el acceso general a escuelas reales.

Referencias:

- `964b5b58d2f68e1108d93cffdd525eaea4a1ec16` — Activar acceso operativo multi-escuela con roles y Supabase
- `7341d66b6ee4705c5ab8717a3261bd54d8bb037e` — Agregar PCI online con rol visible y guardado compartido
- `0d7d3fbdac45257b8fb02630016b791e20f9da9c` — Publicar portal multi-escuela como acceso principal

Rama congelada:

- `recuperacion/supabase-2-muestras-20260821`

## Estado encontrado actualmente en Supabase

No se modificaron filas de `pci_proposals` durante esta recuperación.

- `school_id=1`: actualmente figura como **Modelo Escuela DEA**. Fue actualizado el 2026-09-04 y su estado actual es pequeño/casi base.
- `school_id=2`: actualmente figura como **Modelo Escuela DEA**. Fue actualizado el 2026-09-04 y su estado actual es pequeño/casi base.
- `school_id=3`: actualmente figura como **Modelo Escuela DET** y conserva algunos cambios.
- `school_id=4`: actualmente figura como **Media 1** y conserva un estado mucho más completo.

Los registros actuales de auditoría disponibles no contienen snapshots anteriores de las filas 1 y 2. No se encontraron tablas específicas de backup/snapshot histórico que permitan reconstruir desde SQL los JSON antiguos.

## Nuevo hallazgo: repositorio original Matriz-PCI

Además de `Matriz-PCI-Completa`, el repositorio original `sebastiangiampani-create/Matriz-PCI` conserva la rama **`estable-congelada-2026-08-04`**, en el commit:

- `9e9b98d3d9b9a0a9ee0cde4cff78016860972b78` — `Forzar carga limpia de la aplicacion estable al ingresar a una escuela`

Esta rama es una fuente independiente y anterior a buena parte de los cambios posteriores de `Matriz-PCI-Completa`.

El historial del repositorio original confirma la secuencia:

- `26df0b6925ae0c0e03822423a8f43924b6723b04` — **Conectar propuestas PCI con Supabase y códigos de edición** — 03/08/2026.
- `3a7c8c9331c7f733209fd12637d3ad9399a3f8e3` — **Agregar modelo de laboratorios para Escuela 4**.
- `3350dc4dd41a42a4f78ad55762a3899c05987633` — **Crear acceso de prueba a Escuela 4 con laboratorios cargados**.
- `386f957b79e114fc9eed8fd7676ef33237877d1c` — **Sincronizar Escuela 4 con Supabase**.
- `cdc192f772e0a8b2f99c05117625e6f0598990d3` — **Integrar otros formatos curriculares y cobertura total en todas las escuelas**.
- `6678fe9ecbb974d7206622becd189a4b3470b6d8` — **Activar mejoras globales en todas las escuelas**.
- `15aaca90eada9a9d6cb05de25ff1815a1d9106d3` — **Desactivar mejoras experimentales para restablecer la carga de escuelas**.
- `9e9b98d3d9b9a0a9ee0cde4cff78016860972b78` — congelado estable del 04/08.

El diff del commit `26df0b...` demuestra que antes los estados por escuela se guardaban sólo en localStorage y que ese commit cambió la aplicación para leer y escribir `pci_proposals` en Supabase, solicitando el código de edición y haciendo `PATCH` del JSON completo de cada escuela. Por lo tanto, desde el 03/08 las Escuelas 1, 2 y 3 también tenían persistencia online independiente.

## Nuevo hallazgo: pruebas visuales de Escuela 1 y Escuela 2

Se localizaron capturas históricas en la Biblioteca de trabajo:

### Escuela 1 / PCI-101

Una captura de **Mapa Curricular Institucional · Escuela 1 · PCI-101** muestra Ciencias Sociales ya trabajadas con nombres reales; son visibles directamente:

- **La invención de quedarse**
- **La lista de los que cuentan**
- **Dos mapas sobre el mismo suelo**

Otras capturas de la misma etapa muestran la matriz de Escuela de muestra 1 y la fila de Ciencias Sociales con sus laboratorios dentro de C1/C2, confirmando que esa escuela no era una plantilla vacía.

### Escuela 2 / PCI-102

Se localizaron capturas de **Matriz PCI · Escuela de muestra 2** con guardado automático y matriz C1-C10. También se encontró la pantalla posterior **Escuelas muestra preservadas**, donde la interfaz indicaba explícitamente que Escuela 1 y Escuela 2 mantenían sus datos. Esto confirma la intención de preservar ambos estados al pasar al portal multi-escuela.

Todavía no apareció una exportación JSON antigua de PCI-102 con todo su contenido de Ciencias Sociales.

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
- `school_id=1105` — Esc. Técnica Nº 26 DE 06 Confederación Suiza: 8 agrupamientos de Ciencias Sociales detectados.
- `school_id=3` — Modelo Escuela DET: sobreviven algunos cambios, incluido `Otra vez Ricky`.

## Archivos `data/db*.txt` y `data/rest*.txt`

Se verificó su origen: fueron copiados automáticamente desde el repositorio original `Matriz-PCI` mediante el workflow `importar-base.yml`. Son partes de la base curricular comprimida que utiliza la aplicación, no snapshots evidentes de las filas `pci_proposals`. Se mantienen como fuente para traducir IDs de contenidos y reconstruir la cobertura, pero no se consideran por sí solos una copia de Escuela 1 o Escuela 2.

## Regla de recuperación

1. No modificar `main`.
2. No sobrescribir `pci_proposals` durante la recuperación.
3. Preservar primero código, estados, capturas, documentos y semillas en ramas separadas.
4. Comparar las distintas fuentes antes de decidir cuál era Escuela 1 o Escuela 2 en cada momento histórico.
5. Restaurar sólo después de contar con una copia verificable de los datos recuperados.
