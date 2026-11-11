/**
 * Resguardo y preparación estrictamente SIN PERSISTENCIA del PCI original.
 * Entrada: JSON bruto exportado de la base de la escuela ANTES del editor.
 * No importa pci-model.js: sus normalizaciones y reconstrucciones quedan fuera.
 * No tiene conectores, fetch, localStorage ni escritura online.
 */
import { ORIENTATIONS } from './bridge.js';

export const SAFE_MIGRATION_VERSION = 'pci-resguardo-inmutable/1';
const ALLOWED = new Map(ORIENTATIONS.map(item => [item.id,item.name]));
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const copy = v => JSON.parse(JSON.stringify(v));
const json = v => JSON.stringify(v);
const groups = source => Object.entries(source.areas).flatMap(([area,entry]) =>
  (Array.isArray(entry?.groups) ? entry.groups : []).map((group,index) => ({area,index,group})));
const validNumber = v => Number.isSafeInteger(v) && v > 0;
function fail(message) { throw new Error(message); }

/** Inventario de todos los arreglos sin interpretar, eliminar ni regenerar registros. */
export function inventoryOriginal(source) {
  if (!object(source) || !object(source.areas)) fail('Estado original inválido: falta areas. No se importa.');
  const all = groups(source);
  const ids = new Map(), duplicateIds = [], missingIds = [], values = [];
  let plans = 0, stageNodes = 0;
  for (const {area,index,group} of all) {
    const id = group?.id == null ? '' : String(group.id);
    if (!id) missingIds.push(area+' / posición '+index);
    else if (ids.has(id)) duplicateIds.push({id, first:ids.get(id), second:area+' / '+index});
    else ids.set(id,area+' / '+index);
    for (const value of Array.isArray(group?.items) ? group.items : []) values.push(value);
    if (Array.isArray(group?.plansBimestrales)) {
      plans += group.plansBimestrales.length;
      for (const p of group.plansBimestrales) {
        if (object(p?.stages)) stageNodes += Object.keys(p.stages).length;
      }
    }
  }
  return {
    areas:Object.keys(source.areas).length, groups:all.length, plans,
    stageNodes, selectedOccurrences:values.length,
    distinctContents:new Set(values.map(v=>json(v))).size,
    missingIds,duplicateIds
  };
}

/**
 * Este objeto nunca es un paquete para guardar en la clave actual 'pciAppV2'.
 * Incluye original completo y copias de areas para cada orientación.
 */
