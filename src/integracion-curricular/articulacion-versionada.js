/**
 * Articulacion FG/FO versionada - Borrador puro, sin escrituras.
 * Una articulacion refiere a un proceso FG explicito, no al catalogo
 * "vigente" ni a una equivalencia textual automatica.
 */
export const LINK_SCHEMA='pci-articulacion-fg-fo/1';
export const LEGACY_FG='fg-matriz-historica/1';
export const CURRENT_FG='fg-sec-aprende-v2/1';
export const CURRENT_FO='fo-sec-aprende-v2/1';
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const nonEmpty=x=>typeof x==='string'&&x.trim().length>0;
const copy=x=>JSON.parse(JSON.stringify(x));
function required(value,label){
  if(!nonEmpty(value))throw Error(label+' obligatorio.');
  return value.trim();
}
export function processFG({id,orientation,baseVersion,areas,createdAt='',schoolId=''}){
  required(id,'ID del proceso FG');required(orientation,'Orientación FG');
  if(![LEGACY_FG,CURRENT_FG].includes(baseVersion))
    throw Error('La base FG del proceso debe identificarse; no se asigna automáticamente la vigente.');
  if(!record(areas))throw Error('Los espacios FG deben conservar su estructura original.');
  return Object.freeze({id,orientation,baseVersion,schoolId,createdAt,
    // Un snapshot de referencia: no se edita a traves de articulaciones.
    areas:copy(areas)});
}
export function linkedFGContent(process,area,groupId,contentId){
  if(!process||!record(process.areas))throw Error('Proceso FG inexistente.');
  const group=process.areas[area]?.groups?.find(g=>String(g.id)===String(groupId));
  if(!group)throw Error('El agrupamiento FG no pertenece al proceso indicado.');
  if(!(group.items||[]).some(id=>String(id)===String(contentId)))
    throw Error('El contenido FG no pertenece al agrupamiento de origen.');
  return {processId:process.id,baseVersion:process.baseVersion,orientation:process.orientation,
    area,groupId:String(groupId),contentId:String(contentId)};
}
export function createArticulation({id,fg,fo,relation='articulacion',note=''},process){
  required(id,'ID de articulación');
  if(!process||process.id!==fg?.processId||
    process.baseVersion!==fg?.baseVersion||process.orientation!==fg?.orientation)
    throw Error('Articulación bloqueada: el proceso FG y su versión no coinciden.');
  const resolved=linkedFGContent(process,fg.area,fg.groupId,fg.contentId);
  if(!fo||!nonEmpty(fo.orientation)||!nonEmpty(fo.slot)||
    !nonEmpty(fo.contentId)||fo.baseVersion!==CURRENT_FO)
    throw Error('FO debe referir a la base V2, orientación, espacio y contenido.');
  if(!['articulacion','equivalencia_revisada'].includes(relation))
    throw Error('Tipo de vínculo no admitido.');
  return Object.freeze({schema:LINK_SCHEMA,id,fg:resolved,
    fo:{orientation:fo.orientation,slot:fo.slot,contentId:String(fo.contentId),
      baseVersion:CURRENT_FO},relation,note:String(note)});
}
export function validateArticulation(link,{process,foSpaces,foCatalog}){
  if(link?.schema!==LINK_SCHEMA)return {valid:false,reason:'Versión del vínculo desconocida'};
  try {
    if(!process||process.id!==link.fg.processId||
      process.orientation!==link.fg.orientation||
      process.baseVersion!==link.fg.baseVersion)
      throw Error('FG de origen distinta: no se cambia automáticamente.');
    linkedFGContent(process,link.fg.area,link.fg.groupId,link.fg.contentId);
    if(link.fo.baseVersion!==CURRENT_FO)throw Error('Versión FO incompatible.');
    const slot=foSpaces?.[link.fo.slot];
    if(!slot||slot.orientation!==link.fo.orientation)
      throw Error('Espacio FO no identificado en la misma orientación.');
    if(!foCatalog?.some(row=>String(row.id)===String(link.fo.contentId)))
      throw Error('Contenido FO no encontrado en la base de esta orientación.');
    return {valid:true,reason:''};
  }catch(error){return {valid:false,reason:error.message};}
}
export function coverageOfVersion(process,ids,universe){
  if(!process?.baseVersion)throw Error('Proceso sin versión curricular.');
  if(!Array.isArray(universe)||universe.some(row=>row.baseVersion!==process.baseVersion))
    throw Error('No mezclar universos FG de distintas versiones.');
  const set=new Set(universe.map(row=>String(row.id)));
  const used=[...new Set((ids||[]).map(String))].filter(id=>set.has(id));
  return {baseVersion:process.baseVersion,used:used.length,total:set.size,
    percent:set.size?Math.round(used.length/set.size*1000)/10:null};
}
export function articulationSummary(links){
  const all=Array.isArray(links)?links:[];
  return {links:all.length,
    fgHistorical:all.filter(l=>l?.fg?.baseVersion===LEGACY_FG).length,
    fgCurrent:all.filter(l=>l?.fg?.baseVersion===CURRENT_FG).length,
    // Estas relaciones NO cambian los conteos ni denominadores FG/FO.
    modifiesCoverage:false};
}
