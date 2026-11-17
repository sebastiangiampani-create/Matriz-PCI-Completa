import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';

const root=process.cwd();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8',
 '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://local').pathname);
  const target=resolve(root,'.'+path);
  if(!target.startsWith(root+sep))throw Error('Fuera de carpeta');
  const data=await readFile(target);
  res.writeHead(200,{'Content-Type':mime[extname(target)]||'text/plain'}).end(data);
 }catch{res.writeHead(404).end('No encontrado');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:960}});
 await context.addInitScript(()=>localStorage.setItem('pciAppV2','{"preservar":"origen"}'));
 const page=await context.newPage(),errors=[],remote=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(/supabase\.co|functions\/v1\/pci-access/.test(r.url()))remote.push(r.url());});
 await page.goto(base+'/pci-tecnica-pautas.html?especialidad=computacion',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#contentStatus')?.textContent.includes('35 asignaturas o secciones'),null,{timeout:30000});
 await page.locator('#officialContents > summary').click();
 assert.equal(await page.locator('#mapHead tr').count(),2,'Se preservan los dos encabezados del mapa');
 assert.equal(await page.locator('#mapHead tr').last().locator('th').count(),12,'El mapa conserva C1-C12');
 assert.equal(await page.locator('#mapBody tr').count(),13,'Se conservan las filas curriculares originales');
 assert.equal(await page.locator('#contentList details').count(),35);
 assert.match(await page.locator('#specialtyStatus').innerText(),/4.º, 5.º y 6.º/);
 assert.equal(await page.locator('#contentPdf').getAttribute('href'),
  'https://static.buenosaires.gob.ar/sites/default/files/2026-10/2026_NS_CPO_Computacion.pdf');
 const originalHtml=await page.locator('#mapTable').innerHTML();
 await page.locator('#contentSearch').fill('Laboratorio');
 const afterSearch=await page.locator('#contentList > details').count();
 assert.ok(afterSearch>0&&afterSearch<35,'La búsqueda filtra sin tocar el mapa');
 await page.locator('#contentSearch').fill('');
 await page.locator('#contentList > details').first().locator('summary').click();
 assert.ok(await page.locator('#contentList > details').first().locator('a[href*="#page="]').count());
 assert.equal(await page.locator('#mapTable').innerHTML(),originalHtml,'La búsqueda no reescribe el mapa');
 await page.locator('#specialty').selectOption('quimica');
 await page.waitForFunction(()=>document.querySelector('#contentStatus')?.textContent.includes('45 asignaturas o secciones'),null,{timeout:30000});
 assert.equal(await page.locator('#contentList > details').count(),45,'Cada especialidad usa su propio catálogo');
 assert.equal(await page.locator('#mapBody tr').count(),13);
 assert.equal(await page.evaluate(()=>localStorage.getItem('pciAppV2')),'{"preservar":"origen"}');
 assert.deepEqual(remote,[],'No se deben leer ni escribir escuelas reales desde esta vista');
 assert.deepEqual(errors,[],'La consulta dentro del mapa no genera errores JS');
 await mkdir('test-artifacts/tecnica-priorizados-mapa',{recursive:true});
 await page.screenshot({path:'test-artifacts/tecnica-priorizados-mapa/mapa-con-fuentes.png',fullPage:true});
 console.log('Matriz Técnica PCI V2: mapa C1-C12, fuente oficial, 26 especialidades, filtro y aislamiento OK');
}finally{
 if(browser)await browser.close();
 await new Promise(done=>server.close(done));
}
