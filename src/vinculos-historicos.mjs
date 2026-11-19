/**
 * Vínculos de trabajo histórico → PCI.
 *
 * No modifica el documento histórico ni sus snapshots. Cada grupo se asigna
 * por referencia a uno, varios o todos los PCI. Los trabajos orientados y
 * técnicos solo pueden vincularse a PCI compatibles de esa misma opción.
 */
export const HISTORIC_LINK_SCHEMA='pci-vinculos-historicos-v1';
export const LEGACY_KIND={
 general:'Formación General compartida',
 orientada:'Trabajo de una orientación',
 tecnica:'Trabajo de una especialidad técnica'
};
const clone=v=>JSON.parse(JSON.stringify(v));
const list=v=>Array.isArray(v)?v:[];
const clean=v=>String(v??'').trim();
export const historicKey=(area,id)=>JSON.stringify([clean(area),clean(id)]);
export const groupHasWork=g=>list(g?.items).length>0||
 list(g?.plansBimestrales).some(p=>list(p?.contentIds).length>0||
   clean(p?.synopsis)||clean(p?.objectives)||Object.values(p?.stages||{})
     .some(st=>clean(typeof st==='string'?st:st?.description)))||
 ['synopsis','objectives','objective','context','practiceAxis','summary']
   .some(k=>clean(g?.[k]))||list(g?.contentIds).length>0;
export function inventoryFromLegacy(state){
 const rows=[];
 for(const [area,section] of Object.entries(state?.areas||{})){
  for(const g of list(section?.groups)){
   const id=clean(g?.id);
   if(!id)continue;
   rows.push({
    area,id,key:historicKey(area,id),
    name:clean(g.name||g.label||id),
    contents:list(g.items).length,
    plans:list(g.plansBimestrales).length,
    hasWork:!!groupHasWork(g),
    level:Number(g.level||g.year)||null
   });
  }
 }
 return rows;
}
export function normalizeHistoricLinks(raw){
 if(!raw||raw.schema!==HISTORIC_LINK_SCHEMA)return null;
 return {
  schema:HISTORIC_LINK_SCHEMA,school_id:Number(raw.school_id),
  source_updated_at:String(raw.source_updated_at||''),
  assignments:list(raw.assignments).map(a=>({
   area:clean(a.area),id:clean(a.id),
   kind:clean(a.kind),mode:clean(a.mode),
   pci_ids:list(a.pci_ids).map(clean)
  }))
 };
}
export function isLinkedToPci(assignment,pci){
 if(!assignment||!pci)return false;
 return assignment.kind==='general'&&assignment.mode==='all'||
   list(assignment.pci_ids).includes(pci.pci_id);
}
export function linkedRowsForPci(inventory,doc,pci){
 if(!doc)return [];
 const assignmentMap=new Map(list(doc.assignments)
  .map(a=>[historicKey(a.area,a.id),a]));
 return list(inventory).flatMap(row=>{
  const assignment=assignmentMap.get(historicKey(row.area,row.id));
  return isLinkedToPci(assignment,pci)?[{...row,kind:assignment.kind}]:[];
 });
}
export function filteredHistoricForPci(source,doc,pci){
 if(!doc)return {state:source,legacyMode:'compatibilidad',rows:inventoryFromLegacy(source),missing:[]};
 const assigned=new Map(list(doc.assignments)
  .filter(a=>isLinkedToPci(a,pci))
  .map(a=>[historicKey(a.area,a.id),a]));
 const areas={},found=new Set();
 for(const [area,section] of Object.entries(source?.areas||{})){
  const groups=list(section?.groups).filter(g=>{
   const assignment=assigned.get(historicKey(area,g.id));
   if(!assignment)return false;
   // Los desarrollos FO y técnicos NO se convierten por error a FG común.
   if(pci.model==='comun'&&assignment.kind!=='general')return false;
   if(pci.model==='tecnica'&&!['general','tecnica'].includes(assignment.kind))return false;
   if(pci.model==='ba15')return false; // Otra estructura C1–C8, solo referencia.
   found.add(historicKey(area,g.id));return true;
  });
  if(groups.length)areas[area]={...section,groups:clone(groups)};
 }
 const missing=[...assigned].filter(([key,a])=>{
  if(pci.model==='comun'&&a.kind!=='general')return false;
  if(pci.model==='tecnica'&&!['general','tecnica'].includes(a.kind))return false;
  if(pci.model==='ba15')return false;
  return !found.has(key);
 }).map(([key])=>key);
 return {
  state:{...source,areas,
    // Una escuela con origen técnico puede asignar explícitamente su
    // FG a Media, sin importar por accidente la formación específica.
    profile:pci.model==='comun'?'comun':source?.profile},
  legacyMode:'seleccion-explicita',
  rows:inventoryFromLegacy({...source,areas}),
  missing
 };
}
export function checkHistoricLinks(doc,inventory,pcis){
 const errors=[];
 if(!doc||doc.schema!==HISTORIC_LINK_SCHEMA)errors.push('Versión de asignaciones incorrecta.');
 const inventoryMap=new Map(list(inventory).map(row=>[historicKey(row.area,row.id),row]));
 const pciMap=new Map(list(pcis).map(p=>[p.pci_id,p]));
 const seen=new Set();
 for(const entry of list(doc?.assignments)){
  const key=historicKey(entry.area,entry.id);
  if(seen.has(key))errors.push('Agrupamiento duplicado: '+key);
  seen.add(key);
  if(!inventoryMap.has(key))errors.push('El agrupamiento ya no está en la FG histórica: '+key);
  if(!['general','orientada','tecnica'].includes(entry.kind))errors.push('Tipo de trabajo histórico inválido: '+key);
  if(!['all','selected'].includes(entry.mode))errors.push('Asignación inválida: '+key);
  if(entry.mode==='all'&&(entry.kind!=='general'||list(entry.pci_ids).length))
   errors.push('Solo FG compartida admite todos los PCI: '+key);
  const ids=list(entry.pci_ids);
  if(ids.length!==new Set(ids).size)errors.push('PCI repetido: '+key);
  const matches=ids.map(id=>pciMap.get(id));
  if(matches.some(p=>!p))errors.push('Hay PCI inexistentes o de otra escuela: '+key);
  if(entry.kind==='orientada'){
   if(matches.some(p=>p&&!['comun','ba15'].includes(p.model)))errors.push('Un trabajo orientado no pertenece a Técnica: '+key);
   const signatures=new Set(matches.filter(Boolean).map(p=>p.model+':'+p.orientation_id));
   if(signatures.size>1)errors.push('El trabajo orientado debe vincularse a una sola orientación, aunque tenga varios turnos: '+key);
  }
  if(entry.kind==='tecnica'){
   if(matches.some(p=>p&&p.model!=='tecnica'))errors.push('Un trabajo técnico solo pertenece a PCI de Técnica: '+key);
   const signatures=new Set(matches.filter(Boolean).map(p=>p.orientation_id));
   if(signatures.size>1)errors.push('El trabajo técnico debe pertenecer a una misma especialidad: '+key);
  }
 }
 return [...new Set(errors)];
}
export function historicCountsForPci(inventory,doc,pci){
 const rows=linkedRowsForPci(inventory,doc,pci);
 return {
  total:rows.length,
  general:rows.filter(x=>x.kind==='general').length,
  orientada:rows.filter(x=>x.kind==='orientada').length,
  tecnica:rows.filter(x=>x.kind==='tecnica').length,
  plans:rows.reduce((n,r)=>n+r.plans,0),
  contents:rows.reduce((n,r)=>n+r.contents,0)
 };
}
