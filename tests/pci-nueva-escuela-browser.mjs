import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,relative,extname,sep} from 'node:path';
import {chromium} from 'playwright';

const root=process.cwd(),schoolId=1235,pciId='10000000-0000-4000-8000-000000001235';
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url||'/', 'http://localhost');
  const path=resolve(root,'.'+decodeURIComponent(url.pathname));
  const rel=relative(root,path);
  if(rel==='..'||rel.startsWith('..'+sep))throw Error('Fuera de raíz');
  const data=await readFile(path);
  res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});res.end(data);
 }catch(e){res.writeHead(404);res.end(String(e?.message||e))}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(process.env.CHROME_BIN?{headless:true,executablePath:process.env.CHROME_BIN}:{headless:true});
const oldData={schemaVersion:2,schoolName:'Prueba',_meta:{origin:'alta_admin_multipci',cue:'0000000000000000'},areas:{
 'Lengua y Literatura':{groups:[{id:'lengua-trunk-1',name:'Nivel 1',level:1,startTerm:1,endTerm:2,kind:'trunk',items:[],plansBimestrales:[]}]},
 'Matemática':{groups:[{id:'math-trunk-1',name:'Nivel 1',level:1,startTerm:1,endTerm:2,kind:'trunk',items:[],plansBimestrales:[]}]}
},current:null,profile:null};
let pcis=[],saveLegacy=0,created=0,originalSnapshot=JSON.stringify(oldData),lastCreate=null;
const pageErrors=[];
const fulfill=(route,obj,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'},body:JSON.stringify(obj)});
async function accessRoute(route){
 if(route.request().method()==='OPTIONS')return fulfill(route,{},204);
 const body=JSON.parse(route.request().postData()||'{}');
 const action=body.action;
 if(action==='public-catalog')return fulfill(route,{schools:[{school_id:schoolId,name:'Prueba',cue:'0000000000000000',model:'comun'}]});
 if(action==='school-login')return fulfill(route,{role:'editor',school_id:schoolId,name:'Prueba',token:'editor-test',identity:{first_name:'Equipo',last_name:'Prueba',email:'demo@escuela.example'}});
 if(action==='get-state')return fulfill(route,{data:structuredClone(oldData)});
 if(action==='save-state'){saveLegacy++;return fulfill(route,{ok:true})}
 return fulfill(route,{error:'Acción inesperada de acceso: '+action},404);
}
async function multiRoute(route){
 if(route.request().method()==='OPTIONS')return fulfill(route,{},204);
 const body=JSON.parse(route.request().postData()||'{}');
 const token=body.token,role=token==='referente-test'?'school_admin':'editor';
 const sid=Number(body.school_id),action=body.action;
 if(!['editor-test','referente-test'].includes(token))return fulfill(route,{error:'Token inválido'},401);
 if(action==='session-info')return fulfill(route,{role,school_id:schoolId,name:'Prueba',permissions:[],identity:{}});
 if(sid!==schoolId)return fulfill(route,{error:'Fuera del alcance escolar'},403);
 if(action==='list-school-pcis')return fulfill(route,{pcis:structuredClone(pcis)});
 if(action==='create-school-pci'){
  created++;lastCreate=structuredClone(body);
  if(!['comun','tecnica','ba15'].includes(body.model)||!body.orientation_id||!body.title||!body.shift_id)
   return fulfill(route,{error:'Modelo u orientación inválidos'},400);
  if(pcis.some(p=>p.model===body.model&&p.orientation_id===body.orientation_id&&p.shift_id===body.shift_id))
   return fulfill(route,{error:'PCI duplicado'},409);
  const p={pci_id:created===1?pciId:'10000000-0000-4000-8000-000000001236',school_id:schoolId,
   orientation_id:body.orientation_id,process_id:'process'+created,title:body.title,
   model:body.model,shift_id:body.shift_id,status:'borrador',specialty_name:null,legacy_sha256:'a'.repeat(64),
   legacy_state:structuredClone(oldData)};
  pcis.push(p);
  return fulfill(route,{ok:true,pci_id:p.pci_id},201);
 }
 if(action==='get-school-pci')return fulfill(route,{pci:pcis.find(p=>p.pci_id===body.pci_id)});
 if(action==='get-school-pci-unit')return fulfill(route,{exists:false,revision:0});
 if(action==='save-school-pci-unit')return fulfill(route,role==='school_admin'?{error:'Sin permiso de edición.'}:{ok:true,revision:1},role==='school_admin'?403:200);
 return fulfill(route,{error:'Acción nueva inesperada: '+action},404);
}
const routes=async page=>{
 page.on('pageerror',e=>pageErrors.push(e.message));
 await page.route('https://agmebsotbuurbnldxewf.supabase.co/functions/v1/pci-access',accessRoute);
 await page.route('https://agmebsotbuurbnldxewf.supabase.co/functions/v1/pci-multipci',multiRoute);
};
try{
 // Camino 1: ingreso con clave de edición desde index -> selector -> primer PCI.
 const editor=await browser.newPage({viewport:{width:1366,height:900}});
 await routes(editor);
 await editor.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
 await editor.locator('#schoolSearch').fill('Prueba');
 await editor.locator('#schoolResults').getByText('Prueba',{exact:true}).first().waitFor({timeout:15000});
 await editor.locator('#schoolResults button').first().click();
 await editor.locator('#schoolCode').fill('PCI-TEST');
 await editor.locator('#firstName').fill('Equipo');
 await editor.locator('#lastName').fill('Prueba');
 await editor.locator('#email').fill('demo@escuela.example');
 await editor.locator('#schoolSubmit').click();
 await editor.waitForURL('**/pci-orientaciones.html?school=1235&nuevo=1',{timeout:12000});
 await editor.locator('#formCreatePci:not([hidden])').waitFor({timeout:25000});
 await editor.locator('#schoolPciCards').getByText('Esta escuela todavía no tiene un PCI').waitFor();
 assert.equal(await editor.locator('#btnAddPci').isEnabled(),true,'La escuela debe poder crear un primer PCI');
 await editor.selectOption('#pciModel','comun');
 await editor.selectOption('#orientation','economia_administracion');
 await editor.selectOption('#pciShift','manana');
 await editor.locator('#formCreatePci button[type="submit"]').click();
 await editor.locator('#offerPane:not([hidden])').waitFor({timeout:25000});
 await editor.waitForFunction(()=>document.querySelector('#mapBody')?.children.length===14,null,{timeout:20000});
 assert.equal(created,1,'Debe persistirse un primer PCI');
 assert.deepEqual([lastCreate.school_id,lastCreate.model,lastCreate.shift_id,lastCreate.orientation_id],
   [schoolId,'comun','manana','economia_administracion']);
 assert.equal(pcis.length,1);
 assert.equal(JSON.stringify(oldData),originalSnapshot,'La FG histórica no se modifica al crear un PCI');
 assert.equal(saveLegacy,0,'La creación no debe escribir la matriz FG vieja');
 await editor.screenshot({path:'test-artifacts/multipci-portal/prueba-primer-pci-constructor.png',fullPage:false});
 // Camino 2: un referente puede INFORMAR la oferta, sin permiso para editar el desarrollo.
 const referente=await browser.newPage({viewport:{width:1366,height:900}});
 await routes(referente);
 await referente.addInitScript(()=>{
  sessionStorage.setItem('pci_school_admin_session',JSON.stringify({token:'referente-test',role:'school_admin',school_id:1235,name:'Prueba'}));
 });
 await referente.goto(origin+'/pci-orientaciones.html?school=1235&from=panel-escuela',{waitUntil:'domcontentloaded'});
 await referente.locator('#app:not([hidden])').waitFor({timeout:25000});
 assert.equal(await referente.locator('#btnAddPci').isEnabled(),true,'El referente institucional puede informar orientaciones');
 await referente.locator('#btnAddPci').click();
 await referente.selectOption('#pciModel','comun');
 await referente.selectOption('#orientation','comunicacion');
 await referente.selectOption('#pciShift','tarde');
 await referente.locator('#formCreatePci button[type="submit"]').click();
 await referente.locator('#offerPane:not([hidden])').waitFor({timeout:25000});
 assert.equal(created,2,'El referente debe crear un PCI dentro de su propia escuela');
 assert.equal(pcis.length,2,'Debe conservarse el PCI anterior');
 assert.equal(await referente.locator('#saveOffer').isDisabled(),true,'El referente no puede editar contenidos del PCI');
 assert.equal(saveLegacy,0,'El referente no debe escribir FG histórica');
 await referente.screenshot({path:'test-artifacts/multipci-portal/prueba-referente-declara-orientacion.png',fullPage:false});
 // Camino 3: el enlace al editor viejo redirige una escuela nueva, sin guardarla.
 const wrapper=await browser.newPage({viewport:{width:1000,height:780}});
 await routes(wrapper);
 await wrapper.addInitScript(()=>{
  sessionStorage.setItem('pci_access_session',JSON.stringify({token:'editor-test',role:'editor',school_id:1235,name:'Prueba'}));
 });
 await wrapper.goto(origin+'/escuela-online.html?school=1235&name=Prueba',{waitUntil:'domcontentloaded'});
 await wrapper.waitForURL('**/pci-orientaciones.html?school=1235&nuevo=1',{timeout:25000});
 assert.equal(saveLegacy,0,'El wrapper no debe reescribir la FG ni crear versiones nuevas');
 assert.deepEqual(pageErrors,[],'El recorrido completo no debe generar errores JS: '+pageErrors.join(' | '));
 console.log('E2E OK: escuela nueva -> PCI constructor -> desarrollo posterior; referente declara orientación; FG protegida.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
