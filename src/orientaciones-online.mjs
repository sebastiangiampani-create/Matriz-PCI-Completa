/**
 * Portal de orientaciones institucionales, diseñado para activarse luego del
 * despliegue verificado de pci_workspace + pci_collaboration + Edge.
 * No hace escritura al cargar, ni usa localStorage, ni toca pci_proposals.data.
 */
import {ORIENTATIONS,createOrientationPackage} from './integracion-curricular/bridge.js';
import {agruparPcis,TURNOS} from './pci-turnos-organizacion.mjs';
import {parsePciRoute,pciRouteHref,samePciRoute} from './pci-router.mjs';
import {migrateState} from '../pci-model.js';
import {mostrarMapaBa15} from './ba15/mapa-ui.mjs';
import {montarConstructorBa15} from './ba15/constructor-ui.mjs';
import {loadMatrixContents,loadV2Fg,loadV2Fo,loadV2Rules,selectFoByOrientation} from './integracion-curricular/catalogos.js';
import {automaticallyValidateImportedFg,AUTO_VALIDATION_LABEL} from './integracion-curricular/auto-validacion-importacion.js';
import {seedOfferStructure,foSubjectBank,assignFoSubject,validateOfferStructure,stageFoContent,setFoAlternative,assignPvfReference,confirmFoContentAfterOffer} from './integracion-curricular/mapa-oferta.js';
import {withComposition,compositionFor,arrangementWarnings} from './integracion-curricular/constructor-mapa-unificado.mjs';
import {phaseGate,phaseText} from './pci-flujo-fases.mjs';
import {proposedFgAreas,emptyFgAreaUnit,inheritFgComposition} from './pci-fase-desarrollo-fg.mjs';
import {renderUnifiedConstructor} from './constructor-v2-ui.mjs';
import {newFoDevelopment,FO_STAGES} from './integracion-curricular/desarrollo-fo-modelo.js';
import {pvfReference,validatePvfProject} from './integracion-curricular/proyecto-vinculacion-2026.mjs';
import {validateMediaWorkspaceFinal} from './normativa/adaptador-mapa-media-20261117.mjs';
import {SPECIALTIES,findSpecialty} from './tecnica/pautas-pci-20261005.mjs';
import {createIntegratedTechnicalUI} from './tecnica/interfaz-integrada-v2.mjs';
import {filteredHistoricForPci,historicCountsForPci} from './vinculos-historicos.mjs';
import {createHistoricAssignmentUI} from './vinculos-historicos-ui.mjs';
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
let tab='oferta',busy=false,ba15Controller=null;
let routeDepth=0,undoingPop=false,handlingPop=false,routeInitialized=false;
const technical=createIntegratedTechnicalUI({canEdit,getUnit,saveUnit,saveSafe:safeSave,download,rememberDraft,forgetDraft,recallDraft,message,status,onPhaseChange:()=>refreshPhaseState()});
const historicLinksUI=createHistoricAssignmentUI({
 call,canManage:canDeclareOrientations,notify:message,
 onChanged:()=>{renderPcis();if(pci){
   historicLinksUI.renderPreview($('pciHistoricLinks'),pci);
   historicLinksUI.renderPreview($('ba15HistoricLinks'),pci);
 }}
});

