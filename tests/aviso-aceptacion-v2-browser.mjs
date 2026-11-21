/**
 * Paso 3: aviso de aceptación dentro del constructor V2 existente.
 * Usa exclusivamente estados simulados y catálogos locales. No inicia guardado
 * remoto, no solicita Supabase y no modifica archivos de aplicación.
 * CHROME_BIN selecciona el ejecutable de Chrome; PCI_ACCEPTANCE_ARTIFACTS, la salida.
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

const { chromium } = createRequire(import.meta.url)('playwright');
const root = process.cwd();
const artifacts = resolve(process.env.PCI_ACCEPTANCE_ARTIFACTS || 'test-artifacts/migracion-v2-paso3');
const orientation = 'Economía y Administración';
const school = 'Escuela simulada · Aceptación de migración';
const controlId = 'fgv103:128b15a3f8d5c644';
const socialSlots = ['socialA-c5', 'socialB-c5', 'socialA-c6', 'socialB-c6'];
const stages = ['punto_partida', 'indagacion', 'produccion', 'evaluacion'];
const pendingText = 'Contenido pendiente <img src="x" onerror="window.__paso3Xss=true">';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const norm = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
await mkdir(artifacts, { recursive: true });

const protectedPaths = execFileSync('git', ['ls-files', '-z', '--', 'vendor/',
  'src/v2-familia/', 'src/migracion/', 'src/orientaciones-online.mjs', 'revision-v2-embed.html'],
{ encoding: 'utf8' }).split('\0').filter(Boolean);
const fingerprints = async () => Object.fromEntries(await Promise.all(protectedPaths.map(async path =>
  [path, createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')])));
const protectedBefore = await fingerprints();
const catalog = await loadV2Fg({ base: 'vendor/pci-sec-aprende-v2/data/curriculum_v103',
  fetchFn: async path => new Response(await readFile(resolve(root, path))) });
const motor = materiasMotorMedia(JSON.parse(await readFile(
  'vendor/pci-sec-aprende-v2/data/materias-v2.json', 'utf8')));
const control = catalog.find(row => row.id === controlId);
assert.equal(control?.year, 3);
const socialContents = ['Historia', 'Economía', 'Geografía', 'Formación Ética y Ciudadana'].map(subject => {
  const row = catalog.find(candidate => candidate.year === 3 && candidate.subject === subject &&
    catalog.filter(other => other.year === 3 && other.subject === subject &&
      norm(other.text) === norm(candidate.text)).length === 1);
  assert.ok(row, `Referencia unívoca necesaria para ${subject}.`);
  return row;
});
const matrixRows = [control, ...socialContents].map((row, i) => ({ id: `paso3-${i}`,
  area: row.area, subject: row.subject, axis: row.axis, text: row.text }));
matrixRows.push({ id: 'paso3-pendiente', area: 'Matemática', subject: 'Matemática',
  axis: 'Contenido sin equivalencia', text: pendingText });
function plan(name, items) {
  return { number: 1, name: `Plan bimestral · ${name}`, autoName: false,
    synopsis: 'Secuencia simulada para verificar la aceptación del traslado.',
    objectives: 'Explicar procedimientos y fundamentar conclusiones.', contentIds: [...items],
    stages: Object.fromEntries(stages.map((stage, i) => [stage, {
      description: `Etapa ${i + 1} conservada`, duration: 'Dos clases',
      resources: 'Materiales de la secuencia simulada', activities: `Actividad ${i + 1} conservada`
    }])) };
}
const group = (id, level, startTerm, items, name) => ({ id, level, startTerm, items, name,
  objective: 'Propósito del grupo simulado', synopsis: 'Trabajo histórico simulado',
  plansBimestrales: [plan(name, items.filter(id => id !== 'paso3-pendiente'))] });
const legacyState = { areas: {
  'Matemática': { groups: [
    group('mat-previo', 1, 1, ['paso3-0', 'paso3-pendiente'], 'Matemática histórica'),
    { id: 'mat-vacio', level: 2, startTerm: 3, items: [], plansBimestrales: [] }
  ] },
  'Ciencias Sociales': { groups: socialSlots.map((slot, i) => group(`social-${i}`, 3,
    Number(slot.at(-1)), i % 2 ? ['paso3-3', 'paso3-4'] : ['paso3-1', 'paso3-2'],
    `Sociales ${slot.startsWith('socialB') ? 'B' : 'A'} · C${slot.at(-1)}`)) },
  'Área sin equivalencia': { groups: [group('sin-ubicacion', 1, 1, [], 'Agrupamiento por revisar')] }
} };
const originalInput = structuredClone({ legacyState, matrixRows });
const proposal = migrarLegadoFgAV2({ legacyState, matrixRows, v2FgRows: catalog,
  model: { model: 'media', subjects: motor }, orientationId: orientation });
assert.equal(Object.keys(proposal.groups).length, 5);
assert.equal(proposal.pendientes.filter(p => p.tipo === 'contenido').length, 1);
assert.equal(proposal.sinUbicar.length, 1);
assert.equal(proposal.omitidosVacios.length, 1);
assert.equal(proposal.socialOption, 'B');
assert.deepEqual({ legacyState, matrixRows }, originalInput);

function baseState(occupied) {
  const map = { alt: 'A', mode: 'one', placements: {}, custom: [], valid: false,
    prearmVersion: 1, socialOption: 'A', phase2V28: { groups: {}, customContents: [] } };
  if (occupied) {
    map.placements['matematica-n1'] = ['fg-1-matematica'];
    map.phase2V28.groups['matematica-n1'] = {
      name: 'Trabajo previo en V2', objectives: 'Objetivo previo que debe conservarse',
      contents: [], plansBimestrales: [plan('Trabajo previo en V2', [])]
    };
  }
  return { school, active: orientation, selected: [orientation], maps: { [orientation]: map } };
}
const parentPci = 'sim-aviso-padre-validado';
// Documento de prueba efímero: se sirve únicamente desde este servidor local.
// No agrega una pantalla al producto ni obtiene información de escuelas reales.
const parentHtml = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Contrato del padre simulado</title>
<style>html,body{margin:0;height:100%}iframe{display:block;width:100%;height:100%;border:0}</style>
</head><body><iframe id="constructor" title="Constructor V2 de prueba"></iframe><script>
const frame=document.getElementById('constructor');
window.__mensajes=[];
addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
  if(event.data?.pci!==${JSON.stringify(parentPci)})return;
  window.__mensajes.push(structuredClone(event.data));
});
frame.src='revision-v2-embed.html?'+new URLSearchParams(${JSON.stringify({ pci: parentPci, orientation, school })});
</script></body></html>`;
const server = createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + decodeURIComponent(pathname));
    const rel = relative(root, file);
    if (rel === '..' || rel.startsWith('..' + sep)) throw Error('Ruta fuera del repositorio.');
    const bytes = pathname === '/__paso3_padre' ? parentHtml : await readFile(file);
    res.writeHead(200, { 'Content-Type': pathname === '/__paso3_padre' ? 'text/html' : mime[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; form-action 'none'; base-uri 'self'; object-src 'none'" });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const report = { paso: 3, fechaEjecucion: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  pagina: 'revision-v2-embed.html', datos: 'Legado simulado y catálogos oficiales locales',
  dispositivos: [], capturas: [], geometriaCapturas: [], errores: [], inicializaciones: [],
  solicitudesSupabase: [], otrasSolicitudesExternasBloqueadas: [], fuentesRemotasSustituidas: 0 };

async function settleView(page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const sample = () => {
      const shell = document.querySelector('#v38modal:not([hidden]) #v38shell');
      return { scrollX, scrollY, visualX: visualViewport.offsetLeft,
        visualY: visualViewport.offsetTop, width: visualViewport.width, height: visualViewport.height,
        shellTop: shell?.getBoundingClientRect().top ?? null, shellScroll: shell?.scrollTop ?? null };
    };
    return new Promise((resolve, reject) => {
      let previous, stable = 0;
      const start = performance.now();
      const frame = () => {
        const current = sample(), key = JSON.stringify(current);
        stable = key === previous ? stable + 1 : 0;
        if (stable >= 4) return resolve(current);
        if (performance.now() - start > 5000) return reject(Error('La vista no se estabilizó.'));
        previous = key; requestAnimationFrame(frame);
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
  assert.deepEqual(after, before, `${file}: captura durante una vista estable.`);
  report.capturas.push(file);
}
async function snapshot(page) {
  return page.evaluate(() => ({ estado: structuredClone(state),
    almacenamiento: Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])) }));
}
async function importBase(page, pci, occupied) {
  await page.goto(`${origin}/revision-v2-embed.html?${new URLSearchParams({ pci, orientation, school })}`,
    { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.PCIPhase2V28 && window.PCICoverageV91 &&
    document.querySelector('#offer.active'), null, { timeout: 30000 });
  await page.waitForFunction(() => window.__paso3Arranque?.iniciosV80.length === 2,
    null, { timeout: 15000 });
  report.inicializaciones.push({ pci, ...await page.evaluate(() => window.__paso3Arranque) });
  await page.evaluate(({ pci, document }) => window.postMessage({ type: 'V2_IMPORT', pci, document }, location.origin),
    { pci, document: baseState(occupied) });
  await page.waitForFunction(({ orientation, occupied }) => {
    const current = state.maps[orientation];
    return current?.prearmVersion === 1 && !Object.hasOwn(current, 'migracionLegado') &&
      (occupied ? current.phase2V28?.groups['matematica-n1']?.name === 'Trabajo previo en V2'
        : !current.phase2V28?.groups['matematica-n1']);
  }, { orientation, occupied });
  await page.evaluate(async () => { await PCIPhase2V28.loadCurriculum(); await PCICoverageV91.ready();
    window.__paso3Mensajes = [];
    addEventListener('message', event => {
      if (event.data?.type) window.__paso3Mensajes.push({ type: event.data.type,
        propio: event.source === window, origen: event.origin });
    });
  });
  await settleView(page);
}
const payload = (pci, legacy = legacyState) => ({ type: 'V2_MIGRATION_PREPARE', pci,
  orientation, legacyState: legacy, matrixRows });
async function prepare(page, pci, legacy = legacyState, expected = 'lista') {
  await page.evaluate(message => window.postMessage(message, location.origin), payload(pci, legacy));
  await page.waitForFunction(expected => document.querySelector('#v2MigrationNotice')?.dataset.estado === expected,
    expected, { timeout: 20000 });
}
async function count(page, key, expected) {
  assert.equal(Number(await page.locator(`#v2MigrationNotice [data-migration-count="${key}"]`).textContent()),
    expected, `Resumen efectivo: ${key}.`);
}
async function noticeGeometry(page) {
  const g = await page.locator('#v2MigrationNotice').evaluate(el => {
    const r = el.getBoundingClientRect();
    return { innerWidth, visualWidth: visualViewport.width, left: r.left, right: r.right,
      width: r.width, clientWidth: el.clientWidth, scrollWidth: el.scrollWidth };
  });
  assert.equal(g.innerWidth, page.viewportSize().width, 'El aviso no debe expandir el viewport.');
  assert.ok(g.left >= -1 && g.right <= page.viewportSize().width + 1);
  assert.ok(g.scrollWidth <= g.clientWidth + 1, 'El aviso no debe desbordarse horizontalmente.');
  return g;
}
async function rejectedMessages(page, pci) {
  const before = await snapshot(page);
  await page.evaluate(async message => {
    // Origen incorrecto y un emisor del mismo origen que no es el padre.
    window.dispatchEvent(new MessageEvent('message', { source: window,
      origin: 'https://origen-no-autorizado.invalid', data: message }));
    window.postMessage({ ...message, pci: 'otro-pci-simulado' }, location.origin);
    window.postMessage({ ...message, orientation: 'Comunicación' }, location.origin);
    const foreign = document.createElement('iframe'); foreign.hidden = true;
    foreign.srcdoc = '<script>addEventListener("message",e=>parent.postMessage(e.data,e.origin))<\/script>';
    const ready = new Promise(resolve => foreign.onload = resolve);
    document.body.appendChild(foreign); await ready;
    await new Promise(resolve => {
      const seen = event => {
        if (event.source === foreign.contentWindow && event.data?.type === message.type) {
          removeEventListener('message', seen); resolve();
        }
      };
      addEventListener('message', seen);
      foreign.contentWindow.postMessage(message, location.origin);
    });
    foreign.remove();
  }, payload(pci));
  await settleView(page);
  assert.equal(await page.locator('#v2MigrationNotice').isVisible(), false,
    'Mensajes de otro origen, emisor, PCI u orientación no deben abrir el aviso.');
  assert.deepEqual(await snapshot(page), before, 'Los mensajes rechazados no modifican estado ni almacenamiento.');
}
async function bimestralPlan(page, capture) {
  await page.locator('#pciGlobalDock [data-dock="proposal"]').click();
  await page.locator('#v28home').waitFor({ state: 'visible' });
  await page.locator('#v28home [data-area="Ciencias Sociales"]').click();
  const button = page.locator('#v28groups [data-g="socialB-c5"] [data-plans]');
  await button.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await button.click();
  await page.locator('#v38modal [data-open="1"]').click();
  await page.locator('#v38plan').waitFor();
  await settleView(page);
  assert.match(await page.locator('#v38modal .v38-top h2').innerText(), /Plan bimestral 1 de 2/);
  assert.equal(await page.locator('#v38plan [data-pfield="name"]').inputValue(),
    legacyState.areas['Ciencias Sociales'].groups[1].plansBimestrales[0].name);
  const checked = await page.locator('#v38plan [data-pcontent]:checked').evaluateAll(
    nodes => nodes.map(node => node.dataset.pcontent));
  assert.deepEqual(checked.sort(), socialContents.slice(2).map(row => row.id).sort());
  const g = await page.locator('#v38modal [data-close]').evaluate(el => {
    const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  });
  assert.ok(g.top >= 0 && g.bottom <= page.viewportSize().height &&
    g.left >= 0 && g.right <= page.viewportSize().width, 'Cerrar queda dentro del viewport.');
  await screenshot(page, capture);
  await page.locator('#v38modal [data-close]').click();
  return { titulo: 'Plan bimestral 1 de 2', contenidosSeleccionados: checked };
}
async function parentContract(context) {
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errores.push({ dispositivo: 'escritorio-padre', error: error.message }));
  try {
    await page.goto(`${origin}/__paso3_padre`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mensajes.some(m => m.type === 'V2_ORIGINAL_READY'),
      null, { timeout: 30000 });
    const frame = page.frames().find(frame => frame.url().includes('/revision-v2-embed.html?'));
    assert.ok(frame, 'El padre debe contener el constructor real en un iframe.');
    await frame.waitForFunction(() => window.__paso3Arranque?.iniciosV80.length === 2,
      null, { timeout: 15000 });
    await page.evaluate(({ pci, document: v2Document }) => document.getElementById('constructor').contentWindow
      .postMessage({ type: 'V2_IMPORT', pci, document: v2Document }, location.origin),
    { pci: parentPci, document: baseState(false) });
    await frame.waitForFunction(orientation => state.maps[orientation]?.prearmVersion === 1 &&
      !Object.hasOwn(state.maps[orientation], 'migracionLegado'), orientation);
    await frame.evaluate(async () => { await PCIPhase2V28.loadCurriculum(); await PCICoverageV91.ready(); });
    const before = await snapshot(frame);
    await page.evaluate(message => {
      window.__mensajes = [];
      document.getElementById('constructor').contentWindow.postMessage(message, location.origin);
    }, payload(parentPci));
    await page.waitForFunction(() => window.__mensajes.some(m =>
      m.type === 'V2_MIGRATION_STATUS' && m.estado === 'lista'));
    assert.deepEqual(await snapshot(frame), before, 'El PREPARE del padre tampoco aplica ni guarda.');
    await frame.locator('#v2MigrationAccept').click();
    await page.waitForFunction(orientation =>
      window.__mensajes.some(m => m.type === 'V2_MIGRATION_STATUS' && m.estado === 'aceptada') &&
      window.__mensajes.some(m => m.type === 'V2_ORIGINAL_SAVED' &&
        m.document?.maps?.[orientation]?.migracionLegado?.version === 'legado-fg-v2/1'), orientation);
    const messages = await page.evaluate(() => structuredClone(window.__mensajes));
    const saved = messages.filter(m => m.type === 'V2_ORIGINAL_SAVED');
    const accepted = messages.find(m => m.type === 'V2_MIGRATION_STATUS' && m.estado === 'aceptada');
    assert.equal(accepted.resumen.agrupamientos, 5);
    assert.ok(saved.some(m => m.document.maps[orientation].migracionLegado));
    assert.equal(messages.filter(m => m.type === 'V2_ORIGINAL_EXPORTED').length, 0,
      'Aceptar no debe iniciar el circuito de exportación y guardado remoto del padre.');
    return { estado: 'aprobado', emisorYOrigenValidados: true,
      estadoAceptadoRecibido: true, borradorConMarcadorRecibido: true,
      mensajesDeBorrador: saved.length, exportaciones: 0 };
  } catch (error) {
    await screenshot(page, 'escritorio-padre-error.png').catch(() => {});
    throw error;
  } finally { await page.close(); }
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
    console.log(`Paso 3 · ${device.nombre}: revisión, cancelación, aceptación y protección de cambios.`);
    const context = await browser.newContext({ viewport: device.viewport, isMobile: device.isMobile,
      hasTouch: device.hasTouch, deviceScaleFactor: 1, serviceWorkers: 'block' });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) {
        if (url.pathname.endsWith('/data/materias-v2.json')) {
          await route.request().frame().evaluate(() => {
            if (!window.PCIAppAccessV80) throw Error('Se requiere el acceso V80 instalado.');
            window.__paso3Arranque = { eventos: [], iniciosV80: [] };
            addEventListener('pci-access-changed', event => {
              const pila = new Error().stack;
              const record = { tiempo: performance.now(), rol: event.detail.role, pila };
              window.__paso3Arranque.eventos.push(record);
              if (/\bat start\s*\(/.test(pila) && !pila.includes('applyProfile'))
                window.__paso3Arranque.iniciosV80.push(record);
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
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.errores.push({ dispositivo: device.nombre, error: error.message }));
    const record = { dispositivo: device.nombre, viewport: device.viewport };
    report.dispositivos.push(record);
    try {
      const pci = `sim-aviso-${device.nombre}-conflicto`;
      await importBase(page, pci, true);
      await rejectedMessages(page, pci);
      record.mensajesAjenosRechazados = true;
      const before = await snapshot(page);
      await prepare(page, pci);
      assert.deepEqual(await snapshot(page), before, 'Preparar no aplica ni guarda el estado.');
      for (const [key, value] of Object.entries({ agrupamientos: 4, planesBimestrales: 4,
        conflictosAgrupamientos: 1, pendientesContenidos: 1, sinUbicar: 1, omitidosVacios: 1,
        contenidosUnicos: 4 })) await count(page, key, value);
      assert.match(await page.locator('#v2MigrationNotice').textContent(), /bimestre/i);
      record.aviso = await noticeGeometry(page);
      await page.locator('#v2MigrationNotice').scrollIntoViewIfNeeded();
      await screenshot(page, `${device.nombre}-01-aviso-aceptacion.png`);
      await page.locator('#v2MigrationDetails > summary').click();
      assert.ok((await page.locator('#v2MigrationDetails').textContent()).includes(pendingText));
      assert.equal(await page.locator('#v2MigrationNotice img').count(), 0, 'El texto histórico no se interpreta como HTML.');
      assert.equal(await page.evaluate(() => !!window.__paso3Xss), false);
      await page.locator('#v2MigrationDetails').scrollIntoViewIfNeeded();
      await screenshot(page, `${device.nombre}-02-detalles-conflictos.png`);
      await page.locator('#v2MigrationCancel').click();
      await page.waitForFunction(() => document.querySelector('#v2MigrationNotice').dataset.estado === 'cancelada');
      assert.deepEqual(await snapshot(page), before, 'Cancelar conserva estado, marcador y almacenamiento.');
      record.cancelacionSinCambios = true;

      await page.locator('#v2MigrationReview').click();
      await page.waitForFunction(() => document.querySelector('#v2MigrationNotice').dataset.estado === 'lista');
      const acceptedAtStart = Date.now();
      await page.locator('#v2MigrationAccept').click();
      await page.waitForFunction(() => document.querySelector('#v2MigrationNotice').dataset.estado === 'aceptada');
      const after = await snapshot(page), active = after.estado.maps[orientation];
      assert.equal(active.socialOption, 'B');
      assert.equal(active.migracionLegado.version, 'legado-fg-v2/1');
      assert.ok(Date.parse(active.migracionLegado.fecha) >= acceptedAtStart - 1000);
      assert.ok(Date.parse(active.migracionLegado.fecha) <= Date.now() + 1000);
      assert.deepEqual(active.phase2V28.groups['matematica-n1'], before.estado.maps[orientation].phase2V28.groups['matematica-n1']);
      assert.deepEqual(active.placements['matematica-n1'], before.estado.maps[orientation].placements['matematica-n1']);
      assert.equal(active.conflictos.filter(c => c.tipo === 'agrupamiento').length, 1);
      for (const slot of socialSlots) {
        assert.deepEqual(active.phase2V28.groups[slot].contents, proposal.groups[slot].contents);
        assert.equal(active.phase2V28.groups[slot].plansBimestrales.length, 1);
      }
      assert.equal(await page.locator('#v2MigrationAccept').isEnabled(), false, 'La aceptación se deshabilita al aplicar.');
      await page.locator('#v2MigrationNotice').scrollIntoViewIfNeeded();
      await screenshot(page, `${device.nombre}-03-incorporado-al-borrador.png`);
      await prepare(page, pci, legacyState, 'ya-aplicada');
      assert.deepEqual(await snapshot(page), after, 'Otra solicitud no duplica ni cambia la fecha aceptada.');
      record.aceptacion = { agrupamientosIncorporados: 4, planesBimestrales: 4,
        conflictosConservados: 1, fecha: active.migracionLegado.fecha, repeticionSinCambios: true };
      record.planBimestral = await bimestralPlan(page, `${device.nombre}-04-plan-bimestral.png`);
      assert.equal(await page.evaluate(() => window.__paso3Mensajes.filter(m => m.type === 'V2_ORIGINAL_EXPORTED').length), 0);

      const stalePci = `sim-aviso-${device.nombre}-cambios`;
      await importBase(page, stalePci, false);
      await prepare(page, stalePci);
      await count(page, 'agrupamientos', 5);
      // Cambio por la interfaz existente mientras la propuesta está visible.
      await page.locator('#customName').fill('Materia incorporada durante la revisión');
      await page.locator('#customYear').selectOption('5');
      await page.locator('#addCustom').click();
      const changed = await snapshot(page);
      assert.ok(changed.estado.maps[orientation].custom.some(s => s.name === 'Materia incorporada durante la revisión'));
      await page.locator('#v2MigrationAccept').click();
      await page.waitForFunction(() => document.querySelector('#v2MigrationNotice').dataset.estado === 'actualizada');
      assert.deepEqual(await snapshot(page), changed, 'La primera aceptación de una revisión obsoleta solo actualiza el aviso.');
      assert.equal(Object.hasOwn(changed.estado.maps[orientation], 'migracionLegado'), false);
      await page.locator('#v2MigrationAccept').click();
      await page.waitForFunction(() => document.querySelector('#v2MigrationNotice').dataset.estado === 'aceptada');
      const refreshed = await snapshot(page);
      assert.deepEqual(refreshed.estado.maps[orientation].custom, changed.estado.maps[orientation].custom);
      assert.equal(refreshed.estado.maps[orientation].migracionLegado.version, 'legado-fg-v2/1');
      record.revisionObsoleta = { primeraAceptacionSinAplicar: true, nuevaAceptacionConservaEdicion: true };

      const emptyPci = `sim-aviso-${device.nombre}-bloqueado`;
      await importBase(page, emptyPci, true);
      const blockedBefore = await snapshot(page);
      const onlyBlocked = { areas: { 'Matemática': { groups: [legacyState.areas['Matemática'].groups[0]] } } };
      await prepare(page, emptyPci, onlyBlocked, 'sin-aplicables');
      await count(page, 'agrupamientos', 0);
      assert.equal(await page.locator('#v2MigrationAccept').isEnabled(), false);
      assert.deepEqual(await snapshot(page), blockedBefore, 'Cero aplicables no instala el marcador.');
      await page.locator('#v2MigrationCancel').click();
      assert.deepEqual(await snapshot(page), blockedBefore);
      record.sinAplicablesSinMarcador = true;

      const rolePci = `sim-aviso-${device.nombre}-permiso`;
      await importBase(page, rolePci, false);
      await prepare(page, rolePci);
      // El coordinador conserva acceso de consulta al mapa. V80 deshabilita
      // sus controles; no se fuerza un clic ni se altera esa protección.
      await page.evaluate(orientation => PCIAppAccessV80.setSession({ role: 'coordinator',
        coordinatorOrientation: orientation, coordinatorAreas: ['Matemática'] }), orientation);
      await settleView(page);
      const afterRoleChange = await snapshot(page);
      const noticeAfterRoleChange = await page.locator('#v2MigrationNotice').evaluate(el => el.outerHTML);
      assert.equal(await page.locator('#v2MigrationAccept').isEnabled(), false,
        'Perder el permiso de administración impide aceptar una revisión ya abierta.');
      await page.evaluate(message => window.postMessage(message, location.origin), payload(rolePci));
      await settleView(page);
      assert.equal(await page.locator('#v2MigrationNotice').evaluate(el => el.outerHTML), noticeAfterRoleChange,
        'Sin permiso, una nueva solicitud PREPARE se ignora.');
      assert.deepEqual(await snapshot(page), afterRoleChange,
        'Después del cambio de rol no se modifica estado ni almacenamiento.');
      assert.equal(Object.hasOwn(afterRoleChange.estado.maps[orientation], 'migracionLegado'), false);
      record.permisoRevocado = { aceptacionDeshabilitada: true, nuevaPreparacionIgnorada: true,
        estadoYAlmacenamientoSinCambios: true, sinMarcador: true };
      if (device.nombre === 'escritorio') record.contratoDelPadre = await parentContract(context);
      record.resultado = 'aprobado';
      console.log(`${device.nombre}: aprobado; cancelación sin cambios, incorporación única y revisión obsoleta protegida.`);
    } catch (error) {
      record.resultado = 'fallido'; record.error = error.stack;
      await screenshot(page, `${device.nombre}-error.png`).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
  assert.deepEqual(report.solicitudesSupabase, [], 'No se debe solicitar Supabase.');
  assert.deepEqual(report.otrasSolicitudesExternasBloqueadas, []);
  assert.deepEqual(report.errores, [], 'Sin errores JavaScript.');
  assert.deepEqual({ legacyState, matrixRows }, originalInput);
  assert.deepEqual(await fingerprints(), protectedBefore, 'Código de aplicación y persistencia sin modificaciones durante la prueba.');
  report.archivosProtegidosVerificados = protectedPaths.length;
  report.resultado = 'aprobado';
  console.log('PASO 3 APROBADO: aviso de aceptación en escritorio y celular; sin Supabase.');
} catch (error) {
  report.resultado = 'fallido'; report.error = error.stack; process.exitCode = 1;
  console.error(error.stack);
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
  await writeFile(resolve(artifacts, 'resultado-paso-3.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Evidencia: ${resolve(artifacts, 'resultado-paso-3.json')}`);
}
