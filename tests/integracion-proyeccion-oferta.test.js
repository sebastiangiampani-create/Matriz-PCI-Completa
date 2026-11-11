import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveAreaProjection, deriveFoProjection, deriveFoFormatSummary } from '../src/integracion-curricular/proyeccion-oferta-matriz.js';

const sample = () => ({
  socialOption: 'A',
  placements: {
    'socialA-c5': ['fg-3-historia', 'fg-3-economia'],
    'socialA-c6': ['fg-3-historia', 'fg-3-economia'],
    'naturales-c5': ['fg-3-biologia'],
    'foLab5-c9': ['fo-economia-5-0'],
  },
  valid: false,
});

test('La opción A de V2 proyecta 10 laboratorios de Sociales y dos en 3.º', () => {
  const view = deriveAreaProjection('Ciencias Sociales', sample());
  assert.equal(view.count, 10);
  assert.deepEqual(view.years.map(y=>y.count), [2, 2, 2, 2, 2]);
  assert.equal(view.years[2].groups.map(g=>g.slot).join(','), 'socialA-c5,socialA-c6');
  assert.equal(view.occupied, 2);
  assert.equal(view.distinctSubjects, 2);
  assert.equal(view.coveragePercent, null);
});

test('La opción B de V2 proyecta 12 laboratorios, dos por cuatrimestre en 3.º', () => {
  const original = sample();
  const before = JSON.stringify(original);
  const view = deriveAreaProjection('Ciencias Sociales', { ...original, socialOption: 'B' });
  assert.equal(view.count, 12);
  assert.deepEqual(view.years.map(y=>y.count), [2, 2, 4, 2, 2]);
  assert.deepEqual(view.years[2].groups.map(g=>g.slot),
    ['socialA-c5', 'socialB-c5', 'socialA-c6', 'socialB-c6']);
  assert.equal(JSON.stringify(original), before, 'No se modifica el mapa de origen');
});

test('Cada orientación mantiene su opción y sus materias sin contaminar otras', () => {
  const econ = sample(), science = {...sample(),socialOption:'B',placements:{'socialB-c5':['fg-3-geografia']}};
  const snapEcon=JSON.stringify(econ),snapScience=JSON.stringify(science);
  assert.equal(deriveAreaProjection('Ciencias Sociales', econ).count,10);
  assert.equal(deriveAreaProjection('Ciencias Sociales', science).count,12);
  assert.equal(deriveAreaProjection('Ciencias Sociales', econ).distinctSubjects,2);
  assert.equal(deriveAreaProjection('Ciencias Sociales', science).distinctSubjects,1);
  assert.equal(JSON.stringify(econ), snapEcon);
  assert.equal(JSON.stringify(science),snapScience);
});

test('Conserva la distribución prescripta de troncales, naturales y talleres', () => {
  for (const [area,count] of [
    ['Matemática',5],['Lengua y Literatura',5],['Lenguas Adicionales',5],
    ['Ciencias Naturales',10],['Artes',6],['Tecnologías',8],['Educación Física',10]
  ])assert.equal(deriveAreaProjection(area, sample()).count,count,area);
  assert.equal(deriveAreaProjection('Ciencias Naturales',sample()).occupied,1);
  assert.equal(deriveAreaProjection('Tecnologías',sample()).years[4].count,0);
  assert.equal(deriveAreaProjection('Artes',sample()).years[2].count,0);
  assert.equal(deriveAreaProjection('Artes',sample()).years[3].count,2);
});

test('La FO incluye formatos V2 por año sin inventar porcentajes', () => {
  const view=deriveFoProjection(sample());
  assert.deepEqual(view.map(y=>y.count),[2,2,5]);
  assert.equal(view[2].groups.find(g=>g.slot==='foLab5-c9').subjectIds.length,1);
  assert.equal(view[0].coveragePercent,null);
  assert.equal(view[0].groups.every(g=>g.format==='por definir'),true);
});

test('Datos inválidos no generan cobertura ficticia ni escriben el historial', () => {
  const missing=deriveAreaProjection('Ciencias Sociales', null);
  assert.equal(missing.count,10);
  assert.equal(missing.coveragePercent,null);
  assert.equal(missing.occupied,0);
  assert.equal(deriveAreaProjection('Área inexistente',{}),null);
  const map=sample();
  map.placements['socialA-c7']=['fg-4-historia','fg-4-historia'];
  assert.equal(deriveAreaProjection('Ciencias Sociales',map).years[3].groups[0].subjectIds.length,1);
});

test('La orientación se agrupa en 3 mosaicos: laboratorios, talleres y proyecto', () => {
  const data=sample();
  const before=JSON.stringify(data);
  const summaries=deriveFoFormatSummary(data);
  assert.deepEqual(summaries.map(item=>item.id), ['laboratorios','talleres','proyecto']);
  assert.deepEqual(summaries.map(item=>item.count), [2,2,1]);
  assert.equal(summaries[0].pendingDefinitions, 4);
  assert.equal(summaries[1].pendingDefinitions, 4);
  assert.equal(summaries[2].groups[0].slot, 'proyecto-n5');
  assert.equal(summaries[2].year,5);
  assert.equal(JSON.stringify(data),before,'El agrupamiento visual no cambia el mapa original');
});

test('La distribución por formato sigue los años y materias de la orientación', () => {
  const data=sample();
  data.foTypes = {'3': {'5':'lab','6':'taller'}, '4': {'7':'taller','8':'lab'}};
  data.placements['foN3-c5']=['fo-economia-3-0'];
  data.placements['proyecto-n5']=['fo-economia-5-0'];
  const summaries=deriveFoFormatSummary(data);
  assert.deepEqual(summaries.map(item=>item.count),[4,4,1]);
  assert.equal(summaries[0].pendingDefinitions,0);
  assert.equal(summaries[0].groups.find(group=>group.slot==='foN3-c5').subjectIds.length,1);
  assert.equal(summaries[2].occupied,1);
  assert.deepEqual(summaries[2].years.map(item=>item.year),[5]);
  assert.equal(summaries[0].coveragePercent,null);
});
