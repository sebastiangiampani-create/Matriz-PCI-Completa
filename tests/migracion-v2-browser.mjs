/**
 * Paso 2: migración simulada en revision-v2-embed.html, sin servicios externos.
 * Ejecutar desde la raíz del repositorio:
 *   CHROME_BIN=/ruta/a/chromium node tests/migracion-v2-browser.mjs
 * Requiere Playwright. PCI_MIGRATION_ARTIFACTS permite elegir la carpeta de salida.
 * Solo agrega evidencias; no modifica la aplicación ni accede a Supabase.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, sep, extname } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadV2Fg } from '../src/integracion-curricular/catalogos.js';
import { migrarLegadoFgAV2, materiasMotorMedia } from '../src/migracion/legado-fg-a-v2.mjs';
import { aplicarMigracionEnEstadoV2 } from '../src/migracion/aplicar-en-v2.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = process.cwd();
const artifacts = resolve(process.env.PCI_MIGRATION_ARTIFACTS || 'test-artifacts/migracion-v2');
const orientation = 'Economía y Administración';
const school = 'Escuela simulada · Migración FG';
const fecha = '2026-11-21T19:00:00.000Z';
const controlId = 'fgv103:128b15a3f8d5c644';
const socialSlots = ['socialA-c5', 'socialB-c5', 'socialA-c6', 'socialB-c6'];
const stages = ['punto_partida', 'indagacion', 'produccion', 'evaluacion'];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const norm = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
await mkdir(artifacts, { recursive: true });

const protectedPaths = execFileSync('git', ['ls-files', '-z', '--', 'vendor/',
  'src/v2-familia/', 'src/migracion/legado-fg-a-v2.mjs',
  'src/migracion/aplicar-en-v2.mjs', 'revision-v2-embed.html'], { encoding: 'utf8' })
  .split('\0').filter(Boolean);
const fingerprints = async () => Object.fromEntries(await Promise.all(protectedPaths.map(async path =>
  [path, sha256(await readFile(resolve(root, path)))])));
const protectedBefore = await fingerprints();
const catalog = await loadV2Fg({
  base: 'vendor/pci-sec-aprende-v2/data/curriculum_v103',
  fetchFn: async path => new Response(await readFile(resolve(root, path)))
});
const motor = materiasMotorMedia(JSON.parse(await readFile(
  'vendor/pci-sec-aprende-v2/data/materias-v2.json', 'utf8')));
const control = catalog.find(row => row.id === controlId);
assert.equal(control?.year, 3, 'El contenido de control debe pertenecer a 3.º.');
const socialSubjects = ['Historia', 'Economía', 'Geografía', 'Formación Ética y Ciudadana'];
const socialContents = socialSubjects.map(subject => {
  const row = catalog.find(candidate => candidate.year === 3 && candidate.subject === subject &&
    catalog.filter(other => other.year === 3 && other.subject === subject &&
      norm(other.text) === norm(candidate.text)).length === 1);
  assert.ok(row, `Falta una referencia unívoca para ${subject}.`);
  return row;
});
// El estado escolar y los IDs históricos son simulados. Los textos e IDs de
// destino, las materias, el migrador, el adaptador y el motor son los reales.
const matrixRows = [control, ...socialContents].map((row, i) => ({
  id: `simulado-${i}`, area: row.area, subject: row.subject, axis: row.axis, text: row.text
}));
function plan(name, contentIds) {
  return { number: 1, name: `Plan simulado · ${name}`, autoName: false,
    synopsis: 'Secuencia de prueba para comprobar la conservación del desarrollo pedagógico.',
    objectives: 'Analizar situaciones, explicar procedimientos y fundamentar conclusiones.',
    contentIds: [...contentIds], updatedAt: null,
    stages: Object.fromEntries(stages.map((stage, i) => [stage, {
      description: `Etapa ${i + 1} del plan de prueba`, duration: 'Dos clases',
      resources: 'Consignas y materiales de la secuencia simulada',
      activities: `Actividad simulada ${i + 1}: registrar, analizar y comunicar lo trabajado.`
    }])) };
}
function legacyGroup(id, level, startTerm, items, name) {
  return { id, level, startTerm, name, items, objective: 'Objetivo del agrupamiento simulado',
    synopsis: 'Datos de prueba, sin información de escuelas reales.',
    context: 'Situación problematizadora de la prueba de migración.',
    plansBimestrales: [plan(name, items)] };
}
function fixture(alsoInThird) {
  const maths = [legacyGroup('mat-1', 1, 1, ['simulado-0'], 'Matemática · Nivel 1')];
  if (alsoInThird) maths.push(legacyGroup('mat-3', 3, 5, ['simulado-0'], 'Matemática · Nivel 3'));
  const legacyState = { areas: {
    'Matemática': { groups: maths },
    'Ciencias Sociales': { groups: socialSlots.map((slot, i) => legacyGroup(
      `social-${i}`, 3, Number(slot.at(-1)),
      i % 2 ? ['simulado-3', 'simulado-4'] : ['simulado-1', 'simulado-2'],
      `Laboratorio de Sociales ${slot.startsWith('socialB') ? 'B' : 'A'} · C${slot.at(-1)}`
    )) }
  } };
  const state = { school, active: orientation, selected: [orientation], maps: {
    [orientation]: { alt: 'A', mode: 'one', custom: [], valid: false, placements: {},
      // Metadato existente: este mapa de prueba ya tiene definida su composición.
      prearmVersion: 1 }
  }, legacy_state: structuredClone(legacyState) };
  const before = structuredClone({ legacyState, state });
  const migration = migrarLegadoFgAV2({ legacyState, matrixRows, v2FgRows: catalog,
    model: { model: 'media', subjects: motor }, orientationId: orientation });
  assert.equal(migration.socialOption, 'B');
  assert.deepEqual(migration.groups['matematica-n1'].contents, [controlId]);
  assert.equal(migration.pendientes.length, 0, 'La muestra debe tener equivalencias exactas.');
  const migrated = aplicarMigracionEnEstadoV2(state, { ...migration, fecha });
  assert.deepEqual({ legacyState, state }, before, 'La preparación no modifica las entradas.');
  assert.deepEqual(migrated.legacy_state, legacyState);
  assert.deepEqual(migrated.maps[orientation].conflictos, []);
  assert.deepEqual(migrated.maps[orientation].phase2V28.groups['matematica-n1']
    .plansBimestrales[0].contentIds, [controlId]);
  assert.deepEqual(migrated.maps[orientation].phase2V28.groups['socialB-c5']
    .plansBimestrales[0].contentIds, socialContents.slice(2).map(row => row.id));
  return { migrated, migration };
}
const scenarios = [fixture(false), fixture(true)];

const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405); res.end(); return;
    }
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + decodeURIComponent(pathname));
    const rel = relative(root, file);
    if (rel === '..' || rel.startsWith('..' + sep)) throw Error('Ruta fuera del repositorio.');
    const bytes = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; form-action 'none'; base-uri 'self'; object-src 'none'" });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const report = { paso: 2, fechaEjecucion: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  pagina: 'revision-v2-embed.html', datos: 'Estado escolar simulado y catálogos oficiales locales',
  contenidoControl: control, dispositivos: [], capturas: [], errores: [],
  inicializaciones: [], fallosDePlanes: [], geometriaCapturas: [],
  solicitudesSupabase: [], otrasSolicitudesExternasBloqueadas: [], fuentesRemotasSustituidas: 0 };

async function settleView(page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const sample = () => {
      const shell = document.querySelector('#v38modal:not([hidden]) #v38shell');
      const r = shell?.getBoundingClientRect();
      return { scrollX, scrollY, visualX: visualViewport.offsetLeft,
        visualY: visualViewport.offsetTop, width: visualViewport.width,
        height: visualViewport.height, shellTop: r?.top ?? null,
        shellScroll: shell?.scrollTop ?? null };
    };
    // V42 usa desplazamiento suave. Una captura mientras sigue moviéndose
    // puede recortar incluso un modal fijo; esperar estabilidad, sin alterar CSS.
    return new Promise((resolve, reject) => {
      let previous, stable = 0;
      const start = performance.now();
      const frame = () => {
        const current = sample(), key = JSON.stringify(current);
        stable = key === previous ? stable + 1 : 0;
        if (stable >= 4) return resolve(current);
        if (performance.now() - start > 5000)
          return reject(Error('La vista no se estabilizó antes de la captura.'));
        previous = key;
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  });
}
async function screenshot(page, file) {
  const before = await settleView(page);
  await page.screenshot({ path: resolve(artifacts, file), fullPage: false });
  const after = await settleView(page);
  report.geometriaCapturas.push({ archivo: file, antes: before, despues: after });
  assert.deepEqual(after, before, `${file}: la vista debe permanecer estable durante la captura.`);
  report.capturas.push(file);
}
async function importState(page, pci, data) {
  await page.goto(`${origin}/revision-v2-embed.html?${new URLSearchParams({ pci, orientation, school })}`,
    { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.PCIPhase2V28 && window.PCICoverageV91 &&
    document.querySelector('#offer.active'), null, { timeout: 30000 });
  // v80 aplica el acceso dos veces al arrancar (1400 ms desde app-ready y
  // 2200 ms desde su carga). Cada aplicación puede volver al inicio de Fase 2.
  // Observar su finalización evita navegar sobre una aplicación aún iniciándose.
  await page.waitForFunction(() => window.__paso2Arranque?.iniciosV80.length === 2,
    null, { timeout: 15000 });
  report.inicializaciones.push({ pci, ...await page.evaluate(() => window.__paso2Arranque) });
  await page.evaluate(({ pci, document }) => window.postMessage({ type: 'V2_IMPORT', pci, document }, location.origin),
    { pci, document: data.migrated });
  await page.waitForFunction(({ orientation, fecha }) =>
    state.maps[orientation]?.migracionLegado?.fecha === fecha, { orientation, fecha }, { timeout: 20000 });
  await page.locator('#matrix .drop[data-slot="socialB-c6"]').waitFor();
  await page.evaluate(async () => { await PCIPhase2V28.loadCurriculum(); await PCICoverageV91.ready(); });
  for (const [slot, ids] of Object.entries(data.migration.placements)) {
    const cell = page.locator(`#matrix .drop[data-slot="${slot}"]`);
    await cell.waitFor();
    for (const id of ids) assert.equal(await cell.locator(`[data-map-id="${id}"]`).count(), 1,
      `${slot}: debe mostrarse la materia ${id}.`);
  }
  const current = await page.evaluate(() => structuredClone(state.maps[state.active]));
  assert.equal(current.socialOption, 'B');
  for (const slot of Object.keys(data.migration.groups)) {
    assert.deepEqual(current.placements[slot], data.migration.placements[slot]);
    assert.deepEqual(current.phase2V28.groups[slot].contents, data.migration.groups[slot].contents);
  }
  const socialCount = await page.evaluate(() => PCIPhase2V28.groups().filter(g => g.area === 'Ciencias Sociales').length);
  assert.equal(socialCount, 12, 'La opción B debe crear 12 laboratorios de Sociales.');
  return socialCount;
}
async function area(page, name) {
  await page.locator('#pciGlobalDock [data-dock="proposal"]').click();
  await page.locator('#v28home').waitFor({ state: 'visible' });
  await page.locator(`#v28home [data-area="${name}"]`).click();
  await page.locator('#v28board').waitFor({ state: 'visible' });
  await page.locator('#v28groups [data-g]').first().waitFor();
  await page.locator('#v28groups [data-g] .v97-group-coverage').first().waitFor();
}
async function modalGeometry(page) {
  await settleView(page);
  const geometry = await page.evaluate(() => {
    const rect = selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width,
        top: r.top, bottom: r.bottom, height: r.height };
    };
    const shell = document.querySelector('#v38shell');
    return { innerWidth, innerHeight, visualWidth: visualViewport.width,
      visualHeight: visualViewport.height, visualTop: visualViewport.offsetTop,
      modal: rect('#v38modal'), shell: rect('#v38shell'), close: rect('#v38modal [data-close]'),
      scrollWidth: shell.scrollWidth, clientWidth: shell.clientWidth,
      scrollTop: shell.scrollTop, scrollLeft: shell.scrollLeft };
  });
  const width = page.viewportSize().width;
  const height = page.viewportSize().height;
  assert.ok(Math.abs(geometry.innerWidth - width) <= 1,
    `El modal no debe expandir el viewport: ${JSON.stringify(geometry)}.`);
  for (const key of ['modal', 'shell', 'close']) {
    assert.ok(geometry[key].left >= -1 && geometry[key].right <= width + 1,
      `${key} debe quedar dentro de la pantalla: ${JSON.stringify(geometry)}.`);
    assert.ok(geometry[key].top >= -1 && geometry[key].bottom <= height + 1,
      `${key} debe verse completo en altura: ${JSON.stringify(geometry)}.`);
  }
  assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1,
    `El editor no debe desbordarse horizontalmente: ${JSON.stringify(geometry)}.`);
  assert.equal(geometry.scrollLeft, 0);
  return geometry;
}
async function checkPlan(page, slot, expected, expectedIds, count, capture) {
  const button = page.locator(`#v28groups [data-g="${slot}"] [data-plans]`);
  await button.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await button.click();
  const listGeometry = await modalGeometry(page);
  await page.locator('[data-open="1"]').click();
  const editor = page.locator('#v38plan');
  await editor.waitFor();
  const editorGeometry = await modalGeometry(page);
  assert.equal(editorGeometry.scrollTop, 0, 'El editor debe abrirse desde el comienzo.');
  assert.equal(await editor.locator('[data-pfield="name"]').inputValue(), expected.name);
  assert.equal(await editor.locator('[data-pfield="synopsis"]').inputValue(), expected.synopsis);
  assert.equal(await editor.locator('[data-pfield="objectives"]').inputValue(), expected.objectives);
  for (const stage of stages) for (const field of ['description', 'duration', 'resources', 'activities']) {
    assert.equal(await editor.locator(`[data-stage="${stage}"][data-sfield="${field}"]`).inputValue(),
      expected.stages[stage][field], `${slot}: conservar ${stage}.${field}.`);
  }
  const selectedIds = await editor.locator('[data-pcontent]:checked').evaluateAll(
    elements => elements.map(el => el.dataset.pcontent));
  assert.deepEqual(selectedIds.sort(), [...expectedIds].sort(),
    `${slot}: las selecciones históricas deben estar marcadas con sus IDs V2.`);
  assert.match(await page.locator('.v38-top h2').innerText(), new RegExp(`1 de ${count}`));
  if (capture) await screenshot(page, capture);
  // La vuelta desde el final del formulario debe abrir la lista arriba y
  // permitir volver al editor mediante los botones normales de la interfaz.
  await editor.locator('[data-back-footer]').click();
  assert.equal((await modalGeometry(page)).scrollTop, 0);
  await page.locator('[data-open="1"]').click();
  await editor.waitFor();
  assert.equal((await modalGeometry(page)).scrollTop, 0);
  assert.deepEqual((await editor.locator('[data-pcontent]:checked').evaluateAll(
    elements => elements.map(el => el.dataset.pcontent))).sort(), [...expectedIds].sort());
  await page.locator('.v38-top [data-close]').click();
  return { resultado: 'aprobado', cantidadPlanes: count, contenidosSeleccionados: selectedIds,
    camposYCuatroEtapasConservados: true, reapertura: true, lista: listGeometry, editor: editorGeometry };
}
async function recordPlan(page, record, slot, expected, expectedIds, count, capture, field) {
  try {
    record[field] = await checkPlan(page, slot, expected, expectedIds, count, capture);
  } catch (error) {
    // Conservar el fallo y continuar los casos independientes. El resultado
    // global sigue siendo fallido mientras cualquier editor no pueda abrirse.
    const geometria = await page.evaluate(() => {
      const describe = el => {
        if (!el) return null;
        const r = el.getBoundingClientRect(), css = getComputedStyle(el);
        return { tag: el.tagName, id: el.id, clase: el.className,
          texto: el.textContent.trim().slice(0,180),
          rect: { x:r.x, y:r.y, width:r.width, height:r.height },
          clientWidth:el.clientWidth, scrollWidth:el.scrollWidth, scrollLeft:el.scrollLeft,
          minWidth:css.minWidth, gridTemplateColumns:css.gridTemplateColumns,
          contentVisibility:css.contentVisibility,
          overflowX: css.overflowX, pointerEvents: css.pointerEvents };
      };
      const button = document.querySelector('#v38modal [data-open="1"]');
      const r = button?.getBoundingClientRect();
      return { viewport: { innerWidth, innerHeight, scrollX, scrollY,
          visual: visualViewport && { width:visualViewport.width, height:visualViewport.height,
            scale:visualViewport.scale, offsetLeft:visualViewport.offsetLeft, offsetTop:visualViewport.offsetTop } },
        boton: describe(button), modal: describe(document.querySelector('#v38modal')),
        contenedor: describe(document.querySelector('#v38modal .v38-shell')),
        cabecera: describe(document.querySelector('#v38modal .v38-top')),
        elementos: [...document.querySelectorAll('#v38modal .v38-body, #v38modal .v38-grid, #v38modal .v38-card, #v38modal .v95-coverage-table')].map(describe),
        enCentroDelBoton: r ? document.elementsFromPoint(r.x+r.width/2,r.y+r.height/2).slice(0,5).map(describe) : [] };
    });
    const fallo = { dispositivo:record.dispositivo, slot, error:error.stack, geometria };
    record[field] = { resultado:'fallido', ...fallo };
    report.fallosDePlanes.push(fallo);
    await screenshot(page, capture.replace('.png','-error.png'));
    console.error(`${record.dispositivo}: fallo conservado al abrir el plan de ${slot}.`);
  }
}
async function coverage(page, duplicate) {
  const data = await page.evaluate(controlId => {
    const all = PCIPhase2V28.groups(), core = PCICoverageV91;
    const levels = [1, 2, 3, 4, 5].map(year => {
      const g = all.find(g => g.area === 'Matemática' && Number(g.year) === year);
      const c = core.groupingLevelCoverage(g, all);
      return { nivel: year, usados: c.used, total: c.total, porcentaje: c.percent };
    });
    const first = all.find(g => g.id === 'matematica-n1');
    const third = all.find(g => g.id === 'matematica-n3');
    const trajectory = core.trajectoryCoverage('Matemática', all);
    return { niveles: levels, trayectoria: { usados: trajectory.used, total: trajectory.total },
      fueraDeNivelEnPrimero: core.formatCoverage(first).offLevel,
      planPrimero: core.planCoverage(first, [controlId]).annual.used,
      planTercero: core.planCoverage(third, [controlId]).annual.used,
      ubicadoEn: all.filter(g => g.data.contents.includes(controlId)).map(g => g.id) };
  }, controlId);
  assert.deepEqual(data.niveles.map(n => n.usados), duplicate ? [0, 0, 1, 0, 0] : [0, 0, 0, 0, 0]);
  assert.equal(data.trayectoria.usados, duplicate ? 1 : 0);
  assert.equal(data.fueraDeNivelEnPrimero, 1);
  assert.equal(data.planPrimero, 0);
  assert.equal(data.planTercero, 1, 'La API de planes reconoce el contenido en su nivel propio.');
  assert.deepEqual(data.ubicadoEn.sort(), duplicate ? ['matematica-n1', 'matematica-n3'] : ['matematica-n1']);
  return data;
}
async function coveragePanel(page, duplicate, capture) {
  await page.evaluate(() => PCICoverageDashboardV93.open());
  await page.locator('#v98dArea').selectOption('Matemática');
  await page.locator('#v98dLevel').selectOption('3');
  const results = page.locator('#v98dResults');
  await results.locator('.v98d-level').first().waitFor();
  assert.match(await results.innerText(), duplicate ? /1\s*\/\s*16/ : /0\s*\/\s*16/);
  await results.scrollIntoViewIfNeeded();
  await screenshot(page, capture);
}
async function coverageHeader(page, duplicate) {
  await area(page, 'Matemática');
  const data = await page.evaluate(() => {
    const c = PCIPhase2V28.getCoverage('Matemática');
    return { texto: document.querySelector('#v47coverageCount').innerText,
      usadosEsSet: c.used instanceof Set, usados: [...c.used], total: c.total,
      porcentaje: c.percent, componente: c.component };
  });
  assert.equal(data.usadosEsSet, true, 'El encabezado debe conservar el contrato Set de V2.');
  assert.deepEqual(data.usados, duplicate ? [controlId] : []);
  assert.equal(data.total, 68);
  assert.equal(data.porcentaje, duplicate ? 1.5 : 0);
  assert.equal(data.componente, 'FG');
  assert.match(data.texto, duplicate ? /^1 de 68\b/ : /^0 de 68\b/);
  return data;
}

let browser;
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}) });
  report.navegador = await browser.version();
  for (const device of [
    { nombre: 'escritorio', viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false },
    { nombre: 'celular', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
  ]) {
    console.log(`Iniciando ${device.nombre}: mapa, Fase 2, planes y cobertura.`);
    const context = await browser.newContext({ viewport: device.viewport, isMobile: device.isMobile,
      hasTouch: device.hasTouch, deviceScaleFactor: 1, serviceWorkers: 'block' });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) {
        if (url.pathname.endsWith('/data/materias-v2.json')) {
          // init() espera este GET después de instalar los módulos. El listener
          // es pasivo: no altera sesiones, funciones, callbacks ni estado V2.
          await route.request().frame().evaluate(() => {
            if (!window.PCIAppAccessV80) throw Error('El observador requiere el módulo de acceso instalado.');
            window.__paso2Arranque = { eventos: [], iniciosV80: [] };
            window.addEventListener('pci-access-changed', event => {
              const pila = new Error().stack;
              const record = { tiempo: performance.now(), rol: event.detail.role, pila,
                tableroVisible: !!document.querySelector('#v28board:not([hidden])'),
                pantalla: document.querySelector('.screen.active')?.id };
              window.__paso2Arranque.eventos.push(record);
              if (/\bat start\s*\(/.test(pila) && !pila.includes('applyProfile'))
                window.__paso2Arranque.iniciosV80.push(record);
            });
          });
        }
        return route.continue();
      }
      if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) {
        report.fuentesRemotasSustituidas++;
        return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
      }
      if (/supabase/i.test(url.hostname)) report.solicitudesSupabase.push(url.href);
      else report.otrasSolicitudesExternasBloqueadas.push(url.href);
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.errores.push({ dispositivo: device.nombre, error: error.message }));
    const record = { dispositivo: device.nombre, viewport: device.viewport };
    report.dispositivos.push(record);
    try {
      record.laboratoriosSociales = await importState(page, `sim-migracion-${device.nombre}-a`, scenarios[0]);
      await page.locator('#toggleBag').click();
      await page.locator('#matrix .drop[data-slot="socialB-c5"]').scrollIntoViewIfNeeded();
      await screenshot(page, `${device.nombre}-01-mapa-opcion-b.png`);

      // Cobertura en casos independientes antes de los editores: una falla de
      // interacción en un modal no puede impedir que se compruebe el cálculo.
      record.soloEnPrimero = await coverage(page, false);
      record.encabezadoSoloEnPrimero = await coverageHeader(page, false);
      await coveragePanel(page, false, `${device.nombre}-05-cobertura-solo-en-primero.png`);
      await importState(page, `sim-migracion-${device.nombre}-b`, scenarios[1]);
      record.enPrimeroYTercero = await coverage(page, true);
      record.encabezadoEnPrimeroYTercero = await coverageHeader(page, true);
      await coveragePanel(page, true, `${device.nombre}-06-cobertura-en-tercero.png`);
      await importState(page, `sim-migracion-${device.nombre}-a-desarrollo`, scenarios[0]);

      await area(page, 'Ciencias Sociales');
      for (const slot of socialSlots) {
        const card = page.locator(`#v28groups [data-g="${slot}"]`);
        await card.locator('.v28-assigned-wrap').scrollIntoViewIfNeeded();
        assert.ok(await card.locator('.v28-assigned').first().isVisible(),
          `${slot}: los contenidos no deben estar ocultos.`);
        for (const id of scenarios[0].migration.groups[slot].contents) {
          const content = catalog.find(row => row.id === id);
          assert.ok((await card.locator('.v28-assigned').allTextContents()).some(t => t.includes(content.text)),
            `${slot}: el contenido debe verse en Fase 2.`);
        }
      }
      record.contenidosSocialesVisibles = true;
      await page.locator('#v28groups [data-g="socialB-c5"] .v28-assigned-wrap').evaluate(
        el => el.scrollIntoView({ block: 'center' }));
      await screenshot(page, `${device.nombre}-02-contenidos-sociales.png`);
      await recordPlan(page, record, 'socialB-c5', scenarios[0].migration.groups['socialB-c5'].plansBimestrales[0],
        socialContents.slice(2).map(row => row.id), 2,
        `${device.nombre}-03-plan-cuatrimestral.png`, 'planCuatrimestral');

      // Un modal bloqueado no debe impedir los casos independientes. Reiniciar
      // solo el PCI simulado conserva el fallo anterior y no toca la interfaz.
      if (record.planCuatrimestral?.resultado === 'fallido')
        await importState(page, `sim-migracion-${device.nombre}-a-matematica`, scenarios[0]);
      await area(page, 'Matemática');
      const mathCard = page.locator('#v28groups [data-g="matematica-n1"]');
      // Leer el texto efectivamente renderizado, conservando la comprobación
      // exacta que detectó el problema de las tarjetas en celular.
      await mathCard.locator('.v28-assigned-wrap').scrollIntoViewIfNeeded();
      await mathCard.locator('.v28-assigned').waitFor({ state: 'visible' });
      record.contenidoMatematica = await mathCard.locator('.v28-assigned').evaluate(el => ({
        texto: el.innerText, visible: el.checkVisibility({ contentVisibilityAuto: true }),
        renderizadoTarjeta: getComputedStyle(el.closest('.v28-group')).contentVisibility
      }));
      assert.ok(record.contenidoMatematica.texto.includes(control.text),
        `El texto completo debe verse en Matemática: ${JSON.stringify(record.contenidoMatematica)}.`);
      record.contenidoDeTerceroVisibleEnPrimero = true;
      assert.match(await page.locator('#v47coverageCount').innerText(), /^0 de 68\b/);
      await recordPlan(page, record, 'matematica-n1', scenarios[0].migration.groups['matematica-n1'].plansBimestrales[0],
        [controlId], 4,
        `${device.nombre}-04-plan-anual.png`, 'planAnual');
      record.resultado = report.fallosDePlanes.some(f => f.dispositivo === device.nombre) ? 'fallido' : 'aprobado';
      console.log(`${device.nombre}: ${record.resultado}; mapa, contenidos, editores y cobertura registrados.`);
    } catch (error) {
      record.resultado = 'fallido'; record.error = error.stack;
      await screenshot(page, `${device.nombre}-error.png`).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
  assert.deepEqual(report.solicitudesSupabase, [], 'La prueba no debe solicitar Supabase.');
  assert.deepEqual(report.otrasSolicitudesExternasBloqueadas, [], 'No debe haber solicitudes externas inesperadas.');
  assert.deepEqual(report.errores, [], 'La aplicación debe funcionar sin errores JavaScript.');
  assert.deepEqual(await fingerprints(), protectedBefore, 'Motor, migrador, adaptador y página deben permanecer intactos.');
  report.archivosProtegidosVerificados = protectedPaths.length;
  assert.deepEqual(report.fallosDePlanes.map(f => `${f.dispositivo}: ${f.slot}`), [],
    'Todos los planes deben abrirse por la interfaz; los fallos registrados no se omiten.');
  report.resultado = 'aprobado';
  console.log('PASO 2 APROBADO: escritorio y celular; cero solicitudes a Supabase; código de aplicación intacto.');
} catch (error) {
  report.resultado = 'fallido'; report.error = error.stack;
  process.exitCode = 1;
  console.error(error.stack);
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
  await writeFile(resolve(artifacts, 'resultado-paso-2.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Evidencia: ${resolve(artifacts, 'resultado-paso-2.json')}`);
}
