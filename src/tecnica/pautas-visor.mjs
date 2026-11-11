import {
  RULESET_ID,TECNICA,SPECIALTIES,findSpecialty,getAnnualSubjects,
  validateTechnicalOverview,technicalCalendar
} from './pautas-pci-20261005.mjs';

const $=id=>document.getElementById(id);
const elt=(tag,text,cls)=>{
  const e=document.createElement(tag);
  if(text!==undefined)e.textContent=String(text);
  if(cls)e.className=cls;
  return e;
};
const add=(host,tag,text,cls)=>{const e=elt(tag,text,cls);host.appendChild(e);return e;};
const yfmt=y=>y+'º';
const query=new URL(location.href).searchParams.get('especialidad')||'';
const all=[...SPECIALTIES];
let custom=null;
if(query&&!findSpecialty(query)){
  custom={id:'especialidad_personalizada',name:query,status:'requires_plan'};
  all.unshift(custom);
}
const sel=$('specialty');
for(const s of all){
  const option=elt('option',s.name);option.value=s.id;sel.appendChild(option);
}
const initial=findSpecialty(query);
sel.value=initial?.id||custom?.id||'computacion';
let current=all.find(x=>x.id===sel.value)||all[0];
const count=(n,label)=>{const card=elt('div',undefined,'stat');add(card,'strong',n);add(card,'small',label);return card;};
function resolveStatus(){
  const found=findSpecialty(current.id)||findSpecialty(current.name);
  return found||current;
}
function slotInfo(kind,year,term){
  const spec=resolveStatus(),computer=spec.id==='computacion',extraSixth=['computacion','administracion_empresas'].includes(spec.id);
  if(kind==='matematica'||kind==='lengua_adicional')
    return year<=5||year===6&&extraSixth?{text:'Anual',annual:true}:null;
  if(kind==='lengua_literatura')
    return year<=5?{text:'Anual',annual:true}:null;
  if(kind==='sociales'){
    if(year<=3)return {text:'1 espacio · cuatrimestral'};
    if(year===4&&computer)return {text:'Historia / Geografía + ubicación flexible',pending:true};
    return {text:'Ciudadanía y Trabajo / Ciencia y Tecnología · según especialidad (4º–6º)',pending:true};
  }
  if(kind==='naturales')
    return year<=3?{text:'1 espacio · cuatrimestral'}:null;
  if(kind==='educacion_fisica')return {text:'1 electivo · cuatrimestral'};
  if(kind==='educacion_artistica')return year===1?{text:'1 electivo · cuatrimestral'}:null;
  if(kind==='representacion')
    return year<=2?{text:'Anual',annual:true}:
      year===3?{text:'Anual · según especialidad',annual:true,pending:true}:null;
  if(kind==='taller_primer_ciclo')
    return year<=2?{text:'Anual · obligatorio',annual:true}:null;
  if(kind==='taller_especialidad')
    return year>=3?{text:'Anual · según plan de especialidad',annual:true,pending:true}:null;
  if(kind==='anual_especialidad'){
    if(year<4)return null;
    if(spec.status==='no_annual_space')return null;
    if(spec.status==='defined_in_document')
      return {text:spec.subjects[year],annual:true};
    return {text:'Por definir según especialidad',annual:true,pending:true};
  }
  if(kind==='integracion_especialidad')
    return year>=4?{text:'Oferta 4–6 espacios/año · según plan',pending:true}:null;
  if(kind==='practicas_profesionalizantes')
    return year>=5?{text:'Según especialidad · Proyecto de Vinculación',pending:true}:null;
  return null;
}
const rows=[
  ['Troncales','matematica','Matemática'],
  ['Troncales','lengua_literatura','Lengua y Literatura'],
  ['Troncales','lengua_adicional','Lengua Adicional'],
  ['Integración FG','sociales','Ciencias Sociales'],
  ['Integración FG','naturales','Ciencias Naturales'],
  ['Espacios formativos','educacion_fisica','Educación Física'],
  ['Espacios formativos','educacion_artistica','Educación Artística'],
  ['Espacios formativos','representacion','Tecnología de la Representación'],
  ['Primer Ciclo','taller_primer_ciclo','Taller del Primer Ciclo'],
  ['Especialidad','taller_especialidad','Taller de la Especialidad'],
  ['Especialidad','anual_especialidad','Espacio Anual de la Especialidad'],
  ['Especialidad','integracion_especialidad','Integración técnico-específica'],
  ['Vinculación','practicas_profesionalizantes','Prácticas Profesionalizantes']
];
function map(){
  const head=$('mapHead'),body=$('mapBody');
  head.replaceChildren();body.replaceChildren();
  const bands=elt('tr');add(bands,'th','Espacio / Nivel').rowSpan=2;
  for(let year=1;year<=6;year++){
    const h=add(bands,'th','Nivel '+year);h.colSpan=2;
  }
  head.appendChild(bands);
  const terms=elt('tr');
  for(const t of technicalCalendar())add(terms,'th','C'+t.term);
  head.appendChild(terms);
  let last='';
  for(const [group,kind,name] of rows){
    const tr=elt('tr');
    const header=add(tr,'th',name);
    if(group!==last){header.title=group;last=group;}
    for(let term=1;term<=12;term++){
      const year=Math.ceil(term/2);
      const cell=elt('td');
      const info=slotInfo(kind,year,term);
      if(info)add(cell,'span',info.text,'slot'+(info.pending?' pending':''));
      tr.appendChild(cell);
    }
    body.appendChild(tr);
  }
  $('mapFootnote').textContent=
    'Formación General: Sociales 8 (Computación 10), Naturales 6, Educación Física 12 y Artística 2 en toda la trayectoria. '+
    'La ubicación de Ciudadanía y Trabajo / Ciencia y Tecnología puede variar entre 4.º, 5.º y 6.º. '+
    'El mapa expresa formatos y excepciones de las pautas, no asignaciones de materias de un plan específico.';
}
function annual(){
  const spec=resolveStatus(),annual=getAnnualSubjects(spec.id);
  const host=$('annualSubjects');host.replaceChildren();
  for(let year=4;year<=6;year++){
    const box=elt('div',undefined,'stat');
    add(box,'small','Nivel '+year+' · espacio anual');
    add(box,'strong',annual?.[year]||
      (spec.status==='no_annual_space'?'No corresponde':'Pendiente de definición por especialidad'));
    host.appendChild(box);
  }
  $('specialtyStatus').textContent=spec.status==='defined_in_document'?
    'Espacios anuales identificados para 4.º, 5.º y 6.º (pp. 16–17).':
    spec.status==='no_annual_space'?
    'Geógrafo Matemático: la pauta indica no ofrecer espacio anual de especialidad.':
    'La pauta no define aquí el espacio anual. Se requiere definición de la especialidad.';
  const exc=[];
  if(spec.id==='computacion')exc.push('Computación: 10 integraciones de Sociales (5 obligatorias y 5 electivas), en lugar de 8; además, Matemática y Lengua Adicional en 6.º.');
  if(spec.id==='administracion_empresas')exc.push('Administración de Empresas: Matemática y Lengua Adicional también en 6.º.');
  if(spec.id==='mecanica')exc.push('Mecánica (Res. 1440/25): Metrología y Producción Industrial de 3.º es cuatrimestral e independiente del Taller de la Especialidad.');
  if(spec.status==='not_defined_in_document')exc.push('Especialidad con espacio anual no definido aún en las pautas aportadas (p. 17).');
  if(spec.status==='no_annual_space')exc.push('Excepción: no corresponde espacio anual de especialidad.');
  exc.push('Los espacios de integración de la especialidad pueden superar nueve horas, únicamente según su diseño curricular.');
  $('exceptions').textContent=exc.join(' · ');
}
function stats(){
  const host=$('stats');host.replaceChildren();
  host.append(
    count('6','Niveles'),
    count('12','Cuatrimestres'),
    count(resolveStatus().id==='computacion'?'10':'8','Integraciones de Sociales'),
    count('6','Integraciones de Naturales'),
    count('12','Espacios formativos de Educación Física'),
    count('4–6','Integraciones técnicas por año del segundo ciclo (orientativo)')
  );
}
function defaultDuration(){
  const year=Number($('year').value);
  const annual=['troncal','tecnologia_representacion','taller_primer_ciclo',
    'taller_especialidad','espacio_anual_especialidad'];
  $('duration').value=annual.includes($('format').value)?'anual':'cuatrimestral';
  const term=$('term');term.replaceChildren();
  for(const t of [2*year-1,2*year]){
    const item=elt('option','C'+t);item.value=String(t);term.appendChild(item);
  }
}
function evaluate(){
  const value={
    id:'ejemplo_sin_guardado',format:$('format').value,
    year:Number($('year').value),term:Number($('term').value),
    duration:$('duration').value,weeklyHours:$('weeklyHours').value,
    subjects:$('subjects').value.split(',').map(x=>x.trim()).filter(Boolean)
  };
  if(value.format==='troncal'){
    value.title=$('subjects').value.trim();
    value.subjects=[];
  }
  if(value.format==='espacio_anual_especialidad'){
    value.title=$('subjects').value.trim();
  }
  const result=validateTechnicalOverview({specialty:resolveStatus().name,spaces:[value]});
  const host=$('results');host.replaceChildren();
  if(!result.errors.length)
    add(host,'li','No hay incumplimientos de las reglas generales comprobables para este ejemplo. La aprobación completa requiere el plan de estudios de la especialidad.','ok');
  for(const problem of result.errors)add(host,'li','Incumplimiento: '+problem.message+' (p. '+problem.page+')','error');
  for(const problem of result.warnings)add(host,'li','Pendiente: '+problem.message+' (p. '+problem.page+')');
}
sel.addEventListener('change',()=>{
  current=all.find(x=>x.id===sel.value)||all[0];
  stats();map();annual();
  $('results').replaceChildren();
});
$('format').addEventListener('change',defaultDuration);
$('year').addEventListener('change',defaultDuration);
$('validateSpace').addEventListener('submit',event=>{event.preventDefault();evaluate()});
$('exampleInvalid').addEventListener('click',()=>{
  $('format').value='integracion_natural';
  $('year').value='2';
  defaultDuration();
  $('subjects').value='Física';
  $('weeklyHours').value='10';
  evaluate();
});
defaultDuration();stats();map();annual();
window.__TECNICA_REGLAS__={ruleSet:RULESET_ID,readonly:true,check:evaluate};
