import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { migrarLegadoFgAV2, materiasMotorMedia } from '../src/migracion/legado-fg-a-v2.mjs';
import { prepararRevisionMigracionV2, aceptarRevisionMigracionV2 } from '../src/migracion/revision-aceptacion-v2.mjs';

const ORIENTACION = 'Economía y Administración';
const OTRA = 'Comunicación';
const FECHA = '2026-11-21T21:15:00.000Z';
const SOCIALES = ['socialA-c5', 'socialB-c5', 'socialA-c6', 'socialB-c6'];
const MOTOR = materiasMotorMedia(JSON.parse(readFileSync(
  new URL('../vendor/pci-sec-aprende-v2/data/materias-v2.json', import.meta.url), 'utf8')));
const matriz = [
  { id: 'm1', area: 'Matemática', subject: 'Matemática', axis: 'Números', text: 'Operaciones con números racionales' },
  { id: 'h1', area: 'Ciencias Sociales', subject: 'Historia', axis: 'Historia', text: 'Construcción histórica de la ciudadanía' },
  { id: 'g1', area: 'Ciencias Sociales', subject: 'Geografía', axis: 'Territorio', text: 'Procesos urbanos del territorio nacional' },
  { id: 'm-pendiente', area: 'Matemática', subject: 'Matemática', axis: 'Problemas', text: 'Un contenido histórico sin correspondencia' }
];
const v2 = matriz.slice(0, 3).map((row, i) => ({ ...row, id: ['fg-mat', 'fg-historia', 'fg-geografia'][i],
  year: i === 0 ? 1 : 3, component: 'FG' }));

function planes(items, cantidad) {
  return Array.from({ length: cantidad }, (_, i) => ({ number: i + 1,
    name: `Plan bimestral ${i + 1}`, synopsis: 'Secuencia histórica', objectives: 'Explicar procedimientos',
    contentIds: [...items], stages: { indagacion: { activities: `Actividad del bimestre ${i + 1}` } }
  }));
}

function grupo(id, level, items, extra = {}) {
  return { id, level, items, name: `Agrupamiento ${id}`, plansBimestrales: planes(items, 2), ...extra };
}

function legacy() {
  return { areas: {
    'Matemática': { groups: [grupo('mat-1', 1, ['m1'], { plansBimestrales: planes(['m1'], 4) })] },
    'Ciencias Sociales': { groups: SOCIALES.map((slot, i) => grupo(`social-${i}`, 3,
      [i % 2 ? 'g1' : 'h1'], { startTerm: Number(slot.at(-1)) })) }
  } };
}

function propuesta(legacyState = legacy(), subjects = MOTOR) {
  return migrarLegadoFgAV2({ legacyState, matrixRows: matriz, v2FgRows: v2,
    model: { model: 'media', subjects }, orientationId: ORIENTACION });
}

function estado(extra = {}) {
  return { active: ORIENTACION, selected: [ORIENTACION, OTRA], school: 'Escuela simulada',
    maps: {
      [ORIENTACION]: { alt: 'A', mode: 'one', custom: [], valid: false, socialOption: 'A',
        placements: {}, phase2V28: { groups: {}, customContents: [] }, conflictos: [], ...extra },
      [OTRA]: { placements: { 'lengua-n1': ['fg-1-lengua-y-literatura'] },
        phase2V28: { groups: { 'lengua-n1': { objectives: 'Trabajo de otro PCI' } } } }
    }, legacy_state: legacy()
  };
}

const mapa = e => e.maps[e.active];
function congelar(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(congelar);
    Object.freeze(value);
  }
  return value;
}

test('revisa la propuesta real con opción B, planes bimestrales y contenidos únicos frente a asignaciones', () => {
  const e = estado(), p = propuesta();
  const revision = prepararRevisionMigracionV2(e, p);
  assert.equal(revision.estado, 'lista');
  assert.equal(revision.puedeAceptar, true);
  assert.equal(revision.orientacion, ORIENTACION);
  assert.deepEqual(revision.resumen, {
    agrupamientos: 5, agrupamientosPropuestos: 5, planesBimestrales: 12,
    contenidosUnicos: 3, asignacionesContenidos: 5, conflictosAgrupamientos: 0,
    pendientesContenidos: 0, pendientesMaterias: 0, pendientesAgrupamientos: 0,
    sinUbicar: 0, omitidosVacios: 0
  });
  assert.deepEqual(revision.social, { actual: 'A', propuesta: 'B', efectiva: 'B', conflicto: false });
  assert.equal(revision.detalles.gruposAplicables.find(g => g.slot === 'matematica-n1').planesBimestrales, 4);
  for (const slot of SOCIALES)
    assert.equal(revision.detalles.gruposAplicables.find(g => g.slot === slot).planesBimestrales, 2);
  assert.equal(revision.migracionLegado, null);
  assert.equal(Object.hasOwn(mapa(e), 'migracionLegado'), false);
  assert.deepEqual(mapa(e).placements, {});
});

