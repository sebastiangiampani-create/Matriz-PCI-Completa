import test from 'node:test';
import assert from 'node:assert/strict';
import {
  migrateState,
  moveContents,
  moveGroupToTerm,
  validateStructure,
} from '../pci-model-overrides.js';

test('Sociales tiene simultaneidad doble en C5 y C6', () => {
  const state = migrateState({});
  assert.deepEqual(
    state.areas['Ciencias Sociales'].groups.map((group) => group.startTerm),
    [1, 2, 3, 4, 5, 5, 6, 6, 7, 8, 9, 10],
  );
  assert.deepEqual(validateStructure(state), []);
});

test('un contenido puede formar parte de más de un espacio', () => {
  const state = migrateState({});
  const [first, second] = state.areas.Tecnologías.groups;
  moveContents(state, first.id, ['contenido-1']);
  moveContents(state, second.id, ['contenido-1']);
  assert.deepEqual(first.items, ['contenido-1']);
  assert.deepEqual(second.items, ['contenido-1']);
});

test('la migración conserva un mismo contenido asignado a distintos espacios', () => {
  const state = migrateState({
    areas: {
      Tecnologías: {
        groups: [
          { items: ['contenido-repetido'] },
          { items: ['contenido-repetido'] },
        ],
      },
    },
  });
  assert.deepEqual(state.areas.Tecnologías.groups[0].items, ['contenido-repetido']);
  assert.deepEqual(state.areas.Tecnologías.groups[1].items, ['contenido-repetido']);
});

test('mover un laboratorio social conserva dos espacios en C5 y dos en C6', () => {
  const state = migrateState({});
  const first = state.areas['Ciencias Sociales'].groups.find((group) => group.startTerm === 1);
  moveGroupToTerm(state, first.id, 5);
  assert.equal(state.areas['Ciencias Sociales'].groups.filter((group) => group.startTerm === 5).length, 2);
  assert.equal(state.areas['Ciencias Sociales'].groups.filter((group) => group.startTerm === 6).length, 2);
  assert.equal(state.areas['Ciencias Sociales'].groups.filter((group) => group.startTerm === 1).length, 1);
  assert.deepEqual(validateStructure(state), []);
});
