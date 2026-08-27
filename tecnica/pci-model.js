export const TERM_LABELS = Array.from({ length: 12 }, (_, index) => `C${index + 1}`);
export const PERIODS = Array.from({ length: 12 }, (_, index) => index + 1);

export const LEVELS = Array.from({ length: 6 }, (_, index) => ({
  number: index + 1,
  startTerm: index * 2 + 1,
  endTerm: index * 2 + 2,
}));

export const TECHNICAL_PROFILE = {
  id: 'tecnica',
  label: 'Escuela Técnica',
  levels: 6,
  periods: 12,
};

const C1_C6 = [1, 2, 3, 4, 5, 6];
const C1_C8 = [1, 2, 3, 4, 5, 6, 7, 8];
const C1_C12 = PERIODS;

export const AREA_CONFIG = {
  'Lengua y Literatura': {
    kind: 'trunk',
    count: 6,
    singular: 'Nivel',
    sourceArea: 'Lengua y Literatura',
  },
  'Matemática': {
    kind: 'trunk',
    count: 6,
    singular: 'Nivel',
    sourceArea: 'Matemática',
  },
  'Lenguas Adicionales': {
    kind: 'trunk',
    count: 6,
    singular: 'Nivel',
    sourceArea: 'Lenguas Adicionales',
  },
  'Ciencias Naturales': {
    kind: 'integration',
    count: 6,
    singular: 'Espacio de Integración',
    sourceArea: 'Ciencias Naturales',
    defaultTerms: [1, 2, 3, 4, 5, 6],
    allowedTerms: C1_C8,
  },
  'Ciencias Sociales': {
    kind: 'integration',
    count: 8,
    singular: 'Espacio de Integración',
    sourceArea: 'Ciencias Sociales',
    defaultTerms: [1, 2, 3, 4, 5, 6, 7, 8],
    allowedTerms: C1_C8,
  },
  'Educación Física': {
    kind: 'formative',
    count: 12,
    singular: 'Espacio Formativo',
    sourceArea: 'Educación Física',
    defaultTerms: C1_C12,
    allowedTerms: C1_C12,
  },
  'Educación Artística': {
    kind: 'formative',
    count: 2,
    singular: 'Espacio Formativo',
    sourceArea: 'Educación Artística',
    defaultTerms: [1, 2],
    allowedTerms: [1, 2],
  },
  'Tecnología de la Representación': {
    kind: 'formative',
    count: 6,
    singular: 'Espacio Formativo',
    sourceArea: 'Tecnología de la Representación',
    defaultTerms: C1_C6,
    allowedTerms: C1_C6,
  },
  'Talleres': {
    kind: 'technical-workshop',
    count: 2,
    singular: 'Taller',
    sourceArea: 'Talleres',
    fixedLevels: [1, 2],
  },
};

export const AREA_ORDER = [
  'Lengua y Literatura',
  'Matemática',
  'Lenguas Adicionales',
  'Ciencias Sociales',
  'Ciencias Naturales',
  'Educación Artística',
  'Tecnología de la Representación',
  'Educación Física',
  'Talleres',
];

const LEGACY_AREA_ALIASES = {
  'Matemática': ['Matematica'],
  'Educación Física': ['Educacion Fisica'],
  'Educación Artística': ['Artes'],
  'Tecnología de la Representación': ['Tecnologia de la Representacion'],
};

function slug(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(String))];
}

export function levelForTerm(term) {
  const value = Number(term);
  if (!Number.isInteger(value) || value < 1 || value > 12) return null;
  return Math.ceil(value / 2);
}

export const levelForPeriod = levelForTerm;

export function termsForLevel(levelNumber) {
  const level = LEVELS.find((item) => item.number === Number(levelNumber));
  return level ? [level.startTerm, level.endTerm] : [1, 2];
}

export const periodsForLevel = termsForLevel;

export function sourceAreaFor(area) {
  return AREA_CONFIG[area]?.sourceArea ?? area;
}

export function allowedTermsForGroup(group) {
  if (!group) return [];
  if (group.kind === 'trunk' || group.kind === 'technical-workshop') return [];
  const config = AREA_CONFIG[group.area];
  return [...(config?.allowedTerms ?? PERIODS)];
}

export function isMovableGroup(group) {
  return allowedTermsForGroup(group).length > 0;
}

