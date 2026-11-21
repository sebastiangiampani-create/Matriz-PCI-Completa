import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { materiasMotorMedia } from '../src/migracion/legado-fg-a-v2.mjs';

const raiz = new URL('../', import.meta.url);
const leer = path => readFileSync(new URL(path, raiz), 'utf8');
const html = leer('revision-v2-embed.html');
const rutas = html.match(/const\s+modulePaths\s*=\s*\[([\s\S]*?)\];/)?.[1];
assert.ok(rutas, 'La página debe declarar los módulos del motor que carga.');
const seleccionadas = [...rutas.matchAll(/['"]([^'"]*\/v23-prearm\.js)['"]/g)].map(match => match[1]);
assert.equal(seleccionadas.length, 1, 'La página debe cargar exactamente un módulo V23.');
const rutaSeleccionada = seleccionadas[0];
const fuenteSeleccionada = leer(rutaSeleccionada);
const fuenteOriginal = leer('vendor/pci-sec-aprende-v2/src/v23-prearm.js');
const materias = materiasMotorMedia(JSON.parse(leer('vendor/pci-sec-aprende-v2/data/materias-v2.json')));
const ORIENTACION = 'Economía y Administración';
const OTRA = 'Comunicación';
const copiar = value => JSON.parse(JSON.stringify(value));

function mapaVacio(extra = {}) {
  return { alt: 'A', mode: 'one', socialOption: 'A', custom: [], valid: true,
    placements: {}, prearmVersion: 1, phase2V28: { groups: {}, customContents: [] }, ...extra };
}

function cargar({ mapa = mapaVacio(), otros = {}, importar = false,
  hook = true, fuente = fuenteSeleccionada } = {}) {
  const state = { active: ORIENTACION, maps: { [ORIENTACION]: mapa, ...otros } };
  const contadores = { save: 0, renderOffer: 0, renderPanel: 0 };
  const protegidos = new WeakSet(importar ? [mapa] : []);
  const sandbox = {
    state, window: {},
    ensure: key => state.maps[key],
    fg: () => materias,
    byId: id => materias.find(s => s.id === id),
    save: () => { contadores.save++; },
    renderOffer: () => { contadores.renderOffer++; },
    renderPanel: () => { contadores.renderPanel++; },
    validTarget: () => [false, 'Regla original'],
    document: { getElementById: () => null }
  };
  vm.runInNewContext(fuente, sandbox, { filename: rutaSeleccionada });
  // El puente se instala después de cargar los módulos: el guard debe leer
  // dinámicamente la identidad del mapa, no capturar un indicador al arrancar.
  if (hook) sandbox.window.__pciPreserveImportedMap = map => protegidos.has(map);
  return { sandbox, state, contadores, protegidos };
}

function ejecutar(entorno, entrada) {
  return entrada === '__pciEnsurePrearm'
    ? entorno.sandbox.window.__pciEnsurePrearm()
    : entorno.sandbox[entrada]();
}

for (const entrada of ['renderOffer', 'renderPanel', '__pciEnsurePrearm']) {
  test(`un mapa vacío importado queda intacto y sin save al entrar por ${entrada}`, () => {
    const mapa = mapaVacio(), antes = copiar(mapa);
    const entorno = cargar({ mapa, importar: true });
    const retorno = ejecutar(entorno, entrada);
    assert.deepEqual(copiar(mapa), antes,
      `${entrada} no debe completar FG ni alterar la composición importada explícitamente.`);
    assert.equal(entorno.contadores.save, 0, 'La visualización de la importación no debe guardar un prearmado.');
    if (entrada === '__pciEnsurePrearm') assert.equal(retorno, false);
    else assert.equal(entorno.contadores[entrada], 1, 'La función original de render debe seguir ejecutándose.');
  });
}

test('el mapa importado sin placements tampoco recibe inicialización ni otros cambios', () => {
  const mapa = mapaVacio();
  delete mapa.placements;
  const antes = copiar(mapa), entorno = cargar({ mapa, importar: true });
  assert.equal(entorno.sandbox.window.__pciEnsurePrearm(), false);
  assert.deepEqual(copiar(mapa), antes);
  assert.equal(Object.hasOwn(mapa, 'placements'), false);
  assert.equal(entorno.contadores.save, 0);
});

