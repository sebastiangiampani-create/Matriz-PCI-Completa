/**
 * Conteos de Desarrollo Curricular siguiendo la semántica de PCI V2:
 * - contenidos prescriptos únicos, sin duplicar por plan/cuatri;
 * - FG por materia y nivel;
 * - FO por trayectoria si no hay año prescripto.
 * Nunca infiere un denominador oficial a partir de cantidades de tarjetas.
 */
const list=v=>Array.isArray(v)?v:[];
const normal=value=>String(value??'').normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const aliases=new Map([
 ['lengua adicional','lenguas adicionales'],
 ['lenguas adicional','lenguas adicionales'],
 ['tecnologia de la informacion','tecnologias de la informacion'],
 ['educacion artistica artes visuales','artes visuales'],
 ['formacion etica ciudadana','formacion etica y ciudadana']
]);
export const normalizeSubject=value=>aliases.get(normal(value))||normal(value);
export const uniqueIds=values=>[...new Set(list(values).filter(x=>x!==null&&x!==undefined&&String(x)!=='').map(String))];
export function planContentIds(plan){
 return uniqueIds([...list(plan?.contentIds),...list(plan?.contenidos),
  ...list(plan?.contents)]);
}
export function spaceContentIds(space){
 return uniqueIds([...list(space?.contentIds),...list(space?.contents),
  ...list(space?.plansBimestrales).flatMap(planContentIds),
  ...list(space?.planes).flatMap(planContentIds)]);
}
export const countPlans=space=>list(space?.plansBimestrales||space?.planes).length;
function percent(a,b){return b?Math.round(a/b*1000)/10:null;}
function bySubject(universe,used){
 const groups=new Map();
 for(const x of universe){
  const k=x.subject||x.block||'Contenido';
  if(!groups.has(k))groups.set(k,{subject:k,total:0,used:0,percent:0});
  const row=groups.get(k);row.total++;
  if(used.has(String(x.id)))row.used++;
 }
 return [...groups.values()].map(x=>({...x,percent:percent(x.used,x.total)}))
  .sort((a,b)=>a.subject.localeCompare(b.subject,'es'));
}
export function coverageForPool(pool,ids,{basis='level',label='Nivel',verified=true}={}){
 const universe=[...new Map(list(pool).filter(x=>x&&x.id!==undefined)
  .map(x=>[String(x.id),x])).values()];
 const keys=new Set(universe.map(x=>String(x.id)));
 const requested=uniqueIds(ids),used=new Set(requested.filter(id=>keys.has(id)));
 const valid=!!verified&&universe.length>0;
 return {basis:valid?basis:'unverified',label,
  selected:requested.length,used:used.size,total:valid?universe.length:null,
  percent:valid?percent(used.size,universe.length):null,
  pending:!valid,unmatched:requested.length-used.size,
  bySubject:valid?bySubject(universe,used):[]};
}
export function fgUniverse(rows,{year,area,subjects=[]}={}){
 const base=list(rows).filter(x=>Number(x.year)===Number(year)&&normal(x.area)===normal(area));
 const keys=new Set(list(subjects).map(normalizeSubject).filter(Boolean));
 if(!keys.size)return base;
 const subset=base.filter(x=>keys.has(normalizeSubject(x.subject)));
 return subset.length?subset:base;
}
export function fgCoverage(rows,{year,area,subjects=[],ids=[]}={}){
 const base=fgUniverse(rows,{year,area,subjects});
 return coverageForPool(base,ids,{basis:'level',label:'Nivel '+year,verified:!!base.length});
}
export function foCoverage(rows,{ids=[],orientationLabel='Trayectoria',year=null}={}){
 const pool=list(rows);
 const explicit=pool.length>0&&pool.every(x=>Number.isInteger(Number(x.year))&&Number(x.year)>0);
 const basis=explicit&&year?'level':'trajectory';
 const selected=basis==='level'?pool.filter(x=>Number(x.year)===Number(year)):pool;
 return coverageForPool(selected,ids,{
  basis,label:basis==='level'?'Nivel '+year:orientationLabel,
  verified:!!selected.length
 });
}
export function developmentCounts(spaces){
 const rows=list(spaces);
 const allIds=uniqueIds(rows.flatMap(spaceContentIds));
 const plans=rows.reduce((sum,s)=>sum+countPlans(s),0);
 return {spaces:rows.length,plans,selectedContentIds:allIds,
  uniqueContents:allIds.length};
}
export function groupCoverageForLevel(groups,rows,{year,area}={}){
 const relevant=list(groups).filter(g=>Number(g.year??g.level)===Number(year)&&
  normal(g.area)===normal(area));
 const universe=[...new Map(relevant.flatMap(g=>fgUniverse(rows,{
  year,area,subjects:list(g.subjects).map(x=>x?.name||x)
 })).map(x=>[String(x.id),x])).values()];
 const allIds=uniqueIds(relevant.flatMap(spaceContentIds));
 return coverageForPool(universe,allIds,{basis:'level',label:'Nivel '+year,
  verified:!!universe.length});
}
