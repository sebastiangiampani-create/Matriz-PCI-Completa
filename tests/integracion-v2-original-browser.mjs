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
  // Geometría y navegación conservada: las tarjetas son compactas y siguen accesibles.
  const visual=await page.evaluate(()=>{
    const orient=document.querySelector('#orientationList .orientation');
    const grid=document.querySelector('#orientationList');
    const card=document.querySelector('#pciList .pci-card');
    const css=getComputedStyle(grid);
    return {
      font:getComputedStyle(document.body).fontFamily,
      brand:document.querySelector('header.top .brand img')?.getAttribute('src'),
      footer:document.querySelector('#institutionalFooter .footer-school')?.getAttribute('src'),
      cssLinked:!!document.querySelector('link[href^="estetica-matriz-compacta.css"]'),
      orientationHeight:orient?.getBoundingClientRect().height,
      pciCardHeight:card?.getBoundingClientRect().height,
      columns:css.gridTemplateColumns.split(' ').length,
      viewport:window.innerWidth,
      htmlOverflow:document.documentElement.scrollWidth>window.innerWidth+2
    };
  });
  assert.equal(visual.cssLinked,true,'El CSS debe cargarse desde la copia de Matriz');
  assert.match(visual.brand||'',/em-logo-header\.svg/);
  assert.match(visual.footer||'',/em-logo-footer\.svg/);
  assert.match(visual.font||'',/Archivo/);
  assert.ok(visual.orientationHeight<=73,'Orientaciones demasiado altas para la estética compacta: '+JSON.stringify(visual));
  assert.ok(visual.pciCardHeight<=140,'El resumen debe ser un mosaico compacto: '+JSON.stringify(visual));
  assert.ok(visual.columns>=2,'Las orientaciones deben conservar una grilla usable: '+JSON.stringify(visual));
  assert.equal(visual.htmlOverflow,false,'No debe haber desplazamiento horizontal en el inicio: '+JSON.stringify(visual));
  console.log('Estética Matriz compacta '+mode+': '+JSON.stringify(visual));
  // Toggle sin resetear el resto de orientaciones ni sus mapas.
  const check=page.locator('#orientationList [data-o="Ciencias Naturales"]');
  const before=await check.isChecked();
  await check.click();
  assert.equal(await page.locator('#orientationList [data-o="Ciencias Naturales"]').isChecked(),!before);
  await page.locator('#orientationList [data-o="Ciencias Naturales"]').click();
  assert.equal(await page.locator('#orientationList [data-o="Ciencias Naturales"]').isChecked(),before);
  await page.screenshot({path:artifacts+'/'+mode+'-inicio-matriz-compacto.png',fullPage:true});
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
