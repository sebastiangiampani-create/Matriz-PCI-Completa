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
/**
 * Cada registro une UN contenido amplio de Matriz con 1..N unidades FG V2
 * del MISMO nivel. Distintos niveles usan claves independientes.
 * Un vínculo sugerido nunca suma cobertura sin revisión pedagógica.
 */
export function approvedReferenceIds(mapping) {
  if(!mapping||typeof mapping!=='object')return [];
  const arr=Array.isArray(mapping.referenceIds)?mapping.referenceIds:
    mapping.referenceId!==undefined?[mapping.referenceId]:[];
  return [...new Set(arr.map(String))];
}
export function approveHomologation(pack,{
  orientationId,area,year,matrixId,referenceId,referenceIds,reason,reviewer,
  matrixRows,v2FgRows
}){
  const w=pack?.orientations?.[orientationId];
  if(!w)throw new Error('Orientación inexistente.');
  if(!knownGroup(w.fg.areas,area,year,matrixId))
    throw new Error('Este contenido no está ubicado en FG en ese nivel y orientación.');
  const src=array(matrixRows).find(r=>String(r.id)===String(matrixId));
  const rawRefs=Array.isArray(referenceIds)?referenceIds:
    referenceId!==undefined?[referenceId]:[];
  const ids=rawRefs.map(String);
  if(!src||!ids.length||ids.some(id=>!id.trim())||
      ids.length!==new Set(ids).size)
    throw new Error('Se requiere un contenido original y referencias V2 únicas.');
  const byId=new Map(array(v2FgRows).map(r=>[String(r.id),r]));
  const targets=ids.map(id=>byId.get(id));
  if(targets.some(r=>!r))throw new Error('Una referencia V2 no existe.');
  if(norm(src.area)!==norm(area)||targets.some(r=>
      norm(r.area)!==norm(area)||Number(r.year)!==Number(year)))
    throw new Error('No se permite vincular contenidos de otra área o nivel.');
  if(targets.some(r=>subjectKey(src.subject)!==subjectKey(r.subject)))
    throw new Error('Las materias son diferentes: la homologación requiere análisis institucional.');
  if(String(reason||'').trim().length<10)
    throw new Error('La homologación necesita una justificación pedagógica.');
  if(!String(reviewer||'').trim())
    throw new Error('Se requiere identificar quién revisó la equivalencia.');
  const updated=clone(pack),fg=updated.orientations[orientationId].fg;
  fg.homologations=fg.homologations||{};
  fg.homologationHistory=array(fg.homologationHistory);
  const key=mappingKey(area,year,matrixId),previous=fg.homologations[key]||null;
  if(previous && JSON.stringify(approvedReferenceIds(previous))===JSON.stringify(ids))
    return updated;
  const record={
    status:'approved',
    area,year:Number(year),matrixId:String(matrixId),
    referenceId:ids[0],referenceIds:ids,
    referenceVersion:'fg-sec-aprende-v2/1',
    mappingType:ids.length>1?'one-to-many':'one-to-one',
    sourceSubject:src.subject,targetSubject:targets[0].subject,
    textExact:ids.length===1&&norm(src.text)===norm(targets[0].text),
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
    const refs=approvedReferenceIds(m);
    const byId=new Map(array(v2FgRows).map(r=>[String(r.id),r]));
    const targets=refs.map(id=>byId.get(id));
    const ok=!!src&&refs.length>0&&targets.every(r=>!!r)&&m.status==='approved'&&
      norm(src.area)===norm(m.area)&&
      targets.every(r=>norm(r.area)===norm(m.area)&&
        subjectKey(src.subject)===subjectKey(r.subject)&&Number(r.year)===Number(m.year))&&
      String(m.reason||'').trim().length>=10&&String(m.reviewer||'').trim().length>0&&
      knownGroup(w.fg.areas,m.area,m.year,m.matrixId);
    if(ok)out.valid++;else out.stale++;
    out.records.push({key,status:ok?'valid':'stale',area:m.area,year:m.year,
      matrixId:m.matrixId,referenceId:refs[0]||null,referenceIds:refs});
  }
  return out;
}


