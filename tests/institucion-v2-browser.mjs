import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {extname,resolve,join,normalize} from 'node:path';
import assert from 'node:assert/strict';

const root=resolve(process.cwd());
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.json':'application/json',
  '.css':'text/css; charset=utf-8','.svg':'image/svg+xml',
  '.png':'image/png','.txt':'text/plain; charset=utf-8'};
const server=createServer(async(req,res)=>{
  const relative=normalize(decodeURIComponent(new URL(req.url,'http://localhost').pathname)).replace(/^\/+/,'');
  const file=resolve(join(root,relative));
  if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
  try{const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(data);}
  catch{res.writeHead(404).end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const rootUrl='http://127.0.0.1:'+server.address().port;
let browser;
const artifacts='test-artifacts/v2-config-institucional';
await mkdir(artifacts,{recursive:true});
try {
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:940}});
  const errors=[],realSupabase=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',req=>{
    if(req.url().includes('agmebsotbuurbnldxewf.supabase.co'))realSupabase.push(req.url());
  });
  await page.goto(rootUrl+'/preview-v2-real/institucion.html',{waitUntil:'domcontentloaded'});
  await page.locator('#saveConfig').waitFor();
  assert.equal(await page.locator('#orientationCount').inputValue(),'1');
  assert.equal(await page.locator('#shiftCount').inputValue(),'1');
  await page.screenshot({path:artifacts+'/01-config-inicial.png',fullPage:true});

  // Dos orientaciones (Economía y Ciencias Naturales), dos turnos,
  // dos PCI de Economía mañana y uno de Naturales tarde.
  await page.locator('#orientationCount').selectOption('2');
  await page.locator('#shiftCount').selectOption('2');
  await page.getByRole('checkbox',{name:'Economía y Administración · Tarde habilitado'}).uncheck();
  await page.getByRole('checkbox',{name:'Ciencias Naturales · Mañana habilitado'}).uncheck();
  await page.getByRole('spinbutton',{name:'Cantidad de PCI Economía y Administración · Mañana'}).fill('2');
  assert.equal(await page.locator('#modelMediaCheck').isChecked(),true);
  assert.equal(await page.locator('#modelTechCheck').isChecked(),false);
  assert.match(await page.locator('#summary').textContent(),/3 PCI de Media previstos/);
  await page.locator('#saveConfig').click();
  assert.equal(await page.locator('#pciList .pci-card').count(),3);
  const entries=await page.evaluate(()=>window.__PCIDEMO__.getState());
  assert.equal(entries.pcis.length,3);
  assert.equal(entries.orientations.length,2);
  assert.equal(entries.shifts.length,2);
  assert.equal(entries.combos.length,2);
  const eco=entries.pcis.filter(p=>p.orientation==='Economía y Administración'&&p.shift==='Mañana');
  const natural=entries.pcis.find(p=>p.orientation==='Ciencias Naturales'&&p.shift==='Tarde');
  assert.equal(eco.length,2);
  assert.ok(natural);
  assert.notEqual(eco[0].id,eco[1].id);
  await page.screenshot({path:artifacts+'/02-dos-orientaciones-dos-turnos-tres-pci.png',fullPage:true});

  // El PCI abre el mapa V2 real, con todos los espacios y bolsa curricular.
  await page.locator('#pciList .pci-card').filter({hasText:'Economía y Administración'}).first().getByRole('button',{name:/Abrir PCI/}).click();
  const frame=page.frameLocator('#frame');
  await frame.locator('#pciList [data-open]').waitFor({timeout:70000});
  assert.match(await frame.locator('#matrizSchoolTitle').textContent(),/Escuela Muestra/);
  assert.equal(await frame.locator('#matrizOrientationSelect').inputValue(),'Economía y Administración');
  await frame.locator('#pciList [data-open]').first().click();
  await frame.locator('#openOffer').click();
  await frame.locator('#matrix .drop[data-slot="matematica-n3"]').waitFor({timeout:60000});
  await frame.locator('#bagContent [data-bag-year="3"]').click();
  await frame.locator('#bagContent .subject').filter({hasText:'Matemática · 3.º'}).first().click();
  await frame.locator('#matrix .drop[data-slot="matematica-n3"]').click();
  await frame.locator('#matrix .drop[data-slot="matematica-n3"] .placed').waitFor();
  await page.screenshot({path:artifacts+'/03-mapa-original-v2-con-materia.png',fullPage:true});
  const current=await page.evaluate(id=>{
    const key=window.__PCIDEMO__.getMapKey(id);
    const raw=localStorage.getItem(key);
    return raw?JSON.parse(raw):null;
  },eco[0].id);
  assert.ok(current?.maps?.['Economía y Administración']?.placements?.['matematica-n3']?.length,
    'La ubicación de Matemática 3.º no se guardó en el PCI solicitado.');
  await page.locator('#back').click();

  // El segundo PCI de LA MISMA orientación/turno debe comenzar vacío.
  await page.locator('#pciList .pci-card').filter({hasText:'Economía y Administración'}).nth(1).getByRole('button',{name:/Abrir PCI/}).click();
  await frame.locator('#pciList [data-open]').waitFor({timeout:70000});
  await frame.locator('#pciList [data-open]').first().click();
  await frame.locator('#openOffer').click();
  await frame.locator('#matrix .drop[data-slot="matematica-n3"]').waitFor({timeout:60000});
  assert.equal(await frame.locator('#matrix .drop[data-slot="matematica-n3"] .placed').count(),0);
  await page.locator('#back').click();

  // Si cambia la configuración, los PCI anteriores quedan conservados.
  await page.locator('#orientationCount').selectOption('1');
  await page.locator('#saveConfig').click();
  assert.equal(await page.locator('#pciList .pci-card').count(),3);
  assert.equal(await page.locator('#pciList > .pci-card').count(),2,'Solo los PCI vigentes deben estar visibles en la grilla principal.');
  assert.equal(await page.locator('#pciList .pci-conservados').count(),1);
  assert.equal(await page.locator('#pciList .pci-conservados').evaluate(e=>e.open),false,'Los anteriores deben aparecer plegados.');
  assert.match(await page.locator('#totalPcis').textContent(),/2 PCI habilitados/);
  assert.ok((await page.locator('#pciList').textContent()).includes('PCI conservado'));
  await page.locator('#pciList .pci-conservados > summary').click();
  assert.equal(await page.locator('#pciList .pci-conservados .pci-card').count(),1,'Debe haber un PCI histórico accesible.');
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#pciList .pci-card').count(),3);
  const restored=await page.evaluate(id=>localStorage.getItem(window.__PCIDEMO__.getMapKey(id)),eco[0].id);
  assert.ok(restored,'La recarga borró la ubicación original del primer PCI.');
  assert.deepEqual(realSupabase,[],'La demo transmitió datos a Supabase real.');
  assert.deepEqual(errors,[],'Errores JavaScript: '+errors.join(' | '));
  console.log('APROBADO: cantidad de orientaciones, turnos, PCI por combinación, mapa V2 original, estado por PCI, cambio de estructura sin pérdida y cero escrituras Supabase.');
} finally {
  if(browser)await browser.close();
  await new Promise(done=>server.close(done));
}