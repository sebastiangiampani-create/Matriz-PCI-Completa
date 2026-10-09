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
