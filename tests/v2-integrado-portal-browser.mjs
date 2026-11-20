import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, relative, sep } from 'node:path';
import { chromium } from 'playwright';
import {crearBorradorBa15,crearEspacioBa15,asignarMateriaBa15,actualizarEspacioBa15,validarBorradorBa15}
 from '../src/ba15/constructor.mjs';

const root = process.cwd();
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml'};
const server = createServer(async(req,res)=>{
 try{
  const name = decodeURIComponent(new URL(req.url||'/', 'http://localhost').pathname);
  const full=resolve(root,'.'+name);
  const rel=relative(root,full);
  if(rel==='..'||rel.startsWith('..'+sep))throw Error('Ruta fuera del repositorio');
  const content=await readFile(full);
  res.writeHead(200,{'Content-Type':types[extname(full)]||'application/octet-stream'});res.end(content);
 }catch(error){res.writeHead(404);res.end(String(error.message||error))}
});
const listen=()=>new Promise(resolveListen=>server.listen(0,'127.0.0.1',resolveListen));
const initialPcis=[
 {pci_id:'00000000-0000-4000-8000-000000000001',school_id:1001,orientation_id:'comunicacion',process_id:'process-existing',title:'Comunicación · Turno mañana',model:'comun',shift_id:'manana',status:'borrador',specialty_name:null,legacy_sha256:'a'.repeat(64),legacy_state:{schemaVersion:10,areas:{},schoolName:'Escuela de prueba'}},
];
const newId='00000000-0000-4000-8000-000000000015';
const state={pcis:structuredClone(initialPcis),units:new Map(),actions:[]};
const pageConsole=[];
await listen();
const port=server.address().port;
const browser=await chromium.launch(process.env.CHROME_BIN ? {headless:true,executablePath:process.env.CHROME_BIN} : {headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>pageConsole.push(e.message));
 await page.addInitScript(()=>{
  sessionStorage.setItem('pci_access_session',JSON.stringify({token:'e2e-fake-session',role:'admin'}));
 });
 await page.route('https://agmebsotbuurbnldxewf.supabase.co/functions/v1/pci-multipci',async route=>{
  if(route.request().method()==='OPTIONS'){
   await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'}});return;
  }
  const body=JSON.parse(route.request().postData()||'{}'), action=String(body.action||'');
  state.actions.push(action);
  let result={},status=200;
  switch(action){
   case 'session-info':
    result={role:'admin',permissions:['pci.view','pci.edit'],all_schools:true,school_ids:[],identity:{}};break;
   case 'list-schools':
    result={schools:[{school_id:1001,name:'Escuela N.º 99 · Prueba automatizada',cue:'DEMO-001'}]};break;
   case 'list-school-pcis':
    result={pcis:state.pcis};break;
   case 'create-school-pci': {
    const p={pci_id:newId,school_id:1001,orientation_id:body.orientation_id,process_id:'process-ba15-e2e',
     title:body.title,model:body.model,shift_id:body.shift_id,status:'borrador',
     specialty_name:body.specialty_name||null,legacy_sha256:'a'.repeat(64),
     legacy_state:{schemaVersion:10,areas:{},schoolName:'Escuela N.º 99'}};
    state.pcis.push(p);
    result={ok:true,pci_id:p.pci_id};break;
   }
   case 'get-school-pci':
    result={pci:state.pcis.find(p=>p.pci_id===body.pci_id)};break;
   case 'get-school-pci-unit': {
    const key=[body.pci_id,body.component,body.unit_kind,body.unit_id].join(':');
    result=state.units.get(key)||{exists:false,revision:0};break;
   }
   case 'save-school-pci-unit': {
    const key=[body.pci_id,body.component,body.unit_kind,body.unit_id].join(':');
    const prev=state.units.get(key);
    if(Number(body.expected_revision)!==(prev?.revision||0)){
     status=409;result={ok:false,status:409,code:'stale_revision'};
    }else{
     result={ok:true,revision:(prev?.revision||0)+1};
     state.units.set(key,{exists:true,revision:result.revision,base_version:body.base_version,document:body.document});
    }
    break;
   }
   default:status=404;result={error:'Acción no simulada: '+action};
  }
  await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(result)});
 });
  state.pcis.push({...initialPcis[0],
    pci_id:'00000000-0000-4000-8000-000000000002',
    orientation_id:'turismo',shift_id:'tarde',title:'Turismo · Turno tarde',
    process_id:'process-second-pci'});
  await page.goto('http://127.0.0.1:'+port+'/pci-orientaciones.html',{waitUntil:'domcontentloaded'});
  await page.locator('#app:not([hidden])').waitFor({timeout:45000});
  await page.waitForFunction(()=>document.querySelectorAll('.school-offer-card').length===2,null,{timeout:25000});
  assert.equal(await page.locator('.school-offer-card').count(),2);
  await page.locator('.school-offer-card').filter({hasText:'Comunicación'})
    .locator('button[aria-label^="Abrir Mapa de la Oferta"]').click();
  await page.locator('#v2OriginalPane:not([hidden])').waitFor({timeout:35000});
  assert.equal(await page.locator('#offerPane').isHidden(),true,
    'Al abrir Media, el constructor anterior debe quedar reemplazado por V2 original.');
  const v2=page.frameLocator('#v2OriginalFrame');
  await v2.locator('#offer.active').waitFor({timeout:60000});
  await v2.locator('#matrix .grid.levels').waitFor();
  assert.equal(await v2.locator('#matrix .grid.levels .level').count(),5);
  assert.equal(await v2.locator('#matrix .term').count(),11);
  assert.ok(await v2.locator('#bagContent [data-sub="fg-1-matematica"]').count()>0);
  const target=v2.locator('#matrix .drop[data-slot="matematica-n1"]');
  const source=v2.locator('#bagContent [data-sub="fg-1-matematica"]');
  const assigned=target.locator('[data-rm="fg-1-matematica"]');
  if(await assigned.count())await assigned.first().click();
  await source.dragTo(target);
  await target.locator('[data-map-id="fg-1-matematica"]').waitFor({timeout:15000});
  await page.locator('#v2OriginalSave').click();
  await page.waitForFunction(()=>document.querySelector('#v2OriginalStatus')?.textContent.includes('revisión 1'),null,{timeout:20000});
  const key=[initialPcis[0].pci_id,'oferta','map','mapa-original-v2-v1'].join(':');
  assert.equal(state.units.get(key)?.revision,1,'El servidor debe confirmar revisión 1');
  const saved=state.units.get(key)?.document;
  assert.equal(saved.schema,'v2-original-embedded-v1');
  assert.equal(saved.schoolId,1001);
  assert.equal(saved.orientationId,'comunicacion');
  assert.equal(saved.shiftId,'manana');
  assert.ok(saved.v2.maps.Comunicación.placements['matematica-n1'].includes('fg-1-matematica'));
  assert.equal(state.units.has([initialPcis[0].pci_id,'oferta','map','mapa-oferta-v1'].join(':')),false,
    'No debe reescribir la composición histórica con el guardado original V2.');
  await page.screenshot({path:'test-artifacts/v2-original/integrado-media-escuela.png',fullPage:true});
  await page.locator('#editor [data-back-to-school]').click();
  await page.locator('#empty:not([hidden])').waitFor();
  await page.locator('.school-offer-card').filter({hasText:'Turismo'})
    .locator('button[aria-label^="Abrir Mapa de la Oferta"]').click();
  await page.locator('#v2OriginalPane:not([hidden])').waitFor({timeout:35000});
  await v2.locator('#offer.active').waitFor({timeout:60000});
  assert.equal(state.units.has(['00000000-0000-4000-8000-000000000002','oferta','map','mapa-original-v2-v1'].join(':')),false,
    'Turismo no debe usar ni generar el guardado de Comunicación.');
  await page.locator('#editor [data-back-to-school]').click();
  await page.locator('.school-offer-card').filter({hasText:'Comunicación'})
    .locator('button[aria-label^="Abrir Mapa de la Oferta"]').click();
  await page.locator('#v2OriginalPane:not([hidden])').waitFor({timeout:35000});
  await v2.locator('#offer.active').waitFor({timeout:60000});
  await v2.locator('#matrix .drop[data-slot="matematica-n1"] [data-map-id="fg-1-matematica"]').waitFor({timeout:15000});
  assert.equal(state.units.get(key).revision,1,'La reapertura no modifica el historial.');
  assert.deepEqual(state.pcis.map(p=>p.pci_id),['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002']);
  assert.deepEqual(pageConsole,[],'El portal y la copia V2 no deben generar excepciones JS.');
  console.log('INTEGRACIÓN REAL V2: apertura desde tarjeta Media, drag/drop, guardado Supabase simulado, revisión y PCI aislados.');
}finally{
 await browser.close();
 await new Promise(resolveClose=>server.close(resolveClose));
}
