import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 4174;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
  stdio: 'inherit',
});

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/app.html`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('El servidor local no respondió a tiempo.');
}

let browser;

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const browserErrors = [];

  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });

  await page.goto(`${BASE_URL}/app.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#loading', { state: 'detached', timeout: 45_000 });
  await page.evaluate(() => window.PCIApp.openArea('Lengua y Literatura'));
  await page.waitForSelector('#board.active');

  const planGroup = page.locator('.group-card').first();
  await planGroup.locator('[data-pci-plan-entry] button').waitFor();
  const planGroupId = await planGroup.getAttribute('data-group-id');
  const originalGroupName = await planGroup.locator('[data-field="name"]').inputValue();
  const renamedGroup = `${originalGroupName} · regresión`;
  const customPlanName = 'Plan personalizado · regresión';

  await planGroup.locator('[data-pci-plan-entry] button').click();
  await page.waitForSelector('#pciPlansBackdrop:not([hidden])');
  assert.ok(
    await page.locator('.pci-plan-card p').first().textContent().then((name) => name.includes(originalGroupName)),
    'El nombre automático del plan debe incluir el nombre del agrupamiento.',
  );

  await page.locator('[data-open-plan="1"]').click();
  await page.locator('[data-plan-field="name"]').fill(customPlanName);
  await page.locator('#pciPlanForm button[type="submit"]').click();
  await page.waitForSelector('.pci-plan-grid');
  assert.equal(await page.locator('.pci-plan-card p').first().textContent(), customPlanName);
  await page.locator('[data-plans-close]').click();
  await page.waitForSelector('#pciPlansBackdrop', { state: 'hidden' });

  const renamedCard = page.locator(`[data-group-id="${planGroupId}"]`);
  await renamedCard.locator('[data-field="name"]').fill(renamedGroup);
  await renamedCard.locator('[data-pci-plan-entry] button').click();
  await page.waitForSelector('#pciPlansBackdrop:not([hidden])');

  const visiblePlanNames = await page.locator('.pci-plan-card p').allTextContents();
  assert.equal(visiblePlanNames[0], customPlanName, 'Renombrar el agrupamiento no debe pisar un nombre manual.');
  assert.ok(
    visiblePlanNames.slice(1).every((name) => name.includes(renamedGroup)),
    'Los nombres automáticos deben sincronizarse con el nuevo nombre del agrupamiento.',
  );

  await page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.__pciPlanNameMutations = 0;
    const shell = document.getElementById('pciPlansShell');
    const observer = new MutationObserver((records) => { window.__pciPlanNameMutations += records.length; });
    observer.observe(shell, { childList: true, subtree: true, characterData: true });
  });
  await page.waitForTimeout(300);
  assert.equal(
    await page.evaluate(() => window.__pciPlanNameMutations),
    0,
    'La vista estable de planes no debe seguir generando mutaciones.',
  );

  await page.keyboard.press('Escape');
  await page.waitForSelector('#pciPlansBackdrop', { state: 'hidden' });
  await renamedCard.locator('[data-pci-plan-entry] button').click();
  await page.waitForSelector('#pciPlansBackdrop:not([hidden])');
  await page.locator('[data-plans-close]').click();
  await page.waitForSelector('#pciPlansBackdrop', { state: 'hidden' });

  assert.deepEqual(browserErrors, [], `Errores detectados en navegador:\n${browserErrors.join('\n')}`);
  console.log('Regresión de nombres de planes completada correctamente.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
