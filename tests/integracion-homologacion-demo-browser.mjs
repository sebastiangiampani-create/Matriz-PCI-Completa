import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const port=4197,base='http://127.0.0.1:'+port;
const url=base+'/demo-homologacion-fg.html';
const artifacts='test-artifacts/homologacion-fg';
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:'ignore'});
let browser;
async function serve(){
 for(let i=0;i<80;i++){
  try{if((await fetch(url)).ok)return}catch{}
  await new Promise(r=>setTimeout(r,300));
 }
 throw Error('La muestra no inició.');
}
async function check(page,mode){
 const errors=[],network=[],missing=[];
 page.on('pageerror',err=>errors.push(err.message));
 page.on('request',request=>{
  if(/supabase\.(co|com)|functions\/v1|api\.github\.com/.test(request.url()))
   network.push(request.url());
 });
 page.on('response',response=>{if(response.status()>=400)missing.push(response.status()+' '+response.url())});
 // Incluso si el visor CDN bloquea todos los recursos secundarios,
 // el único HTML debe contener los estilos, el motor y ambos catálogos.
 await page.route('**/*',route=>{
   if(route.request().url()===url)return route.continue();
   return route.abort('blockedbyclient');
 });
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.locator('#workspace').waitFor({state:'visible',timeout:60000});
 assert.equal(await page.locator('#loading').isVisible(),false);
 const selfContained=await page.evaluate(()=>{
   const logo=document.querySelector('.top img')?.getBoundingClientRect();
   const card=document.querySelector('.card');
   return {
     noResources:document.querySelectorAll('script[src],link[rel="stylesheet"]').length===0,
     logoWidth:logo?.width||0,
     logoHeight:logo?.height||0,
     background:getComputedStyle(card).backgroundColor,
     font:getComputedStyle(document.body).fontFamily
   };
 });
 assert.equal(selfContained.noResources,true,'El HTML no debe depender de scripts u hojas externas');
 assert.ok(selfContained.logoWidth>80&&selfContained.logoWidth<260,
   'El logo debe conservar su tamaño institucional: '+JSON.stringify(selfContained));
 assert.ok(selfContained.logoHeight<=42,'El logo no debe llenar la pantalla');
 assert.match(selfContained.font,/Inter|system-ui/,'Los estilos deben estar aplicados');
 assert.equal(await page.locator('#areaSelect').inputValue(),'Ciencias Sociales');
 assert.equal(await page.locator('#yearSelect option').count(),5);
 assert.equal(await page.locator('#yearSelect').inputValue(),'3');
 assert.ok((await page.locator('#originalText').innerText()).length>12);
 const count=await page.locator('#candidateList .candidate input').count();
 assert.ok(count>=2,'La muestra debe elegir un contenido real que explique relación 1→varios');
 assert.equal(await page.locator('.metric').count(),0,'No deben aparecer cuatro cuadros de estadísticas');
 assert.equal(await page.locator('#matrixList').isVisible(),false,'No mostrar los 1.155 contenidos');
 assert.equal(await page.locator('#extraPanel').isVisible(),false,'No abrir la búsqueda avanzada sin pedirla');
 for(let i=0;i<Math.min(count,3);i++)
  await page.locator('#candidateList .candidate input').nth(i).check();
 const chosen=Math.min(count,3);
 assert.match(await page.locator('#selectedCount').innerText(),new RegExp('^'+chosen+' seleccionado'));
 await page.locator('#startReview').click();
 assert.equal(await page.locator('#reviewPanel').isVisible(),true);
 await page.locator('#confirmDemo').click();
 assert.match(await page.locator('#reviewMessage').innerText(),/justificación pedagógica breve/);
 await page.locator('#reason').fill('El agrupamiento histórico aborda de manera verificable los alcances de estas propuestas oficiales.');
 await page.locator('#confirmDemo').click();
 assert.match(await page.locator('#reviewMessage').innerText(),new RegExp('se vincularon '+chosen+' contenidos V2'));
 assert.equal(await page.locator('#historyDetails').isVisible(),true);
 await page.locator('#historyDetails summary').click();
 assert.equal(await page.locator('#historyList .history-entry').count(),1);
 await page.screenshot({path:artifacts+'/'+mode+'-homologacion-simple.png',fullPage:true});
 const last=await page.locator('#originalText').innerText();
 await page.locator('#yearSelect').selectOption('4');
 assert.equal(await page.locator('#historyDetails').isVisible(),false,'3.º no debe duplicarse en 4.º');
 await page.locator('#yearSelect').selectOption('3');
 assert.equal(await page.locator('#originalText').innerText(),last);
 assert.equal(await page.locator('#historyDetails').isVisible(),true);
 await page.locator('#changeContent').click();
 assert.equal(await page.locator('#changePanel').isVisible(),true);
 assert.ok(await page.locator('#matrixList .source-option').count()>0);
 await page.locator('#changeContent').click();
 assert.equal(await page.locator('#changePanel').isVisible(),false);
 assert.deepEqual(network,[],'Sin servicios institucionales');
 assert.deepEqual(missing,[],'Sin recursos faltantes');
 assert.deepEqual(errors,[],'Sin errores JavaScript');
 assert.equal(await page.evaluate(()=>localStorage.length),0,'Sin almacenamiento local');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Sin desbordamiento');
}
try{
 await mkdir(artifacts,{recursive:true});
 await serve();
 browser=await chromium.launch({headless:true});
 const desktop=await browser.newContext({viewport:{width:1440,height:920}});
 await check(await desktop.newPage(),'desktop');
 await desktop.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:2,hasTouch:true});
 await check(await mobile.newPage(),'mobile');
 await mobile.close();

 // Modo de entrega: el usuario descarga un solo HTML y lo abre con Chrome
 // o Edge, sin GitHub, CDN, servidor HTTP ni archivos auxiliares.
 const offline=await browser.newContext({viewport:{width:1366,height:900}});
 const filePage=await offline.newPage();
 const fileErrors=[];
 filePage.on('pageerror',e=>fileErrors.push(e.message));
 await filePage.route('http://**/*',r=>r.abort());
 await filePage.route('https://**/*',r=>r.abort());
 await filePage.goto('file://' + process.cwd() + '/demo-homologacion-fg.html',{waitUntil:'domcontentloaded'});
 await filePage.locator('#workspace').waitFor({state:'visible',timeout:45000});
 assert.ok(await filePage.locator('#candidateList .candidate').count()>0);
 assert.ok((await filePage.locator('#originalText').innerText()).length>12);
 assert.equal(await filePage.locator('.top img').evaluate(el=>el.complete&&el.naturalWidth>0),true);
 assert.deepEqual(fileErrors,[],'La versión descargada no debe fallar bajo file://');
 await filePage.screenshot({path:artifacts+'/archivo-local-sin-internet.png',fullPage:true});
 await offline.close();

 console.log('Muestra simple FG/V2: año, correspondencias 1 a N, revisión, datos reales y móvil OK.');
}finally{
 await browser?.close();
 server.kill('SIGTERM');
}
