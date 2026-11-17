import {SPECIALTIES,findSpecialty,technicalCalendar,validateTechnicalOverview} from './pautas-pci-20261005.mjs';
const $=id=>document.getElementById(id), PREFIX='pci-tecnica-borrador-2026-v1:',STAGES=['Punto de partida','Indagación','Producción','Evaluación'];
let catalog,subjectData,record,specialty;
const clone=x=>JSON.parse(JSON.stringify(x));
function el(tag,parent,content,cls){
 const e=document.createElement(tag);if(content!==undefined)e.textContent=String(content);if(cls)e.className=cls;
 parent.append(e);return e;
}
function btn(parent,label,fn){const e=el('button',parent,label);e.type='button';e.onclick=fn;return e;}
function input(parent,label,value,callback,multi=false){
 const holder=el('label',parent);el('span',holder,label);
 const e=el(multi?'textarea':'input',holder);e.value=value??'';e.onchange=()=>callback(e.value);
 return e;
}
function select(parent,label,values,current,callback){
 const holder=el('label',parent);el('span',holder,label);
 const e=el('select',holder);
 for(const [value,name] of values){const opt=el('option',e,name);opt.value=String(value);}
 e.value=String(current);e.onchange=()=>callback(e.value);return e;
}
function status(msg,bad=false){$('status').textContent=msg;$('status').dataset.error=String(bad);}
function newDraft(id){return {schema:'pci-tecnica-borrador-local-v1',specialty_id:id,model:'tecnica',
 status:'provisional_no_aprobado',source_sha256:null,spaces:[],plans:[],updated_at:null};}
function save(){
 if(!record)return;
 try{record.updated_at=new Date().toISOString();localStorage.setItem(PREFIX+specialty.id,JSON.stringify(record));
 status('Guardado LOCAL confirmado. No se enviaron datos a Supabase ni al PCI escolar.');
 $('count').textContent=record.spaces.length+' espacios · '+record.plans.length+' planes · '+new Set(record.spaces.flatMap(x=>x.sources.map(y=>y.id))).size+' secciones vinculadas';
 }catch(err){status('No se pudo guardar localmente: exportá un archivo para resguardar el borrador.',true);}
}
function download(){
 if(!record)return;
 const copy=clone(record);copy.exported_at=new Date().toISOString();
 copy.warning='Borrador local. No validado ni publicado. No importar en datos escolares sin auditoria.';
 const blob=new Blob([JSON.stringify(copy,null,2)+'\n'],{type:'application/json'});
 const href=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=href;a.download='PCI-TECNICA-BORRADOR-'+specialty.id+'.json';document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(href),5000);
}
function yearChoices(){return Array.from({length:6},(_,i)=>[i+1,(i+1)+'º año']);}
const FORMATS=[['troncal','Troncal anual'],['integracion_social','Integración Sociales'],['integracion_natural','Integración Naturales'],
 ['integracion_especialidad','Integración Técnico-Específica'],['taller_primer_ciclo','Taller Primer Ciclo'],['taller_especialidad','Taller de Especialidad'],
 ['tecnologia_representacion','Tecnología de la Representación'],['espacio_anual_especialidad','Espacio anual de especialidad'],
 ['espacio_formativo','Espacio formativo'],['vinculacion_futuro','Vinculación con el Futuro'],['practicas_profesionalizantes','Prácticas Profesionalizantes']];
