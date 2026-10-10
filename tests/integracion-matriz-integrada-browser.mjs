import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port = 4185;
const url = 'http://127.0.0.1:' + port + '/app.html';
const artifacts = 'test-artifacts/integracion-matriz/';
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {stdio:'inherit'});
let browser;

async function serve() {
  for (let i=0; i<80; i++) {
    try { if ((await fetch(url)).ok) return; } catch (_) {}
    await new Promise((resolve)=>setTimeout(resolve,300));
  }
  throw new Error('No arrancó la vista de prueba original de Matriz.');
}

async function testDesktop(page) {
  const errors=[],remote=[];
  page.on('pageerror', (e)=>errors.push(e.message));
  page.on('request', (r)=>{if (/supabase\.co/.test(r.url())) remote.push(r.url());});
  await page.goto(url, {waitUntil:'domcontentloaded'});
  await page.locator('#areaGrid .area-card').first().waitFor({timeout:60000});
  assert.ok(await page.locator('#areaGrid .area-card').count() >= 6,
    'Deben permanecer los mosaicos curriculares originales de Matriz');
  assert.equal(await page.locator('#pciDemoOrientationSelect option').count(),2,
    'El selector debe mostrar solo orientaciones habilitadas en la prueba');
  const geometry = await page.evaluate(()=>{
    const left=document.querySelector('#overview .pci-offer-sidebar').getBoundingClientRect();
    const right=document.querySelector('#overview .pci-workspace-content').getBoundingClientRect();
    return {left:left.x,right:right.x,leftWidth:left.width,rightWidth:right.width};
  });
  assert.ok(geometry.right>geometry.left+geometry.leftWidth-3,
    'El panel de orientación debe quedar a la izquierda de Matriz: '+JSON.stringify(geometry));
  assert.equal(await page.locator('#pciDemoFoCards .pci-fo-card').count(),3,
    'La Formación Orientada debe mostrarse por año (3.º a 5.º) sin porcentajes ficticios');

  await page.locator('#pciDemoOrientationSelect').selectOption('Matemática y Física');
  assert.match(await page.locator('#pciDemoOrientationContext').innerText(),/Matemática y Física/);
  await page.locator('#pciMapOpen').click();
  await page.waitForFunction(()=>!document.querySelector('#pciMapPrint').disabled,{timeout:65000});
  const frame=page.frameLocator('#pci-map-iframe');
  await frame.locator('#offer.screen.active #matrix .drop').first().waitFor({timeout:65000});
  assert.ok(await frame.locator('#offer.screen.active #matrix .drop').count() > 30,
    'El Mapa de la Oferta debe ser el motor real V2 con C1-C10');
  assert.equal(await frame.locator('#home.screen.active').count(),0,
    'No se debe abrir otra portada V2 dentro del mapa');

  await page.locator('#pciMapYear').selectOption('3');
  await page.waitForFunction(()=>{
    const doc=document.querySelector('#pci-map-iframe')?.contentDocument;
    return !!doc?.querySelector('#bagContent [data-bag-year="3"].active');
  },{timeout:40000});
  assert.equal(await frame.locator('#bagContent [data-bag-year]').count(),5,
    'La bolsa curricular debe ofrecer selección real por los cinco años');

  await page.locator('#pciMapPrint').click();
  await frame.locator('#printModal.open .pci-print-sheet').waitFor({timeout:45000});
  const print=await frame.locator('#printModal.open .pci-print-sheet').evaluate((sheet)=>({
    title:sheet.querySelector('h1')?.textContent,
    levels:[...sheet.querySelectorAll('.pci-print-level')].map((node,i)=>({
      year:i+1,display:node.style.display
    })),
    subjects:sheet.querySelectorAll('.pci-print-subject').length
  }));
  assert.match(print.title||'',/3\..*año/);
  assert.equal(print.levels.length,5,'Se conserva la plantilla de cinco niveles de V2');
  assert.deepEqual(print.levels.filter(x=>x.display!=='none').map(x=>x.year),[3],
    'La impresión seleccionada debe contener solo 3.º año');
  assert.equal(await frame.locator('#printModal.open button:has-text("Imprimir / PDF")').count(),1,
    'Se conserva la acción nativa de impresión/PDF de V2');

  await page.screenshot({path:artifacts+'desktop-mapa-completo.png',fullPage:false});
  await page.locator('#pciMapClose').click();
  assert.equal(await page.locator('#pci-map-overlay').isVisible(),false);
  assert.ok(await page.locator('#areaGrid .area-card').count()>=6,
    'Volver al PCI no debe reconstruir ni borrar los mosaicos Matriz');
  await page.screenshot({path:artifacts+'desktop-matriz-integrada.png',fullPage:true});
  assert.deepEqual(remote,[],'La vista aislada no debe contactar Supabase');
  assert.deepEqual(errors,[],'Errores JavaScript en la vista integrada: '+errors.join(' | '));
}

async function testMobile(page) {
  const errors=[];
  page.on('pageerror',(e)=>errors.push(e.message));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#areaGrid .area-card').first().waitFor({timeout:60000});
  const layout=await page.evaluate(()=>{
    const left=document.querySelector('#overview .pci-offer-sidebar').getBoundingClientRect();
    const right=document.querySelector('#overview .pci-workspace-content').getBoundingClientRect();
    return {left:Math.round(left.y),right:Math.round(right.y),overflow:document.documentElement.scrollWidth>innerWidth+2};
  });
  assert.ok(layout.right>layout.left,'En móvil el panel y los mosaicos deben apilarse');
  assert.equal(layout.overflow,false,'La Matriz principal no debe desbordar horizontalmente');
  await page.screenshot({path:artifacts+'mobile-matriz-integrada.png',fullPage:true});
  assert.deepEqual(errors,[]);
}

try {
  await mkdir(artifacts,{recursive:true});
  await serve();
  browser=await chromium.launch({headless:true});
  const desktop=await browser.newContext({viewport:{width:1440,height:1000}});
  await testDesktop(await desktop.newPage());
  await desktop.close();
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:2,hasTouch:true});
  await testMobile(await mobile.newPage());
  await mobile.close();
  console.log('Integración visual Matriz + mapa V2: escritorio, móvil, año e impresión aprobados.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
