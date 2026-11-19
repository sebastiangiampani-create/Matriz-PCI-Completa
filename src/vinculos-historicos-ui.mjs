/**
 * Pantalla única de vinculación de trabajos históricos a PCI.
 * Los vínculos se guardan en una unidad institucional con control de revisión.
 * No escribe en los archivos/planes de FG históricos.
 */
import {
 HISTORIC_LINK_SCHEMA,LEGACY_KIND,historicKey,normalizeHistoricLinks,
 checkHistoricLinks,linkedRowsForPci,historicCountsForPci
} from './vinculos-historicos.mjs';

const $=id=>document.getElementById(id);
const list=v=>Array.isArray(v)?v:[];
const clone=v=>JSON.parse(JSON.stringify(v));
function el(tag,text='',cls=''){
 const node=document.createElement(tag);
 if(text!==null)node.textContent=String(text);
 if(cls)node.className=cls;
 return node;
}
function button(text,callback,cls='btn'){
 const node=el('button',text,cls);node.type='button';node.onclick=callback;return node;
}
function labelModel(p){
 const type=p.model==='comun'?'Media':p.model==='ba15'?'BA +15':'Técnica';
 return type+' · '+(p.specialty_name||p.title||p.orientation_id)+' · '+p.shift_id;
}
export function createHistoricAssignmentUI({call,canManage,notify=()=>{},onChanged=()=>{}}){
 let schoolId=null,rows=[],pcis=[],documentSaved=null,revision=0;
 let sourceUpdated='',sourceModel='comun',draft=new Map(),dirty=false,open=false,loading=false;
 let mounted=false;
 const assignmentKey=a=>historicKey(a.area,a.id);
 const baseEntry=row=>({area:row.area,id:row.id,kind:'general',mode:'selected',pci_ids:[]});
 const getEntry=row=>draft.get(assignmentKey(row))||baseEntry(row);
 const setEntry=(row,newValue)=>{
  draft.set(assignmentKey(row),newValue);
  dirty=true;draw();
 };
 function displayMessage(message,error=false){
  $('historicAssignmentMessage').textContent=message;
  $('historicAssignmentMessage').dataset.error=error?'1':'0';
 }
 function restoreDraft(){
  draft=new Map(list(documentSaved?.assignments).map(a=>[assignmentKey(a),clone(a)]));
  dirty=false;
 }
 function mount(){
  if(mounted||!$('historicAssignmentSection'))return;
  mounted=true;
  $('editHistoricLinks').onclick=()=>{
    if(!canManage()){notify('Se necesitan permisos institucionales para asignar el trabajo anterior.','warn');return;}
    open=!open;
    if(!open&&!dirty)restoreDraft();
    draw();
    if(open)$('historicAssignmentSection').scrollIntoView({behavior:'smooth',block:'start'});
  };
  $('cancelHistoricLinks').onclick=()=>{
    if(dirty&&!confirm('¿Descartar las asignaciones que todavía no guardaste?'))return;
    restoreDraft();open=false;draw();
  };
  $('historicShowEmpty').onchange=draw;
  $('saveHistoricLinks').onclick=save;
 }
 function load({school_id,rows:incoming,revision:rev,document:doc,source_updated_at,source_model},targets){
  if(dirty&&!confirm('Hay asignaciones anteriores sin guardar. ¿Descartarlas para cambiar de escuela?'))
    throw Error('El cambio de escuela fue cancelado: hay vínculos históricos sin guardar.');
  schoolId=Number(school_id);
  rows=list(incoming).map(row=>({
   area:String(row.area),id:String(row.id),
   name:String(row.name||row.id),
   contents:Number(row.contents)||0,plans:Number(row.plans)||0,
   hasWork:!!row.hasWork,level:Number(row.level)||null
  }));
  sourceUpdated=String(source_updated_at||'');
  sourceModel=String(source_model||'comun');
  pcis=list(targets);
  revision=Number(rev)||0;
  documentSaved=normalizeHistoricLinks(doc);
  if(documentSaved&&documentSaved.school_id!==schoolId)
    throw Error('La asignación recibida pertenece a otra institución.');
  restoreDraft();open=false;
  mount();draw();
 }
 function updateTargets(targets){
  pcis=list(targets);
  if(mounted)draw();
 }
 function sourceClassification(){
  return sourceModel==='tecnica'?'Origen técnico histórico':'Origen histórico de Media';
 }
 function draw(){
  const host=$('historicAssignmentSection');
  if(!host)return;
  host.hidden=pcis.length===0;
  if(!pcis.length)return;
  const assigned=list(documentSaved?.assignments).filter(a=>a.mode==='all'||a.pci_ids.length>0);
  const selected=assigned.filter(a=>a.mode==='selected').length;
  const shared=assigned.filter(a=>a.mode==='all').length;
  $('historicAssignmentSummary').textContent=documentSaved
   ?assigned.length+' agrupamientos vinculados ('+shared+' compartidos con todos los PCI; '+selected+' con destinatarios específicos). '+sourceClassification()+'. El trabajo original no se modifica.'
   :sourceClassification()+': todavía no elegiste a qué PCI corresponde cada agrupamiento. El trabajo previo se conserva, pero es importante asignarlo antes de continuar.';
  $('editHistoricLinks').textContent=open?'Cerrar asignación':'Asignar trabajo anterior';
  $('editHistoricLinks').disabled=!canManage();
  $('historicAssignmentEditor').hidden=!open;
  if(!open)return;
  $('historicAssignmentRevision').textContent='Revisión '+revision+(dirty?' · cambios sin guardar':' · guardado confirmado');
  const groupsHost=$('historicAssignmentRows');groupsHost.replaceChildren();
  if(sourceModel==='tecnica'){
   groupsHost.append(el('p','Este historial tiene origen técnico. Revisá cada área: la FG puede compartirse, pero el trabajo específico se asigna solamente a la especialidad correspondiente.','legacy-warning'));
  }
  const grouped=new Map();
  for(const row of rows){
   if(!$('historicShowEmpty').checked&&!row.hasWork&&!draft.has(assignmentKey(row)))continue;
   if(!grouped.has(row.area))grouped.set(row.area,[]);
   grouped.get(row.area).push(row);
  }
  if(!grouped.size)groupsHost.append(el('p','No hay agrupamientos desarrollados. Activá «Mostrar también agrupamientos vacíos» para asignar la estructura de FG.','muted'));
  for(const [area,areaRows] of grouped){
   const section=el('details',null,'legacy-area');
   section.open=grouped.size<4||areaRows.some(row=>draft.has(assignmentKey(row)));
   section.append(el('summary',area+' · '+areaRows.length+' agrupamientos','legacy-area-title'));
   const toolbar=el('div',null,'legacy-area-toolbar');
   const audience=el('div',null,'legacy-target-chips');
   const recipients=new Set();
   for(const p of pcis){
    const label=el('label',null,'legacy-target-chip');
    const check=el('input');check.type='checkbox';check.value=p.pci_id;
    check.onchange=()=>{if(check.checked)recipients.add(p.pci_id);else recipients.delete(p.pci_id);};
    label.append(check,document.createTextNode(labelModel(p)));audience.append(label);
   }
   const apply=button('FG de esta área → PCI seleccionados',()=>{
    if(!recipients.size){displayMessage('Marcá al menos un PCI para aplicar al área '+area+'.',true);return;}
    let count=0;
    for(const row of areaRows){
     const old=draft.get(assignmentKey(row));
     if(old&&old.kind!=='general')continue; // nunca pisar FO/Técnica específica.
     draft.set(assignmentKey(row),{
      area:row.area,id:row.id,kind:'general',mode:'selected',pci_ids:[...recipients]
     });count++;
    }
    dirty=true;displayMessage(count+' agrupamientos de '+area+' preparados para los PCI elegidos. Todavía falta Guardar.');draw();
   },'btn');
   const all=button('FG de esta área → TODOS los PCI',()=>{
    if(!confirm('Asignar como FG compartida los agrupamientos de '+area+' a todos los PCI actuales y futuros de la escuela? Los trabajos de orientación/técnica ya identificados no se reemplazarán.'))return;
    let count=0;
    for(const row of areaRows){
     const old=draft.get(assignmentKey(row));
     if(old&&old.kind!=='general')continue;
     draft.set(assignmentKey(row),{
      area:row.area,id:row.id,kind:'general',mode:'all',pci_ids:[]
     });count++;
    }
    dirty=true;displayMessage(count+' agrupamientos de '+area+' asignados a todos (sin guardar).');draw();
   },'btn');
   toolbar.append(audience,apply,all);
   section.append(toolbar);
   for(const row of areaRows)section.append(groupCard(row));
   groupsHost.append(section);
  }
  $('saveHistoricLinks').disabled=!dirty||loading||!canManage();
 }
 function groupCard(row){
  const current=getEntry(row);
  const existing=draft.has(assignmentKey(row));
  const card=el('article',null,'legacy-group-card'+(existing?' linked':''));
  const head=el('div',null,'legacy-group-head');
  const title=el('div');
  title.append(el('strong',row.name),
    el('small',row.area+' · '+row.contents+' contenidos · '+row.plans+' planes'+(row.hasWork?' · Con desarrollo':' · Plantilla sin desarrollar')));
  const remove=button('Sin asignar',()=>{
   if(!draft.has(assignmentKey(row)))return;
   draft.delete(assignmentKey(row));dirty=true;draw();
  },'btn small');
  head.append(title,remove);card.append(head);
  const kindLine=el('label',null,'legacy-kind-label');
  kindLine.append(document.createTextNode('Este trabajo anterior corresponde a: '));
  const kind=el('select');for(const [val,name] of Object.entries(LEGACY_KIND)){
   const option=el('option',name);option.value=val;kind.append(option);
  }
  kind.value=current.kind;
  kind.onchange=()=>setEntry(row,{area:row.area,id:row.id,kind:kind.value,mode:'selected',pci_ids:[]});
  kindLine.append(kind);card.append(kindLine);
  const recipients=el('div',null,'legacy-target-chips');
  if(current.kind==='general'){
   const label=el('label',null,'legacy-target-chip all-targets');
   const box=el('input');box.type='checkbox';box.checked=current.mode==='all';
   box.onchange=()=>{
    setEntry(row,{...current,mode:box.checked?'all':'selected',pci_ids:box.checked?[]:[]});
   };
   label.append(box,document.createTextNode('Todos los PCI (incluye los futuros)'));
   recipients.append(label);
  }
  const selectedIds=list(current.pci_ids);
  const first=pcis.find(p=>selectedIds.includes(p.pci_id));
  let available=pcis;
  if(current.kind==='orientada')available=pcis.filter(p=>['comun','ba15'].includes(p.model));
  if(current.kind==='tecnica')available=pcis.filter(p=>p.model==='tecnica');
  for(const p of available){
   const sameOption=!first||current.kind==='general'||
    current.kind==='orientada'&&p.model===first.model&&p.orientation_id===first.orientation_id||
    current.kind==='tecnica'&&p.orientation_id===first.orientation_id;
   const label=el('label',null,'legacy-target-chip');
   const cb=el('input');cb.type='checkbox';cb.checked=current.mode==='all'||selectedIds.includes(p.pci_id);
   cb.disabled=current.mode==='all'||!sameOption;
   cb.onchange=()=>{
    const ids=new Set(selectedIds);
    if(cb.checked)ids.add(p.pci_id);else ids.delete(p.pci_id);
    setEntry(row,{...current,mode:'selected',pci_ids:[...ids]});
   };
   label.append(cb,document.createTextNode(labelModel(p)));recipients.append(label);
  }
  card.append(recipients);
  if(!available.length)card.append(el('p','Todavía no hay PCI compatible con este tipo. Primero creá la orientación o especialidad correspondiente.','legacy-warning'));
  if(current.kind!=='general')card.append(el('small','Podés asignarlo a uno o más turnos de la misma orientación/especialidad; no a otras opciones.','muted'));
  return card;
 }
 async function save(){
  if(!dirty||loading||!canManage())return;
  const proposed={
   schema:HISTORIC_LINK_SCHEMA,school_id:schoolId,source_updated_at:sourceUpdated,
   assignments:[...draft.values()]
  };
  const errors=checkHistoricLinks(proposed,rows,pcis);
  if(errors.length){displayMessage(errors.slice(0,4).join(' · '),true);return;}
  loading=true;draw();displayMessage('Guardando vínculos históricos y comprobando la revisión…');
  try{
   const response=await call('save-school-legacy-links',{
    school_id:schoolId,document:proposed,expected_revision:revision
   });
   if(response.ok!==true||!Number.isSafeInteger(Number(response.revision)))
    throw Error('Supabase no confirmó el guardado.');
   revision=Number(response.revision);
   documentSaved=normalizeHistoricLinks(proposed);
   restoreDraft();open=false;draw();
   notify('Vínculos de trabajo anterior guardados en revisión '+revision+'. Los documentos históricos y planes no se modificaron.');
   onChanged();
  }catch(error){
   displayMessage(error.message||String(error),true);
   if(error?.status===409)displayMessage('Otra persona modificó la asignación. No se sobrescribió. Volvé a la escuela y actualizá para conciliar.',true);
  }finally{loading=false;draw();}
 }
 function renderPreview(target,pci){
  if(!target)return;
  target.replaceChildren();
  target.hidden=false;
  const h=el('details',null,'legacy-preview');
  const summary=el('summary');
  if(!documentSaved){
   summary.textContent='Trabajo histórico anterior · asignación pendiente (vista de compatibilidad)';
   h.append(summary,el('p','La FG anterior se conserva como antes hasta que la escuela defina a qué PCI pertenece cada agrupamiento. La selección no borra ningún trabajo.','muted'));
   target.append(h);return;
  }
  const selected=linkedRowsForPci(rows,documentSaved,pci);
  const count=historicCountsForPci(rows,documentSaved,pci);
  summary.textContent='Trabajo anterior vinculado a este PCI · '+count.total+' agrupamientos, '+count.contents+' contenidos y '+count.plans+' planes';
  h.append(summary);
  if(!selected.length)h.append(el('p','No hay trabajo histórico asignado todavía a este PCI. Podés vincularlo desde Organización curricular sin modificar el original.','muted'));
  for(const row of selected){
   const details=el('details',null,'legacy-preview-group');
   details.append(el('summary',row.name+' · '+row.area+' · '+LEGACY_KIND[row.kind],''));
   const source=pci.legacy_state?.areas?.[row.area]?.groups?.find(g=>String(g.id)===row.id);
   if(!source){
    details.append(el('p','Este agrupamiento fue registrado después de crear el resguardo de este PCI. Requiere conciliación manual antes de importar contenidos.','legacy-warning'));
   }else{
    details.append(el('p',(Array.isArray(source.items)?source.items.length:0)+' contenidos · '+
      (Array.isArray(source.plansBimestrales)?source.plansBimestrales.length:0)+' planes anteriores · solo lectura.','muted'));
    for(const [i,plan] of list(source.plansBimestrales).entries()){
     const body=el('div',null,'legacy-preview-plan');
     body.append(el('strong',plan.name||'Plan '+(i+1)));
     for(const field of [plan.synopsis,plan.objectives]){
      if(typeof field==='string'&&field.trim())body.append(el('p',field.trim()));
     }
     for(const stage of Object.values(plan.stages||{})){
      const text=typeof stage==='string'?stage:stage?.description;
      if(typeof text==='string'&&text.trim())body.append(el('p',text.trim()));
     }
     details.append(body);
    }
   }
   h.append(details);
  }
  const explain=el('p','Los grupos de FG compartida pueden recuperarse en el Desarrollo FG de Media. Los trabajos orientados y técnicos quedan enlazados y consultables sin convertir automáticamente sus planes a otra normativa.','muted');
  h.append(explain);target.append(h);
 }
 return {
  load,updateTargets,renderPreview,
  get document(){return documentSaved?clone(documentSaved):null;},
  get rows(){return clone(rows);},
  get revision(){return revision;},
  get isDirty(){return dirty;},
  get sourceUpdated(){return sourceUpdated;},
  cancel(){if(dirty)return false;open=false;draw();return true;}
 };
}
