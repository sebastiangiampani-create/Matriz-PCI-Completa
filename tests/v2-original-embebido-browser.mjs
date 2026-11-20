import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,relative,sep,extname} from 'node:path';
import {chromium} from 'playwright';

const root=process.cwd();
const contentTypes={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript',
  '.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    const full=resolve(root,'.'+decodeURIComponent(url.pathname));
    const relativePath=relative(root,full);
    if(relativePath==='..'||relativePath.startsWith('..'+sep))throw Error('Ruta incorrecta');
    const body=await readFile(full);
    res.writeHead(200,{'Content-Type':contentTypes[extname(full)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(body);
  }catch(e){res.writeHead(404);res.end(String(e.message||e));}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
 browser=await chromium.launch(process.env.CHROME_BIN?
  {headless:true,executablePath:process.env.CHROME_BIN}:{headless:true});
 const page=await browser.newPage({viewport:{width:1680,height:1080}});
 const errors=[],outside=[];
 page.on('pageerror',err=>errors.push(err.message));
 page.on('request',req=>{
  if(req.url().includes('supabase.co'))outside.push(req.url());
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/revision-v2-original.html',
   {waitUntil:'domcontentloaded'});
 const frame=page.frameLocator('#originalV2');
 try {
   await frame.locator('#offer.active').waitFor({timeout:22000});
 }catch(error){
   for(const f of page.frames()){
     const txt=await f.locator('body').textContent().catch(()=>'(sin cuerpo)');
     console.log('V2 FRAME DEBUG',JSON.stringify({url:f.url(),body:txt?.slice(0,2000)}));
   }
   console.log('V2 ERRORS',JSON.stringify(errors));
   await page.screenshot({path:'test-artifacts/v2-original/error-carga.png',fullPage:true}).catch(()=>{});
   throw error;
 }
 await frame.locator('#matrix .grid.levels').waitFor({timeout:25000});
 assert.equal(await frame.locator('#matrix .grid.levels .level').count(),5,
   'El constructor original Media mantiene cinco niveles V2');
 assert.equal(await frame.locator('#matrix .term').count(),11,
   'El constructor original mantiene el encabezado Espacio + C1-C10');
 assert.ok(await frame.locator('#bagContent .subject').count()>0,
   'Debe existir la bolsa real de materias V2');
 assert.ok(await frame.locator('#matrix [data-slot]').count()>25,
   'Deben existir casilleros reales de arrastre V2');
 assert.match(await page.locator('#status').textContent(),/V2 original cargado|Borrador V2 guardado/);
 await page.screenshot({path:'test-artifacts/v2-original/01-constructor-v2-mismo-codigo.png',fullPage:true});
 const target=frame.locator('#matrix .drop[data-slot="matematica-n1"]');
 const source=frame.locator('#bagContent [data-sub="fg-1-matematica"]');
 const oldAssignment=target.locator('[data-rm="fg-1-matematica"]');
 if(await oldAssignment.count())await oldAssignment.first().click();
 await source.dragTo(target);
 await target.locator('[data-map-id="fg-1-matematica"]').waitFor({timeout:12000});
 const placed=await target.locator('[data-map-id="fg-1-matematica"]').textContent();
 assert.match(placed,/Matemática/,'El drag-and-drop original sigue funcionando');
 await page.locator('[data-pci="demo-turismo-tarde"]').click();
 await frame.locator('#offer.active').waitFor({timeout:60000});
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('cargado'),null,{timeout:15000});
 const otherMap=frame.locator('#matrix .drop[data-slot="matematica-n1"]');
 if(await otherMap.locator('[data-rm="fg-1-matematica"]').count()){
   await otherMap.locator('[data-rm="fg-1-matematica"]').first().click();
 }
 assert.equal(await otherMap.locator('[data-map-id="fg-1-matematica"]').count(),0,
   'Al retirar Matemática de Turismo no se altera Comunicación');
 await page.locator('[data-pci="demo-comunicacion-manana"]').click();
 await frame.locator('#offer.active').waitFor({timeout:60000});
 await frame.locator('#matrix .drop[data-slot="matematica-n1"] [data-map-id="fg-1-matematica"]').waitFor({timeout:12000});
 assert.equal(outside.length,0,'Esta revisión no puede solicitar datos a Supabase');
 assert.deepEqual(errors,[],'El V2 copiado debe funcionar sin errores JS');
 await page.screenshot({path:'test-artifacts/v2-original/02-borrador-recuperado.png',fullPage:true});
 const previewUrl='https://raw.githack.com/sebastiangiampani-create/Matriz-PCI-Completa/feature/v2-original-reutilizado-20261120/revision-v2-original.html';
 const remote=await fetch(previewUrl,{signal:AbortSignal.timeout(25000)});
 assert.equal(remote.status,200,'La URL pública debe servir el constructor V2 original');
 assert.match(await remote.text(),/revision-v2-embed\.html/);
 console.log('V2 ORIGINAL OK: cinco niveles, 10 cuatrimestres, arrastre, PCI aislados y URL pública verificada.');
}finally{await browser?.close();server.close();}
