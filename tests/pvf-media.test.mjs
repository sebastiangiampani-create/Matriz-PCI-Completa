import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {ORIENTATIONS} from '../src/integracion-curricular/bridge.js';
import {
  resolvePvf, aplicarPvfEnMapa, grupoPvfConTrabajo, PVF_MEDIA_SLOT
} from '../src/aplicacion-v2/pvf-media.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const DATA = JSON.parse(read('vendor/pci-sec-aprende-v2/data/materias-v2.json'));
const HOURS = JSON.parse(read('vendor/pci-sec-aprende-v2/data/horas-v2.json'));
const CORE = read('vendor/pci-sec-aprende-v2/app-core.html');
const helpers = CORE.split('\n').find(line => line.includes(', slug=s=>'));
const fo = CORE.split('\n').find(line => line.startsWith('function fo()'));
assert.ok(helpers && fo, 'Se usa la función fo() del motor que monta la aplicación.');
const SLOT = 'proyecto-n5';
const clone = value => structuredClone(value);
const track = id => ORIENTATIONS.find(item => item.id === id).name;
function subjects(id, alt = 'A') {
  const context = {DATA, state:{active:track(id)}, ensure:() => ({alt})};
  vm.createContext(context);
  return clone(vm.runInContext(helpers + '\n' + fo + '\nfo()', context));
}
const prescription = (id = 'economia_administracion', alternative = 'A') =>
  resolvePvf({orientationId:id, alternative, subjects:subjects(id, alternative)});
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
const emptyPlan = number => ({number, name:'', synopsis:'', objectives:'', contentIds:[], updatedAt:null,
  stages:Object.fromEntries(['punto_partida', 'indagacion', 'produccion', 'evaluacion']
    .map(key => [key, {description:'', duration:'', resources:'', activities:''}]))});
const emptyGroup = () => ({contents:[], plansBimestrales:[1, 2, 3, 4].map(emptyPlan)});
const developedGroup = () => ({name:'Proyecto de la escuela', contents:['contenido-original'],
  objectives:'Formular y justificar propuestas', synopsis:'Texto de la escuela',
  plansBimestrales:[1, 2, 3, 4].map(number => ({...emptyPlan(number), name:'Plan ' + number,
    contentIds:['contenido-original'], stages:{indagacion:{activities:'Investigar', resources:'Archivo propio'}},
    adjuntos:{documentos:['plan-' + number + '.pdf']}})),
  extensionPropia:{evidencias:['evidencia-1'], observaciones:'No eliminar'}});
const map = (extra = {}) => ({alt:'A', mode:'one', valid:true, placements:{}, custom:[], ...extra});

