/**
 * Media (V2 embebido en Matriz): todas las orientaciones ofrecen bloques y
 * ejes de la Orientación en el Desarrollo Curricular, incluidas las que no
 * figuran en curriculum_v96 (se leen de data/orientaciones/ de V2).
 */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'};
const root=resolve('.');
const server=createServer(async(req,res)=>{
  try{
    const file=resolve(root+decodeURIComponent(new URL(req.url,'http://x').pathname));
    if(!file.startsWith(root))throw Error('fuera de raíz');
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(await readFile(file));
  }catch{res.writeHead(404);res.end()}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{});
const casos={'Informática':57,'Educación':70,'Ciencias Naturales':140,'Matemática y Física':56,'Economía y Administración':51};
try{
  for(const [orientacion,esperado] of Object.entries(casos)){
    const context=await browser.newContext();
    await context.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.fulfill({status:200,contentType:'text/css',body:''}));
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/revision-v2-embed.html?orientation='+encodeURIComponent(orientacion)+'&pci=pci-media-ori-'+orientacion.length,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.PCIPhase2V28,{timeout:30000});
    const r=await page.evaluate(async()=>{
      const p=window.PCIPhase2V28;await p.loadCurriculum();const fo=p.getFOCatalog();
      return {total:fo.length,bloques:new Set(fo.map(c=>c.block)).size,sinEje:fo.filter(c=>!c.axis).length,ids:new Set(fo.map(c=>c.id)).size};
    });
    // Media carga además el atomizador FO de V2, que puede dividir textos compuestos.
    assert.ok(r.total>=esperado,`${orientacion}: se esperaban al menos ${esperado} elementos y hay ${r.total}`);
    assert.equal(r.ids,r.total,`${orientacion}: IDs duplicados`);
    assert.ok(r.bloques>=5,`${orientacion}: bloques`);
    assert.equal(r.sinEje,0,`${orientacion}: elementos sin eje`);
    assert.deepEqual(errors,[]);
    console.log(orientacion,r.total,'elementos',r.bloques,'bloques');
    await context.close();
  }
  console.log('MEDIA ORIENTACIONES OK: bloques y ejes disponibles en todas las orientaciones probadas.');
}finally{
  await browser.close();server.close();
}
