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
 assert.equal(await page.locator('#app').evaluate(el=>el.classList.contains('school-home')),true,'El inicio debe abrir en modo institucional simple');
 assert.equal(await page.locator('.school-offer-card').count(),1,'La escuela debe mostrar una tarjeta de orientación existente');
 await page.locator('#schoolPciCards').getByText('Comunicación').first().waitFor();
 await page.locator('.school-offer-card button[aria-label^="Abrir Mapa de la Oferta"]').click();
 await page.locator('#offerPane:not([hidden])').waitFor({timeout:15000});
 // Atrás y Adelante no deben salir a una escuela diferente ni recargar el PCI.
 await page.waitForFunction(()=>new URL(location.href).searchParams.get('pci')==='00000000-0000-4000-8000-000000000001');
 await page.evaluate(()=>history.back());
 await page.locator('#empty:not([hidden])').waitFor({timeout:15000});
 assert.equal(await page.locator('#school').inputValue(),'1001');
 assert.equal(await page.evaluate(()=>new URL(location.href).searchParams.has('pci')),false);
 await page.evaluate(()=>history.forward());
 await page.locator('#offerPane:not([hidden])').waitFor({timeout:15000});
 assert.equal(await page.evaluate(()=>new URL(location.href).searchParams.get('pci')),'00000000-0000-4000-8000-000000000001');
 await page.locator('#schoolHomeLink').click();
 await page.locator('#empty:not([hidden])').waitFor({timeout:15000});
 assert.equal(await page.evaluate(()=>new URL(location.href).searchParams.has('pci')),false,'Inicio debe volver a la escuela, no reiniciar sesión');
 await page.evaluate(()=>history.back());
 await page.locator('#offerPane:not([hidden])').waitFor({timeout:15000});
 assert.equal(await page.locator('#fgPane').isHidden(),true,'El PCI inicia en Fase 1, no en el desarrollo FG');
 assert.equal(await page.locator('#continueDevelopment').isDisabled(),true,'La Fase 2 no puede iniciar sin mapa completo y guardado');
 assert.equal(await page.locator('[data-tab="fo"]').isDisabled(),true,'El botón Desarrollo FO debe estar deshabilitado por la Fase 1');
 await page.locator('[data-tab="fo"]').evaluate(button=>button.click());
 assert.equal(await page.locator('#offerPane').isVisible(),true,'La ruta directa a FO debe regresar al constructor incompleto');
 assert.equal(await page.locator('#foPane').isHidden(),true,'No se abre desarrollo FO sin Fase 1');
 try{
   await page.locator('#mapBody tr').first().waitFor({timeout:12000});
 }catch(error){
   console.log('MAPA DEBUG',JSON.stringify(await page.evaluate(()=>({
     status:document.querySelector('#status')?.textContent,
     message:document.querySelector('#message')?.textContent,
     offerVisible:!document.querySelector('#offerPane')?.hidden,
     bankExists:!!document.querySelector('#constructorSubjectBank'),
     bankChildren:document.querySelector('#constructorSubjectBank')?.children.length,
     mapRows:document.querySelector('#mapBody')?.children.length,
     loadedScripts:[...document.scripts].map(x=>x.src),
     errorText:document.body.textContent.slice(-1600)
   }))));
   console.log('PAGE ERRORS',JSON.stringify(pageConsole));
   throw error;
 }
 assert.equal(await page.locator('#mapBody tr').count(),14,'El mapa V2 completo debe mostrar FG, FO e integración por formato');
 assert.equal(await page.locator('#schoolAdminTools').count(),0,'El editor escolar no debe permitir altas institucionales');
 await page.selectOption('#constructorLevel','3');
 await page.selectOption('#constructorArea','Ciencias Sociales');
 await page.selectOption('#constructorKind','laboratorio');
 await page.selectOption('#constructorTerm','5');
 await page.fill('#constructorName','Laboratorio FG Ciencias Sociales 3.º');
 await page.locator('#constructorCreate').click();
 assert.equal(await page.locator('#mapBody .constructor-group.propuesta').count(),2,'Los agrupamientos cuatrimestrales tienen espejo en C5 y C6');
 await page.locator('#constructorSubjectBank .constructor-bank-subject').filter({hasText:'Historia'}).first().click();
 await page.locator('#mapBody .constructor-group.propuesta').first().click();
 await page.locator('#mapBody .constructor-group.propuesta').first().getByText('Historia').waitFor();
 // Un borrador pendiente no se descarta con la flecha Atrás si se cancela.
 const beforeCancel=page.url();
 const rejectedBack=new Promise(resolve=>page.once('dialog',async dialog=>{
   assert.match(dialog.message(),/cambios sin guardar/);
   await dialog.dismiss();resolve();
 }));
 await page.evaluate(()=>history.back());
 await rejectedBack;
 await page.waitForTimeout(350);
 assert.equal(page.url(),beforeCancel,'Cancelar Atrás debe conservar el mismo PCI y fase');
 assert.equal(await page.locator('#mapBody .constructor-group.propuesta').count(),2,'El agrupamiento pendiente permanece');
 const geography=page.locator('#constructorSubjectBank .constructor-bank-subject').filter({hasText:'Geografía'}).first();
 const target=page.locator('#mapBody .constructor-group.propuesta').first();
 await geography.scrollIntoViewIfNeeded();
 await target.scrollIntoViewIfNeeded();
 const sourceBox=await geography.boundingBox(),targetBox=await target.boundingBox();
 assert.ok(sourceBox&&targetBox,'La materia y el agrupamiento deben estar visibles para el arrastre.');
 // Mover como un usuario real: no depender del dragTo sintético de Playwright.
 await page.mouse.move(sourceBox.x+sourceBox.width/2,sourceBox.y+sourceBox.height/2);
 await page.mouse.down();
 await page.mouse.move(sourceBox.x+sourceBox.width/2+8,sourceBox.y+sourceBox.height/2+8,{steps:4});
 await page.mouse.move(targetBox.x+targetBox.width/2,targetBox.y+targetBox.height/2,{steps:18});
 await page.mouse.up();
 await page.locator('#mapBody .constructor-group.propuesta').first().getByText('Geografía').waitFor();
 await page.selectOption('#constructorBankType','FO');
 await page.locator('#constructorSubjectBank .constructor-bank-subject').first().waitFor({timeout:15000});
 await page.locator('#constructorSubjectBank .constructor-bank-subject').first()
  .dragTo(page.locator('#mapBody .constructor-group.orientada').first());
 await page.locator('#mapBody .constructor-group.orientada').filter({hasText:'1 materias FO'}).first().waitFor({timeout:15000});
 await page.locator('#saveOffer').click();
 await page.waitForFunction(()=>document.getElementById('offerValidation')?.textContent?.includes('Revisión 1'),null,{timeout:12000});
 const mediaKey=[initialPcis[0].pci_id,'oferta','map','mapa-oferta-v1'].join(':');
 const mediaSaved=state.units.get(mediaKey);
 assert.equal(mediaSaved?.revision,1,'El constructor Media debe guardar en el PCI de su orientación');
 assert.equal(mediaSaved.document.fo.composicionFgV2.groups.length,2,'Los dos espacios cuatrimestrales deben persistirse');
 assert.equal(await page.locator('#continueDevelopment').isDisabled(),true,'Guardar una composición incompleta no habilita el desarrollo');
 assert.deepEqual(state.pcis[0].legacy_state,initialPcis[0].legacy_state,'FG histórica no debe sobrescribirse');
 assert.equal(mediaSaved.document.fo.composicionFgV2.groups[0].members.length,2,'La copia guarda Historia y Geografía');
 assert.ok(mediaSaved.document.fo.spaces.some(s=>(s.members||[]).length>0),'Materia oficial FO asignada a espacio de orientación sin reemplazar FG');
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#app:not([hidden])').waitFor({timeout:25000});
 await page.locator('#offerPane:not([hidden])').waitFor({timeout:25000});
 assert.equal(await page.evaluate(()=>new URL(location.href).searchParams.get('pci')),'00000000-0000-4000-8000-000000000001','Recargar reabre el mismo PCI, no la portada');
 await page.locator('#mapBody .constructor-group.propuesta').first().getByText('Geografía').waitFor({timeout:12000});
 assert.equal(state.units.get(mediaKey)?.revision,1,'La reapertura no crea una revisión ni altera el historial');
 await page.locator('#brandHomeLink').click();
 await page.locator('#empty:not([hidden])').waitFor({timeout:15000});
 assert.equal(await page.locator('#school').inputValue(),'1001','El logo conserva la escuela seleccionada');
 await page.evaluate(()=>history.back());
 await page.locator('#offerPane:not([hidden])').waitFor({timeout:15000});
 await page.screenshot({path:'test-artifacts/multipci-portal/constructor-media-fg-fo-mapa.png',fullPage:false});
 assert.equal(state.pcis.length,1,'Abrir el mapa no crea ni sobrescribe PCI');
 await page.locator('#editor [data-back-to-school]').click();
 await page.locator('#empty:not([hidden])').waitFor();
 assert.equal(await page.locator('.school-offer-card').count(),1,'Al volver se conservan las orientaciones');
 await page.selectOption('#turnFilter','noche');
 await page.locator('#schoolPciCards').getByText(/Este turno no tiene PCI/).waitFor();
 await page.selectOption('#turnFilter','todos');
 assert.equal(await page.locator('.school-offer-card').count(),1,'El filtro de turnos es reversible');
 await page.locator('.school-offer-card').getByText('Comunicación').first().waitFor();
 await page.locator('#btnAddPci').click();
 await page.locator('#formCreatePci:not([hidden])').waitFor();
 await page.selectOption('#pciModel','ba15');
 await page.selectOption('#orientation','economia_administracion');
 await page.selectOption('#pciShift','noche');
 await page.fill('#pciTitleInput','Economía y Administración · Turno noche');
 await page.locator('#formCreatePci button[type=submit]').click();
 await page.locator('#ba15Pending:not([hidden])').waitFor({timeout:20000});
 await page.locator('#ba15Builder').getByRole('button',{name:'1 · Constructor C1–C8'}).waitFor();
 await page.waitForFunction(()=>{
   const e=document.querySelector('#ba15Builder .mapTable thead th');
   return e&&getComputedStyle(e).backgroundColor==='rgb(18, 57, 92)';
 },null,{timeout:12000});
 const mapHeader=await page.evaluate(()=>getComputedStyle(document.querySelector('#ba15Builder .mapTable thead th')).backgroundColor);
 assert.equal(mapHeader,'rgb(18, 57, 92)','Encabezado de matriz debe usar azul oscuro como el original');
 await page.locator('#pciList').getByText('Comunicación · Turno mañana').waitFor();
 await page.locator('#pciList').getByText('Economía y Administración · Turno noche').waitFor();
 assert.equal(state.pcis.length,2,'Crear BA +15 debe agregar un PCI sin borrar Media');
 assert.equal(state.pcis[0].pci_id,initialPcis[0].pci_id,'La orientación histórica debe conservar su ID');
 const constructor=page.locator('#ba15Builder');
 // Fase 1 BA +15: verificar arrastre HTML5 de materia a casillero vacío.
 const baDropped=await page.evaluate(()=>{
  const source=[...document.querySelectorAll('#ba15Builder .ba15Subject[draggable="true"]')]
   .find(x=>x.textContent.includes('Matemática'));
  const target=document.querySelector('#ba15Builder .mapTable tbody tr:first-child td:first-of-type .ba15EmptySlot');
  if(!source||!target)return {ok:false,reason:'falta origen o destino',
   sourcePresent:!!source,targetPresent:!!target,
   cards:[...document.querySelectorAll('#ba15Builder .ba15Subject')].map(x=>({
    name:x.textContent.slice(0,60),draggable:x.draggable})).slice(0,5),
   slots:[...document.querySelectorAll('#ba15Builder .mapTable tbody tr:first-child td:first-of-type button')]
    .map(x=>({text:x.textContent,className:x.className})).slice(0,5),
   visibleText:document.querySelector('#ba15Builder')?.textContent?.slice(0,450)};
  const transfer=new DataTransfer();
  source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:transfer}));
  target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer}));
  target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
  return {ok:[...document.querySelectorAll('#ba15Builder .mapTable tbody tr:first-child td:first-of-type .slot')]
   .some(x=>x.textContent.includes('Matemática'))};
 });
 assert.equal(baDropped.ok,true,'BA +15 debe aceptar el drop de Matemática en Troncal C1: '+JSON.stringify(baDropped));
 assert.equal(state.pcis.length,2,'Arrastrar en BA +15 no puede crear ni borrar otros PCI');
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
 await page.locator('#ba15Pending [data-back-to-school]').click();
 await page.locator('#empty:not([hidden])').waitFor();
 assert.equal(await page.locator('.school-offer-card').count(),2,'La escuela conserva Media y suma BA+15 en otra tarjeta');
 await page.screenshot({path:'test-artifacts/multipci-portal/escuela-media-y-ba15.png',fullPage:true});
 const baCard=page.locator('.school-offer-card').filter({hasText:'Economía y Administración'});
 await baCard.getByRole('button',{name:/Abrir Desarrollo Curricular/}).click();
 const baPlanButton=page.locator('#ba15Builder').getByRole('button',{name:'2 · Desarrollo curricular',exact:true});
 await baPlanButton.waitFor();
 assert.equal(await baPlanButton.isDisabled(),true,'BA +15 no puede abrir planes con materias sin asignar');
 assert.equal(await page.locator('#ba15Builder').getByRole('button',{name:'1 · Constructor C1–C8'}).isEnabled(),true);
 assert.match(await page.locator('#ba15Builder .pci-phase-state').textContent(),/Fase 1 pendiente/);
 assert.equal(state.pcis.length,2,'La navegación no debe borrar ningún PCI');
 assert.equal(state.units.get(unitKey)?.revision,1,'La navegación no modifica el guardado online');
 assert.equal(pageConsole.length,0,'La nueva navegación no debe generar errores JavaScript: '+pageConsole.join(' | '));
 // Escenario de Fase 2: mapa completo sintético ya guardado en revisión 2.
 // No se conecta ni escribe en Supabase real.
 let complete=crearBorradorBa15({schoolId:1001,pciId:newId,
  orientationId:'economia_administracion',shiftId:'noche'});
 for(let level=1;level<=4;level++)for(const term of [level*2-1,level*2]){
  const groups=new Map();
  for(const subject of complete.niveles[level-1].asignaturas){
   const format=['troncal','taller','orientado'].includes(subject.formatoOriginal)?
    subject.formatoOriginal:'laboratorio';
   const label=format==='troncal'?subject.id:format+':'+subject.area;
   if(!groups.has(label)){
    complete=crearEspacioBa15(complete,{nivel:level,term,
     nombre:subject.nombre+' · C'+term,formato:format});
    groups.set(label,complete.niveles[level-1].espacios.at(-1).id);
   }
   complete=asignarMateriaBa15(complete,{nivel:level,
    espacioId:groups.get(label),materiaId:subject.id});
  }
  for(const id of groups.values())complete=actualizarEspacioBa15(complete,{
   nivel:level,espacioId:id,changes:{articulacion:'Articulación institucional documentada'}
  });
 }
 const completeAudit=validarBorradorBa15(complete);
 assert.deepEqual(completeAudit.errores,[]);
 assert.deepEqual(completeAudit.advertencias,[]);
 const savedMedia=structuredClone(state.units.get(mediaKey));
 state.units.set(unitKey,{exists:true,revision:2,
  base_version:'oferta-ba15-constructor-v1',document:complete});
 await page.locator('#ba15Pending [data-back-to-school]').click();
 await page.locator('#empty:not([hidden])').waitFor();
 const launchBa=()=>page.locator('.school-offer-card')
  .filter({hasText:'Economía y Administración'})
  .getByRole('button',{name:/Abrir Desarrollo Curricular/}).click();
 await launchBa();
 await page.locator('#ba15Development:not([hidden])').waitFor({timeout:15000});
 assert.equal(await page.locator('#ba15Builder').isHidden(),true);
 await page.locator('#ba15Development .ba15Space').first().locator('button').first().click();
 const objectives=page.locator('#ba15Development label').filter({hasText:'Objetivos'}).first().locator('textarea');
 await objectives.fill('Objetivo nuevo del plan 1 - escenario de prueba');
 await objectives.dispatchEvent('change');
 await page.locator('#ba15Development').getByRole('button',{name:/Guardar BA \+15 online/}).click();
 await page.waitForFunction(()=>document.getElementById('ba15Development')?.textContent?.includes('guardado online'),null,{timeout:15000});
 assert.equal(state.units.get(unitKey)?.revision,3);
 assert.equal(state.units.get(unitKey).document.niveles[0].espacios[0].planes[0].objetivos,
  'Objetivo nuevo del plan 1 - escenario de prueba');
 assert.deepEqual(state.units.get(mediaKey),savedMedia,'El PCI de Media no cambia');
 await page.screenshot({path:'test-artifacts/multipci-portal/ba15-fase2-planes-reales.png',fullPage:true});
 await page.locator('#ba15Pending [data-back-to-school]').click();
 await page.locator('#empty:not([hidden])').waitFor();
 await launchBa();
 await page.locator('#ba15Development:not([hidden])').waitFor({timeout:15000});
 await page.locator('#ba15Development .ba15Space').first().locator('button').first().click();
 assert.equal(await page.locator('#ba15Development label').filter({hasText:'Objetivos'}).first().locator('textarea').inputValue(),
  'Objetivo nuevo del plan 1 - escenario de prueba');
 assert.deepEqual(pageConsole,[],'Fase 2 no presenta errores JavaScript');
 console.log('E2E BA+15 FASE 2 OK: composición completa guardada, cuatro planes, persistencia de objetivos y PCI Media intacto.');

 console.log('E2E OK: escuela Media+BA15, mapa y desarrollo desde tarjetas, retorno, filtros, guardado rev1 por PCI y sin errores JS.');

 // Caso real: abrir el enlace del portal en una pestaña SIN sessionStorage
 // y regresar automáticamente a Organización curricular después del login existente.
 const authPage=await browser.newPage({viewport:{width:1366,height:850}});
 const authErrors=[];
 authPage.on('pageerror',e=>authErrors.push(e.message));
 await authPage.route('https://agmebsotbuurbnldxewf.supabase.co/functions/v1/pci-access',async route=>{
   const body=JSON.parse(route.request().postData()||'{}');
   let value={},status=200;
   if(body.action==='public-catalog')
     value={schools:[{school_id:1001,name:'Escuela N.º 99 · Prueba automatizada',cue:'DEMO-001',model:'comun'}]};
   else if(body.action==='school-login')
     value={role:'editor',school_id:1001,identity:{first_name:'Equipo',last_name:'Prueba',email:'prueba@escuela.example'},token:'e2e-fake-session'};
   else if(body.action==='admin-login')
     value={role:'admin',user:'admin',token:'e2e-fake-session',permissions:['pci.view','pci.edit'],all_schools:true};
   else {status=404;value={error:'Acción fuera del escenario de acceso: '+body.action}}
   await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(value)});
 });
 await authPage.route('https://agmebsotbuurbnldxewf.supabase.co/functions/v1/pci-multipci',async route=>{
   const body=JSON.parse(route.request().postData()||'{}'),action=body.action;
   let value={},status=200;
   if(action==='session-info')value={role:'editor',school_id:1001,permissions:['pci.view','pci.edit'],identity:{first_name:'Equipo',last_name:'Prueba'}};
   else if(action==='list-school-pcis')value={pcis:initialPcis};
   else if(action==='get-school-pci')value={pci:initialPcis[0]};
   else {status=404;value={error:'Acción fuera del escenario de acceso: '+action}}
   await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(value)});
 });
 await authPage.goto('http://127.0.0.1:'+port+'/pci-orientaciones.html',{waitUntil:'domcontentloaded'});
 await authPage.locator('#authRequired:not([hidden])').waitFor();
 assert.equal(await authPage.locator('#status').textContent(),'Ingresá para continuar');
 await authPage.screenshot({path:'test-artifacts/multipci-portal/ingreso-sesion-requerida.png',fullPage:true});
 await authPage.locator('#authLoginLink').click();
 await authPage.waitForURL('**/index.html?continuar=pci');
 await authPage.locator('#schoolSearch').fill('Escuela');
 await authPage.locator('#schoolResults button').first().click();
 await authPage.locator('#schoolCode').fill('PCI-1234');
 await authPage.locator('#firstName').fill('Equipo');
 await authPage.locator('#lastName').fill('Prueba');
 await authPage.locator('#email').fill('prueba@escuela.example');
 await authPage.locator('#schoolSubmit').click();
 await authPage.waitForURL('**/pci-orientaciones.html?school=1001&nuevo=1');
 await authPage.locator('#app:not([hidden])').waitFor({timeout:25000});
 await authPage.locator('.school-offer-card').first().waitFor({timeout:15000});
 assert.equal(await authPage.locator('.school-offer-card').count(),1,'Login debe regresar a la escuela sin borrar los PCI');
 assert.equal(await authPage.evaluate(()=>JSON.parse(sessionStorage.getItem('pci_access_session')||'{}').role),'editor');
 await authPage.screenshot({path:'test-artifacts/multipci-portal/ingreso-escuela-recuperado.png',fullPage:true});
 assert.deepEqual(authErrors,[],'El flujo de autenticación no debe generar errores JS');
 console.log('E2E LOGIN OK: acceso sin sesión → login institucional → vuelta automática a la misma escuela y sus PCI.');

 // Desde Panel de control, «Organización curricular» debe abrir el módulo
 // nuevo de esa misma escuela. Conservar el enlace histórico «FG existente».
 const adminCatalog=[{
   school_id:1001,name:'Escuela N.º 99 · Prueba automatizada',cue:'DEMO-001',
   model:'comun',progress:{edited_spaces:3,total_spaces:10,assigned_contents:5},
   audit:{participant_count:1,total_events:0}
 }];
 const panelPage=await browser.newPage({viewport:{width:1440,height:900}});
 const panelErrors=[];
 panelPage.on('pageerror',e=>panelErrors.push(e.message));
 await panelPage.addInitScript(()=>{
   sessionStorage.setItem('pci_admin_monitor_session',JSON.stringify({
     role:'admin',token:'e2e-admin-panel',permissions:['pci.view','pci.edit','institutional.view','audit.view'],all_schools:true
   }));
   // Simula una pestaña con sesión previa de otra escuela: no puede prevalecer.
   sessionStorage.setItem('pci_access_session',JSON.stringify({role:'editor',school_id:1002,token:'e2e-otro-editor'}));
 });
 await panelPage.route('https://agmebsotbuurbnldxewf.supabase.co/functions/v1/pci-access',async route=>{
   const body=JSON.parse(route.request().postData()||'{}');
   if(body.token&&body.token!=='e2e-admin-panel')
     throw Error('El panel usa un token no autorizado');
   let value;
   if(body.action==='session-info')value={role:'admin',permissions:['pci.view','pci.edit','institutional.view','audit.view'],all_schools:true,school_ids:[]};
   else if(body.action==='list-schools')value={schools:adminCatalog};
   else if(body.action==='get-school-dashboard')value={
     school:{school_id:1001,name:'Escuela N.º 99 · Prueba automatizada',cue:'DEMO-001',model:'comun',
       edit_code:'PCI-0000',primary_code:'DIR-DEMO'},progress:{edited_spaces:3,total_spaces:10,assigned_contents:5},
     audit:{participant_count:1,total_events:0}};
   else if(body.action==='get-audit')value={events:[]};
   else if(body.action==='public-catalog')value={schools:[{school_id:1001,name:'Escuela N.º 99 · Prueba automatizada',cue:'DEMO-001'}]};
   else throw Error('Acción no simulada para panel administrativo: '+body.action);
   await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(value)});
 });
 await panelPage.route('https://agmebsotbuurbnldxewf.supabase.co/functions/v1/pci-multipci',async route=>{
   const body=JSON.parse(route.request().postData()||'{}');
   if(body.token!=='e2e-admin-panel'){
     await route.fulfill({status:401,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},
       body:JSON.stringify({error:'Sesión de otro editor, no permitida'})});
     return;
   }
   let data;
   if(body.action==='session-info')data={role:'admin',permissions:['pci.view','pci.edit'],all_schools:true,school_ids:[]};
   else if(body.action==='list-schools')data={schools:adminCatalog};
   else if(body.action==='create-school-v2'){
     if(adminCatalog.some(s=>s.cue===body.cue)){status=409;data={error:'El CUE ya existe'};}
     else{
       const id=1002;
       adminCatalog.push({school_id:id,name:body.name,cue:body.cue,model:'comun',progress:{total_spaces:0,edited_spaces:0,assigned_contents:0},audit:{}});
       data={ok:true,school_id:id,name:body.name,edit_code:'PCI-9988',primary_code:'DIR-00AABBCC'};
     }
   }
   else if(body.action==='list-school-pcis')data={pcis:initialPcis};
   else if(body.action==='get-school-legacy-links')data={source_updated_at:'2026-11-19T17:00:00Z',source_model:'comun',rows:[],document:null,revision:0,exists:false};
   else throw Error('Acción no simulada para portal desde panel: '+body.action);
   await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)});
 });
 await panelPage.goto('http://127.0.0.1:'+port+'/panel-general.html',{waitUntil:'domcontentloaded'});
 const dashboardOrg=panelPage.locator('#rows a[href*="school=1001"]').filter({hasText:'Organización curricular'}).first();
 await dashboardOrg.waitFor({timeout:20000});
 // Solo superadmin puede crear escuelas; el alta queda en la API oficial
 // y no en un formulario dentro de la pantalla curricular de una escuela.
 await panelPage.locator('#manageSchoolsBtn').click();
 await panelPage.locator('#manageSchoolsDialog[open]').waitFor();
 await panelPage.locator('#schoolDbStatus').getByText(/Supabase conectado/).waitFor();
 await panelPage.locator('#newSchoolName').fill('Colegio de prueba');
 await panelPage.locator('#newSchoolCue').fill('DEMO-001');
 await panelPage.locator('#newSchoolSubmit').click();
 await panelPage.locator('#schoolCreateStatus').getByText(/ya pertenece/).waitFor();
 assert.equal(adminCatalog.length,1,'Un CUE duplicado no crea ni sobrescribe escuelas');
 await panelPage.locator('#newSchoolCue').fill('CUE-Z99');
 panelPage.once('dialog',dialog=>dialog.accept());
 await panelPage.locator('#newSchoolSubmit').click();
 await panelPage.locator('#schoolDbCreated:not(.hidden)').waitFor({timeout:15000});
 assert.equal(await panelPage.locator('#schoolDbEditCode').textContent(),'PCI-9988');
 assert.match(await panelPage.locator('#schoolDbOpenPci').getAttribute('href'),/school=1002/);
 assert.equal(adminCatalog.length,2,'La escuela debe crearse en el catálogo de Supabase');
 await panelPage.locator('#manageSchoolsClose').click();
 await panelPage.locator('#rows tr').filter({hasText:'Colegio de prueba'}).waitFor({timeout:15000});
 assert.equal(adminCatalog[0].school_id,1001,'No se reescribe la escuela anterior');
 await panelPage.screenshot({path:'test-artifacts/multipci-portal/panel-admin-alta-escuela.png',fullPage:true});
 assert.match(await dashboardOrg.getAttribute('href'),/pci-orientaciones\.html\?school=1001&from=panel-general/);
 assert.match(await panelPage.locator('#rows a').filter({hasText:'FG existente'}).first().getAttribute('href'),
   /escuela-online\.html\?school=1001/,'FG histórica debe permanecer accesible');
 await dashboardOrg.click();
 await panelPage.waitForURL('**/pci-orientaciones.html?school=1001&from=panel-general');
 await panelPage.locator('#app:not([hidden])').waitFor({timeout:25000});
 await panelPage.locator('.school-offer-card').first().waitFor({timeout:20000});
 assert.equal(await panelPage.locator('.school-offer-card').count(),1,'El panel lleva a la orientación de su escuela');
 assert.equal(await panelPage.locator('#school').inputValue(),'1001');

 // El botón del Panel institucional también debe conducir al nuevo portal.
 await panelPage.goto('http://127.0.0.1:'+port+'/panel-escuela.html?school=1001&admin=1',
   {waitUntil:'domcontentloaded'});
 const institutionalOrg=panelPage.locator('#openPci');
 await institutionalOrg.waitFor({state:'visible',timeout:25000});
 assert.match(await institutionalOrg.getAttribute('href'),/pci-orientaciones\.html\?school=1001&from=panel-general/);
 assert.match(await panelPage.locator('#openLegacyPci').getAttribute('href'),/escuela-online\.html\?school=1001/);
 await institutionalOrg.click();
 await panelPage.waitForURL('**/pci-orientaciones.html?school=1001&from=panel-general');
 await panelPage.locator('#app:not([hidden])').waitFor({timeout:25000});
 await panelPage.locator('.school-offer-card').first().waitFor({timeout:20000});
 assert.equal(await panelPage.locator('.school-offer-card').count(),1);
 assert.deepEqual(panelErrors,[],'Los paneles no deben generar errores JS');
 assert.equal(state.pcis[0].pci_id,initialPcis[0].pci_id,'Navegar desde paneles no modifica PCI');
 console.log('E2E PANEL OK: Panel general y Panel institucional → Organización curricular; FG histórica disponible.');

 // La consola histórica index.html también ofrece ambas rutas.
 const originalIndex=await readFile(resolve(root,'index.html'),'utf8');
 assert.match(originalIndex,/<a class="btn" href="\$\{organizationUrl\(s\)\}">Organización curricular<\/a>/);
 assert.match(originalIndex,/<a class="btn" href="\$\{schoolUrl\(s\)\}">FG existente<\/a>/);


} finally {
 await browser.close();
 await new Promise(resolveClose=>server.close(resolveClose));
}
