import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aplicarMigracionEnEstadoV2 } from '../src/migracion/aplicar-en-v2.mjs';
import { migrarLegadoFgAV2, materiasMotorMedia } from '../src/migracion/legado-fg-a-v2.mjs';

const ORIENTACION = 'Economía y Administración';
const FECHA = '2026-11-21T19:41:08.000Z';
const SLOT = 'matematica-n1';
const SOCIALES = ['socialA-c5', 'socialB-c5', 'socialA-c6', 'socialB-c6'];
const MOTOR_MEDIA = materiasMotorMedia(JSON.parse(readFileSync(
  new URL('../vendor/pci-sec-aprende-v2/data/materias-v2.json', import.meta.url), 'utf8')));

const mapa = estado => estado.maps[estado.active];
const estado = (extra = {}) => ({
  school: 'Escuela de prueba', selected: [ORIENTACION], active: ORIENTACION,
  maps: { [ORIENTACION]: {
    alt: 'A', mode: 'one', valid: false, custom: [], placements: {},
    phase2V28: { groups: {}, customContents: [] }, ...extra
  } }
});
const etapaVacia = () => ({ description: '', duration: '', resources: '', activities: '' });
const planVacio = () => ({
  number: 1, name: '', synopsis: '', objectives: '', contentIds: [], updatedAt: null,
  stages: Object.fromEntries(['punto_partida', 'indagacion', 'produccion', 'evaluacion']
    .map(nombre => [nombre, etapaVacia()]))
});
const grupo = (extra = {}) => ({
  name: 'Agrupamiento anterior', objectives: 'Argumentar y resolver problemas',
  synopsis: 'Trabajo recuperado', context: '', practice: '', contents: ['fg-prueba-1'],
  plansBimestrales: [{ ...planVacio(), name: 'Plan conservado',
    objectives: 'Explicar los procedimientos', contentIds: ['fg-prueba-1'],
    recursoPropio: { adjuntos: ['guia.pdf'] } }],
  origen: 'pci-anterior', legacyGroupId: 'anterior-1',
  materiasPropuestas: ['fg-1-matematica'], origenesContenido: { 'fg-prueba-1': ['m1'] },
  contenidosOtroAnio: [], materiasOtroAnio: [],
  grupoOriginal: { id: 'anterior-1', items: ['m1'], objective: 'Texto original' }, ...extra
});
const resultado = (groups = { [SLOT]: grupo() }, extra = {}) => ({
  fecha: FECHA, groups,
  placements: Object.fromEntries(Object.entries(groups).map(([slot, g]) =>
    [slot, [...g.materiasPropuestas]])),
  pendientes: [], sinUbicar: [], omitidosVacios: [], socialOption: null,
  resumen: { agrupamientosMigrados: Object.keys(groups).length, aprobacionesAutomaticasNuevas: 0 },
  ...extra
});
const gruposSociales = slots => Object.fromEntries(slots.map((slot, i) => [slot, grupo({
  name: `Laboratorio ${slot}`, legacyGroupId: `social-${i}`,
  materiasPropuestas: ['fg-3-historia'], contents: [`fg-social-${i}`], plansBimestrales: []
})]));
function congelar(valor) {
  if (valor && typeof valor === 'object') {
    Object.values(valor).forEach(congelar);
    Object.freeze(valor);
  }
  return valor;
}

test('copia materias y grupos en la estructura persistida del editor, sin anidar data', () => {
  const propuesta = resultado({ [SLOT]: grupo(), 'naturales-c1': grupo({
    name: 'Laboratorio', materiasPropuestas: ['fg-1-biologia']
  }) });
  const salida = mapa(aplicarMigracionEnEstadoV2(estado(), propuesta));
  assert.deepEqual(salida.placements, propuesta.placements);
  assert.deepEqual(salida.phase2V28.groups, propuesta.groups);
  assert.equal(Object.hasOwn(salida.phase2V28.groups[SLOT], 'data'), false);
  assert.equal(Object.hasOwn(salida.phase2V28.groups[SLOT], 'subjectIds'), false);
  assert.deepEqual(salida.migracionLegado, {
    version: 'legado-fg-v2/1', fecha: FECHA, resumen: propuesta.resumen
  });
  assert.deepEqual(salida.conflictos, []);
});

