# Vista previa: alta de escuelas y multiples PCI

ESTADO: DEMOSTRACION AISLADA. No es un cambio publicado ni migrado a Supabase.

## Para revisar con el disenador
1. Abrir preview-multipci.html desde la rama de prueba.
2. Crear una escuela ficticia y comprobar que aparece en la lista.
3. Crear dos PCI por escuela, tambien de la misma orientacion con diferente nombre.
4. Cambiar la sinopsis de un PCI: su revision aumenta sin cambiar el otro.
5. Exportar JSON de prueba y constatar que se conserva la FG ficticia de origen.

No introducir datos reales, CUE reales, claves ni documentos reales en la maqueta.
Los datos ficticios solo persisten en el almacenamiento de sesion del navegador.

## Modelo de persistencia

- public.pci_proposals: los 237 documentos existentes permanecen inalterados.
  Unica escritura nueva prevista: INSERT de institucion nueva autorizada.
- pci_workspace.legacy_snapshots: captura unica por SHA256 del JSON bruto
  original de la escuela al crear un PCI. Es copia interna, no backup externo.
- pci_workspace.pcis: school_id + orientation_id + process_id, nombre,
  estado y catalogos. Admite varios PCI de la misma orientacion.
- pci_workspace.events: auditoria separada del alta de instituciones/PCI.
- pci_collaboration.units y unit_history: guardado por unidad
  de escuela+orientacion+proceso+componente. Se reutiliza la propuesta
  migration/concurrencia/003_supabase_scoped_units.sql.

## API preparada, no desplegada

src/multipci/pci-workspace-handlers.mjs exporta handleMultiPci.
Debe importarse dentro de pci-access, despues de readToken, reutilizando
las funciones de permisos reales. Nunca aceptar identidad del navegador
ni publicar una Edge Function que no valide sesiones.

    const result = await handleMultiPci({
      action, body, session, db: supabase, cors,
      inScope, hasPerm, actorFromSession
    });
    if (result) return result;

Acciones: create-school-v2, list-school-pcis, create-school-pci,
get-school-pci, get-school-pci-unit, save-school-pci-unit.
La orientacion y el proceso de las unidades se obtienen del PCI registrado,
no de parametros del cliente. Guardado con revision esperada y 409 en conflicto.

## Bloqueantes de publicacion real

1. Resolver el incidente de contenidos perdidos y verificar la restauracion
   de todas las escuelas afectadas. Un documento actual puede estar incompleto.
2. Generar respaldo EXTERNO de todos los registros escolares, auditorias e
   historial, con hashes y pruebas de restauracion.
3. Montar Supabase aislado con datos ficticios.
4. Aplicar alli, primero, contrato 003 de colaboracion y luego contrato 001
   de multi-PCI; convertir a migraciones oficiales versionadas al validar.
5. Conectar handler al pci-access e integrar botones en panel-general/editor.
   La maqueta sola NO permite altas reales.
6. Ensayar dos usuarios, dos pestañas, conflictos 409, cierres y recargas.
7. Verificar importacion/exportacion de 237 matrices: contenidos, grupos,
   planes, secuencias (cuatro etapas), claves y metadatos.
8. Resolver el aislamiento de pestañas del PR #32 antes de habilitar nuevo
   editor en produccion.
9. Solo tras aprobacion del equipo y del disenador: despliegue manual
   controlado y verificacion antes/despues de los hashes historicos.

PROHIBIDO fusionar PR #33 a main, ejecutar SQL sobre Supabase real o
reemplazar escuela-online.html de produccion sin estas validaciones.
La rama PR #28 tiene el bloqueo de escritura intencional.

## Validacion

.github/workflows/validar-multipci.yml levanta PostgreSQL 17 efimero, con
roles y escuelas ficticias. Ejecuta contrato-postgres.sql y las pruebas
del HTML y la autorizacion Edge. Verde en CI NO garantiza integridad de
las escuelas reales: se exige prueba con respaldo privado aparte.
