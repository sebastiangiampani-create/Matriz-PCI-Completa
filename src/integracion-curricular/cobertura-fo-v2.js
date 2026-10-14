/**
 * Cobertura curricular FO, basada en la semántica de v91-coverage-core de V2:
 * - unión de contenidos únicos por trayectoria, nivel, formato y espacio;
 * - desagregación por materia especial / bloque curricular;
 * - doble referencia de los planes: bolsa oficial de trayectoria y agrupamiento;
 * - NUNCA inventar porcentajes por nivel cuando el catálogo carece de año.
 * No realiza ninguna escritura ni depende de Supabase.
 */
import {selectFoByOrientation} from './catalogos.js';
import {foGroups} from './desarrollo-fo-modelo.js';

const unique = values => [...new Set((Array.isArray(values)?values:[]).map(String))];
const ratio = (used,total) => Number.isInteger(total)&&total>0 ?
  Math.round(used/total*1000)/10 : null;
const isYear = value => Number.isInteger(Number(value)) &&
  Number(value)>=3&&Number(value)<=5;
const keyFor = row => String(row?.block||row?.subject||'Formación Orientada').replace(/^Bloque:\s*/i,'').trim();
const kindFor = row => row?.kind==='Materia'||/historia.*orientad|tecnolog/i.test(keyFor(row))?'Materia':'Bloque';