// Expectativas independientes de PVF_TABLE: transcripción de las 16 filas
// aportadas, contrastadas con las cajas horarias y con fo() de app-core.
const cases = [
  ['agro_ambiente', 'agro-y-ambiente', 3, 3, 'Espacio de integración teórico-práctico', 3, 'Espacio de integración teórico-práctico', 3],
  ['arte_artes_visuales', 'arte-artes-visuales', 2, 2, 'Producción artística y gestión cultural', 3, 'Producción visual y gestión cultural', 3],
  ['arte_musica', 'arte-musica', 2, 2, 'Gestión de proyectos y producción musical', 3, 'Gestión cultural musical', 3],
  ['arte_teatro', 'arte-teatro', 2, 2, 'Producción en artes escénicas y gestión cultural', 4, 'Producción teatral y gestión cultural', 3],
  ['ciencias_naturales', 'ciencias-naturales', 3, 3, 'Problemáticas científicas con impacto social', 2, 'Problemáticas científicas con impacto social', 2],
  ['ciencias_sociales_humanidades', 'ciencias-sociales-y-humanidades', 3, 3, 'Proyecto', 3, 'Proyecto', 3],
  ['comunicacion', 'comunicacion', 2, 3, 'Proyecto de Comunicación', 4, 'Proyecto de Comunicación', 4],
  ['economia_administracion', 'economia-y-administracion', 1, 1, 'Proyecto Organizacional', 3, 'Proyecto Organizacional', 3],
  ['educacion', 'educacion', 0, 0, 'Proyecto', 3, 'Proyecto', 3],
  ['educacion_fisica', 'educacion-fisica', 2, 3, 'Proyecto II', 3, 'Proyecto II', 3],
  ['energia_sustentabilidad', 'energia-y-sustentabilidad', 2, 2, 'Proyecto: Consumidores/as y productores/as', 4, 'Proyecto: Consumidores/as y productores/as', 4],
  ['informatica', 'informatica', 2, 2, 'Proyectos de Producción', 4, 'Desarrollo de Proyectos de Producción', 4],
  ['lenguas', 'lenguas', 3, 3, 'Proyecto', 3, 'Proyecto', 3],
  ['literatura', 'literatura', 0, 1, 'Proyecto de Mediación y/o Promoción de la Lectura y la Escritura', 3, 'Proyecto de Mediación de la Lectura y la Escritura', 4],
  ['matematica_fisica', 'matematica-y-fisica', 0, 0, 'Lógica y Filosofía de la Ciencia', 4, 'Ciencia en Contexto', 4],
  ['turismo', 'turismo', 3, 3, 'Proyecto de turismo comunitario', 4, 'Proyecto de turismo comunitario', 4]
];
for (const [orientationId, prefix, indexA, indexB, nameA, hoursA, nameB, hoursB] of cases) {
  for (const [alternative, index, name, hours] of [['A', indexA, nameA, hoursA], ['B', indexB, nameB, hoursB]]) {
    test('catálogo real ' + orientationId + ' alternativa ' + alternative + ': ID, nombre y horas', () => {
      const source = freeze(subjects(orientationId, alternative)), before = clone(source);
      assert.ok(source.every(subject => !Object.hasOwn(subject, 'hours')), 'El catálogo de materias no contiene horas.');
      const resolved = resolvePvf({orientationId, alternative, subjects:source});
      assert.equal(resolved.subjectId, 'fo-' + prefix + '-5-' + index);
      assert.equal(resolved.name, name);
      assert.equal(resolved.hours, hours);
      assert.equal(resolved.orientation, track(orientationId));
      assert.equal(resolved.alternative, alternative);
      assert.deepEqual([resolved.slot, resolved.year, resolved.startTerm, resolved.endTerm, resolved.duration],
        [SLOT, 5, 9, 10, 'annual']);
      const actualAlt = DATA.formacion_orientada[track(orientationId)].sinAlternativas ? 'A' : alternative;
      assert.equal(HOURS.formacion_orientada[track(orientationId)][actualAlt]['5'][name], hours);
      assert.deepEqual(source, before);
    });
  }
}

test('Energía usa la materia real de A también para B, sin crear un catálogo inexistente', () => {
  assert.equal(DATA.formacion_orientada['Energía y Sustentabilidad'].sinAlternativas, true);
  assert.deepEqual(DATA.formacion_orientada['Energía y Sustentabilidad'].B, {'4':[], '5':[]});
  assert.equal(prescription('energia_sustentabilidad', 'A').subjectId,
    prescription('energia_sustentabilidad', 'B').subjectId);
});

