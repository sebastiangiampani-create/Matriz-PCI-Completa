# Integracion curricular - Matriz PCI Completa + Secundaria Aprende V2

> **Estado: prototipo aislado. NO desplegar en produccion.** El repositorio fuente pci-sec-aprendeV2 es de solo lectura. No se alteran main, Supabase, las claves de acceso ni los registros institucionales.

## Objetivo y alcance

Plataforma receptora: Matriz PCI Completa. Modulos de referencia (solo lectura): Mapa de la Oferta, orientaciones, articulaciones FG-FO y Desarrollo Curricular de PCI Secundaria Aprende V2. No se incorporan asistencia, horarios ni calificaciones.

Lo que actualmente guarda Matriz PCI Completa representa la **Formacion General (FG) institucional inicial**. Cuando una escuela elige varias orientaciones, se crea una **copia independiente de esa misma FG para cada orientacion**. Ninguna orientacion recibe automaticamente los cambios de las demas.

La secuencia de cada plan esta guardada dentro de areas[area].groups[].plansBimestrales[].stages, con las etapas punto_partida, indagacion, produccion y evaluacion. Se copian literalmente los agrupamientos completos, identificadores, ubicaciones C1-C10, contenidos, objetivos, sinopsis, planes y etapas, sin regenerar planes.

## Comportamiento acordado

1. La escuela mantiene un unico registro institucional y su FG original; **el origen no se sobrescribe**.
2. Al seleccionar Economia, Sociales y Naturales, cada orientacion obtiene su propia FG completa; las secuencias quedan en las tres copias.
3. Si existe FG previa, mostrar: **"Tu Formacion General ya esta construida. Podes conservar los agrupamientos existentes o revisarlos para esta orientacion."**
4. **Conservar FG** es la opcion predeterminada y mantiene la copia exactamente como se realizo.
5. **Revisar y adaptar** habilita la etapa de proponer decisiones por orientacion, pero nunca modifica automaticamente otras orientaciones ni planes.
6. Si se propone articular una materia FG con FO y ya estaba incluida en un laboratorio, se abre el diagnostico: **"Revisar laboratorio"**, con contenidos y planes potencialmente afectados.
7. La articulacion debe quedar **pendiente y bloqueada** hasta completar:
   - homologacion de materia y contenido FG con el catalogo de Aprende V2;
   - validacion de limites de horas y conformacion minima FG/FO;
   - decision explicita de la escuela sobre laboratorios, contenidos y secuencias afectadas.
8. El aviso permanece pendiente; cerrar un dialogo no significa validar ni resolver el impacto curricular.
9. Volver a seleccionar una orientacion **no reinicializa** su FG, secuencias ni decisiones.
10. Si cambio la FG institucional luego de la copia inicial, exigir **conciliacion explicita**, sin resincronizacion destructiva.

## Que NO realiza todavia el prototipo

- No sustituye la interfaz institucional ni el editor de planes existente.
- No integra el mapa V2 completo ni sus bases FO en el sistema receptor.
- No confirma articulaciones ni mueve materias automaticamente.
- No realiza persistencia multiusuario; el adaptador opera **en memoria**.
- No modifica Supabase ni archivos de pci-sec-aprendeV2.
- No migra Matriz Tecnica: su esquema requiere un adaptador especifico.

## Puntos de implementacion real

**Persistencia:** preparar una tabla separada de pci_proposals, con clave compuesta (school_id, orientation_id), version de esquema, vinculo con la FG original y datos por orientacion. Solo es una propuesta, no una migracion aplicada. Autorizar cada lectura/escritura por escuela y permisos existentes. Nunca exponer secuencias por la API publica de catalogo.

**Respaldo:** antes de migrar, generar y verificar backup con controles de integridad; comparar por escuela cantidad de areas, agrupamientos, planes, IDs de contenidos y las cuatro etapas de cada plan. Comparar tambien los datos completos: la cantidad de registros no garantiza igualdad.

**Cobertura:** distinguir progreso administrativo (espacios editados/espacios totales) de cobertura curricular (contenidos prescriptos usados/universo de nivel). Recalcular luego de decisiones validadas.

**Roles:** reutilizar claves institucionales y backend de Matriz PCI Completa; la copia FG no concede nuevos permisos. No trasladar el login local de Aprende V2.

**Catalogos:** 16 orientaciones activas en app-core de V2. El catalogo FO agrupa bajo Arte las tres variantes Arte - Artes Visuales, Arte - Musica y Arte - Teatro; hay que homologarlas al desarrollar FO.

**Caso de prueba prioritario:** Economia de 3.o articulada con FO cuando un laboratorio FG de Ciencias Sociales ya incluye Economia y un plan con cuatro etapas elaboradas. La vista previa indica laboratorio, detiene traslado y conserva todas las etapas.

## Artefactos en esta rama

- src/integracion-curricular/bridge.js: copia FG, opcion Conservar/Revisar, inspeccion de conservacion, registro preliminar FO y vista previa de impacto.
- tests/integracion-orientaciones.test.js: pruebas automatizadas con datos ficticios, sin consultar Supabase.
- demo-integracion-curricular.html: simulador local sin escuelas reales.
- .github/workflows/validar-integracion-curricular.yml: CI que ejecuta las pruebas aisladas.

**Criterio de publicacion:** no modificar main ni Supabase hasta completar homologacion, validacion normativa, persistencia segura y pruebas con respaldos verificados.


## Avance de la rama de prueba - integracion curricular, 9 de octubre de 2026

**Aislamiento confirmado:** todos los archivos se agregaron exclusivamente a la rama feature/integracion-orientaciones-fg-secuencias-20261009 de Matriz PCI Completa. El codigo original de PCI Aprende V2 sigue como referencia de solo lectura. Nada fue fusionado con main ni desplegado a GitHub Pages o Supabase.