test('cuenta cuatro grupos bloqueados y una advertencia social, sin mezclar conflictos anteriores', () => {
  const previo = { tipo: 'agrupamiento', slot: 'anterior', motivo: 'Conflicto previo conservado' };
  const e = estado({ placements: { 'socialA-c5': ['fg-3-historia'] }, conflictos: [previo] });
  const p = propuesta(), revision = prepararRevisionMigracionV2(e, p);
  assert.equal(p.resumen.agrupamientosMigrados, 5);
  assert.equal(revision.resumen.agrupamientosPropuestos, 5);
  assert.equal(revision.resumen.agrupamientos, 1);
  assert.equal(revision.resumen.planesBimestrales, 4);
  assert.equal(revision.resumen.conflictosAgrupamientos, 4);
  assert.equal(revision.detalles.conflictos.length, 5);
  assert.equal(revision.detalles.conflictos.filter(c => c.tipo === 'opcion-social').length, 1);
  assert.deepEqual(revision.social, { actual: 'A', propuesta: 'B', efectiva: 'A', conflicto: true });
  assert.deepEqual(revision.detalles.gruposAplicables.map(g => g.slot), ['matematica-n1']);

  const aceptacion = aceptarRevisionMigracionV2(e, revision, FECHA);
  assert.equal(aceptacion.estado, 'aceptada');
  assert.equal(aceptacion.revision.estado, 'ya-aplicada');
  assert.equal(aceptacion.revision.puedeAceptar, false);
  assert.deepEqual(aceptacion.revision.resumen, revision.resumen);
  assert.deepEqual(aceptacion.revision.detalles, revision.detalles);
  assert.deepEqual(mapa(aceptacion.estadoV2).conflictos[0], previo);
  assert.equal(mapa(aceptacion.estadoV2).conflictos.length, 6);
  assert.equal(mapa(aceptacion.estadoV2).migracionLegado.resumen.agrupamientosMigrados, 5,
    'El resumen original del adaptador sigue preservado; el aviso informa lo efectivo por separado.');
  assert.deepEqual(mapa(aceptacion.estadoV2).placements['socialA-c5'], ['fg-3-historia']);
});

test('tipifica pendientes, sin ubicación y vacíos sin contarlos como grupos aplicables', () => {
  const datos = { areas: {
    'Matemática': { groups: [
      grupo('mat-mixto', 1, ['m1', 'm-pendiente']),
      grupo('mat-2-a', 2, ['m1']), grupo('mat-2-b', 2, ['m1']),
      grupo('mat-invalido', 0, ['m1'])
    ] },
    'Educación Física': { groups: [grupo('ef-vacio', 1, [], { plansBimestrales: [] })] },
    'Área sin estructura': { groups: null }
  } };
  const p = propuesta(datos, MOTOR.filter(m => m.id !== 'fg-1-matematica'));
  const revision = prepararRevisionMigracionV2(estado(), p);
  assert.equal(revision.resumen.agrupamientos, 1);
  assert.equal(revision.resumen.planesBimestrales, 2);
  assert.equal(revision.resumen.pendientesContenidos, 1);
  assert.equal(revision.resumen.pendientesMaterias, 1);
  assert.equal(revision.resumen.pendientesAgrupamientos, 2);
  assert.equal(revision.resumen.sinUbicar, 2);
  assert.equal(revision.resumen.omitidosVacios, 1);
  assert.deepEqual(revision.detalles.pendientes, p.pendientes);
  assert.deepEqual(revision.detalles.sinUbicar, p.sinUbicar);
  assert.deepEqual(revision.detalles.omitidosVacios, p.omitidosVacios);
  assert.equal(revision.detalles.sinUbicar.filter(x => x.tipo === 'area').length, 1);
});

test('cero grupos aplicables impide aceptar y no instala el marcador', () => {
  const datos = legacy();
  delete datos.areas['Matemática'];
  const e = estado({ placements: { 'socialA-c5': ['fg-3-historia'] } });
  const antes = structuredClone(e);
  const revision = prepararRevisionMigracionV2(e, propuesta(datos));
  assert.equal(revision.estado, 'sin-aplicables');
  assert.equal(revision.puedeAceptar, false);
  assert.equal(revision.resumen.conflictosAgrupamientos, 4);
  assert.equal(revision.resumen.planesBimestrales, 0);
  const r = aceptarRevisionMigracionV2(e, revision, FECHA);
  assert.equal(r.estado, 'sin-aplicables');
  assert.deepEqual(r.estadoV2, antes);
  assert.deepEqual(e, antes);
  assert.equal(Object.hasOwn(mapa(r.estadoV2), 'migracionLegado'), false);
});

