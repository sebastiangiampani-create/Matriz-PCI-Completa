/**
 * Read-only reference catalogs for the isolated curricular integration.
 * FG source of truth: the ORIGINAL Matriz PCI content IDs (data/db*.txt).
 * Prescribed FG counts: the independently snapshotted V2 FG v103 (1126 rows).
 * FO block/eje/subeje contents: the independently snapshotted V2 FO v96 (860 rows).
 * No Supabase, access token or side effects.
 */
export const MATTER_SOURCE='Matriz-PCI-Completa';
export const FG_REFERENCE='PCI Aprende V2 - FG v103';
export const FO_REFERENCE='PCI Aprende V2 - FO v96';
const MAT = ['db1.txt','db2.txt','db3.txt','db4.txt','rest1.txt','rest2.txt','rest3.txt','rest4.txt','rest5.txt'];
const FG = Array.from({length:9},(_,i)=>'fg-all-p'+(i+1)+'.txt');
const FO = ['fo_all.txt',...Array.from({length:10},(_,i)=>'fo_part'+String(i+2).padStart(2,'0')+'.txt')];
const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const subjectAliases=new Map([
  ['lengua adicional','lenguas adicionales'],
  ['lenguas adicional','lenguas adicionales'],
  ['tecnologia de la informacion','tecnologias de la informacion'],
  ['educacion artistica artes visuales','artes visuales'],
  ['formacion etica ciudadana','formacion etica y ciudadana']
]);
const subkey=value=>subjectAliases.get(norm(value))||norm(value);
const alpha=v=>Array.isArray(v)?v:[];
const readOnlyObjects=v=>JSON.parse(JSON.stringify(v));
export function stableContentId(prefix,parts){
  const s=alpha(parts).map(v=>String(v??'')).join('\u241f');
  let h1=0x811c9dc5,h2=0x9e3779b9;
  for(let i=0;i<s.length;i++){const n=s.charCodeAt(i);h1=Math.imul(h1^n,0x01000193);h2=Math.imul(h2^(n+i),0x85ebca6b);}
  return prefix+':'+(h1>>>0).toString(16).padStart(8,'0')+(h2>>>0).toString(16).padStart(8,'0');
}
export async function decodeGzipBase64(parts){
  if(!Array.isArray(parts)||!parts.length||parts.some(x=>typeof x!=='string'))
    throw new TypeError('Se requieren los fragmentos completos del catálogo.');
  if(typeof DecompressionStream!=='function'||typeof atob!=='function')
    throw new Error('El entorno no admite la descompresión oficial de los catálogos.');
  const encoded=parts.join('').trim();
  const compressed=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const raw=await new Response(stream).text();
  return JSON.parse(raw);
}
async function fetchText(fetchFn,url){
  const response=await fetchFn(url);
  if(!response?.ok)throw new Error('No se pudo cargar referencia curricular: '+url);
  return response.text();
}
async function readCatalogFiles(fetchFn,base,names){
  const parts=await Promise.all(names.map(n=>fetchText(fetchFn,base+'/'+n)));
  return decodeGzipBase64(parts);
}
export async function loadMatrixContents({fetchFn=fetch,base='data'}={}){
  const raw=await readCatalogFiles(fetchFn,base,MAT);
  if(!Array.isArray(raw)||raw.length===0)
    throw new Error('El catálogo original de Matriz PCI está vacío.');
  const rows=raw.map(v=>{
    if(!Array.isArray(v)||v.length<5)throw new Error('Estructura inesperada de contenido Matriz.');
    const [id,area,subject,axis,text]=v;
    return {id:String(id),area:String(area||''),subject:String(subject||''),
      axis:String(axis||''),text:String(text||''),source:MATTER_SOURCE};
  });
  if(new Set(rows.map(x=>x.id)).size!==rows.length)
    throw new Error('El catálogo Matriz tiene identificadores repetidos.');
  return rows;
}
export async function loadV2Fg({fetchFn=fetch,base='data/integracion-curricular/referencia-v2'}={}){
  const raw=await readCatalogFiles(fetchFn,base,FG);
  if(!Array.isArray(raw)||raw.length!==1126)
    throw new Error('FG de V2 incompleta: se esperaban 1126 contenidos.');
  const rows=raw.map(v=>({
    id:String(v.id),component:'FG',year:Number(v.year),
    area:String(v.area||''),subject:String(v.subject||''),
    axis:String(v.axis||''),subaxis:String(v.subaxis||''),text:String(v.text||'')
  }));
  if(rows.some(v=>!Number.isInteger(v.year)||v.year<1||v.year>5||!v.id))
    throw new Error('El catálogo FG de V2 contiene años o ID inválidos.');
  if(new Set(rows.map(x=>x.id)).size!==1126)
    throw new Error('El catálogo FG de V2 tiene ID repetidos.');
  return rows;
}
export async function loadV2Fo({fetchFn=fetch,base='data/integracion-curricular/referencia-v2'}={}){
  const decoded=await readCatalogFiles(fetchFn,base,FO);
  if(!Array.isArray(decoded))throw new Error('La base FO de V2 no contiene filas.');
  const unique=new Map();
  for(const row of decoded){
    if(!Array.isArray(row)||row.length<6)throw new Error('Fila FO inválida.');
    const key=row.map(v=>String(v??'').trim()).join('\u241f');
    if(!unique.has(key))unique.set(key,row);
  }
  if(unique.size!==860)
    throw new Error('La base FO de V2 tiene '+unique.size+' contenidos únicos y se esperaban 860.');
  const rows=[...unique.values()].map(row=>{
    const [o,sub,block,axis,subaxis,text]=row.map(v=>String(v||'').trim());
    const variant={'Artes Visuales':'artes_visuales','Música':'musica','Teatro':'teatro'}[sub]||'';
    const kind=/historia.*orientad|tecnolog/i.test(block)?'Materia':'Bloque';
    return {id:stableContentId('fov96',[o,sub,block,axis,subaxis,text]),
      component:'FO',orientation:o,suborientation:sub,variant,block,
      area:'Formación Orientada',subject:block||'Formación Orientada',
      axis,subaxis,text,kind,
      level:null,levelBasis:'trayectoria'};
  });
  return rows;
}
export async function loadV2Rules({fetchFn=fetch,base='data/integracion-curricular/referencia-v2'}={}){
  const names=['reglas-v2.json','horas-v2.json','materias-v2.json','catalogo-orientaciones.json'];
  const content=await Promise.all(names.map(x=>fetchText(fetchFn,base+'/'+x)));
  const [rules,hours,subjects,catalog]=content.map(JSON.parse);
  if(rules?.modelo_institucional?.unidad_trabajo!=='pci_por_escuela_y_orientacion')
    throw new Error('La referencia de composición no está completa.');
  return {rules,hours,subjects,catalog};
}
export function selectFoByOrientation(rows,orientationId,orientations){
  const current=alpha(orientations).find(o=>o.id===orientationId);
  if(!current)throw new Error('Orientación inexistente.');
  const orientation=current.foCatalogId==='arte'?'Arte':current.name;
  const variant=String(orientationId).startsWith('arte_')?orientationId.slice(5):'';
  return alpha(rows).filter(r=>r.orientation===orientation&&(!variant||r.variant===variant));
}
export function matchMatrixToV2Fg({matrixRows,v2FgRows,contentId,level,area}){
  const year=Number(level);
  if(!Number.isInteger(year)||year<1||year>5)
    return {status:'unresolved',reason:'Nivel no definido',matches:[]};
  const found=alpha(matrixRows).find(r=>String(r.id)===String(contentId));
  if(!found)return {status:'unresolved',reason:'ID original sin referencia en Matriz',matches:[]};
  if(area&&norm(area)!==norm(found.area)&&!(norm(area)==='artes'&&norm(found.area).startsWith('educacion artistica')))
    return {status:'unresolved',reason:'El contenido no pertenece al área del agrupamiento',matches:[]};
  const matches=alpha(v2FgRows).filter(r=>
    r.year===year&&subkey(r.subject)===subkey(found.subject)&&norm(r.text)===norm(found.text));
  if(matches.length===1)return {status:'matched',matrixId:String(found.id),
    referenceId:String(matches[0].id),year,reference:matches[0]};
  if(matches.length>1)return {status:'ambiguous',reason:'Coincidencias múltiples en el mismo nivel',
    matrixId:String(found.id),year,matches:matches.map(x=>x.id)};
  return {status:'unresolved',reason:'Sin coincidencia exacta de materia, texto y nivel',
    matrixId:String(found.id),year,matches:[]};
}
export function fgCoverageByLevel({areas,matrixRows,v2FgRows,area,level}){
  const year=Number(level),areaKey=norm(area);
  const universe=alpha(v2FgRows).filter(r=>r.year===year&&norm(r.area)===areaKey);
  const sourceGroups=alpha(areas?.[area]?.groups).filter(g=>Number(g.level)===year);
  const ids=[...new Set(sourceGroups.flatMap(g=>alpha(g.items).map(String)))];
  const matched=new Set(),unmatched=[],ambiguous=[];
  for(const id of ids){
    const result=matchMatrixToV2Fg({matrixRows,v2FgRows,contentId:id,level:year,area});
    if(result.status==='matched')matched.add(result.referenceId);
    else if(result.status==='ambiguous')ambiguous.push({id,reason:result.reason});
    else unmatched.push({id,reason:result.reason});
  }
  return {area,level:year,sourceGroups:sourceGroups.length,locatedLegacyContents:ids.length,
    mappedUniqueContents:matched.size,prescribedTotal:universe.length,
    verifiedPercent:universe.length?Math.round(matched.size/universe.length*1000)/10:null,
    unmatched,ambiguous,
    coverageStatus:unmatched.length||ambiguous.length?'partial-homologation':'verified',
    note:'No se cuentan dos veces los contenidos repetidos en laboratorios o planes.'};
}
export function fgCatalogPlacementSummary({areas,matrixRows,area}){
  const universe=alpha(matrixRows).filter(x=>norm(x.area)===norm(area));
  const located=new Set(alpha(areas?.[area]?.groups).flatMap(g=>alpha(g.items).map(String)));
  const available=new Set(universe.map(x=>String(x.id)));
  const assigned=[...located].filter(id=>available.has(id));
  return {area,assignedUnique:assigned.length,total:available.size,
    percent:available.size?Math.round(assigned.length/available.size*1000)/10:null,
    unknownIds:[...located].filter(id=>!available.has(id)),
    basis:'Ubicación en Matriz PCI (toda el área, no por nivel)'};
}
export function foTrajectoryCoverage({rows,spaces,orientationId,orientations}){
  const all=selectFoByOrientation(rows,orientationId,orientations);
  const universe=new Set(all.map(x=>x.id));
  const selected=new Set(alpha(spaces).flatMap(s=>alpha(s.contentIds).map(String)));
  const found=[...selected].filter(id=>universe.has(id));
  const blocks=[...new Set(all.map(r=>r.block))].map(block=>{
    const items=all.filter(r=>r.block===block),included=new Set(items.map(x=>x.id));
    return {block,used:found.filter(id=>included.has(id)).length,total:items.length};
  });
  return {orientationId,basis:'trayectoria',used:found.length,total:universe.size,
    percent:universe.size?Math.round(found.length/universe.size*1000)/10:null,
    byBlock:blocks,unknownIds:[...selected].filter(id=>!universe.has(id)),
    note:'La base FO v96 no tiene año explícito: no se atribuye cobertura anual por nivel.'};
}
