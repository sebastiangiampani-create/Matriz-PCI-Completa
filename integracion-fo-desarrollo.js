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
import {foCoverageSnapshot} from './src/integracion-curricular/cobertura-fo-v2.js';

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
     renderCoverageDashboard();
     window.dispatchEvent(new CustomEvent('pci-fo-draft-change', { detail: {orientation, slot} }));
   }catch(e){
     savedStatus('El navegador no pudo guardar el borrador: '+e.message);
   }
 }
 function groups(){return foGroups(getMap(),format);}
 // El filtro "Todos los años" muestra simultáneamente los agrupamientos
 // reales de 3.º, 4.º y 5.º. El año propio siempre viene del grupo/slot.
 function visibleGroups(){return groups().filter(g=>year===0||g.year===year);}
 function years(){
   const available=groups().map(g=>g.year);
   return [...new Set(available)].sort();
 }
 function subjectCatalog(){
   const id=orientId(orientation);
   if(!id)return [];
   // La bolsa muestra la totalidad de la base oficial de esta orientación.
   // Antes los filtros dependían de los agrupamientos visibles: eso OCULTABA
   // Historia y Tecnologías de la Información orientadas en años anteriores.
   // La elegibilidad del destino sigue verificándose en moveContents().
   return selectFoByOrientation(catalog,id,ORIENTATIONS);
 }
 function resetYear(asked=null){
   const list=years();
   const next=Number(asked);
   // Por defecto FO muestra toda la trayectoria: 4 laboratorios o 4 talleres
   // juntos, y el selector permite acotar por año para trabajar con más detalle.
   year=(next===0||list.includes(next))?next:(format==='proyecto'?5:0);
   $('pciFoYear').value=String(year);
   renderSpaceOptions();
 }
 function renderSpaceOptions(preferred=''){
   const values=visibleGroups();
   if(preferred&&values.some(g=>g.id===preferred))slot=preferred;
   else if(!values.some(g=>g.id===slot))slot=values[0]?.id||'';
   const select=$('pciFoSpace');
   select.replaceChildren();
   for(const [index,group] of values.entries()){
     const opt=node('option','',group.term===null?'5.º año · Espacio anual · C9–C10':
       group.year+'.º año · Espacio '+(index+1)+' · C'+group.term);
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
   renderPlanMetric();
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
   const history=rows.filter(row=>specialKind(row)==='historia').length;
   const technology=rows.filter(row=>specialKind(row)==='tecnologia').length;
   const ejes=rows.length-history-technology;
   safeText(count,rows.length?
     (filtered.length+' visibles · '+rows.filter(row=>!taken.has(row.id)).length+
       ' pendientes · '+rows.length+' contenidos de la orientación'+
       ' · Historia orientada: '+history+
       ' · Tecnologías de la Información orientada: '+technology+
       ' · Bloques/ejes: '+ejes):
     'Sin contenidos oficiales de esta orientación en la base curricular V2 disponible. No se agregan datos de ejemplo.');
   for(const row of filtered.slice(0,220)){
     const label=node('label','pci-fo-content-choice content-item');
     label.draggable=!!current;label.dataset.contentId=row.id;
     const type=specialKind(row);
     label.dataset.foComponent=type?'materia':'eje';
     label.title=type?
       'Materia orientada: ubicar exclusivamente en el espacio correspondiente de 5.º año':
       'Eje curricular: arrastrar al agrupamiento de la orientación';
     const check=node('input');check.type='checkbox';
     check.value=row.id;check.dataset.foContent=row.id;
     check.checked=selectedContents.has(row.id);
     check.disabled=!current;
     const body=node('span');
     const heading=node('strong','');
     heading.appendChild(node('span','pci-fo-component-type',type?'Materia':'Eje'));
     heading.appendChild(document.createTextNode(' '+
       (type?(row.block||'Formación Orientada'):(row.axis||row.block||'Eje curricular'))));
     body.appendChild(heading);
     body.appendChild(node('small','',
       (type?(row.axis||''):
         ((row.block&&row.axis)?'Bloque: '+row.block:'') )+
       (row.subaxis?' · '+row.subaxis:'')+
       ' · '+row.text));
     if(type)body.appendChild(node('small','pci-fo-fifth-note',
       'Componente específico de 5.º año · verificar su espacio en el Mapa de la Oferta'));

     label.append(check,body);list.appendChild(label);
   }
   if(filtered.length>220)list.appendChild(node('p','pci-fo-muted',
     'Refiná la búsqueda para ver los demás contenidos.'));
   updateSelection();
 }
 function renderSpace(){
   const empty=$('pciFoEmpty'),fields=$('pciFoFields');
   const group=visibleGroups().find(g=>g.id===slot);
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
   const retained=Array.isArray(current.contentRelocationReview)?
     current.contentRelocationReview.length:0;
   $('pciFoReviewWarning').hidden=!state.needsReview&&!retained;
   safeText($('pciFoReviewWarning'),
     (state.needsReview?'Revisar espacio: cambió el formato o el año. ':'')+
     (retained?'Revisar planes: '+retained+' contenidos se trasladaron o devolvieron a la bolsa. Se conservaron sus referencias en planes y secuencias. ':'')+
     (state.needsReview||retained?'No se eliminó ningún plan.':''));
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
   renderAssigned();renderPlan();renderCatalog();renderCoverageDashboard();
   savedStatus('Vista de prueba · edición local independiente del trabajo escolar');
   window.dispatchEvent(new CustomEvent('pci-fo-context-change', { detail: {orientation, slot} }));
 }
 function coverageSnapshot(){
   const id=orientId(orientation);
   if(!id||!ready)return null;
   return foCoverageSnapshot({
     rows:catalog,orientationId:id,orientations:ORIENTATIONS,
     map:getMap(),draft
   });
 }
 const numberText = (used,total,percent,basis='trayectoria')=>
   Number.isInteger(total)&&total>0 ?
     used+'/'+total+' · '+percent+'% ('+basis+')' :
     used+' ubicados · sin base anual validada';
 function addCoverageProgress(host,used,total){
   const track=node('div','pci-fo-cover-track');
   const fill=node('span','');
   fill.style.width=total>0?(Math.min(100,Math.round(used/total*1000)/10)+'%'):'0%';
   track.appendChild(fill);host.appendChild(track);
 }
 function addMetricRow(host,name,used,total,percent,basis='trayectoria'){
   const wrap=node('div','pci-fo-metric-row');
   const title=node('strong','',name);
   const summary=node('span','',numberText(used,total,percent,basis));
   wrap.append(title,summary);
   addCoverageProgress(wrap,used,total);
   host.appendChild(wrap);
 }
 function renderCoverageDashboard(){
  try{
   const snap=coverageSnapshot();
   if(!snap)return;
   const annual=snap.levelBasisAvailable;
   safeText($('pciFoCoverageBasis'),annual?
     'El denominador es el total anual prescripto de cada materia para ese nivel. Los contenidos repetidos se cuentan una sola vez.':
     'Cómo se calcula: la Formación Orientada se coteja con la bolsa oficial de la trayectoria. La base orientada actual todavía no permite desagregar esta cobertura anual por nivel. Si un contenido aparece en más de un espacio o en más de un plan, se cuenta una sola vez; los porcentajes de los planes no se suman entre sí.');
   const years=$('pciFoCoverageLevels'),subjects=$('pciFoCoverageSubjects'),
     spaces=$('pciFoCoverageSpaces');
   years.replaceChildren();subjects.replaceChildren();spaces.replaceChildren();
   years.appendChild(node('h3','','Cobertura anual por materia y nivel'));
   for(const level of snap.years){
     const levelCard=node('article','v98d-level');
     levelCard.dataset.coverageState=level.used?'progress':'empty';
     const head=node('header','v98d-level-head');
     const title=node('div');
     title.appendChild(node('span','','Cobertura anual por materia'));
     title.appendChild(node('h4','','Nivel '+level.year));
     title.appendChild(node('p','','Cada contenido se cuenta una sola vez en el nivel.'));
     const meta=node('div','v98d-level-meta');
     const distinct=new Set(snap.spaces.filter(g=>g.year===level.year)
       .flatMap(g=>g.byComponent.filter(c=>c.used).map(c=>c.label)));
     meta.appendChild(node('span','',distinct.size+' materia'+(distinct.size===1?'':'s')+' / bloques'));
     meta.appendChild(node('span','',level.spaceCount+' agrupamiento'+(level.spaceCount===1?'':'s')));
     head.append(title,meta);levelCard.appendChild(head);
     if(!annual)levelCard.appendChild(node('div','v98d-pending',
       'La base orientada actual todavía no permite desagregar esta cobertura anual por nivel.'));
     levelCard.appendChild(node('p','v98d-level-count',
       level.used+' contenidos únicos ubicados en el nivel · porcentaje anual pendiente'));
     const grouping=node('details','v98d-grouping');
     const summary=node('summary');
     const labels=node('div');
     labels.appendChild(node('strong','','Agrupamientos del nivel'));
     labels.appendChild(node('small','','Ver cómo se distribuye la cobertura en los espacios construidos.'));
     summary.append(labels,node('span','',String(level.spaceCount)));
     grouping.appendChild(summary);
     const inner=node('div','v98d-groups');
     for(const group of snap.spaces.filter(x=>x.year===level.year)){
       const block=node('article','v98d-group');
       const hd=node('header');const lab=node('div');
       lab.appendChild(node('span','', (group.format==='laboratorio'?'Laboratorio':
         group.format==='taller'?'Taller':'Proyecto')+' · '+
         (group.term?'C'+group.term:'C9–C10')));
       lab.appendChild(node('h5','',group.name));
       hd.append(lab,node('em','','Nivel '+group.year));block.appendChild(hd);
       if(!annual)block.appendChild(node('p','v98d-basis','Referencia: trayectoria orientada'));
       const components=group.byComponent;
       if(components.length)for(const comp of components)
         addV2SubjectRow(block,comp);
       else block.appendChild(node('div','v98d-pending',
         'Sin contenidos oficiales calculables para este espacio.'));
       const plans=node('details','v99d-plans');
       const ps=node('summary');const pInfo=node('div');
       pInfo.appendChild(node('strong','','Planes del agrupamiento'));
       pInfo.appendChild(node('small','','La cobertura usa contenidos únicos: si un contenido aparece en dos planes, se cuenta una sola vez.'));
       ps.append(pInfo,node('span','',String(group.plans.length)));plans.appendChild(ps);
       const list=node('div','v99d-plan-list');
       for(const plan of group.plans){
         const item=node('article','v99d-plan');
         const h=node('header');const div=node('div');
         div.appendChild(node('small','','Plan '+plan.number));
         div.appendChild(node('strong','',plan.name));h.appendChild(div);item.appendChild(h);
         addV2PlanTable(item,plan,annual);
         if(plan.outsideGroup.length)item.appendChild(node('div','v98d-pending',
           'Revisar '+plan.outsideGroup.length+' contenidos vinculados al plan y trasladados a otro espacio. Los planes se conservan.'));
         list.appendChild(item);
       }
       plans.appendChild(list);block.appendChild(plans);
       inner.appendChild(block);
     }
     grouping.appendChild(inner);levelCard.appendChild(grouping);years.appendChild(levelCard);
   }
   subjects.appendChild(node('h3','','Cobertura por materia o bloque · trayectoria'));
   subjects.appendChild(node('p','v98d-basis',
     'Se utiliza el universo oficial de contenidos de esta orientación. Historia y Tecnologías orientadas conservan su identificación como materias.'));
   for(const comp of snap.bySubject)addV2SubjectRow(subjects,comp);
   spaces.appendChild(node('h3','','Cobertura del agrupamiento'));
   spaces.appendChild(node('p','v98d-basis',
     'Los contenidos repetidos no se vuelven a contar. Elegí un nivel para consultar los espacios construidos y los planes del agrupamiento.'));
   for(const g of snap.formatsByLevel){
     const name=(formatName[g.format]||g.format);
     spaces.appendChild(node('div','v98d-format-summary',
       'Nivel '+g.year+' · '+name+' · '+g.spaceCount+' agrupamientos · '+g.used+' contenidos únicos ubicados'));
   }
   const summary=snap.trajectory;
   safeText($('pciFoCoverage'),summary.used+'/'+summary.total+
     ' contenidos priorizados ubicados · '+(summary.percent??0)+'% de la trayectoria orientada'+
     ' · '+snap.spaces.length+' agrupamientos en total');
   syncCardCoverage(snap);
   renderPlanMetric(snap);
  }catch(error){
   $('pciFoCoverage').textContent='Cobertura pendiente de recalcular: '+error.message;
   console.error('Error de cobertura curricular:',error);
  }
 }
 function addV2SubjectRow(host,component){
   const row=node('div','v98d-subject');
   const name=node('div','v98d-subject-name');
   name.appendChild(node('small','',component.kind||'Bloque'));
   name.appendChild(node('strong','',component.label));
   const value=node('div','v98d-value');
   value.appendChild(node('b','',component.used+'/'+component.total));
   value.appendChild(node('span','',(component.percent??0)+'%'));
   const track=node('div','v98d-bar');const fill=node('i');
   fill.style.width=Math.min(100,Number(component.percent)||0)+'%';
   track.appendChild(fill);
   row.append(name,value,track);
   host.appendChild(row);
 }
 function addV2PlanTable(host,plan,annual){
   const table=node('div','v99d-plan-table dual');
   const header=node('div','v99d-plan-head');
   header.append(node('span','','Materia / bloque'),node('span','',
     annual?'Del anual':'De la trayectoria'),node('span','','Dentro del agrupamiento'));
   table.appendChild(header);
   for(const comp of plan.byComponent){
     const row=node('div','v99d-plan-row');
     row.appendChild(node('strong','',comp.label));
     row.appendChild(node('span','',comp.used+'/'+comp.total+' · '+(comp.percent??0)+'%'));
     row.appendChild(node('span','',comp.groupingUsed+'/'+comp.groupingTotal+
       (comp.groupingTotal?' · '+comp.groupingPercent+'%':' · —')));
     table.appendChild(row);
   }
   if(!plan.byComponent.length)table.appendChild(node('div','v99d-plan-empty',
     'Sin contenidos oficiales asignados a este plan.'));
   host.appendChild(table);
 }
 function syncCardCoverage(snap){
   for(const card of $('pciFoGroupCards').querySelectorAll('[data-fo-group]')){
     const info=snap.spaces.find(item=>item.id===card.dataset.foGroup);
     if(!info)continue;
     const el=card.querySelector('[data-fo-card-coverage]');
     if(el)el.textContent=info.used+' contenidos únicos · '+
       (info.trajectory.percent===null?'sin base':
        info.trajectory.percent+'% de la trayectoria FO');
     const chips=card.querySelector('[data-fo-card-subjects]');
     if(chips)chips.textContent=info.byComponent.filter(x=>x.used)
       .map(x=>x.label+': '+x.used+'/'+x.total).join(' · ')||
       'Sin contenidos ubicados';
   }
 }
 function renderPlanMetric(snapshot=coverageSnapshot()){
   const host=$('pciFoPlanCoverage');
   host.replaceChildren();
   const space=snapshot?.spaces.find(row=>row.id===slot);
   const plan=space?.plans.find(item=>
     Number(item.number)===Number($('pciFoPlan').value)+1);
   if(!plan)return;
   host.appendChild(node('h4','','Plan '+plan.number+' · Cobertura curricular'));
   host.appendChild(node('p','pci-fo-cover-context',
     'Cobertura del agrupamiento. Los contenidos repetidos no se vuelven a contar. '+
     'La base orientada actual todavía no permite calcular cobertura anual por nivel; '+
     'la primera referencia corresponde a la trayectoria orientada.'));
   const header=node('div','v99d-plan-summary');
   header.appendChild(node('strong','','De la trayectoria: '+plan.used+'/'+plan.totalOfficial+
     ' · '+(plan.officialPercent??0)+'%'));
   header.appendChild(node('strong','','Dentro del agrupamiento: '+
     plan.groupingUsed+'/'+plan.groupingTotal+
     (plan.groupingPercent===null?' · —':' · '+plan.groupingPercent+'%')));
   host.appendChild(header);
   addV2PlanTable(host,plan,snapshot.levelBasisAvailable);
   if(plan.outsideGroup.length)host.appendChild(node('p','v98d-pending',
     'Revisar '+plan.outsideGroup.length+' contenidos vinculados al plan que ya no están ubicados en este agrupamiento. Se conservaron sus referencias.'));
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
   const available=visibleGroups();
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
     meta.appendChild(node('span','pill pci-fo-year-pill',group.year+'.º año'));
     meta.appendChild(node('span','pill',format==='laboratorios'?'Laboratorio':
       format==='talleres'?'Taller':'Proyecto'));
     meta.appendChild(node('span','pill',group.term?'C'+group.term:'C9–C10'));
     meta.appendChild(node('span','pill','Obligatorio'));
     card.appendChild(meta);
     card.appendChild(node('p','pci-fo-group-members',
       group.members.length?'Materias: '+group.members.map(subjectLabel).join(' + '):
       'Sin materias ubicadas en el mapa'));
     // Se respeta la jerarquía visual y los mismos campos de las tarjetas FG.
     // La ubicación del mapa sigue siendo de solo lectura aquí para no mover
     // materias ni alterar otros agrupamientos por accidente.
     const fields=node('div','form-grid pci-fo-card-fields');
     const formLabel=(caption,value,key,tag='textarea')=>{
       const wrap=node('label','field-label '+(tag==='textarea'?'full':''));
       wrap.appendChild(node('span','',caption));
       const el=node(tag);
       if(tag==='textarea'){el.rows=2;el.value=String(value||'');}
       else {el.value=String(value||'');el.readOnly=true;}
       if(key){el.dataset.foCardField=key;el.dataset.groupId=group.id;}
       wrap.appendChild(el);fields.appendChild(wrap);
     };
     formLabel('Carácter del agrupamiento',stored?.type||'Obligatorio',null,'input');
     formLabel('Ubicación temporal',group.term?'C'+group.term:'C9–C10',null,'input');
     if(format==='laboratorios')
       formLabel('Contexto problematizador',stored?.context,'context');
     if(format==='talleres')
       formLabel('Práctica / producto / eje',stored?.practiceAxis,'practiceAxis');
     formLabel('Objetivos de aprendizaje',stored?.objective,'objective');
     formLabel('Sinopsis (opcional)',stored?.synopsis,'synopsis');
     card.appendChild(fields);
     const info=node('div','pci-fo-card-coverage');
     info.dataset.foCardCoverage=group.id;
     card.appendChild(info);
     const components=node('p','pci-fo-card-subjects');
     components.dataset.foCardSubjects=group.id;
     card.appendChild(components);
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
       const remove=node('button','remove-content pci-fo-remove','×');
       remove.dataset.removeFrom=id;
       remove.type='button';
       remove.title='Devolver a la bolsa';
       remove.setAttribute('aria-label','Quitar contenido y devolverlo a la bolsa');
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
   // El panel curricular tiene la fuente única del contador,
   // las referencias oficiales y la cobertura de trayectoria.
   renderCoverageDashboard();
 }
 function moveContents(ids,target){
   const dest=visibleGroups().find(g=>g.id===target);
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
     // Conservamos las referencias de los planes para revisión: nunca
     // borramos silenciosamente lo que la escuela ya planificó.
     other.contentRelocationReview=[...new Set([
       ...(other.contentRelocationReview||[]),...ids
     ])];
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
   payload.contentRelocationReview=[...new Set([
     ...(payload.contentRelocationReview||[]),...ids
   ])];
   draft=saveFoSpace(next,payload);
   selectedContents.clear();
   persistDraft();
   renderSpace();renderGroupCards();
 }
 function renderAll(){
   safeText($('pciFoTitle'),formatName[format]||'Desarrollo curricular');
   safeText($('pciFoContext'),'Orientación: '+orientation);
   const w=$('pciFoYear');w.replaceChildren();
   const allYears=new Option('Todos los años','0');
   w.appendChild(allYears);
   for(const n of [3,4,5]){
     const option=node('option','',n+'.º año');option.value=String(n);
     w.appendChild(option);
   }
   $('pciFoSearch').value='';
   $('pciFoPendingOnly').checked=false;
   $('pciFoDetails').open=false;
   // Solo cerrar el panel visual al pasar de proyecto a laboratorios/talleres:
   // vínculos y borradores versionados se conservan íntegros.
   if($('pciArticulationEditor'))$('pciArticulationEditor').open=false;
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
   year=requestedYear===null?(format==='proyecto'?5:0):Number(requestedYear);
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
 $('pciFoGroupCards').addEventListener('dragstart',startDrag);
 $('pciFoGroupCards').addEventListener('dragover',e=>{
   const card=e.target.closest('[data-fo-group]');
   if(!card)return;e.preventDefault();e.dataTransfer.dropEffect='move';
   card.classList.add('drop-target');
 },true);
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
 },true);
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
   if(e.target.closest('[data-edit-group]')){
     $('pciFoDetails').open=true;
     slot=card.dataset.foGroup;
     $('pciFoSpace').value=slot;
     renderSpace();renderGroupCards();
     $('pciFoDetails').scrollIntoView({behavior:'smooth',block:'start'});
     return;
   }
   slot=card.dataset.foGroup;
   $('pciFoSpace').value=slot;
   renderSpace();renderGroupCards();
 });
 $('pciFoGroupCards').addEventListener('input',e=>{
   const field=e.target.dataset.foCardField;
   const groupId=e.target.dataset.groupId;
   if(!field||!groupId)return;
   if(!['objective','synopsis','context','practiceAxis'].includes(field))return;
   const found=groups().find(item=>item.id===groupId);
   if(!found)return;
   const data=getFoSpace(draft,found).data;
   data[field]=e.target.value;
   draft=saveFoSpace(draft,data);
   if(current?.slot===groupId)current[field]=e.target.value;
   if(current?.slot===groupId){
     const inputId={objective:'pciFoObjective',synopsis:'pciFoSynopsis',
       context:'pciFoProblemContext',practiceAxis:'pciFoPracticeAxis'}[field];
     if(inputId)$(inputId).value=e.target.value;
   }
   persistDraft();
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
 $('pciFoCoveragePrint').addEventListener('click',()=>{
   if(overlay.hidden)return;
   const root=$('pciFoCoverageDashboard');
   const all=[root,...root.querySelectorAll('details')];
   const previous=all.map(el=>el.open);
   all.forEach(el=>{el.open=true;});
   const restore=()=>{
     all.forEach((el,i)=>{el.open=previous[i];});
     window.removeEventListener('afterprint',restore);
   };
   window.addEventListener('afterprint',restore);
   window.print();
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
 // Adaptador de solo lectura para el motor de cobertura ORIGINAL de V2.
 // Los IDs y los planes existentes nunca se copian ni se reescriben aquí.
 function coverageDataFor(name){
   if(typeof name!=='string'||!name.trim())return null;
   const selected=name.trim();
   let offer=null,previous=null;
   try{offer=JSON.parse(localStorage.getItem(V2_KEY)||'null')?.maps?.[selected]||null;}catch(_){}
   try{previous=JSON.parse(localStorage.getItem(KEY)||'null')?.orientations?.[selected]||null;}catch(_){}
   const copied=makeFoDraft(selected,previous);
   const groupList=['laboratorios','talleres','proyecto'].flatMap(id=>
     foGroups(offer,id).map(group=>{
       const data=getFoSpace(copied,group).data;
       return {
         id:group.id,area:'Formación Orientada',year:group.year,
         term:group.term,
         type:group.format==='laboratorio'?'laboratorio':
           group.format==='taller'?'taller':'proyecto',
         members:group.members.slice(),
         data:{
           name:data.name||('Espacio '+(group.term?'C'+group.term:'C9–C10')),
           contents:[...new Set((data.items||[]).map(String))],
           plansBimestrales:data.plansBimestrales.map(p=>({
             number:p.number,name:p.name,
             contentIds:[...new Set((p.contentIds||[]).map(String))]
           }))
         }
       };
     })
   );
   return {orientation:selected,groups:groupList};
 }
 window.PCIFoDesarrollo={open,close,coverageDataFor};
 // Los contenidos oficiales no tienen año FO explícito: el docente determina
 // los contenidos de cada espacio y plan, sin porcentajes inventados.
 fetch('preview-v2-real/data/materias-v2.json')
   .then(res=>{if(!res.ok)throw Error('Catálogo de materias no disponible');return res.json();})
   .then(data=>{materiaCatalog=data;
     if(!overlay.hidden){renderCatalog();renderGroupCards();}
   })
   .catch(()=>{materiaCatalog=null;});
 loadV2Fo().then(rows=>{
   catalog=rows;ready=true;
   for(const row of rows)byId.set(row.id,row);
   if(!overlay.hidden){renderCatalog();renderGroupCards();renderCoverageDashboard();}
 }).catch(error=>{
   ready=false;loadingError='No se pudo cargar el catálogo FO: '+error.message;
   if(!overlay.hidden)renderCatalog();
 });
}