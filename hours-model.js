export const LEVEL_TERMS = Object.freeze({
  1: Object.freeze([1, 2]),
  2: Object.freeze([3, 4]),
  3: Object.freeze([5, 6]),
  4: Object.freeze([7, 8]),
  5: Object.freeze([9, 10]),
});

export function levelForTerm(term) {
  const value = Number(term);
  if (!Number.isInteger(value) || value < 1 || value > 10) return null;
  return Math.ceil(value / 2);
}

export function subjectHours(plan, subjectId, level) {
  const subject = plan?.subjects?.find((item) => item.id === subjectId);
  const value = subject?.hours?.[String(level)];
  return Number.isFinite(value) ? value : null;
}

export function totalLevelHours(plan, level) {
  return (plan?.subjects ?? []).reduce((total, subject) => {
    const value = subject?.hours?.[String(level)];
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
}

export function semesterBudget(plan, term) {
  const level = levelForTerm(term);
  if (!level) return null;
  const subjects = (plan?.subjects ?? [])
    .map((subject) => ({
      id: subject.id,
      name: subject.name,
      hours: subjectHours(plan, subject.id, level),
    }))
    .filter((subject) => subject.hours !== null);
  return {
    term: Number(term),
    level,
    totalHours: totalLevelHours(plan, level),
    subjects,
  };
}

export function subjectGroupHours(plan, level, subjectIds) {
  return subjectIds.reduce((total, subjectId) => {
    const value = subjectHours(plan, subjectId, level);
    return total + (value ?? 0);
  }, 0);
}
