# Matriz PCI · Escuela Muestra

Reconstrucción de la matriz institucional a partir de la Escuela 4 funcional del repositorio histórico `Matriz-PCI`.

## Alcance actual: Fase 4

- cuatro espacios de escuela en la portada; tres quedan reservados y **Escuela Muestra** está habilitada;
- cinco niveles anuales por área troncal, siempre C1–C2, C3–C4, C5–C6, C7–C8 y C9–C10;
- 10 laboratorios de Ciencias Naturales, uno por cuatrimestre;
- 12 laboratorios de Ciencias Sociales, con dos simultáneos en C6 y dos en C7;
- talleres editables y ubicables en C1–C10;
- otros formatos pedagógicos con contenidos de Tecnologías: Seminario, Proyecto o Ateneo; duración cuatrimestral o anual;
- selección individual y múltiple, arrastre y reasignación de contenidos sin duplicarlos;
- alternativa táctil para celulares mediante selección y botón **Mover**;
- tabla de control completa, filtros de pendientes, impresión/PDF y descarga CSV compatible con Excel;
- matriz completa C1–C10 con arrastre temporal, alternativa táctil y acceso directo a la edición de cada espacio;
- guardado local inmediato y sincronización online de Escuela Muestra en la fila histórica `school_id=4`.

## Campos de cada espacio

- **Troncales:** nombre del nivel, objetivos de aprendizaje, contenidos y sinopsis opcional.
- **Laboratorios:** nombre, carácter obligatorio/electivo, contexto problematizador, objetivos, contenidos, C1–C10 y sinopsis opcional.
- **Talleres:** nombre, carácter obligatorio/electivo, práctica/producto/eje, objetivos, contenidos, C1–C10 y sinopsis opcional.
- **Otros formatos:** nombre, Seminario/Proyecto/Ateneo, carácter obligatorio/electivo, duración, momento de implementación, objetivos, contenidos y sinopsis.

Los formatos anuales solo pueden ocupar los dos cuatrimestres completos de un mismo nivel; no se admite, por ejemplo, C6–C7.

## Desarrollo

```bash
npm test
python3 -m http.server 8000
```

Abrir `http://localhost:8000/plataforma.html`.

## Regla de avance

Este código no implementa carga horaria ni ningún criterio de Fase 5. La siguiente fase queda bloqueada hasta aprobar todos los casos de aceptación documentados en [`docs/fase-4-aceptacion.md`](docs/fase-4-aceptacion.md).