test('rechaza materia ausente, ambigua, de otro nivel u orientación e IDs sintéticos', () => {
  const p = prescription(), list = subjects('economia_administracion');
  const selected = list.find(subject => subject.id === p.subjectId);
  const resolve = source => resolvePvf({orientationId:'economia_administracion', alternative:'A', subjects:source});
  assert.throws(() => resolve([]), {code:'PVF_MATERIA_NO_DISPONIBLE'});
  assert.throws(() => resolve([{...selected, year:4}]), {code:'PVF_MATERIA_NO_DISPONIBLE'});
  assert.throws(() => resolve([selected, {...selected, id:p.subjectId + '0'}]), {code:'PVF_MATERIA_AMBIGUA'});
  assert.throws(() => resolve([selected, {...selected, name:'Otra materia'}]), {code:'PVF_MATERIA_AMBIGUA'});
  for (const id of ['pvf:economia_administracion:A', 'fo-literatura-5-1', p.subjectId + '-proyecto-organizacional'])
    assert.throws(() => resolve([{...selected, id}]), {code:'PVF_IDENTIFICADOR_INVALIDO'});
  assert.throws(() => resolvePvf({orientationId:'tecnica_computacion', subjects:list}), {code:'PVF_ORIENTACION_INVALIDA'});
  assert.throws(() => resolvePvf({orientationId:'educacion', alternative:'C', subjects:list}), {code:'PVF_ALTERNATIVA_INVALIDA'});
  assert.throws(() => resolvePvf({orientationId:'educacion'}), {code:'PVF_CATALOGO_INVALIDO'});
});

test('prearma un único PVF anual y conserva intactas todas las otras raíces', () => {
  const p = freeze(prescription());
  const source = freeze(map({placements:{'lengua-n1':['fg-1-lengua-y-literatura']},
    phase2V28:{groups:{'lengua-n1':developedGroup()}, customContents:[{id:'propio-1', text:'Contenido propio'}]},
    otraRaiz:{preferencias:['original']}}));
  const before = clone(source), result = aplicarPvfEnMapa(source, {prescripcion:p});
  assert.equal(PVF_MEDIA_SLOT, SLOT);
  assert.equal(result.estado, 'aplicado');
  assert.equal(result.cambio, true);
  assert.equal(result.conflicto, null);
  assert.deepEqual(result.mapa.placements, {...before.placements, [SLOT]:[p.subjectId]});
  assert.equal(result.mapa.valid, false);
  assert.deepEqual(result.mapa.pvfMedia, p);
  assert.deepEqual(result.mapa.phase2V28, before.phase2V28);
  assert.deepEqual(result.mapa.otraRaiz, before.otraRaiz);
  assert.deepEqual(source, before);
  result.mapa.phase2V28.groups['lengua-n1'].plansBimestrales[0].name = 'Otra copia';
  assert.deepEqual(source, before);
});

test('aplicación repetida es idempotente; una asignación correcta conserva su desarrollo y validación', () => {
  const p = prescription(), group = developedGroup();
  const source = map({placements:{[SLOT]:[p.subjectId]}, phase2V28:{groups:{[SLOT]:group}}});
  const once = aplicarPvfEnMapa(source, {prescripcion:p});
  assert.equal(once.mapa.valid, true);
  assert.deepEqual(once.mapa.phase2V28.groups[SLOT], group);
  const twice = aplicarPvfEnMapa(freeze(once.mapa), {prescripcion:p});
  assert.equal(twice.estado, 'sin-cambios');
  assert.equal(twice.cambio, false);
  assert.deepEqual(twice.mapa, once.mapa);
  assert.notEqual(twice.mapa, once.mapa);
});

test('otra materia ya colocada produce conflicto con o sin desarrollo y conserva la entrada completa', () => {
  for (const group of [emptyGroup(), developedGroup(), {data:{contents:['formato-desconocido'], planes:{texto:'Original'}}}]) {
    const source = freeze(map({placements:{[SLOT]:['fo-economia-y-administracion-5-0']},
      phase2V28:{groups:{[SLOT]:group}}, extension:{datos:['conservar']}}));
    const before = clone(source), result = aplicarPvfEnMapa(source, {prescripcion:prescription()});
    assert.equal(result.estado, 'conflicto');
    assert.equal(result.cambio, false);
    assert.equal(result.conflicto.code, 'PVF_COMPOSICION_NO_PRESCRIPTA');
    assert.deepEqual(result.mapa, before);
    assert.deepEqual(source, before);
  }
});

