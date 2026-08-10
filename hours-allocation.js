import { levelForTerm, subjectHours, totalLevelHours } from './hours-model.js';

export const AREA_HOUR_SUBJECTS = Object.freeze({
  'Lengua y Literatura': Object.freeze(['lengua-literatura']),
  'Matemática': Object.freeze(['matematica']),
  'Lenguas Adicionales': Object.freeze(['lenguas-adicionales']),
  'Ciencias Sociales': Object.freeze(['fec', 'geografia', 'historia', 'economia', 'filosofia']),
  'Ciencias Naturales': Object.freeze([]),
  'Artes': Object.freeze(['artes']),
  'Tecnologías': Object.freeze(['tecnologia-informacion']),
  'Educación Física': Object.freeze(['educacion-fisica']),
  'Otros formatos pedagógicos': Object.freeze(['tecnologia-informacion', 'tutoria']),
});

const EPSILON = 1e-6;

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function allGroups(state) {
  return Object.entries(state?.areas ?? {}).flatMap(([area, areaState]) =>
    (areaState?.groups ?? []).map((group) => ({ area, group })),
  );
}

function findGroup(state, groupId) {
  return allGroups(state).find(({ group }) => group.id === groupId) ?? null;
}

export function activeTermsForGroup(group) {
  const start = Number(group?.startTerm);
  const end = Number(group?.endTerm ?? start);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > 10 || end < start) return [];
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function groupIsActiveInTerm(group, term) {
  const value = Number(term);
  return activeTermsForGroup(group).includes(value);
}

export function allowedSubjectIdsForGroup(plan, area, group) {
  const level = Number(group?.level) || levelForTerm(group?.startTerm);
  const ids = AREA_HOUR_SUBJECTS[area] ?? [];
  return ids.filter((subjectId) => subjectHours(plan, subjectId, level) !== null);
}

export function normalizeHoursState(raw = {}) {
  const allocations = {};
  for (const [groupId, subjectMap] of Object.entries(raw?.allocations ?? {})) {
    if (!subjectMap || typeof subjectMap !== 'object') continue;
    const clean = {};
    for (const [subjectId, value] of Object.entries(subjectMap)) {
      const hours = numberOrZero(value);
      if (hours > 0) clean[subjectId] = hours;
    }
    if (Object.keys(clean).length) allocations[groupId] = clean;
  }
  return { schemaVersion: 1, allocations };
}

export function allocationForGroupSubject(hoursState, groupId, subjectId) {
  return numberOrZero(hoursState?.allocations?.[groupId]?.[subjectId]);
}

export function setGroupSubjectHours(hoursState, groupId, subjectId, value) {
  hoursState.allocations ??= {};
  const hours = numberOrZero(value);
  const groupMap = { ...(hoursState.allocations[groupId] ?? {}) };
  if (hours > 0) groupMap[subjectId] = hours;
  else delete groupMap[subjectId];
  if (Object.keys(groupMap).length) hoursState.allocations[groupId] = groupMap;
  else delete hoursState.allocations[groupId];
  return hours;
}

export function automaticTrunkHours(plan, area, group) {
  if (group?.kind !== 'trunk') return {};
  const ids = allowedSubjectIdsForGroup(plan, area, group);
  const result = {};
  for (const subjectId of ids) {
    const hours = subjectHours(plan, subjectId, group.level);
    if (hours !== null) result[subjectId] = hours;
  }
  return result;
}

