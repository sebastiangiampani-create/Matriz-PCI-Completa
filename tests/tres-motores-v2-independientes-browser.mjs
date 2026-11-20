import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,relative,extname,sep} from 'node:path';
import {chromium} from 'playwright';

const root=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.txt':'text/plain','.png':'image/png'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    const file=resolve(root,'.'+decodeURIComponent(url.pathname));
    const rel=relative(root,file);
    if(rel==='..'||rel.startsWith('..'+sep))throw Error('Ruta fuera del repositorio');
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(body);
  }catch(error){res.writeHead(404);res.end(error.message)}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(process.env.CHROME_BIN?
  {headless:true,executablePath:process.env.CHROME_BIN}:{headless:true});
await mkdir('test-artifacts/tres-entornos-v2',{recursive:true});
const profiles=[
 {model:'media',selector:'comunicacion',expectedTrack:'Comunicación',levels:5,terms:10,target:'revision-v2-embed.html'},
 {model:'tecnica',selector:'computacion',expectedTrack:'Computación',levels:6,terms:12,target:'revision-v2-modalidad.html'},
 {model:'ba15',selector:'economia_administracion',expectedTrack:'Economía y Administración',levels:4,terms:8,target:'revision-v2-modalidad.html'}
];
try{
 const home=await browser.newPage();
 await home.goto(origin+'/experiencias-v2/index.html');
 assert.equal(await home.locator('.card').count(),3,'La portada debe ofrecer los tres motores independientes');
 await home.screenshot({path:'test-artifacts/tres-entornos-v2/00-selector.png',fullPage:true});
 await home.close();
 for(const p of profiles){
  const context=await browser.newContext({viewport:{width:1600,height:900}});
  const page=await context.newPage();
  const errors=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)missing.push({url:r.url().slice(0,180),status:r.status()})});
  await page.goto(origin+'/experiencias-v2/'+p.model+'.html',{waitUntil:'domcontentloaded'});
  await page.locator('#catalogo option').first().waitFor({timeout:10000});
  await page.locator('#catalogo').selectOption(p.selector);
  await page.locator('#escuela').fill('Escuela de ensayo');
  await page.locator('#turno').selectOption(p.model==='ba15'?'noche':'manana');
  await page.screenshot({path:'test-artifacts/tres-entornos-v2/'+p.model+'-selector.png',fullPage:true});
  await page.locator('#selector button[type="submit"]').click();
  await page.waitForURL(url=>url.pathname.endsWith('/'+p.target),{timeout:20000});
  await page.locator('#offer.active').waitFor({timeout:60000});
  assert.equal(await page.locator('#matrix .grid.levels .level').count(),p.levels,'Cada motor necesita sus niveles');
  assert.equal(await page.locator('#matrix .term').count(),p.terms+1,'Cada motor necesita sus cuatrimestres');
  assert.ok(await page.locator('#bagContent [data-sub]').count()>0,'Cada motor necesita su bolsa de materias');
  const props=await page.evaluate(()=>{
    const data=window.__V2_MODAL;
    return {school:window.state?.school??null,
      track:window.state?.active??null,modal:data?.model??'media',
      levels:data?.levels??5,terms:data?.terms??10,
      phase2:!!window.PCIPhase2V28};
  });
  assert.equal(props.track,p.expectedTrack);
  assert.equal(props.phase2,true,'Debe estar presente la Fase 2 de V2');
  if(p.model==='tecnica'){
    const labels=await page.locator('#matrix .rowlabel').allTextContents();
    assert.ok(labels.some(t=>t.includes('Espacios de integración')));
    assert.ok(labels.some(t=>t.includes('Espacios formativos')));
  }
  const selected=await page.evaluate(()=>{
    const subject=document.querySelector('#bagContent [data-sub]');
    const id=subject?.dataset.sub;
    const s=window.__V2_MODAL?.subjects.find(x=>x.id===id);
    if(!s)return null;
    const row=window.V2ModalMap.rowDefs().find(r=>{
      const slot=r.k+(r.annual?'-n':'-c')+(r.annual?s.year:s.year*2-1);
      return window.V2ModalMap.canAssign(slot,s)[0];
    });
    if(!row)throw Error('Sin destino V2 para materia '+s.name);
    const slot=row.k+(row.annual?'-n':'-c')+(row.annual?s.year:s.year*2-1);
    const dt=new DataTransfer();
    subject.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:dt}));
    const target=document.querySelector('#matrix [data-slot="'+slot+'"]');
    target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
    target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
    return {id,slot,assigned:!!document.querySelector('#matrix [data-slot="'+slot+'"] [data-map-id="'+id+'"]')};
  });
  if(p.model!=='media')assert.ok(selected?.assigned,'Técnica y BA+15 deben permitir asignar materias');
  await page.screenshot({path:'test-artifacts/tres-entornos-v2/'+p.model+'-mapa.png',fullPage:true});
  assert.deepEqual(errors,[],'No debe haber excepciones JS en '+p.model);
  assert.deepEqual(missing,[],'No debe faltar un módulo o contenido en '+p.model);
  console.log('OK '+JSON.stringify({...p,props,select:!!selected?.assigned}));
  await context.close();
 }
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
