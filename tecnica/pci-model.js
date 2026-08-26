export const PERIODS = Array.from({ length: 12 }, (_, index) => index + 1);

export const LEVELS = Array.from({ length: 6 }, (_, index) => ({
  number: index + 1,
  startPeriod: index * 2 + 1,
  endPeriod: index * 2 + 2,
}));

export const TECHNICAL_PROFILE = {
  id: 'tecnica',
  label: 'Escuela Tecnica',
  levels: 6,
  periods: 12,
};

export const AREA_CONFIG = {
  'Lengua y Literatura': { kind: 'annual', count: 6, singular: 'Nivel' },
  Matematica: { kind: 'annual', count: 6, singular: 'Nivel' },
  'Lenguas Adicionales': { kind: 'annual', count: 6, singular: 'Nivel' },
  'Ciencias Naturales': { kind: 'integration', count: 6, singular: 'Espacio de Integracion' },
  'Ciencias Sociales': { kind: 'integration', count: 8, singular: 'Espacio de Integracion' },
  'Educacion Fisica': {
    kind: 'formative',
    count: 12,
    singular: 'Espacio Formativo',
    defaultPeriods: PERIODS,
  },
  Artes: { kind: 'formative', count: 2, singular: 'Espacio Formativo' },
  'Tecnologia de la Representacion': { kind: 'formative', count: 6, singular: 'Espacio Formativo' },
  'Taller especial 1': { kind: 'special-workshop', count: 1, singular: 'Taller', pendingDefinition: true },
  'Taller especial 2': { kind: 'special-workshop', count: 1, singular: 'Taller', pendingDefinition: true },
};

export const AREA_ORDER = Object.keys(AREA_CONFIG);

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

export function levelForPeriod(period) {
  const value = Number(period);
  if (!Number.isInteger(value) || value < 1 || value > 12) return null;
  return Math.ceil(value / 2);
}

export function periodsForLevel(levelNumber) {
  const level = LEVELS.find((item) => item.number === Number(levelNumber));
  return level ? [level.startPeriod, level.endPeriod] : [1, 2];
}

function createGroup(area, index) {
  const config = AREA_CONFIG[area];
  const kind = config.kind;
  const group = {
    id: `${slug(area)}-${kind}-${index + 1}`,
    area,
    kind,
    name: kind === 'annual' ? `Nivel ${index + 1}` : `${config.singular} ${index + 1}`,
    objective: '',
    synopsis: '',
    context: '',
    practiceAxis: '',
    type: 'Obligatorio',
    items: [],
    level: null,
    startPeriod: null,
    endPeriod: null,
    duration: kind === 'annual' ? 'annual' : 'period',
    pendingDefinition: Boolean(config.pendingDefinition),
  };

  if (kind === 'annual') {
    const level = index + 1;
    const [startPeriod, endPeriod] = periodsForLevel(level);
    Object.assign(group, { level, startPeriod, endPeriod });
  } else if (Array.isArray(config.defaultPeriods)) {
    const period = config.defaultPeriods[index] ?? null;
    Object.assign(group, {
      level: levelForPeriod(period),
      startPeriod: period,
      endPeriod: period,
    });
  }

  return group;
}

export function createInitialState() {
  return {
    schemaVersion: 1,
    profile: 'tecnica',
    schoolName: 'Escuela Tecnica',
    currentArea: null,
    areas: Object.fromEntries(
      AREA_ORDER.map((area) => [
        area,
        {
          groups: Array.from({ length: AREA_CONFIG[area].count }, (_, index) => createGroup(area, index)),
        },
      ]),
    ),
  };
}

export function migrateState(raw = {}) {
  const base = createInitialState();
  base.schoolName = typeof raw.schoolName === 'string' && raw.schoolName.trim() ? raw.schoolName : base.schoolName;
  base.currentArea = AREA_CONFIG[raw.currentArea] ? raw.currentArea : null;

  for (const area of AREA_ORDER) {
    const existing = raw?.areas?.[area]?.groups;
    if (!Array.isArray(existing)) continue;
    const config = AREA_CONFIG[area];
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
        type: saved.type === 'Electivo' ? 'Electivo' : 'Obligatorio',
        pendingDefinition: Boolean(config.pendingDefinition),
      };

      if (config.kind === 'annual') {
        const level = index + 1;
        const [startPeriod, endPeriod] = periodsForLevel(level);
        Object.assign(merged, { level, startPeriod, endPeriod, duration: 'annual' });
      } else if (config.pendingDefinition) {
        Object.assign(merged, { startPeriod: null, endPeriod: null, level: null });
      } else {
        const p = Number(merged.startPeriod);
        const safePeriod = Number.isInteger(p) && p >= 1 && p <= 12 ? p : template.startPeriod;
        Object.assign(merged, {
          startPeriod: safePeriod,
          endPeriod: safePeriod,
          level: levelForPeriod(safePeriod),
          duration: 'period',
        });
      }
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

export function assignContents(state, targetGroupId, contentIds) {
  const target = findGroup(state, targetGroupId);
  if (!target) throw new Error('El espacio de destino no existe.');
  const ids = unique(contentIds);
  const moving = new Set(ids);

  for (const { group } of allGroups(state)) {
    group.items = group.items.filter((id) => !moving.has(String(id)));
  }
  target.group.items = unique([...target.group.items, ...ids]);
  return target.group;
}

export function removeContent(state, groupId, contentId) {
  const target = findGroup(state, groupId);
  if (!target) return;
  target.group.items = target.group.items.filter((id) => String(id) !== String(contentId));
}

export function moveGroupToPeriod(state, groupId, period) {
  const target = findGroup(state, groupId);
  if (!target) throw new Error('El espacio no existe.');
  if (target.group.kind === 'annual') throw new Error('Los espacios anuales mantienen sus dos periodos por nivel.');
  if (target.group.pendingDefinition) throw new Error('Este taller esta pendiente de definicion y todavia no tiene ubicacion temporal.');
  const value = Number(period);
  if (!Number.isInteger(value) || value < 1 || value > 12) throw new Error('Periodo invalido.');
  Object.assign(target.group, {
    startPeriod: value,
    endPeriod: value,
    level: levelForPeriod(value),
  });
  return target.group;
}

export function locationsForContent(state, contentId) {
  return allGroups(state)
    .filter(({ group }) => group.items.includes(String(contentId)))
    .map(({ area, group }) => ({ area, groupId: group.id, groupName: group.name }));
}

export function matrixSlots(state) {
  return allGroups(state).flatMap(({ area, group }) => {
    if (!group.startPeriod || !group.endPeriod) return [];
    return Array.from({ length: group.endPeriod - group.startPeriod + 1 }, (_, offset) => ({
      area,
      period: group.startPeriod + offset,
      group,
    }));
  });
}