export function termHourStatus(plan, state, hoursState, term) {
  const value = Number(term);
  const level = levelForTerm(value);
  if (!level) return null;

  const budgetSubjects = (plan?.subjects ?? [])
    .map((subject) => ({
      id: subject.id,
      name: subject.name,
      budget: subjectHours(plan, subject.id, level),
    }))
    .filter((subject) => subject.budget !== null)
    .map((subject) => ({ ...subject, assigned: 0, sources: [] }));
  const byId = new Map(budgetSubjects.map((subject) => [subject.id, subject]));

  for (const { area, group } of allGroups(state)) {
    if (!groupIsActiveInTerm(group, value)) continue;
    if (group.kind === 'trunk') {
      for (const [subjectId, hours] of Object.entries(automaticTrunkHours(plan, area, group))) {
        const row = byId.get(subjectId);
        if (!row) continue;
        row.assigned += hours;
        row.sources.push({ area, groupId: group.id, groupName: group.name, hours, automatic: true });
      }
      continue;
    }

    for (const subjectId of allowedSubjectIdsForGroup(plan, area, group)) {
      const hours = allocationForGroupSubject(hoursState, group.id, subjectId);
      if (!hours) continue;
      const row = byId.get(subjectId);
      if (!row) continue;
      row.assigned += hours;
      row.sources.push({ area, groupId: group.id, groupName: group.name, hours, automatic: false });
    }
  }

  for (const row of budgetSubjects) {
    row.balance = row.budget - row.assigned;
    row.status = Math.abs(row.balance) <= EPSILON ? 'ok' : row.balance > 0 ? 'under' : 'over';
  }

  const totalBudget = totalLevelHours(plan, level);
  const totalAssigned = budgetSubjects.reduce((sum, subject) => sum + subject.assigned, 0);
  const totalBalance = totalBudget - totalAssigned;
  return {
    term: value,
    level,
    totalBudget,
    totalAssigned,
    totalBalance,
    complete: budgetSubjects.every((subject) => subject.status === 'ok'),
    subjects: budgetSubjects,
  };
}

export function maxAssignableHours(plan, state, hoursState, groupId, subjectId) {
  const found = findGroup(state, groupId);
  if (!found || found.group.kind === 'trunk') return 0;
  const terms = activeTermsForGroup(found.group);
  if (!terms.length) return 0;
  const current = allocationForGroupSubject(hoursState, groupId, subjectId);
  let maximum = Infinity;

  for (const term of terms) {
    const level = levelForTerm(term);
    const subjectBudget = subjectHours(plan, subjectId, level);
    if (subjectBudget === null) return 0;
    const status = termHourStatus(plan, state, hoursState, term);
    const row = status?.subjects?.find((subject) => subject.id === subjectId);
    if (!status || !row) return 0;

    const assignedByOthers = Math.max(0, row.assigned - current);
    const subjectRemaining = Math.max(0, subjectBudget - assignedByOthers);
    const totalAssignedWithoutCurrent = Math.max(0, status.totalAssigned - current);
    const levelRemaining = Math.max(0, status.totalBudget - totalAssignedWithoutCurrent);
    maximum = Math.min(maximum, subjectRemaining, levelRemaining);
  }

  return Number.isFinite(maximum) ? Math.max(0, maximum) : 0;
}

export function setGroupSubjectHoursCapped(plan, state, hoursState, groupId, subjectId, value) {
  const requested = numberOrZero(value);
  const maximum = maxAssignableHours(plan, state, hoursState, groupId, subjectId);
  const hours = Math.min(requested, maximum);
  setGroupSubjectHours(hoursState, groupId, subjectId, hours);
  return {
    requested,
    maximum,
    hours,
    clamped: requested > maximum + EPSILON,
  };
}

export function groupsForTerm(plan, state, hoursState, term) {
  const value = Number(term);
  return allGroups(state)
    .filter(({ group }) => groupIsActiveInTerm(group, value))
    .map(({ area, group }) => ({
      area,
      group,
      allowedSubjectIds: allowedSubjectIdsForGroup(plan, area, group),
      automatic: automaticTrunkHours(plan, area, group),
      allocations: { ...(hoursState?.allocations?.[group.id] ?? {}) },
    }));
}

export function levelOverview(plan, state, hoursState, level) {
  const terms = [Number(level) * 2 - 1, Number(level) * 2];
  return terms.map((term) => termHourStatus(plan, state, hoursState, term));
}