function createGroup(area, index) {
  const config = AREA_CONFIG[area];
  const kind = config.kind;
  const group = {
    id: `${slug(area)}-${kind}-${index + 1}`,
    area,
    kind,
    name: kind === 'trunk' ? `Nivel ${index + 1}` : `${config.singular} ${index + 1}`,
    objective: '',
    synopsis: '',
    context: '',
    practiceAxis: '',
    type: kind === 'trunk' ? '' : 'Obligatorio',
    elective: false,
    items: [],
    level: null,
    startTerm: null,
    endTerm: null,
    duration: 'period',
    fixed: false,
  };

  if (kind === 'trunk') {
    const level = index + 1;
    const [startTerm, endTerm] = termsForLevel(level);
    Object.assign(group, { level, startTerm, endTerm, duration: 'annual', fixed: true });
    return group;
  }

  if (kind === 'technical-workshop') {
    const level = config.fixedLevels[index] ?? index + 1;
    const [startTerm, endTerm] = termsForLevel(level);
    Object.assign(group, {
      name: `Taller · Nivel ${level}`,
      level,
      startTerm,
      endTerm,
      duration: 'annual',
      fixed: true,
    });
    return group;
  }

  const term = config.defaultTerms?.[index] ?? null;
  if (term) {
    Object.assign(group, {
      level: levelForTerm(term),
      startTerm: term,
      endTerm: term,
    });
  }
  return group;
}

export function createInitialState() {
  return {
    schemaVersion: 2,
    profile: 'tecnica',
    schoolName: 'Escuela Técnica',
    current: null,
    areas: Object.fromEntries(
      AREA_ORDER.map((area) => [
        area,
        { groups: Array.from({ length: AREA_CONFIG[area].count }, (_, index) => createGroup(area, index)) },
      ]),
    ),
  };
}

function legacyGroups(raw, area) {
  if (Array.isArray(raw?.areas?.[area]?.groups)) return raw.areas[area].groups;
  for (const alias of LEGACY_AREA_ALIASES[area] ?? []) {
    if (Array.isArray(raw?.areas?.[alias]?.groups)) return raw.areas[alias].groups;
  }
  if (area === 'Talleres') {
    return [
      ...(raw?.areas?.['Taller especial 1']?.groups ?? []),
      ...(raw?.areas?.['Taller especial 2']?.groups ?? []),
    ];
  }
  return [];
}

function normalizeLegacyCurrent(value) {
  if (AREA_CONFIG[value]) return value;
  for (const [area, aliases] of Object.entries(LEGACY_AREA_ALIASES)) {
    if (aliases.includes(value)) return area;
  }
  if (value === 'Taller especial 1' || value === 'Taller especial 2') return 'Talleres';
  return null;
}

export function migrateState(raw = {}) {
  const base = createInitialState();
  base.schoolName = typeof raw.schoolName === 'string' && raw.schoolName.trim() ? raw.schoolName : base.schoolName;
  base.current = normalizeLegacyCurrent(raw.current ?? raw.currentArea);

  for (const area of AREA_ORDER) {
    const config = AREA_CONFIG[area];
    const existing = legacyGroups(raw, area);
    base.areas[area].groups = Array.from({ length: config.count }, (_, index) => {
      const template = createGroup(area, index);
      const saved = existing[index] ?? {};
      const merged = {
        ...template,
        ...saved,
        id: typeof saved.id === 'string' && saved.id ? saved.id : template.id,
        area,
        kind: config.kind,
        items: unique(saved.items),
        type: config.kind === 'trunk' ? '' : (saved.type === 'Electivo' ? 'Electivo' : 'Obligatorio'),
        elective: saved.type === 'Electivo' || saved.elective === true,
      };

      if (saved.startPeriod != null && saved.startTerm == null) merged.startTerm = Number(saved.startPeriod);
      if (saved.endPeriod != null && saved.endTerm == null) merged.endTerm = Number(saved.endPeriod);

      if (config.kind === 'trunk') {
        const level = index + 1;
        const [startTerm, endTerm] = termsForLevel(level);
        Object.assign(merged, { level, startTerm, endTerm, duration: 'annual', fixed: true, type: '', elective: false });
        return merged;
      }

      if (config.kind === 'technical-workshop') {
        const level = config.fixedLevels[index] ?? index + 1;
        const [startTerm, endTerm] = termsForLevel(level);
        Object.assign(merged, { level, startTerm, endTerm, duration: 'annual', fixed: true });
        return merged;
      }

      const allowed = config.allowedTerms ?? PERIODS;
      const requested = Number(merged.startTerm);
      const fallback = config.defaultTerms?.[index] ?? null;
      const safeTerm = allowed.includes(requested) ? requested : fallback;
      Object.assign(merged, {
        startTerm: safeTerm,
        endTerm: safeTerm,
        level: safeTerm ? levelForTerm(safeTerm) : null,
        duration: 'period',
        fixed: false,
      });
      return merged;
    });
  }

  return base;
}

export function allGroups(state) {
  return AREA_ORDER.flatMap((area) =>
    (state.areas?.[area]?.groups ?? []).map((group) => ({ area, group })),
  );
}

export function findGroup(state, groupId) {
  return allGroups(state).find(({ group }) => group.id === groupId) ?? null;
}

export function moveContents(state, targetGroupId, contentIds) {
  const target = findGroup(state, targetGroupId);
  if (!target) throw new Error('El espacio de destino no existe.');
  const ids = unique(contentIds);
  target.group.items = unique([...(target.group.items ?? []), ...ids]);
  return target.group;
}

