/**
 * Prescripción de PVF para el motor de Media. Funciones puras: no acceden al
 * DOM, al almacenamiento ni a la red. Los identificadores proceden de fo().
 * El dato persistido de un grupo es phase2V28.groups[slot], sin envolverlo en
 * data; ese grupo y sus cuatro planes bimestrales nunca se reconstruyen aquí.
 */
import {ORIENTATIONS} from '../integracion-curricular/bridge.js';
import {PVF_TABLE, PVF_RULESET} from '../integracion-curricular/proyecto-vinculacion-2026.mjs';

export const PVF_MEDIA_VERSION = 'pvf-media/1';
export const PVF_MEDIA_SLOT = 'proyecto-n5';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => object(value) && Object.hasOwn(value, key);
const copy = value => structuredClone(value);
const fail = (code, message) => Object.assign(new Error(message), {code});
const slug = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-');

function reference(orientationId, alternative) {
  const orientation = ORIENTATIONS.find(item => item.id === orientationId);
  const row = PVF_TABLE.find(item => item.orientationId === orientationId);
  if (!orientation || !row)
    throw fail('PVF_ORIENTACION_INVALIDA', 'La orientación no tiene una prescripción de PVF de Media.');
  if (!['A', 'B'].includes(alternative))
    throw fail('PVF_ALTERNATIVA_INVALIDA', 'La alternativa curricular del PVF debe ser A o B.');
  return {orientation:orientation.name, ...row[alternative]};
}

function realId(subjectId, orientation) {
  const prefix = 'fo-' + slug(orientation) + '-5-';
  return typeof subjectId === 'string' && subjectId.startsWith(prefix) &&
    /^(?:0|[1-9]\d*)$/.test(subjectId.slice(prefix.length));
}

/** Resuelve una sola materia FO de 5.º del catálogo activo; las horas son normativas. */
export function resolvePvf({orientationId, alternative = 'A', subjects} = {}) {
  const expected = reference(orientationId, alternative);
  if (!Array.isArray(subjects))
    throw fail('PVF_CATALOGO_INVALIDO', 'No se recibió el catálogo activo de materias del motor.');
  const matches = subjects.filter(subject => object(subject) && subject.origin === 'FO' &&
    Number(subject.year) === 5 && subject.name === expected.name);
  if (!matches.length)
    throw fail('PVF_MATERIA_NO_DISPONIBLE', 'El catálogo activo no contiene la materia prescripta: ' + expected.name + '.');
  if (matches.length !== 1 || subjects.filter(subject => subject?.id === matches[0].id).length !== 1)
    throw fail('PVF_MATERIA_AMBIGUA', 'El catálogo contiene más de una referencia para la materia de PVF.');
  const subjectId = matches[0].id;
  if (!realId(subjectId, expected.orientation))
    throw fail('PVF_IDENTIFICADOR_INVALIDO', 'La materia de PVF no tiene un identificador del motor de Media de esta orientación.');
  return {
    version:PVF_MEDIA_VERSION, ruleSet:PVF_RULESET, orientationId,
    orientation:expected.orientation, alternative, subjectId,
    name:expected.name, hours:expected.hours, slot:PVF_MEDIA_SLOT,
    year:5, duration:'annual', startTerm:9, endTerm:10
  };
}

function validatePrescription(value) {
  if (!object(value)) throw fail('PVF_PRESCRIPCION_INVALIDA', 'Se requiere una prescripción de PVF resuelta con el catálogo.');
  const expected = reference(value.orientationId, value.alternative);
  const fields = {version:PVF_MEDIA_VERSION, ruleSet:PVF_RULESET,
    orientation:expected.orientation, name:expected.name, hours:expected.hours,
    slot:PVF_MEDIA_SLOT, year:5, duration:'annual', startTerm:9, endTerm:10};
  if (Object.entries(fields).some(([key, field]) => value[key] !== field) ||
    !realId(value.subjectId, expected.orientation))
    throw fail('PVF_PRESCRIPCION_INVALIDA', 'La prescripción de PVF no coincide con la orientación y alternativa indicadas.');
  return {...fields, orientationId:value.orientationId, alternative:value.alternative, subjectId:value.subjectId};
}

function hasValue(value) {
  if (value === null || value === undefined || value === false) return false;
  if (typeof value === 'string') return Boolean(value.trim());
  if (Array.isArray(value)) return value.some(hasValue);
  if (object(value)) return Object.values(value).some(hasValue);
  return true;
}

function planHasWork(plan) {
  if (!object(plan)) return hasValue(plan);
  const {number, name, autoName, autoNameSource, ...development} = plan;
  if (autoName !== true && (hasValue(name) || hasValue(autoNameSource))) return true;
  return hasValue(development);
}

/** Distingue los cuatro planes automáticos vacíos de cualquier desarrollo propio. */
export function grupoPvfConTrabajo(group) {
  if (group === null || group === undefined) return false;
  if (!object(group)) return true;
  const {plansBimestrales, ...development} = group;
  if (hasValue(development)) return true;
  if (plansBimestrales === null || plansBimestrales === undefined) return false;
  if (!Array.isArray(plansBimestrales)) return true;
  return plansBimestrales.some(planHasWork);
}

