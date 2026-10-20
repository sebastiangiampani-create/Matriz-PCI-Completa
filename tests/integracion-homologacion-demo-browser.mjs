import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port=4197;
const url='http://127.0.0.1:'+port+'/demo-homologacion-fg.html';
const artifacts='test-artifacts/homologacion-fg';
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:'ignore'});
let browser;

async function serve(){
  for(let i=0;i<80;i++){
    try{if((await fetch(url)).ok)return;}catch{}
    await new Promise(r=>setTimeout(r,300));
  }
  throw new Error('No se pudo iniciar la muestra de homologación.');
}
async function inspect(page,mode){
  const errors=[],network=[],httpErrors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('request',r=>{if(/supabase\.(co|com)|functions\/v1|api\.github\.com/.test(r.url()))network.push(r.url());});
  page.on('response',r=>{if(r.status()>=400)httpErrors.push(r.status()+' '+r.url());});
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#workspace').waitFor({state:'visible',timeout:60000});
  assert.equal(await page.locator('#loading').isVisible(),false);
  assert.equal(await page.locator('#matrixTotal').textContent(),'1.155');
  assert.equal(await page.locator('#v2Total').textContent(),'1.126');
  assert.equal(await page.locator('#yearSelect option').count(),5);
  assert.ok(await page.locator('#areaSelect option').count()>=6);

  const firstArea=await page.locator('#areaSelect').inputValue();
  assert.equal(firstArea,'Ciencias Sociales');
  assert.match(await page.locator('#sourceCount').innerText(),/sin año de origen/);
  let count=await page.locator('#v2List .candidate').count();
  if(count===0){
    const items=await page.locator('#matrixList .source-option').count();
    for(let i=1;i<Math.min(22,items);i++){
      await page.locator('#matrixList .source-option').nth(i).click();
      count=await page.locator('#v2List .candidate').count();
      if(count)break;
    }
  }
  assert.ok(count>0,'Debe existir alguna materia V2 del mismo año para el contenido elegido.');
  const checked=Math.min(3,count);
  for(let i=0;i<checked;i++)await page.locator('#v2List .candidate input').nth(i).check();
  assert.match(await page.locator('#selectedCount').innerText(),new RegExp('^'+checked+' seleccionados'));
  await page.locator('#reason').fill('Se verificó el trabajo pedagógico de los ejes incluidos en la propuesta original.');
  await page.locator('#confirmDemo').click();
  assert.match(await page.locator('#reviewMessage').innerText(),/Aprobación simulada/);
  assert.ok(Number((await page.locator('#approvedCount').textContent()).replace(/\./g,''))>=1);
  assert.equal(await page.locator('#historyList .history-line').count(),1);
  assert.equal(await page.locator('#downloadDemo').isEnabled(),true);
  const [file]=await Promise.all([
    page.waitForEvent('download'),page.locator('#downloadDemo').click()
  ]);
  assert.equal(file.suggestedFilename(),'muestra-homologacion-fg.json');
  assert.equal(await page.evaluate(()=>localStorage.length),0,'La muestra no persiste datos locales ni históricos');
  await page.screenshot({path:artifacts+'/'+mode+'-homologacion-fg.png',fullPage:true});

  await page.locator('#yearSelect').selectOption('4');
  assert.equal(await page.locator('#yearSelect').inputValue(),'4');
  assert.equal(await page.locator('#historyList .history-line').count(),0,
    'Las equivalencias de 3.º no pueden presentarse como de 4.º.');
  await page.locator('#yearSelect').selectOption('3');
  assert.equal(await page.locator('#historyList .history-line').count(),1,
    'La revisión de 3.º permanece en memoria mientras la muestra está abierta.');
  await page.locator('#resetDemo').click();
  assert.equal(await page.locator('#historyList .history-line').count(),0);
  assert.equal(await page.locator('#downloadDemo').isEnabled(),false);
  assert.deepEqual(network,[],'No se deben contactar servicios de producción');
  assert.deepEqual(httpErrors,[],'Todos los recursos estáticos deben cargar');
  assert.deepEqual(errors,[],'No debe haber errores JavaScript');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
  assert.equal(overflow,false,'La muestra no debe desbordar horizontalmente');
}
try{
  await mkdir(artifacts,{recursive:true});
  await serve();
  browser=await chromium.launch({headless:true});
  const desktop=await browser.newContext({viewport:{width:1440,height:920},acceptDownloads:true});
  await inspect(await desktop.newPage(),'desktop');
  await desktop.close();
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:2,hasTouch:true,acceptDownloads:true});
  await inspect(await mobile.newPage(),'mobile');
  await mobile.close();
  console.log('Muestra de homologación FG/V2: catálogos reales, vínculos 1 a varios, aislamiento y móvil OK.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
