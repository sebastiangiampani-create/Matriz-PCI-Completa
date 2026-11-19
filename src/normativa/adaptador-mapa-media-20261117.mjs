/**
 * Lectura de la misma estructura PCI V2 (Media) hacia el validador del
 * Anexo II final. Inmutable: conserva íntegros los grupos FG, planes y
 * FO, incluso cuando la escuela todavía no confirmó las materias.
 */
import {validateFinalComposition,FINAL_RULESET_ID}
  from './composicion-pci-20261117.mjs';

const array=x=>Array.isArray(x)?x:[];
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const counts=[1,2,3,4,5];
const fgAreas={
 'Lengua y Literatura':{format:'troncal',area:'Lengua y Literatura',duration:'anual'},
 'Matemática':{format:'troncal',area:'Matemática',duration:'anual'},
 'Lenguas Adicionales':{format:'troncal',area:'Lengua Adicional',duration:'anual'},
 'Ciencias Sociales':{format:'laboratorio_social',area:'Ciencias Sociales',duration:'cuatrimestral'},
 'Ciencias Naturales':{format:'laboratorio_natural',area:'Ciencias Naturales',duration:'cuatrimestral'},
 'Artes':{format:'espacio_formativo',area:'Artes',duration:'cuatrimestral'},
 'Tecnologías':{format:'espacio_formativo',area:'Tecnologías',duration:'cuatrimestral'},
 'Educación Física':{format:'espacio_formativo',area:'Educación Física',duration:'cuatrimestral'}
};
function id(s){return String(s??'');}
function yearOf(g){
 const provided=Number(g?.level);
 return Number.isInteger(provided)&&provided>0?provided:Math.ceil(Number(g?.startTerm??g?.termStart??g?.term)/2);
}
function startingTerm(g,y){
 const t=Number(g?.startTerm??g?.termStart??g?.term);
 return Number.isInteger(t)&&t>0?t:(y*2-1);
}
function kindFromFo(kind){
 return {laboratorio:'laboratorio_orientacion',taller:'taller_orientacion',
  proyecto:'vinculacion_futuro'}[kind]||'formato_fo_sin_definir';
}
function character(g){
 if(['obligatorio','electivo'].includes(g?.character))return g.character;
 if(g?.mandatory===true)return 'obligatorio';
 if(g?.elective===true)return 'electivo';
 return 'pendiente_confirmar_electividad';
}
export function projectMediaWorkspaceForFinalValidation(workspace,orientationId){
 const parent=workspace?.orientations?.[orientationId];
 if(!obj(parent?.fg?.areas)||!Array.isArray(parent?.fo?.spaces))
  throw Error('No hay un PCI de Media con FG y FO disponibles para la revisión.');
 const mapped=[],unknown=[];
 for(const [name,block] of Object.entries(parent.fg.areas)){
  const rule=fgAreas[name];
  if(!rule){unknown.push(name);continue;}
  for(const g of array(block?.groups)){
   const year=yearOf(g),term=startingTerm(g,year),annual=rule.duration==='anual';
   mapped.push({
    id:'fg:'+name+':'+id(g.id),year,term,
    endTerm:annual?term+1:term,
    duration:rule.duration,format:rule.format,area:rule.area,
    character:character(g),included:true,
    subjectIds:g?.compositionReviewed===true?array(g.curricularSubjects).map(id):[],
    // No convertir las horas de notas del docente en una carga oficial.
    weeklyHours:g?.weeklyHoursVerified===true?g.weeklyHours:null,
    origin:'matriz_fg_preservada',fgGroupId:id(g.id)
   });
  }
 }
 for(const s of parent.fo.spaces){
  if(!s||!['laboratorio','taller','proyecto'].includes(s.kind)){
   unknown.push('FO '+id(s?.id));continue;
  }
  const term=Number(s?.startTerm??s?.term),year=Number(s?.year);
  mapped.push({
   id:'fo:'+id(s.id),year,term,endTerm:Number(s?.endTerm??term),
   duration:s.kind==='proyecto'?'anual':'cuatrimestral',
   format:kindFromFo(s.kind),area:s.kind==='proyecto'?
      'Proyecto de Vinculación con el Futuro':'Formación Orientada',
   character:s.kind==='laboratorio'?'obligatorio':
     s.kind==='taller'?'electivo':'obligatorio',
   subjectIds:array(s.members).map(m=>id(m?.id??m?.name)).filter(Boolean),
   // Solamente si el catálogo FO aporta TODAS las horas numéricas.
   weeklyHours:s.kind!=='proyecto'&&s.members?.length&&
      array(s.members).every(m=>Number.isFinite(m.hours)&&m.hours>0)?
     s.members.reduce((n,m)=>n+m.hours,0):null,
   included:true,origin:'formacion_orientada',foSpaceId:id(s.id)
  });
 }
 const totalSocial=mapped.filter(s=>s.format==='laboratorio_social').length;
 return {model:'bachillerato',orientation:parent.name||orientationId,
  spaces:mapped,selectedSocialOption:[10,12].includes(totalSocial)?totalSocial:null,
  warningAreasNotMapped:unknown,sourceSchema:workspace.version,
  explicitFgCompositions:mapped.filter(s=>s.origin==='matriz_fg_preservada'&&s.subjectIds.length>0).length};
}
export function validateMediaWorkspaceFinal(workspace,orientationId){
 const projection=projectMediaWorkspaceForFinalValidation(workspace,orientationId);
 const check=validateFinalComposition(projection);
 const warnings=[...check.warnings];
 for(const area of projection.warningAreasNotMapped)
  warnings.push({code:'AREA_NOT_HOMOLOGATED',message:'Área no normalizada: '+area,
    severity:'warning',page:8});
 return {
  ...check,warnings,
  source:FINAL_RULESET_ID,
  valid:check.valid&&warnings.length===0,
  readyForPublication:false,
  legacyPreserved:true,
  workingSpaces:projection.spaces.length,
  explicitFgCompositions:projection.explicitFgCompositions
 };
}
