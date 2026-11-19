/**
 * Portal de orientaciones institucionales, diseñado para activarse luego del
 * despliegue verificado de pci_workspace + pci_collaboration + Edge.
 * No hace escritura al cargar, ni usa localStorage, ni toca pci_proposals.data.
 */
import {ORIENTATIONS,createOrientationPackage} from './integracion-curricular/bridge.js';
import {agruparPcis,TURNOS} from './pci-turnos-organizacion.mjs';
import {migrateState} from '../pci-model.js';
import {mostrarMapaBa15} from './ba15/mapa-ui.mjs';
import {montarConstructorBa15} from './ba15/constructor-ui.mjs';
import {loadMatrixContents,loadV2Fg,loadV2Fo,loadV2Rules,selectFoByOrientation} from './integracion-curricular/catalogos.js';
import {automaticallyValidateImportedFg,AUTO_VALIDATION_LABEL} from './integracion-curricular/auto-validacion-importacion.js';
import {seedOfferStructure,foSubjectBank,assignFoSubject,offerMapRows,validateOfferStructure,stageFoContent,setFoAlternative,assignPvfReference,confirmFoContentAfterOffer} from './integracion-curricular/mapa-oferta.js';
import {newFoDevelopment,FO_STAGES} from './integracion-curricular/desarrollo-fo-modelo.js';
import {pvfReference,validatePvfProject} from './integracion-curricular/proyecto-vinculacion-2026.mjs';
import {validateMediaWorkspaceFinal} from './normativa/adaptador-mapa-media-20261117.mjs';
import {SPECIALTIES,findSpecialty} from './tecnica/pautas-pci-20261005.mjs';
import {createIntegratedTechnicalUI} from './tecnica/interfaz-integrada-v2.mjs';
import {requireSchoolPci,newFgUnit,guardFgUnit,newOfferUnit,restoreOfferUnit,newFoUnit,guardFoUnit,inventory,editStageDescription} from './orientaciones-release-core.mjs';

const API='https://agmebsotbuurbnldxewf.supabase.co/functions/v1/pci-multipci';
const $=id=>document.getElementById(id);
const copy=v=>JSON.parse(JSON.stringify(v));
const show=(id,yes=true)=>$(id).hidden=!yes;
const elem=(tag,label,cls)=>{const x=document.createElement(tag);if(label!==undefined)x.textContent=String(label);if(cls)x.className=cls;return x;};
const note=(tag,str,parent,cls)=>{const el=elem(tag,str,cls);parent.appendChild(el);return el;};
const field=(title,value,handler,{multiline=true,readonly=false}={})=>{
  const outer=elem('label');note('span',title,outer);
  const x=elem(multiline?'textarea':'input');x.value=value===undefined?'':String(value);
  x.disabled=readonly;if(!multiline)x.type='text';x.addEventListener('input',()=>handler(x.value));
  outer.appendChild(x);return outer;
};
const stages=['punto_partida','indagacion','produccion','evaluacion'];
const stageLabel={punto_partida:'Punto de partida',indagacion:'Indagación',produccion:'Producción',evaluacion:'Evaluación'};
const refs={};
let session=null,schools=[],schoolId=null,pcis=[],pci=null,workspace=null,auto=null,fgSourceState=null;
let selectedFgArea=null,fgDoc=null,fgRevision=0,fgDirty=false;
let offerRevision=0,offerDirty=false,selectedFoSpace=null,foDoc=null,foRevision=0,foDirty=false;
let tab='fg',busy=false,ba15Controller=null;
const technical=createIntegratedTechnicalUI({canEdit,getUnit,saveUnit,saveSafe:safeSave,download,rememberDraft,forgetDraft,recallDraft,message,status});

