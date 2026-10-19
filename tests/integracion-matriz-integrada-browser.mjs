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
  await page.locator('#pciNativeV2CoverageOverview').click();
  const coverHome=page.frameLocator('#pciNativeV2CoverageFrame');
  await coverHome.locator('#v98dResults .v98d-area').first().waitFor({timeout:60000});
  assert.equal(await page.locator('#pciNativeV2CoverageFrame').evaluate(frame=>
    frame.contentWindow.state.active),'Economía y Administración',
    'El tablero original V2 debe usar la orientación activa, también desde portada');
  await page.locator('#pciNativeV2CoverageClose').click();
  await page.locator('#areaGrid button[data-area="Artes"]').click();
  assert.equal(await page.locator('#board.screen.active').count(),1);
  assert.match(await page.locator('#boardTitle').innerText(),/Artes/);
  assert.equal(await page.locator('#groups .group-card').count(),6);
  // Mismo motor V91 + panel V93 de la referencia: NO un tablero paralelo.
  assert.equal(await page.locator('#pciFgCoverageDashboard').isVisible(),false);
  await page.locator('#pciNativeV2CoverageFG').click();
  const native=page.frameLocator('#pciNativeV2CoverageFrame');
  await native.locator('#v98dResults .v98d-area').first().waitFor({timeout:60000});
  assert.match(await native.locator('.v98d-head').innerText(),/Panel de cobertura curricular/);
  const originalCore=await page.locator('#pciNativeV2CoverageFrame').evaluate(frame=>{
    const w=frame.contentWindow;
    const g=w.PCIPhase2V28.groups();
    const fg=g.find(x=>x.area==='Artes');
    const result=w.PCICoverageV91.formatCoverage(fg);
    return {fgOfficial:w.PCIPhase2V28.getFGCatalog().length,
      originalEngine:typeof w.PCICoverageV91.planCoverage,
      originalPanel:typeof w.PCICoverageDashboardV93.printPanel,
      area:result.area,basis:result.basis};
  });
  assert.equal(originalCore.fgOfficial,1126);
  assert.equal(originalCore.originalEngine,'function');
  assert.equal(originalCore.originalPanel,'function');
  assert.equal(originalCore.area,'Artes');
  assert.equal(originalCore.basis,'level');
  await page.locator('#pciNativeV2CoverageClose').click();
  assert.equal(await page.locator('#pciNativeV2Coverage').isVisible(),false);
  await page.locator('#contentList [data-content-id]').first().dragTo(page.locator('#groups .group-card .assigned-list').first());
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
  assert.equal(await page.locator('#pciFoCoverageDashboard').isVisible(),false,
    'El tablero aproximado no debe mostrarse junto al original');
  await page.locator('#pciNativeV2CoverageFO').click();
  await native.locator('#v98dResults .v98d-area').first().waitFor({timeout:60000});
  const foEngine=await page.locator('#pciNativeV2CoverageFrame').evaluate(frame=>{
    const w=frame.contentWindow,all=w.PCIPhase2V28.groups();
    const fo=all.filter(g=>g.area==='Formación Orientada');
    const first=fo[0];
    const annual=w.PCICoverageV91.formatCoverage(first);
    const trajectory=w.PCICoverageV91.trajectoryCoverage('Formación Orientada',all);
    const plan=w.PCICoverageV91.planCoverage(first,first.data.plansBimestrales[0]?.contentIds||[]);
    return {foCount:fo.length,foRows:w.PCIPhase2V28.getAreaPool('Formación Orientada').length,
      hasYear:w.PCICoverageV91.foHasYear(),basis:annual.basis,
      annualTotal:annual.total,annualPercent:annual.percent,
      trajectoryTotal:trajectory.total,component:annual.component,
      planLabel:plan.basisLabel};
  });
  assert.ok(foEngine.foCount>=1);
  assert.ok(foEngine.foRows>0&&foEngine.foRows<860);
  assert.equal(foEngine.hasYear,false,'FO sin año oficial no tiene % de nivel');
  assert.equal(foEngine.basis,'trajectory');
  assert.equal(foEngine.annualTotal,0);
  assert.equal(foEngine.annualPercent,null);
  assert.equal(foEngine.component,'FO');
  assert.equal(foEngine.trajectoryTotal,foEngine.foRows);
  assert.equal(foEngine.planLabel,'Trayectoria');
  assert.match(await native.locator('#v98dResults').textContent(),
    /La base orientada actual no informa todavía un universo anual por nivel/);
  assert.match(await native.locator('#v98dResults').textContent(),/Planes del agrupamiento/);
  await page.locator('#pciNativeV2CoverageClose').click();
  assert.equal(await page.locator('#pciFoDetails').evaluate(el=>el.open),false,
    'El desarrollo de planes permanece plegado hasta que se elija un espacio');
  await page.locator('#pciFoGroupCards [data-edit-group]').first().click();
  assert.equal(await page.locator('#pciFoFields').isVisible(),true);
  assert.equal(await page.locator('#pciFoPlanCoverage').isVisible(),false,
    'La cobertura del plan se consulta en el V93 original, no en la copia aproximada');
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
  // La articulación local no reemplaza contenidos, secuencias ni denominadores.
  await page.locator('#pciArticulationEditor > summary').click();
  await page.locator('#pciArtFgVersion').selectOption('fg-matriz-historica/1');
  const fgOrigin=await page.locator('#pciArtFgContent option').first().getAttribute('value');
  assert.ok(fgOrigin&&fgOrigin.startsWith('['),
    'Los vínculos FG/FO exigen un agrupamiento y contenido concretos del proceso importado');
  assert.equal(await page.locator('#pciArtFoContent option').count(),1);
  const fgBeforeLink=await page.evaluate(()=>localStorage.getItem('pciAppV2'));
  const foBeforeLink=await page.evaluate(()=>localStorage.getItem('pci-fo-development-drafts-preview-20261014'));
  await page.locator('#pciArtSave').click();
  assert.match(await page.locator('#pciArtStatus').textContent(),/Articulación guardada/);
  const linked=await page.evaluate(()=>{
    const key='pci-articulacion-borradores-versionados/1:'+encodeURIComponent('Economía y Administración');
    return JSON.parse(localStorage.getItem(key));
  });
  assert.equal(linked.links.length,1);
  assert.equal(linked.links[0].fg.baseVersion,'fg-matriz-historica/1');
  assert.equal(linked.links[0].fo.contentId,chosenFoContent);
  assert.equal(await page.evaluate(()=>localStorage.getItem('pciAppV2')),fgBeforeLink);
  assert.equal(await page.evaluate(()=>localStorage.getItem('pci-fo-development-drafts-preview-20261014')),foBeforeLink);
  await page.locator('#pciArtSave').click();
  assert.equal(await page.evaluate(()=>{
    const key='pci-articulacion-borradores-versionados/1:'+encodeURIComponent('Economía y Administración');
    return JSON.parse(localStorage.getItem(key)).links.length;
  }),1,'No se deben duplicar vínculos curriculares');
  // El V91 ORIGINAL debe leer el mismo contenido y plan después del arrastre.
  await page.locator('#pciNativeV2CoverageFO').click();
  await native.locator('#v98dResults .v98d-area').first().waitFor({timeout:60000});
  const v2AfterEdit=await page.locator('#pciNativeV2CoverageFrame').evaluate(frame=>{
    const w=frame.contentWindow,core=w.PCICoverageV91,all=w.PCIPhase2V28.groups();
    const project=all.find(g=>g.area==='Formación Orientada'&&g.id==='proyecto-n5');
    const trajectory=core.trajectoryCoverage('Formación Orientada',all);
    const group=core.formatCoverage(project);
    const plan=core.planCoverage(project,project.data.plansBimestrales[2].contentIds);
    return {
      projectContentCount:project.data.contents.length,
      trajectoryUsed:trajectory.used,
      groupUsed:group.trajectoryUsed,groupAnnualTotal:group.total,
      planUsed:plan.levelUsed,planBasis:plan.basisLabel,
      componentUsed:plan.byComponent.filter(x=>x.planUsed>0).length
    };
  });
  assert.equal(v2AfterEdit.projectContentCount,1);
  assert.equal(v2AfterEdit.trajectoryUsed,1,
    'V2 deduplica el mismo contenido en la trayectoria orientada');
  assert.equal(v2AfterEdit.groupUsed,1);
  assert.equal(v2AfterEdit.groupAnnualTotal,0);
  assert.equal(v2AfterEdit.planUsed,1);
  assert.equal(v2AfterEdit.planBasis,'Trayectoria');
  assert.equal(v2AfterEdit.componentUsed,1);
  await native.locator('#v98dArea').selectOption('Formación Orientada');
  await native.locator('#v98dLevel').selectOption('5');
  await native.locator('#v99dPrint').evaluate(el=>{
    const w=el.ownerDocument.defaultView;
    w.__printedNativeV2='';
    w.open=()=>({document:{
      open(){},write(html){w.__printedNativeV2+=html;},close(){}
    }});
    el.click();
  });
  const printedV2=await page.locator('#pciNativeV2CoverageFrame').evaluate(frame=>
    frame.contentWindow.__printedNativeV2);
  assert.match(printedV2,/Panel de cobertura curricular/);
  assert.match(printedV2,/size:A4 landscape/);
  assert.match(printedV2,/Planes del agrupamiento/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('pciAppV2')),originalFoBefore);
  await page.locator('#pciNativeV2CoverageClose').click();
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
  assert.equal(await page.locator('#pciArticulationEditor').evaluate(el=>el.open),false,
    'Al cambiar de proyecto a laboratorios debe plegarse la articulación, sin borrar vínculos.');
  assert.equal(await page.locator('.pci-fo-bag-eyebrow').textContent(),'Bolsa curricular',
    'La bolsa FO debe tener la misma jerarquía visual de FG.');
  // Paridad estética real FG/FO: misma marca, ancho, columnas y tarjetas legibles.
  const foLayout=await page.locator('#pci-fo-development').evaluate(root=>{
    const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
    const cards=[...root.querySelectorAll('#pciFoGroupCards [data-fo-group]')].map(rect);
    const brand=root.querySelector('.pci-fo-brand');
    return {
      brandLoaded:brand?.complete&&brand?.naturalWidth>0,
      width:rect(root.querySelector('.pci-fo-dev-content')).width,
      bag:rect(root.querySelector('.pci-fo-dev-bag')),
      editor:rect(root.querySelector('.pci-fo-dev-editor')),
      cards,
      overflow:root.scrollWidth>root.clientWidth+2,
      columnCount:getComputedStyle(root.querySelector('#pciFoGroupCards')).gridTemplateColumns.split(' ').length
    };
  });
  assert.equal(foLayout.brandLoaded,true,'FO debe conservar el mismo logo de Escuela de Maestros que FG');
  assert.ok(foLayout.width<=1140,'FO debe compartir el ancho de lectura de la Matriz FG');
  assert.ok(foLayout.bag.x<foLayout.editor.x,'La bolsa FO debe permanecer a la izquierda del editor');
  assert.equal(foLayout.columnCount,2,'Los cuatro laboratorios deben verse en dos columnas, no tres comprimidas');
  assert.ok(foLayout.cards[0].width>=310,'Las tarjetas FO requieren ancho suficiente para los formularios');
  assert.ok(Math.abs(foLayout.cards[0].y-foLayout.cards[1].y)<=2,
    'Dos laboratorios deben compartir la primera fila');
  assert.ok(foLayout.cards[2].y>foLayout.cards[0].y+30,
    'Los otros dos laboratorios deben estar en la segunda fila');
  assert.equal(foLayout.overflow,false,'La FO no puede desbordar la pantalla horizontalmente');

  await page.waitForFunction(()=>{
    const txt=document.querySelector('#pciFoContentCount')?.textContent||'';
    return /Historia orientada: 6/.test(txt)&&/Tecnologías de la Información orientada: 8/.test(txt);
  },{timeout:45000});
  assert.match(await page.locator('#pciFoContentCount').textContent(),/Historia orientada: 6/);
  assert.match(await page.locator('#pciFoContentCount').textContent(),/Tecnologías de la Información orientada: 8/);
  await page.locator('#pci-fo-development > [data-pci-inline="area"]').waitFor({timeout:45000});
  const alignedCoverage=await page.locator('#pci-fo-development').evaluate(root=>{
    const coverage=root.querySelector(':scope > [data-pci-inline="area"]').getBoundingClientRect();
    const content=root.querySelector('.pci-fo-dev-content').getBoundingClientRect();
    return {coverageX:coverage.x,contentX:content.x,coverageWidth:coverage.width,contentWidth:content.width};
  });
  assert.ok(Math.abs(alignedCoverage.coverageX-alignedCoverage.contentX)<=2 &&
    Math.abs(alignedCoverage.coverageWidth-alignedCoverage.contentWidth)<=2,
    'La cobertura original de FO debe alinearse con la bolsa y las tarjetas de FG.');
  await page.screenshot({path:artifacts+'desktop-fo-paridad-fg.png',fullPage:false});
  const techBlock=await page.locator('#pciFoBlockFilter option').evaluateAll(ops=>
    ops.map(op=>op.value).find(x=>/tecnolog.*informaci/i.test(x))||'');
  const historyBlock=await page.locator('#pciFoBlockFilter option').evaluateAll(ops=>
    ops.map(op=>op.value).find(x=>/historia.*orientad/i.test(x))||'');
  assert.ok(techBlock&&historyBlock,'V2 debe contener Historia y Tecnologías orientadas por separado');
  await page.locator('#pciFoBlockFilter').selectOption(techBlock);
  assert.equal(await page.locator('#pciFoContentList [data-fo-component="materia"]').count(),8,
    'Tecnologías de la Información orientada debe figurar como materia');
  assert.match(await page.locator('#pciFoContentList .pci-fo-component-type').first().innerText(),/Materia/);
  await page.locator('#pciFoBlockFilter').selectOption(historyBlock);
  assert.equal(await page.locator('#pciFoContentList [data-fo-component="materia"]').count(),6);
  await page.locator('#pciFoBlockFilter').selectOption('');
  assert.ok(await page.locator('#pciFoContentList [data-fo-component="eje"]').count()>0,
    'Todos los demás bloques y ejes deben aparecer clasificados como ejes');
  const v2Css=await page.locator('#pciNativeV2CoverageFrame').evaluate(frame=>{
    const doc=frame.contentDocument;
    return {css:!!doc.querySelector('link[href*="integracion-cobertura-v2-base-original.css"]'),
      font:getComputedStyle(doc.body).fontFamily};
  });
  assert.equal(v2Css.css,true);
  assert.match(v2Css.font,/Archivo/i,'El panel debe usar la misma tipografía base de V2');
  assert.deepEqual(await page.locator('#pciFoGroupCards [data-fo-group] .pci-fo-year-pill').allTextContents(),
    ['3.º año','4.º año','5.º año','5.º año']);
  assert.equal(await page.locator('#pciFoGroupCards [data-fo-group] .pci-fo-card-fields').count(),4);
  const parity=await page.locator('#pciFoGroupCards .group-card').first().evaluate(card=>{
    const style=getComputedStyle(card);
    const selected=card.classList.contains('selected');
    return {padding:style.padding,borderRadius:style.borderRadius,
      background:style.backgroundColor,borderWidth:style.borderTopWidth,
      selected,title:card.querySelector('.group-title-row')!==null,
      fields:card.querySelector('.form-grid')!==null,
      tags:card.querySelector('.group-meta')!==null,
      assigned:card.querySelector('.assigned-list')!==null};
  });
  assert.equal(parity.padding,'18px');
  assert.equal(parity.borderRadius,'20px');
  assert.equal(parity.borderWidth,'2px');
  assert.equal(parity.title&&parity.fields&&parity.tags&&parity.assigned,true);
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
  await page.locator('#pciFoGroupCards [data-edit-group]').first().click();
  assert.equal(await page.locator('#pciFoDetails').evaluate(el=>el.open),true);
  assert.match(await page.locator('#pciFoReviewWarning').textContent(),/Revisar planes/);
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
  assert.equal(await page.locator('#pciNativeV2CoverageOverview').isVisible(),true);
  const coverageButton=await page.locator('#pciNativeV2CoverageOverview').evaluate(el=>{
    const box=el.getBoundingClientRect();
    return {width:box.width,x:box.x,viewport:innerWidth};
  });
  assert.ok(coverageButton.x+coverageButton.width<=coverageButton.viewport+1);
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
  await page.locator('#pciNativeV2CoverageFO').click();
  const frame=page.frameLocator('#pciNativeV2CoverageFrame');
  await frame.locator('#v98dResults .v98d-area').first().waitFor({timeout:60000});
  assert.equal(await frame.locator('#v98dArea').isVisible(),true);
  assert.equal(await frame.locator('#v98dLevel').isVisible(),true);
  assert.equal(await frame.locator('#v98dStatus').isVisible(),true);
  const nativeMobile=await page.locator('#pciNativeV2CoverageFrame').evaluate(element=>{
    const w=element.contentWindow,doc=w.document;
    const box=doc.querySelector('.v98d-shell').getBoundingClientRect();
    return {width:Math.round(box.width),viewport:w.innerWidth,
      horizontalOverflow:doc.documentElement.scrollWidth>w.innerWidth+2};
  });
  assert.ok(nativeMobile.width<=nativeMobile.viewport,
    'La cobertura original debe caber en pantalla móvil');
  assert.equal(nativeMobile.horizontalOverflow,false,
    'La cobertura V93 original no debe generar desborde horizontal');
  await page.locator('#pciNativeV2CoverageClose').click();
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
  assert.equal(await page.locator('#pci-fo-development .pci-fo-brand').evaluate(el=>el.complete&&el.naturalWidth>0),true);
  await page.screenshot({path:artifacts+'mobile-fo-paridad-fg.png',fullPage:false});
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
