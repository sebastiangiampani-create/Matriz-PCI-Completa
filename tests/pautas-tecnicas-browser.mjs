import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,join,extname,normalize} from 'node:path';
import assert from 'node:assert/strict';

const root=resolve(process.cwd());
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  const path=normalize(decodeURIComponent(new URL(req.url,'http://localhost').pathname)).replace(/^\/+/,'');
  const full=resolve(join(root,path));
  if(!full.startsWith(root+'/')){res.writeHead(403).end();return;}
  try{const data=await readFile(full);res.writeHead(200,{'Content-Type':mime[extname(full)]||'application/octet-stream'});res.end(data);}
  catch{res.writeHead(404).end('No encontrado');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port, output='test-artifacts/mapa-tecnico-2026';
await mkdir(output,{recursive:true});
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{
    if(r.url().includes('agmebsotbuurbnldxewf.supabase.co'))requests.push(r.url());
  });
  await page.goto(base+'/pci-tecnica-pautas.html?especialidad=Computaci%C3%B3n',{waitUntil:'domcontentloaded'});
  await page.locator('#mapBody tr').first().waitFor({timeout:30000});
  assert.equal(await page.locator('#mapBody tr').count(),13);
  assert.equal(await page.locator('#specialty').inputValue(),'computacion');
  assert.match(await page.locator('#mapHead').textContent(),/C12/);
  assert.match(await page.locator('#annualSubjects').textContent(),/Desarrollo de Sistemas/);
  assert.match(await page.locator('#exceptions').textContent(),/10 integraciones de Sociales/);
  await page.screenshot({path:output+'/01-computacion-c1-c12.png',fullPage:true});
  await page.locator('#exampleInvalid').click();
  const results=await page.locator('#results').textContent();
  assert.match(results,/9 horas|nueve/i);
  assert.match(results,/2.º y 3.º/);
  await page.locator('#specialty').selectOption('mecanica');
  assert.match(await page.locator('#annualSubjects').textContent(),/Proyecto Mecánico/);
  assert.match(await page.locator('#exceptions').textContent(),/Metrología y Producción Industrial/);
  await page.screenshot({path:output+'/02-mecanica-excepciones.png',fullPage:true});

  await page.goto(base+'/preview-v2-real/institucion.html',{waitUntil:'domcontentloaded'});
  await page.locator('#technicalForm').waitFor({state:'visible',timeout:30000});
  await page.locator('#technicalSpecialty').fill('Mecánica');
  await page.locator('#technicalShift').selectOption('Noche');
  await page.locator('#technicalQuantity').fill('1');
  await page.locator('#technicalForm button[type="submit"]').click();
  const tech=page.locator('#pciList .pci-card').filter({hasText:'Especialidad Técnica · Mecánica'});
  await tech.first().waitFor({state:'visible'});
  await tech.first().getByRole('button',{name:/Ver ficha técnica/}).click();
  await page.locator('#technicalPendingDemo').waitFor({state:'visible'});
  const frame=page.frameLocator('#technicalRulesPreview');
  await frame.locator('#mapBody tr').first().waitFor({timeout:30000});
  assert.equal(await frame.locator('#specialty').inputValue(),'mecanica');
  assert.match(await frame.locator('#mapHead').textContent(),/C12/);
  assert.equal(await page.locator('#frame').isVisible(),false,'El mapa de Media no debe abrirse en Técnica');
  assert.deepEqual(requests,[],'La vista preliminar no debe consultar Supabase real');
  assert.deepEqual(errors,[],'Error Javascript en vista técnica: '+errors.join(' | '));
  await page.screenshot({path:output+'/03-colegio-mixto-tecnica.png',fullPage:true});
  console.log('VALIDADO: reglas del PDF, 12 cuatrimestres, 20 especialidades, ejemplo inválido y vista colegial mixta, sin Supabase real.');
}finally{
  if(browser)await browser.close();
  await new Promise(done=>server.close(done));
}