test('conecta el migrador real con opción B y los cuatro laboratorios simultáneos de 3.º', () => {
  const matrixRows = [
    { id: 'h1', area: 'Ciencias Sociales', subject: 'Historia', axis: 'Historia', text: 'Construcción histórica de la ciudadanía' },
    { id: 'g1', area: 'Ciencias Sociales', subject: 'Geografía', axis: 'Territorio', text: 'Procesos urbanos del territorio nacional' }
  ];
  const v2FgRows = matrixRows.map((r, i) => ({ ...r, id: `fg-social-real-${i}`, year: 3, component: 'FG' }));
  const legacyState = { areas: { 'Ciencias Sociales': { groups: SOCIALES.map((slot, i) => ({
    id: `laboratorio-${i}`, level: 3, name: `Laboratorio ${i + 1}`,
    startTerm: Number(slot.at(-1)), items: [i % 2 ? 'g1' : 'h1'], plansBimestrales: []
  })) } } };
  const propuesta = migrarLegadoFgAV2({ legacyState, matrixRows, v2FgRows,
    model: { model: 'media', subjects: MOTOR_MEDIA }, orientationId: ORIENTACION });
  const salida = mapa(aplicarMigracionEnEstadoV2(estado({ socialOption: 'A' }), { ...propuesta, fecha: FECHA }));
  assert.equal(salida.socialOption, 'B');
  assert.deepEqual(Object.keys(salida.phase2V28.groups).sort(), [...SOCIALES].sort());
  for (const [i, slot] of SOCIALES.entries()) {
    assert.deepEqual(salida.placements[slot], [i % 2 ? 'fg-3-geografia' : 'fg-3-historia']);
    assert.deepEqual(salida.phase2V28.groups[slot], propuesta.groups[slot]);
  }
  assert.deepEqual(salida.conflictos, []);
});

test('el plan histórico conserva su selección al pasar del migrador real al editor V2', () => {
  const matrixRows = [{ id: 'm1', area: 'Matemática', subject: 'Matemática',
    axis: 'Números', text: 'Operaciones con números racionales' }];
  const v2FgRows = [{ ...matrixRows[0], id: 'fg-plan-real', year: 1, component: 'FG' }];
  const planOriginal = { ...planVacio(), name: 'Plan histórico con selección',
    contentIds: ['m1'], objectives: 'Explicar los procedimientos',
    stages: { indagacion: { activities: 'Comparar las estrategias del grupo' } },
    recursoPropio: { adjuntos: ['guia-original.pdf'] } };
  const legacyState = { areas: { 'Matemática': { groups: [{
    id: 'mat-plan-real', level: 1, name: 'Matemática 1.º', items: ['m1'],
    plansBimestrales: [planOriginal]
  }] } } };
  const argumentos = { legacyState, matrixRows, v2FgRows,
    model: { model: 'media', subjects: MOTOR_MEDIA }, orientationId: ORIENTACION };
  const argumentosAntes = structuredClone(argumentos);
  congelar(argumentos);
  const propuesta = { ...migrarLegadoFgAV2(argumentos), fecha: FECHA };
  const propuestaAntes = structuredClone(propuesta);
  const origen = estado();
  const origenAntes = structuredClone(origen);
  congelar(propuesta);
  congelar(origen);

  const salida = aplicarMigracionEnEstadoV2(origen, propuesta);
  const aplicado = mapa(salida).phase2V28.groups[SLOT];
  assert.deepEqual(aplicado.origenesContenido, { 'fg-plan-real': ['m1'] });
  assert.deepEqual(aplicado.plansBimestrales[0], {
    ...planOriginal, contentIds: ['fg-plan-real'],
    origen: 'pci-anterior', legacyGroupId: 'mat-plan-real'
  });
  // V38 solo marca la casilla si el ID seleccionado coincide con el del grupo.
  assert.deepEqual(aplicado.contents.filter(id =>
    aplicado.plansBimestrales[0].contentIds.includes(String(id))), ['fg-plan-real']);
  assert.deepEqual(aplicado.grupoOriginal, legacyState.areas['Matemática'].groups[0]);
  assert.deepEqual(argumentos, argumentosAntes);
  assert.deepEqual(propuesta, propuestaAntes);
  assert.deepEqual(origen, origenAntes);
  assert.deepEqual(aplicarMigracionEnEstadoV2(salida, propuesta), salida);
});

