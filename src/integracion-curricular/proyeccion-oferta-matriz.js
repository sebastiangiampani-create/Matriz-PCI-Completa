/**
 * Proyección de lectura del Mapa de la Oferta V2 hacia los mosaicos de Matriz.
 *
 * No migra, normaliza ni modifica la Formación General almacenada en Matriz.
 * Los slots son los mismos que usa preview-v2-real/src/v19-map.js:
 * Ciencias Sociales A/B se decide por map.socialOption ('A'=10, 'B'=12).
 * Los porcentajes curriculares no pueden certificarse sin homologación.
 */
export const OFFER_FG_AREAS = Object.freeze([
  'Lengua y Literatura',
  'Matemática',
  'Lenguas Adicionales',
  'Ciencias Sociales',
  'Ciencias Naturales',
  'Artes',
  'Tecnologías',
  'Educación Física',
  'Otros formatos pedagógicos',
]);

const ALL_TERMS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const ART_TERMS = Object.freeze([1, 2, 3, 4, 7, 8]);
const TECHNOLOGY_TERMS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
const isMap = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const asList = value => Array.isArray(value) ? value : [];
const termYear = term => Math.ceil(term / 2);

function semesterSlot(area, key, term, part = '') {
  return { area, key, part, term, year: termYear(term), slot: key + '-c' + term, format: 'cuatrimestral' };
}
function annualSlot(area, key, year) {
  return { area, key, part: '', term: null, year, slot: key + '-n' + year, format: 'anual' };
}
function semesterRange(area, key, terms) {
  return terms.map(term => semesterSlot(area, key, term));
}
function additionalSpaces(map) {
  const out = [];
  for (const space of asList(map?.otherSpaces)) {
    if (!space || typeof space.id !== 'string' || !space.id) continue;
    const raw = isMap(space) ? space : {};
    const prefix = 'otherSpace_' + space.id;
    for (const term of ALL_TERMS) {
      const slot = prefix + '-c' + term;
      if (Object.prototype.hasOwnProperty.call(map?.placements || {}, slot)) {
        out.push({ area: 'Otros formatos pedagógicos', key: prefix, part: String(raw.name || ''), term, year: termYear(term), slot, format: String(raw.formatType || 'otro') });
      }
    }
  }
  // Un espacio con definición local, pero sin ubicaciones confirmadas, no se
  // inventa como "colocado" en un cuatrimestre.
  return out;
}

export function deriveAreaProjection(area, map = null) {
  if (!OFFER_FG_AREAS.includes(area)) return null;
  const orientation = isMap(map) ? map : null;
  const socialOption = orientation?.socialOption === 'B' ? 'B' : 'A';
  let slots = [];
  switch (area) {
    case 'Lengua y Literatura':
      slots = [1, 2, 3, 4, 5].map(year => annualSlot(area, 'lengua', year));
      break;
    case 'Matemática':
      slots = [1, 2, 3, 4, 5].map(year => annualSlot(area, 'matematica', year));
      break;
    case 'Lenguas Adicionales':
      slots = [1, 2, 3, 4, 5].map(year => annualSlot(area, 'adicional', year));
      break;
    case 'Ciencias Naturales':
      slots = semesterRange(area, 'naturales', ALL_TERMS);
      break;
    case 'Ciencias Sociales':
      slots = semesterRange(area, 'socialA', ALL_TERMS);
      if (socialOption === 'B') slots.push(
        semesterSlot(area, 'socialB', 5, 'B'),
        semesterSlot(area, 'socialB', 6, 'B')
      );
      slots.sort((a, b) => (a.year - b.year) || ((a.term || 0) - (b.term || 0)) || a.slot.localeCompare(b.slot));
      break;
    case 'Artes':
      slots = semesterRange(area, 'artes', ART_TERMS);
      break;
    case 'Tecnologías':
      slots = semesterRange(area, 'tecnologias', TECHNOLOGY_TERMS);
      break;
    case 'Educación Física':
      slots = semesterRange(area, 'ef', ALL_TERMS);
      break;
    case 'Otros formatos pedagógicos':
      slots = additionalSpaces(orientation);
      break;
  }
  const placements = isMap(orientation?.placements) ? orientation.placements : {};
  const mapped = slots.map((item, index) => ({
    ...item,
    number: index + 1,
    subjectIds: [...new Set(asList(placements[item.slot]).filter(x => typeof x === 'string'))],
  }));
  const years = [1, 2, 3, 4, 5].map(year => {
    const groups = mapped.filter(group => group.year === year);
    const ids = new Set(groups.flatMap(group => group.subjectIds));
    return {
      year,
      count: groups.length,
      occupied: groups.filter(group => group.subjectIds.length > 0).length,
      distinctSubjects: ids.size,
      groups,
    };
  });
  return {
    area,
    socialOption: area === 'Ciencias Sociales' ? socialOption : null,
    count: mapped.length,
    occupied: mapped.filter(group => group.subjectIds.length > 0).length,
    distinctSubjects: new Set(mapped.flatMap(group => group.subjectIds)).size,
    source: orientation ? 'mapa-v2-local' : 'esquema-v2-inicial',
    validated: orientation?.valid === true,
    years,
    // La cobertura de contenidos requiere homologación FG/FO: no crear %.
    coveragePercent: null,
  };
}

export function deriveFoProjection(map = null) {
  const orientation = isMap(map) ? map : null;
  const placements = isMap(orientation?.placements) ? orientation.placements : {};
  const foTypes = isMap(orientation?.foTypes) ? orientation.foTypes : {};
  const groups = [];
  for (const year of [3, 4]) {
    for (const term of [year * 2 - 1, year * 2]) {
      const type = foTypes[String(year)]?.[String(term)];
      const format = type === 'lab' ? 'laboratorio' : type === 'taller' ? 'taller' : 'por definir';
      groups.push({ year, term, format, slot: 'foN' + year + '-c' + term });
    }
  }
  for (const term of [9, 10]) {
    groups.push({ year: 5, term, format: 'laboratorio', slot: 'foLab5-c' + term });
    groups.push({ year: 5, term, format: 'taller', slot: 'foTaller5-c' + term });
  }
  groups.push({ year: 5, term: null, format: 'proyecto de vinculación', slot: 'proyecto-n5' });
  return [3, 4, 5].map(year => {
    const areaGroups = groups.filter(group => group.year === year).map(group => ({
      ...group,
      subjectIds: [...new Set(asList(placements[group.slot]).filter(id => typeof id === 'string'))]
    }));
    return {
      year,
      count: areaGroups.length,
      occupied: areaGroups.filter(group => group.subjectIds.length > 0).length,
      groups: areaGroups,
      validated: orientation?.valid === true,
      coveragePercent: null,
    };
  });
}
