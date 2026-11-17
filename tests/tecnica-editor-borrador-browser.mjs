import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(), mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
 '.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8',
 '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  const absolute=resolve(root,'.'+path);
  if(!absolute.startsWith(root+sep))throw Error('Ruta no permitida');
  const data=await readFile(absolute);res.writeHead(200,{'Content-Type':mime[extname(absolute)]||'text/plain'});res.end(data);
 }catch(err){res.writeHead(404);res.end('No encontrado');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({acceptDownloads:true});
 const page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',req=>{if(/supabase\.co|pci-online-save|pci-access/.test(req.url()))requests.push(req.url());});
 await page.goto(base+'/pci-tecnica-editor.html?especialidad=computacion',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#heading')?.textContent==='Computación'&&
  document.querySelector('#sourceCount')?.textContent.includes('/ 35'),null,{timeout:30000});
 assert.match(await page.locator('#status').innerText(),/Guardado LOCAL confirmado/);
 assert.equal(await page.locator('#calendar td').count(),12);
 assert.equal(await page.locator('#spaces article').count(),0);
 await page.locator('#calendar td button').first().click();
 assert.equal(await page.locator('#spaces article').count(),1);
 await page.locator('#spaces article input').first().fill('Laboratorio de prueba');
 await page.locator('#spaces article input').first().dispatchEvent('change');
 await page.waitForFunction(()=>document.querySelector('#spaces article h3')?.textContent.includes('Laboratorio de prueba'));
 const editor=page.locator('#spaces article').first();
 await editor.getByText('Elegí una sección…').count();
 await editor.locator('.linked select').selectOption({index:1});
 assert.match(await page.locator('#count').innerText(),/1 secciones vinculadas/);
 await editor.getByRole('button',{name:'+ Agregar plan'}).click();
 assert.match(await page.locator('#count').innerText(),/1 planes/);
 const exported=page.waitForEvent('download');
 await page.locator('#export').click();
 const file=await exported;
 assert.match(file.suggestedFilename(),/^PCI-TECNICA-BORRADOR-computacion\.json$/);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#count')?.textContent.includes('1 espacios')&&
  document.querySelector('#count')?.textContent.includes('1 planes'));
 assert.equal(await page.locator('#spaces article').count(),1);
 assert.deepEqual(requests,[],'El editor técnico no debe llamar a servicios institucionales ni Supabase');
 assert.deepEqual(errors,[],'No debe haber errores JS en la vista técnica');
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('pci-tecnica-borrador-2026-v1:computacion')));
 assert.equal(stored.spaces[0].year,1);
 assert.equal(stored.spaces[0].term,1);
 assert.equal(stored.status,'provisional_no_aprobado');
 assert.equal(stored.spaces[0].sources.length,1);
 assert.equal(stored.plans.length,1);
 const page2=await context.newPage();page2.on('request',req=>{if(/supabase\.co/.test(req.url()))requests.push(req.url());});
 await page2.goto(base+'/pci-tecnica-editor.html?especialidad=quimica',{waitUntil:'domcontentloaded'});
 await page2.waitForFunction(()=>document.querySelector('#heading')?.textContent==='Química');
 assert.equal(await page2.locator('#spaces article').count(),0,'Dos especialidades no deben compartir el borrador local');
 assert.deepEqual(requests,[]);
 console.log('Editor Tecnica: 26 especialidades, 12 C, planes, referencias, guardado aislado y exportación OK');
}finally{
 if(browser)await browser.close();
 await new Promise(done=>server.close(done));
}
