/**
 * Reviewed equivalence layer between Matriz PCI content IDs and V2 FG v103.
 *
 * IMPORTANT:
 * - Approval never modifies a Matriz area, grouping, plan or sequence.
 * - Explicit reviewer is informational in this isolated demo. Production
 *   MUST derive identity/authorization from a validated server session.
 * - A proposed match never counts toward curricular coverage until approved.
 */
const clone=v=>JSON.parse(JSON.stringify(v));
const array=v=>Array.isArray(v)?v:[];
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const aliases=new Map([
  ['lengua adicional','lenguas adicionales'],
  ['formacion etica ciudadana','formacion etica y ciudadana'],
  ['tecnologia de la informacion','tecnologias de la informacion'],
  ['educacion artistica artes visuales','artes visuales']
]);
const subjectKey=s=>aliases.get(norm(s))||norm(s);
const tokenSet=s=>new Set(norm(s).split(' ').filter(x=>x.length>3));
function overlap(a,b){
  const A=tokenSet(a),B=tokenSet(b);
  if(!A.size||!B.size)return 0;
  const common=[...A].filter(x=>B.has(x)).length;
  return common/Math.max(A.size,B.size);
}
export function mappingKey(area,year,matrixId){
  return JSON.stringify([String(area),Number(year),String(matrixId)]);
}
export function suggestHomologations({matrixRows,v2FgRows,area,year,matrixId,limit=8}){
  const level=Number(year),src=array(matrixRows).find(r=>String(r.id)===String(matrixId));
  if(!src)throw new Error('No existe el contenido original de Matriz PCI.');
  if(norm(src.area)!==norm(area))throw new Error('El área original no coincide.');
  if(!Number.isInteger(level)||level<1||level>5)throw new Error('Nivel inválido.');
  const possibilities=array(v2FgRows)
    .filter(r=>Number(r.year)===level&&norm(r.area)===norm(area)&&
      subjectKey(r.subject)===subjectKey(src.subject))
    .map(r=>({
      id:String(r.id),year:level,area:r.area,subject:r.subject,
      text:r.text,axis:r.axis,subaxis:r.subaxis,
      exact:norm(r.text)===norm(src.text),
      similarity:overlap(src.text,r.text)
    }))
    .sort((a,b)=>Number(b.exact)-Number(a.exact)||b.similarity-a.similarity||a.id.localeCompare(b.id));
  return {
    source:{id:String(src.id),area:src.area,subject:src.subject,text:src.text},
    year:level,exactCandidates:possibilities.filter(x=>x.exact).length,
    candidates:possibilities.slice(0,Math.max(1,Math.min(20,Number(limit)||8))),
    note:'Coincidencia sugerida, no equivalencia aprobada. Verificá sentido pedagógico y año.'
  };
}
function knownGroup(areas,area,year,id){
  return array(areas?.[area]?.groups).some(g=>Number(g.level)===Number(year)&&
    [...array(g.items),...array(g.provisionalContentIds)].map(String).includes(String(id)));
}
export function approveHomologation(pack,{
  orientationId,area,year,matrixId,referenceId,reason,reviewer,
  matrixRows,v2FgRows
}){
  const w=pack?.orientations?.[orientationId];
  if(!w)throw new Error('Orientación inexistente.');
  if(!knownGroup(w.fg.areas,area,year,matrixId))
    throw new Error('Este contenido no está ubicado en FG en ese nivel y orientación.');
  const src=array(matrixRows).find(r=>String(r.id)===String(matrixId));
  const target=array(v2FgRows).find(r=>String(r.id)===String(referenceId));
  if(!src||!target)throw new Error('Se requiere un contenido válido de ambas bases.');
  if(norm(src.area)!==norm(area)||norm(target.area)!==norm(area)||
      Number(target.year)!==Number(year))
    throw new Error('No se permite vincular contenidos de otra área o nivel.');
  if(subjectKey(src.subject)!==subjectKey(target.subject))
    throw new Error('Las materias son diferentes: la homologación requiere análisis institucional.');
  if(String(reason||'').trim().length<10)
    throw new Error('La homologación necesita una justificación pedagógica.');
  if(!String(reviewer||'').trim())
    throw new Error('Se requiere identificar quién revisó la equivalencia.');
  const updated=clone(pack),fg=updated.orientations[orientationId].fg;
  fg.homologations=fg.homologations||{};
  fg.homologationHistory=array(fg.homologationHistory);
  const key=mappingKey(area,year,matrixId),previous=fg.homologations[key]||null;
  if(previous?.referenceId===String(referenceId))return updated;
  const record={
    status:'approved',
    area,year:Number(year),matrixId:String(matrixId),referenceId:String(referenceId),
    sourceSubject:src.subject,targetSubject:target.subject,
    textExact:norm(src.text)===norm(target.text),
    reason:String(reason).trim(),reviewer:String(reviewer).trim()
  };
  fg.homologations[key]=record;
  fg.homologationHistory.push({key,previous:previous?clone(previous):null,record:clone(record)});
  return updated;
}
export function getApprovedHomologations(pack,orientationId){
  const w=pack?.orientations?.[orientationId];
  if(!w)throw new Error('Orientación inexistente.');
  return clone(w.fg.homologations||{});
}
export function inspectHomologations(pack,orientationId,{matrixRows,v2FgRows}){
  const w=pack?.orientations?.[orientationId];
  if(!w)throw new Error('Orientación inexistente.');
  const out={valid:0,stale:0,records:[]};
  for(const [key,m] of Object.entries(w.fg.homologations||{})){
    const src=array(matrixRows).find(r=>String(r.id)===String(m.matrixId));
    const v2=array(v2FgRows).find(r=>String(r.id)===String(m.referenceId));
    const ok=!!src&&!!v2&&m.status==='approved'&&
      norm(src.area)===norm(m.area)&&norm(v2.area)===norm(m.area)&&
      subjectKey(src.subject)===subjectKey(v2.subject)&&Number(v2.year)===Number(m.year)&&
      knownGroup(w.fg.areas,m.area,m.year,m.matrixId);
    if(ok)out.valid++;else out.stale++;
    out.records.push({key,status:ok?'valid':'stale',area:m.area,year:m.year,
      matrixId:m.matrixId,referenceId:m.referenceId});
  }
  return out;
}