export const assignContents = moveContents;

export function removeContent(state, groupId, contentId) {
  const target = findGroup(state, groupId);
  if (!target) return;
  target.group.items = (target.group.items ?? []).filter((id) => String(id) !== String(contentId));
}

export function moveGroupToTerm(state, groupId, requestedTerm) {
  const target = findGroup(state, groupId);
  if (!target) throw new Error('El espacio que querés mover no existe.');
  const { group } = target;
  const allowed = allowedTermsForGroup(group);
  if (!allowed.length) throw new Error('Este espacio es anual y mantiene su ubicación fija.');
  const term = Number(requestedTerm);
  if (!allowed.includes(term)) {
    const label = allowed.length ? `C${allowed[0]}–C${allowed.at(-1)}` : 'su ubicación anual';
    throw new Error(`Este espacio solo puede ubicarse dentro de ${label}.`);
  }
  Object.assign(group, {
    startTerm: term,
    endTerm: term,
    level: levelForTerm(term),
  });
  return { group, swapped: null };
}

export function moveGroupToPeriod(state, groupId, period) {
  return moveGroupToTerm(state, groupId, period).group;
}

export function locationsForContent(state, contentId) {
  return allGroups(state)
    .filter(({ group }) => (group.items ?? []).includes(String(contentId)))
    .map(({ area, group }) => ({ area, groupId: group.id, groupName: group.name }));
}

export function matrixSlots(state) {
  return allGroups(state).flatMap(({ area, group }) => {
    if (!group.startTerm || !group.endTerm) return [];
    return Array.from({ length: group.endTerm - group.startTerm + 1 }, (_, offset) => ({
      area,
      period: group.startTerm + offset,
      group,
    }));
  });
}

function sameTerms(groups, expected) {
  const actual = groups.map((group) => group.startTerm).filter(Boolean).sort((a, b) => a - b);
  const wanted = [...expected].sort((a, b) => a - b);
  return JSON.stringify(actual) === JSON.stringify(wanted);
}

export function validateStructure(state) {
  const errors = [];

  for (const area of ['Lengua y Literatura', 'Matemática', 'Lenguas Adicionales']) {
    const groups = state.areas?.[area]?.groups ?? [];
    if (groups.length !== 6) errors.push(`${area} debe tener 6 niveles anuales.`);
    groups.forEach((group, index) => {
      const level = index + 1;
      const [startTerm, endTerm] = termsForLevel(level);
      if (group.startTerm !== startTerm || group.endTerm !== endTerm) {
        errors.push(`${area}: Nivel ${level} debe permanecer en C${startTerm}–C${endTerm}.`);
      }
    });
  }

  const natural = state.areas?.['Ciencias Naturales']?.groups ?? [];
  if (natural.length !== 6) errors.push('Ciencias Naturales debe tener 6 Espacios de Integración.');
  if (natural.some((group) => !C1_C8.includes(group.startTerm))) errors.push('Ciencias Naturales: los Espacios de Integración deben ubicarse entre C1 y C8.');

  const social = state.areas?.['Ciencias Sociales']?.groups ?? [];
  if (social.length !== 8) errors.push('Ciencias Sociales debe tener 8 Espacios de Integración.');
  if (social.some((group) => !C1_C8.includes(group.startTerm))) errors.push('Ciencias Sociales: los Espacios de Integración deben ubicarse entre C1 y C8.');

  const ef = state.areas?.['Educación Física']?.groups ?? [];
  if (ef.length !== 12 || !sameTerms(ef, C1_C12)) errors.push('Educación Física debe tener 12 Espacios Formativos, uno en cada período C1–C12.');

  const arts = state.areas?.['Educación Artística']?.groups ?? [];
  if (arts.length !== 2 || arts.some((group) => ![1, 2].includes(group.startTerm))) {
    errors.push('Educación Artística debe tener 2 Espacios Formativos y ambos deben permanecer en Nivel 1 (C1–C2).');
  }

  const representation = state.areas?.['Tecnología de la Representación']?.groups ?? [];
  if (representation.length !== 6) errors.push('Tecnología de la Representación debe tener 6 Espacios Formativos.');
  if (representation.some((group) => !C1_C6.includes(group.startTerm))) {
    errors.push('Tecnología de la Representación debe ubicarse únicamente en Niveles 1, 2 y 3 (C1–C6).');
  }

  const workshops = state.areas?.Talleres?.groups ?? [];
  if (workshops.length !== 2) errors.push('Talleres debe tener 2 espacios anuales.');
  workshops.forEach((group, index) => {
    const level = index + 1;
    const [startTerm, endTerm] = termsForLevel(level);
    if (group.startTerm !== startTerm || group.endTerm !== endTerm) {
      errors.push(`Talleres: el Taller de Nivel ${level} debe permanecer en C${startTerm}–C${endTerm}.`);
    }
  });

  return errors;
}