/**
 * Vista previa de homologación por lotes, sin cambios de estado.
 *
 * Un contenido amplio puede sugerir 0..N desagregaciones del catálogo V2.
 * La lista se arma por AÑO de la tarjeta de Matriz (no del texto histórico,
 * que no tiene año), AREA y MATERIA. Una coincidencia léxica NO acredita
 * equivalencia ni es evidencia de cobertura.
 *
 * IMPORTANTE: si un mismo contenido original se reutilizara en diferentes
 * niveles, cada nivel genera su propia revisión curricular independiente.
 */
export function buildHomologationReviewQueue({
  matrixRows,v2FgRows,areas,area,year,maxSuggestions=6
}){
  const level=Number(year);
  if(!Number.isInteger(level)||level<1||level>5)
    throw new Error('Seleccioná un año entre 1.º y 5.º.');
  const name=String(area??'');
  if(!name.trim())throw new Error('Falta el área de Formación General.');
  const groups=array(areas?.[name]?.groups)
    .filter(g=>Number(g?.level)===level);
  const byId=new Map(array(matrixRows)
    .filter(r=>norm(r?.area)===norm(name)).map(r=>[String(r.id),r]));
  const assigned=new Map();
  for(const g of groups){
    for(const id of array(g?.items)){
      const key=String(id);
      if(!assigned.has(key))assigned.set(key,{id:key,groups:[]});
      assigned.get(key).groups.push({id:String(g.id||''),name:String(g.name||'')});
    }
    for(const id of array(g?.provisionalContentIds)){
      const key=String(id);
      if(!assigned.has(key))assigned.set(key,{id:key,groups:[]});
      const record=assigned.get(key);
      if(!record.groups.some(x=>x.id===String(g.id||'')))
        record.groups.push({id:String(g.id||''),name:String(g.name||'')});
    }
  }
  const count=Math.max(1,Math.min(12,Number(maxSuggestions)||6));
  const rows=[...assigned.values()].map(entry=>{
    const old=byId.get(entry.id);
    if(!old)return {
      matrixId:entry.id,groups:entry.groups,year:level,
      status:'missing-original',candidates:[],
      warning:'El ID original no existe en el catálogo: no se debe homologar.'
    };
    const result=suggestHomologations({
      matrixRows,v2FgRows,area:name,year:level,
      matrixId:entry.id,limit:count
    });
    // Solo son candidatos del mismo año, área y materia. Un caso
    // transversal o sin terminología común necesita revisión aparte.
    const candidates=result.candidates.map(x=>({
      ...x,
      matchKind:x.exact?'textual':'possible',
      suggestedOnly:true
    }));
    const supported=candidates.filter(x=>x.exact||x.similarity>=0.15);
    return {
      matrixId:entry.id,groups:entry.groups,year:level,
      source:{...result.source},status:
        supported.length?'needs-pedagogical-review':'manual-search',
      suggestedReferenceIds:supported.map(x=>x.id),
      candidates,
      suggestedOnly:true,
      warning:supported.length?
        'Los contenidos sugeridos requieren revisión individual. No cuentan como cobertura.'
        :'No se hallaron coincidencias textuales suficientes: revisar significado, ejes y progresión.'
    };
  });
  return {
    area:name,year:level,
    sourceVersion:'fg-matriz-historica/1',
    referenceVersion:'fg-sec-aprende-v2/1',
    rows,
    summary:{
      placedOriginals:rows.length,
      needsReview:rows.filter(r=>r.status==='needs-pedagogical-review').length,
      manualSearch:rows.filter(r=>r.status==='manual-search').length,
      missingOriginals:rows.filter(r=>r.status==='missing-original').length,
      approvedByThisOperation:0
    },
    safety:'Previsualización exclusivamente: no aprueba relaciones ni altera contenidos, agrupamientos, planes o coberturas.'
  };
}
