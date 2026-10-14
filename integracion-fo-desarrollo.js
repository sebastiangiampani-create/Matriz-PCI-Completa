/**
 * Editor de desarrollo curricular de Formación Orientada.
 *
 * Lee la oferta para conformar espacios y el catálogo oficial FO para la
 * bolsa de contenidos. Guarda solamente un BORRADOR LOCAL por orientación,
 * no modifica el mapa, la Formación General histórica ni Supabase.
 */
import { ORIENTATIONS } from './src/integracion-curricular/bridge.js';
import { loadV2Fo, selectFoByOrientation }
  from './src/integracion-curricular/catalogos.js';
import { foGroups, FO_STAGES, makeFoDraft, getFoSpace, saveFoSpace, orphanedSpaces }
  from './src/integracion-curricular/desarrollo-fo-modelo.js';

const $=id=>document.getElementById(id);
const overlay=$('pci-fo-development');
const KEY='pci-fo-development-drafts-preview-20261014';
const V2_KEY='pci-matriz-fg-v2-original-preview-20261009';
const stageFields=[
  ['description','Desarrollo de la etapa'],
  ['activities','Actividades y tareas'],
  ['resources','Recursos'],
  ['duration','Duración'],
  ['evidence','Evidencias de aprendizaje']
];
const formatName={
  laboratorios:'Laboratorios de la orientación',
  talleres:'Talleres de la orientación',
  proyecto:'Proyecto de Vinculación con el Futuro'
};
if(overlay){
 let orientation='',format='',year=3,slot='',draft=null,current=null;
 let catalog=[],ready=false,loadingError='',previousFocus=null;
 const byId=new Map();
 const orientId=name=>ORIENTATIONS.find(item=>item.name===name)?.id;
 const savedStatus=(message)=>{$('pciFoSaved').textContent=message;};
 const safeText=(element,value)=>{element.textContent=String(value??'');return element;};
 const node=(tag,className,text)=>{
   const el=document.createElement(tag);
   if(className)el.className=className;
   if(text!==undefined)safeText(el,text);
   return el;
 };
 const selectedOrientation=()=>$('pciDemoOrientationContext')?.textContent.trim()||'';
 function getMap(){
   try{
     const state=JSON.parse(localStorage.getItem(V2_KEY)||'null');
     return state?.maps?.[orientation]||null;
   }catch(_){return null;}
 }
 function loadDraft(){
   const raw=localStorage.getItem(KEY);
   let saved=null;
   try{saved=raw?JSON.parse(raw)?.orientations?.[orientation]:null;}catch(_){}
   return makeFoDraft(orientation,saved||null);
 }
 function persist(){
   if(!current||!draft)return;
   // Nunca escribir el estado real pciAppV2 ni el mapa.
   draft=saveFoSpace(draft,current);
   let state={version:1,orientations:{}};
   try{
     const previous=JSON.parse(localStorage.getItem(KEY)||'null');
     if(previous?.version===1&&previous.orientations&&typeof previous.orientations==='object')
       state=previous;
   }catch(_){}
   state.orientations[orientation]=draft;
   try{
     localStorage.setItem(KEY,JSON.stringify(state));
     savedStatus('Borrador local guardado · No publicado en la escuela');
   }catch(e){
     savedStatus('El navegador no pudo guardar el borrador: '+e.message);
   }
 }
 function groups(){return foGroups(getMap(),format);}
 function years(){
   const available=groups().map(g=>g.year);
   return [...new Set(available)].sort();
 }
 function subjectCatalog(){
   const id=orientId(orientation);
   if(!id)return [];
   const selection=selectFoByOrientation(catalog,id,ORIENTATIONS);
   return selection;
 }
 function resetYear(asked=null){
   const list=years();
   const next=Number(asked);
   year=list.includes(next)?next:(format==='proyecto'?5:list[0]??3);
   $('pciFoYear').value=String(year);
   renderSpaceOptions();
 }
 function renderSpaceOptions(preferred=''){
   const values=groups().filter(g=>g.year===year);
   if(preferred&&values.some(g=>g.id===preferred))slot=preferred;
   else if(!values.some(g=>g.id===slot))slot=values[0]?.id||'';
   const select=$('pciFoSpace');
   select.replaceChildren();
   for(const [index,group] of values.entries()){
     const opt=node('option','',group.term===null?'Espacio anual · C9–C10':
       'Espacio '+(index+1)+' · C'+group.term);
     opt.value=group.id;
     select.appendChild(opt);
   }
   select.disabled=!values.length;
   if(slot)select.value=slot;
   renderSpace();
 }
 function saveInput(name,value) {
   if(!current)return;
   current[name]=value;persist();
 }
 function activePlan(){
   return current?.plansBimestrales?.[Number($('pciFoPlan').value)||0];
 }
 function savePlan(name,value){
   const plan=activePlan();
   if(!plan)return;
   plan[name]=value;
   persist();
 }
 function renderPlan(){
   const plan=activePlan();
   if(!plan)return;
   $('pciFoPlanName').value=plan.name||'';
   $('pciFoPlanObjectives').value=plan.objectives||'';
   $('pciFoPlanSynopsis').value=plan.synopsis||'';
   renderPlanContents();
   const holder=$('pciFoStages');holder.replaceChildren();
   for(const stage of FO_STAGES){
     const data=plan.stages?.[stage.id]||{};
     const section=node('section','pci-fo-stage');
     section.appendChild(node('h4','',stage.label));
     const fields=node('div','pci-fo-fields-grid');
     for(const [key,label] of stageFields){
       const wrap=node('label','',label);
       const textarea=node('textarea');
       textarea.rows=key==='description'||key==='activities'?3:2;
       textarea.value=String(data[key]||'');
       textarea.dataset.stage=stage.id;textarea.dataset.field=key;
       wrap.appendChild(textarea);fields.appendChild(wrap);
     }
     section.appendChild(fields);holder.appendChild(section);
   }
 }
 function renderPlanContents(){
   const wrap=$('pciFoPlanContents');wrap.replaceChildren();
   if(!current?.items?.length){
     wrap.appendChild(node('p','pci-fo-muted',
       'Elegí contenidos de la bolsa para incorporarlos a este plan.'));
     return;
   }
   const plan=activePlan();
   for(const id of current.items){
     const row=node('label','pci-fo-check-row');
     const cb=node('input');cb.type='checkbox';cb.value=id;
     cb.checked=plan.contentIds?.includes(id);
     cb.dataset.planContent=id;
     row.appendChild(cb);
     row.appendChild(node('span','',byId.get(id)?.text||id));
     wrap.appendChild(row);
   }
 }
 function renderAssigned(){
   const container=$('pciFoAssignedContents');container.replaceChildren();
   if(!current?.items.length){
     container.appendChild(node('p','pci-fo-muted',
       'Todavía no hay contenidos incorporados. Seleccionalos desde la bolsa.'));
     return;
   }
   for(const id of current.items){
     const item=node('div','pci-fo-assigned-item');
     const desc=byId.get(id);
     item.appendChild(node('span','',desc?
       (desc.block+' · '+desc.text):id));
     const remove=node('button','pci-fo-remove','Quitar');
     remove.type='button';remove.dataset.remove=id;
     item.appendChild(remove);container.appendChild(item);
   }
 }
 function renderCatalog(){
   const list=$('pciFoContentList');list.replaceChildren();
   const count=$('pciFoContentCount');
   if(!ready){
     safeText(count,loadingError||
       'Cargando contenidos priorizados de Formación Orientada…');
     return;
   }
   const rows=subjectCatalog();
   const query=$('pciFoSearch').value.trim().toLowerCase();
   const filtered=rows.filter(item=>
     !query||[item.block,item.axis,item.subaxis,item.text].some(v=>
       String(v||'').toLowerCase().includes(query)));
   safeText(count,rows.length?
     (filtered.length+' visibles · '+rows.length+' contenidos disponibles en la trayectoria'):
     'No hay contenidos FO específicos en este catálogo para esta orientación. No se crean datos de ejemplo.');
   for(const row of filtered.slice(0,220)){
     const label=node('label','pci-fo-content-choice');
     const check=node('input');check.type='checkbox';
     check.value=row.id;check.dataset.foContent=row.id;
     check.checked=!!current?.items.includes(row.id);
     check.disabled=!current;
     const body=node('span');
     body.appendChild(node('strong','',row.block||'Formación Orientada'));
     body.appendChild(node('small','',row.axis+
       (row.subaxis?' · '+row.subaxis:'')+' · '+row.text));
     label.append(check,body);list.appendChild(label);
   }
   if(filtered.length>220)list.appendChild(node('p','pci-fo-muted',
     'Refiná la búsqueda para ver los demás contenidos.'));
 }
 function renderSpace(){
   const empty=$('pciFoEmpty'),fields=$('pciFoFields');
   const group=groups().find(g=>g.id===slot && g.year===year);
   empty.hidden=!!group;fields.hidden=!group;
   if(!group){
     current=null;renderCatalog();
     savedStatus('Este año todavía no tiene espacios de este formato. El desarrollo existente se conserva.');
     return;
   }
   const state=getFoSpace(draft,group);
   current=state.data;
   safeText($('pciFoMembers'),state.members.length?
     ('Materias ubicadas en la oferta: '+state.members.join(' · ')):
     'Este espacio todavía no tiene materias ubicadas en el Mapa de la Oferta.');
   $('pciFoReviewWarning').hidden=!state.needsReview;
   safeText($('pciFoReviewWarning'),state.needsReview?
     'Revisar espacio: cambió el formato o el año respecto del desarrollo existente. No se borró ningún plan.':'');
   for(const [key,id] of [['objective','pciFoObjective'],['synopsis','pciFoSynopsis'],
     ['context','pciFoProblemContext'],['practiceAxis','pciFoPracticeAxis']]){
      $(id).value=String(current[key]||'');
   }
   $('pciFoContextField').hidden=format!=='laboratorios';
   $('pciFoPracticeField').hidden=format!=='talleres';
   $('pciFoPlan').value='0';
   renderAssigned();renderPlan();renderCatalog();
   savedStatus('Vista de prueba · edición local independiente del trabajo escolar');
 }
 function renderAll(){
   safeText($('pciFoTitle'),formatName[format]||'Desarrollo curricular');
   safeText($('pciFoContext'),'Orientación: '+orientation);
   const w=$('pciFoYear');w.replaceChildren();
   for(const n of [3,4,5]){
     const option=node('option','',n+'.º año');option.value=String(n);
     w.appendChild(option);
   }
   resetYear(year);
   const unused=orphanedSpaces(draft,getMap());
   if(unused.length)$('pciFoReviewWarning').title=
     unused.length+' espacios antiguos conservados aunque hayan salido del mapa.';
 }
 function open(formatId,requestedYear=null){
   if(!formatName[formatId])return;
   const name=selectedOrientation();
   if(!name)return;
   previousFocus=document.activeElement;
   orientation=name;format=formatId;
   draft=loadDraft();
   year=Number(requestedYear)||(format==='proyecto'?5:3);
   overlay.hidden=false;
   document.body.classList.add('pci-fo-development-open');
   renderAll();
   $('pciFoClose').focus();
 }
 function close(){
   overlay.hidden=true;
   document.body.classList.remove('pci-fo-development-open');
   current=null;slot='';
   if(previousFocus?.isConnected)previousFocus.focus();
 }
 $('pciFoClose').addEventListener('click',close);
 $('pciFoYear').addEventListener('change',e=>{year=Number(e.target.value);renderSpaceOptions();});
 $('pciFoSpace').addEventListener('change',e=>{slot=e.target.value;renderSpace();});
 $('pciFoSearch').addEventListener('input',renderCatalog);
 for(const [id,key] of [['pciFoObjective','objective'],['pciFoSynopsis','synopsis'],
    ['pciFoProblemContext','context'],['pciFoPracticeAxis','practiceAxis']]){
   $(id).addEventListener('input',e=>saveInput(key,e.target.value));
 }
 for(const [id,key] of [['pciFoPlanName','name'],['pciFoPlanObjectives','objectives'],
    ['pciFoPlanSynopsis','synopsis']]){
   $(id).addEventListener('input',e=>savePlan(key,e.target.value));
 }
 $('pciFoPlan').addEventListener('change',renderPlan);
 $('pciFoStages').addEventListener('input',e=>{
   const field=e.target.dataset.field,stage=e.target.dataset.stage;
   const plan=activePlan();
   if(!plan?.stages?.[stage]||!stageFields.some(x=>x[0]===field))return;
   plan.stages[stage][field]=e.target.value;
   persist();
 });
 $('pciFoContentList').addEventListener('change',e=>{
   const id=e.target.dataset.foContent;
   if(!id||!current||!byId.has(id))return;
   const selected=new Set(current.items);
   if(e.target.checked)selected.add(id);
   else selected.delete(id);
   current.items=[...selected];
   if(!e.target.checked){
     for(const plan of current.plansBimestrales)
       plan.contentIds=plan.contentIds.filter(x=>x!==id);
   }
   persist();renderAssigned();renderPlanContents();
 });
 $('pciFoAssignedContents').addEventListener('click',e=>{
   const id=e.target.closest('button[data-remove]')?.dataset.remove;
   if(!id||!current)return;
   current.items=current.items.filter(x=>x!==id);
   for(const plan of current.plansBimestrales)
     plan.contentIds=plan.contentIds.filter(x=>x!==id);
   persist();renderAssigned();renderPlanContents();renderCatalog();
 });
 $('pciFoPlanContents').addEventListener('change',e=>{
   const id=e.target.dataset.planContent;
   const plan=activePlan();
   if(!id||!plan||!current.items.includes(id))return;
   const ids=new Set(plan.contentIds);
   if(e.target.checked)ids.add(id);else ids.delete(id);
   plan.contentIds=[...ids];persist();
 });
 $('pciFoMapOpen').addEventListener('click',()=>{
   const y=year;close();
   $('pciMapYear').value=String(y);
   $('pciMapOpen').click();
 });
 document.addEventListener('keydown',e=>{
   if(e.key==='Escape'&&!overlay.hidden)close();
 });
 window.PCIFoDesarrollo={open,close};
 // Los contenidos oficiales no tienen año FO explícito: el docente determina
 // los contenidos de cada espacio y plan, sin porcentajes inventados.
 loadV2Fo().then(rows=>{
   catalog=rows;ready=true;
   for(const row of rows)byId.set(row.id,row);
   if(!overlay.hidden)renderCatalog();
 }).catch(error=>{
   ready=false;loadingError='No se pudo cargar el catálogo FO: '+error.message;
   if(!overlay.hidden)renderCatalog();
 });
}