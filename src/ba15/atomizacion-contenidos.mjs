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
// Agrupa ítems explícitos breves sin reinterpretarlos. Conserva los
// delimitadores en el texto, la secuencia y la posibilidad de reconstruir la
// fuente exactamente después de normalizar espacios.
function agruparEnunciados(items,{target=115}={}){
 const out=[];let current='';
 for(const candidate of items){
  const part=cleanSpace(candidate);if(!part)continue;
  if(!current){current=part;continue;}
  if(current.length<target&&current.length+1+part.length<=target+75)
   current+=' '+part;
  else{out.push(current);current=part;}
 }
 if(current)out.push(current);
 if(out.length>1&&out[out.length-1].length<MIN){
  const last=out.pop();out[out.length-1]+=' '+last;
 }
 return out;
}

/** Extrae literalmente oraciones/subenunciados; retorna [] si el corte no es seguro. */
export function fragmentarContenidoFuente(value,{minLength=145,maxFragments=12}={}){
 const raw=text(value);
 if(raw.length<minLength)return [];
 const valid=parts=>parts.length>=2&&parts.length<=maxFragments&&
   parts.every(p=>p.length>=MIN&&p.split(/\s+/).length>=5);
 // Primero respetar exactamente la fragmentación histórica. Si ya existían
 // fragmentos, conservar sus textos e IDs para no perder asignaciones.
 const historic=raw.split(SPLIT).map(cleanSpace).filter(Boolean);
 // Los contenidos enumerados mediante punto y coma también pueden dividirse
 // literalmente sin inferir ni reescribir saberes. Solo se aplica a padres
 // que no habían sido desagregados por las reglas anteriores.
 const semicolon=raw.split(/;\s+(?=\S)/u).map(cleanSpace).filter(Boolean);
 // Los ítems separados mediante guiones o viñetas conservan el marcador
 // del ítem siguiente. Solo se usa cuando no existe una fragmentación previa.
 const bullets=raw.split(/\s+(?=[-–•]\s+[A-ZÁÉÍÓÚÑ])/u).map(cleanSpace).filter(Boolean);
 // La primera etapa conserva íntegras las decisiones históricas y, por
 // consiguiente, TODOS los identificadores de fragmentos ya publicados.
 const historicas=valid(historic)?historic:valid(semicolon)?semicolon:valid(bullets)?bullets:[];
 if(historicas.length){
  const joined=historicas.join(historicas===semicolon?'; ':' ');
  return cleanSpace(raw)===joined?historicas:[];
 }
 // Segunda etapa ADITIVA: en los catálogos hay listas de muchas funciones
 // comunicativas («pedir…; expresar…; describir…») con ítems cortos. La
 // regla anterior los descartaba por el mínimo de caracteres por ítem.
 // Separar únicamente en delimitadores explícitos y agrupar adyacentes.
 const detailed=[
  raw.split(/(?<=;)\s+(?=\S)/u),
  historic,
  raw.split(/\s+(?=[•●▪‣\-–—]\s+\S)/u),
  raw.split(/\s+(?=(?:[0-9]{1,2}[.)]|[a-z][.)])\s+[A-ZÁÉÍÓÚÑ])/u),
  raw.split(/\n\s*\n/u)
 ];
 const validNew=parts=>parts.length>=2&&parts.length<=Math.max(maxFragments,64)&&
  parts.every(p=>p.length>=MIN&&p.split(/\s+/).length>=5);
 for(const items of detailed){
  if(items.length<2)continue;
  const parts=agruparEnunciados(items);
  if(validNew(parts)&&parts.join(' ')===cleanSpace(raw))return parts;
 }
 return [];
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
