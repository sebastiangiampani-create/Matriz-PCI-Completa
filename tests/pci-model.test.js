import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addOtherFormat,
  AREA_CONFIG,
  migrateState,
  moveContents,
  moveGroupToTerm,
  setOtherDuration,
  termsForLevel,
  validateStructure,
} from '../pci-model.js';

test('cada nivel ocupa exactamente dos cuatrimestres del mismo año', () => {
  assert.deepEqual(termsForLevel(1), [1, 2]);
  assert.deepEqual(termsForLevel(3), [5, 6]);
  assert.deepEqual(termsForLevel(5), [9, 10]);
});

test('la estructura inicial crea 10 laboratorios naturales y 12 sociales', () => {
  const state = migrateState({});
  assert.deepEqual(
    state.areas['Ciencias Naturales'].groups.map((group) => group.startTerm),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.deepEqual(
    state.areas['Ciencias Sociales'].groups.map((group) => group.startTerm),
    [1, 2, 3, 4, 5, 6, 6, 7, 7, 8, 9, 10],
  );
  assert.deepEqual(validateStructure(state), []);
});

test('todos los talleres aparecen ubicados en la matriz desde el inicio', () => {
  const state = migrateState({});
  assert.deepEqual(
    state.areas['Educación Física'].groups.map((group) => group.startTerm),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.deepEqual(
    state.areas.Tecnologías.groups.map((group) => group.startTerm),
    [1, 2, 3, 4, 5, 6],
  );
});

test('la migración preserva laboratorios existentes y completa los faltantes', () => {
  const existing = Array.from({ length: 9 }, (_, index) => ({
    name: `Laboratorio existente ${index + 1}`,
    term: String(index + 1),
    items: [`contenido-${index + 1}`],
  }));
  const state = migrateState({ areas: { 'Ciencias Naturales': { groups: existing } } });
  assert.equal(state.areas['Ciencias Naturales'].groups[0].name, 'Laboratorio existente 1');
  assert.equal(state.areas['Ciencias Naturales'].groups[9].startTerm, 10);
});

test('completar simultáneos sociales no desplaza laboratorios ya guardados', () => {
  const existing = Array.from({ length: 10 }, (_, index) => ({
    name: `Social C${index + 1}`,
    term: String(index + 1),
    items: [`social-${index + 1}`],
  }));
  const state = migrateState({ areas: { 'Ciencias Sociales': { groups: existing } } });
  const c7 = state.areas['Ciencias Sociales'].groups.filter((group) => group.startTerm === 7);
  assert.equal(c7.length, 2);
  assert.equal(c7[0].name, 'Social C7');
  assert.deepEqual(c7[0].items, ['social-7']);
});

test('la migración reconoce termStart y normaliza clases antiguas', () => {
  const state = migrateState({
    areas: {
      'Ciencias Naturales': {
        groups: [{
          name: 'Laboratorio migrado',
          kind: 'espacio_formativo_alternativo',
          termStart: 4,
          items: ['natural-4'],
        }],
      },
    },
  });
  const group = state.areas['Ciencias Naturales'].groups.find((item) => item.startTerm === 4);
  assert.equal(group.name, 'Laboratorio migrado');
  assert.equal(group.kind, 'laboratory');
  assert.deepEqual(group.items, ['natural-4']);
});

test('mover contenidos reasigna sin duplicar dentro de la misma bolsa', () => {
  const state = migrateState({});
  const [first, second] = state.areas.Tecnologías.groups;
  first.items = ['c1', 'c2'];
  moveContents(state, second.id, ['c1', 'c2']);
  assert.deepEqual(first.items, []);
  assert.deepEqual(second.items, ['c1', 'c2']);

  const other = addOtherFormat(state);
  moveContents(state, other.id, ['c1']);
  assert.deepEqual(second.items, ['c2']);
  assert.deepEqual(other.items, ['c1']);
  assert.equal(AREA_CONFIG['Otros formatos pedagógicos'].sourceArea, 'Tecnologías');
});

test('la migración elimina duplicados previos sin afectar otras bolsas', () => {
  const state = migrateState({
    areas: {
      Tecnologías: { groups: [{ items: ['c1'] }, { items: ['c1', 'c2'] }] },
      Artes: { groups: [{ items: ['c1'] }] },
    },
  });
  assert.deepEqual(state.areas.Tecnologías.groups[0].items, ['c1']);
  assert.deepEqual(state.areas.Tecnologías.groups[1].items, ['c2']);
  assert.deepEqual(state.areas.Artes.groups[0].items, ['c1']);
});

test('un formato anual siempre ocupa un nivel completo', () => {
  const state = migrateState({});
  const other = addOtherFormat(state);
  setOtherDuration(other, 'annual', 4);
  assert.deepEqual([other.startTerm, other.endTerm], [7, 8]);
  setOtherDuration(other, 'quarterly', 7);
  assert.deepEqual([other.startTerm, other.endTerm], [7, 7]);
});

test('la migración reconoce la ubicación temporal y sinopsis de formatos anteriores', () => {
  const state = migrateState({
    areas: {
      Tecnologías: {
        groups: [{
          id: 'formato-anterior',
          kind: 'otro_formato_pedagogico',
          formatType: 'Proyecto',
          termStart: 5,
          termEnd: 6,
          context: 'Sinopsis ya guardada',
          items: ['c10'],
        }],
      },
    },
  });
  const [format] = state.areas['Otros formatos pedagógicos'].groups;
  assert.equal(format.duration, 'annual');
  assert.deepEqual([format.startTerm, format.endTerm], [5, 6]);
  assert.equal(format.synopsis, 'Sinopsis ya guardada');
  assert.deepEqual(format.items, ['c10']);
});

test('mover un laboratorio natural intercambia posiciones y conserva C1-C10', () => {
  const state = migrateState({});
  const first = state.areas['Ciencias Naturales'].groups[0];
  const fifth = state.areas['Ciencias Naturales'].groups[4];
  const result = moveGroupToTerm(state, first.id, 5);
  assert.equal(first.startTerm, 5);
  assert.equal(fifth.startTerm, 1);
  assert.equal(result.swapped.id, fifth.id);
  assert.deepEqual(validateStructure(state), []);
});

test('mover un laboratorio social conserva los dos simultáneos C6 y C7', () => {
  const state = migrateState({});
  const first = state.areas['Ciencias Sociales'].groups.find((group) => group.startTerm === 1);
  moveGroupToTerm(state, first.id, 6);
  assert.equal(state.areas['Ciencias Sociales'].groups.filter((group) => group.startTerm === 6).length, 2);
  assert.equal(state.areas['Ciencias Sociales'].groups.filter((group) => group.startTerm === 1).length, 1);
  assert.deepEqual(validateStructure(state), []);
});

test('mover un formato anual desde C6 lo ajusta al nivel C5-C6', () => {
  const state = migrateState({});
  const other = addOtherFormat(state);
  setOtherDuration(other, 'annual', 1);
  moveGroupToTerm(state, other.id, 6);
  assert.deepEqual([other.startTerm, other.endTerm], [5, 6]);
});