async function call(action,data={}){
  const resp=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,token:session?.token,...data}),cache:'no-store'});
  const result=await resp.json().catch(()=>({}));
  if(!resp.ok){const e=Error(result.error||(resp.status===409?'Conflicto: otro editor guardó cambios. Conservá tu borrador y revisá la versión del servidor.':'No se pudo consultar Supabase.'));e.status=resp.status;throw e;}
  return result;
}
function message(str,kind=''){const p=$('message');p.textContent=str;p.className='message '+kind;}
function status(str,kind=''){const p=$('status');p.textContent=str;p.className='status '+kind;}
function fatal(str){$('fatal').textContent=str;show('fatal');status('No disponible','error');}
function showAuthRequired(reason='Ingresá con las credenciales habituales de la plataforma.'){
  $('authHelp').textContent=reason;
  show('authRequired',true);
  show('fatal',false);
  show('app',false);
  status('Ingresá para continuar');
}
function canEdit(){return !!session && (session.role==='admin'||session.role==='editor'||session.role==='user'&&(session.permissions||[]).includes('pci.edit'));}
function canDeclareOrientations(){
  // El referente institucional puede INFORMAR orientaciones y turnos de
  // su propia escuela, pero no editar contenidos, FG ni planes de aprendizaje.
  return canEdit()||session?.role==='school_admin';
}
function hasUnsaved(){
  return !!(fgDirty||foDirty||offerDirty||historicLinksUI.isDirty||technical.isDirty()||ba15Controller?.isDirty()||busy);
}
function canLeave(){
  if(!hasUnsaved())return true;
  return confirm('Este PCI tiene cambios sin guardar o un guardado en curso. Si salís, la versión online no incluirá esos cambios. ¿Querés salir igualmente?');
}
function updateNavigationLinks(){
  const home=pciRouteHref(location.href,{schoolId,pciId:null});
  for(const id of ['schoolHomeLink','brandHomeLink'])$(id).href=home;
  const role=session?.role,permission=session?.permissions||[];
  const admin=role==='admin'||role==='user'&&(permission.includes('dashboard.view')||permission.includes('institutional.view'));
  $('adminPanelLink').hidden=!admin;
  $('schoolPanelLink').hidden=!(admin||role==='school_admin');
  $('schoolPanelLink').href='panel-escuela.html?school='+encodeURIComponent(schoolId)+(admin?'&admin=1':'');
}
function writeRoute(mode='push',pciId=pci?.pci_id||null,view=tab){
  if(!schoolId)return;
  const next=pciRouteHref(location.href,{schoolId,pciId,view});
  const old=location.pathname+location.search+location.hash;
  if(mode==='none')return;
  if(mode==='push'&&next===old)return;
  const depth=mode==='push'?routeDepth+1:routeDepth;
  history[mode==='push'?'pushState':'replaceState']({scope:'pci-v2-route',depth},'',next);
  routeDepth=depth;routeInitialized=true;
  updateNavigationLinks();
}
async function onHistoryChange(event){
  if(undoingPop){undoingPop=false;return}
  if(handlingPop||event.state?.scope!=='pci-v2-route')return;
  const destination=parsePciRoute(location.href);
  const targetDepth=Number(event.state.depth)||0;
  const current={schoolId,pciId:pci?.pci_id||null,view:tab};
  if(samePciRoute(destination,current)){routeDepth=targetDepth;return;}
  const stayingInsidePci=destination.schoolId===schoolId&&
    !!destination.pciId&&destination.pciId===pci?.pci_id;
  if(!stayingInsidePci&&!canLeave()){
    // Volver/Avanzar no descarta un borrador: cancelar restaura
    // la entrada exacta del historial que tenía el usuario.
    undoingPop=true;
    history.go(targetDepth<routeDepth?1:-1);
    return;
  }
  handlingPop=true;
  try{
    if(destination.schoolId!==schoolId){
      if(!schools.some(x=>Number(x.school_id)===destination.schoolId))
        throw Error('La escuela de esta dirección no está disponible para esta sesión.');
      schoolId=destination.schoolId;
      $('school').value=String(schoolId);
      await reloadSchool();
    }
    if(destination.pciId){
      if(!pcis.some(x=>x.pci_id===destination.pciId))
        throw Error('El PCI indicado en el historial no pertenece a esta escuela.');
      if(stayingInsidePci){
        // Cambiar de pestaña NO vuelve a descargar ni reemplazar el
        // documento FG/FO que está abierto y quizá aún no fue guardado.
        if(pci.model==='ba15'){
          const next=destination.view==='fo'?'fo':'oferta';
          const changed=ba15Controller?.setPhase(next,{silent:true});
          tab=changed?next:'oferta';
        }else setTab(destination.view,true,'none');
      }else await openPci(destination.pciId,destination.view,'none',true);
    }else if(pci){
      returnToSchool('none',true);
    }
    routeDepth=targetDepth;
    if(destination.pciId&&tab!==destination.view)writeRoute('replace',pci?.pci_id,tab);
    updateNavigationLinks();
  }catch(error){
    message('No se pudo recuperar la navegación: '+error.message,'error');
    writeRoute('replace',pci?.pci_id||null,tab);
  }finally{handlingPop=false}
}
function goHome(event){
  if(event&&(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0))return;
  if(event)event.preventDefault();
  returnToSchool('push');
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
  // La entrada desde cada panel prioriza su sesión vigente. No se transmite
  // ningún token por URL y la API vuelve a validar permisos por escuela.
  const source=new URLSearchParams(location.search).get('from');
  const keys=source==='panel-general'
    ? ['pci_admin_monitor_session','pci_access_session','pci_school_admin_session']
    : source==='panel-escuela'
      ? ['pci_school_admin_session','pci_access_session','pci_admin_monitor_session']
      : ['pci_access_session','pci_admin_monitor_session','pci_school_admin_session'];
  for(const key of keys){
    try{const s=JSON.parse(sessionStorage.getItem(key)||'null');if(s?.token)return s;}catch{}
  }
  return null;
}
async function init(){
  try{
    session=readSession();
    if(!session?.token){
      showAuthRequired('Usá el mismo usuario o clave institucional de siempre. Después de ingresar, volverás automáticamente a esta pantalla.');
      return;
    }
    const verified=await call('session-info');session={...session,...verified};
    await loadReferences();
    const requestedRoute=parsePciRoute(location.href);
    const requested=requestedRoute.schoolId;
    if(session.role==='admin'||session.role==='user'){
      const result=await call('list-schools');schools=result.schools||[];
      const possible=schools.find(s=>Number(s.school_id)===requested);
      if(requested&&!possible)throw Error('Esta escuela no está autorizada para la sesión actual.');
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
    sel.addEventListener('change',async()=>{
      const previous=schoolId,next=Number(sel.value);
      if(next===previous)return;
      if(!canLeave()){sel.value=String(previous);return;}
      try{
        schoolId=next;
        await reloadSchool();
        writeRoute('push',null,'oferta');
        status('Escuela seleccionada: '+schools.find(s=>Number(s.school_id)===schoolId)?.name);
      }catch(error){
        schoolId=previous;sel.value=String(previous);
        await reloadSchool().catch(()=>{});
        message('No se pudo cambiar de escuela: '+error.message,'error');
      }
    });
    $('btnAddPci').disabled=!canDeclareOrientations();
    $('turnFilter').addEventListener('change',renderPcis);
    document.querySelectorAll('[data-back-to-school]').forEach(btn=>btn.addEventListener('click',()=>returnToSchool('push')));
    for(const id of ['schoolHomeLink','brandHomeLink'])$(id).addEventListener('click',goHome);
    window.addEventListener('popstate',onHistoryChange);
    $('btnAddPci').onclick=()=>openPciForm();
    $('cancelPci').onclick=()=>show('formCreatePci',false);
    const o=$('orientation');
    ORIENTATIONS.forEach(x=>{const opt=elem('option',x.name);opt.value=x.id;o.appendChild(opt);});
    for(const id of ['orientation','specialtyName','pciShift']){
      $(id).addEventListener('change',suggestPciTitle);
    }
    populateSpecialties();
    $('pciModel').addEventListener('change',updatePciModelFields);
    updatePciModelFields();
    $('formCreatePci').addEventListener('submit',createPci);
    $('downloadOriginal').onclick=()=>{
      if(pci)download('pci-fg-original-escuela-'+schoolId+'-'+pci.orientation_id+'.json',{
        source_sha256:pci.legacy_sha256,school_id:schoolId,pci_id:pci.pci_id,original_state:pci.legacy_state
      });
    };
    document.querySelectorAll('.tab').forEach(el=>el.onclick=()=>setTab(el.dataset.tab));
    $('saveOffer').onclick=()=>technical.active?technical.saveOffer():saveOffer();
    $('continueDevelopment').onclick=()=>setTab('fg',true);
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
    window.addEventListener('beforeunload',e=>{if(hasUnsaved()){e.preventDefault();e.returnValue='';}});
    show('app');
    await reloadSchool();
    if(!pcis.length&&canDeclareOrientations()&&new URLSearchParams(location.search).get('nuevo')==='1')
      openPciForm();
    routeDepth=Number(history.state?.scope==='pci-v2-route'?history.state.depth:0)||0;
    if(requestedRoute.pciId){
      // No se crea una revisión ni se reemplaza ningún dato: solo se
      // recupera el PCI identificado en la misma escuela autorizada.
      if(!pcis.some(p=>p.pci_id===requestedRoute.pciId)){
        message('Este enlace ya no corresponde a un PCI de la escuela. Se abrió la selección de orientaciones.','warn');
        writeRoute('replace',null,'oferta');
      }else{
        await openPci(requestedRoute.pciId,requestedRoute.view,'replace',true);
        if(!pci||pci.pci_id!==requestedRoute.pciId)writeRoute('replace',null,'oferta');
      }
    }else writeRoute('replace',null,'oferta');
    updateNavigationLinks();
    status('Conectado');
  }catch(error){
    if(error?.status===401){
      showAuthRequired('La sesión venció o no pudo validarse. Ingresá nuevamente con tu acceso habitual; tus proyectos no se modifican.');
      return;
    }
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
  try{
    const links=await call('get-school-legacy-links',{school_id:schoolId});
    historicLinksUI.load({...links,school_id:schoolId},pcis);
  }catch(error){
    // Durante el despliegue gradual del backend se conserva la lectura V2
    // y ninguna escuela queda bloqueada por una API de vínculos no disponible.
    if(error.status===404){
      historicLinksUI.load({school_id:schoolId,rows:[],revision:0,document:null},pcis);
      message('Asignación de trabajo anterior pendiente de activación en Supabase. Ningún contenido fue modificado.','warn');
    }else throw error;
  }
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
    const box=elem('div',undefined,'school-no-pcis school-start-card');
    note('span','PRIMER INGRESO · CONSTRUCCIÓN CURRICULAR',box,'eyebrow');
    note('h3','Esta escuela todavía no tiene un PCI',box);
    note('p','El primer paso es crear su PCI: seleccioná la modalidad (Media, Técnica o BA +15), la orientación o especialidad y el turno. Después vas a construir el mapa con materias FG y FO; finalmente podrás entrar al Desarrollo Curricular de ese PCI.',box,'muted');
    const steps=elem('p','1 · Elegir modalidad y turno   →   2 · Constructor curricular   →   3 · Desarrollo curricular','school-start-steps');
    box.append(steps);
    if(canDeclareOrientations()){
      const start=elem('button','Crear primer PCI y comenzar','btn primary');
      start.id='startFirstPci';start.type='button';
      start.onclick=openPciForm;box.append(start);
    }else note('p','Solicitá a administración o a la conducción con permisos de edición la creación del primer PCI.','muted',box);
    const preservation=elem('p',undefined,'muted');
    preservation.textContent='Si la institución tiene una Formación General anterior, se conserva por separado y no se borra al crear el nuevo PCI.';
    box.append(preservation);
    host.append(box);return;
  }
  if(!displayed.length){
    note('p','Este turno no tiene PCI. Podés seleccionar otro o agregar uno nuevo.',host,'school-no-pcis');
    return;
  }
  const grid=elem('div',undefined,'school-offer-grid');
  for(const turno of displayed){
    for(const modelo of turno.modelos){
      for(const p of modelo.pcis){
        const card=elem('article',undefined,'school-offer-card area-card');
        const eyebrow=elem('div',undefined,'school-offer-top');
        const model=elem('span',modelLabelFor(p)+' · Turno '+turno.nombre,'pill');
        const statusLabel=elem('span',p.status==='borrador'?'En desarrollo':p.status==='en_revision'?'En revisión':p.status||'PCI','school-state');
        eyebrow.replaceChildren(model,statusLabel);
        card.append(eyebrow);
        const main=elem('div',undefined,'school-offer-body');
        note('h3',displayOrientation(p),main);
        note('p',p.title,main,'muted');
        if(historicLinksUI.document){
          const num=historicCountsForPci(historicLinksUI.rows,historicLinksUI.document,p);
          note('small','Histórico vinculado: '+num.general+' FG · '+num.orientada+' orientación · '+num.tecnica+' Técnica · '+num.plans+' planes',main,'muted');
        }else note('small','Trabajo histórico: asignación pendiente de definir',main,'muted');
        card.append(main);
        const bottom=elem('div',undefined,'school-offer-actions');
        const map=elem('button','1 · Constructor curricular','btn primary');
        map.type='button';
        map.setAttribute('aria-label','Abrir Mapa de la Oferta de '+p.title);
        map.onclick=()=>openPci(p.pci_id,'oferta');
        const develop=elem('button','2 · Desarrollo curricular','btn secondary');
        develop.type='button';
        develop.setAttribute('aria-label','Abrir Desarrollo Curricular de '+p.title);
        develop.onclick=()=>openPci(p.pci_id,p.model==='ba15'?'fo':'fg');
        bottom.append(map,develop);card.append(bottom);grid.append(card);
      }
    }
  }
  host.append(grid);
}
function returnToSchool(mode='push',skipGuard=false){
  if(!skipGuard&&!canLeave())return false;
  technical.close();ba15Controller?.destroy();ba15Controller=null;
  pci=null;workspace=null;auto=null;
  $('editor').classList.remove('technical-editor');
  selectedFgArea=null;selectedFoSpace=null;fgDoc=null;foDoc=null;
  fgDirty=false;foDirty=false;offerDirty=false;
  show('editor',false);show('technicalPending',false);show('ba15Pending',false);show('empty',true);
  $('app').classList.add('school-home');
  show('formCreatePci',false);
  tab='oferta';
  renderPcis();
  writeRoute(mode,null,'oferta');
  window.scrollTo(0,0);
  return true;
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
let lastSuggestedPciTitle='';
function suggestPciTitle(){
  const input=$('pciTitleInput');
  if(input.value.trim()&&input.value.trim()!==lastSuggestedPciTitle)return;
  const model=$('pciModel').value;
  const shift=$('pciShift').selectedOptions?.[0]?.textContent?.trim()||$('pciShift').value;
  const focus=model==='tecnica'?$('specialtyName').value:
    ($('orientation').selectedOptions?.[0]?.textContent?.trim()||'Orientación');
  const label=(model==='tecnica'?'Técnica':model==='ba15'?'BA +15':'Media');
  const suggestion=focus?label+' · '+focus+' · Turno '+shift:'';
  input.value=suggestion;
  lastSuggestedPciTitle=suggestion;
}
function openPciForm(){
  if(!canDeclareOrientations()){
    message('No tenés autorización para declarar orientaciones de esta escuela.','error');
    return;
  }
  show('formCreatePci',true);
  suggestPciTitle();
  $('formCreatePci').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function updatePciModelFields(){
  const technical=$('pciModel').value==='tecnica';
  show('technicalSpecialtyGroup',technical);
  show('mediaOrientationGroup',!technical);
  $('orientation').disabled=technical;
  $('orientation').required=!technical;
  $('specialtyName').disabled=!technical;
  $('specialtyName').required=technical;
  suggestPciTitle();
}
async function createPci(e){
  e.preventDefault();
  if(!canDeclareOrientations()){
    message('La sesión actual no puede declarar orientaciones de esta escuela.','error');
    return;
  }
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
    if(!title||title.length<3)throw Error('Ingresá un nombre para identificar el PCI.');
    if(!shiftId||(!orientationId&&model!=='tecnica'))throw Error('Elegí el turno y la orientación antes de crear el PCI.');
    if(pcis.some(p=>p.model===model&&p.shift_id===shiftId&&
      (model==='tecnica'?p.specialty_name===specialtyName:p.orientation_id===orientationId)))
      throw Error('Esta orientación o especialidad ya tiene un PCI en ese turno. Abrí el existente.');
    status('Creando PCI…');
    const result=await call('create-school-pci',{
      school_id:schoolId,model,shift_id:shiftId,orientation_id:orientationId,
      specialty_name:specialtyName,title
    });
    if(!result?.ok||!result?.pci_id)throw Error('El servidor no confirmó la creación de este PCI. No vuelvas a enviarlo sin actualizar.');
    show('formCreatePci',false);
    $('pciTitleInput').value='';
    lastSuggestedPciTitle='';
    $('specialtyName').value='';
    $('pciModel').value='comun';
    updatePciModelFields();
    await reloadSchool();
    await openPci(result.pci_id);
    if(!canEdit())message('Orientación y turno declarados. Para construir y desarrollar contenidos, ingresá con la clave de edición de esta escuela.','warn');
    status(model==='tecnica'?
      'Especialidad técnica registrada. Su mapa C1–C12 queda disponible para construcción y validación según el Anexo II final.':
      model==='ba15'?'PCI BA +15 creado. Podés construir y guardar su mapa C1–C8; la homologación final queda pendiente.':
      'PCI de Media creado sin modificar la matriz histórica.');
  }catch(error){status('No se creó','error');message(error.message,'error');}
}
async function openPci(id,requestedTab='oferta',routeMode='push',skipGuard=false){
  if(!skipGuard&&!canLeave())return;
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
      historicLinksUI.renderPreview($('ba15HistoricLinks'),b);
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
        savedRevision:revision,
        developmentHost:$('ba15Development'),
        onPhaseChange:next=>{tab=next;writeRoute('push',pci?.pci_id||null,next);},
        saveRemote:async document=>{
          if(pci?.pci_id!==b.pci_id)throw Error('Se cambió de PCI: no se permite guardar en otro.');
          const result=await saveUnit('oferta','map',unitId,baseVersion,document,revision);
          revision=Number(result.revision);
          return revision;
        }
      });
      $('ba15Info').textContent='Turno '+({manana:'mañana',tarde:'tarde',vespertino:'vespertino',noche:'noche'}[b.shift_id]||b.shift_id)+
        ' · Orientación '+(ORIENTATIONS.find(x=>x.id===b.orientation_id)?.name||b.orientation_id)+
        ' · Documento histórico protegido';
      $('app').classList.remove('school-home');
      renderPcis();
      tab='oferta';
      if(requestedTab==='fo'){
        if(ba15Controller.setPhase('fo',{silent:true}))tab='fo';
        else status('Primero completá y guardá el Constructor curricular BA +15 de este PCI.');
      }else status('BA +15: Fase 1 Constructor C1–C8; Fase 2 después del mapa completo y guardado');
      writeRoute(routeMode,b.pci_id,tab);
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
      const linked=filteredHistoricForPci(tech.legacy_state,historicLinksUI.document,tech);
      await technical.open(tech,linked.state);
      show('technicalPending',false);show('ba15Pending',false);
      show('empty',false);show('editor');
      historicLinksUI.renderPreview($('pciHistoricLinks'),tech);
      $('editor').classList.add('technical-editor');
      $('offerGrid').closest('details').open=true;
      $('app').classList.remove('school-home');
      renderPcis();setTab(['fg','oferta','fo'].includes(requestedTab)?requestedTab:'oferta',true,'none');
      writeRoute(routeMode,tech.pci_id,tab);
      status('PCI Técnico · Fase 1 construcción C1–C12; Fase 2 solo tras mapa revisado y guardado');
      return;
    }
    technical.close();
    ba15Controller?.destroy();ba15Controller=null;
    show('technicalPending',false);show('ba15Pending',false);
    const p=requireSchoolPci(result.pci,schoolId);
    if(!ORIENTATIONS.some(o=>o.id===p.orientation_id))
      throw Error('La orientación no existe en el catálogo institucional.');
    const linked=filteredHistoricForPci(p.legacy_state,historicLinksUI.document,p);
    const hasHistoric=Object.keys(linked.state.areas||{}).length>0&&
      (p.legacy_state.profile!=='tecnica'||linked.legacyMode==='seleccion-explicita');
    const source=hasHistoric?linked.state:{...migrateState({}),schoolName:p.legacy_state.schoolName||'Escuela '+schoolId};
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
    historicLinksUI.renderPreview($('pciHistoricLinks'),p);
    if(linked.missing.length)
      message(linked.missing.length+' grupos asignados no figuran en el resguardo original del PCI. Requieren conciliación manual; no se sobrescribió nada.','warn');
    $('editor').classList.remove('technical-editor');
    $('app').classList.remove('school-home');
    renderPcis();setTab(['fg','oferta','fo'].includes(requestedTab)?requestedTab:'oferta',true,'none');renderAreas();
    writeRoute(routeMode,p.pci_id,tab);
    const gate=refreshPhaseState();
    if(requestedTab!=='oferta'&&!gate.ready)
      message('Primero completá la Fase 1 del PCI antes de entrar al Desarrollo Curricular. '+gate.detail,'warn');
    else message('Constructor de este PCI abierto. Guardá y validá el mapa antes de desarrollar; la FG histórica no se reemplaza.');
    status('PCI · Fase 1 Constructor curricular');
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
function currentPhaseGate(){
  if(!pci)return phaseGate({issues:['Elegí un PCI para construir su mapa curricular.']});
  if(technical.active)return technical.phaseGate();
  if(pci.model==='comun'&&workspace){
    try{
      const validation=validateOfferStructure(workspace,pci.orientation_id,refs);
      const draft=compositionFor(workspace,pci);
      // Los agrupamientos propuestos no forman parte de la FG histórica;
      // deben revisarse también antes de pasar a planes.
      return phaseGate({revision:offerRevision,dirty:offerDirty,
        issues:[...(validation.errors||[]),...arrangementWarnings(draft)],
        warnings:validation.warnings||[],label:'Constructor de Media'});
    }catch(error){
      return phaseGate({revision:offerRevision,dirty:offerDirty,issues:[error.message]});
    }
  }
  return phaseGate({issues:['Todavía no se cargó el constructor de este PCI.']});
}
function refreshPhaseState(){
  const gate=currentPhaseGate();
  const label=$('pciPhaseState');
  label.textContent=phaseText(gate);
  label.classList.toggle('ready',gate.ready);
  for(const btn of document.querySelectorAll('.navtabs [data-tab]')){
    const isPlan=btn.dataset.tab!=='oferta';
    btn.setAttribute('aria-disabled',String(isPlan&&!gate.ready));
    if(isPlan)btn.title=gate.ready?'Abrir desarrollo del PCI':'Primero completá, revisá y guardá la Fase 1 de este PCI.';
  }
  $('continueDevelopment').disabled=!gate.ready;
  return gate;
}
function setTab(next,force=false,routeMode='push'){
  if(!['fg','oferta','fo'].includes(next))return false;
  // La Fase 2 solo se habilita después de un mapa completo y GUARDADO
  // del PCI seleccionado. Ningún dato histórico se borra ni se reescribe.
  if(next!=='oferta'){
    const gate=refreshPhaseState();
    if(!gate.ready){
      message('Primero completá el Constructor curricular de este PCI. '+gate.detail,'warn');
      next='oferta';
    }
  }
  // Cambiar de fase dentro del mismo PCI no descarta el documento cargado.
  // Si la Fase 1 está pendiente, la puerta curricular ya impide avanzar.
  tab=next;
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===next));
  for(const name of ['fg','offer','fo'])show(name+'Pane',next===(name==='offer'?'oferta':name));
  if(technical.active){
    technical.renderTab(next);refreshPhaseState();
    writeRoute(routeMode,pci?.pci_id,next);
    return next!=='oferta';
  }
  if(next==='oferta')renderOffer();
  if(next==='fo')renderFoSpaces();
  refreshPhaseState();
  writeRoute(routeMode,pci?.pci_id,next);
  return next!=='oferta';
}
function renderAreas(){
  const host=$('areaList');host.replaceChildren();
  const staged=workspace&&pci?compositionFor(workspace,pci):null;
  const areas=[...new Set([...Object.keys(fgSourceState?.areas||{}),...proposedFgAreas(staged)])];
  if(!areas.length)note('p','No hay agrupamientos FG. Completá primero el constructor del PCI.',host,'muted');
  areas.forEach(area=>{
    const original=fgSourceState?.areas?.[area]?.groups||[];
    const proposed=(staged?.groups||[]).filter(g=>g.area===area&&
      (g.members||[]).some(m=>m.component==='FG'));
    const button=elem('button',undefined,'areaItem'+(area===selectedFgArea?' active':''));button.type='button';
    note('strong',area,button);
    note('small',original.length+' históricos · '+proposed.length+' propuestos',button);
    button.onclick=()=>openFgArea(area);host.appendChild(button);
  });
}
async function openFgArea(area){
  if(fgDirty&&!confirm('Hay cambios de FG sin guardar. ¿Abrir otra área sin guardar?'))return;
  try{
    const original=Object.hasOwn(fgSourceState?.areas||{},area);
    const composition=compositionFor(workspace,pci);
    if(!original&&!proposedFgAreas(composition).includes(area))
      throw Error('El área no pertenece a la FG de este PCI.');
    const saved=await getUnit(pci,'fg','area',area,'fg-sec-aprende-v2/1');
    const serverDoc=saved.exists?guardFgUnit(saved.document,pci,area):
      original?newFgUnit({pci:{...pci,legacy_state:fgSourceState},area,convertedAreas:auto.currentFg.areas}):
      emptyFgAreaUnit(pci,area);
    const currentRevision=Number(saved.revision)||0;
    const recovered=recallDraft('fg',area,currentRevision,pci,
      value=>guardFgUnit(value,pci,area));
    const inherited=inheritFgComposition({unit:recovered||serverDoc,composition,pci,area});
    selectedFgArea=area;fgDoc=inherited.unit;fgRevision=currentRevision;
    fgDirty=!!recovered||inherited.changed;
    if(inherited.changed)markDirty('fg');
    renderAreas();renderFgEditor();
    if(inherited.conflicts.length)
      message('Se conservaron desarrollos anteriores: revisar manualmente materias de '+inherited.conflicts.join(', ')+'.','warn');
    else if(inherited.changed)
      message(inherited.added.length+' agrupamientos de la Fase 1 heredados en el Desarrollo FG. Guardá el área para confirmar sus planes.','warn');
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
  const grid=$('offerGrid');grid.replaceChildren();
  const current=getCurrentOffer(),alternative=current.subjectAlternative||'A';
  $('foAlternative').value=alternative;
  $('foAlternative').disabled=!canEdit()||current.spaces.some(s=>s.kind!=='proyecto'&&(s.members||[]).length>0);
  $('confirmFoContents').disabled=!canEdit();
  renderUnifiedConstructor({
    pci,workspace,refs,
    canEdit:canEdit()&&['borrador','en_revision'].includes(pci.status),
    onCompositionChange:next=>{
      try{
        workspace=withComposition(workspace,pci,next);
        markDirty('oferta');renderOffer();
      }catch(error){message('No se modificó el borrador: '+error.message,'error');}
    },
    onFoAssign:(space,subjectId)=>{
      try{
        workspace=assignFoSubject(workspace,{orientationId:pci.orientation_id,spaceId:space.id,subjectId,refs});
        markDirty('oferta');renderOffer();
        message('Materia FO incluida en la oferta de esta orientación. Falta guardar.','warn');
      }catch(error){message(error.message,'error');}
    },
    onOpenHistoricalArea:area=>{
      if(setTab('fg',true))openFgArea(area).catch(error=>message(error.message,'error'));
    },
    onOpenFoSpace:id=>{
      if(setTab('fo',true))openFoSpace(id).catch(error=>message(error.message,'error'));
    },
    onError:text=>message(text,'error'),
    onNotice:text=>message(text,'warn')
  });
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
  refreshPhaseState();
}
async function saveOffer(){
  if(!pci)return;
  await safeSave(async()=>{
    const payload=newOfferUnit({pci,workspace});
    const result=await saveUnit('oferta','map','mapa-oferta-v1','oferta-pci-orientacion-v1',payload,offerRevision);
    offerRevision=Number(result.revision);offerDirty=false;forgetDraft('oferta','mapa-oferta-v1');renderOffer();
    message('Fase 1 guardada con revisión '+offerRevision+'. El desarrollo del PCI se habilita solo al completar su composición.');
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
