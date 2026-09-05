# Escuela 2 · PCI-102 — recuperación forense

> Rama de recuperación. Este material **no modifica `main`** y no escribe sobre `pci_proposals`.

## Momento objetivo

Una captura histórica de la tabla `pci_proposals` conserva para la antigua Escuela 2 / PCI-102 el siguiente momento exacto:

`2026-08-04 17:08:48.523+00`

Ese timestamp es el punto de restauración que debe usarse si aparece un backup/PITR externo de Supabase.

## Lo que está probado

1. Escuela 2 existía como una propuesta independiente de Escuela 1, Escuela 3 y Escuela 4. La interfaz histórica mostraba cuatro tarjetas separadas: PCI-101, PCI-102, PCI-103 y PCI-104, y aclaraba que cada escuela conservaba su propia matriz y sus propios agrupamientos.
2. El código histórico ya persistía el JSON completo de cada propuesta en Supabase (`pci_proposals`) y no sólo en el navegador.
3. En etapas posteriores, el portal marcó de forma explícita a Escuela 1 y Escuela 2 como **escuelas muestra preservadas / datos preservados**.
4. Existen capturas posteriores tituladas **Matriz PCI · Escuela de muestra 2** con estado de conexión y guardado automático, matriz C1-C10 y agrupamientos visibles.
5. También existe una captura de **Matriz curricular · Escuela 2** con la Bolsa curricular y el editor de Nivel 1.
6. Otra captura muestra a Escuela 2 bajo una etapa de **Construcción del PCI Técnico**, con las áreas Lengua y Literatura, Matemática, Lenguas Adicionales, Ciencias Sociales, Ciencias Naturales, Educación Artística, Tecnología de la Representación, Educación Física y Talleres.

## Estado actual de Supabase

La fila `school_id=2` ya no contiene el estado histórico independiente. En la captura forense del 5/9/2026:

- figura como `Modelo Escuela DEA`;
- fue actualizada el `2026-09-04 19:30:45.248+00`;
- su `data` tiene exactamente el mismo hash que la fila actual de `school_id=1`.

Esto confirma que el JSON viejo de Escuela 2 fue sobrescrito en la fila actual y no debe confundirse con la versión histórica buscada.

## Evidencia de estado posterior

Las capturas posteriores permiten recuperar estructura visual y existencia de la escuela, pero **no permiten afirmar que sean el snapshot exacto del 04/08**.

### Escuela de muestra 2

- guardado automático conectado;
- trayectoria C1-C10;
- Nivel 1 de Lengua y Literatura visible como obligatorio C1-C2;
- en la captura disponible, ese Nivel 1 aparece con `0 contenidos asignados`;
- se ve el mecanismo para mover laboratorios entre cuatrimestres.

### Editor de Escuela 2

Otra captura muestra:

- Bolsa curricular;
- Nivel 1;
- objetivos de aprendizaje;
- sinopsis opcional;
- contenidos asignados;
- otros contenidos;
- acción `Agregar contenido`.

En ese recorte los paneles aparecen vacíos. Se conserva como evidencia de la aplicación y no como prueba de que el snapshot histórico de agosto estuviera vacío.

## Qué no se inventa

Hasta ahora no apareció una exportación JSON, captura suficientemente completa o registro histórico SQL que permita reconstruir con certeza:

- nombres propios de los laboratorios antiguos de Escuela 2;
- contenidos asignados por agrupamiento;
- objetivos y contextos problematizadores;
- distribución exacta C1-C10 del snapshot del `2026-08-04 17:08:48.523+00`.

Por lo tanto, no se copiará Escuela 1, Escuela 4 ni otra escuela sobre Escuela 2 sólo para completar huecos.

## Próxima fuente de máxima prioridad

Una restauración exacta requiere alguno de estos artefactos:

1. backup/PITR externo de Supabase alrededor de `2026-08-04 17:08:48.523+00`;
2. exportación JSON descargada desde la aplicación;
3. copia del `localStorage` histórico de un navegador que hubiera abierto Escuela 2 (`pciSchoolStateV1:PCI-102` o la clave equivalente de la etapa anterior);
4. captura completa del mapa/editor de PCI-102 tomada antes de la sobrescritura.

Mientras esas fuentes no aparezcan, este directorio funciona como resguardo de toda la evidencia verificable sin contaminarla con reconstrucciones no demostradas.