test('el plan expande una homologación previa 1 a varios sin duplicar IDs V2 ya seleccionados', () => {
  const matrixRows = [{ id: 'm1', area: 'Matemática', subject: 'Matemática',
    axis: 'Números', text: 'Contenido histórico de operaciones y problemas' }];
  const ids = ['fg-plan-operaciones', 'fg-plan-problemas'];
  const v2FgRows = ids.map((id, i) => ({ ...matrixRows[0], id, year: 1,
    component: 'FG', text: ['Operaciones con números racionales', 'Resolución de problemas'][i] }));
  const contentIds = ['m1', ids[0], 'm1'];
  const legacyState = { areas: { 'Matemática': { groups: [{
    id: 'mat-plan-multiple', level: 1, name: 'Matemática 1.º', items: ['m1'],
    plansBimestrales: [{ ...planVacio(), contentIds }]
  }] } } };
  const approvedMappings = { [JSON.stringify(['Matemática', 1, 'm1'])]: {
    status: 'approved', area: 'Matemática', year: 1, matrixId: 'm1', referenceIds: ids,
    reason: 'Homologación simulada aprobada previamente para esta prueba', reviewer: 'Prueba local'
  } };
  const propuesta = { ...migrarLegadoFgAV2({ legacyState, matrixRows, v2FgRows,
    approvedMappings, model: { model: 'media', subjects: MOTOR_MEDIA },
    orientationId: ORIENTACION }), fecha: FECHA };
  const aplicado = mapa(aplicarMigracionEnEstadoV2(estado(), propuesta)).phase2V28.groups[SLOT];
  assert.deepEqual(aplicado.origenesContenido, Object.fromEntries(ids.map(id => [id, ['m1']])));
  assert.deepEqual(aplicado.contents, ids);
  assert.deepEqual(aplicado.plansBimestrales[0].contentIds, ids);
  assert.deepEqual(aplicado.grupoOriginal.plansBimestrales[0].contentIds, contentIds);
  assert.deepEqual(propuesta.groups[SLOT].plansBimestrales[0].contentIds, contentIds);
});

test('asigna la opción A en un mapa sin trabajo y conserva la opción cuando no hay propuesta', () => {
  const salidaA = aplicarMigracionEnEstadoV2(estado({ socialOption: 'B' }),
    resultado(gruposSociales(['socialA-c5', 'socialA-c6']), { socialOption: 'A' }));
  assert.equal(mapa(salidaA).socialOption, 'A');
  const salidaSinOpcion = aplicarMigracionEnEstadoV2(estado({ socialOption: 'B' }), resultado());
  assert.equal(mapa(salidaSinOpcion).socialOption, 'B');
});

test('la segunda aplicación conserva el estado, el marcador y los conflictos sin duplicarlos', () => {
  const origen = estado({ placements: { [SLOT]: ['fg-1-matematica'] } });
  const primera = aplicarMigracionEnEstadoV2(origen, resultado());
  const segunda = aplicarMigracionEnEstadoV2(primera, resultado(undefined, {
    fecha: '2026-11-22T10:00:00.000Z', resumen: { distinto: true }
  }));
  assert.deepEqual(segunda, primera);
  assert.notEqual(segunda, primera);
  assert.equal(mapa(segunda).conflictos.length, 1);
  assert.deepEqual(aplicarMigracionEnEstadoV2(primera, null), primera);
});

