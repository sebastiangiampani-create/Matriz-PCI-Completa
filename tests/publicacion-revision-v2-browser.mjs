/**
 * Publicación de revisión PR #47: recorre el portal y los perfiles originales
 * contra la distribución estática, con datos ficticios y sin servicios remotos.
 * Se ejecuta en CI. PCI_PREVIEW_ROOT selecciona la raíz estática empaquetada.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, sep, extname } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(process.env.PCI_PREVIEW_ROOT || '.');
const artifacts = resolve(process.env.PCI_PREVIEW_ARTIFACTS || 'test-artifacts/publicacion-revision-v2');
const orientation = 'Comunicación';
const mediaPci = '00000000-0000-4000-8000-000000000001';
const teacherId = 'preview-docente-sociales';
const coordinatorId = 'preview-coordinador-sociales';
const socialSlots = ['socialA-c5', 'socialB-c5', 'socialA-c6', 'socialB-c6'];
const sessionSentinel = 'sesion-institucional-ficticia-que-preview-no-debe-sustituir';
const expectedPlanName = 'Plan bimestral 1 · Sociales B · C5 (muestra)';
const editedObjectives = 'Objetivo editado por el docente de muestra para comprobar la revisión publicada.';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
await mkdir(artifacts, { recursive: true });

const report = { fechaEjecucion: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  raizEstatica: root, entrada: 'revision-v2-portal-real.html?school=1001',
  datos: 'Escuela, docentes y legado ficticios de revisión', dispositivos: [], capturas: [],
  distribucion: JSON.parse(await readFile(resolve(root, 'revision-publicada.json'), 'utf8')),
  erroresJavascript: [], erroresConsola: [], erroresRecursos: [], dialogosInesperados: [], solicitudesSupabase: [],
  solicitudesExternasBloqueadas: [], fuentesRemotasSustituidas: 0 };

const server = createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
    const rel = relative(root, file);
    if (rel === '..' || rel.startsWith('..' + sep)) throw Error('Ruta fuera de la distribución.');
    const bytes = await readFile(file);
    // Mismos permisos que el alojamiento estático: el servidor no agrega un
    // CSP que pueda ocultar solicitudes externas antes de que route las registre.
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;

async function settle(surface) {
  await surface.evaluate(async () => {
    await document.fonts.ready;
    const start = performance.now();
    let previous = '', stable = 0;
    await new Promise((done, fail) => {
      function sample() {
        const shell = document.querySelector('#v38modal:not([hidden]) #v38shell');
        const current = JSON.stringify([scrollX, scrollY, visualViewport.offsetLeft,
          visualViewport.offsetTop, shell?.scrollTop, shell?.getBoundingClientRect().top]);
        stable = current === previous ? stable + 1 : 0;
        if (stable >= 4) return done();
        if (performance.now() - start > 5000) return fail(Error('La vista no se estabilizó.'));
        previous = current; requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
  });
}

async function capturePortal(page, file) {
  await settle(page);
  await page.screenshot({ path: resolve(artifacts, file), fullPage: true });
  report.capturas.push(file);
}

async function captureFrame(page, frame, file) {
  await settle(frame);
  await page.locator('#v2OriginalFrame').screenshot({ path: resolve(artifacts, file) });
  report.capturas.push(file);
}

async function schoolCards(page) {
  await page.locator('#app:not([hidden])').waitFor({ timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('.school-offer-card').length === 3,
    null, { timeout: 30000 });
  assert.match(await page.locator('#pciCounts').textContent(), /3 PCI/);
  for (const title of ['Comunicación', 'Computación', 'Economía y Administración'])
    assert.equal(await page.locator('.school-offer-card').filter({ hasText: title }).count(), 1);
  assert.equal(await page.evaluate(() => window.__pciPreviewPr47?.isolated), true);
}

async function openModel(page, title, media = false) {
  await page.locator('.school-offer-card').filter({ hasText: title })
    .locator('button[aria-label^="Abrir Mapa de la Oferta"]').click();
  await page.locator('#v2OriginalPane:not([hidden])').waitFor({ timeout: 30000 });
  const handle = await page.locator('#v2OriginalFrame').elementHandle();
  const frame = await handle.contentFrame();
  assert.ok(frame, `El portal debe abrir ${title} dentro del constructor original.`);
  await frame.waitForFunction(() => window.PCIPhase2V28 && window.PCIAppAccessV80 &&
    document.querySelector('#offer.active'), null, { timeout: 45000 });
  if (media) {
    await frame.waitForFunction(() => window.__publicacionArranque?.iniciosV80.length === 2,
      null, { timeout: 15000 });
    await frame.locator('button[title="Cambiar perfil"]').waitFor();
  }
  return frame;
}

async function changeProfile(frame, role, personId, onPanel) {
  await frame.locator('button[title="Cambiar perfil"]').click();
  await frame.locator('#v85AccessPanel').waitFor();
  await frame.locator(`[data-v85-role="${role}"]`).click();
  if (onPanel) await onPanel();
  if (role === 'admin') await frame.locator('#v85EnterAdmin').click();
  if (role === 'coordinator') {
    await frame.locator('#v85CoordinatorSelect').selectOption(personId);
    await frame.locator('#v85EnterCoordinator').click();
  }
  if (role === 'teacher') {
    await frame.locator('#v85TeacherSelect').selectOption(personId);
    await frame.locator('#v85EnterTeacher').click();
  }
  await frame.waitForFunction(role => document.body.dataset.pciRole === role &&
    !document.querySelector('#v85AccessPanel'), role);
  const access = await frame.evaluate(() => window.PCIAppAccessV80.derivedAccess());
  assert.equal(access.role, role);
  if (personId) assert.equal(access.teacherId, personId);
  return access;
}

async function openPlan(frame, number = 1) {
  // Navegación original. No se aplican sesiones ni se invocan acciones internas.
  await frame.locator('#pciGlobalDock [data-dock="proposal"]').click();
  await frame.locator('#v28home').waitFor({ state: 'visible' });
  await frame.locator('#v28home [data-area="Ciencias Sociales"]').click();
  const plans = frame.locator('#v28groups [data-g="socialB-c5"] [data-plans]');
  await plans.evaluate(button => button.scrollIntoView({ block: 'center' }));
  await settle(frame);
  await plans.click();
  await frame.locator(`#v38modal [data-open="${number}"]`).click();
  await frame.locator('#v38plan').waitFor();
  assert.match(await frame.locator('#v38modal .v38-top h2').innerText(),
    new RegExp(`Plan bimestral ${number} de 2`));
  assert.ok(await frame.locator('#v38plan [data-pcontent]:checked').count() > 0,
    'El editor debe conservar los contenidos del plan bimestral.');
  assert.equal(await frame.locator('#v38plan [data-pfield="name"]').isEnabled(), true,
    'El perfil con ámbito asignado puede editar el plan de Sociales 3.º.');
  if (number === 1)
    assert.equal(await frame.locator('#v38plan [data-pfield="name"]').inputValue(), expectedPlanName);
}

async function savePreview(page) {
  const previous = Number((await page.locator('#v2OriginalStatus').textContent()).match(/revisión (\d+)/)?.[1] || 0);
  await page.locator('#v2OriginalSave').click();
  await page.waitForFunction(previous => {
    const text = document.getElementById('v2OriginalStatus')?.textContent || '';
    const revision = Number(text.match(/guardado y leído nuevamente · revisión (\d+)/)?.[1] || 0);
    return revision > previous;
  }, previous, { timeout: 20000 });
}

async function backToSchool(page) {
  await page.locator('#schoolHomeLink').click();
  await schoolCards(page);
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
    const record = { dispositivo: device.nombre, viewport: device.viewport, perfiles: [] };
    report.dispositivos.push(record);
    const context = await browser.newContext({ viewport: device.viewport, isMobile: device.isMobile,
      hasTouch: device.hasTouch, deviceScaleFactor: 1, serviceWorkers: 'block' });
    await context.addInitScript(sentinel => {
      if (window.parent !== window) return;
      // Representa otra sesión del mismo origen. El mock debe usar su namespace.
      const rawGet = Storage.prototype.getItem;
      const rawSet = Storage.prototype.setItem;
      window.__publicacionSesionOriginal = () => rawGet.call(sessionStorage, 'pci_access_session');
      rawSet.call(sessionStorage, 'pci_access_session', sentinel);
      window.__publicacionMensajes = [];
      addEventListener('message', event => {
        if (event.origin !== location.origin || event.source !== document.getElementById('v2OriginalFrame')?.contentWindow)
          return;
        if (event.data?.type) window.__publicacionMensajes.push(structuredClone(event.data));
      });
    }, sessionSentinel);
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) {
        if (url.pathname.endsWith('/data/materias-v2.json')) {
          const requestFrame = route.request().frame();
          if (requestFrame.url().includes('/revision-v2-embed.html?')) {
            await requestFrame.evaluate(() => {
              if (!window.PCIAppAccessV80) throw Error('Se requiere el acceso V80 original instalado.');
              window.__publicacionArranque = { iniciosV80: [] };
              addEventListener('pci-access-changed', event => {
                const stack = new Error().stack;
                if (/\bat start\s*\(/.test(stack) && !stack.includes('applyProfile'))
                  window.__publicacionArranque.iniciosV80.push({ role: event.detail.role, tiempo: performance.now() });
              });
            });
          }
        }
        return route.continue();
      }
      if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) {
        report.fuentesRemotasSustituidas++;
        return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
      }
      if (/supabase/i.test(url.hostname)) report.solicitudesSupabase.push(url.href);
      else report.solicitudesExternasBloqueadas.push(url.href);
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => report.erroresJavascript.push({ dispositivo: device.nombre, error: error.message }));
    page.on('console', message => {
      if (message.type() === 'error') report.erroresConsola.push({ dispositivo: device.nombre,
        mensaje: message.text(), origen: message.location() });
    });
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.origin === origin && response.status() >= 400 && url.pathname !== '/favicon.ico')
        report.erroresRecursos.push({ dispositivo: device.nombre, url: url.pathname, status: response.status() });
    });
    page.on('dialog', async dialog => {
      report.dialogosInesperados.push({ dispositivo: device.nombre, tipo: dialog.type(), mensaje: dialog.message() });
      await dialog.dismiss();
    });
    try {
      console.log(`Publicación · ${device.nombre}: entrada escolar y perfiles originales.`);
      await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForURL(/revision-v2-portal-real\.html\?school=1001/);
      await schoolCards(page);
      assert.equal(await page.evaluate(() => window.__publicacionSesionOriginal()), sessionSentinel,
        'La sesión de preview no sustituye pci_access_session del origen.');
      await capturePortal(page, `${device.nombre}-01-escuela.png`);

      let frame = await openModel(page, orientation, true);
      await frame.locator('#v2MigrationNotice[data-estado="lista"]').waitFor({ timeout: 30000 });
      const count = async key => Number(await frame.locator(
        `#v2MigrationNotice [data-migration-count="${key}"]`).textContent());
      assert.equal(await count('agrupamientos'), 4);
      assert.equal(await count('planesBimestrales'), 8);
      assert.equal(await count('conflictosAgrupamientos'), 1);
      assert.match(await frame.locator('button[title="Cambiar perfil"]').textContent(), /Equipo de conducción/);
      await frame.locator('#v2MigrationNotice').scrollIntoViewIfNeeded();
      await captureFrame(page, frame, `${device.nombre}-02-aviso.png`);
      await frame.locator('#v2MigrationAccept').click();
      await frame.locator('#v2MigrationNotice[data-estado="aceptada"]').waitFor();
      await page.waitForFunction(({ orientation, pci }) => window.__publicacionMensajes.some(message =>
        message.type === 'V2_ORIGINAL_SAVED' && message.pci === pci &&
        message.document?.maps?.[orientation]?.migracionLegado?.version === 'legado-fg-v2/1'),
      { orientation, pci: mediaPci });
      const accepted = await page.evaluate(({ orientation, pci }) => window.__publicacionMensajes
        .findLast(message => message.type === 'V2_ORIGINAL_SAVED' && message.pci === pci &&
          message.document?.maps?.[orientation]?.migracionLegado)?.document.maps[orientation],
      { orientation, pci: mediaPci });
      assert.equal(accepted.socialOption, 'B');
      assert.equal(accepted.phase2V28.groups['matematica-n1'].name, 'Matemática · trabajo de muestra existente');
      for (const slot of socialSlots) {
        assert.ok(accepted.placements[slot]?.length > 0, `${slot} debe mostrar materias.`);
        assert.ok(accepted.phase2V28.groups[slot].contents.length > 0, `${slot} conserva contenidos.`);
        assert.equal(accepted.phase2V28.groups[slot].plansBimestrales.length, 2,
          `${slot}: un plan por cada bimestre del cuatrimestre.`);
      }
      record.migracion = { opcionSocial: accepted.socialOption, grupos: 4, planesBimestrales: 8,
        trabajoAnteriorConservado: true, fecha: accepted.migracionLegado.fecha };
      await frame.waitForFunction(teacherId => Object.values(
        window.PCIInstitutionalV48.institutional().assignments || {}).includes(teacherId), teacherId);

      await openPlan(frame);
      await captureFrame(page, frame, `${device.nombre}-03-plan-bimestral-conduccion.png`);
      await frame.locator('#v38modal [data-close]').click();
      record.perfiles.push({ rol: 'admin', planBimestralEditable: true });

      const coordinator = await changeProfile(frame, 'coordinator', coordinatorId,
        () => captureFrame(page, frame, `${device.nombre}-04-selector-perfiles.png`));
      assert.deepEqual(coordinator.editableAreasByOrientation[orientation], ['Ciencias Sociales']);
      await openPlan(frame);
      await captureFrame(page, frame, `${device.nombre}-04-plan-coordinacion.png`);
      await frame.locator('#v38modal [data-close]').click();
      await frame.locator('#pciGlobalDock [data-dock="offer"]').click();
      await frame.locator('#v80OfferReadonly').waitFor();
      assert.equal(await frame.locator('#customName').isEnabled(), false,
        'La coordinación conserva el mapa de la oferta en consulta.');
      record.perfiles.push({ rol: 'coordinator', persona: coordinatorId,
        areaEditable: coordinator.editableAreasByOrientation[orientation], mapaSoloLectura: true });

      const teacher = await changeProfile(frame, 'teacher', teacherId);
      assert.ok(teacher.allowedAreasByOrientation[orientation]?.includes('Ciencias Sociales'));
      assert.ok(teacher.editableSubjectsByOrientation[orientation]?.some(subject => subject.year === 3));
      await openPlan(frame);
      await frame.locator('#v38plan [data-pfield="objectives"]').fill(editedObjectives);
      await frame.locator('#v38plan button[type="submit"]').click();
      await frame.locator('#v38modal [data-open="1"]').click();
      assert.equal(await frame.locator('#v38plan [data-pfield="objectives"]').inputValue(), editedObjectives);
      await captureFrame(page, frame, `${device.nombre}-05-plan-docente.png`);
      await frame.locator('#v38modal [data-close]').click();
      record.perfiles.push({ rol: 'teacher', persona: teacherId,
        materiasConPermiso: teacher.editableSubjectsByOrientation[orientation], planEditadoYRecuperado: true });

      await changeProfile(frame, 'admin');
      await frame.locator('#pciGlobalDock [data-dock="home"]').click();
      await frame.locator('#home.active #v71LeanHomeEntry [data-v71n-open]').click();
      await frame.locator('#institutional.active #v48InstitutionalContent').waitFor();
      await frame.waitForFunction(() => document.getElementById('v48InstitutionalContent')?.textContent
        .includes('Docente de muestra · Ciencias Sociales'));
      assert.ok((await frame.locator('#v48InstitutionalContent').textContent())
        .includes('Coordinación de muestra · Ciencias Sociales'));
      await captureFrame(page, frame, `${device.nombre}-06-gestion-conduccion.png`);
      record.gestionConPlantelFicticio = true;
      await savePreview(page);
      await backToSchool(page);

      frame = await openModel(page, orientation, true);
      await frame.locator('#v2MigrationNotice[data-estado="ya-aplicada"]').waitFor({ timeout: 30000 });
      await openPlan(frame);
      assert.equal(await frame.locator('#v38plan [data-pfield="objectives"]').inputValue(), editedObjectives,
        'Reabrir el PCI conserva el trabajo guardado en la simulación.');
      await frame.locator('#v38modal [data-close]').click();
      record.reaperturaSinResembrar = true;
      await savePreview(page);
      await backToSchool(page);

      record.modalidades = [];
      for (const model of [
        { nombre: 'Computación', id: 'tecnica', niveles: 6, cuatrimestres: 12 },
        { nombre: 'Economía y Administración', id: 'ba15', niveles: 4, cuatrimestres: 8 }
      ]) {
        const modelFrame = await openModel(page, model.nombre);
        const actual = await modelFrame.evaluate(() => ({ model: window.__V2_MODAL.model,
          levels: Number(window.__V2_MODAL.levels), terms: Number(window.__V2_MODAL.terms) }));
        assert.deepEqual(actual, { model: model.id, levels: model.niveles, terms: model.cuatrimestres });
        assert.ok(await modelFrame.locator('#offer.active .mapTable tbody tr').count() > 0,
          `${model.nombre} debe presentar el mapa original de su modalidad.`);
        if (device.nombre === 'escritorio')
          await captureFrame(page, modelFrame, `${device.nombre}-07-${model.id}.png`);
        record.modalidades.push({ ...model, resultado: 'aprobado' });
        await backToSchool(page);
      }
      assert.equal(await page.evaluate(() => window.__publicacionSesionOriginal()), sessionSentinel);
      const width = await page.evaluate(() => ({ viewport: innerWidth,
        client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      assert.equal(width.viewport, device.viewport.width, 'El portal conserva el viewport del dispositivo.');
      assert.ok(width.scroll <= width.client + 1, 'El portal escolar no desborda horizontalmente.');
      record.geometriaPortal = width;
      record.resultado = 'aprobado';
      console.log(`${device.nombre}: aprobado; tres modalidades, perfiles y guardado exclusivamente simulado.`);
    } catch (error) {
      record.resultado = 'fallido'; record.error = error.stack;
      await capturePortal(page, `${device.nombre}-error.png`).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
  assert.deepEqual(report.solicitudesSupabase, [], 'La revisión no debe intentar solicitudes reales a Supabase.');
  assert.deepEqual(report.solicitudesExternasBloqueadas, [], 'La distribución debe ser autosuficiente salvo fuentes.');
  assert.deepEqual(report.erroresRecursos, [], 'Todos los recursos locales de la distribución deben existir.');
  assert.deepEqual(report.erroresJavascript, [], 'La revisión no debe presentar errores JavaScript.');
  assert.deepEqual(report.erroresConsola, [], 'La revisión no debe presentar errores en consola.');
  assert.deepEqual(report.dialogosInesperados, [], 'La navegación y el guardado deben completarse sin perder trabajo.');
  report.resultado = 'aprobado';
  console.log('PUBLICACIÓN APROBADA: escuela, aceptación, perfiles originales y tres modalidades; cero Supabase.');
} catch (error) {
  report.resultado = 'fallido'; report.error = error.stack; process.exitCode = 1;
  console.error(error.stack);
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
  await writeFile(resolve(artifacts, 'resultado-publicacion.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Evidencia: ${resolve(artifacts, 'resultado-publicacion.json')}`);
}
