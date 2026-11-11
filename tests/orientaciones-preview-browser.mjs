/**
 * E2E de la vista online de GitHub, con servidor de archivos local.
 * Si el navegador intenta llegar a Supabase REAL, falla el test.
 */
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,normalize,join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(process.cwd());
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8',
  '.png':'image/png','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  const file=resolve(join(root,normalize(decodeURIComponent(new URL(req.url,'http://localhost').pathname)).replace(/^\/+/,'')));
  if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
  try{const b=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(b);}
  catch{res.writeHead(404).end('Missing file');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const url='http://127.0.0.1:'+server.address().port+'/pci-orientaciones-demo.html?school=1001';
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1400,height:900}});
 const errors=[],live=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',req=>{if(req.url().includes('agmebsotbuurbnldxewf.supabase.co'))live.push(req.url())});
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.locator('#app').waitFor({state:'visible',timeout:40000});
 assert.match(await page.locator('#demoBanner').textContent(),/DATOS FICTICIOS|Escuelas y PCI ficticios/i);
 assert.equal(await page.locator('#school option').count(),2);
 assert.equal(await page.locator('#pciList .pciItem').count(),2);
 await page.locator('#pciList .pciItem').first().click();
 await page.locator('#editor').waitFor({state:'visible'});
 assert.match(await page.locator('#pciName').textContent(),/Economía/);
 const areas=await page.locator('#areaList .areaItem').count();
 assert.ok(areas>=1, 'No se cargó la FG de plantilla');
 await page.locator('#areaList .areaItem').first().click();
 await page.locator('#areaEditor .btn.primary').waitFor({state:'visible'});
 await page.locator('#areaEditor .btn.primary').click();
 await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('guardada en el PCI'),null,{timeout:20000});
 await page.locator('[data-tab="oferta"]').click();
 await page.locator('#mapBody tr').first().waitFor();
 assert.ok((await page.locator('#mapHead').textContent()).includes('C10'));
 await page.locator('#saveOffer').click();
 await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('Mapa FO guardado'),null,{timeout:20000});
 await page.locator('[data-tab="fo"]').click();
 await page.locator('#foSpaces .areaItem').first().click();
 await page.locator('#foEditor .btn.primary').waitFor({state:'visible'});
 await page.locator('#foEditor .btn.primary').click();
 await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('Planes FO guardados'),null,{timeout:20000});
 const snapshot=await page.evaluate(()=>window.__PCI_VISTA_PREVIA__.getState());
 const comps=new Set(Object.keys(snapshot.units).map(key=>key.split('|')[4]));
 assert.ok(comps.has('fg')&&comps.has('oferta')&&comps.has('fo'),'No se guardaron las tres unidades separadas');
 await page.locator('#btnAddPci').click();
 await page.locator('#orientation').selectOption('economia_administracion');
 await page.locator('#pciTitleInput').fill('Economía · Segundo PCI de prueba');
 await page.locator('#formCreatePci button[type=submit]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#pciList .pciItem').length===3,null,{timeout:15000});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#app').waitFor({state:'visible',timeout:40000});
 assert.equal(await page.locator('#pciList .pciItem').count(),3,'PCI perdido al recargar');
 await page.locator('#school').selectOption('1002');
 await page.waitForFunction(()=>document.querySelectorAll('#pciList .pciItem').length===1,null,{timeout:15000});
 assert.deepEqual(live,[], 'Hubo tráfico real a Supabase en una demo');
 assert.deepEqual(errors,[], 'Errores de ejecución: '+errors.join(' | '));
 console.log('PREVIEW ONLINE OK: plantillas FG, mapa C1-C10, cuatro planes FO, múltiples PCI, recarga y aislamiento por escuela; 0 solicitudes a Supabase real.');
}finally{
 if(browser)await browser.close();
 await new Promise(done=>server.close(done));
}
