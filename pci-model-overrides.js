import * as base from './pci-model.js?base=20260813-1';

export * from './pci-model.js?base=20260813-1';

const SOCIAL_TERMS = [1, 2, 3, 4, 5, 5, 6, 6, 7, 8, 9, 10];
const LEGACY_SOCIAL_TERMS = [1, 2, 3, 4, 5, 6, 6, 7, 7, 8, 9, 10];
const DUP_MARK = '@@PCI_DUP@@';

export const AREA_CONFIG = {
  ...base.AREA_CONFIG,
  'Ciencias Sociales': {
    ...base.AREA_CONFIG['Ciencias Sociales'],
    terms: SOCIAL_TERMS,
  },
  Tecnologías: {
    ...base.AREA_CONFIG.Tecnologías,
    count: 8,
  },
  'Otros formatos pedagógicos': {
    ...base.AREA_CONFIG['Otros formatos pedagógicos'],
    sourceArea: 'Otros formatos pedagógicos',
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function termOf(group) {
  const value = Number(group?.startTerm ?? group?.termStart ?? group?.term);
  return Number.isInteger(value) ? value : null;
}

function countsFor(groups) {
  const counts = new Map();
  for (const group of groups ?? []) {
    const term = termOf(group);
    if (!term) continue;
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return counts;
}

function isNewSocialLayout(groups) {
  const counts = countsFor(groups);
  return counts.get(5) === 2 && counts.get(6) === 2 && (counts.get(7) ?? 0) === 1;
}

function mapTermsByOccurrence(groups, fromTerms, toTerms) {
  const fromSlots = new Map();
  fromTerms.forEach((term, index) => {
    const list = fromSlots.get(term) ?? [];
    list.push(index);
    fromSlots.set(term, list);
  });
  const used = new Map();
  for (const group of groups ?? []) {
    const term = termOf(group);
    const occurrence = used.get(term) ?? 0;
    used.set(term, occurrence + 1);
    const slotIndex = fromSlots.get(term)?.[occurrence];
    if (slotIndex === undefined) continue;
    const mapped = toTerms[slotIndex];
    group.startTerm = mapped;
    group.endTerm = mapped;
    group.termStart = mapped;
    group.termEnd = mapped;
    group.term = String(mapped);
    group.level = base.levelForTerm(mapped);
  }
}

function encodeAssignments(rawState) {
  let sequence = 0;
  for (const area of Object.values(rawState?.areas ?? {})) {
    for (const group of area?.groups ?? []) {
      if (!Array.isArray(group.items)) continue;
      group.items = group.items.map((id) => `${String(id)}${DUP_MARK}${sequence++}`);
    }
  }
}

function decodeAssignments(state) {
  for (const { group } of base.allGroups(state)) {
    const seen = new Set();
    group.items = (group.items ?? []).map((id) => String(id).split(DUP_MARK)[0]).filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
}

function normalizeCurriculumRules() {
  return { artLanguages: [] };
}

function hasTutoria(group) {
  return (group?.items ?? []).some((id) => String(id).startsWith('tutoria-'));
}

export function sourceAreaFor(area) {
  if (area === 'Otros formatos pedagógicos') return 'Otros formatos pedagógicos';
  return base.sourceAreaFor(area);
}

export function migrateState(rawState = {}) {
  const prepared = clone(rawState);
  const social = prepared?.areas?.['Ciencias Sociales']?.groups ?? [];
  const alreadyNew = isNewSocialLayout(social);

  if (alreadyNew) {
    mapTermsByOccurrence(social, SOCIAL_TERMS, LEGACY_SOCIAL_TERMS);
  }

  encodeAssignments(prepared);
  const state = base.migrateState(prepared);
  decodeAssignments(state);

  const migratedSocial = state.areas['Ciencias Sociales'].groups;
  mapTermsByOccurrence(migratedSocial, LEGACY_SOCIAL_TERMS, SOCIAL_TERMS);
  state.curriculumRules = normalizeCurriculumRules();
  return state;
}

export function moveContents(state, targetGroupId, contentIds) {
  const target = base.findGroup(state, targetGroupId);
  if (!target) throw new Error('El espacio de destino no existe.');
  const ids = [...new Set((Array.isArray(contentIds) ? contentIds : []).map(String))];
  target.group.items.push(...ids.filter((id) => !target.group.items.includes(id)));
  return target.group;
}

export function setOtherDuration(group, duration, placement) {
  const targetLevel = duration === 'annual'
    ? Math.min(5, Math.max(1, Number(placement) || 1))
    : base.levelForTerm(Number(placement) || 1);
  if (hasTutoria(group) && targetLevel > 2) return group;
  base.setOtherDuration(group, duration, placement);
  return group;
}

export function moveGroupToTerm(state, groupId, requestedTerm) {
  const found = base.findGroup(state, groupId);
  if (!found) throw new Error('El espacio que querés mover no existe.');
  const term = Number(requestedTerm);
  if (!Number.isInteger(term) || term < 1 || term > 10) {
    throw new Error('El cuatrimestre de destino no es válido.');
  }

  const { area, group } = found;
  if (group.kind === 'other' && hasTutoria(group) && base.levelForTerm(term) > 2) {
    throw new Error('Tutoría solo puede ubicarse en Nivel 1 o Nivel 2 (C1-C4).');
  }
  if (group.kind !== 'laboratory' || area !== 'Ciencias Sociales') {
    return base.moveGroupToTerm(state, groupId, term);
  }

  if (group.startTerm === term) return { group, swapped: null };
  const capacity = SOCIAL_TERMS.filter((configuredTerm) => configuredTerm === term).length;
  const targetGroups = state.areas[area].groups.filter(
    (candidate) => candidate.id !== group.id && candidate.startTerm === term,
  );
  let swapped = null;
  if (targetGroups.length >= capacity) {
    swapped = targetGroups[0];
    Object.assign(swapped, {
      startTerm: group.startTerm,
      endTerm: group.startTerm,
      level: base.levelForTerm(group.startTerm),
    });
  }
  Object.assign(group, { startTerm: term, endTerm: term, level: base.levelForTerm(term) });
  return { group, swapped };
}

export function validateStructure(state) {
  const errors = base.validateStructure(state).filter(
    (error) => !error.startsWith('Ciencias Sociales debe tener 12 laboratorios'),
  );
  const socialTerms = state.areas['Ciencias Sociales'].groups.map((group) => group.startTerm).sort((a, b) => a - b);
  if (JSON.stringify(socialTerms) !== JSON.stringify(SOCIAL_TERMS)) {
    errors.push('Ciencias Sociales debe tener 12 laboratorios, con simultaneidad en C5 y C6.');
  }
  return errors;
}
