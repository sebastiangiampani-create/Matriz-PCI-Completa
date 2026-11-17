/**
 * Motor puro de PCI Técnica para la MISMA interfaz de orientaciones V2.
 * No crea usuarios, no escribe en Supabase, no modifica matrices antiguas.
 * Fuente: Pautas 05/10/2026 pp. 13-18 y documentos priorizados CABA 2026.
 * Las secciones/páginas extraídas NO son contenidos atómicos validados.
 */
import {TECNICA,findSpecialty,getAnnualSubjects,technicalCalendar,
  validateTechnicalSpace,validateRelation,RULESET_ID} from './pautas-pci-20261005.mjs';

export const TECH_OFFER_VERSION='oferta-tecnica-v1';
export const TECH_OFFER_SCHEMA='pci-oferta-tecnica-v1/1';
export const TECH_PLAN_VERSION='fo-tecnica-v1';
export const TECH_PLAN_SCHEMA='pci-fo-tecnica-v1/1';
export const TECH_STAGES=Object.freeze(['punto_partida','indagacion','produccion','evaluacion']);
export const TECH_FIELDS=Object.freeze({
 formacion_general:'Formación General',
 formacion_cientifico_tecnologica:'Formación Científico-Tecnológica',
 formacion_tecnica_especifica:'Formación Técnico-Específica',
 practicas_profesionalizantes:'Prácticas Profesionalizantes'
});
export const TECH_FG_AREAS=Object.freeze(['Matemática','Lengua y Literatura','Lengua Adicional',
 'Ciencias Sociales','Ciencias Naturales','Educación Física','Educación Artística',
 'Tecnología de la Representación','Taller del Primer Ciclo','Científico-Tecnológica']);
export const TECH_SPECIFIC_AREAS=Object.freeze(['Taller de la Especialidad','Espacio anual de la especialidad',
 'Integración de la Especialidad','Proyecto de Vinculación con el Futuro','Prácticas Profesionalizantes']);
const copy=x=>JSON.parse(JSON.stringify(x));
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const asArr=x=>Array.isArray(x)?x:[];
const name=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const srcId=x=>String(x??'');
const RANGE=Array.from({length:6},(_,i)=>i+1);
export const technicianYear=term=>Math.ceil(Number(term)/2);
export function technicianTerms(year){return [2*Number(year)-1,2*Number(year)];}