test('no duplica ni mueve una materia PVF que ya está en otro espacio', () => {
  const p = prescription();
  for (const placedInPvf of [[], [p.subjectId]]) {
    const source = freeze(map({placements:{[SLOT]:placedInPvf, 'foLab5-c9':[p.subjectId]},
      phase2V28:{groups:{'foLab5-c9':developedGroup()}}}));
    const result = aplicarPvfEnMapa(source, {prescripcion:p});
    assert.equal(result.conflicto.code, 'PVF_MATERIA_EN_OTRO_ESPACIO');
    assert.deepEqual(result.conflicto.actual.otrosSlots, ['foLab5-c9']);
    assert.deepEqual(result.mapa, source);
  }
});

test('distingue cuatro planes automáticos vacíos de textos, contenidos y extensiones propios', () => {
  assert.equal(grupoPvfConTrabajo(emptyGroup()), false);
  const automatic = emptyGroup();
  automatic.plansBimestrales[0] = {...automatic.plansBimestrales[0], name:'Nombre automático',
    autoName:true, autoNameSource:'motor'};
  assert.equal(grupoPvfConTrabajo(automatic), false);
  for (const change of [
    group => { group.name = 'Nombre elegido por la escuela'; },
    group => { group.contents.push('contenido'); },
    group => { group.plansBimestrales[0].name = 'Plan propio'; },
    group => { group.plansBimestrales[0].stages.produccion.activities = 'Producir una propuesta'; },
    group => { group.plansBimestrales[0].adjunto = {url:'material.pdf'}; },
    group => { group.plansBimestrales[0].updatedAt = '2026-11-21T23:00:00Z'; }
  ]) {
    const group = emptyGroup(); change(group);
    assert.equal(grupoPvfConTrabajo(group), true);
  }
  assert.equal(grupoPvfConTrabajo({plansBimestrales:{texto:'Formato anterior'}}), true);
  assert.equal(grupoPvfConTrabajo([]), true);
});

test('cambia A/B sólo con prescripción previa reconocida y sin desarrollo; no cambia alt', () => {
  for (const id of ['literatura', 'comunicacion', 'educacion_fisica', 'arte_teatro']) {
    const a = prescription(id, 'A'), b = prescription(id, 'B');
    const initial = aplicarPvfEnMapa(map({phase2V28:{groups:{[SLOT]:emptyGroup()}}}), {prescripcion:a}).mapa;
    const before = clone(initial), result = aplicarPvfEnMapa(freeze(initial), {prescripcion:b});
    assert.equal(result.estado, 'aplicado', id);
    assert.deepEqual(result.mapa.placements[SLOT], [b.subjectId], id);
    assert.deepEqual(result.mapa.pvfMedia, b, id);
    assert.equal(result.mapa.alt, 'A', 'El runtime decide cuándo cambiar de alternativa.');
    assert.deepEqual(result.mapa.phase2V28, before.phase2V28, id);
    assert.equal(result.mapa.phase2V28.groups[SLOT].plansBimestrales.length, 4);
    assert.deepEqual(initial, before, id);
  }
});

test('un ID compartido no reinterpreta los planes de Teatro A como Teatro B', () => {
  const a = prescription('arte_teatro', 'A'), b = prescription('arte_teatro', 'B');
  assert.equal(a.subjectId, b.subjectId);
  assert.notEqual(a.name, b.name);
  assert.notEqual(a.hours, b.hours);
  const seeded = aplicarPvfEnMapa(map(), {prescripcion:a}).mapa;
  seeded.phase2V28 = {groups:{[SLOT]:developedGroup()}};
  // Incluso si otro código ya alteró alt, la metadata preserva la identidad anterior.
  seeded.alt = 'B';
  const source = freeze(seeded), result = aplicarPvfEnMapa(source, {prescripcion:b});
  assert.equal(result.conflicto.code, 'PVF_TRABAJO_INCOMPATIBLE');
  assert.deepEqual(result.mapa, source);
  assert.equal(result.mapa.pvfMedia.name, a.name);
  assert.equal(result.conflicto.esperada.name, b.name);
});

