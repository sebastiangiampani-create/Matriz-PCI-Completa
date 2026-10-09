/**
 * Offer composition reference engine (isolated, in-memory).
 * Uses the real, snapshotted V2 rules and subject/hour catalogs.
 * Existing Matriz FG groups and their teaching sequences are never rewritten.
 *
 * Phases:
 * - Mapa de la Oferta: arrange FG/FO subjects and valid formats.
 * - Mapa Propuesta Curricular: only after offer validation.
 */
import {FG_MODES} from './bridge.js';
import {validateFgComposition} from './reglas-composicion-fg.js';
const clone=x=>JSON.parse(JSON.stringify(x));
const normalize=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const array=x=>Array.isArray(x)?x:[];
const int=x=>Number.isInteger(Number(x))?Number(x):0;
const PERIOD={3:[5,6],4:[7,8],5:[9,10]};
const COUNTS={3:1,4:1,5:2};
const typeLabel={laboratorio:'Laboratorio FO',taller:'Taller FO',proyecto:'Proyecto de Vinculación con el Futuro'};
function ws(pack,id){
  const w=pack?.orientations?.[id];
  if(!w)throw new Error('Orientación no habilitada.');
  return w;
}
function requireRules(rules){
  if(rules?.modelo_institucional?.unidad_trabajo!=='pci_por_escuela_y_orientacion')
    throw new Error('No se cargaron las reglas prescriptas de Aprende V2.');
  if(rules.formacion_orientada?.laboratorios?.cantidad!==4||
     rules.formacion_orientada?.talleres?.cantidad!==4)
    throw new Error('La distribución FO de referencia cambió; requiere revisión.');
}
function makeSpace(kind,year,index,term){
  return {
    id:'fo-'+kind+'-'+year+'-'+index,
    year,kind,term,startTerm:kind==='proyecto'?9:term,
    endTerm:kind==='proyecto'?10:term,
    duration:kind==='proyecto'?'annual':'quarterly',
    name:typeLabel[kind]+' '+year+'º'+(COUNTS[year]>1?' ('+index+')':''),
    members:[],contentIds:[],
    provisionalContentIds:[],
    plans:[],status:'incomplete',
    phase:'mapa-oferta',
    source:'PCI Aprende V2 - plantilla normativa'
  };
}
export function seedOfferStructure(pack,orientationId,refs){
  const w=ws(pack,orientationId);
  requireRules(refs?.rules);
  if(w.fo.spaces.length)return clone(pack); // existing decisions always prevail
  const upd=clone(pack),spaces=[];
  for(const year of [3,4,5]){
    for(const kind of ['laboratorio','taller']){
      const terms=year===3?(kind==='laboratorio'?[5]:[6])
        :year===4?(kind==='laboratorio'?[7]:[8])
        :[9,10];
      terms.forEach((term,i)=>spaces.push(makeSpace(kind,year,i+1,term)));
    }
  }
  spaces.push(makeSpace('proyecto',5,1,9));
  upd.orientations[orientationId].fo.spaces=spaces;
  upd.orientations[orientationId].fo.subjectAlternative='A';
  upd.orientations[orientationId].fo.subjectAssignments=[];
  return upd;
}
function lookup(map,name){
  const k=normalize(name);
  return Object.entries(map||{}).find(([key])=>normalize(key)===k)?.[1]??null;
}
function orientationName(refs,orientationId){
  const row=refs?.catalog?.orientaciones?.find(o=>o.id===orientationId);
  if(row)return row.nombre;
  const art=orientationId.startsWith('arte_')?
    {'arte_artes_visuales':'Arte - Artes Visuales','arte_musica':'Arte - Música','arte_teatro':'Arte - Teatro'}[orientationId]
    :null;
  if(art)return art;
  throw new Error('La orientación no tiene catálogo oficial.');
}
export function foSubjectBank({orientationId,refs,alternative='A'}){
  requireRules(refs?.rules);
  if(!['A','B'].includes(alternative))throw new Error('Alternativa curricular inválida.');
  const name=orientationName(refs,orientationId);
  const programs=refs.subjects?.formacion_orientada?.[name];
  const hours=refs.hours?.formacion_orientada?.[name];
  if(!programs) return {orientationId,name,subjects:[],warning:'No hay materias FO prescriptas en el catálogo de referencia.'};
  const subjects=[];
  for(const year of [3,4,5]){
    const names=year===3?programs['3']:programs[alternative]?.[String(year)];
    const hoursMap=year===3?hours?.['3']:hours?.[alternative]?.[String(year)];
    for(const subj of array(names)){
      const value=lookup(hoursMap,subj);
      subjects.push({id:'fo-materia:'+orientationId+':'+year+':'+normalize(subj).replaceAll(' ','-'),
        component:'FO',name:String(subj),year,orientationId,
        hours:value===null?null:Number(value),alternative:year===3?'shared':alternative});
    }
  }
  return {orientationId,name,alternative,subjects,
    warning:programs.sourceWarning||null};
}
export function setFoAlternative(pack,orientationId,alternative){
  if(!['A','B'].includes(alternative))throw new Error('Alternativa FO inválida.');
  const w=ws(pack,orientationId);
  if(w.fo.spaces.some(s=>array(s.members).length))
    throw new Error('Hay materias FO ubicadas; revisar sus asignaciones antes de cambiar de alternativa.');
  const upd=clone(pack);
  upd.orientations[orientationId].fo.subjectAlternative=alternative;
  return upd;
}
function totalHours(space,additional=null){
  const list=additional?[...array(space.members),additional]:array(space.members);
  if(list.some(s=>!Number.isFinite(s.hours)||s.hours<0))return null;
  return list.reduce((sum,member)=>sum+member.hours,0);
}
export function assignFoSubject(pack,{orientationId,spaceId,subjectId,refs}){
  const w=ws(pack,orientationId);
  // Conservar FG does not prevent the school from constructing its FO.
  // The mode only protects modifications to the copied FG itself.
  const s=w.fo.spaces.find(x=>x.id===spaceId);
  if(!s||s.kind==='proyecto')throw new Error('Destino FO inválido para una materia.');
  const bank=foSubjectBank({orientationId,refs,alternative:w.fo.subjectAlternative||'A'});
  const subject=bank.subjects.find(x=>x.id===subjectId);
  if(!subject)throw new Error('La materia no figura en el catálogo curricular de la orientación.');
  if(subject.year!==s.year)throw new Error('Las materias no pueden moverse entre niveles.');
  if(s.members.some(x=>x.id===subject.id))return clone(pack);
  // Annual subjects can occupy paired quarters. They cannot be duplicated
  // within the SAME term, where this would represent two simultaneous offers.
  const sameTerm=w.fo.spaces.filter(x=>x.id!==s.id&&x.term===s.term&&
    array(x.members).some(y=>y.id===subject.id));
  if(sameTerm.length)
    throw new Error('Materia ya ubicada en otro espacio del mismo cuatrimestre.');
  if(subject.hours===null||subject.hours<=0)
    throw new Error('No se conoce la carga horaria oficial de esta materia. Revisar catálogo.');
  const max=Number(refs.rules.laboratorios?.max_horas_catedra)||9;
  const hc=totalHours(s,subject);
  if(s.kind==='laboratorio'&&hc>max)
    throw new Error('Superaría el máximo de '+max+' horas cátedra del laboratorio.');
  const upd=clone(pack);
  const target=upd.orientations[orientationId].fo.spaces.find(x=>x.id===spaceId);
  target.members.push(subject);
  // In 5th year, the SAME format exists in both quarters (C9 and C10).
  // Apply the V2 annual-mirroring rule only when its paired format exists.
  const otherTerm=PERIOD[s.year]?.find(t=>t!==s.term);
  const mirror=upd.orientations[orientationId].fo.spaces.find(x=>
    x.id!==spaceId&&x.year===s.year&&x.term===otherTerm&&x.kind===s.kind);
  if(mirror&&!mirror.members.some(x=>x.id===subject.id)){
    const otherTotal=totalHours(mirror,subject);
    if(s.kind==='laboratorio'&&otherTotal>max)
      throw new Error('La réplica anual superaría el máximo de horas del laboratorio par.');
    const conflict=upd.orientations[orientationId].fo.spaces.some(x=>
      x.id!==mirror.id&&x.term===mirror.term&&array(x.members).some(m=>m.id===subject.id));
    if(conflict)throw new Error('La réplica anual duplicaría la materia dentro del cuatrimestre par.');
    mirror.members.push({...subject,mirroredFrom:spaceId});
  }
  return upd;
}
export function moveFoSpace(pack,{orientationId,spaceId,targetTerm}){
  const w=ws(pack,orientationId),s=w.fo.spaces.find(x=>x.id===spaceId),t=int(targetTerm);
  if(!s)throw new Error('No se encontró el formato de la orientación.');
  if(s.kind==='proyecto')throw new Error('El proyecto anual permanece en C9-C10.');
  if(!PERIOD[s.year]?.includes(t))throw new Error('El formato FO debe permanecer dentro del mismo nivel.');
  const upd=clone(pack),target=upd.orientations[orientationId].fo.spaces.find(x=>x.id===spaceId);
  target.term=t;target.startTerm=t;target.endTerm=t;
  return upd;
}
export function validateOfferStructure(pack,orientationId,refs){
  const w=ws(pack,orientationId);
  requireRules(refs?.rules);
  const spaces=array(w.fo.spaces),errors=[],warnings=[];
  const distribution=refs.rules.formacion_orientada;
  for(const kind of ['laboratorio','taller']){
    const spec=distribution[kind==='laboratorio'?'laboratorios':'talleres'];
    const type=spaces.filter(s=>s.kind===kind);
    if(type.length!==spec.cantidad)errors.push('FO: se requieren exactamente '+spec.cantidad+' '+kind+'s.');
    for(const year of [3,4,5]){
      const subset=type.filter(s=>s.year===year);
      const required=spec.distribucion[String(year)];
      if(subset.length!==required)errors.push('FO: '+kind+' de '+year+'º requiere '+required+' espacios.');
    }
  }
  const projects=spaces.filter(s=>s.kind==='proyecto');
  if(projects.length!==1||projects[0]?.year!==5||projects[0]?.startTerm!==9||projects[0]?.endTerm!==10)
    errors.push('Debe existir un Proyecto de Vinculación anual en C9-C10.');
  for(const s of spaces){
    if(!PERIOD[s.year]){errors.push('Espacio FO con nivel inválido: '+s.id);continue;}
    if(s.kind!=='proyecto'&&!PERIOD[s.year].includes(s.term))
      errors.push('El formato '+s.name+' está fuera del nivel que corresponde.');
    if(s.kind==='proyecto')continue;
    const min=s.year===3?1:2;
    if(array(s.members).length<min)errors.push(s.name+': necesita '+min+' materias como mínimo.');
    if(array(s.members).some(m=>m.year!==s.year))
      errors.push(s.name+': contiene materias de otro año.');
    const hc=totalHours(s);
    if(hc===null)errors.push(s.name+': no se conoce la carga horaria de todas sus materias.');
    else if(s.kind==='laboratorio'&&hc>(Number(refs.rules.laboratorios?.max_horas_catedra)||9))
      errors.push(s.name+': supera el máximo permitido de horas cátedra.');
    if(!array(s.members).length&&array(s.contentIds).length)
      warnings.push(s.name+': tiene contenidos de un espacio todavía sin conformación.');
  }
  // Use the same V2 normative structure for the copied Matriz FG.
  // Missing curricular membership is a review warning, not a guessed subject.
  const fgValidation=validateFgComposition(w.fg.areas,refs);
  errors.push(...fgValidation.errors);
  warnings.push(...fgValidation.warnings);
  return {valid:errors.length===0&&warnings.length===0,
    phase:errors.length?'incomplete':'pending-fg-homologation',errors,warnings,
    foSpaces:spaces.length,fgUnchanged:true,fgValidation};
}
export function offerMapRows(pack,orientationId){
  const w=ws(pack,orientationId);
  const map=Array.from({length:10},(_,i)=>({term:i+1,year:Math.ceil((i+1)/2),fg:[],fo:[]}));
  for(const [area,block] of Object.entries(w.fg.areas||{})){
    for(const group of array(block.groups)){
      const first=int(group.startTerm),last=int(group.endTerm);
      if(!first||first>10)continue;
      for(let term=first;term<=Math.min(last||first,10);term++)
        map[term-1].fg.push({area,id:group.id,name:group.name,
          kind:group.kind,level:group.level,contents:array(group.items).length,
          plans:array(group.plansBimestrales).length,immutableLegacy:false});
    }
  }
  for(const s of array(w.fo.spaces))
    for(let term=s.startTerm??s.term;term<=(s.endTerm??s.term);term++)
      if(map[term-1])map[term-1].fo.push(clone(s));
  return map;
}