function mapHasPvfWork(map) {
  const phase = map.phase2V28;
  if (phase !== undefined && phase !== null && !object(phase)) return true;
  if (phase?.groups !== undefined && phase.groups !== null && !object(phase.groups)) return true;
  if (own(phase?.groups, PVF_MEDIA_SLOT) && grupoPvfConTrabajo(phase.groups[PVF_MEDIA_SLOT])) return true;
  if (map.phase2 !== undefined && map.phase2 !== null && !object(map.phase2)) return true;
  if (own(map.phase2, PVF_MEDIA_SLOT) && grupoPvfConTrabajo(map.phase2[PVF_MEDIA_SLOT])) return true;
  const custom = phase?.customContents;
  if (custom !== undefined && custom !== null && !Array.isArray(custom)) return true;
  return (custom || []).some(content => content?.groupId === PVF_MEDIA_SLOT);
}

const sameMaterial = (left, right) => left.orientationId === right.orientationId &&
  left.subjectId === right.subjectId && left.name === right.name && left.hours === right.hours;
const single = (ids, id) => ids.length === 1 && ids[0] === id;

/**
 * Devuelve {mapa, estado, cambio, conflicto}. Siempre entrega una copia completa.
 * Sólo prearma un slot vacío o reconcilia una prescripción previa reconocida y
 * sin desarrollo. Otra materia o ubicación existente requiere revisión humana.
 * pvfMedia conserva la identidad A/B aunque el motor reutilice el mismo ID.
 * No cambia map.alt: quien solicita una alternativa debe aplicar primero este
 * resultado y luego realizar su cambio, únicamente si no hubo conflicto.
 */
export function aplicarPvfEnMapa(mapa, {prescripcion} = {}) {
  if (!object(mapa)) throw fail('PVF_MAPA_INVALIDO', 'Se requiere el mapa completo de Media.');
  const expected = validatePrescription(prescripcion);
  const output = copy(mapa);
  const rawIds = mapa.placements?.[PVF_MEDIA_SLOT];
  const ids = rawIds === undefined ? [] : rawIds;
  const conflict = (code, message, otherSlots = []) => ({
    mapa:output, estado:'conflicto', cambio:false,
    conflicto:{code, message, slot:PVF_MEDIA_SLOT,
      actual:{alternative:mapa.alt ?? null, subjectIds:copy(ids),
        prescripcion:copy(mapa.pvfMedia ?? null), otrosSlots:[...otherSlots]},
      esperada:copy(expected)}
  });
  if (mapa.placements !== undefined && !object(mapa.placements) ||
    !Array.isArray(ids) || ids.some(id => typeof id !== 'string'))
    return conflict('PVF_COMPOSICION_INVALIDA', 'La composición existente del PVF requiere revisión. Se conservó completa.');

  let previous = null;
  if (own(mapa, 'pvfMedia')) {
    try { previous = validatePrescription(mapa.pvfMedia); }
    catch { return conflict('PVF_IDENTIDAD_PREVIA_INVALIDA', 'La identidad guardada del PVF no se puede verificar. Se conservó el trabajo existente.'); }
    if (previous.orientationId !== expected.orientationId)
      return conflict('PVF_ORIENTACION_AJENA', 'El PVF guardado pertenece a otra orientación. No se reasignó.');
  }

  const protectedIds = new Set([expected.subjectId, previous?.subjectId].filter(Boolean));
  const otherSlots = Object.entries(mapa.placements || {}).filter(([slot, placed]) =>
    slot !== PVF_MEDIA_SLOT && (Array.isArray(placed) ? placed.some(id => protectedIds.has(id)) : protectedIds.has(placed)))
    .map(([slot]) => slot);
  if (otherSlots.length)
    return conflict('PVF_MATERIA_EN_OTRO_ESPACIO', 'La materia prescripta del PVF ya está ubicada en otro espacio. Revisá esa asignación; no se movió ni duplicó.', otherSlots);

  const hasWork = mapHasPvfWork(mapa);
  const correct = single(ids, expected.subjectId);
  const recognizedPrevious = previous && single(ids, previous.subjectId);
  const materialChanged = previous && !sameMaterial(previous, expected);

  if (!previous && ['A', 'B'].includes(mapa.alt) && mapa.alt !== expected.alternative &&
    (ids.length || hasWork))
    return conflict('PVF_ALTERNATIVA_SIN_IDENTIDAD_PREVIA', 'El PVF existente no tiene una identidad verificada para cambiar de alternativa. Revisá primero su composición actual.');
  if (ids.length && !correct && !(recognizedPrevious && materialChanged))
    return conflict('PVF_COMPOSICION_NO_PRESCRIPTA', 'El PVF contiene otra materia o más de una asignación. Se conservó su composición para revisarla.');
  if (materialChanged && ids.length && !recognizedPrevious)
    return conflict('PVF_IDENTIDAD_PREVIA_INCOMPATIBLE', 'La composición actual no coincide con la prescripción anterior del PVF. Se conservó sin cambios.');
  if (materialChanged && hasWork || !ids.length && hasWork && !(previous && sameMaterial(previous, expected)))
    return conflict('PVF_TRABAJO_INCOMPATIBLE', 'El PVF tiene contenidos, planes u otro desarrollo que requiere revisión antes de asignarle otra materia. Se conservó íntegro.');

  const metadataChanged = !previous || Object.entries(expected).some(([key, value]) => mapa.pvfMedia[key] !== value);
  const placementChanged = !correct;
  if (placementChanged) {
    output.placements ??= {};
    output.placements[PVF_MEDIA_SLOT] = [expected.subjectId];
  }
  if (placementChanged || materialChanged) output.valid = false;
  if (metadataChanged) output.pvfMedia = {...(output.pvfMedia || {}), ...copy(expected)};
  const change = placementChanged || metadataChanged;
  return {mapa:output, estado:change ? 'aplicado' : 'sin-cambios', cambio:change, conflicto:null};
}