test('un placement existente, incluso idéntico, protege el slot completo', () => {
  const origen = estado({ placements: { [SLOT]: ['fg-1-matematica'] } });
  const propuesta = resultado({ [SLOT]: grupo(), 'lengua-n1': grupo({ materiasPropuestas: ['fg-1-lengua-y-literatura'] }) });
  const salida = mapa(aplicarMigracionEnEstadoV2(origen, propuesta));
  assert.deepEqual(salida.placements[SLOT], ['fg-1-matematica']);
  assert.equal(Object.hasOwn(salida.phase2V28.groups, SLOT), false);
  assert.deepEqual(salida.phase2V28.groups['lengua-n1'], propuesta.groups['lengua-n1']);
  assert.equal(salida.conflictos.length, 1);
  assert.equal(salida.conflictos[0].tipo, 'agrupamiento');
  assert.equal(salida.conflictos[0].slot, SLOT);
  assert.ok(salida.conflictos[0].motivo);
  assert.deepEqual(salida.conflictos[0].grupo, propuesta.groups[SLOT]);
  assert.deepEqual(salida.conflictos[0].placements, propuesta.placements[SLOT]);
});

test('conserva el desarrollo existente y los conflictos previos, sin aplicar parcialmente el slot', () => {
  const existente = { contents: ['fg-existente'], objectives: 'Objetivo del equipo',
    plansBimestrales: [{ ...planVacio(), name: 'Plan del equipo' }] };
  const previo = { tipo: 'agrupamiento', slot: 'ef-c1', motivo: 'Revisión anterior' };
  const origen = estado({ placements: { [SLOT]: [] }, conflictos: [previo],
    phase2V28: { groups: { [SLOT]: existente }, customContents: [] } });
  const salida = mapa(aplicarMigracionEnEstadoV2(origen, resultado()));
  assert.deepEqual(salida.phase2V28.groups[SLOT], existente);
  assert.deepEqual(salida.placements[SLOT], []);
  assert.deepEqual(salida.conflictos[0], previo);
  assert.equal(salida.conflictos.length, 2);
  assert.deepEqual(salida.conflictos[1].grupo, resultado().groups[SLOT]);
});

test('protege nombres manuales, etapas, electividad y datos propios de un grupo', () => {
  const casos = [
    { name: 'Nombre definido por la escuela' },
    { plansBimestrales: [{ ...planVacio(), name: 'Título manual' }] },
    { plansBimestrales: [{ ...planVacio(), stages: { indagacion: { activities: 'Entrevistar al barrio' } } }] },
    { door: 'Una noticia como punto de partida' },
    { plans: 'Proyecto escrito en el editor anterior' },
    { elective: true, twin: { name: 'Propuesta alternativa' } },
    { recursoInstitucional: { url: 'guia-local.pdf' } }
  ];
  for (const datos of casos) {
    const origen = estado({ phase2V28: { groups: { [SLOT]: { contents: [], ...datos } }, customContents: [] } });
    const salida = mapa(aplicarMigracionEnEstadoV2(origen, resultado()));
    assert.deepEqual(salida.phase2V28.groups[SLOT], mapa(origen).phase2V28.groups[SLOT]);
    assert.equal(salida.conflictos.filter(c => c.slot === SLOT).length, 1);
    assert.equal(Object.hasOwn(salida.placements, SLOT), false);
  }
});

test('los placeholders y planes automáticos vacíos permiten aplicar la migración', () => {
  const casos = [{}, { contents: [] }, { contents: [], plansBimestrales: [planVacio()] }, {
    contents: [], plansBimestrales: [{ ...planVacio(), name: 'Plan 1 · Matemática',
      autoName: true, autoNameSource: 'Matemática' }]
  }];
  for (const vacio of casos) {
    const origen = estado({ placements: { [SLOT]: [] },
      phase2V28: { groups: { [SLOT]: vacio }, customContents: [] } });
    const propuesta = resultado();
    const salida = mapa(aplicarMigracionEnEstadoV2(origen, propuesta));
    assert.deepEqual(salida.phase2V28.groups[SLOT], propuesta.groups[SLOT]);
    assert.deepEqual(salida.placements[SLOT], propuesta.placements[SLOT]);
    assert.deepEqual(salida.conflictos, []);
  }
});

