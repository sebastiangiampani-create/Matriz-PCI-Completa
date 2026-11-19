import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, relative, sep } from 'node:path';
import { chromium } from 'playwright';

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
 await page.goto('http://127.0.0.1:'+port+'/pci-orientaciones.html',{waitUntil:'domcontentloaded'});
 await page.locator('#app:not([hidden])').waitFor({timeout:35000});
 await page.waitForFunction(()=>document.getElementById('pciCounts')?.textContent?.includes('1 PCI'));
 const historic=await page.locator('#historicalPciLink').getAttribute('href');
 assert.match(historic||'',/escuela-online\.html\?school=1001/,'La escuela debe poder abrir su FG original');
 const design=await page.evaluate(()=>{
   const bg=(selector)=>getComputedStyle(document.querySelector(selector)).backgroundColor;
   return {
     header:document.querySelector('header.site-top')?.getBoundingClientRect().height,
     logo:document.querySelector('header.site-top .brand img')?.getAttribute('src'),
     ba:document.querySelector('header.site-top .ba')?.getAttribute('src'),
     body:bg('body'),
     hero:bg('.pci-hero'),
     cardRadius:getComputedStyle(document.querySelector('.sidebar.card')).borderRadius,
     primary:getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()
   };
 });
 assert.equal(design.header,77,'La cabecera debe conservar la altura original');
 assert.match(design.logo||'',/assets\/em-logo-header\.svg/,'Debe reutilizarse el logo del app original');
 assert.match(design.ba||'',/assets\/ba-logo\.png/,'Debe reutilizarse el logo de Buenos Aires');
 assert.equal(design.body,'rgb(255, 255, 255)','El fondo debe ser blanco como el PCI original');
 assert.equal(design.hero,'rgb(237, 243, 248)','La franja principal debe coincidir con app.css');
 assert.equal(design.cardRadius,'20px','Las tarjetas deben mantener el radio del PCI original');
 assert.equal(design.primary,'#12395c','Usar el azul institucional original');
 await page.screenshot({path:'test-artifacts/multipci-portal/escuela-selector-original.png',fullPage:true});
 await page.locator('#pciList').getByText('Comunicación · Turno mañana').waitFor();
 await page.locator('#btnAddPci').click();
 await page.locator('#formCreatePci:not([hidden])').waitFor();
 await page.selectOption('#pciModel','ba15');
 await page.selectOption('#orientation','economia_administracion');
 await page.selectOption('#pciShift','noche');
 await page.fill('#pciTitleInput','Economía y Administración · Turno noche');
 await page.locator('#formCreatePci button[type=submit]').click();
 await page.locator('#ba15Pending:not([hidden])').waitFor({timeout:20000});
 await page.locator('#ba15Builder').getByRole('button',{name:'Mapa C1–C8'}).waitFor();
 const mapHeader=await page.locator('#ba15Builder .mapTable thead th').first().evaluate(e=>getComputedStyle(e).backgroundColor);
 assert.equal(mapHeader,'rgb(18, 57, 92)','Encabezado de matriz debe usar azul oscuro como el original');
 await page.locator('#pciList').getByText('Comunicación · Turno mañana').waitFor();
 await page.locator('#pciList').getByText('Economía y Administración · Turno noche').waitFor();
 assert.equal(state.pcis.length,2,'Crear BA +15 debe agregar un PCI sin borrar Media');
 assert.equal(state.pcis[0].pci_id,initialPcis[0].pci_id,'La orientación histórica debe conservar su ID');
 const constructor=page.locator('#ba15Builder');
 await constructor.locator('.formCard input').first().fill('Laboratorio interdisciplinario · C1');
 await constructor.getByRole('button',{name:'Crear espacio'}).first().click();
 await constructor.getByRole('button',{name:/Guardar BA \+15 online/}).click();
 await page.waitForFunction(()=>document.querySelector('#ba15Builder')?.textContent?.includes('guardado online'),null,{timeout:15000});
 const unitKey=[newId,'oferta','map','mapa-ba15-v1'].join(':');
 const unit=state.units.get(unitKey);
 assert.equal(unit?.revision,1,'Debe guardar revisión inicial en la unidad aislada');
 assert.equal(unit.document.pciId,newId);
 assert.equal(unit.document.niveles.length,4);
 assert.equal(pageConsole.length,0,'No deben ocurrir errores JavaScript sin controlar: '+pageConsole.join(' | '));
 await page.evaluate(()=>{
   document.documentElement.style.scrollBehavior='auto';
   window.scrollTo(0,0);
   const sidebar=document.querySelector('.layout .sidebar');
   if(sidebar)sidebar.scrollTop=0;
 });
 await page.waitForTimeout(250);
 await page.screenshot({path:'test-artifacts/multipci-portal/escuela-muestra-pci-v2.png',fullPage:true});
 await page.screenshot({path:'test-artifacts/multipci-portal/ba15-vista-superior.png',fullPage:false});
 console.log('E2E OK: escuela existente, BA+15 agregado, Media conservada, mapa C1-C8, guardado rev1 por PCI y sin errores JS.');
} finally {
 await browser.close();
 await new Promise(resolveClose=>server.close(resolveClose));
}