test('una propuesta con solo agrupamientos vacíos tampoco marca ni acepta una migración', () => {
  const p = propuesta({ areas: { 'Educación Física': { groups: [grupo('ef', 1, [], { plansBimestrales: [] })] } } });
  const e = estado(), revision = prepararRevisionMigracionV2(e, p);
  assert.equal(revision.estado, 'sin-aplicables');
  assert.equal(revision.resumen.omitidosVacios, 1);
  const r = aceptarRevisionMigracionV2(e, revision, FECHA);
  assert.equal(r.estado, 'sin-aplicables');
  assert.deepEqual(r.estadoV2, e);
});

test('un cambio del mapa revisado devuelve nueva revisión sin aplicar y exige un segundo clic', () => {
  const e = estado(), revision = prepararRevisionMigracionV2(e, propuesta());
  const actual = structuredClone(e);
  mapa(actual).placements['matematica-n1'] = ['fg-1-matematica'];
  mapa(actual).phase2V28.groups['matematica-n1'] = { objectives: 'Trabajo agregado durante la revisión' };
  const antes = structuredClone(actual);
  const r = aceptarRevisionMigracionV2(actual, revision, FECHA);
  assert.equal(r.estado, 'actualizada');
  assert.equal(r.revision.estado, 'lista');
  assert.equal(r.revision.resumen.agrupamientos, 4);
  assert.equal(r.revision.resumen.planesBimestrales, 8);
  assert.equal(r.revision.resumen.conflictosAgrupamientos, 1);
  assert.deepEqual(r.estadoV2, antes);
  assert.equal(Object.hasOwn(mapa(r.estadoV2), 'migracionLegado'), false);

  const confirmado = aceptarRevisionMigracionV2(actual, r.revision, FECHA);
  assert.equal(confirmado.estado, 'aceptada');
  assert.deepEqual(mapa(confirmado.estadoV2).phase2V28.groups['matematica-n1'],
    mapa(antes).phase2V28.groups['matematica-n1']);
  for (const slot of SOCIALES) assert.ok(mapa(confirmado.estadoV2).phase2V28.groups[slot]);
  assert.deepEqual(actual, antes);
});

test('el orden de claves no invalida la revisión y se preservan los cambios de otros mapas', () => {
  const e = estado(), revision = prepararRevisionMigracionV2(e, propuesta());
  const actual = structuredClone(e);
  const invertir = value => Array.isArray(value) ? value.map(invertir)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, invertir(child)]))
      : value;
  actual.maps[ORIENTACION] = invertir(actual.maps[ORIENTACION]);
  actual.maps[OTRA].phase2V28.groups['lengua-n1'].objectives = 'Edición posterior que debe preservarse';
  actual.maps[OTRA].revision = 9;
  const antes = structuredClone(actual);
  const r = aceptarRevisionMigracionV2(actual, revision, FECHA);
  assert.equal(r.estado, 'aceptada');
  assert.deepEqual(r.estadoV2.maps[OTRA], antes.maps[OTRA]);
  assert.deepEqual(actual, antes);
});

test('cambiar a otra orientación rechaza el contexto sin trasladarle la propuesta anterior', () => {
  const e = estado(), revision = prepararRevisionMigracionV2(e, propuesta());
  const actual = structuredClone(e);
  actual.active = OTRA;
  const antes = structuredClone(actual);
  assert.throws(() => aceptarRevisionMigracionV2(actual, revision, FECHA),
    error => error instanceof TypeError && /orientación/.test(error.message));
  assert.deepEqual(actual, antes);
  assert.equal(Object.hasOwn(mapa(actual), 'migracionLegado'), false);
});

test('la fecha se toma de la aceptación y las selecciones de planes pasan a IDs V2', () => {
  const e = estado(), p = propuesta();
  p.fecha = '1999-01-01T00:00:00.000Z';
  const revision = prepararRevisionMigracionV2(e, p);
  assert.equal(revision.migracionLegado, null);
  assert.equal(Object.hasOwn(mapa(e), 'migracionLegado'), false);
  const r = aceptarRevisionMigracionV2(e, revision, FECHA);
  assert.equal(mapa(r.estadoV2).migracionLegado.fecha, FECHA);
  assert.equal(r.revision.migracionLegado.fecha, FECHA);
  assert.equal(p.fecha, '1999-01-01T00:00:00.000Z');
  for (const plan of mapa(r.estadoV2).phase2V28.groups['matematica-n1'].plansBimestrales)
    assert.deepEqual(plan.contentIds, ['fg-mat']);
  assert.deepEqual(mapa(r.estadoV2).phase2V28.groups['matematica-n1'].grupoOriginal.plansBimestrales[0].contentIds, ['m1']);
  assert.equal(mapa(r.estadoV2).valid, false, 'Aceptar el traslado no valida el mapa.');
});

