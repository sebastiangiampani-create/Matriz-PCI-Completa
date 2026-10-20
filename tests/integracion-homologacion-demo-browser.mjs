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
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.locator('#workspace').waitFor({state:'visible',timeout:60000});
 assert.equal(await page.locator('#loading').isVisible(),false);
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
 console.log('Muestra simple FG/V2: año, correspondencias 1 a N, revisión, datos reales y móvil OK.');
}finally{
 await browser?.close();
 server.kill('SIGTERM');
}
