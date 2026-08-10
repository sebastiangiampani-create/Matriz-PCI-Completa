import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  allowedSubjectIdsForGroup,
  groupsForTerm,
  maxAssignableHours,
  normalizeHoursState,
  setGroupSubjectHours,
  setGroupSubjectHoursCapped,
  termHourStatus,
} from '../hours-allocation.js';

const plan = JSON.parse(readFileSync(new URL('../data/plan-horas.json', import.meta.url), 'utf8'));

function group(id, kind, level, startTerm, endTerm = startTerm) {
  return { id, kind, name: id, level, startTerm, endTerm, items: [] };
}

function stateForLevelOne() {
  return {
    areas: {
      'Lengua y Literatura': { groups: [group('lengua-n1', 'trunk', 1, 1, 2)] },
      Matemática: { groups: [group('matematica-n1', 'trunk', 1, 1, 2)] },
      'Lenguas Adicionales': { groups: [group('lenguas-n1', 'trunk', 1, 1, 2)] },
      'Ciencias Sociales': { groups: [group('sociales-c1', 'laboratory', 1, 1)] },
      'Ciencias Naturales': { groups: [group('naturales-c1', 'laboratory', 1, 1)] },
      Artes: { groups: [group('artes-c1', 'workshop', 1, 1)] },
      Tecnologías: { groups: [group('tec-c1', 'workshop', 1, 1)] },
      'Educación Física': { groups: [group('ef-c1', 'workshop', 1, 1)] },
      'Otros formatos pedagógicos': { groups: [group('otro-c1', 'other', 1, 1)] },
    },
  };
}

test('el plan repite el presupuesto completo en cada cuatrimestre del nivel', () => {
  const state = stateForLevelOne();
  const hours = normalizeHoursState({});
  const c1 = termHourStatus(plan, state, hours, 1);
  const c2 = termHourStatus(plan, state, hours, 2);
  assert.equal(c1.totalBudget, 36);
  assert.equal(c2.totalBudget, 36);
  assert.equal(c1.totalAssigned, 14);
  assert.equal(c2.totalAssigned, 14);
});

test('los troncales heredan automáticamente sus horas del plan', () => {
  const status = termHourStatus(plan, stateForLevelOne(), normalizeHoursState({}), 1);
  assert.equal(status.subjects.find((row) => row.id === 'lengua-literatura').assigned, 5);
  assert.equal(status.subjects.find((row) => row.id === 'matematica').assigned, 5);
  assert.equal(status.subjects.find((row) => row.id === 'lenguas-adicionales').assigned, 4);
});

test('C1 puede cerrar 36/36 distribuyendo contenedores sin mezclar Tutoría con Tecnología', () => {
  const state = stateForLevelOne();
  const hours = normalizeHoursState({});
  for (const [groupId, subjectId, value] of [
    ['sociales-c1', 'fec', 2],
    ['sociales-c1', 'geografia', 3],
    ['sociales-c1', 'historia', 4],
    ['naturales-c1', 'biologia', 4],
    ['artes-c1', 'artes', 3],
    ['tec-c1', 'tecnologia-informacion', 2],
    ['ef-c1', 'educacion-fisica', 3],
    ['otro-c1', 'tutoria', 1],
  ]) setGroupSubjectHours(hours, groupId, subjectId, value);

  const status = termHourStatus(plan, state, hours, 1);
  assert.equal(status.totalAssigned, 36);
  assert.equal(status.complete, true);
  assert.equal(status.subjects.find((row) => row.id === 'biologia').assigned, 4);
  assert.equal(status.subjects.find((row) => row.id === 'tecnologia-informacion').assigned, 2);
  assert.equal(status.subjects.find((row) => row.id === 'tutoria').assigned, 1);
});

test('Otros formatos permite Tutoría en N1-N2 y Tecnología solo en N3-N4', () => {
  const area = 'Otros formatos pedagógicos';
  assert.deepEqual(allowedSubjectIdsForGroup(plan, area, group('otro-n1', 'other', 1, 1)), ['tutoria']);
  assert.deepEqual(allowedSubjectIdsForGroup(plan, area, group('otro-n2', 'other', 2, 3)), ['tutoria']);
  assert.deepEqual(allowedSubjectIdsForGroup(plan, area, group('otro-n3', 'other', 3, 5)), ['tecnologia-informacion']);
  assert.deepEqual(allowedSubjectIdsForGroup(plan, area, group('otro-n4', 'other', 4, 7)), ['tecnologia-informacion']);
  assert.deepEqual(allowedSubjectIdsForGroup(plan, area, group('otro-n5', 'other', 5, 9)), []);
});