function slot({id,year,term,format,area,label,duration='cuatrimestral',character='obligatorio',
  provisional=false,requiredPlan=false,kind='fg',hours=null}){
 return {id,year,term,endTerm:duration==='anual'?term+1:term,format,area,name:label,
  duration,character,kind,weeklyHours:hours,subjectIds:[],contentIds:[],
  notes:'',provisional,requiredPlan,confirmed:false};
}
function createSlots(specialty){
 const out=[],put=x=>out.push(slot(x));
 const isExtra=['computacion','administracion_empresas'].includes(specialty.id);
 for(const [area,id,years] of [
  ['Matemática','matematica',isExtra?6:5],
  ['Lengua y Literatura','lengua_literatura',5],
  ['Lengua Adicional','lengua_adicional',isExtra?6:5]
 ])for(let year=1;year<=years;year++)put({
  id:'t-'+id+'-'+year,year,term:2*year-1,format:'troncal',
  area,label:area+' · '+year+'º',duration:'anual',kind:'fg'});
 // Dos propuestas por año de Ciencias Sociales hasta 3º y 2 flexibles de N4-N6.
 for(let year=1;year<=3;year++)for(const half of [1,2])put({
  id:'t-social-'+year+'-'+half,year,term:2*year-2+half,
  format:'integracion_social',area:'Ciencias Sociales',label:'Integración de Ciencias Sociales',
  character:year===1||year===2?'obligatorio':'electivo',kind:'fg'
 });
 for(const half of [1,2])put({
  id:'t-social-flex-'+half,year:4,term:6+half,format:'integracion_social',
  area:'Ciencias Sociales',label:'Ciudadanía y Trabajo / Ciencia y Tecnología',
  character:'electivo',provisional:true,requiredPlan:true,kind:'fg'
 });
 if(specialty.id==='computacion')for(const half of [1,2])put({
  id:'t-social-comp-'+half,year:4,term:6+half,format:'integracion_social',
  area:'Ciencias Sociales',label:'Historia / Geografía · Computación',
  character:'electivo',kind:'fg'
 });
 for(let year=1;year<=3;year++)for(const half of [1,2])put({
  id:'t-natural-'+year+'-'+half,year,term:2*year-2+half,
  format:'integracion_natural',area:'Ciencias Naturales',label:'Integración de Ciencias Naturales',
  character:year<=2?'obligatorio':'electivo',kind:'fg'
 });
 for(let year=1;year<=6;year++)for(const half of [1,2])put({
  id:'t-ef-'+year+'-'+half,year,term:2*year-2+half,
  format:'espacio_formativo',area:'Educación Física',label:'Educación Física · opción electiva',
  character:'electivo',kind:'fg'
 });
 for(const half of [1,2])put({
  id:'t-arte-1-'+half,year:1,term:half,format:'espacio_formativo',
  area:'Educación Artística',label:'Educación Artística · opción electiva',
  character:'electivo',kind:'fg'
 });
 for(let year=1;year<=2;year++)put({
  id:'t-representacion-'+year,year,term:2*year-1,
  format:'tecnologia_representacion',area:'Tecnología de la Representación',
  label:'Tecnología de la Representación · '+year+'º',duration:'anual',kind:'fg'
 });
 for(let year=1;year<=2;year++)put({
  id:'t-taller-primero-'+year,year,term:2*year-1,format:'taller_primer_ciclo',
  area:'Taller del Primer Ciclo',label:'Taller del Primer Ciclo · '+year+'º',
  duration:'anual',kind:'fg'
 });
 for(let year=3;year<=6;year++)put({
  id:'t-taller-especialidad-'+year,year,term:2*year-1,
  format:'taller_especialidad',area:'Taller de la Especialidad',
  label:'Taller de la Especialidad · '+year+'º',duration:'anual',
  provisional:year>3,requiredPlan:true,kind:'fo'
 });
 const annual=getAnnualSubjects(specialty.id);
 if(annual)for(let year=4;year<=6;year++)put({
  id:'t-anual-'+year,year,term:2*year-1,format:'espacio_anual_especialidad',
  area:'Espacio anual de la especialidad',
  label:annual[year],duration:'anual',kind:'fo'
 });
 // De 4 a 6 integraciones cuatrimestrales por año: SOLO un punto de partida
 // de cuatro espacios; ofrecer hasta dos más según la currícula particular.
 for(let year=4;year<=6;year++)for(let index=1;index<=4;index++)put({
  id:'t-int-especialidad-'+year+'-'+index,year,
  term:2*year-2+(index%2?1:2),format:'integracion_especialidad',
  area:'Integración de la Especialidad',
  label:'Integración técnico-específica · opción '+index,
  character:index<=2?'obligatorio':'electivo',
  provisional:true,requiredPlan:true,kind:'fo'
 });
 // El documento pp.5 y 17 establece DOS proyectos anuales, en N5 y N6.
 for(let year=5;year<=6;year++)put({
  id:'t-pvf-'+year,year,term:2*year-1,format:'vinculacion_futuro',
  area:'Proyecto de Vinculación con el Futuro',
  label:'Proyecto de Vinculación con el Futuro · '+year+'º',
  duration:'anual',kind:'fo'
 });
 if(specialty.id==='mecanica')put({
  id:'t-metrologia-3',year:3,term:5,format:'metrologia_mecanica',
  area:'Científico-Tecnológica',label:'Metrología y Producción Industrial',
  provisional:false,kind:'fg'
 });
 return out;
}
export function technicalSubjectBank(document){
 if(!object(document)||!Array.isArray(document.asignaturas))throw Error('Catálogo oficial técnico inválido');
 const rows=[];
 for(const section of document.asignaturas){
  const field=String(section.campo_estimado||'');
  const sectionYears=asArr(section.anios_detectados).filter(y=>Number.isInteger(y)&&y>=1&&y<=6);
  for(const pg of asArr(section.paginas)){
   const n=Number(pg.pagina_pdf);
   if(!Number.isSafeInteger(n)||n<1)continue;
   // El año de cada página puede ser ambiguo: no inventar una asignación.
   const raw=Number(pg.anio_contextual_inferido);
   const y=Number.isInteger(raw)&&raw>=1&&raw<=6?raw:
     sectionYears.length===1?sectionYears[0]:null;
   rows.push({
    id:section.id+'@p'+n,sectionId:section.id,name:section.asignatura,
    field,year:y,page:n,source_sha256:document.sha256_pdf,
    source_url:document.fuente_url,
    text:String(pg.texto_pagina||''),confidence:y===null?'sin_anio':'inferido',
    area:technicalAreaForSubject(section.asignatura,field)
   });
  }
 }
 return rows;
}
export function technicalAreaForSubject(subject,field){
 const s=name(subject);
 if(s==='matematica')return 'Matemática';
 if(s==='lengua y literatura')return 'Lengua y Literatura';
 if(s==='ingles'||s==='lengua adicional')return 'Lengua Adicional';
 if(['biologia','fisica','quimica'].includes(s) &&
    field!=='formacion_tecnica_especifica')return 'Ciencias Naturales';
 if(/historia|geografia|educacion ciudadana|ciudadania y trabajo|ciencia y tecnologia/.test(s))
    return 'Ciencias Sociales';
 if(s==='educacion fisica')return 'Educación Física';
 if(/teatro|musica|diseno|educacion artistica/.test(s)&&field==='formacion_general')
    return 'Educación Artística';
 if(/representacion/.test(s)&&field!=='formacion_tecnica_especifica')return 'Tecnología de la Representación';
 if(/^taller$/.test(s)&&field!=='formacion_tecnica_especifica')return 'Taller del Primer Ciclo';
 if(field==='practicas_profesionalizantes')return 'Prácticas Profesionalizantes';
 if(field==='formacion_tecnica_especifica')return 'Integración de la Especialidad';
 return 'Científico-Tecnológica';
}
export function technicalOfferSeed({pci,source}){
 if(!object(pci)||pci.model!=='tecnica'||!Number.isSafeInteger(Number(pci.school_id))||
    !String(pci.pci_id||'')||!String(pci.orientation_id||'')||!String(pci.legacy_sha256||''))
  throw Error('Falta identificar el PCI Técnico y su resguardo histórico.');
 const specialty=findSpecialty(pci.specialty_name);
 if(!specialty||source?.especialidad_id!==specialty.id||!source.sha256_pdf||
    !Array.isArray(source.asignaturas))
  throw Error('No hay catálogo oficial de esta especialidad: se conserva el PCI anterior.');
 return {
  schema:TECH_OFFER_SCHEMA,model:'tecnica',school_id:Number(pci.school_id),
  pci_id:String(pci.pci_id),orientation_id:pci.orientation_id,process_id:pci.process_id,
  specialty_id:specialty.id,specialty_name:specialty.name,
  original_sha256:pci.legacy_sha256,source_sha256:source.sha256_pdf,
  ruleset:RULESET_ID,calendar:'6-niveles-12-cuatrimestres',
  status:'borrador_no_homologado',spaces:createSlots(specialty),
  relations:[],approvedHoursByYear:{},version:1
 };
}
function validSpace(s){
 return object(s)&&typeof s.id==='string'&&s.id.length>2&&
  Number.isInteger(s.year)&&s.year>=1&&s.year<=6&&
  Number.isInteger(s.term)&&technicianYear(s.term)===s.year&&
  ['anual','cuatrimestral'].includes(s.duration)&&
  s.endTerm===(s.duration==='anual'?s.term+1:s.term)&&
  asArr(s.contentIds).every(x=>typeof x==='string'&&x.length>0)&&
  asArr(s.subjectIds).every(x=>typeof x==='string'&&x.length>0);
}
export function guardTechnicalOffer(document,pci,source){
 const specialty=findSpecialty(pci?.specialty_name);
 if(!object(document)||document.schema!==TECH_OFFER_SCHEMA||document.model!=='tecnica'||
  Number(document.school_id)!==Number(pci.school_id)||document.pci_id!==pci.pci_id||
  document.orientation_id!==pci.orientation_id||document.process_id!==pci.process_id||
  document.original_sha256!==pci.legacy_sha256||
  document.specialty_id!==specialty?.id||document.specialty_name!==specialty.name||
  document.source_sha256!==source?.sha256_pdf||document.status!=='borrador_no_homologado'||
  !Array.isArray(document.spaces)||document.spaces.length<30||document.spaces.length>160||
  !document.spaces.every(validSpace)||
  new Set(document.spaces.map(s=>s.id)).size!==document.spaces.length)
    throw Error('El mapa técnico pertenece a otro PCI o contiene estructuras incompatibles.');
 return copy(document);
}
export function addTechnicalIntegration(document,{year}){
 if(!Number.isInteger(year)||year<4||year>6)throw Error('Las integraciones técnicas son de 4.º a 6.º.');
 const spaces=document.spaces.filter(x=>x.format==='integracion_especialidad'&&x.year===year);
 if(spaces.length>=6)throw Error('La propuesta orientativa permite hasta seis espacios de integración por año.');
 const index=Math.max(0,...spaces.map(x=>Number(x.id.split('-').at(-1))||0))+1;
 const next=copy(document);
 next.spaces.push(slot({id:'t-int-especialidad-'+year+'-'+index,year,
  term:2*year-2+(index%2?1:2),format:'integracion_especialidad',
  area:'Integración de la Especialidad',label:'Integración técnico-específica · opción '+index,
  character:'electivo',provisional:true,requiredPlan:true,kind:'fo'}));
 return next;
}
export function moveTechnicalTerm(document,spaceId,targetTerm){
 const draft=copy(document);
 const s=draft.spaces.find(x=>x.id===spaceId);
 if(!s)throw Error('Espacio curricular inexistente.');
 const term=Number(targetTerm),y=technicianYear(term);
 if(!Number.isInteger(term)||term<1||term>12)
  throw Error('Cuatrimestre técnico inválido.');
 if(s.duration==='anual'&&term%2===0)throw Error('El espacio anual comienza en el primer cuatrimestre del año.');
 if(s.id.startsWith('t-social-flex-')){
  if(![4,5,6].includes(y))throw Error('La ubicación flexible es solo de 4.º a 6.º.');
 }else if(y!==s.year)throw Error('No se puede cambiar el año curricular fijado por el diseño.');
 s.term=term;s.year=y;s.endTerm=term+(s.duration==='anual'?1:0);
 s.confirmed=false;return draft;
}
export function setTechnicalSubject(document,spaceId,sourceId,bank,enabled){
 const draft=copy(document),s=draft.spaces.find(x=>x.id===spaceId);
 const src=bank.find(x=>x.id===sourceId);
 if(!s||!src)throw Error('No se reconoció el espacio o referencia curricular.');
 if(src.year!==null&&src.year!==s.year)
  throw Error('La referencia pertenece a otro año. Revisá el diseño curricular; no se mezclan niveles.');
 if(!s.area||!TECH_FG_AREAS.concat(TECH_SPECIFIC_AREAS).includes(s.area))
  throw Error('Área curricular inválida.');
 // Los contenidos de distintas especialidades nunca se mezclan.
 if(src.source_sha256!==document.source_sha256||
   !src.sectionId.startsWith(document.specialty_id+'-'))
   throw Error('La fuente oficial pertenece a otra especialidad.');
 const ids=new Set(s.contentIds);
 if(enabled)ids.add(src.id);else ids.delete(src.id);
 s.contentIds=[...ids];s.subjectIds=[...new Set(
  s.contentIds.map(id=>bank.find(x=>x.id===id)?.sectionId).filter(Boolean)
 )];
 s.confirmed=false;
 return draft;
}
export function updateTechnicalSpace(document,spaceId,changes){
 const next=copy(document),s=next.spaces.find(x=>x.id===spaceId);
 if(!s)throw Error('Espacio técnico inexistente');
 const props=['name','character','weeklyHours','notes'];
 for(const key of props)if(Object.hasOwn(changes,key))s[key]=changes[key];
 if(!['obligatorio','electivo'].includes(s.character))throw Error('Carácter inválido');
 if(s.weeklyHours!==null&&(!Number.isFinite(Number(s.weeklyHours))||Number(s.weeklyHours)<=0||Number(s.weeklyHours)>45))
  throw Error('Carga horaria inválida; verificar plan curricular');
 s.confirmed=false;return next;
}
export function technicalMapRows(document){
 const terms=technicalCalendar();
 const areas=[...TECH_FG_AREAS,...TECH_SPECIFIC_AREAS];
 return {terms,areas:areas.map(area=>({
  area,cells:terms.map(t=>({
   ...t,spaces:document.spaces.filter(s=>s.area===area&&s.year===t.year&&
     s.term<=t.term&&s.endTerm>=t.term)
  }))
 }))};
}
export function technicalCoverage(document,bank,{area=null,year=null,planContentIds=[]}={}){
 const scopes=bank.filter(r=>(!area||r.area===area)&&(!year||r.year===year));
 const universe=new Set(scopes.map(x=>x.id));
 const relevant=document.spaces.filter(s=>(!area||s.area===area)&&(!year||s.year===year));
 const used=new Set(relevant.flatMap(x=>x.contentIds).filter(id=>universe.has(id)));
 const plan=new Set(asArr(planContentIds).filter(id=>used.has(id)));
 const count=universe.size;
 return {denominator:count,used:used.size,planned:plan.size,
  percent:count?Math.round(used.size/count*100):null,
  planPercent:used.size?Math.round(plan.size/used.size*100):null,
  kind:'cobertura_documental_provisoria',curricularValidated:false};
}
export function validateTechnicalDraft(document,bank){
 const specialty=findSpecialty(document.specialty_id),issues=[],warnings=[];
 if(!specialty)return {valid:false,partial:false,issues:['Especialidad desconocida'],warnings};
 for(const s of document.spaces){
  const req={
   year:s.year,term:s.term,format:s.format,duration:s.duration,
   weeklyHours:s.weeklyHours,subjects:s.subjectIds,
   name:s.name,title:s.name,area:s.area
  };
  const v=validateTechnicalSpace(req,{specialty:specialty.id,plan:null});
  issues.push(...v.errors.map(e=>({spaceId:s.id,message:e.message,code:e.code})));
  warnings.push(...v.warnings.map(e=>({spaceId:s.id,message:e.message,code:e.code})));
  if(s.requiredPlan||!s.weeklyHours)warnings.push({spaceId:s.id,code:'DESIGN_HOURS_REQUIRED',
   message:'Corroborar materias y horas según el diseño curricular de esta especialidad.'});
 }
 const c=(format)=>document.spaces.filter(x=>x.format===format).length;
 const sums={
  sociales:c('integracion_social'),naturales:c('integracion_natural'),
  fisica:document.spaces.filter(x=>x.area==='Educación Física').length,
  artes:document.spaces.filter(x=>x.area==='Educación Artística').length,
  pvf:c('vinculacion_futuro')
 };
 const expectedSocial=specialty.id==='computacion'?10:8;
 for(const [label,actual,expected] of [
  ['Ciencias Sociales',sums.sociales,expectedSocial],
  ['Ciencias Naturales',sums.naturales,6],
  ['Educación Física',sums.fisica,12],
  ['Educación Artística',sums.artes,2],
  ['Proyecto de Vinculación con el Futuro',sums.pvf,2]
 ])if(actual!==expected)issues.push({code:'TRAJECTORY_COUNT',
  message:label+': la trayectoria requiere '+expected+' espacios, hay '+actual});
 const counts=Object.fromEntries(RANGE.map(y=>[y,document.spaces.filter(s=>s.year===y).length]));
 const dup=new Set();
 for(const s of document.spaces)for(const id of s.contentIds){
  if(dup.has(id))warnings.push({spaceId:s.id,code:'DUPLICATED_REFERENCE',
   message:'Referencia documental usada más de una vez; revisar solapamiento sin contar cobertura doble.'});
  dup.add(id);
 }
 if(!document.spaces.every(validSpace))issues.push({code:'INVALID_SPACE',message:'Un espacio tiene año, cuatrimestre o duración inválidos'});
 const ready=issues.length===0&&warnings.length===0;
 return {valid:ready,partial:issues.length===0,issues,warnings,
  counts,sums,sourceVersion:document.source_sha256,rulesVersion:document.ruleset,
  readyForPublication:false};
}
export function technicalPlanSeed({pci,space,offer}){
 if(!space?.id||offer?.pci_id!==pci?.pci_id||offer?.model!=='tecnica')
  throw Error('El plan no corresponde al PCI técnico.');
 return {schema:TECH_PLAN_SCHEMA,model:'tecnica',
  school_id:Number(pci.school_id),pci_id:pci.pci_id,
  orientation_id:pci.orientation_id,process_id:pci.process_id,
  original_sha256:pci.legacy_sha256,specialty_id:offer.specialty_id,
  specialty_name:offer.specialty_name,
  source_sha256:offer.source_sha256,space_id:space.id,year:space.year,format:space.format,
  name:space.name,objective:'',synopsis:'',context:'',practiceAxis:'',
  contentIds:[...space.contentIds],status:'borrador_no_homologado',
  plansBimestrales:[1,2,3,4].map(number=>({
    number,name:'Plan '+number,synopsis:'',objectives:'',contentIds:[],
    stages:Object.fromEntries(TECH_STAGES.map(id=>[id,{
      description:'',duration:'',resources:'',activities:'',evidence:''
    }]))
  }))
 };
}
export function guardTechnicalPlan(document,pci,space,offer){
 if(!object(document)||document.schema!==TECH_PLAN_SCHEMA||
  document.model!=='tecnica'||Number(document.school_id)!==Number(pci.school_id)||
  document.pci_id!==pci.pci_id||document.orientation_id!==pci.orientation_id||
  document.process_id!==pci.process_id||document.original_sha256!==pci.legacy_sha256||
  document.specialty_id!==offer.specialty_id||document.source_sha256!==offer.source_sha256||
  document.space_id!==space.id||document.status!=='borrador_no_homologado'||
  !Array.isArray(document.plansBimestrales)||document.plansBimestrales.length!==4||
  document.plansBimestrales.some((plan,i)=>Number(plan.number)!==i+1||
    !object(plan.stages)||TECH_STAGES.some(stage=>!object(plan.stages[stage]))))
  throw Error('Plan técnico incompatible, incompleto o perteneciente a otro PCI.');
 return copy(document);
}
