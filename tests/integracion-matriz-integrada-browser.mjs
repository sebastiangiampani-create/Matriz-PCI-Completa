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

async function conformFourFoFormats(page) {
  // Datos exclusivamente sintéticos de la prueba: construir una oferta
  // con un laboratorio y un taller en 3.º, lo mismo en 4.º,
  // más dos laboratorios y dos talleres prescriptos en 5.º.
  await page.evaluate(()=>{
    const key='pci-matriz-fg-v2-original-preview-20261009';
    const state=JSON.parse(localStorage.getItem(key)||'{}');
    if(!state.maps)state.maps={};
    if(!state.maps['Economía y Administración'])
      state.maps['Economía y Administración']={placements:{},valid:false};
    const map=state.maps['Economía y Administración'];
    map.foTypes={
      ...(map.foTypes||{}),
      '3':{'5':'lab','6':'taller'},
      '4':{'7':'lab','8':'taller'}
    };
    localStorage.setItem(key,JSON.stringify(state));
    window.dispatchEvent(new Event('pci-matriz-offer-update'));
  });
}

async function testDesktop(page) {
  const errors=[],remote=[];
  page.on('pageerror', (e)=>errors.push(e.message));
  page.on('request', (r)=>{if (/supabase\.co/.test(r.url())) remote.push(r.url());});
  await page.goto(url, {waitUntil:'domcontentloaded'});
  await page.locator('#areaGrid .area-card').first().waitFor({timeout:60000});
  await page.locator('#pciImportSavedStatus').waitFor({state:'visible'});
  assert.match(await page.locator('#pciImportSavedStatus').innerText(),/En esta sesión todavía no se detecta trabajo previo/);
  assert.equal(await page.evaluate(()=>window.PCIApp.getActiveOrientation()),null);
  // El original se conserva y sólo se consulta: no se edita antes del OK.
  // La importación es una revisión aislada, NO una escritura ni un merge.
  const originalBefore = await page.evaluate(() => localStorage.getItem('pciAppV2'));
  await page.locator('#pciImportOpen').click();
  assert.equal(await page.locator('#pci-import-review').evaluate(el=>el.open),true);
  await page.locator('#pciImportPrepare').click();
  await page.locator('#pciImportReviewContent').waitFor({state:'visible'});
  assert.match(await page.locator('#pciImportMetrics').innerText(),/Agrupamientos/);
  assert.equal(await page.locator('#pciImportApprove').isDisabled(),true);
  assert.equal(await page.locator('#pciImportExcel').isEnabled(),true);
  assert.equal(await page.locator('#pciImportWord').isEnabled(),true);
  const beforeExport=await page.evaluate(()=>localStorage.getItem('pciAppV2'));
  const [xlsxDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#pciImportExcel').click()
  ]);
  assert.match(xlsxDownload.suggestedFilename(),/\.xlsx$/);
  const [wordDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#pciImportWord').click()
  ]);
  assert.match(wordDownload.suggestedFilename(),/\.docx$/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('pciAppV2')),beforeExport,
    'Exportar no puede alterar la Matriz previa');

  await page.locator('#pciImportReviewed').check();
  await page.locator('#pciImportApprove').click();
  assert.equal(await page.locator('#pci-import-review').evaluate(el=>el.open),false);
  assert.equal(await page.evaluate(()=>window.PCIApp.getActiveOrientation()),'Economía y Administración');
  assert.equal(await page.evaluate(() => localStorage.getItem('pciAppV2')),originalBefore);
  assert.equal(await page.locator('#pciClassicToggle').count(),0);
  const editKey='pci-matriz-orientacion-borrador-20261014:'+encodeURIComponent('Economía y Administración');
  assert.ok(await page.evaluate(key=>localStorage.getItem(key),editKey),
    'El OK debe habilitar una copia independiente por orientación');
  assert.ok(await page.evaluate(key=>localStorage.getItem(key+':original-sin-transformar'),editKey),
    'La copia original debe estar respaldada antes de habilitar la edición');
  await page.locator('#areaGrid button[data-area="Artes"]').click();
  assert.equal(await page.locator('#board.screen.active').count(),1);
  assert.match(await page.locator('#boardTitle').innerText(),/Artes/);
  assert.equal(await page.locator('#groups .group-card').count(),6);
  await page.locator('#pciFgCoverageDashboard').waitFor({state:'visible',timeout:60000});
  await page.locator('#pciFgCoverageDashboard > summary').click();
  assert.match(await page.locator('#pciFgCoverageLevels').innerText(),/Cobertura por nivel y formato/);
  assert.match(await page.locator('#pciFgCoverageSubjects').innerText(),/Cobertura por materia y nivel/);
  assert.match(await page.locator('#pciFgCoverageGroups').innerText(),/Cobertura por espacio y plan/);
  await page.locator('#contentList [data-content-id]').first().dragTo(page.locator('#groups .group-card').first());
  const afterDrag=await page.evaluate(key=>{
    const state=JSON.parse(localStorage.getItem(key));
    return state.areas.Artes.groups[0].items.length;
  },editKey);
  assert.equal(afterDrag,1,'La copia aprobada debe permitir drag & drop del editor original');
  assert.equal(await page.evaluate(()=>localStorage.getItem('pciAppV2')),originalBefore,
    'El editor drag & drop nunca debe sobrescribir la Matriz original');
  await page.locator('#backOverview').click();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(() =>
    window.PCIApp?.ready &&
    window.PCIApp.getActiveOrientation()==='Economía y Administración',{timeout:60000});
  await page.locator('#areaGrid button[data-area="Artes"]').click();
  assert.equal(await page.locator('#groups .group-card').first().locator('.assigned-item').count(),1,
    'El borrador aprobado debe recuperar su drag & drop después de recargar');
  await page.locator('#backOverview').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('pciAppV2')),originalBefore);
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
  await page.waitForFunction(()=>Boolean(window.PCIFoDesarrollo),{timeout:25000});
  await conformFourFoFormats(page);
  const originalFoBefore=await page.evaluate(()=>localStorage.getItem('pciAppV2'));
  await page.locator('#pciDemoFoCards [data-pci-fo-format="proyecto"]').click();
  assert.equal(await page.locator('#pci-fo-development').isVisible(),true,
    'Proyecto de Vinculación debe abrir el desarrollo curricular, no la matriz');
  assert.equal(await page.locator('#pci-integrated-matrix').isVisible(),false);
  assert.match(await page.locator('#pciFoTitle').innerText(),/Proyecto de Vinculación/);
  assert.equal(await page.locator('#pciFoYear').inputValue(),'5');
  assert.equal(await page.locator('#pciFoGroupCards [data-fo-group]').count(),1);
  await page.locator('#pciFoCoverage').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#pciFoCoverage')?.textContent?.trim().length>0,{timeout:45000});
  assert.match(await page.locator('#pciFoCoverage').innerText(),/trayectoria/i,
    'La cobertura FO debe aparecer al cargar el catálogo oficial.');
  await page.locator('#pciFoCoverageDashboard > summary').click();
  assert.equal(await page.locator('#pciFoCoverageLevels .pci-fo-cover-level').count(),3);
  assert.ok(await page.locator('#pciFoCoverageSubjects .pci-fo-metric-row').count()>0);
  assert.ok(await page.locator('#pciFoCoverageSpaces .pci-fo-cover-space').count()>0);
  assert.match(await page.locator('#pciFoCoverageBasis').innerText(),/no por año|no tiene año|no por nivel|por trayectoria/i);
  assert.equal(await page.locator('#pciFoDetails').evaluate(el=>el.open),false,
    'El desarrollo de planes permanece plegado hasta que se elija un espacio');
  await page.locator('#pciFoGroupCards [data-edit-group]').first().click();
  assert.equal(await page.locator('#pciFoFields').isVisible(),true);
  assert.match(await page.locator('#pciFoPlanCoverage').innerText(),/trayectoria orientada|trayectoria/i);
  assert.equal(await page.locator('#pciFoStages .pci-fo-stage').count(),4);
  await page.locator('#pciFoContentList [data-fo-content]').first().waitFor({timeout:45000});
  const chosenFoContent=await page.locator('#pciFoContentList [data-fo-content]').first().getAttribute('value');
  await page.locator('#pciFoContentList [data-content-id]').first().dragTo(
    page.locator('#pciFoGroupCards [data-fo-group]').first().locator('.pci-fo-group-assigned'));
  assert.equal(await page.locator('#pciFoGroupCards [data-fo-group] .assigned-item').count(),1);
  await page.locator('#pciFoObjective').fill('Objetivos curriculares del proyecto');
  await page.locator('#pciFoPlan').selectOption('2');
  await page.locator('#pciFoPlanContents [data-plan-content]').first().check();
  await page.locator('#pciFoPlanObjectives').fill('Objetivos del tercer bimestre');
  await page.locator('#pciFoStages [data-stage="evaluacion"][data-field="description"]').fill('Evaluar el proyecto');
  await page.waitForFunction(()=>!!localStorage.getItem('pci-fo-development-drafts-preview-20261014'));
  const stored=await page.evaluate(()=>{
    const s=JSON.parse(localStorage.getItem('pci-fo-development-drafts-preview-20261014'));
    return s.orientations['Economía y Administración'].spaces['proyecto-n5'];
  });
  assert.equal(stored.plansBimestrales[2].stages.evaluacion.description,'Evaluar el proyecto');
  assert.deepEqual(stored.items,[chosenFoContent]);
  assert.deepEqual(stored.plansBimestrales[2].contentIds,[chosenFoContent]);
  assert.equal(await page.evaluate(()=>localStorage.getItem('pciAppV2')),originalFoBefore,
    'El desarrollo FO no puede alterar la FG histórica');
  await page.locator('#pciFoClose').click();
  await page.locator('#pciDemoFoCards [data-pci-fo-format="proyecto"]').click();
  await page.locator('#pciFoGroupCards [data-edit-group]').first().click();
  assert.equal(await page.locator('#pciFoObjective').inputValue(),'Objetivos curriculares del proyecto');
  await page.locator('#pciFoPlan').selectOption('2');
  assert.equal(await page.locator('#pciFoPlanObjectives').inputValue(),'Objetivos del tercer bimestre');
  await page.locator('#pciFoClose').click();
  await page.locator('#pciDemoFoCards [data-pci-fo-format="laboratorios"]').click();
  assert.equal(await page.locator('#pci-fo-development').isVisible(),true);
  assert.match(await page.locator('#pciFoTitle').innerText(),/Laboratorios de la orientación/);
  assert.equal(await page.locator('#pciFoYear').inputValue(),'0',
    'Laboratorios abre mostrando todos los años, no solamente tercero o quinto');
  assert.equal(await page.locator('#pciFoGroupCards [data-fo-group]').count(),4,
    'Deben verse los cuatro laboratorios conformados simultáneamente');
  assert.deepEqual(await page.locator('#pciFoGroupCards [data-fo-group] .pci-fo-year-pill').allTextContents(),
    ['3.º año','4.º año','5.º año','5.º año']);
  assert.equal(await page.locator('#pciFoGroupCards [data-fo-group] .pci-fo-card-fields').count(),4);
  assert.equal(await page.locator('#pciFoGroupCards [data-fo-group] .pci-fo-card-coverage').count(),4);
  assert.match(await page.locator('#pciFoGroupCards [data-fo-group]').first().innerText(),/Carácter del agrupamiento|Contexto problematizador/);
  assert.equal(await page.locator('#pciFoSearch').isVisible(),true);
  assert.equal(await page.locator('#pciFoBlockFilter').isVisible(),true);
  assert.equal(await page.locator('#pciFoAxisFilter').isVisible(),true);
  assert.equal(await page.locator('#pciFoPendingOnly').isVisible(),true);
  await page.locator('#pciFoContentList [data-content-id]').first().waitFor({timeout:45000});
  const beforeFiltering=await page.locator('#pciFoContentList [data-fo-content]').count();
  const firstBlock=await page.locator('#pciFoBlockFilter option').nth(1).getAttribute('value');
  await page.locator('#pciFoBlockFilter').selectOption(firstBlock);
  assert.ok((await page.locator('#pciFoContentList [data-fo-content]').count())<=beforeFiltering);
  await page.locator('#pciFoBlockFilter').selectOption('');
  const firstDescription=await page.locator('#pciFoContentList .pci-fo-content-choice small').first().innerText();
  await page.locator('#pciFoSearch').fill(firstDescription.slice(-12));
  assert.ok((await page.locator('#pciFoContentList [data-fo-content]').count())>=1);
  await page.locator('#pciFoSearch').fill('');
  await page.locator('#pciFoYear').selectOption('5');
  assert.equal(await page.locator('#pciFoGroupCards [data-fo-group]').count(),2,
    'Filtrar quinto sólo muestra sus dos laboratorios sin borrar los demás');
  await page.locator('#pciFoContentList [data-content-id]').first().waitFor({timeout:45000});
  await page.locator('#pciFoContentList [data-content-id]').first().dragTo(
    page.locator('#pciFoGroupCards [data-fo-group]').first());
  assert.equal(await page.locator('#pciFoGroupCards [data-fo-group]').first().locator('.assigned-item').count(),1);
  await page.locator('#pciFoGroupCards [data-edit-group]').first().click();
  await page.locator('#pciFoPlanContents [data-plan-content]').first().check();
  await page.locator('#pciFoGroupCards [data-fo-group]').first().locator('.assigned-item').first().dragTo(
    page.locator('#pciFoGroupCards [data-fo-group]').nth(1).locator('.pci-fo-group-assigned'));
  const moveDebug=await page.evaluate(()=>{
    const cards=[...document.querySelectorAll('#pciFoGroupCards [data-fo-group]')];
    return {status:document.querySelector('#pciFoSaved')?.textContent,
      groups:cards.map(x=>({id:x.dataset.foGroup,
        items:[...x.querySelectorAll('.assigned-item')].map(y=>y.dataset.contentId)})),
      selected:document.querySelector('#pciFoSpace')?.value};
  });
  assert.equal(await page.locator('#pciFoGroupCards [data-fo-group]').first().locator('.assigned-item').count(),0,
    'Traslado FO entre tarjetas: '+JSON.stringify(moveDebug));
  assert.equal(await page.locator('#pciFoGroupCards [data-fo-group]').nth(1).locator('.assigned-item').count(),1);
  const foMoved=await page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem('pci-fo-development-drafts-preview-20261014'));
    const spaces=state.orientations['Economía y Administración'].spaces;
    return {a:spaces['foLab5-c9']?.items||[],b:spaces['foLab5-c10']?.items||[]};
  });
  assert.equal(foMoved.a.length,0);
  assert.equal(foMoved.b.length,1);
  const retained=await page.evaluate(()=>{
    const root=JSON.parse(localStorage.getItem('pci-fo-development-drafts-preview-20261014'));
    const space=root.orientations['Economía y Administración'].spaces['foLab5-c9'];
    return {contentRefs:space.plansBimestrales[0].contentIds,
      relocated:space.contentRelocationReview};
  });
  assert.equal(retained.contentRefs.length,1,'Un traslado no puede borrar el plan ya elaborado');
  assert.equal(retained.relocated.length,1,'El espacio anterior debe quedar marcado para revisión');
  await page.locator('#pciFoGroupCards [data-fo-group]').first().click();
  assert.match(await page.locator('#pciFoReviewWarning').innerText(),/Revisar planes/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('pciAppV2')),originalFoBefore);
  await page.locator('#pciFoClose').click();
  await page.locator('#pciDemoFoCards [data-pci-fo-format="talleres"]').click();
  assert.equal(await page.locator('#pciFoYear').inputValue(),'0',
    'Talleres abre mostrando todos sus años');
  assert.equal(await page.locator('#pciFoGroupCards [data-fo-group]').count(),4,
    'Los cuatro talleres se muestran juntos, como Formación General');
  assert.ok(await page.locator('#pciFoGroupCards .pci-fo-year-pill').count()===4);
  await page.locator('#pciFoYear').selectOption('5');
  assert.equal(await page.locator('#pciFoGroupCards [data-fo-group]').count(),2);
  await page.locator('#pciFoYear').selectOption('0');
  assert.equal(await page.locator('#pciFoGroupCards [data-fo-group]').count(),4);
  await page.locator('#pciFoClose').click();
  await page.locator('#overviewMatrix').click();
  assert.equal(await page.locator('#pci-integrated-matrix').isVisible(),true);
  assert.match(await page.locator('#pciIntegratedHead').innerText(),/C1/);
  assert.match(await page.locator('#pciIntegratedBody').innerText(),/Formación Orientada/);
  await page.locator('#pciIntegratedClose').click();
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
  // Tras importar no hay popup "Matriz original": se edita el área directamente.
  // Al cambiar de orientación, la edición previa queda en su propia clave.
  await socialTile.click();
  assert.equal(await page.locator('#pci-import-review').evaluate(el=>el.open),true,
    'Sin importar la orientación nueva, se debe solicitar primero el OK');
  await page.locator('#pciImportPrepare').click();
  await page.locator('#pciImportReviewed').check();
  await page.locator('#pciImportApprove').click();
  assert.equal(await page.evaluate(()=>window.PCIApp.getActiveOrientation()),'Matemática y Física');
  await socialTile.click();
  assert.equal(await page.locator('#board.screen.active').count(),1);
  assert.equal(await page.locator('#groups .group-card').count(),12);
  const secondKey='pci-matriz-orientacion-borrador-20261014:'+encodeURIComponent('Matemática y Física');
  await page.locator('#groups .group-card').first().locator('[data-field="name"]').fill('Sociales editado solo en Matemática y Física');
  await page.locator('#groups .group-card').first().locator('[data-field="name"]').blur();
  assert.equal((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),secondKey)).areas['Ciencias Sociales'].groups[0].name,
    'Sociales editado solo en Matemática y Física');
  assert.equal(await page.evaluate(()=>localStorage.getItem('pciAppV2')),originalBefore);
  await page.locator('#backOverview').click();
  await page.locator('#pciDemoOrientationTabs button[data-orientation="Economía y Administración"]').click();
  assert.equal(await page.evaluate(()=>window.PCIApp.getActiveOrientation()),'Economía y Administración');
  await page.locator('#areaGrid button[data-area="Artes"]').click();
  assert.equal(await page.locator('#groups .group-card').count(),6);
  assert.equal(await page.locator('#groups .group-card').first().locator('.assigned-item').count(),1,
    'La orientación inicial recupera su drag & drop sin mezclar otra orientación');
  await page.locator('#backOverview').click();
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
  await page.waitForFunction(()=>Boolean(window.PCIFoDesarrollo),{timeout:25000});
  await conformFourFoFormats(page);
  await page.locator('#pciDemoFoCards [data-pci-fo-format="proyecto"]').click();
  assert.equal(await page.locator('#pci-fo-development').isVisible(),true);
  assert.equal(await page.locator('#pciFoYear').inputValue(),'5');
  assert.equal(await page.locator('#pciFoStages .pci-fo-stage').count(),4);
  const geometry=await page.locator('#pci-fo-development').evaluate(el=>({
    height:Math.round(el.getBoundingClientRect().height),windowHeight:innerHeight,
    overflow:document.documentElement.scrollWidth>innerWidth+2
  }));
  assert.ok(geometry.height<=geometry.windowHeight+1);
  assert.equal(geometry.overflow,false);
  await page.locator('#pciFoClose').click();
  await page.locator('#pciDemoFoCards [data-pci-fo-format="laboratorios"]').click();
  assert.equal(await page.locator('#pciFoGroupCards [data-fo-group]').count(),4);
  assert.equal(await page.locator('#pciFoYear').inputValue(),'0');
  const mobileCards=await page.locator('#pciFoGroupCards [data-fo-group]').evaluateAll(items=>items.map(card=>({
    top:Math.round(card.getBoundingClientRect().top),
    width:Math.round(card.getBoundingClientRect().width)
  })));
  assert.ok(mobileCards[1].top>mobileCards[0].top,'En celular los 4 espacios se apilan');
  assert.equal(await page.locator('#pciFoSearch').isVisible(),true);
  await page.locator('#pciFoClose').click();
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
