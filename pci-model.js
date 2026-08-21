export const TERM_LABELS = Array.from({ length: 10 }, (_, index) => `C${index + 1}`);

export const LEVELS = [
  { number: 1, startTerm: 1, endTerm: 2 },
  { number: 2, startTerm: 3, endTerm: 4 },
  { number: 3, startTerm: 5, endTerm: 6 },
  { number: 4, startTerm: 7, endTerm: 8 },
  { number: 5, startTerm: 9, endTerm: 10 },
];

export const OTHER_FORMAT_TYPES = ['Seminario', 'Proyecto', 'Ateneo'];

export const AREA_CONFIG = {
  'Lengua y Literatura': { kind: 'trunk', count: 5, singular: 'Nivel', sourceArea: 'Lengua y Literatura' },
  Matemática: { kind: 'trunk', count: 5, singular: 'Nivel', sourceArea: 'Matemática' },
  'Lenguas Adicionales': { kind: 'trunk', count: 5, singular: 'Nivel', sourceArea: 'Lenguas Adicionales' },
  'Ciencias Sociales': {
    kind: 'laboratory',
    count: 12,
    singular: 'Laboratorio',
    sourceArea: 'Ciencias Sociales',
    terms: [1, 2, 3, 4, 5, 6, 6, 7, 7, 8, 9, 10],
  },
  'Ciencias Naturales': {
    kind: 'laboratory',
    count: 10,
    singular: 'Laboratorio',
    sourceArea: 'Ciencias Naturales',
    terms: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  Artes: { kind: 'workshop', count: 6, singular: 'Taller', sourceArea: 'Artes' },
  Tecnologías: { kind: 'workshop', count: 8, singular: 'Taller', sourceArea: 'Tecnologías' },
  'Educación Física': {
    kind: 'workshop',
    count: 10,
    singular: 'Taller',
    sourceArea: 'Educación Física',
  },
  'Otros formatos pedagógicos': {
    kind: 'other',
    count: 0,
    singular: 'Otro formato',
    sourceArea: 'Tecnologías',
  },
};

export const AREA_ORDER = Object.keys(AREA_CONFIG);

function text(value) {
  return typeof value === 'string' ? value : '';
}

function uniqueIds(values) {
  return [...new Set(Array.isArray(values) ? values.map(String) : [])];
}

function safeTerm(value) {
  const term = Number(value);
  return Number.isInteger(term) && term >= 1 && term <= 10 ? term : null;
}

export function levelForTerm(term) {
  const safe = safeTerm(term);
  return safe ? Math.ceil(safe / 2) : null;
}

export function termsForLevel(levelNumber) {
  const level = LEVELS.find((item) => item.number === Number(levelNumber));
  return level ? [level.startTerm, level.endTerm] : [1, 2];
}

function baseGroup(area, index, kind, term = null) {
  const config = AREA_CONFIG[area];
  const level = kind === 'trunk' ? index + 1 : levelForTerm(term);
  const [levelStart, levelEnd] = kind === 'trunk' ? termsForLevel(level) : [term, term];
  return {
    id: `${slug(area)}-${kind}-${index + 1}`,
    kind,
    name: kind === 'trunk' ? `Nivel ${index + 1}` : `${config.singular} ${index + 1}`,
    objective: '',
    synopsis: '',
    context: '',
    practiceAxis: '',
    formatType: kind === 'other' ? OTHER_FORMAT_TYPES[0] : '',
    duration: kind === 'trunk' ? 'annual' : 'quarterly',
    level: level ?? null,
    startTerm: levelStart ?? null,
    endTerm: levelEnd ?? null,
    type: kind === 'other' ? 'Electivo' : 'Obligatorio',
    custom: kind === 'other',
    elective: false,
    items: [],
  };
}

function slug(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeGroup(area, raw, index, forcedKind, forcedTerm = undefined) {
  const legacyKind = raw?.kind === 'otro_formato_pedagogico' ? 'other' : raw?.kind;
  const kind = ['trunk', 'laboratory', 'workshop', 'other'].includes(legacyKind)
    ? legacyKind
    : forcedKind;
  const term = forcedTerm === undefined
    ? safeTerm(raw?.startTerm ?? raw?.termStart ?? raw?.term)
    : forcedTerm;
  const legacyOtherSynopsis = kind === 'other' ? raw?.context : '';
  const group = {
    ...baseGroup(area, index, kind, term),
    ...raw,
    id: text(raw?.id) || `${slug(area)}-${kind}-${index + 1}`,
    kind,
    name: text(raw?.name) || baseGroup(area, index, kind, term).name,
    objective: text(raw?.objective ?? raw?.objectives),
    synopsis: text(raw?.synopsis ?? raw?.summary ?? legacyOtherSynopsis),
    context: text(raw?.context ?? raw?.problemContext),
    practiceAxis: text(raw?.practiceAxis ?? raw?.practiceProductAxis),
    formatType: OTHER_FORMAT_TYPES.includes(raw?.formatType) ? raw.formatType : OTHER_FORMAT_TYPES[0],
    type:
      raw?.type === 'Electivo' || raw?.type === 'Obligatorio'
        ? raw.type
        : raw?.elective
          ? 'Electivo'
          : baseGroup(area, index, kind, term).type,
    items: uniqueIds(raw?.items),
  };

  group.elective = group.type === 'Electivo';

  if (kind === 'trunk') {
    const level = index + 1;
    const [startTerm, endTerm] = termsForLevel(level);
    Object.assign(group, { level, startTerm, endTerm, duration: 'annual', custom: false });
  } else if (kind === 'other') {
    const legacyEnd = safeTerm(raw?.endTerm ?? raw?.termEnd);
    const looksAnnual = Boolean(term && legacyEnd === term + 1 && levelForTerm(term) === levelForTerm(legacyEnd));
    group.duration = raw?.duration === 'annual' || looksAnnual ? 'annual' : 'quarterly';
    if (group.duration === 'annual') {
      const level = Number(raw?.level) || levelForTerm(term) || 1;
      const [startTerm, endTerm] = termsForLevel(level);
      Object.assign(group, { level, startTerm, endTerm });
    } else {
      const startTerm = term || 1;
      Object.assign(group, { level: levelForTerm(startTerm), startTerm, endTerm: startTerm });
    }
    group.custom = true;
  } else {
    const startTerm = forcedTerm ?? term;
    Object.assign(group, {
      level: startTerm ? levelForTerm(startTerm) : null,
      startTerm: startTerm || null,
      endTerm: startTerm || null,
      duration: 'quarterly',
      custom: false,
    });
  }
  return group;
}

function buildFixedGroups(area, existing = []) {
  const config = AREA_CONFIG[area];
  if (config.kind === 'trunk') {
    return Array.from({ length: config.count }, (_, index) =>
      normalizeGroup(area, existing[index], index, 'trunk'),
    );
  }

  if (config.kind === 'laboratory') {
    const available = [...existing];
    return config.terms.map((term, index) => {
      const matchIndex = available.findIndex(
        (group) => safeTerm(group?.startTerm ?? group?.termStart ?? group?.term) === term,
      );
      // A missing simultaneous laboratory must not consume the next saved term.
      // This preserves every existing name/content in its original C1-C10 slot.
      const raw = matchIndex >= 0 ? available.splice(matchIndex, 1)[0] : undefined;
      return normalizeGroup(area, raw, index, 'laboratory', term);
    });
  }

  return Array.from({ length: config.count }, (_, index) => {
    const raw = existing[index];
    const savedTerm = safeTerm(raw?.startTerm ?? raw?.termStart ?? raw?.term);
    // A visible initial slot keeps the complete matrix useful from the first load;
    // institutions can edit every workshop's C1-C10 placement afterwards.
    return normalizeGroup(area, raw, index, 'workshop', savedTerm ?? ((index % 10) + 1));
  });
}

function extractOtherGroups(rawState) {
  const explicit = rawState?.areas?.['Otros formatos pedagógicos']?.groups ?? [];
  const embedded = Object.values(rawState?.areas ?? {}).flatMap((area) =>
    (area?.groups ?? []).filter(
      (group) => group?.kind === 'other' || group?.kind === 'otro_formato_pedagogico',
    ),
  );
  return [...explicit, ...embedded].filter(
    (group, index, all) => all.findIndex((candidate) => candidate === group || candidate?.id === group?.id) === index,
  );
}

export function migrateState(rawState = {}) {
  const state = {
    schemaVersion: 10,
    schoolName: text(rawState.schoolName) || 'Escuela Muestra',
    current: AREA_CONFIG[rawState.current] ? rawState.current : null,
    areas: {},
  };

  for (const area of AREA_ORDER) {
    const previous = rawState?.areas?.[area] ?? {};
    const groups =
      area === 'Otros formatos pedagógicos'
        ? extractOtherGroups(rawState).map((group, index) =>
            normalizeGroup(area, group, index, 'other'),
          )
        : buildFixedGroups(
            area,
            (previous.groups ?? []).filter(
              (group) => group?.kind !== 'other' && group?.kind !== 'otro_formato_pedagogico',
            ),
          );
    state.areas[area] = { closed: Boolean(previous.closed), groups };
  }
  deduplicateAssignments(state);
  return state;
}

function deduplicateAssignments(state) {
  const seenBySource = new Map();
  const assignedOutsideOther = new Set();
  const otherGroups = [];

  for (const { area, group } of allGroups(state)) {
    if (area === 'Otros formatos pedagógicos') {
      otherGroups.push(group);
      continue;
    }
    const sourceArea = sourceAreaFor(area);
    const seen = seenBySource.get(sourceArea) ?? new Set();
    group.items = group.items.filter((id) => {
      const key = String(id);
      if (seen.has(key)) return false;
      seen.add(key);
      assignedOutsideOther.add(key);
      return true;
    });
    seenBySource.set(sourceArea, seen);
  }

  const seenOther = new Set(assignedOutsideOther);
  for (const group of otherGroups) {
    group.items = group.items.filter((id) => {
      const key = String(id);
      if (seenOther.has(key)) return false;
      seenOther.add(key);
      return true;
    });
  }
}

export function addOtherFormat(state) {
  const area = 'Otros formatos pedagógicos';
  const groups = state.areas[area].groups;
  const group = baseGroup(area, groups.length, 'other', 1);
  group.id = `otro-formato-${Date.now()}-${groups.length + 1}`;
  group.name = `Otro formato pedagógico ${groups.length + 1}`;
  groups.push(group);
  return group;
}

export function setOtherDuration(group, duration, placement) {
  if (duration === 'annual') {
    const level = Math.min(5, Math.max(1, Number(placement) || 1));
    const [startTerm, endTerm] = termsForLevel(level);
    Object.assign(group, { duration: 'annual', level, startTerm, endTerm });
  } else {
    const startTerm = safeTerm(placement) || 1;
    Object.assign(group, {
      duration: 'quarterly',
      level: levelForTerm(startTerm),
      startTerm,
      endTerm: startTerm,
    });
  }
}

export function sourceAreaFor(area) {
  return AREA_CONFIG[area]?.sourceArea ?? area;
}

export function allGroups(state) {
  return AREA_ORDER.flatMap((area) =>
    (state.areas[area]?.groups ?? []).map((group) => ({ area, group })),
  );
}

export function findGroup(state, groupId) {
  return allGroups(state).find(({ group }) => group.id === groupId) ?? null;
}

export function locationsForContent(state, contentId) {
  return allGroups(state)
    .filter(({ group }) => group.items.includes(String(contentId)))
    .map(({ area, group }) => ({ area, groupId: group.id, groupName: group.name }));
}

export function moveContents(state, targetGroupId, contentIds) {
  const target = findGroup(state, targetGroupId);
  if (!target) throw new Error('El espacio de destino no existe.');
  const sourceArea = sourceAreaFor(target.area);
  const ids = uniqueIds(contentIds);
  const allowed = new Set(ids);
  const otherArea = 'Otros formatos pedagógicos';
  const movingToOther = target.area === otherArea;
  const movingFromOther = allGroups(state).some(({ area, group }) =>
    area === otherArea && group.items.some((id) => allowed.has(String(id))),
  );
  const moveAcrossAllAreas = movingToOther || movingFromOther;

  for (const { area, group } of allGroups(state)) {
    if (!moveAcrossAllAreas && sourceAreaFor(area) !== sourceArea) continue;
    group.items = group.items.filter((id) => !allowed.has(String(id)));
  }
  target.group.items.push(...ids.filter((id) => !target.group.items.includes(id)));
  return target.group;
}

export function removeContent(state, groupId, contentId) {
  const target = findGroup(state, groupId);
  if (!target) return;
  target.group.items = target.group.items.filter((id) => id !== String(contentId));
}

export function moveGroupToTerm(state, groupId, requestedTerm) {
  const found = findGroup(state, groupId);
  if (!found) throw new Error('El espacio que querés mover no existe.');
  const term = safeTerm(requestedTerm);
  if (!term) throw new Error('El cuatrimestre de destino no es válido.');
  const { area, group } = found;
  if (group.kind === 'trunk') {
    throw new Error('Los niveles troncales son anuales y mantienen su par de cuatrimestres.');
  }
  if (group.startTerm === term && (group.duration !== 'annual' || group.level === levelForTerm(term))) {
    return { group, swapped: null };
  }

  if (group.kind === 'other' && group.duration === 'annual') {
    setOtherDuration(group, 'annual', levelForTerm(term));
    return { group, swapped: null };
  }

  let swapped = null;
  if (group.kind === 'laboratory') {
    const groups = state.areas[area].groups;
    const capacity = AREA_CONFIG[area].terms.filter((configuredTerm) => configuredTerm === term).length;
    const targetGroups = groups.filter(
      (candidate) => candidate.id !== group.id && candidate.startTerm === term,
    );
    if (targetGroups.length >= capacity) {
      swapped = targetGroups[0];
      Object.assign(swapped, {
        startTerm: group.startTerm,
        endTerm: group.startTerm,
        level: levelForTerm(group.startTerm),
      });
    }
  }

  Object.assign(group, { startTerm: term, endTerm: term, level: levelForTerm(term) });
  return { group, swapped };
}

export function deleteOtherFormat(state, groupId) {
  const groups = state.areas['Otros formatos pedagógicos'].groups;
  const index = groups.findIndex((group) => group.id === groupId);
  if (index >= 0) groups.splice(index, 1);
}
