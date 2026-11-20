import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,relative,extname,sep} from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.txt':'text/plain','.png':'image/png'};
const server=createServer(async(req,res)=>{
 try{
  const full=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));
  const rel=relative(root,full);if(rel==='..'||rel.startsWith('..'+sep))throw Error('Ruta fuera del repositorio');
  const body=await readFile(full);res.writeHead(200,{'Content-Type':mime[extname(full)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 }catch(error){res.writeHead(404);res.end(error.message)}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(process.env.CHROME_BIN?{headless:true,executablePath:process.env.CHROME_BIN}:{headless:true});
await mkdir('test-artifacts/v2-modalidades',{recursive:true});
try{
 for(const [model,filter,levels,track] of [
  ['tecnica','specialty=computacion',6,'Computación'],
  ['ba15','orientation=economia_administracion',4,'Economía y Administración']
 ]){
  const page=await browser.newPage({viewport:{width:1600,height:1080}});
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)requests.push({url:r.url(),status:r.status()})});
  const id=model==='tecnica'?'v2-tecnica-computacion':'v2-ba15-economia';
  await page.goto(origin+'/revision-v2-modalidad.html?model='+model+'&'+filter+'&pci='+id+'&school=Escuela+de+prueba',{waitUntil:'domcontentloaded'});
  try{await page.locator('#offer.active').waitFor({timeout:60000})}
  catch(error){console.log('BOOT DIAGNOSTIC '+model,JSON.stringify({body:(await page.locator('body').textContent()).slice(0,3400),errors,requests}));throw error}
  assert.equal(await page.locator('#matrix .grid.levels .level').count(),levels,'V2 debe renderizar la cantidad de niveles de la modalidad');
  assert.equal(await page.locator('#matrix .term').count(),levels*2+1,'V2 debe renderizar la cantidad de cuatrimestres de la modalidad');
  const rows=await page.locator('#matrix .rowlabel').allTextContents();
  assert.ok(rows.some(t=>t.includes('Ciencias Naturales')),'Conservar la fila de Ciencias Naturales');
  if(model==='tecnica'){
    assert.ok(rows.some(t=>t.includes('Espacios de integración')),'Técnica usa Espacios de integración');
    assert.ok(rows.some(t=>t.includes('Espacios formativos')),'Técnica usa Espacios formativos');
    assert.equal(rows.some(t=>t.includes('Laboratorios · Ciencias Naturales')),false,'Técnica no debe copiar rótulo Laboratorio de Media');
  }
  if(model==='ba15'){
    const fg=await page.evaluate(async()=>{const p=window.PCIPhase2V28;await p.loadCurriculum();return p.getFGCatalog().length;});
    assert.equal(fg,1126,'BA15 conserva 1126 IDs FG originales reindexados');
  }
  const bank=page.locator('#bagContent [data-sub]');
  assert.ok(await bank.count()>2,'Bolsa V2 debe ofrecer materias del nivel');
  await page.evaluate(()=>{
   const from=document.querySelector('#bagContent [data-sub]'),id=from?.dataset.sub;
   const item=window.__V2_MODAL.subjects.find(x=>x.id===id);
   const rows=window.V2ModalMap.rowDefs();
   const row=rows.find(r=>{
    const slot=r.annual?r.k+'-n'+item.year:r.k+'-c'+(item.year*2-1);
    return window.V2ModalMap.canAssign(slot,item)[0]});
   if(!row)throw Error('No hay casillero compatible para '+item?.name);
   const slot=row.annual?row.k+'-n'+item.year:row.k+'-c'+(item.year*2-1);
   const target=document.querySelector('[data-slot="'+slot+'"]');
   const dt=new DataTransfer();
   from.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:dt}));
   target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
   target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
   if(!document.querySelector('[data-map-id="'+id+'"]'))throw Error('No se asignó la materia con drop V2');
  });
  assert.equal(await page.locator('#matrix [data-map-id]').count()>0,true);
  const phase2=await page.evaluate(async()=>{
   const p=window.PCIPhase2V28;
   if(!p)throw Error('No se instaló la Fase 2 V2');
   await p.loadCurriculum();
   return {groups:p.groups().length,fg:p.getFGCatalog().length,fo:p.getFOCatalog().length};
  });
  assert.ok(phase2.groups>15,'Fase 2 V2 debe generar agrupamientos desde el mapa del modelo');
  assert.ok(phase2.fg>0,'La Fase 2 debe tener contenidos FG');
  assert.ok(phase2.fo>0,'La Fase 2 debe tener contenidos específicos de la modalidad');
  await page.screenshot({path:'test-artifacts/v2-modalidades/'+model+'-mapa.png',fullPage:true});
  assert.deepEqual(errors,[],'Sin excepciones en motor V2 modal: '+model);
  assert.deepEqual(requests,[],'Sin recursos faltantes en motor V2 modal: '+model);
  console.log(JSON.stringify({model,track,levels,terms:levels*2,phase2}));
  await page.close();
 }
}finally{await browser.close();await new Promise(ok=>server.close(ok));}