function metric(ids,universe) {
  const valid=new Set(universe.map(row=>String(row.id)));
  const placed=unique(ids);
  const usedIds=placed.filter(id=>valid.has(id));
  return {
    used:usedIds.length,
    total:universe.length,
    percent:ratio(usedIds.length,universe.length),
    ids:usedIds,
    unmatched:placed.filter(id=>!valid.has(id))
  };
}
function catalogRows(rows,ids,opts={}) {
  const {year,allowYear=true}=opts;
  const used=new Set(ids);
  const source=allowYear?rows.filter(row=>Number(row.year)===Number(year)):rows;
  const by=new Map();
  for(const row of source){
    const label=keyFor(row);
    if(!by.has(label))by.set(label,{label,kind:kindFor(row),total:0,used:0,axes:new Map()});
    const item=by.get(label),isUsed=used.has(String(row.id));
    item.total++;
    if(isUsed)item.used++;
    const axis=String(row.axis||'').replace(/^Eje:\s*/i,'').trim();
    if(axis){
      if(!item.axes.has(axis))item.axes.set(axis,{label:axis,total:0,used:0});
      const sub=item.axes.get(axis);
      sub.total++;if(isUsed)sub.used++;
    }
  }
  return [...by.values()].map(row=>({
    label:row.label,kind:row.kind,total:row.total,used:row.used,
    percent:ratio(row.used,row.total),
    axes:[...row.axes.values()].map(x=>({...x,percent:ratio(x.used,x.total)}))
  })).sort((a,b)=>a.label.localeCompare(b.label,'es'));
}
const dataFor=(draft,group)=>draft?.spaces?.[group.id]||{};
function idsForGroup(draft,group) {return unique(dataFor(draft,group).items);}
function groupSnapshot(group,draft,pool,byId,hasOfficialYears){
  const data=dataFor(draft,group);
  const ids=idsForGroup(draft,group);
  const trajectory=metric(ids,pool);
  const levelRows=hasOfficialYears?pool.filter(row=>Number(row.year)===group.year):[];
  const level=hasOfficialYears?metric(ids,levelRows):{
    used:trajectory.used,total:null,percent:null,ids:trajectory.ids,
    unmatched:trajectory.unmatched,basis:'trayectoria'
  };
  const plans=Array.isArray(data.plansBimestrales)?data.plansBimestrales:[];
  const usedSet=new Set(trajectory.ids);
  const planReports=plans.map((plan,index)=>{
    const planIds=unique(plan?.contentIds);
    const recognized=planIds.filter(id=>byId.has(id));
    const inGroup=recognized.filter(id=>usedSet.has(id));
    const trajectoryMetric=metric(recognized,pool);
    const breakdown=catalogRows(pool,recognized);
    const groupingBreakdown=catalogRows(pool,trajectory.ids);
    const byGrouping=new Map(groupingBreakdown.map(x=>[x.label,x]));
    return {
      number:plan?.number||index+1,name:plan?.name||'Plan '+(index+1),
      used:trajectoryMetric.used,totalOfficial:trajectoryMetric.total,
      officialPercent:trajectoryMetric.percent,
      groupingUsed:inGroup.length,groupingTotal:trajectory.used,
      groupingPercent:ratio(inGroup.length,trajectory.used),
      outsideGroup:recognized.filter(id=>!usedSet.has(id)),
      unmatched:planIds.filter(id=>!byId.has(id)),
      byComponent:breakdown.map(row=>{
        const g=byGrouping.get(row.label)||{used:0};
        return {...row,groupingUsed:Math.min(row.used,g.used),
          groupingTotal:g.used,
          groupingPercent:ratio(Math.min(row.used,g.used),g.used)};
      }),
      annualTotal:hasOfficialYears?level.total:null,
      annualPercent:hasOfficialYears?ratio(trajectoryMetric.used,level.total):null,
      basis:hasOfficialYears?'nivel':'trayectoria'
    };
  });
  return {
    id:group.id,year:group.year,term:group.term,format:group.format,
    orientation:data.orientation,
    members:group.members||[],
    name:data.name||group.id,
    used:trajectory.used,ids:trajectory.ids,unmatched:trajectory.unmatched,
    trajectory,level,basis:hasOfficialYears?'nivel':'trayectoria',
    byComponent:catalogRows(hasOfficialYears?levelRows:pool,trajectory.ids),
    plans:planReports,
    retainedPlanCount:plans.length
  };
}
export function foCoverageSnapshot({rows=[],orientationId,orientations=[],map=null,draft=null}={}){
  const pool=selectFoByOrientation(rows,orientationId,orientations);
  const byId=new Map(pool.map(row=>[String(row.id),row]));
  const hasOfficialYears=pool.length>0&&pool.every(row=>isYear(row.year));
  const groups=['laboratorios','talleres','proyecto']
    .flatMap(format=>foGroups(map,format));
  const spaces=groups.map(group=>groupSnapshot(group,draft,pool,byId,hasOfficialYears));
  const aggregate=(subset,year=null,format=null)=>{
    const all=unique(subset.flatMap(x=>x.ids));
    const used=metric(all,pool);
    const yearUniverse=hasOfficialYears?
      pool.filter(row=>Number(row.year)===Number(year)):null;
    const level=year!==null?
      (hasOfficialYears?metric(all,yearUniverse):{
        used:used.used,total:null,percent:null,basis:'trayectoria'}):null;
    return {
      year,format,spaceCount:subset.length,used:used.used,ids:all,
      total:used.total,percent:used.percent,
      level,
      byComponent:catalogRows(
        year!==null&&hasOfficialYears?yearUniverse:pool,all
      )
    };
  };
  const formatRows=['laboratorios','talleres','proyecto']
    .map(format=>({format,...aggregate(spaces.filter(space=>
      (format==='laboratorios'&&space.format==='laboratorio')||
      (format==='talleres'&&space.format==='taller')||
      (format==='proyecto'&&space.format==='proyecto de vinculación')
    ),null,format)}));
  const years=[3,4,5].map(year=>({year,...aggregate(spaces.filter(s=>s.year===year),year)}));
  const formatsByLevel=[3,4,5].flatMap(year=>formatRows.map(f=>{
    const entries=spaces.filter(space=>space.year===year&&(
      (f.format==='laboratorios'&&space.format==='laboratorio')||
      (f.format==='talleres'&&space.format==='taller')||
      (f.format==='proyecto'&&space.format==='proyecto de vinculación')
    ));
    return {year,format:f.format,...aggregate(entries,year,f.format)};
  })).filter(row=>row.spaceCount>0);
  const trajectory=aggregate(spaces);
  return {
    orientationId,hasOfficialYears,
    levelBasisAvailable:hasOfficialYears,
    trajectory,years,formatRows,formatsByLevel,spaces,
    bySubject:trajectory.byComponent,
    warnings:[
      ...(!hasOfficialYears?['El catálogo FO oficial no tiene año: la cobertura por nivel solo indica contenidos ubicados; los porcentajes de nivel quedan pendientes.']:[]),
      'Los contenidos repetidos entre espacios o planes cuentan una sola vez en los totales.'
    ]
  };
}
