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
  const records=[
    {model:'tecnica',id:'00000000-0000-4000-8000-000000000002',track:'Computación',orientation_id:'informatica',
     specialty_name:'Computación',shift_id:'tarde',levels:6,terms:12},
    {model:'ba15',id:'00000000-0000-4000-8000-000000000003',track:'Economía y Administración',orientation_id:'economia_administracion',
     specialty_name:null,shift_id:'noche',levels:4,terms:8}
  ];
  state.pcis.push(...records.map(p=>({
    pci_id:p.id,school_id:1001,orientation_id:p.orientation_id,
    process_id:'process-'+p.model,title:p.track+' · '+p.shift_id,
    model:p.model,shift_id:p.shift_id,status:'borrador',
    specialty_name:p.specialty_name,legacy_sha256:'a'.repeat(64),
    legacy_state:{schemaVersion:10,areas:{},schoolName:'Escuela de prueba'}
  })));
  await page.goto('http://127.0.0.1:'+port+'/pci-orientaciones.html?school=1001',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('.school-offer-card').length===3,null,{timeout:45000});
  for(const m of records){
    const card=page.locator('.school-offer-card').filter({hasText:m.track}).first();
    await card.locator('button[aria-label^="Abrir Mapa de la Oferta"]').click();
    await page.locator('#v2OriginalPane:not([hidden])').waitFor({timeout:35000});
    assert.equal(await page.locator('#offerPane').isHidden(),true,'El mapa anterior no debe estar superpuesto');
    assert.equal(await page.locator('#ba15Pending').isHidden(),true,'No mostrar constructor BA+15 anterior');
    assert.equal(await page.locator('#technicalPending').isHidden(),true,'No mostrar constructor técnico anterior');
    const v2=page.frameLocator('#v2OriginalFrame');
    await v2.locator('#offer.active').waitFor({timeout:60000});
    assert.equal(await v2.locator('#matrix .grid.levels .level').count(),m.levels);
    assert.equal(await v2.locator('#matrix .term').count(),m.terms+1);
    const result=await v2.locator('body').evaluate(()=>{
      const src=document.querySelector('#bagContent [data-sub]');
      const s=window.__V2_MODAL?.subjects.find(x=>x.id===src?.dataset.sub);
      if(!s)throw Error('No existe materia en la bolsa');
      const row=window.V2ModalMap.rowDefs().find(r=>{
        const slot=r.k+(r.annual?'-n':'-c')+(r.annual?s.year:s.year*2-1);
        return window.V2ModalMap.canAssign(slot,s)[0];
      });
      if(!row)throw Error('No hay espacio compatible para '+s.name);
      const slot=row.k+(row.annual?'-n':'-c')+(row.annual?s.year:s.year*2-1);
      const dest=document.querySelector('#matrix .drop[data-slot="'+slot+'"]');
      const dt=new DataTransfer();
      src.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:dt}));
      dest.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
      dest.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
      if(!document.querySelector('[data-slot="'+slot+'"] [data-map-id="'+s.id+'"]'))
        throw Error('Drag & drop no ubicó la materia '+s.name);
      return {slot,id:s.id};
    });
    await page.locator('#v2OriginalSave').click();
    await page.waitForFunction(()=>document.querySelector('#v2OriginalStatus')?.textContent.includes('revisión 1'),null,{timeout:25000});
    const unit=[m.id,'oferta','map','mapa-v2-familia-'+m.model+'-v1'].join(':');
    const saved=state.units.get(unit);
    assert.equal(saved?.revision,1,'Guardado V2 de modalidad separado');
    assert.equal(saved?.document.model,m.model,'Documento del modelo correcto');
    assert.equal(saved?.document.schoolId,1001);
    assert.equal(saved?.document.pciId,m.id);
    assert.ok(saved?.document.v2.maps[m.track]?.placements[result.slot]?.includes(result.id),'Materia V2 guardada correctamente');
    assert.equal(state.units.has([m.id,'oferta','map','mapa-oferta-v1'].join(':')),false);
    assert.equal(state.units.has([m.id,'oferta','map','mapa-ba15-v1'].join(':')),false);
    await page.screenshot({path:'test-artifacts/v2-modalidades/portal-'+m.model+'.png',fullPage:true});
    await page.locator('#editor [data-back-to-school]').click();
    await page.locator('#empty:not([hidden])').waitFor({timeout:20000});
    await card.locator('button[aria-label^="Abrir Mapa de la Oferta"]').click();
    await v2.locator('#offer.active').waitFor({timeout:60000});
    await v2.locator('#matrix [data-slot="'+result.slot+'"] [data-map-id="'+result.id+'"]').waitFor({timeout:20000});
    assert.equal(state.units.get(unit).revision,1,'Reabrir el PCI no debe modificar revisión');
    await page.locator('#editor [data-back-to-school]').click();
    await page.locator('#empty:not([hidden])').waitFor({timeout:20000});
  }
  assert.equal(state.pcis.length,3,'Mantener tres PCIs de modelos distintos');
  assert.equal(state.units.size,2,'Solo dos unidades V2 nuevas guardadas');
  assert.deepEqual(pageConsole,[],'Sin excepciones JS en portal');
  console.log('PORTAL TRES MODELOS OK: Técnica 12C, BA+15 8C, arrastre, separación PCI, guardado y reapertura.');
}finally{
 await browser.close();await new Promise(done=>server.close(done));
}
