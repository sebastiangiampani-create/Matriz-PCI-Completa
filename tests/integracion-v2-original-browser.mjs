import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const port=4183,url='http://127.0.0.1:'+port+'/preview-v2-real/app.html';
const artifacts='test-artifacts/integracion-v2-real';
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:'inherit'});
let browser;
async function serve(){
  for(let i=0;i<80;i++){
    try{if((await fetch(url)).ok)return;}catch{}
    await new Promise(r=>setTimeout(r,300));
  }
  throw new Error('No levantó servidor de prueba.');
}
async function inspect(page,mode){
  const bad=[],missing=[];
  page.on('pageerror',e=>bad.push(e.message));
  page.on('response',response=>{
    if(response.status()>=400&&response.url().includes('/preview-v2-real/'))
      missing.push(response.status()+' '+response.url());
  });
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#orientationList input[type="checkbox"]',{timeout:60000});
  await page.waitForSelector('#pciList [data-open]',{timeout:60000});
  // La integración reutilizará la sesión de Matriz. En esta copia NO hay
  // pantalla de acceso, alta de usuarios ni perfiles de V2.
  assert.equal(await page.locator('#v85AccessPanel').count(),0);
  assert.equal(await page.locator('[data-v85-role]').count(),0);
  // Calificaciones y sus planillas NO integran esta plataforma.
  assert.equal(await page.locator('#v114CriteriaEntry').count(),0);
  assert.equal(await page.locator('#v114PlanCriteriaScreen').count(),0);
  const selected=await page.locator('#orientationList input[type="checkbox"]').count();
  assert.equal(selected,16,'La selección original debe ofrecer 16 orientaciones');
  // La grilla extensa de V2 permanece guardada detrás de Configuración.
  assert.equal(await page.locator('#matrizOrientationManager').evaluate(e=>e.open),false);
  assert.equal(await page.locator('#orientationList').isVisible(),false);
  assert.equal(await page.locator('#pciList .pci-card').count(),1);
  assert.equal(await page.locator('#schoolName').isVisible(),false);

  const view=await page.evaluate(()=>{
    const summary=document.querySelector('#matrizOrientationManager > summary');
    const panel=document.querySelector('#home .matriz-entry-panel');
    const card=document.querySelector('#pciList .pci-card');
    const css=getComputedStyle(document.body);
    return {
      brand:document.querySelector('header.top .brand img')?.getAttribute('src'),
      footer:document.querySelector('#institutionalFooter .footer-school')?.getAttribute('src'),
      font:css.fontFamily,
      heroTitle:document.querySelector('#matrizSchoolTitle')?.textContent,
      summaryText:summary?.textContent.trim(),
      singleCardHeight:card?.getBoundingClientRect().height,
      entryPanelHeight:panel?.getBoundingClientRect().height,
      hiddenOrientations:!document.querySelector('#matrizOrientationManager')?.open,
      orientationOptions:document.querySelector('#matrizOrientationSelect')?.options.length,
      horizontalOverflow:document.documentElement.scrollWidth>window.innerWidth+2
    };
  });
  assert.match(view.brand||'',/em-logo-header\.svg/);
  assert.match(view.footer||'',/em-logo-footer\.svg/);
  assert.match(view.font||'',/Archivo/);
  assert.equal(view.heroTitle,'Escuela Muestra');
  assert.equal(view.hiddenOrientations,true);
  assert.equal(view.orientationOptions,1,'Por defecto solo aparece la orientación activa');
  assert.ok(view.entryPanelHeight<225,'El inicio debe ser compacto: '+JSON.stringify(view));
  assert.ok(view.singleCardHeight<145,'El acceso al PCI debe ser compacto: '+JSON.stringify(view));
  assert.equal(view.horizontalOverflow,false,'Inicio con desplazamiento horizontal: '+JSON.stringify(view));
  console.log('Nuevo inicio Matriz '+mode+': '+JSON.stringify(view));

  // La configuración secundaria sigue permitiendo altas y bajas sin borrar PCI.
  await page.locator('#matrizOrientationManager > summary').click();
  assert.equal(await page.locator('#orientationList').isVisible(),true);
  const newOrientation=page.locator('#orientationList [data-o="Ciencias Naturales"]');
  await newOrientation.check();
  assert.equal(await page.locator('#matrizOrientationSelect option').count(),2);
  await page.locator('#matrizOrientationSelect').selectOption('Economía y Administración');
  assert.equal(await page.locator('#pciList .pci-card h3').textContent(),'Economía y Administración');
  await newOrientation.uncheck();
  assert.equal(await page.locator('#matrizOrientationSelect option').count(),1);
  assert.equal(await page.locator('#matrizOrientationManager').evaluate(e=>e.open),true);
  await page.locator('#matrizOrientationManager > summary').click();
  assert.equal(await page.locator('#orientationList').isVisible(),false);
  await page.screenshot({path:artifacts+'/'+mode+'-inicio-matriz-una-orientacion.png',fullPage:true});
  await page.locator('#pciList [data-open]').first().click();
  await page.waitForSelector('#openOffer');
  await page.click('#openOffer');
  await page.waitForSelector('#offer.screen.active #matrix .drop',{timeout:50000});
  await page.waitForSelector('#offer.screen.active #bagContent .subject',{timeout:50000});
  // La bolsa V2 real filtra por nivel: 1º muestra solo FG; 3º muestra FG y FO.
  await page.locator('#bagContent [data-bag-year="3"]').click();
  await page.waitForSelector('#bagContent [data-alt="A"]',{timeout:15000});
  const state=await page.evaluate(()=>({
    map:document.querySelectorAll('#matrix .drop').length,
    subjects:document.querySelectorAll('#bagContent .subject').length,
    realMap:!!document.querySelector('#matrix .grid.levels'),
    socialButtons:document.querySelectorAll('#compositionPalette [data-social-option]').length,
    formatButtons:document.querySelectorAll('#compositionPalette [data-format]').length,
    yearButtons:document.querySelectorAll('#bagContent [data-bag-year]').length,
    foOptions:document.querySelectorAll('#bagContent [data-alt]').length,
    foSlots:document.querySelectorAll('#matrix .drop[data-slot^="fo"]').length,
    phase2:!!window.PCIPhase2V28,
    originalName:document.querySelector('#offerTitle')?.textContent
  }));
  console.log('Mapa auténtico V2 '+mode+' métricas: '+JSON.stringify(state));
  await page.screenshot({path:artifacts+'/'+mode+'-mapa-original.png',fullPage:true});
  assert.deepEqual(missing,[],'Recursos curriculares faltantes: '+missing.join(' | '));
  assert.ok(state.map>35,'El mapa C1–C10 debe contener ubicaciones originales');
  assert.ok(state.subjects>=7,'La bolsa de 3.º debe mostrar materias reales de FG y FO');
  assert.equal(state.yearButtons,5,'V2 debe permitir elegir los cinco niveles de la bolsa');
  assert.equal(state.foOptions,2,'V2 debe mostrar las alternativas A y B');
  assert.equal(state.realMap,true,'Debe renderizar la matriz de V2, no una maqueta');
  assert.ok(state.socialButtons>=2,'Deben aparecer las opciones reales de Sociales N3');
  assert.ok(state.foSlots>0,'Deben existir las ubicaciones originales de FO');
  assert.ok(state.phase2,'Debe cargar el motor auténtico de Desarrollo Curricular');
  assert.equal(await page.getByText('Calificaciones',{exact:true}).count(),0,
    'No debe existir ninguna entrada visible a Calificaciones');
  // Probar una selección y ubicación REAL con la lógica V2, sin datos de escuelas.
  const math=page.locator('#bagContent .subject').filter({hasText:'Matemática · 3.º'}).first();
  assert.equal(await math.count(),1,'Debe estar Matemática de 3.º en la bolsa original.');
  await math.click();
  await page.locator('#matrix .drop[data-slot="matematica-n3"]').click();
  await page.waitForSelector('#matrix .drop[data-slot="matematica-n3"] .placed',{timeout:15000});
  assert.match(await page.locator('#matrix .drop[data-slot="matematica-n3"] .placed').innerText(),/Matemática/);
  const local=await page.evaluate(()=>{
    const value=localStorage.getItem('pci-matriz-fg-v2-original-preview-20261009');
    return value?JSON.parse(value):null;
  });
  assert.ok(local?.maps?.['Economía y Administración']?.placements?.['matematica-n3']?.length,
    'La asignación V2 debe guardarse solo en el almacenamiento aislado de prueba.');
  console.log('Selección de Matemática 3.º comprobada en '+mode);
  assert.deepEqual(bad,[], 'Errores JavaScript del mapa original: '+bad.join(' | '));
  console.log('V2 original real '+mode+': '+JSON.stringify(state));
}
try{
  await mkdir(artifacts,{recursive:true});
  await serve();
  browser=await chromium.launch({headless:true});
  const desktop=await browser.newContext({viewport:{width:1440,height:1000}});
  await inspect(await desktop.newPage(),'escritorio');
  await desktop.close();
  const mobile=await browser.newContext({
    viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true
  });
  await inspect(await mobile.newPage(),'movil');
  await mobile.close();
  console.log('Prueba de mapa auténtico V2 aprobada en web y móvil.');
}finally{
  await browser?.close();
  server.kill('SIGTERM');
}