test('doble aceptación no duplica grupos, conflictos ni fecha', () => {
  const e = estado(), revision = prepararRevisionMigracionV2(e, propuesta());
  const primero = aceptarRevisionMigracionV2(e, revision, FECHA);
  const otraFecha = '2026-11-22T12:00:00.000Z';
  for (const rev of [revision, primero.revision]) {
    const segundo = aceptarRevisionMigracionV2(primero.estadoV2, rev, otraFecha);
    assert.equal(segundo.estado, 'ya-aplicada');
    assert.equal(segundo.revision.puedeAceptar, false);
    assert.deepEqual(segundo.estadoV2, primero.estadoV2);
    assert.equal(mapa(segundo.estadoV2).migracionLegado.fecha, FECHA);
    assert.notEqual(segundo.estadoV2, primero.estadoV2);
  }
});

test('la presencia de un marcador anterior impide una segunda revisión, incluso si vale null', () => {
  for (const migracionLegado of [null, { version: 'legado-fg-v2/1', fecha: FECHA, resumen: {} }]) {
    const e = estado({ migracionLegado }), revision = prepararRevisionMigracionV2(e, null);
    assert.equal(revision.estado, 'ya-aplicada');
    assert.equal(revision.puedeAceptar, false);
    assert.equal(revision.resumen.agrupamientos, 0);
    assert.equal(revision.resumen.planesBimestrales, 0);
    const r = aceptarRevisionMigracionV2(e, revision, undefined);
    assert.equal(r.estado, 'ya-aplicada');
    assert.deepEqual(r.estadoV2, e);
  }
});

test('preparar y descartar no modifica entradas; revisión y aceptación son copias independientes', () => {
  const e = estado(), p = propuesta(), antes = structuredClone({ e, p });
  congelar(e); congelar(p);
  const revision = prepararRevisionMigracionV2(e, p);
  const serializada = JSON.parse(JSON.stringify(revision));
  assert.deepEqual(serializada, revision);
  assert.deepEqual({ e, p }, antes, 'Preparar y cerrar el aviso no alteran el estado.');
  congelar(revision);
  const r = aceptarRevisionMigracionV2(e, revision, FECHA);
  assert.deepEqual({ e, p }, antes);
  assert.deepEqual(revision, serializada);
  r.estadoV2.maps[ORIENTACION].phase2V28.groups['matematica-n1'].objectives = 'Cambiar solo salida';
  r.revision.detalles.gruposAplicables[0].nombre = 'Cambiar solo revisión devuelta';
  r.revision._snapshot.propuesta.groups['matematica-n1'].name = 'Cambiar solo snapshot devuelto';
  assert.deepEqual({ e, p }, antes);
  assert.deepEqual(revision, serializada);
  serializada._snapshot.propuesta.groups['matematica-n1'].name = 'Cambiar solo copia serializada';
  assert.equal(p.groups['matematica-n1'].name, antes.p.groups['matematica-n1'].name);
});

test('una revisión serializada puede aceptarse y una fecha inválida no instala el marcador', () => {
  const e = estado(), revision = JSON.parse(JSON.stringify(prepararRevisionMigracionV2(e, propuesta())));
  const antes = structuredClone(e);
  for (const fecha of [undefined, 'fecha inválida', '2026-11-21T21:15:00'])
    assert.throws(() => aceptarRevisionMigracionV2(e, revision, fecha), TypeError);
  assert.deepEqual(e, antes);
  assert.equal(Object.hasOwn(mapa(e), 'migracionLegado'), false);
  assert.equal(aceptarRevisionMigracionV2(e, revision, FECHA).estado, 'aceptada');
});

test('rechaza estados y revisiones incompletos antes de aplicar', () => {
  const e = estado(), p = propuesta();
  assert.throws(() => prepararRevisionMigracionV2({ maps: {} }, p), TypeError);
  assert.throws(() => prepararRevisionMigracionV2(e, null), TypeError);
  assert.throws(() => prepararRevisionMigracionV2(e, { ...p, pendientes: {} }), TypeError);
  assert.throws(() => aceptarRevisionMigracionV2(e, {}, FECHA), TypeError);
  const revision = prepararRevisionMigracionV2(e, p);
  revision.orientacion = OTRA;
  assert.throws(() => aceptarRevisionMigracionV2(e, revision, FECHA), TypeError);
  assert.equal(Object.hasOwn(mapa(e), 'migracionLegado'), false);
});