async function call(action,data={}){
  const resp=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,token:session?.token,...data}),cache:'no-store'});
  const result=await resp.json().catch(()=>({}));
  if(!resp.ok){const e=Error(result.error||(resp.status===409?'Conflicto: otro editor guardó cambios. Conservá tu borrador y revisá la versión del servidor.':'No se pudo consultar Supabase.'));e.status=resp.status;throw e;}
  return result;
}
function message(str,kind=''){const p=$('message');p.textContent=str;p.className='message '+kind;}
function status(str,kind=''){const p=$('status');p.textContent=str;p.className='status '+kind;}
function fatal(str){$('fatal').textContent=str;show('fatal');status('No disponible','error');}
function canEdit(){return !!session && (session.role==='admin'||session.role==='editor'||session.role==='user'&&(session.permissions||[]).includes('pci.edit'));}
function canCreateSchool(){return session?.role==='admin';}
function canLeave(){
  if(!(fgDirty||foDirty||offerDirty||technical.isDirty()||ba15Controller?.isDirty()))return true;
  return confirm('Tenés cambios sin guardar. ¿Querés salir sin guardarlos? Podés descargarlos antes de continuar.');
}
function safeSave(task){
  if(busy||!canEdit())return;
  busy=true;status('Guardando...');
  return Promise.resolve().then(task).then(result=>{status('Guardado confirmado');return result;})
    .catch(error=>{status('No se guardó','error');message(error.status===409?'Conflicto de edición: la copia local permanece abierta. No se sobrescribió el servidor.':error.message,'error');throw error;})
    .finally(()=>{busy=false;});
}
function download(name,data){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=elem('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}

// Copia TEMPORAL por pestaña, escuela, PCI y unidad. No se sube a ninguna otra
// escuela ni se usa como respaldo externo. Un conflicto nunca se auto-fusiona.
function draftKey(kind,id,target=pci){
  if(!target?.pci_id||!Number.isSafeInteger(Number(target.school_id)))return null;
  return ['pci-orientaciones-borrador-v1',target.school_id,target.pci_id,kind,id].join(':');
}
function rememberDraft(kind,id,document,revision){
  const key=draftKey(kind,id);
  if(!key)return;
  try{
    sessionStorage.setItem(key,JSON.stringify({
      school_id:pci.school_id,pci_id:pci.pci_id,
      original_sha256:pci.legacy_sha256,kind,id,base_revision:revision,
      document,time:new Date().toISOString()
    }));
  }catch{
    message('El navegador no pudo guardar la copia temporal: descargá el borrador antes de salir.','warn');
  }
}
function forgetDraft(kind,id){
  const key=draftKey(kind,id);
  if(key)try{sessionStorage.removeItem(key)}catch{}
}
function recallDraft(kind,id,currentRevision,target,validate){
  const key=draftKey(kind,id,target);
  let cached;
  try{cached=JSON.parse(sessionStorage.getItem(key)||'null')}catch{return null}
  if(!cached||cached.school_id!==target.school_id||
    cached.pci_id!==target.pci_id||cached.original_sha256!==target.legacy_sha256||
    cached.kind!==kind||cached.id!==id)return null;
  if(cached.base_revision!==currentRevision){
    message('El servidor cambió mientras existía un borrador local. No se fusiona ni sobrescribe. Descargá la copia para revisar.','warn');
    if(confirm('Hay un borrador local de este PCI con una revisión anterior. ¿Descargarlo para comparar?'))
      download('PCI-CONFLICTO-'+target.school_id+'-'+kind+'.json',cached);
    return null;
  }
  try{validate(cached.document)}catch{
    message('Se encontró un borrador local incompatible. No fue aplicado ni eliminado.','error');
    if(confirm('El borrador de esta unidad no pudo validarse. ¿Descargarlo?'))
      download('PCI-BORRADOR-REVISAR-'+target.school_id+'-'+kind+'.json',cached);
    return null;
  }
  if(confirm('Hay un borrador local sin guardar de este PCI. ¿Recuperarlo?')){
    message('Borrador recuperado localmente; todavía tenés que guardarlo en el servidor.','warn');
    return cached.document;
  }
  return null;
}
function markDirty(kind){
  if(kind==='fg'&&fgDoc&&selectedFgArea){
    fgDirty=true;rememberDraft('fg',selectedFgArea,fgDoc,fgRevision);
  }else if(kind==='oferta'&&pci&&workspace){
    offerDirty=true;rememberDraft('oferta','mapa-oferta-v1',newOfferUnit({pci,workspace}),offerRevision);
  }else if(kind==='fo'&&foDoc&&selectedFoSpace){
    foDirty=true;rememberDraft('fo',selectedFoSpace,foDoc,foRevision);
  }
}
function normalizeForCompare(value){
  if(Array.isArray(value))return value.map(normalizeForCompare);
  if(value&&typeof value==='object')return Object.fromEntries(
    Object.keys(value).sort().map(k=>[k,normalizeForCompare(value[k])])
  );
  return value;
}
function equivalent(a,b){
  return JSON.stringify(normalizeForCompare(a))===JSON.stringify(normalizeForCompare(b));
}
async function loadReferences(){
  status('Cargando las dos bases curriculares…');
  const [matrix,fg,fo,rules]=await Promise.all([loadMatrixContents(),loadV2Fg(),loadV2Fo(),loadV2Rules()]);
  if(matrix.length!==1155||fg.length!==1126||fo.length!==860)
    throw Error('Las bases curriculares difieren de las versiones verificadas. No se permite continuar.');
  Object.assign(refs,{matrix,fg,fo,...rules});
}
function readSession(){
  for(const key of ['pci_access_session','pci_admin_monitor_session','pci_school_admin_session']){
    try{const s=JSON.parse(sessionStorage.getItem(key)||'null');if(s?.token)return s;}catch{}
  }
  return null;
}
async function init(){
  try{
    session=readSession();
    if(!session?.token){fatal('Iniciá sesión desde la página principal y volvé a ingresar a este módulo.');return;}
    const verified=await call('session-info');session={...session,...verified};
    await loadReferences();
    const requested=Number(new URL(location.href).searchParams.get('school'));
    if(session.role==='admin'||session.role==='user'){
      const result=await call('list-schools');schools=result.schools||[];
      const possible=schools.find(s=>Number(s.school_id)===requested);
      schoolId=Number(possible?.school_id||schools[0]?.school_id)||null;
    }else{
      schoolId=Number(session.school_id);
      if(!Number.isSafeInteger(schoolId)||schoolId<1001)throw Error('No se identificó la escuela de esta sesión.');
      schools=[{school_id:schoolId,name:session.name||'Escuela '+schoolId,cue:''}];
    }
    if(!schoolId)throw Error('La sesión no tiene escuelas autorizadas.');
    const sel=$('school');sel.replaceChildren();
    schools.forEach(s=>{const option=elem('option',s.name||'Escuela '+s.school_id);option.value=String(s.school_id);sel.appendChild(option);});
    sel.value=String(schoolId);
    sel.addEventListener('change',async()=>{if(!canLeave()){sel.value=String(schoolId);return;}schoolId=Number(sel.value);await reloadSchool().catch(err=>message(err.message,'error'));});
    $('showNewSchool').hidden=!canCreateSchool();
    $('btnAddPci').disabled=!canEdit();
    $('turnFilter').addEventListener('change',renderPcis);
    document.querySelectorAll('[data-back-to-school]').forEach(btn=>btn.addEventListener('click',returnToSchool));
    $('showNewSchool').onclick=()=>show('formNewSchool',true);
    // Acceso directo desde Panel general; requiere sesión administrativa real.
    if(new URL(location.href).searchParams.get('accion')==='alta-escuela'&&canCreateSchool()){
      show('formNewSchool',true);
      $('schoolNameInput').focus();
    }
    $('cancelSchool').onclick=()=>show('formNewSchool',false);
    $('btnAddPci').onclick=()=>show('formCreatePci',true);
    $('cancelPci').onclick=()=>show('formCreatePci',false);
    const o=$('orientation');
    ORIENTATIONS.forEach(x=>{const opt=elem('option',x.name);opt.value=x.id;o.appendChild(opt);});
    populateSpecialties();
    $('pciModel').addEventListener('change',updatePciModelFields);
    updatePciModelFields();
    $('formCreatePci').addEventListener('submit',createPci);
    $('formNewSchool').addEventListener('submit',createSchool);
    $('downloadOriginal').onclick=()=>{
      if(pci)download('pci-fg-original-escuela-'+schoolId+'-'+pci.orientation_id+'.json',{
        source_sha256:pci.legacy_sha256,school_id:schoolId,pci_id:pci.pci_id,original_state:pci.legacy_state
      });
    };
    document.querySelectorAll('.tab').forEach(el=>el.onclick=()=>setTab(el.dataset.tab));
    $('saveOffer').onclick=()=>technical.active?technical.saveOffer():saveOffer();
    $('foAlternative').addEventListener('change',()=>{
      if(!pci||!workspace)return;
      try{workspace=setFoAlternative(workspace,pci.orientation_id,$('foAlternative').value);markDirty('oferta');renderOffer();message('Alternativa FO cambiada, todavía sin guardar.','warn');}
      catch(error){message(error.message,'error');renderOffer();}
    });
    $('confirmFoContents').onclick=()=>{
      if(!pci||!workspace)return;
      try{workspace=confirmFoContentAfterOffer(workspace,{orientationId:pci.orientation_id,refs,foRows:refs.fo});markDirty('oferta');renderOffer();message('Contenidos FO confirmados por la regla curricular. Falta guardar.','warn');}
      catch(error){message(error.message,'error');}
    };
    window.addEventListener('beforeunload',e=>{if(fgDirty||foDirty||offerDirty||technical.isDirty()){e.preventDefault();e.returnValue='';}});
    show('app');
    await reloadSchool();
    status('Conectado');
  }catch(error){
    fatal(error?.status===503?'La API de orientaciones todavía no fue desplegada por el programador. Los PCI existentes siguen funcionando.':error.message);
  }
}
async function reloadSchool(){
  const school=schools.find(s=>Number(s.school_id)===schoolId);
  $('schoolLabel').textContent=(school?.cue||'Sin CUE')+' · ID '+schoolId;
  const legacyName=school?.name||session?.name||'Escuela '+schoolId;
  const originalTechnical=school?.model==='tecnica'||session?.model==='tecnica'||
    (school?.model==null && /(?:t[eé]cnica|politecnica)/i.test(legacyName));
  $('historicalPciLink').href='escuela-online.html?school='+schoolId+
    '&name='+encodeURIComponent(legacyName)+(originalTechnical?'&model=tecnica':'');
  $('homeHistoricalPciLink').href=$('historicalPciLink').href;
  const data=await call('list-school-pcis',{school_id:schoolId});
  pcis=Array.isArray(data.pcis)?data.pcis:[];
  technical.close();
  ba15Controller?.destroy();ba15Controller=null;
  pci=null;workspace=null;auto=null;selectedFgArea=null;selectedFoSpace=null;
  fgDirty=false;foDirty=false;offerDirty=false;
  show('editor',false);show('technicalPending',false);show('ba15Pending',false);show('empty');
  $('app').classList.add('school-home');
  renderPcis();
}
function renderPcis(){
  const host=$('pciList');host.replaceChildren();
  const selector=$('turnFilter');
  const counts=$('pciCounts');
  const turnos=agruparPcis(pcis);
  const current=selector.value;
  selector.replaceChildren();
  for(const [value,label] of [['todos','Todos los turnos'],...TURNOS.map(([id,name])=>[id,'Turno '+name])]){
    const option=elem('option',label);option.value=value;selector.appendChild(option);
  }
  selector.value=TURNOS.some(([id])=>id===current)?current:'todos';
  const totalMedia=pcis.filter(p=>p.model==='comun').length;
  const totalTecnica=pcis.filter(p=>p.model==='tecnica').length;
  const totalBa15=pcis.filter(p=>p.model==='ba15').length;
  counts.textContent=pcis.length+' PCI · '+turnos.length+' turnos · '+totalMedia+' Media · '+totalTecnica+' Técnica · '+totalBa15+' BA +15';
  if(!pcis.length){
    note('p','Todavía no hay orientaciones nuevas. La Formación General anterior permanece disponible.',host,'muted');
    renderSchoolHome();
    return;
  }
  // El mismo school_id y la misma sesión contienen todos los turnos y
  // modalidades. Cada botón abre el pci_id individual, nunca otro turno.
  for(const turno of turnos){
    if(selector.value!=='todos'&&selector.value!==turno.id)continue;
    const section=elem('section',undefined,'pciShiftSection');
    note('h3','Turno '+turno.nombre+' · '+turno.cantidad+' PCI',section,'pciShiftHeading');
    for(const modelo of turno.modelos){
      note('h4',modelo.nombre+' · '+modelo.pcis.length,section,'pciModelHeading');
      for(const p of modelo.pcis){
        const button=elem('button',undefined,'pciItem'+(p.pci_id===pci?.pci_id?' active':''));
        button.type='button';
        const track=p.model==='tecnica'?
          ('Especialidad: '+p.specialty_name):
          ('Orientación: '+(ORIENTATIONS.find(o=>o.id===p.orientation_id)?.name||p.orientation_id));
        note('strong',p.title,button);
        note('small',track+' · '+p.status,button);
        button.setAttribute('aria-label','Abrir '+track+' · Turno '+turno.nombre+' · '+p.title);
        button.onclick=()=>openPci(p.pci_id);
        section.appendChild(button);
      }
    }
    host.appendChild(section);
  }
  renderSchoolHome();
}
function modelLabelFor(p){
  return p.model==='tecnica'?'Técnica':p.model==='ba15'?'BA +15':'Media';
}
function displayOrientation(p){
  return p.model==='tecnica'?
    p.specialty_name||p.title:
    ORIENTATIONS.find(x=>x.id===p.orientation_id)?.name||p.title;
}
function renderSchoolHome(){
  const host=$('schoolPciCards');
  if(!host)return;
  host.replaceChildren();
  const selectedSchool=schools.find(s=>Number(s.school_id)===schoolId);
  $('schoolOverviewName').textContent=selectedSchool?.name||'Oferta curricular de la escuela';
  const all=agruparPcis(pcis);
  const selectedShift=$('turnFilter').value;
  const displayed=all.filter(g=>selectedShift==='todos'||g.id===selectedShift);
  const summary=$('schoolSummary');summary.replaceChildren();
  for(const [value,label] of [
    [pcis.length,'PCI'],
    [all.length,'turnos'],
    [pcis.filter(p=>p.model==='comun').length,'Media'],
    [pcis.filter(p=>p.model==='tecnica').length,'Técnica'],
    [pcis.filter(p=>p.model==='ba15').length,'BA +15']
  ]){
    const chip=elem('span',value+' '+label,'school-count-chip');summary.append(chip);
  }
  if(!pcis.length){
    const box=elem('div',undefined,'school-no-pcis');
    note('h3','La Formación General anterior está disponible',box);
    note('p','Para sumar orientaciones, especialidades o BA +15, elegí «+ Agregar PCI». El trabajo histórico se conserva.',box,'muted');
    host.append(box);return;
  }
  if(!displayed.length){
    note('p','Este turno no tiene PCI. Podés seleccionar otro o agregar uno nuevo.',host,'school-no-pcis');
    return;
  }
  for(const turno of displayed){
    const group=elem('section',undefined,'school-turn-section');
    const heading=elem('div',undefined,'school-turn-heading');
    note('h3','Turno '+turno.nombre,heading);
    note('span',turno.cantidad+' PCI',heading,'school-turn-count');
    group.append(heading);
    const grid=elem('div',undefined,'school-offer-grid');
    for(const modelo of turno.modelos){
      for(const p of modelo.pcis){
        const card=elem('article',undefined,'school-offer-card area-card');
        const eyebrow=elem('div',undefined,'school-offer-top');
        const model=elem('span',modelLabelFor(p),'pill');
        const statusLabel=elem('span',p.status==='borrador'?'En desarrollo':p.status==='en_revision'?'En revisión':p.status||'PCI','school-state');
        eyebrow.replaceChildren(model,statusLabel);
        card.append(eyebrow);
        const main=elem('div',undefined,'school-offer-body');
        note('h3',displayOrientation(p),main);
        note('p',p.title,main,'muted');
        card.append(main);
        const bottom=elem('div',undefined,'school-offer-actions');
        const map=elem('button','Mapa de la Oferta','btn primary');
        map.type='button';
        map.setAttribute('aria-label','Abrir Mapa de la Oferta de '+p.title);
        map.onclick=()=>openPci(p.pci_id,'oferta');
        const develop=elem('button','Desarrollo Curricular','btn secondary');
        develop.type='button';
        develop.setAttribute('aria-label','Abrir Desarrollo Curricular de '+p.title);
        develop.onclick=()=>openPci(p.pci_id,p.model==='ba15'?'fo':'fg');
        bottom.append(map,develop);card.append(bottom);grid.append(card);
      }
    }
    group.append(grid);host.append(group);
  }
}
function returnToSchool(){
  if(!canLeave())return;
  technical.close();ba15Controller?.destroy();ba15Controller=null;
  pci=null;workspace=null;auto=null;
  selectedFgArea=null;selectedFoSpace=null;fgDoc=null;foDoc=null;
  fgDirty=false;foDirty=false;offerDirty=false;
  show('editor',false);show('technicalPending',false);show('ba15Pending',false);show('empty',true);
  $('app').classList.add('school-home');
  renderPcis();
  window.scrollTo(0,0);
}
function populateSpecialties(){
  const select=$('specialtyName');select.replaceChildren();
  const placeholder=elem('option','Seleccionar especialidad técnica');placeholder.value='';
  placeholder.disabled=true;placeholder.selected=true;select.appendChild(placeholder);
  const groups=[
    ['defined_in_document','Especialidades con espacios anuales definidos'],
    ['not_defined_in_document','Especialidades pendientes de definición anual'],
    ['no_annual_space','Especialidad sin espacio anual (excepción)']
  ];
  for(const [status,label] of groups){
    const group=elem('optgroup');group.label=label;
    for(const specialty of SPECIALTIES.filter(x=>x.status===status)){
      const option=elem('option',specialty.name);option.value=specialty.name;
      group.appendChild(option);
    }
    select.appendChild(group);
  }
}
function updatePciModelFields(){
  const technical=$('pciModel').value==='tecnica';
  show('technicalSpecialtyGroup',technical);
  show('mediaOrientationGroup',!technical);
  $('orientation').disabled=technical;
  $('orientation').required=!technical;
  $('specialtyName').disabled=!technical;
  $('specialtyName').required=technical;
}
async function createPci(e){
  e.preventDefault();if(!canEdit())return;
  const model=$('pciModel').value;
  const orientationId=model!=='tecnica' ? $('orientation').value : '';
  const rawSpecialty=model==='tecnica' ? $('specialtyName').value.trim() : '';
  const specialtyName=model==='tecnica'?findSpecialty(rawSpecialty)?.name||'':'';
  if(model==='tecnica'&&!specialtyName){
    message('Elegí una especialidad identificada por su nombre en las pautas curriculares.','error');
    return;
  }
  const shiftId=$('pciShift').value;
  // El título visible identifica la especialidad y el turno; el nombre
  // de la especialidad se conserva por separado en specialty_name.
  const title=$('pciTitleInput').value.trim()||
    (model==='tecnica'?'PCI '+specialtyName+' · '+({
      manana:'Mañana',tarde:'Tarde',vespertino:'Vespertino',noche:'Noche'
    }[shiftId]||shiftId):'');
  try{
    status('Creando PCI…');
    const result=await call('create-school-pci',{
      school_id:schoolId,model,shift_id:shiftId,orientation_id:orientationId,
      specialty_name:specialtyName,title
    });
    show('formCreatePci',false);
    $('pciTitleInput').value='';
    $('specialtyName').value='';
    $('pciModel').value='comun';
    updatePciModelFields();
    await reloadSchool();
    if(result?.pci_id)await openPci(result.pci_id);
    status(model==='tecnica'?
      'Especialidad técnica registrada. Su mapa C1–C12 queda disponible para construcción y validación según el Anexo II final.':
      model==='ba15'?'PCI BA +15 creado. Podés construir y guardar su mapa C1–C8; la homologación final queda pendiente.':
      'PCI de Media creado sin modificar la matriz histórica.');
  }catch(error){status('No se creó','error');message(error.message,'error');}
}
async function createSchool(e){
  e.preventDefault();if(!canCreateSchool())return;
  const body={name:$('schoolNameInput').value.trim(),cue:$('schoolCueInput').value.trim().toUpperCase(),
    email:$('schoolEmailInput').value.trim(),year:Number($('schoolYearInput').value)};
  try{
    const result=await call('create-school-v2',body);
    // Mostrar claves solo al superadministrador que realizó la operación.
    alert('Escuela creada: ID '+result.school_id+'\nClave PCI: '+result.edit_code+'\nClave institucional: '+result.primary_code+
      '\nGuardá las claves en un lugar seguro.');
    show('formNewSchool',false);window.location.reload();
  }catch(error){message(error.message,'error');}
}
async function openPci(id,requestedTab='fg'){
  if(!canLeave())return;
  try{
    status('Cargando PCI y resguardo histórico…');
    const result=await call('get-school-pci',{school_id:schoolId,pci_id:id});
    if(result.pci?.model==='ba15'){
      const b=result.pci;
      if(Number(b.school_id)!==schoolId || !b.pci_id || !b.orientation_id || !b.legacy_sha256)
        throw Error('Identidad o resguardo del PCI BA +15 incompletos.');
      technical.close();pci=b;workspace=null;auto=null;
      fgDirty=false;foDirty=false;offerDirty=false;
      show('editor',false);show('technicalPending',false);show('empty',false);
      show('ba15Pending',true);
      $('ba15Name').textContent=pcis.find(x=>x.pci_id===id)?.title||'PCI BA +15';
      mostrarMapaBa15({metrics:$('ba15Metrics'),navigation:$('ba15Navigation'),map:$('ba15Map'),validation:$('ba15Validation')});
      const identity={pciId:b.pci_id,schoolId:b.school_id,orientationId:b.orientation_id,shiftId:b.shift_id};
      const unitId='mapa-ba15-v1',baseVersion='oferta-ba15-constructor-v1';
      const saved=await getUnit(b,'oferta','map',unitId,baseVersion);
      const remoteDraft=saved.exists?saved.document:null;
      if(remoteDraft && (remoteDraft.schema!=='ba15-constructor-v1'||
         Number(remoteDraft.schoolId)!==Number(b.school_id)||
         remoteDraft.pciId!==b.pci_id||
         remoteDraft.orientationId!==b.orientation_id||
         remoteDraft.shiftId!==b.shift_id))
        throw Error('El borrador BA +15 online no pertenece a este PCI. No se cargó.');
      let revision=Number(saved.revision)||0;
      ba15Controller?.destroy();
      ba15Controller=montarConstructorBa15($('ba15Builder'),identity,{
        initialDraft:remoteDraft,
        canEditRemote:canEdit()&&['borrador','en_revision'].includes(b.status),
        saveRemote:async document=>{
          if(pci?.pci_id!==b.pci_id)throw Error('Se cambió de PCI: no se permite guardar en otro.');
          const result=await saveUnit('oferta','map',unitId,baseVersion,document,revision);
          revision=Number(result.revision);
        }
      });
      $('ba15Info').textContent='Turno '+({manana:'mañana',tarde:'tarde',vespertino:'vespertino',noche:'noche'}[b.shift_id]||b.shift_id)+
        ' · Orientación '+(ORIENTATIONS.find(x=>x.id===b.orientation_id)?.name||b.orientation_id)+
        ' · Documento histórico protegido';
      $('app').classList.remove('school-home');
      renderPcis();
      if(requestedTab==='fo'){
        const go=[...$('ba15Builder').querySelectorAll('button')].find(b=>b.textContent.trim()==='Desarrollo curricular');
        go?.click();
      }
      status('BA +15: constructor C1–C8 habilitado como borrador por PCI; homologación final pendiente');
      return;
    }
    if(result.pci?.model==='tecnica'){
      ba15Controller?.destroy();ba15Controller=null;
      // Mismo editor institucional FG → Oferta → Desarrollo curricular V2.
      // La especialidad y el PCI registrados identifican la fuente y el ámbito.
      const tech=result.pci;
      if(Number(tech.school_id)!==schoolId || !tech.legacy_sha256 ||
        !tech.orientation_id || !tech.process_id)
        throw Error('Falta validar la escuela o el resguardo original de este PCI Técnico.');
      technical.close();
      pci=tech;workspace=null;auto=null;fgDirty=false;offerDirty=false;foDirty=false;
      selectedFgArea=null;selectedFoSpace=null;
      await technical.open(tech);
      show('technicalPending',false);show('ba15Pending',false);
      show('empty',false);show('editor');
      $('app').classList.remove('school-home');
      renderPcis();setTab(['fg','oferta','fo'].includes(requestedTab)?requestedTab:'fg',true);
      status('PCI Técnico · mapa C1–C12 y planes de aprendizaje');
      return;
    }
    technical.close();
    ba15Controller?.destroy();ba15Controller=null;
    show('technicalPending',false);show('ba15Pending',false);
    const p=requireSchoolPci(result.pci,schoolId);
    if(!ORIENTATIONS.some(o=>o.id===p.orientation_id))
      throw Error('La orientación no existe en el catálogo institucional.');
    const hasHistoric=p.legacy_state.profile!=='tecnica'&&
      Object.keys(p.legacy_state.areas).length>0;
    const source=hasHistoric?p.legacy_state:{...migrateState({}),schoolName:p.legacy_state.schoolName||'Escuela '+schoolId};
    const generated=createOrientationPackage({legacyState:source,schoolId,orientationIds:[p.orientation_id]});
    const imported=automaticallyValidateImportedFg({
      legacyState:source,orientationId:p.orientation_id,
      matrixRows:refs.matrix,v2FgRows:refs.fg
    });
    let working=seedOfferStructure(generated,p.orientation_id,refs);
    const saved=await getUnit(p,'oferta','map','mapa-oferta-v1','oferta-pci-orientacion-v1');
    if(saved.exists){
      working=restoreOfferUnit({pci:p,workspace:working,document:saved.document});
    }
    pci=p;workspace=working;auto=imported;fgSourceState=source;offerRevision=Number(saved.revision)||0;
    fgDirty=false;offerDirty=false;foDirty=false;selectedFgArea=null;selectedFoSpace=null;
    const offerRecovered=recallDraft('oferta','mapa-oferta-v1',offerRevision,p,
      value=>restoreOfferUnit({pci:p,workspace:working,document:value}));
    if(offerRecovered){
      workspace=restoreOfferUnit({pci:p,workspace:working,document:offerRecovered});
      offerDirty=true;
    }
    $('pciName').textContent=pcis.find(i=>i.pci_id===id)?.title||p.orientation_id;
    $('pciTag').textContent=ORIENTATIONS.find(o=>o.id===p.orientation_id)?.name||'Orientación';
    $('pciInfo').textContent=(hasHistoric?'Origen histórico de Media protegido':
      p.legacy_state.profile==='tecnica'?'PCI Media independiente; origen técnico preservado sin importar':'Plantilla nueva (documento original vacío)')+
      ' · '+p.status+' · '+AUTO_VALIDATION_LABEL;
    $('saveOffer').disabled=!canEdit()||!['borrador','en_revision'].includes(p.status);
    const inv=inventory(source);
    const host=$('metrics');host.replaceChildren();
    for(const [num,label] of [[inv.areas,'Áreas FG'],[inv.groups,'Agrupamientos preservados'],[inv.plans,'Planes anteriores']]){
      const item=elem('div',undefined,'metric');note('strong',num,item);note('small',label,item);host.appendChild(item);
    }
    show('empty',false);show('editor');
    $('app').classList.remove('school-home');
    renderPcis();setTab(['fg','oferta','fo'].includes(requestedTab)?requestedTab:'fg',true);renderAreas();
    message('PCI cargado. El guardado es siempre explícito y nunca reemplaza la matriz histórica.');
    status('Listo para editar');
  }catch(error){status('No se abrió el PCI','error');message(error.message,'error');}
}
async function getUnit(forPci,component,unitKind,unitId,baseVersion){
  return call('get-school-pci-unit',{
    school_id:schoolId,pci_id:forPci.pci_id,component,unit_kind:unitKind,unit_id:unitId,base_version:baseVersion
  });
}
async function saveUnit(component,unitKind,unitId,baseVersion,document,revision){
  const result=await call('save-school-pci-unit',{
    school_id:schoolId,pci_id:pci.pci_id,component,unit_kind:unitKind,unit_id:unitId,
    base_version:baseVersion,document,expected_revision:revision
  });
  const next=Number(result.revision);
  if(result.ok!==true||!Number.isSafeInteger(next)||next!==revision+1)
    throw Error('El servidor no confirmó una revisión nueva. Se conserva el borrador.');
  const remote=await getUnit(pci,component,unitKind,unitId,baseVersion);
  if(!remote.exists||Number(remote.revision)!==next||!equivalent(remote.document,document))
    throw Error('La lectura posterior no coincide con el guardado. Conservá el borrador y revisá antes de continuar.');
  return result;
}
function setTab(next,force=false){
  if(!['fg','oferta','fo'].includes(next))return;
  // Cambiar de pestaña técnica no descarta el borrador; cambia solo de vista.
  if(!technical.active && !force && !canLeave())return;
  tab=next;
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===next));
  for(const name of ['fg','offer','fo'])show(name+'Pane',next===(name==='offer'?'oferta':name));
  if(technical.active){technical.renderTab(next);return;}
  if(next==='oferta')renderOffer();
  if(next==='fo')renderFoSpaces();
}
function renderAreas(){
  const host=$('areaList');host.replaceChildren();
  const areas=Object.keys(fgSourceState?.areas||{});
  if(!areas.length)note('p','Esta escuela aún no tiene agrupamientos FG; se podrán construir dentro del proceso.',host,'muted');
  areas.forEach(area=>{
    const groups=fgSourceState.areas[area]?.groups||[];
    const button=elem('button',undefined,'areaItem'+(area===selectedFgArea?' active':''));button.type='button';
    note('strong',area,button);note('small',groups.length+' agrupamientos de origen',button);
    button.onclick=()=>openFgArea(area);host.appendChild(button);
  });
}
async function openFgArea(area){
  if(fgDirty&&!confirm('Hay cambios de FG sin guardar. ¿Abrir otra área sin guardar?'))return;
  try{
    const saved=await getUnit(pci,'fg','area',area,'fg-sec-aprende-v2/1');
    const serverDoc=saved.exists?guardFgUnit(saved.document,pci,area):
      newFgUnit({pci,area,convertedAreas:auto.currentFg.areas});
    const currentRevision=Number(saved.revision)||0;
    const recovered=recallDraft('fg',area,currentRevision,pci,
      value=>guardFgUnit(value,pci,area));
    selectedFgArea=area;fgDoc=recovered||serverDoc;fgRevision=currentRevision;fgDirty=!!recovered;
    renderAreas();renderFgEditor();
  }catch(error){message(error.message,'error');}
}
function renderFgEditor(){
  const host=$('areaEditor');host.replaceChildren();if(!fgDoc)return;
  note('h3',selectedFgArea,host);
  note('p','Copia independiente · Revisión '+fgRevision+' · '+(fgRevision?'Guardada':'Sin guardar aún'),host,'muted');
  for(const [gi,g] of fgDoc.groups.entries()){
    const card=elem('div',undefined,'workCard');
    note('strong',(g.name||'Espacio '+(gi+1))+' · '+(g.level||'nivel s/d'),card);
    note('p',(g.items||[]).length+' contenidos · '+(g.plansBimestrales||[]).length+' planes · C'+(g.startTerm||'?'),card);
    card.appendChild(field('Sinopsis / descripción del espacio',g.summary??g.synopsis??'',v=>{
      g.summary=v;markDirty('fg');message('Cambios de FG pendientes de guardar.','warn');
    }));
    (g.plansBimestrales||[]).forEach((plan,pi)=>{
      const details=elem('details');const summary=elem('summary',plan.name||'Plan '+(pi+1));details.appendChild(summary);
      details.appendChild(field('Sinopsis',plan.synopsis||'',v=>{plan.synopsis=v;markDirty('fg');}));
      details.appendChild(field('Objetivos',plan.objectives||'',v=>{plan.objectives=v;markDirty('fg');}));
      for(const stage of stages){
        const val=plan.stages?.[stage];
        const label=stageLabel[stage];
        details.appendChild(field(label,typeof val==='string'?val:val?.description||'',v=>{
          const edited=editStageDescription(plan,stage,v);
          plan.stages=edited.stages;markDirty('fg');
        }));
      }
      card.appendChild(details);
    });
    host.appendChild(card);
  }
  const actions=elem('div',undefined,'actions');
  const save=elem('button','Guardar esta área de FG','btn primary');save.type='button';
  save.disabled=!canEdit()||!['borrador','en_revision'].includes(pci.status);
  save.onclick=()=>safeSave(async()=>{
    const payload=guardFgUnit(fgDoc,pci,selectedFgArea);
    const reply=await saveUnit('fg','area',selectedFgArea,'fg-sec-aprende-v2/1',payload,fgRevision);
    fgRevision=Number(reply.revision);fgDirty=false;forgetDraft('fg',selectedFgArea);
    renderFgEditor();message('Área FG guardada en el PCI de esta orientación. La matriz histórica no cambió.');
  }).catch(()=>{});
  actions.appendChild(save);
  const backup=elem('button','Descargar borrador FG','btn');backup.type='button';
  backup.onclick=()=>download('fg-borrador-'+schoolId+'-'+pci.orientation_id+'-'+selectedFgArea+'.json',fgDoc);
  actions.appendChild(backup);host.appendChild(actions);
}
function getCurrentOffer(){return workspace?.orientations?.[pci.orientation_id]?.fo;}
function renderOffer(){
  if(!pci||!workspace)return;
  const head=$('mapHead'),body=$('mapBody');head.replaceChildren();body.replaceChildren();
  const rows=offerMapRows(workspace,pci.orientation_id);
  const tr=elem('tr');note('th','Área / Nivel',tr);
  rows.forEach(r=>note('th','C'+r.term+'\n'+r.year+'º',tr));head.appendChild(tr);
  for(const kind of ['fg','fo']){
    const row=elem('tr');note('th',kind==='fg'?'FG (conservada)':'FO (por orientación)',row);
    rows.forEach(r=>{
      const td=elem('td');(r[kind]||[]).forEach(x=>{
        const label=kind==='fg'?x.name||x.area:x.name||x.kind;
        note('span',label,td,'slot');
      });row.appendChild(td);
    });body.appendChild(row);
  }
  const grid=$('offerGrid');grid.replaceChildren();
  const current=getCurrentOffer(),alternative=current.subjectAlternative||'A';
  $('foAlternative').value=alternative;
  $('foAlternative').disabled=!canEdit()||current.spaces.some(s=>s.kind!=='proyecto'&&(s.members||[]).length>0);
  $('confirmFoContents').disabled=!canEdit();
  let bank;
  try{bank=foSubjectBank({orientationId:pci.orientation_id,refs,alternative});}
  catch(error){note('p',error.message,grid,'muted');return;}
  for(const space of current.spaces){
    const card=elem('div',undefined,'offerCard');
    note('h4',space.name,card);
    note('p',(space.year+'º · C'+(space.term||space.startTerm)+' · '+space.kind),card,'muted');
    const ul=elem('ul');(space.members||[]).forEach(m=>note('li',m.name||m.subject||m.id,ul));
    if(!space.members?.length)note('li','Sin materias asignadas',ul);
    card.appendChild(ul);
    if(space.kind==='proyecto'){
      // El PVF pertenece a la FO de quinto año y es anual (C9-C10);
      // no hay dos proyectos ni se duplica su carga horaria.
      const expected=pvfReference(pci.orientation_id,alternative);
      const audit=validatePvfProject(space,{orientationId:pci.orientation_id,alternative});
      note('p','5.º año · ANUAL C9–C10 · Alternativa '+alternative+
        ' · '+expected.hours+' h · Anexo II 17/11/2026 (pp. 11–12)',card,'muted');
      note('p','Espacio previsto: '+expected.name,card,'muted');
      if(!audit.valid){
        note('p','Revisión necesaria: '+audit.errors.join(' · '),card,'muted');
        // Solo se autocompleta si el proyecto nunca tuvo materias.
        if(!(space.members||[]).length){
          const apply=elem('button','Asignar espacio según tabla A/B','btn');apply.type='button';
          apply.disabled=!canEdit();
          apply.onclick=()=>{
            try{
              workspace=assignPvfReference(workspace,pci.orientation_id);
              markDirty('oferta');renderOffer();
              message('Proyecto de Vinculación asignado según la tabla. Falta guardar el mapa.','warn');
            }catch(error){message(error.message,'error')}
          };
          card.appendChild(apply);
        }
      }
    }
    if(space.kind!=='proyecto'){
      const select=elem('select');select.setAttribute('aria-label','Materia para '+space.name);
      (bank.subjects||[]).filter(s=>Number(s.year)===Number(space.year)).forEach(subject=>{
        const option=elem('option',subject.name+' · '+(subject.hours??'?')+' hs');option.value=subject.id;select.appendChild(option);
      });
      card.appendChild(select);
      const add=elem('button','Agregar materia FO','btn');add.type='button';
      add.disabled=!canEdit()||!select.options?.length;
      add.onclick=()=>{
        try{workspace=assignFoSubject(workspace,{orientationId:pci.orientation_id,spaceId:space.id,subjectId:select.value,refs});markDirty('oferta');renderOffer();message('Mapa modificado, pendiente de guardar.','warn');}
        catch(error){message(error.message,'error');}
      };card.appendChild(add);
    }
    const foSelect=elem('select');foSelect.setAttribute('aria-label','Contenido FO para '+space.name);
    const foList=selectFoByOrientation(refs.fo,pci.orientation_id,ORIENTATIONS);
    for(const item of foList){
      const option=elem('option',((item.block||'')+' · '+item.text).slice(0,150));option.value=item.id;foSelect.appendChild(option);
    }
    card.appendChild(foSelect);
    const addContent=elem('button','Incorporar contenido para revisión','btn');addContent.type='button';
    addContent.disabled=!canEdit()||!foList.length;
    addContent.onclick=()=>{
      try{workspace=stageFoContent(workspace,{orientationId:pci.orientation_id,spaceId:space.id,contentId:foSelect.value,foRows:foList});markDirty('oferta');renderOffer();message('Contenido FO registrado como provisional; no cuenta hasta validar la oferta.','warn');}
      catch(error){message(error.message,'error');}
    };
    card.appendChild(addContent);
    note('p',(space.provisionalContentIds?.length||0)+' contenidos en revisión · '+(space.contentIds?.length||0)+' confirmados',card,'muted');
    grid.appendChild(card);
  }
  try{
    const result=validateOfferStructure(workspace,pci.orientation_id,refs);
    // El anexo final revisa la misma copia FG/FO sin sustituirla.
    // Un "guardado" no significa que el plan curricular esté homologado.
    const normative=validateMediaWorkspaceFinal(workspace,pci.orientation_id);
    const summary=[
      'Anexo II 17/11/2026 · Bachillerato',
      normative.errors.length+' inconsistencias de composición',
      normative.warnings.length+' aspectos por verificar',
      result.errors.length+' observaciones previas del mapa',
      offerDirty?'Cambios sin guardar':'Revisión '+offerRevision
    ];
    $('offerValidation').textContent=summary.join(' · ');
    $('offerValidation').title=[...normative.errors,...normative.warnings]
      .slice(0,35).map(x=>(x.code||'')+': '+x.message).join('\n')+
      '\nRevisión previa: '+[...result.errors,...result.warnings].slice(0,35).join(' | ');
    $('offerValidation').dataset.validated='false';
  }catch(error){$('offerValidation').textContent='Validación pendiente: '+error.message;}
}
async function saveOffer(){
  if(!pci)return;
  await safeSave(async()=>{
    const payload=newOfferUnit({pci,workspace});
    const result=await saveUnit('oferta','map','mapa-oferta-v1','oferta-pci-orientacion-v1',payload,offerRevision);
    offerRevision=Number(result.revision);offerDirty=false;forgetDraft('oferta','mapa-oferta-v1');renderOffer();
    message('Mapa FO guardado con revisión '+offerRevision+'. Los demás PCI no se modificaron.');
  }).catch(()=>{});
}
function renderFoSpaces(){
  const host=$('foSpaces');host.replaceChildren();if(!pci||!workspace)return;
  const spaces=getCurrentOffer().spaces||[];
  spaces.forEach(space=>{
    const b=elem('button',undefined,'areaItem'+(selectedFoSpace===space.id?' active':''));b.type='button';
    note('strong',space.name,b);note('small',space.year+'º · C'+(space.term||space.startTerm),b);
    b.onclick=()=>openFoSpace(space.id);host.appendChild(b);
  });
}
async function openFoSpace(id){
  if(foDirty&&!confirm('Hay un plan FO sin guardar. ¿Abrir otro espacio igualmente?'))return;
  const space=getCurrentOffer().spaces.find(s=>s.id===id);if(!space)return;
  try{
    const saved=await getUnit(pci,'fo','space',space.id,'fo-sec-aprende-v2/1');
    const serverDoc=saved.exists?guardFoUnit(saved.document,pci,space.id):
      newFoUnit({pci,space,development:newFoDevelopment({orientation:pci.orientation_id,slot:space.id,format:space.kind,year:space.year})});
    const currentRevision=Number(saved.revision)||0;
    const recovered=recallDraft('fo',id,currentRevision,pci,
      value=>guardFoUnit(value,pci,space.id));
    selectedFoSpace=id;foDoc=recovered||serverDoc;foRevision=currentRevision;foDirty=!!recovered;
    renderFoSpaces();renderFoEditor();
  }catch(error){message(error.message,'error');}
}
function renderFoEditor(){
  const host=$('foEditor');host.replaceChildren();if(!foDoc)return;
  note('h3',getCurrentOffer().spaces.find(s=>s.id===selectedFoSpace)?.name||selectedFoSpace,host);
  note('p','Revisión '+foRevision+' · '+(foRevision?'Guardado':'Borrador no guardado'),host,'muted');
  const card=elem('div',undefined,'workCard');
  for(const [name,key] of [['Objetivo general','objective'],['Sinopsis general','synopsis'],['Contexto problematizador','context'],['Práctica / producto / eje','practiceAxis']]){
    card.appendChild(field(name,foDoc[key],v=>{foDoc[key]=v;markDirty('fo');}));
  }
  for(const [pi,plan] of (foDoc.plansBimestrales||[]).entries()){
    const details=elem('details');if(pi===0)details.open=true;
    details.appendChild(elem('summary',plan.name||'Plan bimestral '+(pi+1)));
    for(const [label,key] of [['Sinopsis','synopsis'],['Objetivos de aprendizaje','objectives']]){
      details.appendChild(field(label,plan[key],v=>{plan[key]=v;markDirty('fo');}));
    }
    for(const id of stages){
      details.appendChild(field(stageLabel[id],plan.stages?.[id]?.description||'',v=>{
        plan.stages={...plan.stages,[id]:{...(plan.stages?.[id]||{}),description:v}};
        markDirty('fo');
      }));
    }
    card.appendChild(details);
  }
  host.appendChild(card);
  const actions=elem('div',undefined,'actions');
  const save=elem('button','Guardar planes FO','btn primary');save.type='button';
  save.disabled=!canEdit()||!['borrador','en_revision'].includes(pci.status);
  save.onclick=()=>safeSave(async()=>{
    const space=getCurrentOffer().spaces.find(s=>s.id===selectedFoSpace);
    const payload=newFoUnit({pci,space,development:foDoc});
    const reply=await saveUnit('fo','space',selectedFoSpace,'fo-sec-aprende-v2/1',payload,foRevision);
    foRevision=Number(reply.revision);foDirty=false;forgetDraft('fo',selectedFoSpace);renderFoEditor();
    message('Planes FO guardados con revisión '+foRevision+'.');
  }).catch(()=>{});
  actions.appendChild(save);
  const backup=elem('button','Descargar planes FO','btn');backup.type='button';
  backup.onclick=()=>download('fo-borrador-'+schoolId+'-'+pci.orientation_id+'-'+selectedFoSpace+'.json',foDoc);
  actions.appendChild(backup);host.appendChild(actions);
}
init();
