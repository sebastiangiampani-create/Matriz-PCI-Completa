import test from 'node:test';
import assert from 'node:assert/strict';
import { migrarLegadoFgAV2 } from '../src/migracion/legado-fg-a-v2.mjs';

const matriz = [
  { id: 'm1', area: 'Matemática', subject: 'Matemática', axis: 'Números', text: 'Operaciones con números racionales' },
  { id: 'm2', area: 'Ciencias Sociales', subject: 'Historia', axis: 'Historia', text: 'Construcción histórica de la ciudadanía' },
  { id: 'm3', area: 'Ciencias Sociales', subject: 'Geografía', axis: 'Territorio', text: 'Procesos urbanos del territorio nacional' },
  { id: 'm4', area: 'Matemática', subject: 'Matemática', axis: 'Números', text: 'Texto anterior que no coincide' }
];
const v2 = [
  { id: 'fg-v2-1', component: 'FG', year: 1, area: 'Matemática', subject: 'Matemática', axis: 'Números', text: 'Operaciones con números racionales' },
  { id: 'fg-v2-2', component: 'FG', year: 3, area: 'Ciencias Sociales', subject: 'Historia', axis: 'Historia', text: 'Construcción histórica de la ciudadanía' },
  { id: 'fg-v2-3', component: 'FG', year: 3, area: 'Ciencias Sociales', subject: 'Geografía', axis: 'Territorio', text: 'Procesos urbanos del territorio nacional' }
];
const grupo = (id, level, items, extra = {}) => ({
  id, level, name: `Agrupamiento ${id}`, items, plansBimestrales: [], ...extra
});
const ejecutar = (areas, extra = {}) => migrarLegadoFgAV2({
  legacyState: { areas }, matrixRows: matriz, v2FgRows: v2,
  model: 'media', orientationId: 'sociales', ...extra
});

test('troncal del año N usa el slot anual y los IDs reales de materia y contenido', () => {
  const r = ejecutar({ 'Matemática': { groups: [grupo('mat-1', 1, ['m1'])] } });
  assert.deepEqual(r.placements['matematica-n1'], ['fg-1-matematica']);
  assert.deepEqual(r.groups['matematica-n1'].contents, ['fg-v2-1']);
  assert.equal(r.groups['matematica-n1'].legacyGroupId, 'mat-1');
  assert.equal(r.resumen.contenidosDirectos, 1);
  assert.equal(r.resumen.aprobacionesAutomaticasNuevas, 0);
});

test('área con un agrupamiento ocupa solamente el primer cuatrimestre del año', () => {
  const r = ejecutar({ 'Ciencias Sociales': { groups: [grupo('s1', 3, ['m2'])] } });
  assert.deepEqual(r.placements['socialA-c5'], ['fg-3-historia']);
  assert.deepEqual(r.groups['socialA-c5'].contents, ['fg-v2-2']);
  assert.equal(r.groups['socialA-c6'], undefined);
});

test('área con dos agrupamientos los ubica en ambos cuatrimestres, sin mezclar sus contenidos', () => {
  const r = ejecutar({ 'Ciencias Sociales': { groups: [
    grupo('s1', 3, ['m2']), grupo('s2', 3, ['m3'])
  ] } });
  assert.deepEqual(r.placements['socialA-c5'], ['fg-3-historia']);
  assert.deepEqual(r.placements['socialA-c6'], ['fg-3-geografia']);
  assert.deepEqual(r.groups['socialA-c5'].contents, ['fg-v2-2']);
  assert.deepEqual(r.groups['socialA-c6'].contents, ['fg-v2-3']);
  assert.equal(r.resumen.agrupamientosMigrados, 2);
});

test('contenido sin equivalencia queda pendiente con texto original, no se aprueba', () => {
  const r = ejecutar({ 'Matemática': { groups: [grupo('mat-1', 1, ['m4'])] } });
  assert.deepEqual(r.groups['matematica-n1'].contents, []);
  assert.equal(r.pendientes[0].matrixId, 'm4');
  assert.equal(r.pendientes[0].textoOriginal, 'Texto anterior que no coincide');
  assert.equal(r.resumen.contenidosPendientes, 1);
  assert.equal(r.resumen.contenidosDirectos, 0);
});