### Referencias de PCI Aprende V2 incorporadas SIN editar su origen

- data/integracion-curricular/referencia-v2/reglas-v2.json: composicion de FG y FO, articulacion y excepciones.
- data/integracion-curricular/referencia-v2/horas-v2.json: carga horaria de las materias para validaciones.
- data/integracion-curricular/referencia-v2/materias-v2.json: materias FG/FO por nivel y alternativa.
- data/integracion-curricular/referencia-v2/catalogo-orientaciones.json: orientaciones y variantes.
- fg-all-p1..p9.txt + manifest-fg-v103.json: **1126 contenidos FG oficiales por nivel** de V2.
- fo_all.txt + fo_part02..fo_part11.txt + manifest.json: **860 contenidos FO de trayectoria** de V2. Esta base carece de año explícito.

La bolsa de contenidos FG existente permanece en data/db1..db4.txt y data/rest1..rest5.txt de Matriz PCI Completa. **No se reemplaza ni se reescribe.**

### Resultados reales del diagnostico de homologacion, por materia y texto

- Matriz PCI Completa: **1155 contenidos FG**.
- FG V2 v103: **1126 contenidos**.
- Coincidencia exacta única de materia/texto (sin asignar año): **624**.
- Coincidencia textual con múltiples registros posibles: **132**.
- Sin coincidencia exacta: **399**.

Estas cifras son diagnosticas globales: la homologacion curricular valida exige adicionalmente **nivel y area**. No deben utilizarse como porcentajes de cobertura de una escuela.

### Modulos nuevos: todos aislados, sin backend ni escrituras

- src/integracion-curricular/bridge.js: copiar FG por orientacion, conservar/revisar, enlaces a originales, avisos de impacto.
- src/integracion-curricular/catalogos.js: leer Matriz/FG V2/FO V2, cruces seguros y cobertura.
- src/integracion-curricular/mapa-oferta.js: estructura FO (4 laboratorios, 4 talleres, proyecto), banco de materias por nivel, asignacion, replica anual en pares compatibles, movimiento dentro del nivel y validacion.
- src/integracion-curricular/reglas-composicion-fg.js: validacion FG de tipos, C1-C10, 10/12 Sociales, conformacion, cargas horarias y estado de homologacion.
- src/integracion-curricular/seguimiento.js: indicadores de materia/nivel, area/nivel, formato, agrupamiento, planes y FO de trayectoria. Desduplicacion de contenidos por universo.
- src/integracion-curricular/homologaciones.js: propuestas y aprobaciones de equivalencias independientes por orientacion, justificadas, con historial, conservando IDs de origen.
- scripts/diagnostico-homologacion-curricular.mjs: diagnostico agregado no destructivo.

### Simuladores y pruebas

- demo-integracion-curricular.html: copiar FG y conservar/revisar.
- **demo-mapa-oferta-curricular.html**: referencia interactiva C1-C10. Usa la bolsa original Matriz para FG, bolsa oficial de materias y contenidos FO de V2, arrastre con alternativa tactil, control de periodos, indicadores y homologacion de prueba. No usa datos reales, claves ni Supabase.
- tests/integracion-*.test.js: pruebas automatizadas de preservacion, copia, reglas, homologacion, conteo, movimientos y seguridad del simulador.
- .github/workflows/validar-integracion-curricular.yml: CI especifica y diagnostico.

### Guardas de datos

1. Cada orientacion recibe una copia profunda del estado FG, incluidos planes, objetivos, sinopsis y sus cuatro etapas.
2. Arrastrar contenido FG sin equivalencia por nivel **lo deja provisional**. Solo se incorpora a la FG copiada cuando una coincidencia univoca o aprobacion curricular valida confirma su nivel.
3. Arrastrar contenido FO antes de validar la oferta **lo deja provisional**. La promocion a contenido activo exige composicion validada.
4. Una articulacion FG-FO nunca se confirma automaticamente; se crea "Revisar laboratorio", con contenido/planes previos.
5. Los conteos de area/nivel y de trayectoria se hacen por union de identificadores, sin duplicaciones. Los denominadores de agrupamiento sin composicion confirmada no se presentan como porcentajes verificados.
6. Los cambios de una orientacion no afectan la FG original ni a las otras orientaciones.
7. Un cambio posterior de la FG matriz original bloquea la resincronizacion silenciosa.
8. Las validaciones de composicion no reescriben los espacios, los planes ni las secuencias.

### Pendientes antes de cualquier publicacion

- Completar y validar la homologacion estructural de materias FG por año: los contenidos existentes no identifican por sí solos la conformacion original del laboratorio.
- Validar integralmente todas las excepciones de articulacion FG-FO de la NES en estados finales, incluida Sociales 3.º con materias articuladas.
- Construir la persistencia segura y independiente por escuela+orientacion, con autorizacion de sesion en servidor y RLS adecuadas. No crear tablas de produccion en este PR.
- Preparar backups completos verificables de los 237 registros escolares y demos, y probar migracion y recuperacion en un entorno no productivo con comparacion íntegra de datos, no solo contadores.
- Ensayar con navegadores de escritorio y celular la interaccion real de arrastre, modo tactil y pantallas de planes.
- No fusionar ni publicar hasta obtener estas validaciones. La Matriz Tecnica requiere un tratamiento curricular separado.

**La autenticacion, autorizacion y validacion de revisor del simulador NO son controles de produccion:** cualquier aprobacion local es una demostracion; el backend definitivo debe derivar identidad/permisos desde la sesion institucional y registrar auditoria del servidor.
