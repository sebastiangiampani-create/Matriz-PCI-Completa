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
  // El V2 auténtico pide elegir un rol de prueba antes de editar la oferta.
  await page.waitForSelector('#v85AccessPanel [data-v85-role="admin"]',{timeout:30000});
  await page.locator('#v85AccessPanel [data-v85-role="admin"]').click();
  await page.locator('#v85EnterAdmin').click();
  await page.waitForSelector('#v85AccessPanel',{state:'detached'});
  const selected=await page.locator('#orientationList input[type="checkbox"]').count();
  assert.equal(selected,16,'La selección original debe ofrecer 16 orientaciones');
  await page.locator('#pciList [data-open]').first().click();
  await page.waitForSelector('#openOffer');
  await page.click('#openOffer');
  await page.waitForSelector('#offer.screen.active #matrix .drop',{timeout:50000});
  await page.waitForSelector('#offer.screen.active #bagContent .subject',{timeout:50000});
  const state=await page.evaluate(()=>({
    map:document.querySelectorAll('#matrix .drop').length,
    subjects:document.querySelectorAll('#bagContent .subject').length,
    realMap:!!document.querySelector('#matrix .grid.levels'),
    socialButtons:document.querySelectorAll('#compositionPalette [data-social-option]').length,
    formatButtons:document.querySelectorAll('#compositionPalette [data-format]').length,
    phase2:!!window.PCIPhase2V28,
    originalName:document.querySelector('#offerTitle')?.textContent
  }));
  console.log('Mapa auténtico V2 '+mode+' métricas: '+JSON.stringify(state));
  await page.screenshot({path:artifacts+'/'+mode+'-mapa-original.png',fullPage:true});
  assert.deepEqual(missing,[],'Recursos curriculares faltantes: '+missing.join(' | '));
  assert.ok(state.map>35,'El mapa C1–C10 debe contener ubicaciones originales');
  assert.ok(state.subjects>20,'La bolsa FG/FO debe mostrar materias reales');
  assert.equal(state.realMap,true,'Debe renderizar la matriz de V2, no una maqueta');
  assert.ok(state.socialButtons>=2,'Deben aparecer las opciones reales de Sociales N3');
  assert.ok(state.formatButtons>=2,'Deben aparecer los formatos FO originales');
  assert.ok(state.phase2,'Debe cargar el motor auténtico de Desarrollo Curricular');
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
