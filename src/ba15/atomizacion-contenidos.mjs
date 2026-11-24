/**
 * Atomización documental BA +15 (aditiva). Nunca reescribe el priorizado NES
 * ni los identificadores con los que ya trabajan las escuelas.
 * Un fragmento solo se publica cuando el texto contiene varias proposiciones
 * explícitamente separadas; no se infieren nuevos contenidos pedagógicos.
 */
import {stableContentId} from '../integracion-curricular/catalogos.js';

export const BA15_ATOMIZACION_VERSION='ba15-referencias-desagregadas/1';
const text=value=>String(value??'').trim();
const cleanSpace=value=>text(value).replace(/\s+/g,' ').trim();
const MIN=34;
const SPLIT=/(?<=[.;!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])|\n(?=\s*[•●▪‣]|\s*[0-9]+[.)]\s)/u;

/** Extrae literalmente oraciones/subenunciados; retorna [] si el corte no es seguro. */
export function fragmentarContenidoFuente(value,{minLength=145,maxFragments=12}={}){
 const raw=text(value);
 if(raw.length<minLength)return [];
 const parts=raw.split(SPLIT).map(cleanSpace).filter(Boolean);
 if(parts.length<2||parts.length>maxFragments||
    parts.some(p=>p.length<MIN||p.split(/\s+/).length<5))return [];
 // Comprobación: no se incorporó ninguna palabra que no estuviera en el texto.
 const original=cleanSpace(raw),joined=parts.join(' ');
 if(original!==joined)return [];
 return parts;
}

/** Mantiene los originales en el catálogo de referencia, para recuperar IDs guardados. */
export function atomizarCatalogoBa15(rows,{component}={}){
 if(!Array.isArray(rows)||!['FG','FO'].includes(component))
  throw new TypeError('Catálogo y componente de origen requeridos.');
 const fragmentos=[],padres=[],ids=new Set(rows.map(x=>text(x.id)));
 for(const row of rows){
  const sourceId=text(row.id),sourceText=text(row.text);
  if(!sourceId||!sourceText)continue;
  const parts=fragmentarContenidoFuente(sourceText);
  if(parts.length<2)continue;
  padres.push(sourceId);
  for(const [index,fragment] of parts.entries()){
   const id=stableContentId('ba15-atom',[component,sourceId,fragment,index+1]);
   if(ids.has(id))throw Error('La atomización generó un identificador duplicado.');
   ids.add(id);
   fragmentos.push({...row,id,component,text:fragment,
    atomizedFrom:sourceId,atomIndex:index+1,atomCount:parts.length,
    sourceTextUnchanged:true,atomVersion:BA15_ATOMIZACION_VERSION,
    // No se interpreta un fragmento FO NES como materia homologada BA+15.
    ...(component==='FO'?{referenceOnly:true,confirmedBa15Subject:false}:{})});
  }
 }
 return {version:BA15_ATOMIZACION_VERSION,fragmentos,padres,
  resumen:{origenes:rows.length,desagregados:padres.length,
   fragmentos:fragmentos.length,intactos:rows.length-padres.length}};
}
