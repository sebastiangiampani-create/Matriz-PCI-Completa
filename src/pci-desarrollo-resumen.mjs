/**
 * Vista general del Desarrollo Curricular V2.
 * Solo deriva tarjetas y métricas. No genera, edita ni guarda mapas/planes.
 * Conserva identificadores históricos y nunca declara como cero una
 * cobertura cuyo catálogo oficial no fue contrastado.
 */
const list=value=>Array.isArray(value)?value:[];
const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const key=value=>typeof value==='string'||typeof value==='number'?String(value):
  value&&typeof value==='object'&&(value.id??value.contentId??value.content_id)!=null?
    String(value.id??value.contentId??value.content_id):null;
export const uniqueContentIds=values=>[...new Set(list(values).map(key).filter(Boolean))];
const planIds=p=>uniqueContentIds([...list(p?.contentIds),...list(p?.contenidos)]);
export const spaceIds=space=>uniqueContentIds([
 ...list(space?.items),...list(space?.contentIds),...list(space?.contents),
 ...list(space?.plansBimestrales).flatMap(planIds),
 ...list(space?.planes).flatMap(planIds)
]);
export const plansOf=space=>list(space?.plansBimestrales??space?.planes);
const level=g=>Number(g?.level??g?.year??0);
const term=g=>Number(g?.startTerm??g?.term??(level(g)>0?level(g)*2-1:0));
const str=x=>String(x??'');
export function mediaDevelopmentSpaces({historicalAreas={},composition={},foSpaces=[]}={}){
 const entries=[],legacy=new Set();
 for(const [area,value] of Object.entries(historicalAreas||{})){
  for(const group of list(value?.groups)){
   const id=str(group?.id);if(!id)continue;
   legacy.add(area+'\u241f'+id);
   entries.push({key:'FG:'+area+':'+id,component:'FG',area,id,
    name:str(group.name||area),level:level(group),term:term(group),
    format:str(group.kind||'FG'),origin:'historico',document:group,
    plans:plansOf(group).length});
  }
 }
 for(const g of list(composition?.groups)){
  const members=list(g.members);
  if(!members.some(m=>m?.component==='FG'))continue;
  const area=str(g.area),id=str(g.legacyGroupId||g.id);
  if(!id||legacy.has(area+'\u241f'+id))continue;
  entries.push({key:'FG:'+area+':'+id,component:'FG',area,id,
   name:str(g.name||area),level:level(g),term:term(g),
   format:str(g.kind||'FG'),origin:'propuesto',document:g,
   plans:4});
 }
 for(const space of list(foSpaces)){
  if(!space?.id)continue;
  entries.push({key:'FO:'+space.id,component:'FO',area:'Formación Orientada',
   id:str(space.id),name:str(space.name||space.id),level:level(space),term:term(space),
   format:str(space.kind||'FO'),origin:'mapa',document:space,plans:4});
 }
 return entries.sort((a,b)=>a.level-b.level||a.term-b.term||
   a.component.localeCompare(b.component)||a.name.localeCompare(b.name,'es'));
}
export function technicalDevelopmentSpaces(offer){
 return list(offer?.spaces).filter(s=>s&&s.included!==false).map(s=>({
  key:'T:'+s.id,component:s.kind==='fg'?'FG':'FO',area:str(s.area),
  id:str(s.id),name:str(s.name||s.id),level:level(s),term:term(s),
  format:str(s.kind),origin:s.archivedLegacy?'historico':'mapa',
  document:s,plans:4,technical:true
 })).sort((a,b)=>a.level-b.level||a.term-b.term||a.name.localeCompare(b.name,'es'));
}
export function countsForDevelopment(spaces){
 const all=list(spaces);
 return {spaces:all.length,plans:all.reduce((sum,e)=>sum+(e.plans||0),0),
  contentIds:uniqueContentIds(all.flatMap(e=>spaceIds(e.document))),
  levelIds:[...new Set(all.map(e=>e.level).filter(Number.isInteger))].sort((a,b)=>a-b)};
}
function percent(a,b){return b?Math.round((1000*a)/b)/10:null;}
export function verifiedCoverage({rows=[],ids=[],year=null,area='',subjects=[],basis='level'}={}){
 const normArea=norm(area),selected=new Set(uniqueContentIds(ids));
 const subjectsSet=new Set(list(subjects).map(x=>norm(x?.name||x)).filter(Boolean));
 const validRows=list(rows).filter(r=>r&&r.id!=null&&
  (!normArea||norm(r.area)===normArea)&&
  (basis==='trajectory'||year===null||Number(r.year)===Number(year))&&
  (!subjectsSet.size||subjectsSet.has(norm(r.subject))));
 const pool=new Set(validRows.map(r=>str(r.id)));
 const found=[...selected].filter(id=>pool.has(id));
 return {selected:selected.size,matched:found.length,
  total:pool.size||null,percentage:pool.size?percent(found.length,pool.size):null,
  missing:selected.size-found.length,
  basis:pool.size?basis:'unverified',verified:pool.size>0};
}