export function prepareSafeMigration({rawState,schoolId,orientationIds,offerByOrientation={}}) {
  const id = Number(schoolId);
  if (!validNumber(id)) fail('Se requiere school_id entero positivo.');
  if (!object(rawState) || !object(rawState.areas)) fail('La exportación no contiene la Matriz original.');
  if (rawState.profile === 'tecnica' || Object.hasOwn(rawState.areas,'Tecnología de la Representación'))
    fail('Modelo técnico: requiere migración específica; se bloquea el modelo común.');
  if (rawState.school_id != null && Number(rawState.school_id) !== id)
    fail('La exportación pertenece a otra escuela; operación bloqueada.');
  if (!Array.isArray(orientationIds) || !orientationIds.length)
    fail('Se requieren las orientaciones reales de la escuela.');
  if (!object(offerByOrientation)) fail('Mapa por orientación inválido.');

  const selected = [...new Set(orientationIds)];
  if (selected.length !== orientationIds.length)
    fail('Las orientaciones están repetidas: no se crearán copias duplicadas.');
  for (const orientationId of selected)
    if (!ALLOWED.has(orientationId)) fail('Orientación no reconocida: '+String(orientationId));

  const rawText = json(rawState);
  if (!rawText) fail('No se puede serializar el documento original.');
  const source = copy(rawState);
  const originalInventory = inventoryOriginal(rawState);
  const problems = [];
  if (originalInventory.missingIds.length) problems.push({
    code:'ids-ausentes',severity:'blocking',message:'Hay identificadores ausentes. No se modifican ni se completan automáticamente.'
  });
  if (originalInventory.duplicateIds.length) problems.push({
    code:'ids-repetidos',severity:'blocking',message:'Hay identificadores repetidos. Requieren resolución con la escuela.'
  });
  const copies = {};
  for (const orientationId of selected) {
    const offer = Object.hasOwn(offerByOrientation,orientationId) ? copy(offerByOrientation[orientationId]) : null;
    const copiedAreas = copy(rawState.areas);
    const warnings = [];
    const socialCount = Array.isArray(rawState.areas?.['Ciencias Sociales']?.groups)
      ? rawState.areas['Ciencias Sociales'].groups.length : 0;
    const desired = offer?.socialOption === 'A' ? 10 : offer?.socialOption === 'B' ? 12 : null;
    if (desired !== null && desired !== socialCount) warnings.push({
      code:'revisar-laboratorio',severity:'blocking',
      message:'Revisar laboratorio: '+socialCount+' agrupamientos históricos frente a '+desired+
        ' de la nueva oferta. Conservar los '+socialCount+' originales y revisar todos sus contenidos y planes.'
    });
    if (desired === null) warnings.push({
      code:'regla-sociales-pendiente',severity:'blocking',
      message:'Validación del mapa pendiente: no se puede aplicar una redistribución de Sociales.'
    });
    // Ninguna homologación curricular se ejecuta en el resguardo.
    warnings.push({code:'homologacion-pendiente',severity:'blocking',
      message:'Homologación FG/FO pendiente. No calcular coberturas ni mover contenidos.'});
    copies[orientationId] = {
      id:orientationId,name:ALLOWED.get(orientationId),
      fg:{rawState:copy(rawState),areas:copiedAreas},offer,warnings,
      origin:'copia-literal-del-estado-bruto',
      review:{status:'pendiente',approved:false}
    };
  }
  const staged = {
    format:SAFE_MIGRATION_VERSION,schoolId:id,original:{data:source,inventory:originalInventory},
    orientations:copies,problems,
    publication:{allowed:false,reason:'Requiere respaldo verificado, resolución de bloqueos y OK institucional'},
  };
  const verification = verifySafeMigration(rawState,staged);
  if (!verification.ok) fail('Falló la auditoría de conservación: '+verification.failures.join(' | '));
  return staged;
}

export function verifySafeMigration(rawState,staged) {
  const failures=[];
  if (!object(rawState) || !object(staged) || staged.format !== SAFE_MIGRATION_VERSION)
    return {ok:false,failures:['Formato o estado de origen inválido.']};
  if (json(rawState) !== json(staged.original?.data))
    failures.push('El respaldo original no es idéntico al estado de origen.');
  if (json(inventoryOriginal(rawState)) !== json(staged.original?.inventory))
    failures.push('El inventario del respaldo original es inconsistente.');
  if (!object(staged.orientations) || !Object.keys(staged.orientations).length)
    failures.push('No hay copias para las orientaciones.');
  else for (const [orientationId,entry] of Object.entries(staged.orientations)) {
    if (!ALLOWED.has(orientationId) || entry.id !== orientationId)
      failures.push('Identificador de orientación alterado.');
    if (json(rawState) !== json(entry?.fg?.rawState))
      failures.push('La copia del documento completo difiere del origen: '+orientationId);
    if (json(rawState.areas) !== json(entry?.fg?.areas))
      failures.push('La copia de Formación General difiere del origen: '+orientationId);
    if (!entry?.review || entry.review.approved !== false)
      failures.push('No se permite una aprobación implícita: '+orientationId);
  }
  if (staged.publication?.allowed !== false)
    failures.push('El paquete no puede tener escritura de producción habilitada.');
  return {ok:failures.length===0,failures,
    inventory:inventoryOriginal(rawState),
    comparedOrientations:object(staged.orientations)?Object.keys(staged.orientations).length:0};
}

/** Contrato inmutable: no hay importación ni fusión en este módulo. */
export function ensureSourceUnchanged(baseline,latest) {
  if (json(baseline) !== json(latest)) fail('La Matriz original cambió: detener y generar nuevo respaldo, nunca sobrescribir.');
  return true;
}
