import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const PORT = 4174;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ARTIFACTS = 'test-artifacts';
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { stdio: 'inherit' });

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/fase5-horas.html`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('El servidor local de Fase 5 no respondió a tiempo.');
}

await mkdir(ARTIFACTS, { recursive: true });
let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

  await page.goto(`${BASE_URL}/fase5-horas.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.removeItem('pciHoursV1');
    localStorage.setItem('pciAppV2', JSON.stringify({
      schoolName: 'Prueba Fase 5',
      areas: {
        'Otros formatos pedagógicos': {
          groups: [{
            id: 'otro-tutoria-prueba', kind: 'other', name: 'Tutoría de prueba', duration: 'quarterly',
            level: 1, startTerm: 1, endTerm: 1, formatType: 'Proyecto', type: 'Obligatorio', items: [],
          }],
        },
      },
    }));
  });
  await page.reload({ waitUntil: 'networkidle' });

  assert.match(await page.locator('#summary').innerText(), /36 h/);
  assert.match(await page.locator('#summary').innerText(), /14 h/);
  assert.equal(await page.locator('#missingPlanNote').isHidden(), true, 'Naturales ya debe integrar el presupuesto.');

  const biologyC1 = page.locator('[data-hour-subject="biologia"]');
  assert.equal(await biologyC1.count(), 1, 'C1 debe mostrar Biología dentro de Ciencias Naturales.');
  await biologyC1.fill('10');
  assert.equal(await biologyC1.inputValue(), '4', 'Biología N1 debe trabarse en 4 h.');

  const tutoriaRow = page.locator('[data-status-subject="tutoria"]');
  assert.match(await tutoriaRow.innerText(), /1 h/);
  assert.match(await tutoriaRow.innerText(), /0 h/);

  await page.locator('[data-hour-group="otro-tutoria-prueba"][data-hour-subject="tutoria"]').fill('1');
  assert.match(await tutoriaRow.innerText(), /Cerrado/);

  const allTechInputs = page.locator('[data-hour-subject="tecnologia-informacion"]');
  assert.ok(await allTechInputs.count() >= 2, 'C1 debe permitir repartir Tecnología entre Talleres y Otros formatos.');
  await allTechInputs.nth(0).fill('1.5');
  await allTechInputs.nth(1).fill('4');
  assert.equal(await allTechInputs.nth(1).inputValue(), '0.5', 'El segundo campo debe trabarse en el saldo disponible de 0,5 h.');
  assert.match(await page.locator('[data-status-subject="tecnologia-informacion"]').innerText(), /2 h.*2 h/s);
  assert.doesNotMatch(await page.locator('[data-status-subject="tecnologia-informacion"]').innerText(), /Excede/);

  await page.locator('[data-term="5"]').click();
  assert.match(await page.locator('#summary').innerText(), /32 h/);
  assert.equal(
    await page.locator('.group-card .area-label', { hasText: 'Ciencias Sociales' }).count(),
    2,
    'C5 debe mostrar dos laboratorios de Ciencias Sociales simultáneos.',
  );
  assert.equal(
    await page.locator('.group-card .area-label', { hasText: 'Artes' }).count(),
    0,
    'Artes no debe mostrarse en Nivel 3 porque no tiene carga horaria.',
  );
  const biologyC5 = page.locator('[data-hour-subject="biologia"]');
  const fqC5 = page.locator('[data-hour-subject="fisico-quimica"]');
  assert.equal(await biologyC5.count(), 1);
  assert.equal(await fqC5.count(), 1);
  await biologyC5.fill('10');
  await fqC5.fill('10');
  assert.equal(await biologyC5.inputValue(), '3', 'Biología N3 debe trabarse en 3 h.');
  assert.equal(await fqC5.inputValue(), '4', 'Físico-Química N3 debe trabarse en 4 h.');

  await page.locator('[data-term="7"]').click();
  assert.match(await page.locator('#summary').innerText(), /27 h/);
  const physicsC7 = page.locator('[data-hour-subject="fisica"]');
  assert.equal(await physicsC7.count(), 1, 'N4 debe mostrar Física en Ciencias Naturales.');
  await physicsC7.fill('10');
  assert.equal(await physicsC7.inputValue(), '3', 'Física N4 debe trabarse en 3 h.');

  await page.locator('[data-term="10"]').click();
  assert.match(await page.locator('#summary').innerText(), /20 h/);
  assert.equal(
    await page.locator('.group-card .area-label', { hasText: 'Artes' }).count(),
    0,
    'Artes no debe mostrarse en Nivel 5 porque no tiene carga horaria.',
  );
  const naturalC10 = page.locator('.group-card', { has: page.locator('.area-label', { hasText: 'Ciencias Naturales' }) });
  assert.equal(await naturalC10.count(), 1, 'C10 debe conservar un laboratorio de Ciencias Naturales.');
  assert.match(await naturalC10.innerText(), /Laboratorio 10/);
  const chemistryC10 = naturalC10.locator('[data-hour-subject="quimica"]');
  await chemistryC10.fill('10');
  assert.equal(await chemistryC10.inputValue(), '4', 'Química N5 debe trabarse en 4 h.');

  await page.screenshot({ path: `${ARTIFACTS}/09-fase5-carga-horaria.png`, fullPage: true });
  assert.deepEqual(errors, [], `Errores de navegador en Fase 5:\n${errors.join('\n')}`);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
