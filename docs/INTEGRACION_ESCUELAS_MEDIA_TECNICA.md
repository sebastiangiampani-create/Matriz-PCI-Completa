# Escuelas con PCI de Media y Técnica - Integración aditiva

ESTADO: Código preparado para registrar simultáneamente proyectos de
Media y Técnica en una escuela. El editor de especialidades técnicas
permanece BLOQUEADO hasta recibir las nuevas reglas de composición.
No reemplaza el editor técnico histórico ni aplica reglas de Media.

## Modelo
- Una escuela sigue teniendo un solo registro en public.pci_proposals,
  con school_id, data original completo y claves edit_code/primary_code.
- Cada nuevo PCI se registra en pci_workspace.pcis con su propio pci_id,
  process_id, modelo (comun o tecnica), orientación/especialidad y turno.
- Un snapshot SHA-256 del JSON original conserva los contenidos anteriores
  con procedencia; no se convierte ni actualiza el documento histórico.
- legacy_source_model conserva el tipo de documento histórico, aunque un
  colegio técnico incorpore por primera vez un PCI nuevo de Media.
- Media: status ready, programa FG V2 y FO V2, importación homologada
  de contenidos antiguos solo si el documento fuente era de Media.
  Si el original era Técnico, inicia Media en plantilla independiente.
- Técnica: status pending_rules, registra nombre de especialidad y turno.
  Su orientación de almacenamiento tiene prefijo tecnico, que no equivale
  a ningún código oficial. El servidor rechaza lectura/guardado de unidades
  curriculares Técnicas con HTTP 423 hasta que estén las reglas oficiales.
- Turnos: mañana, tarde, vespertino y noche.
- La misma escuela puede tener más de un PCI de la misma rama y turno.

## Escuela con ambos modelos a la vez
No crear una segunda escuela por tener Educación Técnica y Bachillerato.
La entidad institucional es única (`school_id`, CUE/código y credenciales
actuales) y los modelos son **características de cada PCI**.

Ejemplo: una misma institución puede tener, simultáneamente,
- Media / Economía y Administración / turno mañana / mapa C1-C10;
- Media / Ciencias Naturales / turno tarde / mapa C1-C10;
- Técnica / Computación / turno tarde / mapa C1-C12;
- Técnica / Electromecánica / turno noche / mapa C1-C12.

Cada PCI tiene `pci_id`, `model`, `orientation_id` o `specialty_name`,
`shift_id` y `process_id` independientes.

**Escuelas ya existentes:** la base tiene una fila por colegio. No se crean
filas duplicadas ni se solicita otra clave al incorporar Media o Técnica.
`data.profile` expresa solamente el formato del documento histórico
existente; no permite determinar todas las modalidades que la institución
ofrece. Los modelos se configuran por PCI nuevo, mediante `model`, en la
misma escuela (`school_id`) y sin actualizar `public.pci_proposals`.
No modificar automáticamente ni reasignar las áreas históricas de ese
registro; cualquier homologación nueva debe verificarse en una copia
independiente.

En el esquema
aditivo actual el PCI original se captura sin reemplazarlo; esto por sí
solo **no demuestra** que ya se recuperaron todas las fuentes históricas
de una institución con modelos mixtos.

En la interfaz del PR #34, los PCI se muestran agrupados por modelo
y comparten la misma selección y sesión escolar. La demo independiente
permite marcar Media, Técnica o ambas, y conserva los PCI al cambiar
la selección.

## Acceso y estética
- Se conservan los usuarios, contraseñas, tokens, permisos y claves
  institucionales actuales. No cambiar las rutas actuales de pci-access.
- La pantalla nueva utiliza el logo original de Escuela de Maestros,
  cabecera blanca, azul institucional y tipografía Archivo.
- El editor y panel previos de todas las escuelas siguen disponibles.
- El alta de colegio es exclusiva del administrador del panel general.

## Contenidos y seguridad
- Crear un PCI captura un snapshot de los datos originales y su hash.
- Editar un PCI usa escuela + modelo + orientación + proceso independiente;
  nunca altera el JSON original de public.pci_proposals.
- El control 409 impide sobrescrituras concurrentes de unidades.
- La especialidad técnica no abre el mapa C1-C10 ni las reglas de Media.
- No se efectuó ninguna migración a Supabase productivo.
- Una copia interna NO equivale a backup externo con prueba de restauración.

## Reglas de especialidades pendientes de recibir
Se necesitan las siguientes definiciones por orientación/especialidad:
- Catálogo y códigos oficiales de las especialidades.
- Campo de Formación General, Científico-Tecnológico, Técnico-Específico
  y Prácticas Profesionalizantes, con materias por nivel.
- Cantidad de niveles y períodos, espacios anuales/cuatrimestrales.
- Composición de laboratorios, talleres y otros agrupamientos.
- Articulaciones permitidas, mínimos, máximos y excepciones.
- Cargas horarias por asignatura y límites de combinación.
- Homologación de contenidos técnicos anteriores y cobertura curricular.
- Planes, criterios de validación y reglas específicas por especialidad.

La Matriz Técnica previa usa 6 niveles y C1-C12 como referencia histórica,
no como reglas nuevas automáticamente aprobadas.

## Pruebas
- tests/multipci/contrato-postgres.sql: escuela híbrida, distintos turnos,
  dos raíces históricas protegidas, sin UPDATE del legado.
- tests/multipci/api.test.mjs: acceso limitado por escuela y modelo;
  técnica bloqueada y media guardada independientemente.
- tests/orientaciones-release.test.mjs: no mezcla de contenidos Técnicos
  en FG Media, preservación de planes y etapas de secuencias.
- .github/workflows/validar-media-tecnica.yml: PostgreSQL 17 de CI con
  escuelas inventadas; nunca Supabase real.

## Para mirar
Vista de prueba en la rama preview/orientaciones-online-demo-20261111,
archivo preview-v2-real/institucion.html. Conserva el mapa original de
Media, agrega ficha de especialidades técnicas por escuela y turno.
