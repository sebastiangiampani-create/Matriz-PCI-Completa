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
 let materiaCatalog=null;
 const byId=new Map(),selectedContents=new Set();
 const normalized=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
   .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const slug=value=>normalized(value).replace(/ /g,'-');
 const specialKind=row=>{
   const text=normalized(row.block||row.subject);
   if(text.includes('historia')&&text.includes('orientad'))return 'historia';
   if(text.includes('tecnolog')&&text.includes('informacion'))return 'tecnologia';
   return '';
 };
 function subjectLabel(id){
   const map=getMap();
   const custom=(map?.custom||[]).find(row=>row.id===id);
   if(custom?.name)return String(custom.name);
   const matched=String(id).match(/^fo-(.+)-([345])-(\d+)$/);
   if(matched&&matched[1]===slug(orientation)){
     const fo=materiaCatalog?.formacion_orientada?.[orientation];
     const list=matched[2]==='3'?fo?.['3']:fo?.[map?.alt==='B'?'B':'A']?.[matched[2]];
     if(Array.isArray(list)&&list[Number(matched[3])])return String(list[Number(matched[3])]);
   }
   return String(id);
 }
 function availableFor(group){
   const id=orientId(orientation);
   if(!id||!group)return [];
   const specific=selectFoByOrientation(catalog,id,ORIENTATIONS);
   const placed=group.members.map(subjectLabel).map(normalized);
   return specific.filter(row=>{
     const kind=specialKind(row);
     if(!kind)return true;
     if(group.year!==5)return false;
     if(kind==='tecnologia'&&group.format!=='taller')return false;
     return placed.some(name=>kind==='historia'?
       name.includes('historia')&&name.includes('orientad'):
       name.includes('tecnolog')&&name.includes('informacion'));
   });
 }

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
   persistDraft();
 }
 function persistDraft(){
   if(!draft)return;
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
   return availableFor(groups().find(g=>g.id===slot&&g.year===year));
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
   selectedContents.clear();
   renderSpace();
   renderGroupCards();
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
     item.draggable=true;item.dataset.contentId=id;item.title='Arrastrá a otro agrupamiento';
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
   const chosenBlock=$('pciFoBlockFilter').value;
   const chosenAxis=$('pciFoAxisFilter').value;
   const taken=new Set(Object.values(draft?.spaces||{}).flatMap(data=>data.items||[]));
   const blocks=[...new Set(rows.map(row=>row.block).filter(Boolean))].sort();
   const axes=[...new Set(rows.map(row=>row.axis).filter(Boolean))].sort();
   for(const [control,items] of [['pciFoBlockFilter',blocks],['pciFoAxisFilter',axes]]){
     const select=$(control),keep=select.value;
     select.replaceChildren(new Option('Todos',''));
     for(const item of items)select.appendChild(new Option(item,item));
     select.value=items.includes(keep)?keep:'';
   }
   const filtered=rows.filter(item=>
     (!query||[item.block,item.axis,item.subaxis,item.text].some(v=>
       String(v||'').toLowerCase().includes(query))) &&
     (!chosenBlock||item.block===chosenBlock)&&
     (!chosenAxis||item.axis===chosenAxis)&&
     (!$('pciFoPendingOnly').checked||!taken.has(item.id)));
   safeText(count,rows.length?
     (filtered.length+' visibles · '+rows.length+' contenidos disponibles en la trayectoria'):
     'No hay contenidos FO específicos en este catálogo para esta orientación. No se crean datos de ejemplo.');
   for(const row of filtered.slice(0,220)){
     const label=node('label','pci-fo-content-choice content-item');
     label.draggable=!!current;label.dataset.contentId=row.id;
     label.title='Arrastrá este contenido a un agrupamiento';
     const check=node('input');check.type='checkbox';
     check.value=row.id;check.dataset.foContent=row.id;
     check.checked=selectedContents.has(row.id);
     check.disabled=!current;
     const body=node('span');
     body.appendChild(node('strong','',row.block||'Formación Orientada'));
     body.appendChild(node('small','',row.axis+
       (row.subaxis?' · '+row.subaxis:'')+' · '+row.text));
     label.append(check,body);list.appendChild(label);
   }
   if(filtered.length>220)list.appendChild(node('p','pci-fo-muted',
     'Refiná la búsqueda para ver los demás contenidos.'));
   updateSelection();
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
     ('Materias ubicadas en la oferta: '+state.members.map(subjectLabel).join(' · ')):
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
   const planSelector=$('pciFoPlan');
   planSelector.replaceChildren();
   const indices=group.term===null?[0,1,2,3]:(group.term%2===1?[0,1]:[2,3]);
   for(const idx of indices)planSelector.appendChild(new Option('Bimestre '+(idx+1),String(idx)));
   planSelector.value=String(indices[0]);
   renderAssigned();renderPlan();renderCatalog();
   savedStatus('Vista de prueba · edición local independiente del trabajo escolar');
 }
 function startDrag(event){
   const item=event.target.closest('[data-content-id]');
   if(!item?.dataset.contentId)return;
   event.dataTransfer.effectAllowed='move';
   event.dataTransfer.setData('application/x-pci-content',item.dataset.contentId);
   event.dataTransfer.setData('text/plain',item.dataset.contentId);
 }
 function updateSelection(){
   const count=selectedContents.size;
   $('pciFoSelection').hidden=!count;
   $('pciFoSelectedCount').textContent=count+
     (count===1?' contenido seleccionado':' contenidos seleccionados');
   $('pciFoMoveSelected').disabled=!count||!slot;
 }
 function renderGroupCards(){
   const container=$('pciFoGroupCards');
   container.replaceChildren();
   const available=groups().filter(g=>g.year===year);
   for(const [index,group] of available.entries()){
     const selected=group.id===slot;
     const stored=draft?.spaces?.[group.id];
     const contentIds=stored?.items||[];
     const card=node('article','group-card card pci-fo-group-card'+(selected?' selected':''));
     card.dataset.foGroup=group.id;
     card.tabIndex=0;
     const title=node('div','group-title-row');
     const input=node('input');
     input.dataset.groupName=group.id;
     input.maxLength=140;
     input.setAttribute('aria-label','Nombre del agrupamiento');
     input.value=stored?.name||('Espacio '+(index+1)+(group.term?' · C'+group.term:' · C9–C10'));
     title.appendChild(input);card.appendChild(title);
     const meta=node('div','group-meta');
     meta.appendChild(node('span','pill',format==='laboratorios'?'Laboratorio':
       format==='talleres'?'Taller':'Proyecto'));
     meta.appendChild(node('span','pill',group.term?'C'+group.term:'C9–C10'));
     meta.appendChild(node('span','pill','Obligatorio'));
     card.appendChild(meta);
     card.appendChild(node('p','pci-fo-group-members',
       group.members.length?'Materias: '+group.members.map(subjectLabel).join(' + '):
       'Sin materias ubicadas en el mapa'));
     const header=node('div','assigned-heading');
     header.appendChild(node('h3','','Contenidos asignados'));
     header.appendChild(node('span','pill',contentIds.length));
     card.appendChild(header);
     const assigned=node('div','assigned-list pci-fo-group-assigned');
     if(!contentIds.length)assigned.appendChild(node('p','pci-fo-drop-hint',
       'Arrastrá aquí contenidos de la bolsa'));
     for(const id of contentIds){
       const wrapper=node('div','assigned-item pci-fo-assigned-item');
       wrapper.draggable=true;
       wrapper.dataset.contentId=id;
       const line=byId.get(id);
       wrapper.appendChild(node('span','',line?.text||id));
       const remove=node('button','pci-fo-remove','Quitar');
       remove.dataset.removeFrom=id;
       remove.type='button';
       remove.title='Devolver a la bolsa';
       wrapper.appendChild(remove);
       assigned.appendChild(wrapper);
     }
     card.appendChild(assigned);
     const edit=node('button','button secondary pci-fo-card-edit','Editar objetivos y planes →');
     edit.type='button';
     edit.dataset.editGroup=group.id;
     card.appendChild(edit);
     card.addEventListener('keydown',event=>{
       if((event.key==='Enter'||event.key===' ')&&event.target===card){
         event.preventDefault();slot=group.id;$('pciFoSpace').value=slot;
         renderSpace();renderGroupCards();
       }
     });
     container.appendChild(card);
   }
   if(!available.length)container.appendChild(node('p','pci-fo-muted',
     'Todavía no se conformaron espacios de este tipo y año. Revisá el Mapa de la Oferta.'));
   const all=new Set(available.flatMap(g=>draft?.spaces?.[g.id]?.items||[]));
   const total=new Set(available.flatMap(g=>availableFor(g).map(r=>r.id))).size;
   safeText($('pciFoCoverage'),all.size+' de '+total+
     ' contenidos ubicados en '+(formatName[format]||'la orientación')+
     ' · '+year+'.º año. Un contenido se mueve entre agrupamientos sin duplicarlo.');
 }
 function moveContents(ids,target){
   const dest=groups().find(g=>g.id===target&&g.year===year);
   if(!dest){savedStatus('Primero elegí un agrupamiento del año.');return;}
   const allowed=new Set(availableFor(dest).map(row=>row.id));
   const invalid=ids.filter(id=>!allowed.has(id));
   if(invalid.length){
     savedStatus('Este contenido no corresponde a este espacio y año de la orientación. No se modificó ningún dato.');
     return;
   }
   const next=makeFoDraft(orientation,draft);
   // No borrar planes ni secuencias. Solo cambia la ubicación del contenido,
   // y sus asignaciones de planes de origen para evitar referencias colgantes.
   for(const [id,other] of Object.entries(next.spaces)){
     if(id===target)continue;
     if(!other?.items?.some(item=>ids.includes(item)))continue;
     other.items=other.items.filter(item=>!ids.includes(item));
     for(const plan of other.plansBimestrales||[])
       plan.contentIds=(plan.contentIds||[]).filter(item=>!ids.includes(item));
   }
   const payload=getFoSpace(next,dest).data;
   payload.items=[...new Set([...(payload.items||[]),...ids])];
   draft=saveFoSpace(next,payload);
   selectedContents.clear();
   slot=target;
   $('pciFoSpace').value=target;
   persistDraft();
   renderSpace();renderGroupCards();
 }
 function removeContents(ids,source){
   if(!draft?.spaces?.[source])return;
   const next=makeFoDraft(orientation,draft);
   const payload=next.spaces[source];
   payload.items=(payload.items||[]).filter(id=>!ids.includes(id));
   for(const plan of payload.plansBimestrales||[])
     plan.contentIds=(plan.contentIds||[]).filter(id=>!ids.includes(id));
   draft=saveFoSpace(next,payload);
   selectedContents.clear();
   persistDraft();
   renderSpace();renderGroupCards();
 }
 function renderAll(){
   safeText($('pciFoTitle'),formatName[format]||'Desarrollo curricular');
   safeText($('pciFoContext'),'Orientación: '+orientation);
   const w=$('pciFoYear');w.replaceChildren();
   for(const n of [3,4,5]){
     const option=node('option','',n+'.º año');option.value=String(n);
     w.appendChild(option);
   }
   $('pciFoSearch').value='';
   $('pciFoPendingOnly').checked=false;
   selectedContents.clear();
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
 $('pciFoSpace').addEventListener('change',e=>{
   slot=e.target.value;selectedContents.clear();renderSpace();renderGroupCards();
 });
 $('pciFoSearch').addEventListener('input',renderCatalog);
 $('pciFoBlockFilter').addEventListener('change',renderCatalog);
 $('pciFoAxisFilter').addEventListener('change',renderCatalog);
 $('pciFoPendingOnly').addEventListener('change',renderCatalog);
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
   if(!id)return;
   if(e.target.checked)selectedContents.add(id);else selectedContents.delete(id);
   updateSelection();
 });
 $('pciFoMoveSelected').addEventListener('click',()=>{
   moveContents([...selectedContents],slot);
 });
 $('pciFoContentList').addEventListener('dragstart',startDrag);
 $('pciFoAssignedContents').addEventListener('dragstart',startDrag);
 $('pciFoGroupCards').addEventListener('dragover',e=>{
   const card=e.target.closest('[data-fo-group]');
   if(!card)return;e.preventDefault();e.dataTransfer.dropEffect='move';
   card.classList.add('drop-target');
 });
 $('pciFoGroupCards').addEventListener('dragleave',e=>{
   if(!e.currentTarget.contains(e.relatedTarget))
     e.currentTarget.querySelectorAll('.drop-target').forEach(card=>card.classList.remove('drop-target'));
 });
 $('pciFoGroupCards').addEventListener('drop',e=>{
   const card=e.target.closest('[data-fo-group]');
   if(!card)return;
   e.preventDefault();card.classList.remove('drop-target');
   const id=e.dataTransfer.getData('application/x-pci-content')||
     e.dataTransfer.getData('text/plain');
   if(id)moveContents([id],card.dataset.foGroup);
 });
 $('pciFoGroupCards').addEventListener('click',e=>{
   const card=e.target.closest('[data-fo-group]');
   if(!card)return;
   if(e.target.matches('[data-remove-from]')){
     const id=e.target.dataset.removeFrom;
     const selected=card.dataset.foGroup;
     removeContents([id],selected);
     return;
   }
   if(e.target.matches('input,textarea,select'))return;
   slot=card.dataset.foGroup;
   $('pciFoSpace').value=slot;
   renderSpace();renderGroupCards();
 });
 $('pciFoGroupCards').addEventListener('input',e=>{
   if(!e.target.matches('[data-group-name]'))return;
   const id=e.target.dataset.groupName;
   if(!id)return;
   const group=groups().find(g=>g.id===id);
   if(!group)return;
   const payload=getFoSpace(draft,group).data;
   payload.name=e.target.value;
   draft=saveFoSpace(draft,payload);
   if(current?.slot===id)current.name=e.target.value;
   persistDraft();
 });
 $('pciFoAssignedContents').addEventListener('click',e=>{
   const id=e.target.closest('button[data-remove]')?.dataset.remove;
   if(!id||!current)return;
   removeContents([id],slot);
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
 fetch('preview-v2-real/data/materias-v2.json')
   .then(res=>{if(!res.ok)throw Error('Catálogo de materias no disponible');return res.json();})
   .then(data=>{materiaCatalog=data;if(!overlay.hidden)renderGroupCards();})
   .catch(()=>{materiaCatalog=null;});
 loadV2Fo().then(rows=>{
   catalog=rows;ready=true;
   for(const row of rows)byId.set(row.id,row);
   if(!overlay.hidden)renderCatalog();
 }).catch(error=>{
   ready=false;loadingError='No se pudo cargar el catálogo FO: '+error.message;
   if(!overlay.hidden)renderCatalog();
 });
}