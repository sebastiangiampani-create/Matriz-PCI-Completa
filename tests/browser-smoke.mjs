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

await mkdir(ARTIFACTS, { recursive: true });
let browser;

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();
  const browserErrors = [];

  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });

  await page.goto(`${BASE_URL}/plataforma.html`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('a.school').count(), 4, 'La plataforma debe mostrar cuatro escuelas habilitadas.');
  assert.equal(await page.locator('.creator-credit').count(), 1, 'La plataforma debe mostrar la autoría.');
  assert.equal(
    await page.locator('.top img').evaluate((image) => image.complete && image.naturalWidth > 0),
    true,
    'El logo institucional debe cargar correctamente.',
  );
  await page.screenshot({ path: `${ARTIFACTS}/01-plataforma.png`, fullPage: true });

  await page.goto(`${BASE_URL}/escuela.html?school=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#gateTitle');
  assert.match(await page.locator('#gateTitle').textContent(), /Escuela de muestra 1/);
  assert.equal(await page.locator('.creator-credit').count(), 1, 'El acceso de escuela debe mostrar la autoría.');
  await page.screenshot({ path: `${ARTIFACTS}/02-acceso-escuela-1.png`, fullPage: true });

  await page.goto(`${BASE_URL}/app.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#loading', { state: 'detached', timeout: 45_000 });
  await page.waitForFunction(() => document.querySelector('#structureStatus')?.textContent.includes('C5 y C6'));
  assert.equal(await page.locator('.creator-credit').count(), 1, 'La matriz debe mostrar la autoría.');
  assert.match(await page.locator('#coverageHint').textContent(), /más de un espacio/);

  await page.click('#overviewMatrix');
  await page.waitForSelector('#matrix.active');
  const matrixSpaces = page.locator('[data-matrix-group]');
  assert.ok(await matrixSpaces.count(), 'La matriz debe contener espacios curriculares.');
  await matrixSpaces.first().click();
  await page.waitForSelector('#matrixDetailsPanel:not([hidden])');
  assert.equal(await page.locator('#matrixDetailsPanel .matrix-content-list').count(), 1);
  assert.equal(await page.locator('[data-matrix-detail-edit]').count(), 1);
  await page.screenshot({ path: `${ARTIFACTS}/03-matriz-detalle.png`, fullPage: true });

  assert.deepEqual(browserErrors, [], `Errores detectados en navegador:\n${browserErrors.join('\n')}`);
  console.log('Smoke test de navegador completado correctamente.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