function calendar(){
 const host=$('calendar');host.replaceChildren();
 const table=el('table',host);const h=el('tr',el('thead',table));el('th',h,'Espacio / año');
 for(let year=1;year<=6;year++){const th=el('th',h,'Nivel '+year);th.colSpan=2;}
 const row=el('tr',el('tbody',table));el('th',row,'C1–C12');
 for(const t of technicalCalendar()){
  const cell=el('td',row);el('strong',cell,'C'+t.term);
  const count=record.spaces.filter(x=>x.term===t.term).length;
  btn(cell,'+ '+count,()=>addSpace(t.year,t.term));
 }
}
function addSpace(year,term){
 record.spaces.push({id:crypto.randomUUID(),year,term,name:'Nuevo espacio técnico',
  format:'espacio_formativo',duration:'cuatrimestral',weeklyHours:null,
  sources:[],notes:'',validation:'pendiente'});
 save();calendar();renderSpaces();
}
function renderSpaces(){
 const host=$('spaces');host.replaceChildren();
 for(const s of record.spaces.slice().sort((a,b)=>a.term-b.term)){
  const card=el('article',host,undefined,'space');
  const top=el('div',card,undefined,'top');
  el('h3',top,s.name+' · C'+s.term);
  btn(top,'Eliminar',()=>{
   if(!confirm('¿Eliminar este espacio SOLO del borrador local? Exportá antes una copia.'))return;
   record.spaces=record.spaces.filter(x=>x.id!==s.id);record.plans=record.plans.filter(x=>x.space_id!==s.id);
   save();calendar();renderSpaces();
  });
  const form=el('div',card,undefined,'fields');
  input(form,'Nombre del espacio',s.name,v=>{s.name=v;save();renderSpaces();});
  select(form,'Año',yearChoices(),s.year,v=>{
   s.year=Number(v);s.term=s.year*2-1;save();calendar();renderSpaces();});
  select(form,'Cuatrimestre',[[s.year*2-1,'C'+(s.year*2-1)],[s.year*2,'C'+(s.year*2)]],s.term,v=>{
   s.term=Number(v);save();calendar();renderSpaces();});
  select(form,'Formato',FORMATS,s.format,v=>{
   s.format=v;s.duration=['troncal','taller_primer_ciclo','taller_especialidad','tecnologia_representacion','espacio_anual_especialidad','vinculacion_futuro'].includes(v)?'anual':'cuatrimestral';
   save();renderSpaces();
  });
  select(form,'Duración',[['anual','Anual'],['cuatrimestral','Cuatrimestral']],s.duration,v=>{s.duration=v;save();renderSpaces();});
  input(form,'Horas semanales (si constan en el plan)',s.weeklyHours??'',v=>{
   s.weeklyHours=v.trim()&&Number(v)>0?Number(v):null;save();});
  input(form,'Observaciones y articulación',s.notes,v=>{s.notes=v;save();},true);
  const check=validateTechnicalOverview({specialty:specialty.id,spaces:[{
   id:s.id,year:s.year,term:s.term,title:s.name,format:s.format,duration:s.duration,weeklyHours:s.weeklyHours}]});
  const notices=el('div',card,undefined,'notice');
  el('strong',notices,check.errors.length?'Atención: regla de composición incumplida':'Revisión reglamentaria provisoria');
  for(const warning of [...check.errors,...check.warnings])el('p',notices,warning.message);
  const linked=el('div',card,undefined,'linked');el('h4',linked,'Referencias al PDF oficial');
  for(const source of s.sources){
   const chip=el('div',linked,undefined,'chip');el('span',chip,source.name+' · p. '+source.page);
   btn(chip,'Quitar',()=>{s.sources=s.sources.filter(x=>x.id!==source.id);save();renderSpaces();});
  }
  select(linked,'Vincular asignatura / sección',[['','Elegí una sección…'],...subjectData.asignaturas.filter(x=>
    !s.sources.some(y=>y.id===x.id)).map(x=>[x.id,x.asignatura+' · p. '+x.pagina_inicio])],'',v=>{
    const item=subjectData.asignaturas.find(x=>x.id===v);
    if(!item)return;
    s.sources.push({id:item.id,name:item.asignatura,page:item.pagina_inicio,end_page:item.pagina_fin,
      sha256_pdf:subjectData.sha256_pdf,validation:'pendiente'});
    save();renderSpaces();
  });
  const plans=el('div',card,undefined,'plans');el('h4',plans,'Planes de aprendizaje');
  btn(plans,'+ Agregar plan',()=>{
   record.plans.push({id:crypto.randomUUID(),space_id:s.id,name:'Plan '+(record.plans.filter(x=>x.space_id===s.id).length+1),
      objectives:'',synopsis:'',stages:Object.fromEntries(STAGES.map(x=>[x,'']))});
   save();renderSpaces();
  });
  for(const p of record.plans.filter(x=>x.space_id===s.id)){
   const box=el('details',plans,undefined,'plan');el('summary',box,p.name);
   input(box,'Nombre',p.name,v=>{p.name=v;save();});
   input(box,'Objetivos',p.objectives,v=>{p.objectives=v;save();},true);
   input(box,'Sinopsis',p.synopsis,v=>{p.synopsis=v;save();},true);
   for(const stage of STAGES)input(box,stage,p.stages[stage]||'',v=>{p.stages[stage]=v;save();},true);
   btn(box,'Eliminar plan',()=>{if(!confirm('¿Eliminar este plan local?'))return;
    record.plans=record.plans.filter(x=>x.id!==p.id);save();renderSpaces();});
  }
 }
 if(!record.spaces.length)el('p',host,'Agregá espacios desde el tablero C1–C12.');
}
function renderSources(){
 const host=$('sources');host.replaceChildren();
 const q=$('filter').value.toLowerCase();
 let matched=0;
 for(const x of subjectData.asignaturas){
  if(!x.asignatura.toLowerCase().includes(q))continue;
  matched++;
  const box=el('details',host,undefined,'reference');
  el('summary',box,x.asignatura+' · páginas '+x.pagina_inicio+'–'+x.pagina_fin);
  el('p',box,'Fuente documental no validada. Confirmar año y campo antes de usar.', 'notice');
  for(const p of x.paginas){
   const page=el('details',box);
   el('summary',page,'Página PDF '+p.pagina_pdf);
   el('pre',page,p.texto_pagina||'Página sin texto extraíble: consultar PDF.');
  }
 }
 $('sourceCount').textContent=matched+' / '+subjectData.asignaturas.length+' secciones';
}
async function choose(id){
 const next=findSpecialty(id);if(!next)throw Error('Especialidad no encontrada');
 const resp=await fetch('data/tecnica/priorizados/'+id+'.json',{cache:'no-store'});
 if(!resp.ok)throw Error('No se pudo descargar el catálogo de '+next.name);
 const source=await resp.json();
 if(source.especialidad_id!==id||!source.sha256_pdf)throw Error('El documento no coincide con la especialidad');
 const raw=localStorage.getItem(PREFIX+id);
 let previous=raw?JSON.parse(raw):newDraft(id);
 if(previous.schema!=='pci-tecnica-borrador-local-v1'||previous.specialty_id!==id||
    !Array.isArray(previous.spaces)||!Array.isArray(previous.plans))throw Error('El borrador antiguo no es compatible; NO se sobrescribió.');
 if(previous.source_sha256&&previous.source_sha256!==source.sha256_pdf)
   throw Error('Cambió la referencia oficial. Exportá el borrador previo antes de revisar equivalencias.');
 specialty=next;subjectData=source;record=previous;record.source_sha256=source.sha256_pdf;
 history.replaceState(null,'','?especialidad='+encodeURIComponent(id));
 $('heading').textContent=next.name;$('original').href=source.fuente_url;
 $('reference').href='pci-tecnica-priorizados.html?especialidad='+encodeURIComponent(id);
 $('filter').value='';
 save();calendar();renderSources();renderSpaces();
}
async function main(){
 const resp=await fetch('data/tecnica/catalogo-priorizados-2026.json');catalog=await resp.json();
 if(catalog.estado!=='extraido_pendiente_validacion_pedagogica'||catalog.totales.especialidades_documentadas!==26)
   throw Error('Catálogo técnico todavía no disponible o no verificado');
 const query=new URLSearchParams(location.search).get('especialidad');
 const initial=findSpecialty(query)?.id||'computacion';
 select($('choice'),'Especialidad',SPECIALTIES.map(x=>[x.id,x.name]),initial,
  v=>choose(v).catch(e=>status(e.message,true)));
 $('filter').oninput=renderSources;$('export').onclick=download;
 $('print').onclick=()=>window.print();
 $('import').onchange=async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  try{
   const d=JSON.parse(await file.text());
   if(d.schema!=='pci-tecnica-borrador-local-v1'||d.specialty_id!==specialty.id||
      !Array.isArray(d.spaces)||!Array.isArray(d.plans)||
      d.spaces.length>500||d.plans.length>2000||
      d.spaces.some(x=>!Number.isInteger(x.year)||x.year<1||x.year>6||
       !Number.isInteger(x.term)||Math.ceil(x.term/2)!==x.year||!Array.isArray(x.sources)))
    throw Error('Formato de borrador o especialidad inválido.');
   if(!confirm('Reemplazar solamente el borrador LOCAL de esta especialidad? Exportá antes el actual.'))return;
   record={...d,status:'provisional_no_aprobado'};delete record.school_id;delete record.pci_id;delete record.remote_revision;
   save();calendar();renderSpaces();
  }catch(err){status('No se importó: '+err.message,true);}
 };
 await choose(initial);
}
main().catch(err=>status('No se pudo abrir el editor: '+err.message,true));
