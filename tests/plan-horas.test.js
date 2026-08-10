import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  LEVEL_TERMS,
  levelForTerm,
  semesterBudget,
  subjectGroupHours,
  subjectHours,
  totalLevelHours,
} from '../hours-model.js';

const plan = JSON.parse(await readFile(new URL('../data/plan-horas.json', import.meta.url), 'utf8'));

test('cada nivel corresponde a dos cuatrimestres consecutivos', () => {
  assert.deepEqual(LEVEL_TERMS, {
    1: [1, 2],
    2: [3, 4],
    3: [5, 6],
    4: [7, 8],
    5: [9, 10],
  });
  assert.equal(levelForTerm(1), 1);
  assert.equal(levelForTerm(6), 3);
  assert.equal(levelForTerm(10), 5);
});

test('la carga semanal del nivel se repite completa en cada cuatrimestre', () => {
  const expectedTotals = { 1: 32, 2: 32, 3: 25, 4: 24, 5: 16 };
  for (const [level, terms] of Object.entries(LEVEL_TERMS)) {
    assert.equal(totalLevelHours(plan, level), expectedTotals[level]);
    for (const term of terms) {
      assert.equal(semesterBudget(plan, term).totalHours, expectedTotals[level]);
    }
  }
});

test('Tutoría integra el plan solo en Nivel 1 y Nivel 2', () => {
  assert.equal(subjectHours(plan, 'tutoria', 1), 1);
  assert.equal(subjectHours(plan, 'tutoria', 2), 1);
  assert.equal(subjectHours(plan, 'tutoria', 3), null);
  assert.equal(subjectHours(plan, 'tutoria', 4), null);
  assert.equal(subjectHours(plan, 'tutoria', 5), null);
});

test('el paquete social de Nivel 3 suma 9 horas semanales en C5 y C6', () => {
  const sociales = ['fec', 'geografia', 'historia', 'economia'];
  assert.equal(subjectGroupHours(plan, 3, sociales), 9);
  assert.equal(semesterBudget(plan, 5).level, 3);
  assert.equal(semesterBudget(plan, 6).level, 3);
});