test('un contenido propio asociado al slot protege el trabajo aunque no esté asignado', () => {
  const propios = [{ id: 'custom:1', groupId: SLOT, text: 'Contenido institucional' }];
  const origen = estado({ phase2V28: { groups: { [SLOT]: { contents: [] } }, customContents: propios } });
  const salida = mapa(aplicarMigracionEnEstadoV2(origen, resultado()));
  assert.deepEqual(salida.phase2V28.customContents, propios);
  assert.deepEqual(salida.phase2V28.groups[SLOT], { contents: [] });
  assert.equal(salida.conflictos[0].slot, SLOT);
  assert.equal(Object.hasOwn(salida.placements, SLOT), false);
});

test('resguarda el trabajo del formulario phase2 anterior sin trasladarlo ni reemplazarlo', () => {
  const anterior = { name: 'Espacio ya trabajado', objectives: 'Conservar este objetivo',
    plans: 'Proyecto escrito en el formulario anterior' };
  const origen = estado({ phase2: { [SLOT]: anterior } });
  const salida = mapa(aplicarMigracionEnEstadoV2(origen, resultado()));
  assert.deepEqual(salida.phase2, { [SLOT]: anterior });
  assert.equal(Object.hasOwn(salida.phase2V28.groups, SLOT), false);
  assert.equal(Object.hasOwn(salida.placements, SLOT), false);
  assert.equal(salida.conflictos[0].slot, SLOT);
});

test('A a B con materias existentes conserva la opción y bloquea los cuatro slots dependientes', () => {
  const materias = ['fg-3-historia', 'fg-3-geografia', 'fg-3-economia'];
  const origen = estado({ socialOption: 'A', placements: { 'socialA-c5': materias } });
  const propuesta = resultado({ ...gruposSociales(SOCIALES), [SLOT]: grupo() }, { socialOption: 'B' });
  const salida = mapa(aplicarMigracionEnEstadoV2(origen, propuesta));
  assert.equal(salida.socialOption, 'A');
  assert.deepEqual(salida.placements['socialA-c5'], materias);
  for (const slot of SOCIALES) assert.equal(Object.hasOwn(salida.phase2V28.groups, slot), false);
  assert.deepEqual(salida.phase2V28.groups[SLOT], propuesta.groups[SLOT]);
  const configuracion = salida.conflictos.find(c => c.tipo === 'opcion-social');
  assert.equal(configuracion.actual, 'A');
  assert.equal(configuracion.propuesta, 'B');
  assert.deepEqual(salida.conflictos.filter(c => c.tipo === 'agrupamiento').map(c => c.slot).sort(), [...SOCIALES].sort());
});

test('B a A con desarrollo sin materias conserva visibles los laboratorios B', () => {
  const existente = { contents: ['fg-trabajado'], objectives: 'Trabajo de la escuela' };
  const origen = estado({ socialOption: 'B', phase2V28: {
    groups: { 'socialB-c6': existente }, customContents: []
  } });
  const propuesta = resultado(gruposSociales(['socialA-c5', 'socialA-c6']), { socialOption: 'A' });
  const salida = mapa(aplicarMigracionEnEstadoV2(origen, propuesta));
  assert.equal(salida.socialOption, 'B');
  assert.deepEqual(salida.phase2V28.groups, { 'socialB-c6': existente });
  assert.deepEqual(salida.placements, {});
  assert.equal(salida.conflictos.find(c => c.tipo === 'opcion-social').propuesta, 'A');
  assert.equal(salida.conflictos.filter(c => c.tipo === 'agrupamiento').length, 2);
});

test('ambas entradas permanecen inalteradas y la salida no comparte sus objetos', () => {
  const origen = estado();
  origen.legacy_state = { areas: { Matemática: { groups: [{ id: 'original', items: ['m1'] }] } } };
  origen.maps['Turismo'] = { placements: { 'lengua-n1': ['fg-1-lengua-y-literatura'] }, nota: 'Otro PCI' };
  const propuesta = resultado();
  const antes = structuredClone({ origen, propuesta });
  congelar(origen);
  congelar(propuesta);
  const salida = aplicarMigracionEnEstadoV2(origen, propuesta);
  assert.deepEqual(salida.maps.Turismo, origen.maps.Turismo);
  assert.deepEqual(salida.legacy_state, origen.legacy_state);
  assert.deepEqual(aplicarMigracionEnEstadoV2(origen, propuesta), salida);
  mapa(salida).placements[SLOT].push('solo-salida');
  mapa(salida).phase2V28.groups[SLOT].plansBimestrales[0].recursoPropio.adjuntos.push('otra.pdf');
  mapa(salida).phase2V28.groups[SLOT].grupoOriginal.items.push('solo-salida');
  mapa(salida).migracionLegado.resumen.agrupamientosMigrados = 99;
  salida.legacy_state.areas.Matemática.groups[0].items.push('solo-salida');
  salida.maps.Turismo.nota = 'Cambio de la copia';
  assert.deepEqual({ origen, propuesta }, antes);
});