test('planes originales íntegros, metadatos y procedencia se conservan', () => {
  const planes = [{ name: 'Plan histórico', synopsis: 'Sinopsis completa',
    contentIds: ['m1'], stages: { indagacion: { activities: 'Actividad original' } },
    recursoPropio: { adjuntos: ['archivo.pdf'], observacion: 'Conservar' } }];
  const r = ejecutar({ 'Matemática': { groups: [grupo('mat-1', 1, ['m1'], {
    plansBimestrales: planes, objective: 'Objetivo anterior', context: 'Contexto anterior'
  })] } });
  const recibido = r.groups['matematica-n1'].plansBimestrales[0];
  assert.deepEqual(recibido, { ...planes[0], origen: 'pci-anterior', legacyGroupId: 'mat-1' });
  assert.equal(r.groups['matematica-n1'].objectives, 'Objetivo anterior');
  assert.equal(r.groups['matematica-n1'].context, 'Contexto anterior');
  assert.equal(r.resumen.planesConservados, 1);
});

test('entrada completa e instrumentos de homologación no se modifican', () => {
  const legacyState = { areas: { 'Matemática': { groups: [grupo('mat-1', 1, ['m1'])] } } };
  const model = { model: 'media', subjects: [{ id: 'fg-1-matematica', name: 'Matemática', year: 1, origin: 'FG' }] };
  const approvedMappings = {};
  const antes = structuredClone({ legacyState, matriz, v2, model, approvedMappings });
  const r = ejecutar(legacyState.areas, { legacyState, model, approvedMappings });
  r.groups['matematica-n1'].grupoOriginal.items.push('ALTERADO');
  assert.deepEqual({ legacyState, matriz, v2, model, approvedMappings }, antes);
});

test('más de dos agrupamientos no se descartan y permanecen pendientes íntegros', () => {
  const r = ejecutar({ 'Ciencias Sociales': { groups: [
    grupo('s1', 3, ['m2']), grupo('s2', 3, ['m3']), grupo('s3', 3, ['m2'])
  ] } });
  assert.deepEqual(r.groups, {});
  assert.equal(r.pendientes.filter(x => x.tipo === 'agrupamiento').length, 3);
  assert.equal(r.resumen.contenidosPendientes, 3);
});

test('un plan que V2 recortaría no se asigna y queda en sinUbicar completo', () => {
  const planes = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
  const r = ejecutar({ 'Ciencias Sociales': { groups: [grupo('s1', 3, ['m2'], { plansBimestrales: planes })] } });
  assert.equal(r.groups['socialA-c5'], undefined);
  assert.deepEqual(r.sinUbicar[0].grupoOriginal.plansBimestrales, planes);
  assert.equal(r.resumen.planesPendientes, 3);
});

test('una coincidencia exacta múltiple nunca se acredita sola', () => {
  const r = ejecutar({ 'Matemática': { groups: [grupo('mat-1', 1, ['m1'])] } }, {
    v2FgRows: [v2[0], { ...v2[0], id: 'fg-v2-otra' }]
  });
  assert.deepEqual(r.groups['matematica-n1'].contents, []);
  assert.equal(r.pendientes[0].estado, 'multiple-exact');
});

test('BA +15 no confunde los cinco años anteriores con cuatro niveles distintos', () => {
  const r = ejecutar({ 'Matemática': { groups: [grupo('mat-1', 1, ['m1'])] } }, { model: 'ba15' });
  assert.deepEqual(r.placements, {});
  assert.equal(r.sinUbicar[0].grupoOriginal.id, 'mat-1');
});


test('dos áreas que convergen al mismo slot no sobrescriben el trabajo anterior', () => {
  const r = ejecutar({
    'Artes': { groups: [grupo('artes-1', 1, [])] },
    'Educación Artística': { groups: [grupo('artistica-1', 1, [])] }
  });
  assert.equal(r.groups['artes-c1'].legacyGroupId, 'artes-1');
  assert.equal(r.pendientes[0].grupoOriginal.id, 'artistica-1');
});

test('un plan con forma inválida se conserva íntegro fuera del estado editable', () => {
  const origen = grupo('mat-1', 1, ['m1'], { plansBimestrales: { primero: 'No es una lista' } });
  const r = ejecutar({ 'Matemática': { groups: [origen] } });
  assert.equal(r.groups['matematica-n1'], undefined);
  assert.deepEqual(r.sinUbicar[0].grupoOriginal.plansBimestrales, origen.plansBimestrales);
});