test('con nombre, ID y horas iguales, A/B conserva los cuatro planes y actualiza sólo metadata', () => {
  const a = prescription('economia_administracion', 'A'), b = prescription('economia_administracion', 'B');
  const source = aplicarPvfEnMapa(map({placements:{[SLOT]:[a.subjectId]},
    phase2V28:{groups:{[SLOT]:developedGroup()}}}), {prescripcion:a}).mapa;
  source.pvfMedia.extension = {nota:'Conservar metadata adicional'};
  const before = clone(source), result = aplicarPvfEnMapa(freeze(source), {prescripcion:b});
  assert.equal(result.conflicto, null);
  assert.equal(result.mapa.pvfMedia.alternative, 'B');
  assert.deepEqual(result.mapa.pvfMedia.extension, before.pvfMedia.extension);
  assert.deepEqual(result.mapa.phase2V28, before.phase2V28);
  assert.deepEqual(result.mapa.placements, before.placements);
  assert.equal(result.mapa.valid, true);
  assert.equal(result.mapa.alt, 'A');
  assert.deepEqual(source, before);
});

test('sin metadata previa no se cambia de alternativa sobre una asignación existente', () => {
  const a = prescription('arte_teatro', 'A'), b = prescription('arte_teatro', 'B');
  const source = freeze(map({placements:{[SLOT]:[a.subjectId]}, phase2V28:{groups:{[SLOT]:emptyGroup()}}}));
  const result = aplicarPvfEnMapa(source, {prescripcion:b});
  assert.equal(result.conflicto.code, 'PVF_ALTERNATIVA_SIN_IDENTIDAD_PREVIA');
  assert.deepEqual(result.mapa, source);
});

test('desarrollo sin composición identificada, datos antiguos y contenidos propios se conservan', () => {
  for (const extra of [
    {phase2V28:{groups:{[SLOT]:developedGroup()}}},
    {phase2:{[SLOT]:{objectives:'Texto del formulario anterior'}}},
    {phase2V28:{groups:{[SLOT]:emptyGroup()}, customContents:[{id:'propio', groupId:SLOT, text:'Contenido propio'}]}}
  ]) {
    const source = freeze(map(extra)), result = aplicarPvfEnMapa(source, {prescripcion:prescription()});
    assert.equal(result.conflicto.code, 'PVF_TRABAJO_INCOMPATIBLE');
    assert.deepEqual(result.mapa, source);
  }
});

test('no normaliza composiciones duplicadas ni datos desconocidos para hacerlos pasar', () => {
  const p = prescription();
  for (const placements of [{[SLOT]:[p.subjectId, p.subjectId]}, {[SLOT]:p.subjectId}, []]) {
    const source = freeze(map({placements})), result = aplicarPvfEnMapa(source, {prescripcion:p});
    assert.equal(result.estado, 'conflicto');
    assert.deepEqual(result.mapa, source);
  }
  const source = freeze(map({pvfMedia:{version:'desconocida', contenido:'No eliminar'}}));
  const result = aplicarPvfEnMapa(source, {prescripcion:p});
  assert.equal(result.conflicto.code, 'PVF_IDENTIDAD_PREVIA_INVALIDA');
  assert.deepEqual(result.mapa, source);
  assert.throws(() => aplicarPvfEnMapa(map(), {prescripcion:{...p, hours:99}}), {code:'PVF_PRESCRIPCION_INVALIDA'});
});

test('cambio de materia con el mismo ID exige validar nuevamente el mapa', () => {
  const a = prescription('arte_teatro', 'A'), b = prescription('arte_teatro', 'B');
  const source = aplicarPvfEnMapa(map({placements:{[SLOT]:[a.subjectId]},
    phase2V28:{groups:{[SLOT]:emptyGroup()}}}), {prescripcion:a}).mapa;
  assert.equal(source.valid, true);
  const result = aplicarPvfEnMapa(freeze(source), {prescripcion:b});
  assert.equal(result.conflicto, null);
  assert.deepEqual(result.mapa.placements, source.placements);
  assert.equal(result.mapa.valid, false);
  assert.deepEqual(result.mapa.phase2V28, source.phase2V28);
});
