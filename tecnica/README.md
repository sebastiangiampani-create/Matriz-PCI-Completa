# PCI Técnica

Aplicación curricular separada de la Matriz PCI Común. Comparte la experiencia visual y las funciones generales de la Matriz, pero mantiene un modelo curricular Técnico independiente.

## Estructura confirmada
- 6 niveles.
- 12 períodos: C1-C12.
- Lengua y Literatura: 6 niveles anuales.
- Matemática: 6 niveles anuales.
- Lenguas Adicionales: 6 niveles anuales.
- Ciencias Naturales: 6 Espacios de Integración, inicialmente C1-C6 y movibles dentro de C1-C8.
- Ciencias Sociales: 8 Espacios de Integración, inicialmente C1-C8 y movibles dentro de C1-C8.
- Educación Física: 12 Espacios Formativos, inicialmente uno por período C1-C12.
- Educación Artística: 2 Espacios Formativos exclusivamente en Nivel 1 (C1-C2).
- Tecnología de la Representación: 6 Espacios Formativos; la distribución inicial queda pendiente de definición.
- Talleres: 2 talleres anuales fijos, uno en Nivel 1 (C1-C2) y otro en Nivel 2 (C3-C4).

## Funciones implementadas
- Misma base estética y navegación que la Matriz PCI Común.
- Edición de nombres, objetivos y sinopsis.
- Contexto problematizador para Espacios de Integración.
- Práctica / producto / eje para Espacios Formativos y Talleres.
- Carácter Obligatorio / Electivo en los espacios configurables.
- Reglas temporales propias por tipo de espacio.
- Bolsa curricular con búsqueda y filtros.
- Selección múltiple de contenidos.
- Drag & drop de contenidos hacia los espacios.
- Posibilidad de utilizar un mismo contenido en más de un espacio.
- Remoción de un contenido de un espacio sin eliminarlo de la base.
- Drag & drop de espacios en la Matriz completa, respetando sus límites temporales.
- Selector alternativo para mover espacios por período.
- Tabla de control con filtros y estados.
- Exportación CSV para Excel.
- Impresión / PDF de tabla de control y Matriz completa.
- Modal de detalle desde la Matriz con datos y contenidos del espacio.
- Planes bimestrales por espacio, con contenidos, objetivos y etapas de trabajo.
- Navegación responsive y bolsa curricular tipo drawer en dispositivos móviles.
- Persistencia local aislada con la clave `pciTecnicaV2` y migración del prototipo `pciTecnicaV1`.

## Pendientes deliberados
- Incorporar la base oficial de contenidos priorizados Técnica en `data/contents.json`.
- Confirmar la regla de distribución temporal de Tecnología de la Representación.
- Incorporar futuras reglas específicas de cobertura curricular Técnica cuando se definan.
- Integrar el acceso de escuelas técnicas y el guardado remoto. Esto no se realiza en esta rama para no modificar la plataforma Común ni su backend.
