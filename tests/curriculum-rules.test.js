import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ART_AXES,
  EF_NUCLEI,
  evaluateArts,
  evaluatePhysicalEducation,
} from '../curriculum-rules.js';

function group(id, items = []) {
  return { id, name: id, items };
}

test('Artes exige los tres ejes en cada taller sin restringir lenguajes', () => {
  const data = [
    { id: 'v-p', area: 'Artes', subject: 'Artes Visuales', axis: 'Eje: Producción', text: '' },
    { id: 'm-a', area: 'Artes', subject: 'Música', axis: 'Eje: Apreciación', text: '' },
    { id: 't-c', area: 'Artes', subject: 'Teatro', axis: 'Eje: Contextualización', text: '' },
  ];
  const state = {
    curriculumRules: { artLanguages: ['Artes Visuales'] },
    areas: { Artes: { groups: [group('Taller 1', ['v-p', 'm-a', 't-c'])] } },
  };
  const result = evaluateArts(state, data);
  assert.equal(result.complete, true);
  assert.equal(result.completeWorkshops, 1);
  assert.deepEqual(result.workshops[0].missingAxes, []);
});

test('Artes marca incompleto un taller cuando falta cualquiera de los tres ejes', () => {
  const data = [
    { id: 'p', area: 'Artes', subject: 'Música', axis: 'Eje: Producción', text: '' },
    { id: 'a', area: 'Artes', subject: 'Teatro', axis: 'Eje: Apreciación', text: '' },
  ];
  const state = { areas: { Artes: { groups: [group('Taller 1', ['p', 'a'])] } } };
  const result = evaluateArts(state, data);
  assert.equal(result.complete, false);
  assert.deepEqual(result.workshops[0].missingAxes, ['Contextualización']);
});

test('Artes reconoce exactamente los tres ejes curriculares definidos', () => {
  assert.deepEqual(ART_AXES, ['Producción', 'Apreciación', 'Contextualización']);
});

test('Educación Física exige un núcleo obligatorio en cada taller y cubrir los cinco núcleos', () => {
  const data = EF_NUCLEI.map((nucleus, index) => ({
    id: String(index + 1),
    area: 'Educación Física',
    subject: 'Educación Física',
    axis: ({
      'deportes-abiertos': 'Núcleo: DEPORTES ABIERTOS (voleibol, básquetbol)',
      'deportes-cerrados-atletismo': 'Núcleo: DEPORTES CERRADOS- ATLETISMO',
      'gimnasia-expresiones': 'Núcleo: GIMNASIA EN SUS DIFERENTES EXPRESIONES (artística, rítmica y expresiva)',
      'gimnasia-formacion-corporal': 'Núcleo: GIMNASIA PARA LA FORMACIÓN CORPORAL',
      juegos: 'Núcleo: JUEGOS',
    })[nucleus.id],
    text: nucleus.label,
  }));
  const state = {
    areas: {
      'Educación Física': {
        groups: data.map((content, index) => group(`Taller ${index + 1}`, [content.id])),
      },
    },
  };
  const result = evaluatePhysicalEducation(state, data);
  assert.equal(result.complete, true);
  assert.equal(result.completeWorkshops, 5);
  assert.equal(result.coveredNuclei.length, 5);
});

test('El ambiente natural es optativo y no reemplaza un núcleo obligatorio', () => {
  const data = [
    { id: 'natural', area: 'Educación Física', subject: 'Educación Física', axis: 'Experiencias en el ambiente natural', text: '' },
    { id: 'juegos', area: 'Educación Física', subject: 'Educación Física', axis: 'Núcleo: JUEGOS', text: '' },
  ];
  const state = {
    areas: {
      'Educación Física': {
        groups: [group('Taller 1', ['natural']), group('Taller 2', ['juegos'])],
      },
    },
  };
  const result = evaluatePhysicalEducation(state, data);
  assert.equal(result.workshops[0].complete, false);
  assert.equal(result.complete, false);
  assert.equal(result.coveredNuclei.length, 1);
});
