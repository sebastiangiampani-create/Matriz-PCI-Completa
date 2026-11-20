/**
 * Base BA +15 derivada, sin mutar el catálogo original de Formación General
 * de Media. Mantiene IDs, materia, área, eje, subeje y texto de origen.
 *
 * Equivalencia solicitada:
 * NES 1.º + 2.º -> BA +15 Nivel 1
 * NES 3.º       -> BA +15 Nivel 2
 * NES 4.º       -> BA +15 Nivel 3
 * NES 5.º       -> BA +15 Nivel 4
 */
export const BA15_FG_BASE_VERSION='ba15-fg-media-reindexada/1';
export const BA15_FG_SOURCE_VERSION='PCI Aprende V2 - FG v103';
export const BA15_FG_LEVEL_MAP=Object.freeze({
 1:1,2:1,3:2,4:3,5:4
});
export const BA15_FG_LEVELS=Object.freeze([
 Object.freeze({level:1,sourceYears:Object.freeze([1,2]),label:'Nivel 1',sourceLabel:'NES 1.º + 2.º'}),
 Object.freeze({level:2,sourceYears:Object.freeze([3]),label:'Nivel 2',sourceLabel:'NES 3.º'}),
 Object.freeze({level:3,sourceYears:Object.freeze([4]),label:'Nivel 3',sourceLabel:'NES 4.º'}),
 Object.freeze({level:4,sourceYears:Object.freeze([5]),label:'Nivel 4',sourceLabel:'NES 5.º'})
]);
const list=v=>Array.isArray(v)?v:[];
export function buildBa15FgBase(rows,{expectedCount=1126}={}){
 if(!Array.isArray(rows))throw new TypeError('El catálogo de priorizados de Media debe ser una lista.');
 if(expectedCount!==null&&rows.length!==expectedCount)
  throw new Error('Base FG para BA +15 incompleta: se esperaban '+expectedCount+' contenidos y se recibieron '+rows.length+'.');
 const ids=new Set(),counts=[0,0,0,0];
 const result=rows.map(row=>{
  const id=String(row?.id??'').trim(),sourceYear=Number(row?.year);
  const level=BA15_FG_LEVEL_MAP[sourceYear];
  if(!id||ids.has(id))throw new Error('La base FG de Media contiene un ID vacío o duplicado.');
  if(!Number.isInteger(sourceYear)||!level)
   throw new Error('La base FG de Media contiene un año de origen fuera de 1.º a 5.º.');
  ids.add(id);counts[level-1]++;
  const levelMeta=BA15_FG_LEVELS[level-1];
  return {
   ...row,
   id,
   component:'FG',
   sourceYear,
   sourceYearLabel:'NES '+sourceYear+'.º',
   year:level,
   level,
   ba15Level:level,
   ba15LevelLabel:levelMeta.label,
   ba15SourceLabel:levelMeta.sourceLabel,
   sourceModel:'Media · Secundaria Aprende',
   sourceCatalog:BA15_FG_SOURCE_VERSION,
   baseVersion:BA15_FG_BASE_VERSION
  };
 });
 if(counts.some(n=>n===0))
  throw new Error('La base FG para BA +15 quedó sin contenidos en alguno de sus cuatro niveles.');
 return result;
}
export function summarizeBa15FgBase(rows){
 const all=list(rows),byLevel=BA15_FG_LEVELS.map(level=>{
  const contents=all.filter(row=>Number(row.ba15Level??row.year)===level.level);
  return {level:level.level,label:level.label,sourceLabel:level.sourceLabel,
   total:contents.length,sourceYears:[...new Set(contents.map(x=>Number(x.sourceYear)).filter(Number.isInteger))].sort()};
 });
 return {version:BA15_FG_BASE_VERSION,source:BA15_FG_SOURCE_VERSION,
  total:all.length,uniqueIds:new Set(all.map(x=>String(x.id))).size,byLevel};
}
