# Entrega al programador: PCI por orientación (11/11/2026)

**PR:** https://github.com/sebastiangiampani-create/Matriz-PCI-Completa/pull/34
**Rama:** release/pci-orientaciones-aditivo-20261111
**Producción:** EN USO. No desplegar sin la verificación de los bloqueos indicados.

## 1. Resultado de esta entrega

Esta rama es ADITIVA: los archivos ya existentes en el sitio actual fueron
restaurados desde main; la pantalla antigua y su guardado permanecen iguales.
Los cambios en su mayoría consisten en NUEVOS archivos y pruebas.

- pci-orientaciones.html: portal nuevo (no enlazado aún desde el panel existente).
- pci-orientaciones.css: estilos nuevos.
- src/orientaciones-online.mjs: conexión autenticada al backend y editor nuevo.
- src/orientaciones-release-core.mjs: identidad y procedencia de cada documento.
- src/integracion-curricular/: referencia curricular V2 y homologación.
- data/integracion-curricular/referencia-v2/: base FG v103 y FO v96.
- src/multipci/pci-workspace-handlers.mjs: extensión de la API actual.
- migration/concurrencia/003_supabase_scoped_units.sql: unidades FG/FO, revisión e historial.
- migration/multipci/001_additive_school_pcis.sql: entidades escuelas/PCI y snapshots.
- tests/orientaciones-release.test.mjs, tests/orientaciones-release-browser.mjs,
  tests/multipci/*, tests/concurrencia/*: pruebas sin escuelas reales.

La matriz original public.pci_proposals.data NO se actualiza ni se reestructura.
La nueva infraestructura usa INSERT para escuelas nuevas y datos en esquemas
privados. Las copias de FG por orientación tienen su propio identificador PCI,
process_id, revisión, escuela y SHA de procedencia.

## 2. Qué NO debe hacerse

- No fusionar el antiguo PR #28 o PR #33 directamente en main.
  Cambiaban archivos productivos y el PR #28 trae guardado escolar bloqueado.
- No ejecutar scripts de migración sobre producción antes de los respaldos
  externos, ensayos aislados y una prueba restaurable.
- No desplegar una nueva versión de pci-access que reemplace, omita o invalide
  las rutas y la protección existente de get-state/save-state.
- No publicar el enlace a orientaciones para toda la comunidad sin probar los
  controles de sesiones, borradores y concurrencia.
- Nunca usar la copia interna de Supabase como único respaldo.

## 3. Estado de Supabase que debe resguardarse

Proyecto: Matriz-PCI (ref agmebsotbuurbnldxewf).
Última inspección: 238 registros en public.pci_proposals (234 instituciones reales
y 4 de prueba), tras el alta de A-414M (school_id 1234).
Snapshot interno anterior: pci_snapshot_20261111 con 237 registros, previo al
alta A-414M. Los registros históricos previos siguen en pci_emergency_backup.

**Antes de tocar la base:** generar fuera de Supabase un respaldo transaccional
incluyendo public, pci_online_guard, pci_emergency_backup y auditorías,
configuración, vistas, migraciones y funciones relevantes. Usar credenciales
privadas desde el ambiente del programador (nunca en GitHub ni en este chat).
Obtener SHA-256 del archivo y probar restauración en una instancia aislada.
Consultar la versión del CLI y el help actual; CLI v3 usa local por defecto
sin el flag --remote.

Validar en cada escuela: school_id, hash del JSON bruto original,
áreas, IDs de agrupamientos, contenidos, planes, secuencias y las cuatro
etapas, incluidos campos no conocidos por versiones anteriores.

ATENCIÓN: hay un incidente histórico de contenidos desaparecidos, por lo que
guardar una copia del estado actual NO prueba que lo anterior esté íntegro.
La liberación no debe borrar evidencia ni anular restauraciones pendientes.

## 4. Entorno de staging (nunca producción directamente)

1. Levantar PostgreSQL/Supabase aislado con datos sintéticos (sin nombres de
   docentes, correos, códigos o trabajos reales).
2. Aplicar primero migration/concurrencia/003_supabase_scoped_units.sql.
3. Aplicar después migration/multipci/001_additive_school_pcis.sql.
4. Verificar que las tablas pci_collaboration.* y pci_workspace.* son privadas,
   RLS habilitada y sin acceso directo de anon ni authenticated.
5. Confirmar las RPC en schema public, ejecutables solamente por service_role.
6. Probar una escuela con 2 orientaciones y 2 PCI de la misma orientación.
   Verificar que cada proceso tenga ID y revisión propios.
7. Ejecutar en staging una carrera de dos editores sobre la misma unidad:
   un guardado triunfa y el segundo recibe HTTP 409 sin sobrescribir.
8. Confirmar los hashes de public.pci_proposals antes y después.
9. Verificar que un usuario de la escuela A no ve ni guarda contenidos de B.

## 5. Integración necesaria en la Edge Function ACTUAL

Descargar desde Supabase la versión exacta que funciona hoy de pci-access,
incluyendo index.ts y online-guard.mjs. Guardarla en un proyecto PRIVADO.
Copiar el nuevo archivo src/multipci/pci-workspace-handlers.mjs junto a
index.ts (como pci-workspace-handlers.mjs).

Agregar al inicio de index.ts:

    import {handleMultiPci} from './pci-workspace-handlers.mjs';

Justo DESPUÉS de la validación de sesión
'const session=await readToken(body.token); if(!session)...'
y antes de la ruta get-state/save-state, agregar:

    const multi=await handleMultiPci({
      action,body,session,db:supabase,cors,
      inScope,hasPerm,actorFromSession
    });
    if(multi)return multi;

Mantener intactas las rutas existentes:
- public-catalog
- admin-login, school-login y school-admin-login
- get-state y save-state (online-guard.mjs)
- list-schools, get-school-dashboard y auditorías
- gestión de usuarios y claves

NO aceptar rol/escuela por parámetros del navegador: el módulo deriva la
identidad de la sesión del servidor. Respetar el modo de JWT/Edge actual
(código institucional propio), sin cambiarlo por una configuración genérica.

Probar las acciones nuevas en staging:
- create-school-v2 (solo admin)
- list-school-pcis
- create-school-pci
- get-school-pci
- get-school-pci-unit
- save-school-pci-unit

## 6. Publicación progresiva

A. Subir en un entorno de revisión los archivos NUEVOS de PR #34 y confirmar
   que no hay cambios inesperados en index, app y escuela-online.
B. Abrir pci-orientaciones.html?school=ID desde una sesión válida en el MISMO
   dominio: el módulo usa sessionStorage institucional y se autentica por API.
C. Verificar FG: importar, revisar, modificar una secuencia en copia, guardar,
   cerrar/reabrir y comprobar que la copia persiste y el origen no cambia.
D. Verificar FO: alternativa A/B, ubicar materias, revisar conformación, asignar
   contenidos provisionales, crear cuatro planes y recargar.
E. Dos pestañas, dos escuelas y dos editores: ninguna mezcla ni pérdida.
F. Verificar que la escuela nueva con FG vacía puede empezar desde plantilla
   sin modificar su documento original.
G. Probar ante red interrumpida: no se muestra 'guardado' si falló; conservar
   borrador local y mostrar conflicto HTTP 409 en lugar de sobrescribir.
H. Solo después del visto bueno, enlazar desde administración y panel escuela.

Para volver atrás basta DESHABILITAR el enlace a la pantalla nueva y mantener
el editor anterior. No eliminar las nuevas tablas: contienen el trabajo creado
en el nuevo sistema. El rollback debe ser de rutas/código, no un DROP ni un
restore que suprima nuevos PCI.

## 7. Aceptación obligatoria antes del vivo

- [ ] Backup externo con SHA y restauración comprobada del estado ACTUAL.
- [ ] Pruebas CI verdes de currículo, concurrencia, PostgreSQL y navegador.
- [ ] Prueba manual sobre staging en escritorio y celular.
- [ ] Ingreso de administrador, editor, consulta y escuela sin permisos.
- [ ] 2 PCI independientes de una escuela, y 2 escuelas en paralelo.
- [ ] Copia original FG sin cambios, incluidos planes y 4 etapas.
- [ ] Conteos de cobertura V2 basados en IDs correctos, sin duplicación.
- [ ] Alertas de conflicto, recarga y reconexión sin pérdida.
- [ ] Revisiones institucionales y restauraciones pendientes verificadas.
- [ ] OK del responsable funcional; después el programador publica.

## 8. Mecanismo de control posterior al despliegue

Mantener el desarrollo de orientaciones apagado para escuelas hasta
completar aceptación. Al habilitarlo para una escuela piloto, verificar
el estado en Supabase después de cada operación y comparar el SHA
de public.pci_proposals.data. No publicar por GitHub Pages ni
desplegar SQL a ciegas porque los tests pasen: son condiciones
necesarias, no suficientes.
