/**
 * Aplicación escolar completa, sin marcos: prueba exclusiva de CI.
 * Todo acceso remoto queda interceptado antes de navegar. Las escuelas, las
 * personas y los documentos son simulados; los catálogos y el motor son reales.
 * --fixtures-only comprueba las referencias sin iniciar servidor ni navegador.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,relative,sep,extname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {loadMatrixContents,loadV2Fg} from '../src/integracion-curricular/catalogos.js';
import {migrarLegadoFgAV2,materiasMotorMedia} from '../src/migracion/legado-fg-a-v2.mjs';
import {inventoryFromLegacy,HISTORIC_LINK_SCHEMA} from '../src/vinculos-historicos.mjs';

const root=process.cwd();
const artifacts=resolve(process.env.PCI_NATIVE_ARTIFACTS||'test-artifacts/aplicacion-v2-integrada');
const norm=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const sha=value=>createHash('sha256').update(value).digest('hex');
const fetchLocal=async path=>new Response(await readFile(resolve(root,path)));
const [matrixRows,fgRows,matterJson]=await Promise.all([
  loadMatrixContents({fetchFn:fetchLocal}),
  loadV2Fg({fetchFn:fetchLocal,base:'vendor/pci-sec-aprende-v2/data/curriculum_v103'}),
  readFile(resolve(root,'vendor/pci-sec-aprende-v2/data/materias-v2.json'),'utf8')
]);
const subjects=materiasMotorMedia(JSON.parse(matterJson));
const controlId='fgv103:128b15a3f8d5c644';
const control=fgRows.find(row=>row.id===controlId);
assert.equal(control?.year,3);
const sourceFor=row=>matrixRows.filter(candidate=>norm(candidate.subject)===norm(row.subject)&&
  norm(candidate.area)===norm(row.area)&&norm(candidate.text)===norm(row.text));
const controlSources=sourceFor(control);
assert.equal(controlSources.length,1,'El control de Matemática tiene una referencia histórica unívoca.');
assert.equal(controlSources[0].id,'c1040');
const social=['Historia','Economía','Geografía','Formación Ética y Ciudadana'].map(subject=>{
  const reference=fgRows.find(row=>row.year===3&&row.subject===subject&&sourceFor(row).length===1&&
    fgRows.filter(other=>other.year===3&&norm(other.subject)===norm(row.subject)&&norm(other.text)===norm(row.text)).length===1);
  assert.ok(reference,'Referencia unívoca de '+subject);
  return {reference,source:sourceFor(reference)[0]};
});
const stages=['punto_partida','indagacion','produccion','evaluacion'];
const plan=(name,ids)=>({number:1,name:'Plan bimestral simulado · '+name,autoName:false,
  synopsis:'Situación de prueba con datos escolares simulados.',
  objectives:'Analizar la situación y fundamentar las decisiones.',contentIds:[...ids],
  stages:Object.fromEntries(stages.map((stage,index)=>[stage,{
    description:'Etapa '+(index+1)+' conservada',duration:'Dos clases',
    resources:'Materiales simulados',activities:'Actividad de prueba '+(index+1)
  }]))});
const group=(id,level,startTerm,items,name)=>({id,level,startTerm,name,items,
  objective:'Propósito del agrupamiento simulado',synopsis:'Agrupamiento para prueba de integración.',
  plansBimestrales:[plan(name,items)]});
const socialSlots=['socialA-c5','socialB-c5','socialA-c6','socialB-c6'];
const legacy={profile:'comun',areas:{
  'Matemática':{groups:[group('sim-math-1',1,1,[controlSources[0].id],'Matemática · Nivel 1')]},
  'Ciencias Sociales':{groups:socialSlots.map((slot,index)=>group('sim-'+slot,3,Number(slot.at(-1)),
    (index%2?social.slice(2):social.slice(0,2)).map(pair=>pair.source.id),'Sociales '+slot))}
}};
const originalLegacy=JSON.stringify(legacy);
const track='Economía y Administración';
const proposal=migrarLegadoFgAV2({legacyState:legacy,matrixRows,v2FgRows:fgRows,
  model:{model:'media',subjects},orientationId:track});
assert.equal(proposal.socialOption,'B');
assert.equal(Object.keys(proposal.groups).length,5);
assert.equal(proposal.pendientes.length,0);
assert.deepEqual(proposal.groups['matematica-n1'].contents,[controlId]);
assert.deepEqual(proposal.groups['socialB-c5'].contents,social.slice(2).map(pair=>pair.reference.id));
assert.equal(JSON.stringify(legacy),originalLegacy);
if(process.argv.includes('--fixtures-only')){
  console.log(JSON.stringify({resultado:'aprobado',matrixRows:matrixRows.length,fgRows:fgRows.length,
    controlOrigen:controlSources[0].id,controlDestino:controlId,grupos:Object.keys(proposal.groups).length,opcionSocial:proposal.socialOption}));
  process.exit(0);
}
assert.equal(process.env.CI,'true','Esta prueba de navegador se ejecuta exclusivamente en CI; --fixtures-only no abre navegador.');
const {chromium}=await import('playwright');
await mkdir(artifacts,{recursive:true});
const protectedPaths=execFileSync('git',['ls-files','-z','--','vendor/',
  'src/migracion/legado-fg-a-v2.mjs','src/migracion/aplicar-en-v2.mjs'],{encoding:'utf8'}).split('\0').filter(Boolean);
const fingerprints=async()=>Object.fromEntries(await Promise.all(protectedPaths.map(async path=>
  [path,sha(await readFile(resolve(root,path)))])));
const protectedBefore=await fingerprints();
const school={school_id:1701,name:'Escuela simulada · Aplicación integrada',cue:'SIM-1701',model:'comun'};
const ids={media:'17171717-1111-4111-8111-000000000001',tarde:'17171717-1111-4111-8111-000000000002',
  tecnica:'17171717-1111-4111-8111-000000000003',ba15:'17171717-1111-4111-8111-000000000004'};
const pcis=[
  {pci_id:ids.media,model:'comun',orientation_id:'economia_administracion',shift_id:'manana',title:'Media simulada · Mañana'},
  {pci_id:ids.tarde,model:'comun',orientation_id:'economia_administracion',shift_id:'tarde',title:'Media simulada · Tarde'},
  {pci_id:ids.tecnica,model:'tecnica',orientation_id:'tecnica_computacion',specialty_name:'Computación',shift_id:'manana',title:'Técnica simulada · Computación'},
  {pci_id:ids.ba15,model:'ba15',orientation_id:'economia_administracion',shift_id:'noche',title:'BA +15 simulada · Noche'}
].map(p=>({...p,school_id:school.school_id,status:'borrador',process_id:'proceso-simulado-2026',
  legacy_sha256:sha(originalLegacy),legacy_state:structuredClone(legacy)}));
const sourceUpdated='2026-11-21T12:00:00.000Z';
const inventory=inventoryFromLegacy(legacy);
const links={exists:true,revision:1,source_updated_at:sourceUpdated,source_model:'comun',rows:inventory,
  document:{schema:HISTORIC_LINK_SCHEMA,school_id:school.school_id,source_updated_at:sourceUpdated,
    assignments:inventory.map(row=>({area:row.area,id:row.id,kind:'general',mode:'selected',pci_ids:[ids.media]}))}};
const remoteBefore=JSON.stringify({pcis,links});
const report={fecha:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  datos:'Escuela, personas y documentos simulados; catálogos oficiales locales; ninguna conexión real a Supabase.',
  casos:[],fallos:[],capturas:[],acciones:[],externosBloqueados:[]};
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json',
  '.css':'text/css','.txt':'text/plain','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    const file=resolve(root,'.'+decodeURIComponent(pathname)),rel=relative(root,file);
    if(rel==='..'||rel.startsWith('..'+sep))throw Error('Ruta fuera del repositorio.');
    const bytes=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;

async function installNetwork(page,record){
  page.on('pageerror',error=>record.errores.push(error.message));
  page.on('response',response=>{if(response.url().startsWith(origin)&&response.status()>=400)
    record.recursosFallidos.push({url:response.url(),status:response.status()});});
  page.on('dialog',dialog=>{record.dialogos.push({tipo:dialog.type(),mensaje:dialog.message()});void dialog.dismiss();});
  await page.addInitScript(()=>{
    window.__pciNativeAudit={accessStarts:[]};
    addEventListener('pci-access-changed',()=>{
      const stack=new Error().stack||'';
      if(/\bat start\s*\(/.test(stack))window.__pciNativeAudit.accessStarts.push(performance.now());
    });
  });
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===origin)return route.continue();
    if(['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname))
      return route.fulfill({status:200,contentType:'text/css',body:''});
    if(!/supabase/i.test(url.hostname)){
      report.externosBloqueados.push(url.href);return route.abort('blockedbyclient');
    }
    let body;
    try{body=request.postDataJSON();}catch{body=null;}
    const entry={dispositivo:record.dispositivo,endpoint:url.pathname,action:body?.action,
      school_id:body?.school_id,pci_id:body?.pci_id,unit_id:body?.unit_id};
    report.acciones.push(entry);
    const fulfill=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
    if(request.method()!=='POST'||!body)return fulfill({error:'Solicitud simulada inválida.'},400);
    if(url.pathname==='/functions/v1/pci-access'){
      if(body.action==='public-catalog')return fulfill({schools:[school]});
      if(body.action==='school-login'&&body.school_id===school.school_id&&body.code==='PCI-TEST')
        return fulfill({token:'token-exclusivo-de-simulacion',role:'editor',school_id:school.school_id,
          name:school.name,cue:school.cue,model:school.model,identity:{first_name:body.first_name,last_name:body.last_name,email:body.email}});
    }
    if(url.pathname==='/functions/v1/pci-multipci'&&body.token==='token-exclusivo-de-simulacion'){
      if(body.action==='session-info')return fulfill({role:'editor',permissions:[],school_ids:[],all_schools:false});
      if(Number(body.school_id)!==school.school_id)return fulfill({error:'Escuela fuera del alcance simulado.'},403);
      if(body.action==='list-school-pcis')return fulfill({pcis:pcis.map(({legacy_state,...p})=>p)});
      if(body.action==='get-school-legacy-links')return fulfill(links);
      if(body.action==='get-school-pci'){
        const pci=pcis.find(p=>p.pci_id===body.pci_id);
        return pci?fulfill({pci}):fulfill({error:'PCI inexistente.'},404);
      }
      if(body.action==='get-school-pci-unit'&&pcis.some(p=>p.pci_id===body.pci_id))
        return fulfill({error:'Unidad y modalidad incompatibles.'},400);
    }
    record.accionesInesperadas.push(entry);
    return fulfill({error:'La prueba bloqueó una operación no autorizada.'},400);
  });
}

async function settle(page){
  await page.evaluate(()=>new Promise((done,reject)=>{
    let previous='',stable=0;const started=performance.now();
    const tick=()=>{
      const modal=document.querySelector('#v38shell'),r=modal?.getBoundingClientRect();
      const current=JSON.stringify([scrollX,scrollY,visualViewport?.offsetLeft,visualViewport?.offsetTop,r?.top,modal?.scrollTop]);
      stable=current===previous?stable+1:0;previous=current;
      if(stable>=4)return done();
      if(performance.now()-started>5000)return reject(Error('La vista no se estabilizó.'));
      requestAnimationFrame(tick);
    };requestAnimationFrame(tick);
  }));
}
async function capture(page,name){
  await settle(page);await page.screenshot({path:resolve(artifacts,name),fullPage:false});report.capturas.push(name);
}
async function nativeShell(page){
  assert.equal(await page.locator('iframe').count(),0,'La aplicación completa no crea iframes.');
  assert.equal(page.frames().length,1,'Solo existe el documento principal.');
  assert.equal(await page.locator('header.top,header.site-top').count(),1,'Hay una sola cabecera institucional.');
  assert.equal(await page.locator('#v85AccessPanel,[data-v85-role]').count(),0,'El ingreso se realiza por escuela.');
}
async function ready(page,pciId){
  await page.waitForFunction(()=>document.body.dataset.pciV2Ready==='true',null,{timeout:45000});
  // Los dos inicios diferidos del módulo original V80 deben terminar antes de
  // navegar a un área, pues ambos pueden volver a dibujar el inicio de Fase 2.
  await page.waitForFunction(()=>window.__pciNativeAudit.accessStarts.length>=2,null,{timeout:15000});
  await page.evaluate(async()=>{await PCIPhase2V28.loadCurriculum();await PCICoverageV91.ready();});
  assert.equal(await page.evaluate(()=>PCIAplicacionV2.contexto.pci.pci_id),pciId);
  assert.equal(await page.evaluate(()=>PCIAplicacionV2.contexto.school.id),school.school_id);
  assert.equal(await page.evaluate(()=>JSON.stringify(PCIAplicacionV2.contexto).includes('token-exclusivo-de-simulacion')),false);
  assert.match(await page.locator('#pciV2ContextNotice').innerText(),/Borrador local/,
    'La unidad remota incompatible se identifica como borrador local.');
  await nativeShell(page);
}
const snapshot=page=>page.evaluate(()=>PCIAplicacionV2.snapshot());
async function schoolHome(page){
  await page.locator('#pciV2BackSchool').click();
  await page.waitForURL(url=>url.pathname==='/pci-orientaciones.html'&&!url.searchParams.has('pci'));
  await page.locator('#schoolPciCards .school-offer-card').first().waitFor();
  await nativeShell(page);
}
async function openPci(page,id,view='oferta'){
  await page.locator('#schoolPciCards .school-offer-actions a[href*="pci='+id+'"][href*="view='+view+'"]').click();
  await page.waitForURL(url=>url.searchParams.get('pci')===id);
  await ready(page,id);
}
async function area(page,name){
  await page.locator('#pciGlobalDock [data-dock="proposal"]').click();
  await page.locator('#v28home').waitFor({state:'visible'});
  await page.locator('#v28home [data-area="'+name+'"]').click();
  await page.locator('#v28board').waitFor({state:'visible'});
  await page.locator('#v28groups [data-g]').first().waitFor();
}
async function modalGeometry(page){
  await settle(page);
  const geometry=await page.evaluate(()=>{
    const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
    const shell=document.querySelector('#v38shell');
    return {width:innerWidth,height:innerHeight,modal:rect(document.querySelector('#v38modal')),
      shell:rect(shell),close:rect(document.querySelector('#v38modal [data-close]')),
      scrollWidth:shell.scrollWidth,clientWidth:shell.clientWidth};
  });
  assert.equal(geometry.width,page.viewportSize().width,'El editor conserva el ancho del dispositivo.');
  for(const key of ['modal','shell','close']){
    assert.ok(geometry[key].left>=-1&&geometry[key].right<=geometry.width+1,key+' dentro del ancho de pantalla.');
    assert.ok(geometry[key].top>=-1&&geometry[key].bottom<=geometry.height+1,key+' dentro del alto de pantalla.');
  }
  assert.ok(geometry.scrollWidth<=geometry.clientWidth+1,'El plan no desborda horizontalmente.');
  return geometry;
}
async function verifyPlan(page,{slot,count,expected,contents,captureName,editObjective}){
  const button=page.locator('#v28groups [data-g="'+slot+'"] [data-plans]');
  await button.scrollIntoViewIfNeeded();await button.click();
  await page.locator('#v38modal').waitFor({state:'visible'});
  assert.equal(await page.locator('#v38modal [data-open]').count(),count,'Un plan por bimestre.');
  await page.locator('#v38modal [data-open="1"]').click();
  const editor=page.locator('#v38plan');await editor.waitFor({state:'visible'});
  assert.match(await page.locator('#v38modal .v38-top h2').innerText(),new RegExp('Plan bimestral 1 de '+count));
  if(expected){
    for(const field of ['name','synopsis','objectives'])assert.equal(await editor.locator('[data-pfield="'+field+'"]').inputValue(),expected[field]);
    for(const stage of stages)for(const field of ['description','duration','resources','activities'])
      assert.equal(await editor.locator('[data-stage="'+stage+'"][data-sfield="'+field+'"]').inputValue(),expected.stages[stage][field]);
  }
  if(contents)assert.deepEqual((await editor.locator('[data-pcontent]:checked').evaluateAll(nodes=>nodes.map(node=>node.dataset.pcontent))).sort(),[...contents].sort());
  const geometry=await modalGeometry(page);
  await capture(page,captureName);
  if(editObjective){
    await editor.locator('[data-pfield="objectives"]').fill(editObjective);
    await editor.locator('button[type="submit"]').click();
    await page.waitForFunction(({slot,value})=>PCIPhase2V28.gb(slot).data.plansBimestrales[0].objectives===value,{slot,value:editObjective});
  }
  await page.locator('#v38modal [data-close]').click();
  return {cantidad:count,geometria:geometry,conservaCamposYEtapas:!!expected};
}
async function coverage(page,third){
  const result=await page.evaluate(controlId=>{
    const all=PCIPhase2V28.groups(),core=PCICoverageV91;
    const levels=[1,2,3,4,5].map(year=>core.groupingLevelCoverage(all.find(g=>g.area==='Matemática'&&Number(g.year)===year),all).used);
    const one=all.find(g=>g.id==='matematica-n1'),three=all.find(g=>g.id==='matematica-n3');
    return {niveles:levels,trayectoria:core.trajectoryCoverage('Matemática',all).used,
      fueraDeNivel:core.formatCoverage(one).offLevel,planPrimero:core.planCoverage(one,[controlId]).annual.used,
      planTercero:core.planCoverage(three,[controlId]).annual.used,
      ubicaciones:all.filter(g=>g.data.contents.includes(controlId)).map(g=>g.id).sort()};
  },controlId);
  assert.deepEqual(result.niveles,third?[0,0,1,0,0]:[0,0,0,0,0]);
  assert.equal(result.trayectoria,third?1:0);assert.equal(result.fueraDeNivel,1);
  assert.equal(result.planPrimero,0);assert.equal(result.planTercero,1);
  assert.deepEqual(result.ubicaciones,third?['matematica-n1','matematica-n3']:['matematica-n1']);
  return result;
}

async function login(page,record){
  await page.goto(origin+'/pci-orientaciones.html?school='+school.school_id,{waitUntil:'domcontentloaded'});
  await page.locator('#authRequired').waitFor({state:'visible'});
  assert.equal(report.acciones.filter(item=>item.dispositivo===record.dispositivo).length,0,'Sin sesión no se consulta un servicio escolar.');
  await page.locator('#authLoginLink').click();
  await page.waitForFunction(()=>document.querySelector('#schoolSearch')?.placeholder.includes('escuelas'));
  await page.locator('#schoolSearch').fill('Escuela simulada');
  await page.locator('#schoolResults button[data-id="'+school.school_id+'"]').click();
  await page.locator('#schoolCode').fill('PCI-TEST');
  await page.locator('#firstName').fill('Prueba');await page.locator('#lastName').fill('Simulada');
  await page.locator('#email').fill('prueba@escuela.example');await page.locator('#schoolSubmit').click();
  await page.locator('#schoolPciCards .school-offer-card').first().waitFor();
  assert.equal(await page.locator('#schoolOverviewName').innerText(),school.name);
  assert.equal(await page.locator('#schoolPciCards .school-offer-card').count(),4);
  await nativeShell(page);
  await page.locator('#turnFilter').selectOption('tarde');
  assert.equal(await page.locator('#schoolPciCards .school-offer-card').count(),1);
  assert.match(await page.locator('#schoolPciCards').innerText(),/Media simulada · Tarde/);
  await page.locator('#turnFilter').selectOption('todos');
  await capture(page,record.dispositivo+'-escuela.png');
}

async function mediaFlow(page,record){
  await openPci(page,ids.media);
  assert.equal(await page.locator('#matrix .grid.levels .level').count(),5);
  await page.locator('#v2MigrationNotice').waitFor({state:'visible'});
  const before=await snapshot(page);
  assert.equal(before.maps[before.active].migracionLegado,undefined,'Preparar el aviso no incorpora datos.');
  assert.equal(before.maps[before.active].phase2V28?.groups?.['socialB-c5']?.contents?.length||0,0);
  await capture(page,record.dispositivo+'-media-aviso.png');
  await page.locator('#v2MigrationAccept').click();
  await page.waitForFunction(()=>!!PCIAplicacionV2.snapshot().maps[PCIAplicacionV2.snapshot().active].migracionLegado);
  const accepted=await snapshot(page),map=accepted.maps[accepted.active];
  assert.equal(map.socialOption,'B');
  for(const slot of Object.keys(proposal.groups)){
    assert.deepEqual(map.placements[slot],proposal.placements[slot]);
    assert.deepEqual(map.phase2V28.groups[slot].contents,proposal.groups[slot].contents);
    for(const id of proposal.placements[slot])assert.equal(await page.locator('#matrix .drop[data-slot="'+slot+'"] [data-map-id="'+id+'"]').count(),1);
  }
  assert.equal(await page.evaluate(()=>PCIPhase2V28.groups().filter(g=>g.area==='Ciencias Sociales').length),12);
  assert.equal(await page.locator('#v2MigrationAccept').isDisabled(),true);
  const acceptedMarker=structuredClone(map.migracionLegado);
  await page.evaluate(()=>PCIAplicacionV2.prepareMigration());
  assert.deepEqual((await snapshot(page)).maps[track].migracionLegado,acceptedMarker,'Preparar otra vez no duplica la aceptación.');
  record.coberturaSoloEnPrimero=await coverage(page,false);
  await page.locator('#matrix .drop[data-slot="socialB-c5"]').scrollIntoViewIfNeeded();
  await capture(page,record.dispositivo+'-media-mapa.png');
  await area(page,'Ciencias Sociales');
  const edited='Objetivo revisado en prueba '+record.dispositivo;
  record.planCuatrimestral=await verifyPlan(page,{slot:'socialB-c5',count:2,
    expected:legacy.areas['Ciencias Sociales'].groups[1].plansBimestrales[0],
    contents:social.slice(2).map(pair=>pair.reference.id),captureName:record.dispositivo+'-media-plan-bimestral.png',editObjective:edited});
  await area(page,'Matemática');
  record.planAnual=await verifyPlan(page,{slot:'matematica-n1',count:4,
    expected:legacy.areas['Matemática'].groups[0].plansBimestrales[0],contents:[controlId],
    captureName:record.dispositivo+'-media-plan-anual.png'});
  await page.evaluate(controlId=>{
    const next=PCIAplicacionV2.snapshot(),map=next.maps[next.active];
    map.placements['matematica-n3']=['fg-3-matematica'];
    map.phase2V28.groups['matematica-n3']={...structuredClone(map.phase2V28.groups['matematica-n1']),
      name:'Matemática simulada · Nivel 3',contents:[controlId]};
    PCIAplicacionV2.applyDraft(next);
  },controlId);
  record.coberturaTambienEnTercero=await coverage(page,true);

  await page.locator('#pciGlobalDock [data-dock="institutional"]').click();
  await page.locator('#institutional.active').waitFor();
  await page.locator('#v73ManagementHome [data-v73-open="docentes"]').click();
  const teacher='Docente simulado · '+record.dispositivo;
  await page.locator('#v71LeanTeacherName').fill(teacher);
  await page.locator('#v71LeanTeacherDni').fill('99001701');
  await page.locator('#v71LeanTeacherEmail').fill('docente@escuela.example');
  await page.locator('#v71LeanAddTeacher').click();
  await page.waitForFunction(name=>Object.values(PCIAplicacionV2.snapshot().institutional.teachers).some(t=>t.name===name),teacher);
  await capture(page,record.dispositivo+'-media-gestion.png');
  const teacherSaved=Object.values((await snapshot(page)).institutional.teachers).find(t=>t.name===teacher);
  await page.reload({waitUntil:'domcontentloaded'});await ready(page,ids.media);
  const reloaded=await snapshot(page);
  assert.equal(reloaded.institutional.teachers[teacherSaved.id].name,teacher);
  assert.equal(reloaded.maps[track].phase2V28.groups['socialB-c5'].plansBimestrales[0].objectives,edited);
  assert.deepEqual(reloaded.maps[track].migracionLegado,acceptedMarker);
  assert.deepEqual((await coverage(page,true)).niveles,[0,0,1,0,0]);
  record.recargaConservaGestionYPlanes=true;
  await schoolHome(page);await openPci(page,ids.tarde);
  const afternoon=await snapshot(page);
  assert.equal(afternoon.maps[track].migracionLegado,undefined,'El turno nuevo no hereda la aceptación del anterior.');
  assert.equal(Object.values(afternoon.institutional?.teachers||{}).some(t=>t.name===teacher),false);
  assert.equal(Object.values(afternoon.maps[track].phase2V28?.groups||{}).some(g=>(g.contents||[]).includes(controlId)),false);
  await schoolHome(page);await openPci(page,ids.media,'desarrollo');
  const returned=await snapshot(page);
  assert.equal(returned.institutional.teachers[teacherSaved.id].name,teacher);
  assert.equal(returned.maps[track].phase2V28.groups['socialB-c5'].plansBimestrales[0].objectives,edited);
  record.turnosSinMezcla=true;await schoolHome(page);
}

async function modalFlow(page,record,model,levels){
  await openPci(page,ids[model]);
  assert.equal(await page.locator('#matrix .grid.levels .level').count(),levels);
  assert.equal(await page.locator('#matrix .term').count(),levels*2+1);
  assert.equal(await page.evaluate(()=>window.__V2_MODAL.model),model);
  if(model==='tecnica'){
    const original=await snapshot(page);
    const prescription=await page.evaluate(()=>{
      const profile=window.V2ModalMap.profile,rows=profile.espacioAnual.espacios,
        list=window.__V2_MODAL.subjects,map=PCIAplicacionV2.snapshot().maps[PCIAplicacionV2.snapshot().active];
      return {specialtyId:profile.specialtyId,terms:profile.terms,
        slots:rows.map(x=>({
          year:x.year,name:x.name,
          ids:map.placements['anualEsp-n'+x.year]||[],
          subject:list.find(s=>s.id===(map.placements['anualEsp-n'+x.year]||[])[0])
        })),
        pending:profile.variablesNoCertificadas,
        annualBadge:document.querySelector('#matrix [data-slot="anualEsp-n4"] [data-space-name]')?.textContent,
        panelText:document.querySelector('#techSpecialtyPrescription')?.textContent,
        nonAnnual:rows.length&&list.find(s=>s.id===(map.placements['anualEsp-n4']||[])[0])
      };
    });
    assert.equal(prescription.specialtyId,'computacion');
    assert.equal(prescription.terms,12);
    assert.equal(prescription.slots.length,3,'Las tres materias anuales de Computación son prescriptas.');
    for(const slot of prescription.slots){
      assert.equal(slot.ids.length,1);
      assert.equal(slot.subject?.name,slot.name);
      assert.equal(slot.subject?.year,slot.year);
      assert.match(await page.locator('#matrix [data-slot="anualEsp-n'+slot.year+'"] [data-space-name]').innerText(),/Fija/);
    }
    assert.match(prescription.panelText,/Computación/);
    assert.match(prescription.panelText,/confirmar con el plan/i);
    assert.ok(prescription.pending.includes('integraciones_especialidad'));
    const locked=await page.evaluate(()=>{
      const map=PCIAplicacionV2.snapshot().maps[PCIAplicacionV2.snapshot().active],
        id=map.placements['anualEsp-n4'][0],subject=window.__V2_MODAL.subjects.find(s=>s.id===id);
      const wrongSlot=V2ModalMap.canAssign('foN3-c7',subject);
      const remove=V2ModalMap.remove('anualEsp-n4',id);
      const moved=V2ModalMap.move('anualEsp-n4','foN3-c7',id);
      const now=PCIAplicacionV2.snapshot().maps[PCIAplicacionV2.snapshot().active];
      return {wrongSlot,remove,moved,ids:now.placements['anualEsp-n4'],id};
    });
    assert.equal(locked.wrongSlot[0],false);
    assert.equal(locked.remove,false);
    assert.equal(locked.moved,false);
    assert.deepEqual(locked.ids,[locked.id]);
    assert.equal(original.maps[original.active].placements['anualEsp-n4'][0],locked.id);
    await capture(page,record.dispositivo+'-tecnica-prescripciones.png');
    await page.reload({waitUntil:'domcontentloaded'});await ready(page,ids.tecnica);
    const persisted=await snapshot(page);
    assert.deepEqual(persisted.maps[persisted.active].placements['anualEsp-n4'],[locked.id]);
    record.prescripcionesTecnica={tresAnualesFijos:true,sinDuplicar:true,
      prearmadoPersiste:true,planParticularPendiente:true};
  }
  const probe=await page.evaluate(()=>{
    const subjects=window.__V2_MODAL.subjects,rows=V2ModalMap.rowDefs();
    const from=[...document.querySelectorAll('#bagContent [data-sub]')].find(node=>{
      const s=subjects.find(item=>item.id===node.dataset.sub);return s&&s.year===1&&s.origin==='FG';
    });
    if(!from)throw Error('Falta una materia FG de primer nivel en la bolsa modal.');
    const item=subjects.find(s=>s.id===from.dataset.sub);
    const row=rows.find(r=>V2ModalMap.canAssign(r.k+(r.annual?'-n':'-c')+(r.annual?item.year:item.year*2-1),item)[0]);
    if(!row)throw Error('Falta una celda compatible con la materia modal.');
    const slot=row.k+(row.annual?'-n':'-c')+(row.annual?item.year:item.year*2-1);
    const target=document.querySelector('#matrix [data-slot="'+slot+'"]');
    if(!target)throw Error('La celda modal no está en la matriz visible.');
    const dt=new DataTransfer();
    from.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:dt}));
    target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
    target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
    const group=PCIPhase2V28.gb(slot);
    if(!group?.subjectIds.includes(item.id))throw Error('La materia no quedó asignada al agrupamiento.');
    return {slot,area:group.area,annual:!!row.annual,subject:item.id};
  });
  assert.equal(await page.locator('#matrix [data-slot="'+probe.slot+'"] [data-map-id="'+probe.subject+'"]').count(),1);
  await capture(page,record.dispositivo+'-'+model+'-mapa.png');
  await area(page,probe.area);
  const group=page.locator('#v28groups [data-g="'+probe.slot+'"]');
  await group.click();await page.locator('#v28list [data-c]').first().click();
  await page.locator('#v28assign').click();
  const contents=await page.evaluate(id=>PCIPhase2V28.gb(id).data.contents,probe.slot);
  assert.ok(contents.length>0,'La Fase 2 modal permite seleccionar contenidos.');
  const result=await verifyPlan(page,{slot:probe.slot,count:probe.annual?4:2,
    captureName:record.dispositivo+'-'+model+'-plan.png',editObjective:'Objetivo simulado '+model+' '+record.dispositivo});
  record.modalidades.push({modelo:model,niveles:levels,cuatrimestres:levels*2,plan:result,contenidoSeleccionado:true});
  await nativeShell(page);await schoolHome(page);
}

let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
  report.navegador=browser.version();
  for(const device of [
    {name:'escritorio',viewport:{width:1440,height:1000},isMobile:false,hasTouch:false},
    {name:'celular',viewport:{width:390,height:844},isMobile:true,hasTouch:true}
  ]){
    console.log('Prueba integrada: '+device.name);
    const record={dispositivo:device.name,viewport:device.viewport,errores:[],recursosFallidos:[],
      accionesInesperadas:[],dialogos:[],modalidades:[]};report.casos.push(record);
    const context=await browser.newContext({viewport:device.viewport,isMobile:device.isMobile,hasTouch:device.hasTouch,
      deviceScaleFactor:1,serviceWorkers:'block',acceptDownloads:true});
    const page=await context.newPage();page.setDefaultTimeout(18000);
    await installNetwork(page,record);
    try{
      await login(page,record);await mediaFlow(page,record);
      await modalFlow(page,record,'tecnica',6);await modalFlow(page,record,'ba15',4);
      assert.deepEqual(record.errores,[],'Sin excepciones de JavaScript.');
      assert.deepEqual(record.recursosFallidos,[],'Todos los recursos locales cargan.');
      assert.deepEqual(record.accionesInesperadas,[],'No hay operaciones remotas inesperadas.');
      assert.deepEqual(record.dialogos,[],'El recorrido no requiere confirmaciones inesperadas.');
      record.resultado='aprobado';
    }catch(error){
      record.resultado='fallido';record.error=error.stack||String(error);
      record.diagnostico=await page.evaluate(()=>({url:location.href,ready:document.body.dataset.pciV2Ready,
        screen:document.querySelector('.screen.active')?.id,iframeCount:document.querySelectorAll('iframe').length,
        aviso:document.querySelector('#v2MigrationNotice')?.textContent,fatal:document.querySelector('#fatal')?.textContent,
        acceso:window.__pciNativeAudit,bodyTail:document.body.textContent.slice(-2200)})).catch(e=>({error:e.message}));
      report.fallos.push({dispositivo:device.name,error:record.error});
      await page.screenshot({path:resolve(artifacts,device.name+'-error.png'),fullPage:false}).catch(()=>{});
      console.error(device.name+': '+record.error);
    }finally{await context.close();}
  }
}catch(error){report.fallos.push({fase:'preparacion',error:error.stack||String(error)});}
finally{
  if(browser)await browser.close();await new Promise(done=>server.close(done));
  report.escriturasRemotas=report.acciones.filter(item=>/^(?:create|save|update|delete|set)-/.test(item.action||''));
  report.originalesSinCambios=JSON.stringify({pcis,links})===remoteBefore&&JSON.stringify(legacy)===originalLegacy;
  report.archivosProtegidosSinCambios=JSON.stringify(await fingerprints())===JSON.stringify(protectedBefore);
  await writeFile(resolve(artifacts,'resultado.json'),JSON.stringify(report,null,2));
}
assert.equal(report.fallos.length,0,JSON.stringify(report.fallos,null,2));
assert.deepEqual(report.escriturasRemotas,[],'No hay creación ni guardados remotos automáticos, incluidos los guardados del editor de planes.');
assert.deepEqual(report.externosBloqueados,[],'El motor usa los recursos locales previstos.');
assert.equal(report.originalesSinCambios,true,'El legado y las respuestas simuladas permanecen inalterados.');
assert.equal(report.archivosProtegidosSinCambios,true,'La prueba no modifica vendor ni migradores.');
console.log(JSON.stringify({resultado:'aprobado',dispositivos:report.casos.length,capturas:report.capturas.length,
  escriturasRemotas:report.escriturasRemotas.length,datosReales:false,archivo:relative(root,resolve(artifacts,'resultado.json'))}));
