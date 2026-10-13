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
  await page.locator('#pciImportSavedStatus').waitFor({state:'visible'});
  assert.match(await page.locator('#pciImportSavedStatus').innerText(),/En esta sesión todavía no se detecta trabajo previo/);
  await page.evaluate(() => {
    const state=window.PCIApp.getState();
    state.areas.Matemática.groups[0].items.push('contenido-de-prueba-para-detectar');
    window.dispatchEvent(new CustomEvent('pci-state-change'));
  });
  assert.match(await page.locator('#pciImportSavedStatus').innerText(),/Hay trabajo cargado en esta Matriz/);
  assert.match(await page.locator('#pciImportSavedStatus').innerText(),/1 contenidos ubicados/);
  await page.evaluate(() => {
    const state=window.PCIApp.getState();
    state.areas.Matemática.groups[0].items.pop();
    window.dispatchEvent(new CustomEvent('pci-state-change'));
  });
  assert.match(await page.locator('#pciImportSavedStatus').innerText(),/En esta sesión todavía no se detecta trabajo previo/);
  // La importación es una revisión aislada, NO una escritura ni un merge.
  const originalBefore = await page.evaluate(() => localStorage.getItem('pciAppV2'));
  await page.locator('#pciImportOpen').click();
  assert.equal(await page.locator('#pci-import-review').evaluate(el=>el.open),true);
  await page.locator('#pciImportPrepare').click();
  await page.locator('#pciImportReviewContent').waitFor({state:'visible'});
  assert.match(await page.locator('#pciImportMetrics').innerText(),/Agrupamientos/);
  assert.equal(await page.locator('#pciImportApprove').isDisabled(),true);
  await page.locator('#pciImportReviewed').check();
  await page.locator('#pciImportApprove').click();
  assert.match(await page.locator('#pciImportResult').innerText(),/no se escribió ningún dato escolar/);
  assert.equal(await page.evaluate(() => localStorage.getItem('pciAppV2')),originalBefore);
  await page.locator('#pciImportClose').click();
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
  await page.locator('#pciDemoFoCards [data-pci-fo-format]').first().waitFor({timeout:20000});
  assert.equal(await page.locator('#pciDemoFoCards .pci-fo-card').count(),3,
    'FO debe tener exactamente tres mosaicos pedagógicos, no una tarjeta por año');
  assert.deepEqual(await page.locator('#pciDemoFoCards [data-pci-fo-format]').evaluateAll(items=>
    items.map(item=>item.dataset.pciFoFormat)), ['laboratorios','talleres','proyecto']);
  assert.equal(await page.locator('#pciDemoOrientationTabs button').count(),2);
  assert.equal(await page.locator('#pciDemoOrientationSelect').isVisible(),false,'El desplegable no debe duplicar las orientaciones');
  assert.match(await page.locator('#pciDemoFoCards [data-pci-fo-format="proyecto"]').innerText(),/Proyecto de Vinculación con el Futuro/);
  assert.match(await page.locator('#pciDemoFoCards [data-pci-fo-format="proyecto"]').innerText(),/C9 y C10/);
  assert.equal(await page.locator('body').innerText().then(txt=>txt.includes('V2')),false,
    'La interfaz de Matriz no debe mostrar etiquetas técnicas V2');
  await page.locator('#pciDemoFoCards [data-pci-fo-format="proyecto"]').click();
  assert.equal(await page.locator('#pci-area-detail').evaluate(node=>node.open),true);
  assert.match(await page.locator('#pciAreaDetailGroups').innerText(),/5.º año/);
  assert.match(await page.locator('#pciAreaDetailGroups').innerText(),/C9 \+ C10/);
  assert.equal(await page.locator('.pci-area-detail-legacy').isVisible(),false,
    'Las materias FO no deben confundirse con la FG histórica');
  await page.locator('#pciAreaDetailClose').click();
  await page.locator('#pciDemoFoCards [data-pci-fo-format="laboratorios"]').click();
  assert.match(await page.locator('#pciAreaDetailStatus').innerText(),/Restan definir 4 formatos/);
  await page.locator('#pciAreaDetailClose').click();
  await page.locator('#pciDemoOrientationTabs button[data-orientation="Matemática y Física"]').click();
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
  // El panel no puede repetir el número fijo del modelo heredado.
  const socialTile=page.locator('#areaGrid button[data-area="Ciencias Sociales"]');
  await page.waitForFunction(()=>
    document.querySelector('#areaGrid [data-area="Ciencias Sociales"] .pill')?.textContent.includes('10 laboratorios'),
    {timeout:15000});
  assert.match(await socialTile.locator('.pill').innerText(),/10 laboratorios/);
  await socialTile.click();
  assert.equal(await page.locator('#pci-area-detail').evaluate(node=>node.open),true);
  assert.match(await page.locator('#pciAreaDetailStatus').innerText(),/10 laboratorios/);
  assert.equal(await page.locator('#pciAreaDetailGroups .pci-offer-year-card').nth(2).locator('.pci-offer-group').count(),2);
  assert.match(await page.locator('#pciAreaDetailLegacyInfo').innerText(),/12 agrupamientos históricos/);
  await page.locator('#pciAreaDetailClose').click();

  // Dos composiciones V2 deliberadamente distintas de la misma FG inicial.
  // No se escribe ni se normaliza ninguna secuencia de Matriz.
  const oldFg=await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('pciAppV2') || '{}').areas));
  await page.evaluate(()=>{
    const key='pci-matriz-fg-v2-original-preview-20261009';
    const data=JSON.parse(localStorage.getItem(key) || '{}');
    data.maps=data.maps||{};
    data.maps['Economía y Administración']={
      ...data.maps['Economía y Administración'],socialOption:'A',
      placements:{'socialA-c5':['fg-3-historia','fg-3-economia'],
        'socialA-c6':['fg-3-historia','fg-3-economia']}
    };
    data.maps['Matemática y Física']={
      ...data.maps['Matemática y Física'],socialOption:'B',
      placements:{'socialA-c5':['fg-3-historia'],'socialA-c6':['fg-3-historia'],
        'socialB-c5':['fg-3-geografia'],'socialB-c6':['fg-3-geografia']}
    };
    localStorage.setItem(key,JSON.stringify(data));
  });
  await page.locator('#pciDemoOrientationTabs button[data-orientation="Economía y Administración"]').click();
  assert.match(await socialTile.locator('.pill').innerText(),/10 laboratorios/);
  await page.locator('#pciDemoOrientationTabs button[data-orientation="Matemática y Física"]').click();
  assert.match(await socialTile.locator('.pill').innerText(),/12 laboratorios/);
  await socialTile.click();
  assert.match(await page.locator('#pciAreaDetailStatus').innerText(),/12 laboratorios/);
  assert.equal(await page.locator('#pciAreaDetailGroups .pci-offer-year-card').nth(2).locator('.pci-offer-group').count(),4);
  assert.match(await page.locator('#pciAreaDetailGroups').innerText(),/C5/);
  assert.match(await page.locator('#pciAreaDetailGroups').innerText(),/C6/);
  assert.match(await page.locator('#pciAreaDetailLegacyInfo').innerText(),/12 agrupamientos históricos/);
  const newFg=await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('pciAppV2') || '{}').areas));
  assert.equal(newFg,oldFg,'Cambiar de orientación/opción V2 no puede tocar las secuencias originales');
  await page.screenshot({path:artifacts+'desktop-detalle-12-sociales.png',fullPage:true});
  await page.locator('#pciAreaDetailLegacy').click();
  assert.equal(await page.locator('#board.screen.active').count(),1,
    'La FG histórica conserva su pantalla de edición independiente del mapa');
  await page.locator('#backOverview').click();
  await page.waitForFunction(()=>
    document.querySelector('#areaGrid [data-area="Ciencias Sociales"] .pill')?.textContent.includes('12 laboratorios'),
    {timeout:15000});
  await page.screenshot({path:artifacts+'desktop-matriz-opcion-12.png',fullPage:true});

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
  assert.equal(await page.locator('#pciDemoFoCards [data-pci-fo-format]').count(),3);
  assert.equal(await page.locator('#pciDemoOrientationTabs button').count(),2);
  assert.equal(await page.locator('#pciDemoOrientationTabs').isVisible(),true);
  assert.equal(await page.locator('#pciDemoOrientationSelect').isVisible(),false);
  const first=page.locator('#pciDemoOrientationTabs button').first();
  const second=page.locator('#pciDemoOrientationTabs button').nth(1);
  await second.click();
  assert.equal(await second.getAttribute('aria-pressed'),'true');
  await first.click();
  assert.equal(await first.getAttribute('aria-pressed'),'true');
  const gridGeometry=await page.locator('#pciDemoFoCards').evaluate((el)=>{
    const cards=[...el.querySelectorAll('.pci-fo-card')];
    return cards.map(card=>({
      left:Math.round(card.getBoundingClientRect().left),
      top:Math.round(card.getBoundingClientRect().top),
      width:Math.round(card.getBoundingClientRect().width)
    }));
  });
  assert.ok(gridGeometry[1].top>gridGeometry[0].top,
    'En celular cada formato debe tener su propia fila: '+JSON.stringify(gridGeometry));
  await page.locator('#pciMapOpen').click();
  await page.waitForFunction(()=>!document.querySelector('#pciMapPrint').disabled,{timeout:65000});
  const mobileOverlay=await page.locator('#pci-map-overlay').evaluate((el)=>({
    height:Math.round(el.getBoundingClientRect().height),
    screen:innerHeight,
    maxScroll:document.documentElement.scrollWidth>innerWidth+2
  }));
  assert.ok(mobileOverlay.height <= mobileOverlay.screen+1,'Mapa a pantalla completa en móvil');
  assert.equal(mobileOverlay.maxScroll,false);
  await page.locator('#pciMapClose').click();
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