test('inicializa únicamente el mapa activo ausente con los valores del motor', () => {
  const origen = { school: 'Escuela', active: ORIENTACION, selected: [ORIENTACION], maps: {} };
  const salida = aplicarMigracionEnEstadoV2(origen, resultado());
  assert.deepEqual(Object.keys(salida.maps), [ORIENTACION]);
  assert.equal(mapa(salida).alt, 'A');
  assert.equal(mapa(salida).mode, 'one');
  assert.equal(mapa(salida).valid, false);
  assert.deepEqual(mapa(salida).custom, []);
  assert.deepEqual(mapa(salida).phase2V28.groups[SLOT], resultado().groups[SLOT]);
  assert.deepEqual(origen.maps, {});
});

test('conserva un contenido de otro año en el slot propuesto sin reubicarlo ni filtrarlo', () => {
  const datos = grupo({ contents: ['fg-tercero'], materiasPropuestas: [], plansBimestrales: [],
    contenidosOtroAnio: [{ matrixId: 'historico-3', anioContenido: 3, ids: ['fg-tercero'] }] });
  const salida = mapa(aplicarMigracionEnEstadoV2(estado(), resultado({ 'socialA-c1': datos })));
  assert.deepEqual(salida.phase2V28.groups['socialA-c1'], datos);
  assert.deepEqual(salida.placements['socialA-c1'], []);
  assert.equal(Object.hasOwn(salida.phase2V28.groups, 'socialA-c5'), false);
});

test('rechaza fecha ausente o sin zona y estructuras de entrada incoherentes', () => {
  const sinFecha = resultado();
  delete sinFecha.fecha;
  assert.throws(() => aplicarMigracionEnEstadoV2(estado(), sinFecha), TypeError);
  assert.throws(() => aplicarMigracionEnEstadoV2(estado(), resultado(undefined, { fecha: '2026-11-21T10:00:00' })), TypeError);
  assert.throws(() => aplicarMigracionEnEstadoV2(estado(), resultado(undefined, { fecha: 'fecha inválida' })), TypeError);
  assert.throws(() => aplicarMigracionEnEstadoV2({ maps: {} }, resultado()), TypeError);
  assert.throws(() => aplicarMigracionEnEstadoV2(estado(), resultado(undefined, { placements: {} })), TypeError);
});

test('invalida Fase 1 solo cuando aplica cambios de materias u opción social', () => {
  const casos = [
    { caso: 'incorpora una materia', origen: estado({ valid: true }),
      propuesta: resultado(), esperado: false },
    { caso: 'cambia A por B sin grupos', origen: estado({ valid: true, socialOption: 'A' }),
      propuesta: resultado({}, { socialOption: 'B' }), esperado: false },
    { caso: 'todos los grupos en conflicto y misma opción',
      origen: estado({ valid: true, socialOption: 'A', placements: { [SLOT]: ['fg-1-matematica'] } }),
      propuesta: resultado(undefined, { socialOption: 'A' }), esperado: true },
    { caso: 'solo desarrollo de Fase 2 sin materias ni cambio de opción', origen: estado({ valid: true }),
      propuesta: resultado({ [SLOT]: grupo({ materiasPropuestas: [] }) }), esperado: true }
  ];
  const observados = casos.map(({ caso, origen, propuesta }) => ({
    caso, valid: mapa(aplicarMigracionEnEstadoV2(origen, propuesta)).valid
  }));
  assert.deepEqual(observados, casos.map(({ caso, esperado }) => ({ caso, valid: esperado })));
});