test('un mapa vacío no marcado conserva el prearmado FG del módulo original', () => {
  const actual = cargar();
  const original = cargar({ fuente: fuenteOriginal, hook: false });
  for (const entrada of ['renderOffer', 'renderPanel', '__pciEnsurePrearm']) {
    const resultadoActual = ejecutar(actual, entrada);
    const resultadoOriginal = ejecutar(original, entrada);
    assert.equal(resultadoActual, resultadoOriginal);
  }
  assert.deepEqual(copiar(actual.state), copiar(original.state));
  assert.deepEqual(actual.contadores, original.contadores);
  assert.equal(actual.contadores.save, 1);
  assert.ok(Object.keys(actual.state.maps[ORIENTACION].placements).length > 0);
  assert.deepEqual(copiar(actual.state.maps[ORIENTACION].placements['matematica-n1']), ['fg-1-matematica']);
  assert.equal(actual.state.maps[ORIENTACION].valid, false);
});

test('sin el hook del puente se conserva íntegramente el comportamiento original', () => {
  const actual = cargar({ hook: false });
  const original = cargar({ fuente: fuenteOriginal, hook: false });
  assert.equal(actual.sandbox.window.__pciEnsurePrearm(), original.sandbox.window.__pciEnsurePrearm());
  assert.deepEqual(copiar(actual.state), copiar(original.state));
  assert.deepEqual(actual.contadores, original.contadores);
  assert.equal(actual.contadores.save, 1);
});

test('otro mapa no importado se prearma sin alterar el mapa importado', () => {
  const importado = mapaVacio(), antes = copiar(importado);
  const entorno = cargar({ mapa: importado, importar: true, otros: { [OTRA]: mapaVacio() } });
  entorno.state.active = OTRA;
  entorno.sandbox.renderOffer();
  assert.ok(Object.keys(entorno.state.maps[OTRA].placements).length > 0);
  assert.equal(entorno.contadores.save, 1);
  assert.deepEqual(copiar(entorno.state.maps[ORIENTACION]), antes);
  entorno.state.active = ORIENTACION;
  assert.equal(entorno.sandbox.window.__pciEnsurePrearm(), false);
  assert.equal(entorno.contadores.save, 1);
  assert.deepEqual(copiar(entorno.state.maps[ORIENTACION]), antes);
});

test('la protección corresponde a la identidad importada, no a todas las instancias de esa orientación', () => {
  const importado = mapaVacio(), antes = copiar(importado);
  const entorno = cargar({ mapa: importado, importar: true });
  const nuevo = mapaVacio();
  entorno.state.maps[ORIENTACION] = nuevo;
  assert.equal(entorno.sandbox.window.__pciEnsurePrearm(), true);
  assert.ok(Object.keys(nuevo.placements).length > 0);
  assert.equal(entorno.contadores.save, 1);
  assert.deepEqual(copiar(importado), antes);
});

test('un mapa con FG y prearmVersion 1 conserva las decisiones igual que el módulo original', () => {
  const base = mapaVacio({ placements: { 'matematica-n1': ['fg-1-matematica'] },
    phase2V28: { groups: { 'matematica-n1': { objectives: 'Trabajo institucional' } }, customContents: [] } });
  for (const importar of [false, true]) {
    const actual = cargar({ mapa: copiar(base), importar });
    const original = cargar({ mapa: copiar(base), fuente: fuenteOriginal, hook: false });
    for (const entrada of ['renderOffer', 'renderPanel', '__pciEnsurePrearm']) {
      assert.equal(ejecutar(actual, entrada), ejecutar(original, entrada));
    }
    assert.deepEqual(copiar(actual.state), copiar(original.state));
    assert.deepEqual(copiar(actual.state.maps[ORIENTACION]), base);
    assert.deepEqual(actual.contadores, original.contadores);
    assert.equal(actual.contadores.save, 0);
  }
});
