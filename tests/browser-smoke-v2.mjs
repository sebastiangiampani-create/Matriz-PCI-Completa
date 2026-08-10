import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ARTIFACTS = 'test-artifacts';
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
  stdio: 'inherit',
});

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/plataforma.html`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('El servidor local no respondió a tiempo.');
}

async function waitForApp(page, browserErrors, screenshotName) {
  await page.goto(`${BASE_URL}/app.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(8_000);
  if (await page.locator('#loading').count()) {
    const loadingText = await page.locator('#loading').innerText();
    await page.screenshot({ path: `${ARTIFACTS}/${screenshotName}`, fullPage: true });
    throw new Error(`La matriz no terminó de cargar. Mensaje visible: ${loadingText}. Errores: ${browserErrors.join(' | ')}`);
  }
  await page.waitForFunction(() => document.querySelector('#structureStatus')?.textContent.includes('C5 y C6'));
  await page.waitForFunction(() => window.PCIApp?.getData?.().filter((item) => item.area === 'Tutoría').length === 35);
}

function collectBrowserErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => {
    const message = `pageerror: ${error.message}`;
    errors.push(message);
    console.error(message);
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = `console: ${message.text()}`;
    errors.push(text);
    console.error(text);
  });
  return errors;
}

await mkdir(ARTIFACTS, { recursive: true });
let browser;

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();
  const browserErrors = collectBrowserErrors(page);

  await page.goto(`${BASE_URL}/plataforma.html`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('a.school').count(), 4, 'La plataforma debe mostrar cuatro escuelas habilitadas.');
  assert.equal(await page.locator('.site-credit').count(), 1, 'La plataforma debe mostrar la autoría.');
  assert.equal(
    await page.locator('.top img').evaluate((image) => image.complete && image.naturalWidth > 0),
    true,
    'El logo institucional debe cargar correctamente.',
  );
  await page.screenshot({ path: `${ARTIFACTS}/01-plataforma.png`, fullPage: true });

  await page.goto(`${BASE_URL}/escuela.html?school=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#gateTitle');
  assert.match(await page.locator('#gateTitle').textContent(), /Escuela de muestra 1/);
  assert.equal(await page.locator('.credit').count(), 1, 'El acceso de escuela debe mostrar la autoría.');
  await page.screenshot({ path: `${ARTIFACTS}/02-acceso-escuela-1.png`, fullPage: true });

  await waitForApp(page, browserErrors, '03-error-carga.png');
  assert.equal(await page.locator('.site-credit').count(), 1, 'La matriz debe mostrar la autoría.');
  assert.match(await page.locator('#coverageHint').textContent(), /más de un espacio/);
  assert.equal(
    await page.evaluate(() => window.PCIApp.getData().filter((item) => item.area === 'Tutoría').length),
    35,
    'Deben cargarse los 35 contenidos de Tutoría.',
  );

  await page.evaluate(() => window.PCIApp.openArea('Artes'));
  await page.waitForSelector('#board.active');
  await page.waitForFunction(() => document.querySelector('#boardAlert')?.textContent.includes('Regla curricular de Artes'));
  assert.equal(await page.locator('[data-pci-art-language]').count(), 3, 'Artes debe ofrecer tres lenguajes para elegir dos.');
  await page.locator('[data-pci-art-language="Artes Visuales"]').check();
  await page.locator('[data-pci-art-language="Música"]').check();
  await page.waitForFunction(() => document.querySelector('[data-pci-art-language="Teatro"]')?.disabled === true);
  assert.deepEqual(
    await page.evaluate(() => window.PCIApp.getState().curriculumRules.artLanguages),
    ['Artes Visuales', 'Música'],
  );
  assert.match(await page.locator('#coverageHint').textContent(), /tres ejes/);
  await page.screenshot({ path: `${ARTIFACTS}/03-artes-regla-curricular.png`, fullPage: true });

  await page.evaluate(() => window.PCIApp.openArea('Educación Física'));
  await page.waitForFunction(() => document.querySelector('#boardAlert')?.textContent.includes('Regla curricular de Educación Física'));
  for (const label of ['Deportes abiertos', 'Deportes cerrados / Atletismo', 'Gimnasia en sus diferentes expresiones', 'Gimnasia para la formación corporal', 'Juegos']) {
    assert.match(await page.locator('#boardAlert').textContent(), new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(await page.locator('#coverageHint').textContent(), /validación se hace por núcleos/);
  await page.screenshot({ path: `${ARTIFACTS}/04-educacion-fisica-regla-curricular.png`, fullPage: true });

  await page.evaluate(() => window.PCIApp.openArea('Otros formatos pedagógicos'));
  await page.waitForSelector('#board.active');
  if (!(await page.locator('.group-card').count())) {
    await page.click('#addOther');
  }
  await page.waitForSelector('.group-card.selected');
  await page.waitForFunction(() => Boolean(document.querySelector('#subjectFilter option[value="Tutoría"]')));
  await page.locator('#subjectFilter').selectOption('Tutoría');
  await page.waitForSelector('[data-pci-assign-tutor]');
  assert.equal(await page.locator('[data-pci-assign-tutor]').count(), 35, 'La bolsa de Otros formatos debe mostrar los 35 contenidos de Tutoría.');
  await page.locator('[data-pci-assign-tutor]').first().click();
  await page.waitForFunction(() => window.PCIApp.getState().areas['Otros formatos pedagógicos'].groups.some((group) => group.items.some((id) => id.startsWith('tutoria-'))));
  const tutorState = await page.evaluate(() => {
    const group = window.PCIApp.getState().areas['Otros formatos pedagógicos'].groups.find((candidate) => candidate.items.some((id) => id.startsWith('tutoria-')));
    return { level: group.level, startTerm: group.startTerm, tutorIds: group.items.filter((id) => id.startsWith('tutoria-')) };
  });
  assert.equal(tutorState.level, 1);
  assert.equal(tutorState.startTerm, 1);
  assert.equal(tutorState.tutorIds.length, 1);
  await page.screenshot({ path: `${ARTIFACTS}/05-tutoria-otros-formatos.png`, fullPage: true });

  await page.evaluate(() => window.PCIApp.openOverview());
  await page.click('#overviewMatrix');
  await page.waitForSelector('#matrix.active');
  const matrixSpaces = page.locator('[data-matrix-group]');
  assert.ok(await matrixSpaces.count(), 'La matriz debe contener espacios curriculares.');
  await matrixSpaces.first().evaluate((element) => element.click());
  await page.waitForSelector('#matrixDetailsPanel:not([hidden])');
  assert.equal(await page.locator('#matrixDetailsPanel .matrix-content-list').count(), 1);
  assert.equal(await page.locator('[data-matrix-detail-edit]').count(), 1);
  await page.screenshot({ path: `${ARTIFACTS}/06-matriz-detalle.png`, fullPage: true });

  assert.deepEqual(browserErrors, [], `Errores detectados en navegador de escritorio:\n${browserErrors.join('\n')}`);
  await context.close();

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await mobileContext.newPage();
  const mobileErrors = collectBrowserErrors(mobile);
  await waitForApp(mobile, mobileErrors, '07-error-carga-mobile.png');

  await mobile.click('#overviewMatrix');
  await mobile.waitForSelector('#matrix.active');
  const headerBox = await mobile.locator('.matrix-header').boundingBox();
  const firstRowBox = await mobile.locator('.matrix-area-row').first().boundingBox();
  assert.ok(headerBox && firstRowBox, 'La matriz móvil debe renderizar cabecera y primera fila.');
  assert.ok(
    firstRowBox.y >= headerBox.y + headerBox.height - 1,
    'La cabecera Área/C1-C10 no debe tapar Lengua y Literatura.',
  );
  await mobile.screenshot({ path: `${ARTIFACTS}/07-matriz-mobile-sin-solapamiento.png`, fullPage: true });

  await mobile.evaluate(() => window.PCIApp.openArea('Otros formatos pedagógicos'));
  await mobile.waitForSelector('#board.active');
  if (!(await mobile.locator('.group-card').count())) {
    await mobile.click('#addOther');
  }
  await mobile.waitForSelector('.group-card.selected');
  await mobile.waitForFunction(() => document.querySelector('.group-card.selected select')?.dataset.pciEditorProtected === '1');

  await mobile.evaluate(() => {
    window.__pciNavMutations = 0;
    const nav = document.getElementById('mobileGroupNav');
    const observer = new MutationObserver(() => { window.__pciNavMutations += 1; });
    observer.observe(nav, { childList: true, subtree: true });
    window.__pciNavObserver = observer;
  });

  const formatSelect = mobile.locator('.group-card.selected select[data-field="formatType"]');
  await formatSelect.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true });
  await mobile.waitForTimeout(100);
  assert.equal(
    await mobile.evaluate(() => window.__pciNavMutations),
    0,
    'Tocar un selector no debe reconstruir la navegación ni cancelar el selector nativo.',
  );

  await formatSelect.selectOption({ label: 'Proyecto' });
  await mobile.locator('.group-card.selected select[data-field="type"]').selectOption({ label: 'Obligatorio' });
  await mobile.locator('.group-card.selected select[data-field="duration"]').selectOption('annual');
  await mobile.waitForSelector('.group-card.selected select[data-field="placement"]');
  await mobile.locator('.group-card.selected select[data-field="placement"]').selectOption('2');

  const otherState = await mobile.evaluate(() => {
    const group = window.PCIApp.getState().areas['Otros formatos pedagógicos'].groups[0];
    return {
      formatType: group.formatType,
      type: group.type,
      duration: group.duration,
      level: group.level,
      startTerm: group.startTerm,
      endTerm: group.endTerm,
    };
  });
  assert.deepEqual(otherState, {
    formatType: 'Proyecto',
    type: 'Obligatorio',
    duration: 'annual',
    level: 2,
    startTerm: 3,
    endTerm: 4,
  });
  await mobile.screenshot({ path: `${ARTIFACTS}/08-otros-formatos-mobile.png`, fullPage: true });

  assert.deepEqual(mobileErrors, [], `Errores detectados en navegador móvil:\n${mobileErrors.join('\n')}`);
  await mobileContext.close();

  console.log('Smoke test de escritorio y móvil completado correctamente.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
