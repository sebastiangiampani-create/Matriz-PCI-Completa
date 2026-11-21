import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { migrarLegadoFgAV2, materiasMotorMedia, agrupamientoVacio } from '../src/migracion/legado-fg-a-v2.mjs';

// Catálogo real de materias del motor V2 (vendor), sin deducir IDs.
const MOTOR_MEDIA = materiasMotorMedia(JSON.parse(readFileSync(
  new URL('../vendor/pci-sec-aprende-v2/data/materias-v2.json', import.meta.url), 'utf8')));

const matriz = [
  { id: 'm1', area: 'Matemática', subject: 'Matemática', axis: 'Números', text: 'Operaciones con números racionales' },
  { id: 'm2', area: 'Ciencias Sociales', subject: 'Historia', axis: 'Historia', text: 'Construcción histórica de la ciudadanía' },
  { id: 'm3', area: 'Ciencias Sociales', subject: 'Geografía', axis: 'Territorio', text: 'Procesos urbanos del territorio nacional' },
  { id: 'm4', area: 'Matemática', subject: 'Matemática', axis: 'Números', text: 'Texto anterior que no coincide' },
  { id: 'm5', area: 'Lenguas Adicionales', subject: 'Lenguas Adicionales', axis: 'Oralidad', text: 'Escucha de textos descriptivos' },
  { id: 'm6', area: 'Artes', subject: 'Artes Visuales', axis: 'Producción', text: 'Producción de imágenes bidimensionales' }
];
const v2 = [
  { id: 'fg-v2-1', component: 'FG', year: 1, area: 'Matemática', subject: 'Matemática', axis: 'Números', text: 'Operaciones con números racionales' },
  { id: 'fg-v2-2', component: 'FG', year: 3, area: 'Ciencias Sociales', subject: 'Historia', axis: 'Historia', text: 'Construcción histórica de la ciudadanía' },
  { id: 'fg-v2-3', component: 'FG', year: 3, area: 'Ciencias Sociales', subject: 'Geografía', axis: 'Territorio', text: 'Procesos urbanos del territorio nacional' },
  { id: 'fg-v2-4', component: 'FG', year: 1, area: 'Lenguas Adicionales', subject: 'Lenguas Adicionales', axis: 'Oralidad', text: 'Escucha de textos descriptivos' },
  { id: 'fg-v2-5', component: 'FG', year: 1, area: 'Artes', subject: 'Artes Visuales', axis: 'Producción', text: 'Producción de imágenes bidimensionales' }
];
const grupo = (id, level, items, extra = {}) => ({
  id, level, name: `Agrupamiento ${id}`, items, plansBimestrales: [], ...extra
});
const ejecutar = (areas, extra = {}) => migrarLegadoFgAV2({
  legacyState: { areas }, matrixRows: matriz, v2FgRows: v2,
  model: { model: 'media', subjects: MOTOR_MEDIA }, orientationId: 'sociales', ...extra
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
    'Artes': { groups: [grupo('artes-1', 1, [], { objective: 'Explorar lenguajes' })] },
    'Educación Artística': { groups: [grupo('artistica-1', 1, [], { objective: 'Producir' })] }
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

test('Lengua Adicional y Artes usan los IDs reales del motor V2', () => {
  const r = ejecutar({
    'Lenguas Adicionales': { groups: [grupo('la-1', 1, ['m5'])] },
    'Artes': { groups: [grupo('ar-1', 1, ['m6'])] }
  });
  assert.deepEqual(r.placements['adicional-n1'], ['fg-1-lengua-adicional']);
  assert.deepEqual(r.placements['artes-c1'], ['fg-1-artes']);
  const ids = new Set(MOTOR_MEDIA.map(x => x.id));
  for (const lista of Object.values(r.placements)) for (const id of lista) assert.ok(ids.has(id), id);
});

test('sin catálogo del motor no se deduce ningún ID de materia', () => {
  const r = ejecutar({ 'Lenguas Adicionales': { groups: [grupo('la-1', 1, ['m5'])] } }, { model: 'media' });
  assert.deepEqual(r.placements['adicional-n1'], []);
  assert.equal(r.pendientes.find(x => x.tipo === 'materia').motivo.includes('Falta el catálogo'), true);
});

test('los agrupamientos vacíos no se migran y quedan informados', () => {
  const plantilla = { name: 'Plan 1', stages: { punto_partida: { description: '' } }, contentIds: [], objectives: '' };
  const vacio = grupo('ef-1', 1, [], { plansBimestrales: [plantilla] });
  assert.equal(agrupamientoVacio(vacio), true);
  assert.equal(agrupamientoVacio(grupo('ef-2', 1, [], { objective: 'Algo' })), false);
  const r = ejecutar({ 'Educación Física': { groups: [vacio] } });
  assert.deepEqual(r.groups, {});
  assert.deepEqual(r.omitidosVacios, [{ area: 'Educación Física', grupoId: 'ef-1', nivel: 1, planesPlantilla: 1 }]);
  assert.equal(r.resumen.agrupamientosVaciosOmitidos, 1);
});

test('Sociales 3.º con dos laboratorios simultáneos por cuatrimestre usa la opción de 12 laboratorios', () => {
  const r = ejecutar({ 'Ciencias Sociales': { groups: [
    grupo('s5', 3, ['m2'], { startTerm: 5 }), grupo('s6', 3, ['m3'], { startTerm: 5 }),
    grupo('s7', 3, ['m2'], { startTerm: 6 }), grupo('s8', 3, ['m3'], { startTerm: 6 })
  ] } });
  assert.equal(r.groups['socialA-c5'].legacyGroupId, 's5');
  assert.equal(r.groups['socialB-c5'].legacyGroupId, 's6');
  assert.equal(r.groups['socialA-c6'].legacyGroupId, 's7');
  assert.equal(r.groups['socialB-c6'].legacyGroupId, 's8');
  assert.equal(r.socialOption, 'B');
  assert.equal(r.resumen.agrupamientosPendientes, 0);
});

test('Sociales 3.º con un laboratorio por cuatrimestre usa la opción de 10 laboratorios', () => {
  const r = ejecutar({ 'Ciencias Sociales': { groups: [grupo('s7', 3, ['m2'], { startTerm: 6 })] } });
  assert.ok(r.groups['socialA-c6']);
  assert.equal(r.groups['socialA-c5'], undefined);
  assert.equal(r.socialOption, 'A');
});

test('laboratorios simultáneos fuera de Sociales 3.º quedan pendientes', () => {
  const r = ejecutar({ 'Ciencias Sociales': { groups: [
    grupo('s1', 1, ['m2'], { startTerm: 1 }), grupo('s2', 1, ['m3'], { startTerm: 1 })
  ] } });
  assert.deepEqual(r.groups, {});
  assert.equal(r.resumen.agrupamientosPendientes, 2);
});

test('un contenido de otro año se conserva, suma solo en su año y no genera pendiente de materia', () => {
  // m2 (Historia) existe en V2 en 3.º; el agrupamiento es de 1.º.
  const r = ejecutar({ 'Ciencias Sociales': { groups: [grupo('s1', 1, ['m2'])] } });
  assert.deepEqual(r.groups['socialA-c1'].contents, ['fg-v2-2']);
  assert.deepEqual(r.groups['socialA-c1'].contenidosOtroAnio, [{ matrixId: 'm2', anioContenido: 3, ids: ['fg-v2-2'] }]);
  assert.deepEqual(r.placements['socialA-c1'], []);
  assert.equal(r.pendientes.filter(x => x.tipo === 'materia').length, 0);
  assert.equal(r.resumen.contenidosDeOtroAnio, 1);
});