test('Tecnología comparte presupuesto con Otros formatos únicamente en Nivel 3 o 4', () => {
  const state = {
    areas: {
      Tecnologías: { groups: [group('tec-c5', 'workshop', 3, 5)] },
      'Otros formatos pedagógicos': { groups: [group('otro-c5', 'other', 3, 5)] },
    },
  };
  const hours = normalizeHoursState({});
  setGroupSubjectHours(hours, 'tec-c5', 'tecnologia-informacion', 1.5);
  assert.equal(maxAssignableHours(plan, state, hours, 'otro-c5', 'tecnologia-informacion'), 0.5);
  const result = setGroupSubjectHoursCapped(plan, state, hours, 'otro-c5', 'tecnologia-informacion', 4);
  assert.deepEqual(result, { requested: 4, maximum: 0.5, hours: 0.5, clamped: true });
  const row = termHourStatus(plan, state, hours, 5).subjects.find((subject) => subject.id === 'tecnologia-informacion');
  assert.equal(row.assigned, 2);
  assert.equal(row.status, 'ok');
});

test('Tecnología queda bloqueada en Otros formatos de Nivel 1', () => {
  const state = stateForLevelOne();
  const hours = normalizeHoursState({});
  assert.equal(maxAssignableHours(plan, state, hours, 'otro-c1', 'tecnologia-informacion'), 0);
  const result = setGroupSubjectHoursCapped(plan, state, hours, 'otro-c1', 'tecnologia-informacion', 2);
  assert.equal(result.hours, 0);
  assert.equal(result.clamped, true);
});

test('el máximo cambia según el nivel del espacio', () => {
  const state = { areas: { Artes: { groups: [group('artes-c7', 'workshop', 4, 7)] } } };
  const hours = normalizeHoursState({});
  const result = setGroupSubjectHoursCapped(plan, state, hours, 'artes-c7', 'artes', 10);
  assert.equal(result.maximum, 2);
  assert.equal(result.hours, 2);
  assert.equal(termHourStatus(plan, state, hours, 7).subjects.find((row) => row.id === 'artes').assigned, 2);
});

test('Artes no se muestra en N3 ni N5 cuando el plan no tiene carga', () => {
  const state = {
    areas: {
      Artes: { groups: [
        group('artes-c5', 'workshop', 3, 5),
        group('artes-c7', 'workshop', 4, 7),
        group('artes-c9', 'workshop', 5, 9),
      ] },
    },
  };
  const hours = normalizeHoursState({});
  assert.equal(groupsForTerm(plan, state, hours, 5).some((item) => item.area === 'Artes'), false);
  assert.equal(groupsForTerm(plan, state, hours, 7).some((item) => item.area === 'Artes'), true);
  assert.equal(groupsForTerm(plan, state, hours, 9).some((item) => item.area === 'Artes'), false);
});

test('una asignación anual consume la misma carga semanal en ambos cuatrimestres', () => {
  const state = stateForLevelOne();
  state.areas['Otros formatos pedagógicos'].groups[0] = group('tutoria-anual', 'other', 1, 1, 2);
  const hours = normalizeHoursState({});
  setGroupSubjectHours(hours, 'tutoria-anual', 'tutoria', 1);
  assert.equal(termHourStatus(plan, state, hours, 1).subjects.find((row) => row.id === 'tutoria').assigned, 1);
  assert.equal(termHourStatus(plan, state, hours, 2).subjects.find((row) => row.id === 'tutoria').assigned, 1);
});

test('Ciencias Naturales conserva C10 y Química se traba en 4 horas en Nivel 5', () => {
  const state = {
    areas: {
      'Ciencias Naturales': { groups: [group('naturales-c10', 'laboratory', 5, 10)] },
    },
  };
  const hours = normalizeHoursState({});
  const active = groupsForTerm(plan, state, hours, 10);
  assert.equal(active.length, 1);
  assert.equal(active[0].area, 'Ciencias Naturales');
  assert.equal(active[0].group.startTerm, 10);
  assert.deepEqual(active[0].allowedSubjectIds, ['quimica']);
  const result = setGroupSubjectHoursCapped(plan, state, hours, 'naturales-c10', 'quimica', 10);
  assert.equal(result.maximum, 4);
  assert.equal(result.hours, 4);
});

test('C5 ofrece Biología y Físico-Química con presupuesto total de 7 horas', () => {
  const state = {
    areas: {
      'Ciencias Naturales': { groups: [group('naturales-c5', 'laboratory', 3, 5)] },
    },
  };
  const active = groupsForTerm(plan, state, normalizeHoursState({}), 5);
  assert.deepEqual(active[0].allowedSubjectIds, ['biologia', 'fisico-quimica']);
  assert.equal(termHourStatus(plan, state, normalizeHoursState({}), 5).totalBudget, 32);
});
