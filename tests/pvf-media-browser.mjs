/**
 * PVF de Media sobre la distribución publicada real. Sólo se ejecuta en CI.
 * Escuelas, credenciales y documentos simulados; toda red externa interceptada.
 * Las ediciones se realizan en borradores locales mediante los controles V2.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {resolve,join,relative,sep,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

assert.equal(process.env.CI,'true','Esta prueba de navegador se ejecuta exclusivamente en CI.');
const {chromium}=await import('playwright');
const root=process.cwd();
const artifacts=resolve(process.env.PCI_NATIVE_ARTIFACTS||'test-artifacts/aplicacion-v2-integrada','pvf');
await mkdir(artifacts,{recursive:true});
const temporary=await mkdtemp(join(tmpdir(),'pci-pvf-ci-'));
const distribution=join(temporary,'publicado');
const SLOT='proyecto-n5';
const cellSelector='#matrix .drop[data-slot="'+SLOT+'"]';
const groupSelector='#v28groups [data-g="'+SLOT+'"]';
const simulatedToken='token-escolar-exclusivo-pvf-ci';
const school={school_id:1720,name:'Escuela simulada · PVF de Media',cue:'SIM-PVF-1720',model:'comun'};
const legacy={areas:{}};
const cases=[
  {id:'economia_administracion',name:'Economía y Administración',compatible:true,
    A:{subjectId:'fo-economia-y-administracion-5-1',name:'Proyecto Organizacional',hours:3},
    B:{subjectId:'fo-economia-y-administracion-5-1',name:'Proyecto Organizacional',hours:3}},
  {id:'literatura',name:'Literatura',compatible:false,
    A:{subjectId:'fo-literatura-5-0',name:'Proyecto de Mediación y/o Promoción de la Lectura y la Escritura',hours:3},
    B:{subjectId:'fo-literatura-5-1',name:'Proyecto de Mediación de la Lectura y la Escritura',hours:4}},
  {id:'arte_teatro',name:'Arte - Teatro',compatible:false,
    A:{subjectId:'fo-arte-teatro-5-2',name:'Producción en artes escénicas y gestión cultural',hours:4},
    B:{subjectId:'fo-arte-teatro-5-2',name:'Producción teatral y gestión cultural',hours:3}}
];
const pciFor=scenario=>({pci_id:'17171717-1111-4111-8111-000000000020',school_id:school.school_id,model:'comun',
  orientation_id:scenario.id,shift_id:'manana',title:'PCI simulado · PVF · '+scenario.name,
  status:'borrador',process_id:'proceso-simulado-pvf-2026',legacy_state:legacy,
  legacy_sha256:createHash('sha256').update(JSON.stringify(legacy)).digest('hex')});
const fixturesBefore=JSON.stringify({school,legacy,cases});
const report={fecha:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  alcance:'Paquete real; tres orientaciones de Media; escritorio y celular; ninguna conexión externa real.',
  casos:[],acciones:[],solicitudesExternas:[],externosBloqueados:[],capturas:[],fallos:[]};
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript',
  '.json':'application/json','.txt':'text/plain','.csv':'text/csv','.svg':'image/svg+xml',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
let origin='',server,browser;

async function installMocks(page,record,pci){
  page.on('pageerror',error=>record.errores.push(error.message));
  page.on('response',response=>{
    if(response.url().startsWith(origin)&&response.status()>=400)
      record.recursosFallidos.push({url:response.url(),status:response.status()});
  });
  page.on('dialog',dialog=>{
    record.dialogos.push({tipo:dialog.type(),mensaje:dialog.message()});void dialog.dismiss();
  });
  await page.addInitScript(()=>{
    window.__pvfCi={iniciosAcceso:0,borradores:[]};
    addEventListener('pci-access-changed',()=>{
      if(/\bat start\s*\(/.test(new Error().stack||''))window.__pvfCi.iniciosAcceso++;
    });
    addEventListener('pci-borrador-local',event=>window.__pvfCi.borradores.push(event.detail));
  });
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===origin)return route.continue();
    const remote={caso:record.id,host:url.hostname,path:url.pathname,method:request.method()};
    report.solicitudesExternas.push(remote);
    if(['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname)){
      remote.resolucion='respuesta local vacía';
      return route.fulfill({status:200,contentType:'text/css',body:''});
    }
    if(!/supabase/i.test(url.hostname)){
      remote.resolucion='bloqueada';report.externosBloqueados.push(remote);
      return route.abort('blockedbyclient');
    }
    remote.resolucion='API simulada';
    let data;try{data=request.postDataJSON();}catch{data=null;}
    // No registrar contraseñas, tokens ni cuerpos de las solicitudes.
    const log={caso:record.id,endpoint:url.pathname,action:data?.action,school_id:data?.school_id,pci_id:data?.pci_id};
    report.acciones.push(log);
    const send=(body,status=200)=>{
      log.status=status;return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    };
    if(request.method()!=='POST'||!data)return send({error:'Solicitud simulada inválida.'},400);
    if(url.pathname==='/functions/v1/pci-access'){
      if(data.action==='public-catalog')return send({schools:[school]});
      if(data.action==='school-login'&&Number(data.school_id)===school.school_id&&data.code==='PCI-TEST')
        return send({token:simulatedToken,role:'editor',school_id:school.school_id,name:school.name,cue:school.cue,
          model:school.model,identity:{first_name:data.first_name,last_name:data.last_name,email:data.email}});
    }
    if(url.pathname==='/functions/v1/pci-multipci'&&data.token===simulatedToken){
      if(data.action==='session-info')return send({role:'editor',permissions:[],school_ids:[],all_schools:false});
      if(Number(data.school_id)===school.school_id){
        if(data.action==='list-school-pcis'){
          const {legacy_state,...metadata}=pci;return send({pcis:[metadata]});
        }
        if(data.action==='get-school-legacy-links')
          return send({exists:false,revision:0,document:null,rows:[],source_model:'comun',source_updated_at:'2026-11-21T12:00:00.000Z'});
        if(data.pci_id===pci.pci_id&&data.action==='get-school-pci')return send({pci});
        if(data.pci_id===pci.pci_id&&data.action==='get-school-pci-unit')
          return send({error:'Unidad y modalidad incompatibles.'},400);
      }
    }
    record.accionesInesperadas.push(log);
    return send({error:'Operación no autorizada en esta simulación.'},403);
  });
}

async function settle(page){
  await page.evaluate(()=>new Promise((done,reject)=>{
    let previous='',stable=0;const started=performance.now();
    const tick=()=>{
      const shell=document.querySelector('#v38shell'),r=shell?.getBoundingClientRect();
      const current=JSON.stringify([scrollX,scrollY,visualViewport?.offsetLeft,visualViewport?.offsetTop,r?.top,shell?.scrollTop]);
      stable=current===previous?stable+1:0;previous=current;
      if(stable>=4)return done();
      if(performance.now()-started>5000)return reject(Error('La vista no se estabilizó.'));
      requestAnimationFrame(tick);
    };requestAnimationFrame(tick);
  }));
}
async function capture(page,record,name,locator=null){
  await settle(page);
  const file=record.id+'-'+name+'.png';
  if(locator)await locator.screenshot({path:join(artifacts,file)});
  else await page.screenshot({path:join(artifacts,file),fullPage:false});
  report.capturas.push(file);
}
const snapshot=page=>page.evaluate(()=>PCIAplicacionV2.snapshot());
const activeMap=async page=>{const state=await snapshot(page);return state.maps[state.active];};

async function initialEnvelope(page,scenario,pci,{requireSaveEvent=false}={}){
  const key='pci-aplicacion-v2-borrador/1::'+[school.school_id,pci.pci_id,pci.model,
    pci.orientation_id,pci.shift_id,pci.process_id,pci.legacy_sha256]
    .map(value=>encodeURIComponent(String(value))).join('::');
  const saved=await page.evaluate(key=>({raw:localStorage.getItem(key),events:window.__pvfCi.borradores}),key);
  assert.ok(saved.raw,'El sobre del borrador local existe antes de la primera edición.');
  const document=JSON.parse(saved.raw);
  assert.equal(document.borradorVersion,'pci-aplicacion-v2-borrador/1');
  assert.equal(document.schema,'v2-original-embedded-v1');
  assert.equal(document.schoolId,school.school_id);assert.equal(document.pciId,pci.pci_id);
  assert.equal(document.orientationId,scenario.id);assert.equal(document.shiftId,pci.shift_id);
  assert.equal(document.model,'comun');assert.equal(document.processId,pci.process_id);
  assert.equal(document.legacySha256,pci.legacy_sha256);assert.equal(document.revisionRemota,0);
  assert.ok(Number.isFinite(Date.parse(document.fecha)));
  const map=document.v2.maps[scenario.name];
  assert.deepEqual(map.placements[SLOT],[scenario.A.subjectId],'El sobre inicial contiene el PVF prearmado.');
  for(const field of ['subjectId','name','hours'])assert.equal(map.pvfMedia[field],scenario.A[field]);
  assert.equal(map.pvfMedia.alternative,'A');
  if(requireSaveEvent){
    assert.equal(await page.locator('#pciV2DraftStatus').innerText(),'Borrador guardado en este navegador');
    assert.ok(saved.events.some(event=>event.pciId===pci.pci_id&&event.guardado===true),
      'La aplicación confirma un guardado real del borrador inicial.');
  }
  return {fecha:document.fecha,prescripcion:map.pvfMedia,guardadosConfirmados:saved.events.length};
}

async function ready(page){
  await page.waitForFunction(()=>document.body.dataset.pciV2Ready==='true',null,{timeout:45000});
  await page.waitForFunction(()=>window.__pvfCi.iniciosAcceso>=2,null,{timeout:15000});
  assert.equal(await page.locator('iframe').count(),0);
  assert.equal(page.frames().length,1);
  assert.equal(await page.locator('header.top').count(),1);
  assert.equal(await page.locator('#v85AccessPanel,[data-v85-role]').count(),0);
  assert.equal(await page.evaluate(()=>typeof window.PCIPVFMedia?.status),'function');
}
async function offer(page){
  await page.locator('#pciGlobalDock [data-dock="offer"]').click();
  await page.locator(cellSelector).waitFor();
  await page.locator('#bagContent [data-bag-year="5"]').click();
}
async function development(page){
  await page.locator('#pciGlobalDock [data-dock="proposal"]').click();
  await page.locator('#v28home').waitFor({state:'visible'});
  await page.locator('#v28home [data-area="Formación Orientada"]').click();
  await page.locator(groupSelector).waitFor();
}
async function login(page,pci){
  await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#schoolSearch')?.placeholder.includes('escuelas'));
  await page.locator('#schoolSearch').fill('Escuela simulada');
  await page.locator('#schoolResults button[data-id="'+school.school_id+'"]').click();
  await page.locator('#schoolCode').fill('PCI-TEST');
  await page.locator('#firstName').fill('Prueba');await page.locator('#lastName').fill('Simulada');
  await page.locator('#email').fill('prueba@escuela.example');await page.locator('#schoolSubmit').click();
  await page.locator('#schoolPciCards .school-offer-card').waitFor();
  await page.locator('#schoolPciCards a[href*="pci='+pci.pci_id+'"][href*="view=oferta"]').click();
  await page.waitForFunction(()=>document.body.dataset.pciV2Ready==='true',null,{timeout:45000});
}

async function assertPrescription(page,scenario,alternative){
  const expected=scenario[alternative],status=await page.evaluate(()=>PCIPVFMedia.status());
  assert.equal(status.orientationId,scenario.id);assert.equal(status.alternative,alternative);
  assert.ok(['aplicado','sin-cambios'].includes(status.estado),JSON.stringify(status));
  assert.equal(status.conflicto,null);
  for(const field of ['subjectId','name','hours'])assert.equal(status.prescripcion[field],expected[field]);
  assert.equal(status.prescripcion.slot,SLOT);
  assert.equal(status.prescripcion.startTerm,9);assert.equal(status.prescripcion.endTerm,10);
  const map=await activeMap(page);
  assert.equal(map.alt,alternative);assert.deepEqual(map.placements[SLOT],[expected.subjectId]);
  const placements=Object.entries(map.placements).flatMap(([slot,ids])=>(ids||[])
    .filter(id=>id===expected.subjectId).map(id=>({slot,id})));
  assert.deepEqual(placements,[{slot:SLOT,id:expected.subjectId}],'PVF aparece una sola vez en el mapa.');
  const cell=page.locator(cellSelector),chip=cell.locator('[data-map-id="'+expected.subjectId+'"]');
  assert.equal(await cell.count(),1);assert.equal(await chip.count(),1);
  assert.ok((await chip.innerText()).includes(expected.name),'La celda muestra la materia prescripta de la alternativa activa.');
  assert.equal(await chip.getAttribute('draggable'),'false');
  assert.equal(await cell.locator('[data-rm]').count(),0,'La materia fija no ofrece un control para quitarla.');
  assert.match(await cell.locator('[data-pvf-fixed]').innerText(),new RegExp('Materia prescripta.*Fija.*'+expected.hours+' HC'));
  // Los IDs FO son posicionales: un ID de la otra alternativa puede designar
  // otra materia legítima en el catálogo actual. Se controla la identidad activa.
  assert.equal(await page.locator('#bagContent [data-sub="'+expected.subjectId+'"]').count(),0,
    'PVF no sobra en la bolsa de materias disponibles.');
  const group=await page.evaluate(slot=>{
    const groups=PCIPhase2V28.groups().filter(g=>g.id===slot),g=groups[0];
    return {count:groups.length,year:g?.year,term:g?.term,subjectIds:g?.subjectIds,type:g?.type};
  },SLOT);
  assert.deepEqual(group,{count:1,year:5,term:'9-10',subjectIds:[expected.subjectId],type:'proyecto'});
  return status;
}
async function selectAlternative(page,alternative){
  await page.locator('#bagContent [data-alt="'+alternative+'"]').click();
}
async function rejectedDrag(page,from,to,payload){
  // Eventos DOM reales: ejercitan las guardas de captura y de destino del motor.
  // No se reemplaza ninguna función de la aplicación para simular el rechazo.
  return page.evaluate(({from,to,payload})=>{
    const dataTransfer=new DataTransfer();dataTransfer.setData('text/plain',payload);
    const source=document.querySelector(from),target=document.querySelector(to);
    if(!source||!target)throw Error('Falta origen o destino de arrastre.');
    const start=new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer});source.dispatchEvent(start);
    target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer}));
    const drop=new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer});target.dispatchEvent(drop);
    source.dispatchEvent(new DragEvent('dragend',{bubbles:true,cancelable:true,dataTransfer}));
    return {inicioCancelado:start.defaultPrevented,dropCancelado:drop.defaultPrevented};
  },{from,to,payload});
}
async function fixedPlacement(page,scenario,record){
  const extra=page.locator('#bagContent [data-sub^="fo-"]').first();
  const extraId=await extra.getAttribute('data-sub');assert.ok(extraId,'Hay otra materia real de la bolsa para probar el rechazo.');
  const before=(await activeMap(page)).placements;
  record.arrastreExtra=await rejectedDrag(page,'#bagContent [data-sub="'+extraId+'"]',cellSelector,
    'subject:'+encodeURIComponent(extraId));
  assert.deepEqual((await activeMap(page)).placements,before,'No se agrega otra materia al PVF fijo.');
  assert.equal(await page.locator('#validation').getAttribute('data-pvf-blocked'),'true');
  record.arrastrePvf=await rejectedDrag(page,cellSelector+' [data-map-id]',
    '#matrix .drop[data-slot="foLab5-c9"]','move:'+encodeURIComponent(SLOT)+':'+encodeURIComponent(scenario.A.subjectId));
  assert.equal(record.arrastrePvf.inicioCancelado,true,'El arrastre de la materia fija queda interceptado.');
  assert.deepEqual((await activeMap(page)).placements,before,'PVF no se traslada a otro espacio.');
  record.inicioTactilCancelado=await page.locator(cellSelector+' [data-map-id]').evaluate(chip=>{
    const event=new PointerEvent('pointerdown',{pointerType:'touch',pointerId:1,bubbles:true,cancelable:true});
    chip.dispatchEvent(event);return event.defaultPrevented;
  });
  assert.equal(record.inicioTactilCancelado,true,'La materia fija tampoco inicia un arrastre táctil.');
  await assertPrescription(page,scenario,'A');
  return extraId;
}

async function editFourPlans(page,record){
  await development(page);
  await page.locator(groupSelector+' .v38-own-add').click();
  await page.locator('#v38custom [name="axis"]').fill('Prueba institucional simulada');
  await page.locator('#v38custom [name="text"]').fill('Diseñar un proyecto de vinculación con el futuro. Contenido simulado de prueba.');
  await page.locator('#v38custom button[type="submit"]').click();
  await page.locator('#v38modal').waitFor({state:'hidden'});
  const group=(await activeMap(page)).phase2V28.groups[SLOT];
  assert.equal(group.contents.length,1);const contentId=group.contents[0];
  await page.locator(groupSelector+' [data-plans]').click();
  assert.equal(await page.locator('#v38modal [data-open]').count(),4,'El proyecto anual tiene cuatro planes bimestrales.');
  await capture(page,record,'cuatro-planes');
  for(let number=1;number<=4;number++){
    await page.locator('#v38modal [data-open="'+number+'"]').click();
    const form=page.locator('#v38plan');await form.waitFor();
    assert.equal(await page.locator('#v38modal .v38-top h2').innerText(),'Plan bimestral '+number+' de 4');
    await form.locator('[data-pfield="name"]').fill('PVF simulado · Bimestre '+number);
    await form.locator('[data-pfield="synopsis"]').fill('Sinopsis de prueba del bimestre '+number+'.');
    await form.locator('[data-pfield="objectives"]').fill('Objetivo de prueba '+number+' · '+record.id);
    await form.locator('[data-pcontent="'+contentId+'"]').check();
    for(const stage of ['punto_partida','indagacion','produccion','evaluacion'])
      await form.locator('[data-stage="'+stage+'"][data-sfield="activities"]').fill('Actividad '+stage+' del bimestre '+number+'.');
    if(number===1){
      await form.locator('[data-pfield="name"]').scrollIntoViewIfNeeded();await settle(page);
      record.editor=await page.evaluate(()=>{
        const shell=document.querySelector('#v38shell'),r=shell.getBoundingClientRect();
        return {left:r.left,right:r.right,width:innerWidth,scrollWidth:shell.scrollWidth,clientWidth:shell.clientWidth};
      });
      assert.ok(record.editor.left>=-1&&record.editor.right<=record.editor.width+1,'El editor cabe en la pantalla.');
      assert.ok(record.editor.scrollWidth<=record.editor.clientWidth+1,'El editor no desborda horizontalmente.');
      await capture(page,record,'plan-bimestral-editado');
    }
    await form.locator('button[type="submit"]').click();
    await page.locator('#v38modal [data-open="4"]').waitFor();
  }
  const result=(await activeMap(page)).phase2V28;
  const saved=result.groups[SLOT];assert.equal(saved.plansBimestrales.length,4);
  for(const [index,plan] of saved.plansBimestrales.entries()){
    assert.equal(plan.name,'PVF simulado · Bimestre '+(index+1));
    assert.deepEqual(plan.contentIds,[contentId]);assert.ok(plan.updatedAt);
    assert.equal(plan.objectives,'Objetivo de prueba '+(index+1)+' · '+record.id);
    for(const stage of ['punto_partida','indagacion','produccion','evaluacion'])
      assert.equal(plan.stages[stage].activities,'Actividad '+stage+' del bimestre '+(index+1)+'.');
  }
  await page.locator('#v38modal [data-close]').click();
  return {group:saved,customContents:result.customContents};
}
async function assertDevelopment(page,expected){
  const map=await activeMap(page);
  assert.deepEqual(map.phase2V28.groups[SLOT],expected.group,'Se conservan contenidos y los cuatro planes completos.');
  assert.deepEqual(map.phase2V28.customContents,expected.customContents,'El contenido institucional conserva su identidad.');
}
async function incompatibleExistingWork(page,record,scenario,extraId,expected){
  // Un docente simulado creado por la interfaz permite comprobar la raíz de gestión.
  await page.locator('#pciGlobalDock [data-dock="institutional"]').click();
  await page.locator('#institutional.active').waitFor();
  await page.locator('#v73ManagementHome [data-v73-open="docentes"]').click();
  const teacherName='Docente simulado · PVF · '+record.dispositivo;
  await page.locator('#v71LeanTeacherName').fill(teacherName);
  await page.locator('#v71LeanTeacherDni').fill('99001720');
  await page.locator('#v71LeanTeacherEmail').fill('docente.pvf@escuela.example');
  await page.locator('#v71LeanAddTeacher').click();
  await page.waitForFunction(name=>Object.values(PCIAplicacionV2.snapshot().institutional.teachers)
    .some(teacher=>teacher.name===name),teacherName);
  await offer(page);
  const institution=(await snapshot(page)).institutional;
  const original=await activeMap(page);
  const result=await page.evaluate(({slot,extraId})=>{
    const document=PCIAplicacionV2.snapshot(),map=document.maps[document.active];
    // Fixture local de un borrador previo incompatible, con el desarrollo intacto.
    map.placements[slot]=[extraId];map.valid=true;
    return PCIAplicacionV2.applyDraft(document);
  },{slot:SLOT,extraId});
  const map=result.maps[result.active],status=await page.evaluate(()=>PCIPVFMedia.status());
  assert.equal(status.estado,'conflicto');assert.ok(status.conflicto?.message);
  assert.equal(map.valid,false,'Un PVF incompatible no conserva una validación anterior.');
  assert.deepEqual(map.placements,{...original.placements,[SLOT]:[extraId]},'El conflicto conserva las ubicaciones existentes.');
  await assertDevelopment(page,expected);
  assert.equal(await page.locator('#pciPvfConflict').getAttribute('data-pvf-conflict'),'estado');
  assert.equal(await page.locator('#validateBtn').isDisabled(),true,'El mapa incompatible no puede validarse.');
  await page.locator('#pciPvfConflict').scrollIntoViewIfNeeded();await capture(page,record,'trabajo-previo-incompatible');
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);
  assert.equal((await page.evaluate(()=>PCIPVFMedia.status())).estado,'conflicto');
  assert.equal((await activeMap(page)).valid,false);await assertDevelopment(page,expected);
  const resolver=page.locator('#pciPvfConflict [data-pvf-resolver]');
  assert.equal(await resolver.innerText(),'Aplicar materia prescripta y conservar el desarrollo');
  await resolver.click();
  await assertPrescription(page,scenario,'A');
  assert.equal((await page.evaluate(()=>PCIPVFMedia.status())).conflicto,null);
  assert.equal(await page.locator('#pciPvfConflict').count(),0);
  assert.equal(await page.locator('#validateBtn').getAttribute('data-pvf-disabled'),null,
    'Resolver desde el aviso no deja la deshabilitación del conflicto anterior.');
  assert.equal((await activeMap(page)).valid,false,'La resolución requiere volver a validar el mapa.');
  await assertDevelopment(page,expected);
  assert.deepEqual((await snapshot(page)).institutional.teachers,institution.teachers,'La resolución conserva los docentes.');
  assert.deepEqual((await snapshot(page)).institutional.assignments,institution.assignments,'La resolución conserva las asignaciones docentes.');
  await page.locator(cellSelector).scrollIntoViewIfNeeded();await capture(page,record,'conflicto-resuelto-desde-aviso');
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);await offer(page);
  await assertPrescription(page,scenario,'A');await assertDevelopment(page,expected);
  assert.equal((await activeMap(page)).valid,false);
  assert.equal(await page.locator('#pciPvfConflict').count(),0);
  assert.equal(await page.locator('#validateBtn').getAttribute('data-pvf-disabled'),null);
  assert.deepEqual((await snapshot(page)).institutional.teachers,institution.teachers);
  assert.deepEqual((await snapshot(page)).institutional.assignments,institution.assignments);
  record.trabajoPrevio={conservado:true,validacionBloqueada:true,revisadoTrasRecarga:true,
    resueltoPorBoton:true,recuperacionSinBloqueoResidual:true,docentesConservados:true};
}

async function exercise(page,record,scenario,pci){
  await login(page,pci);
  record.guardadoInicial=await initialEnvelope(page,scenario,pci,{requireSaveEvent:true});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.dataset.pciV2Ready==='true',null,{timeout:45000});
  record.guardadoInicialTrasRecarga=await initialEnvelope(page,scenario,pci);
  await ready(page);await offer(page);
  assert.equal((await snapshot(page)).active,scenario.name);
  record.inicial=await assertPrescription(page,scenario,'A');
  const extraId=await fixedPlacement(page,scenario,record);
  await page.locator(cellSelector).scrollIntoViewIfNeeded();await capture(page,record,'pvf-alternativa-a');
  await capture(page,record,'detalle-pvf-a',page.locator(cellSelector));
  await selectAlternative(page,'B');record.alternativaB=await assertPrescription(page,scenario,'B');
  await page.locator(cellSelector).scrollIntoViewIfNeeded();await capture(page,record,'detalle-pvf-b',page.locator(cellSelector));
  await selectAlternative(page,'A');await assertPrescription(page,scenario,'A');
  const saved=await editFourPlans(page,record);
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);
  await assertDevelopment(page,saved);await offer(page);await assertPrescription(page,scenario,'A');
  await development(page);await page.locator(groupSelector+' [data-plans]').click();
  assert.equal(await page.locator('#v38modal [data-open]').count(),4);
  await page.locator('#v38modal [data-open="4"]').click();
  assert.equal(await page.locator('#v38plan [data-pfield="objectives"]').inputValue(),saved.group.plansBimestrales[3].objectives);
  assert.deepEqual(await page.locator('#v38plan [data-pcontent]:checked').evaluateAll(nodes=>nodes.map(node=>node.dataset.pcontent)),saved.group.contents);
  await capture(page,record,'plan-cuarto-recargado');await page.locator('#v38modal [data-close]').click();
  await offer(page);
  const before=await activeMap(page);await selectAlternative(page,'B');
  if(scenario.compatible){
    await assertPrescription(page,scenario,'B');await assertDevelopment(page,saved);
    assert.equal(await page.locator('#pciPvfConflict').count(),0);
    record.cambioConTrabajo='permitido; misma materia, nombre y horas';
  }else{
    await assertPrescription(page,scenario,'A');await assertDevelopment(page,saved);
    assert.deepEqual(await activeMap(page),before,'El cambio incompatible conserva íntegro el mapa y la alternativa anterior.');
    assert.equal(await page.locator('#pciPvfConflict').getAttribute('data-pvf-conflict'),'alternativa');
    assert.equal(await page.locator('#validation').getAttribute('data-pvf-blocked'),'true');
    assert.equal((await page.evaluate(()=>PCIPVFMedia.status())).bloqueo?.alternative,'B');
    await page.locator('#pciPvfConflict').scrollIntoViewIfNeeded();await capture(page,record,'cambio-alternativa-bloqueado');
    record.cambioConTrabajo='bloqueado; alternativa anterior y desarrollo preservados';
  }
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);await offer(page);
  await assertPrescription(page,scenario,scenario.compatible?'B':'A');await assertDevelopment(page,saved);
  // El caso de Literatura también simula un documento previo incongruente.
  if(scenario.id==='literatura')await incompatibleExistingWork(page,record,scenario,extraId,saved);
  assert.deepEqual(record.errores,[],'Sin excepciones de JavaScript.');
  assert.deepEqual(record.recursosFallidos,[],'El paquete contiene todos los recursos solicitados.');
  assert.deepEqual(record.accionesInesperadas,[],'Sólo autenticación y lecturas simuladas.');
  assert.deepEqual(record.dialogos,[],'No se solicitan confirmaciones ni se activan operaciones remotas.');
  record.planes={cantidad:4,editados:true,conservadosTrasRecarga:true};record.resultado='aprobado';
}

try{
  report.distribucion=JSON.parse(execFileSync(process.execPath,
    ['scripts/preparar-publicacion-aplicacion-v2.mjs','--out',distribution],{cwd:root,encoding:'utf8'}));
  for(const file of ['index.html','pci-orientaciones.html','src/aplicacion-v2/pvf-media.mjs','src/aplicacion-v2/pvf-media-runtime.js'])
    assert.ok((await readFile(join(distribution,file))).length,'El paquete debe incluir '+file);
  server=createServer(async(req,res)=>{
    try{
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
      const pathname=new URL(req.url,'http://127.0.0.1').pathname;
      const file=resolve(distribution,'.'+decodeURIComponent(pathname));
      const rel=relative(distribution,file);
      if(rel==='..'||rel.startsWith('..'+sep))throw Error('Ruta fuera de la distribución.');
      const bytes=await readFile(file);
      res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
      res.end(req.method==='HEAD'?undefined:bytes);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
  report.navegador=browser.version();
  for(const device of [
    {name:'escritorio',viewport:{width:1440,height:1000},isMobile:false,hasTouch:false},
    {name:'celular',viewport:{width:390,height:844},isMobile:true,hasTouch:true}
  ])for(const scenario of cases){
    const record={id:device.name+'-'+scenario.id,dispositivo:device.name,orientacion:scenario.name,
      errores:[],recursosFallidos:[],accionesInesperadas:[],dialogos:[]};
    report.casos.push(record);console.log('PVF Media en paquete publicado: '+record.id);
    const context=await browser.newContext({viewport:device.viewport,isMobile:device.isMobile,hasTouch:device.hasTouch,
      deviceScaleFactor:1,serviceWorkers:'block'});
    const page=await context.newPage();page.setDefaultTimeout(15000);
    const pci=pciFor(scenario);await installMocks(page,record,pci);
    try{await exercise(page,record,scenario,pci);}
    catch(error){
      record.resultado='fallido';record.error=error.stack||String(error);
      record.diagnostico=await page.evaluate(()=>({url:location.href,title:document.title,
        fatal:document.querySelector('#fatal')?.textContent,ready:document.body.dataset.pciV2Ready,
        pvf:window.PCIPVFMedia?.status(),validation:document.querySelector('#validation')?.textContent,
        state:window.PCIAplicacionV2?.snapshot(),body:document.body.textContent.slice(-1600)})).catch(e=>({error:e.message}));
      report.fallos.push({caso:record.id,error:record.error});
      await page.screenshot({path:join(artifacts,record.id+'-error.png'),fullPage:false}).catch(()=>{});
      console.error(record.error);
    }finally{await context.close();}
  }
}catch(error){report.fallos.push({fase:'preparacion',error:error.stack||String(error)});}
finally{
  if(browser)await browser.close();if(server)await new Promise(done=>server.close(done));
  report.escrituras=report.acciones.filter(action=>/^(?:create|save|reset|bulk|delete|update|set)-/.test(action.action||''));
  report.fixturesInalteradas=JSON.stringify({school,legacy,cases})===fixturesBefore;
  await writeFile(join(artifacts,'resultado-pvf.json'),JSON.stringify(report,null,2));
  await rm(temporary,{recursive:true,force:true});
}
assert.equal(report.fallos.length,0,JSON.stringify(report.fallos,null,2));
assert.deepEqual(report.escrituras,[],'No se intenta escribir ni regenerar datos remotos.');
assert.deepEqual(report.externosBloqueados,[],'No hay dependencias externas ajenas a las APIs simuladas.');
assert.equal(report.fixturesInalteradas,true);
console.log(JSON.stringify({resultado:'aprobado',casos:report.casos.length,paqueteReal:true,
  capturas:report.capturas.length,solicitudesExternasInterceptadas:report.solicitudesExternas.length,
  escrituras:report.escrituras.length,informe:relative(root,join(artifacts,'resultado-pvf.json'))}));