/**
 * Drag-and-drop adapters for curricular CONTENTS, not curricular SUBJECTS.
 * FO content moves are staged until its Fase 1 composition is validated.
 * Existing FG contents can be appended in a copied FG group only, never removed.
 */
export function stageFoContent(pack,{orientationId,spaceId,contentId,foRows}){
  const w=ws(pack,orientationId);
  const s=w.fo.spaces.find(x=>x.id===spaceId);
  if(!s)throw new Error('No existe el espacio FO.');
  const content=array(foRows).find(x=>x.id===contentId);
  if(!content)throw new Error('Contenido no identificado en la base FO de la orientación.');
  const upd=clone(pack);
  const target=upd.orientations[orientationId].fo.spaces.find(x=>x.id===spaceId);
  if(!array(target.provisionalContentIds).includes(contentId))
    target.provisionalContentIds=[...array(target.provisionalContentIds),contentId];
  return upd;
}
export function appendFgContent(pack,{orientationId,area,groupId,contentId,matrixRows}){
  const w=ws(pack,orientationId);
  if(w.fg.mode!==FG_MODES.REVISAR)
    throw new Error('Elegí Revisar y adaptar para incorporar contenidos.');
  const group=w.fg.areas?.[area]?.groups?.find(x=>String(x.id)===String(groupId));
  if(!group)throw new Error('Agrupamiento FG inexistente.');
  const item=array(matrixRows).find(x=>String(x.id)===String(contentId));
  if(!item||normalize(item.area)!==normalize(area))
    throw new Error('El contenido no pertenece a la bolsa original de esta área.');
  const upd=clone(pack),fg=upd.orientations[orientationId].fg.areas[area].groups
    .find(x=>String(x.id)===String(groupId));
  if(!array(fg.items).map(String).includes(String(contentId)))
    fg.items=[...array(fg.items),String(contentId)];
  return upd;
}
