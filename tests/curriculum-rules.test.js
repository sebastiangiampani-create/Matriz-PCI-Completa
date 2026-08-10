import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ART_AXES,
  ART_LANGUAGES,
  EF_NUCLEI,
  evaluateArts,
  evaluatePhysicalEducation,
} from '../curriculum-rules.js';

function group(id, items = []) {
  return { id, name: id, items };
}

test('Artes exige exactamente dos lenguajes y los tres ejes en cada taller', () => {
  const data = [];
  let id = 1;
  for (const language of ART_LANGUAGES) {
    for (const axis of ART_AXES) {
      data.push({ id: String(id++), area: 'Artes', subject: language, axis: `Eje: ${axis}`, text: `${language} ${axis}` });
    }
  }
  const state = {
    curriculumRules: { artLanguages: ['Artes Visuales', 'Música'] },
    areas: {
      Artes: {
        groups: [
          group('Taller 1', ['1', '2', '3']),
          group('Taller 2', ['4', '5', '6']),
        ],
      },
    },
  };
  const result = evaluateArts(state, data);
  assert.equal(result.complete, true);
  assert.equal(result.completeWorkshops, 2);
  assert.deepEqual(result.selectedLanguages, ['Artes Visuales', 'Música']);
});

test('Artes no cuenta contenidos del tercer lenguaje para completar un eje', () => {
  const data = [
    { id: 'v-p', area: 'Artes', subject: 'Artes Visuales', axis: 'Eje: Producción', text: '' },
    { id: 'm-a', area: 'Artes', subject: 'Música', axis: 'Eje: Apreciación', text: '' },
    { id: 't-c', area: 'Artes', subject: 'Teatro', axis: 'Eje: Contextualización', text: '' },
  ];
  const state = {
    curriculumRules: { artLanguages: ['Artes Visuales', 'Música'] },
    areas: { Artes: { groups: [group('Taller 1', ['v-p', 'm-a', 't-c'])] } },
  };
  const result = evaluateArts(state, data);
  assert.equal(result.complete, false);
  assert.deepEqual(result.workshops[0].missingAxes, ['Contextualización']);
  assert.equal(result.unselectedAssignments.length, 1);
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
