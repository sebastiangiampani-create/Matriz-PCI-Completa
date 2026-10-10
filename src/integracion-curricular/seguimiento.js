/**
 * Curricular tracking across FG and FO.
 * Keeps separate: area / year, subject / year, grouping, format and plan.
 *
 * Original Matriz contents have no explicit year. An FG content must be
 * homologated against the V2 year-specific catalog before it counts.
 * Incomplete matches are never reported as fully verified percentages.
 */
import {matchMatrixToV2Fg,foTrajectoryCoverage,selectFoByOrientation}
  from './catalogos.js';

const arr=x=>Array.isArray(x)?x:[];
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const pct=(a,b)=>b>0?Math.round(a/b*1000)/10:null;
const unique=x=>[...new Set(arr(x).map(String))];
const typeNames={trunk:'Troncal',laboratory:'Laboratorio',workshop:'Taller',other:'Otro formato'};
function useMap({ids,area,year,matrixRows,v2FgRows,approvedMappings={}}){
  const mapped=new Set(),pending=[];
  for(const id of unique(ids)){
    const match=matchMatrixToV2Fg({matrixRows,v2FgRows,contentId:id,level:year,area,approvedMappings});
    if(match.status==='matched')mapped.add(match.referenceId);
    else pending.push({id,status:match.status,reason:match.reason});
  }
  return {mapped,legacyCount:unique(ids).length,pending};
}
function splitAreas(areas){
  return Object.entries(areas||{}).flatMap(([area,block])=>arr(block.groups)
    .filter(g=>g&&Number.isInteger(Number(g.level))&&Number(g.level)>=1&&Number(g.level)<=5)
    .map(g=>({area,year:Number(g.level),group:g})));
}
function officialUniverse(reference,area,year,subjects=null){
  const s=subjects?new Set(arr(subjects).map(norm)):null;
  return arr(reference).filter(r=>r.year===year&&norm(r.area)===norm(area)&&
    (!s||s.has(norm(r.subject))));
}
function report(used,universe,pending,denominatorValidated=true){
  const total=universe.length,ids=new Set(universe.map(r=>r.id));
  const count=[...used].filter(id=>ids.has(id)).length;
  const unknown=[...used].filter(id=>!ids.has(id));
  const outstanding=[...pending,...unknown.map(id=>({id,status:'unresolved',reason:'Fuera del universo oficial'}))];
  return {
    used:count,total,
    confirmedPercent:!outstanding.length&&denominatorValidated?pct(count,total):null,
    mappedPercentMinimum:pct(count,total),
    pending:outstanding,
    status:!denominatorValidated?'pending-group-membership':
      outstanding.length?'pending-homologation':'verified'
  };
}
function groupSubjectNames(g){
  // Future explicit V2 subject membership; never derive a complete list
  // from a few historically placed content records.
  if(Array.isArray(g.curricularSubjects)&&g.curricularSubjects.length)
    return unique(g.curricularSubjects);
  return null;
}
function planReport({plan,g,area,year,matrixRows,v2FgRows,universe,denominatorValidated,approvedMappings={}}){
  const ids=unique(plan.contentIds),links=useMap({ids,area,year,matrixRows,v2FgRows,approvedMappings});
  const r=report(links.mapped,universe,links.pending,denominatorValidated);
  const groupIds=new Set(unique(g.items));
  const inGroup=ids.filter(id=>groupIds.has(id)).length;
  const work=Object.values(plan.stages||{})
    .filter(s=>s&&['description','duration','resources','activities']
      .some(k=>String(s[k]??'').trim())).length;
  return {
    number:plan.number??null,name:plan.name||'',legacyContents:ids.length,
    inGroup,groupContents:groupIds.size,
    localPercent:pct(inGroup,groupIds.size),
    stageCountWithWork:work,hasTeachingSequence:work>0,
    ...r,
    outsideGroup:ids.filter(id=>!groupIds.has(id))
  };
}
export function curriculumTracking({pack,orientationId,matrixRows,v2FgRows,v2FoRows,orientations}){
  const w=pack?.orientations?.[orientationId];
  if(!w)throw new Error('Falta seleccionar una orientación.');
  const approvedMappings=w.fg.homologations||{};
  const raw=splitAreas(w.fg.areas),byAreaYear=new Map(),byFormatYear=new Map();
  const groupRows=[];
  for(const {area,year,group:g} of raw){
    const subjectNames=groupSubjectNames(g);
    const fullUniverse=officialUniverse(v2FgRows,area,year);
    const universe=subjectNames?officialUniverse(v2FgRows,area,year,subjectNames):fullUniverse;
    const denominatorValidated=!!subjectNames&&subjectNames.every(s=>
      fullUniverse.some(row=>norm(row.subject)===norm(s)));
    const links=useMap({ids:g.items,area,year,matrixRows,v2FgRows,approvedMappings});
    const gResult=report(links.mapped,universe,links.pending,denominatorValidated);
    const plans=arr(g.plansBimestrales).map(plan=>planReport({
      plan,g,area,year,matrixRows,v2FgRows,universe,denominatorValidated,approvedMappings
    }));
    const groupRow={
      area,year,groupId:String(g.id),name:g.name||String(g.id),
      format:typeNames[g.kind]||g.kind,
      startTerm:g.startTerm??null,endTerm:g.endTerm??null,
      legacyContents:links.legacyCount,
      denominatorType:subjectNames?'materias-explicitas':'area-nivel-provisional',
      subjects:subjectNames,
      ...gResult,plans
    };
    groupRows.push(groupRow);
    const areaKey=JSON.stringify([area,year]);
    const areaRow=byAreaYear.get(areaKey)||{area,year,used:new Set(),pending:[],groups:0};
    links.mapped.forEach(id=>areaRow.used.add(id));
    areaRow.pending.push(...links.pending);areaRow.groups++;
    byAreaYear.set(areaKey,areaRow);
    const key=JSON.stringify([area,year,g.kind]);
    const groupType=byFormatYear.get(key)||{
      area,year,format:typeNames[g.kind]||g.kind,
      used:new Set(),pending:[],groups:0,subjects:new Set(),subjectsVerified:true};
    links.mapped.forEach(id=>groupType.used.add(id));
    groupType.pending.push(...links.pending);groupType.groups++;
    if(!denominatorValidated)groupType.subjectsVerified=false;
    arr(subjectNames).forEach(x=>groupType.subjects.add(x));
    byFormatYear.set(key,groupType);
  }
  const areaLevels=[...byAreaYear.values()].map(a=>({
    area:a.area,year:a.year,groups:a.groups,
    ...report(a.used,officialUniverse(v2FgRows,a.area,a.year),a.pending,true)
  })).sort((a,b)=>a.year-b.year||a.area.localeCompare(b.area,'es'));
  const formats=[...byFormatYear.values()].map(f=>({
    area:f.area,year:f.year,format:f.format,groups:f.groups,
    denominatorType:f.subjectsVerified?'materias-explicitas':'area-nivel-provisional',
    ...report(f.used,officialUniverse(v2FgRows,f.area,f.year,
      f.subjectsVerified?[...f.subjects]:null),f.pending,f.subjectsVerified)
  })).sort((a,b)=>a.year-b.year||a.format.localeCompare(b.format,'es'));
  const subjects=[];
  for(const area of areaLevels){
    const catalog=officialUniverse(v2FgRows,area.area,area.year);
    const names=[...new Set(catalog.map(x=>x.subject))];
    const usedGroup=byAreaYear.get(JSON.stringify([area.area,area.year]));
    for(const name of names){
      const universe=catalog.filter(x=>x.subject===name);
      const ids=new Set(universe.map(x=>x.id));
      const used=new Set([...usedGroup.used].filter(id=>ids.has(id)));
      const issues=usedGroup.pending.filter(problem=>{
        const original=arr(matrixRows).find(x=>x.id===problem.id);
        return original&&norm(original.subject)===norm(name);
      });
      subjects.push({area:area.area,year:area.year,subject:name,
        ...report(used,universe,issues,true)});
    }
  }
  const fo=foTrajectoryCoverage({
    rows:v2FoRows,spaces:w.fo.spaces,orientationId,orientations
  });
  const foAvailable=new Set(
    selectFoByOrientation(v2FoRows,orientationId,orientations).map(x=>x.id)
  );
  const foSpaces=arr(w.fo.spaces).map(s=>{
    const ids=unique(s.contentIds),pending=unique(s.provisionalContentIds);
    return {id:s.id,name:s.name,year:s.year,kind:s.kind,term:s.term,
      assignedMembers:arr(s.members).length,
      usedContents:ids.filter(id=>foAvailable.has(id)).length,
      unrecognizedIds:ids.filter(id=>!foAvailable.has(id)),
      provisionalContents:pending.length,
      // No year-based denominator is possible for FO without official year metadata.
      yearCoveragePercent:null,basis:'trayectoria'};
  });
  const legacyPlans=groupRows.flatMap(g=>g.plans);
  return {
    orientationId,
    fg:{areasByLevel:areaLevels,subjectsByLevel:subjects,groupings:groupRows,
      formatsByLevel:formats,
      plans:legacyPlans,
      preservedPlanCount:legacyPlans.length,
      preservedTeachingSequences:legacyPlans.filter(p=>p.hasTeachingSequence).length},
    fo:{...fo,spaces:foSpaces,
      provisionalAssignments:foSpaces.reduce((n,x)=>n+x.provisionalContents,0)},
    warnings:[
      'No se mezclan porcentajes administrativos con cobertura de contenidos.',
      'Un contenido duplicado en laboratorios o planes se cuenta una sola vez en su nivel.',
      'Formación Orientada se mide por trayectoria hasta contar con un universo prescripto por nivel.',
      'Si falta homologación de materias, los porcentajes de agrupamientos y planes quedan pendientes.'
    ]
  };
}
