/**
 * Lectura conservadora de contenidos individuales de los priorizados 2026 de Técnica.
 * Trabaja con las páginas originales preservadas en data/tecnica/priorizados/.
 * NO equivale a homologación: el PDF fue extraído con columnas intercaladas.
 * Solo utiliza la columna de "Contenidos", conserva la página y rechaza
 * segmentos ambiguos, indicadores de logro, encabezados y textos corruptos.
 * Los documentos de origen, vendor V2 y el estado de las escuelas son intocables.
 */
export const DESAGREGACION_TECNICA_VERSION='tecnica-desagregacion-documental/1';
const YEARS=Object.freeze({primer:1,primero:1,segundo:2,tercer:3,tercero:3,cuarto:4,quinto:5,sexto:6});
const asArray=x=>Array.isArray(x)?x:[];
const validYear=x=>Number.isInteger(Number(x))&&Number(x)>=1&&Number(x)<=6;
const plain=x=>String(x??'').trim();
const canon=x=>plain(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const watermarks=/(?:Educativos\.Educativos\.|ContenidosContenidos|Innovaci[oó]nInnovaci[oó]n|Subsecretar[ií]aSubsecretar[ií]a|PlaneamientoPlaneamiento|OperativaOperativa|GerenciaGerencia|EducativaEducativa|MinisterioMinisterio|Educaci[oó]nEducaci[oó]n|G\.C\.A\.B\.A\.G\.C\.A\.B\.A\.|\|\|)/gi;
const indicadores=/^(?:comprende|reconoce|identifica|utiliza|desarrolla|elabora|diseña|construye|aplica|interpreta|realiza|justifica|participa|establece|explica|reflexiona|organiza|configura|colabora|evalúa|integra|implementa|maneja|produce|selecciona|distingue|advierte|elige|resuelve|ejecuta|verifica|compara|demuestra|clasifica|emplea|analiza|conoce)\b/i;
const clutter=/\b(?:indicadores de logro|contenidos priorizados|volver a vista anterior|subsecretar[ií]a|ministerio de educaci[oó]n|gerencia educativa)\b/i;

function headingPosition(section,lines){
 const title=plain(section?.asignatura);
 if(!title)return -1;
 const upper=title.toLocaleUpperCase('es');
 for(let i=0;i<lines.length;i++){
  const line=lines[i],p=line.indexOf(upper);
  if(p<0)continue;
  const rest=line.slice(p+upper.length).replace(watermarks,'').trim();
  // Encabezado en mayúsculas, no una mera mención de la materia.
  if(!rest||/^(?:\b(?:primer|segundo|tercer|cuarto|quinto|sexto)\b|[|.-])/.test(rest))return i;
 }
 return -1;
}
export function anioDeclaradoEnPaginaTecnica(section,page){
 const lines=plain(page?.texto_pagina).split(/\r?\n/),index=headingPosition(section,lines);
 if(index<0)return null;
 const snippet=lines.slice(index,index+4).join(' ').replace(watermarks,' ');
 const result=/\b(primer|primero|segundo|tercer|tercero|cuarto|quinto|sexto)\s+a[nñ]o\b/i.exec(snippet);
 return result?YEARS[result[1].toLowerCase()]||null:null;
}
export function resolverAnioReferenciaTecnica(section,page,previous=null){
 const own=Number(page?.anio_contextual_inferido);
 if(validYear(own))return {year:own,confidence:'inferido_pagina_pdf'};
 const declared=anioDeclaradoEnPaginaTecnica(section,page);
 if(declared)return {year:declared,confidence:'encabezado_explicito_pdf'};
 const years=asArray(section?.anios_detectados).filter(validYear).map(Number);
 if(years.length===1)return {year:years[0],confidence:'seccion_de_un_solo_anio'};
 // La continuidad solo vale si se trata de páginas consecutivas de la MISMA sección.
 if(previous&&Number(previous.page)+1===Number(page?.pagina_pdf)&&validYear(previous.year))
  return {year:Number(previous.year),confidence:'continuidad_misma_seccion'};
 return {year:null,confidence:'sin_anio'};
}
function cleanRight(value){
 return plain(value.replace(watermarks,' ').replace(/\b(?:yy|ee|dede)\b/g,' ').replace(/\s+/g,' '));
}
function rightColumn(line){
 if(!line||/Indicadores de logro|volver a vista anterior|^ *Especialidad |CONTENIDOS PRIORIZADOS/i.test(line))return '';
 let best='';
 for(const gap of line.matchAll(/ {3,}/g)){
  const start=gap.index+gap[0].length;
  if(gap.index===0&&start>=58&&start<170){
   best=line.slice(start).split(/ {3,}/)[0];
   break;
  }
  if(gap.index<40||gap.index>150||start<53||start>175)continue;
  const tail=line.slice(start).split(/ {3,}/)[0];
  if(cleanRight(tail).length<13)continue;
  best=tail;break;
 }
 return cleanRight(best);
}
function quality(text,{continuation=false}={}){
 const value=plain(text);
 if(value.length<13||value.length>230||value.split(/\s+/).length<2)return false;
 if(clutter.test(value)||indicadores.test(value))return false;
 if(/\b(?:Año|Ciclo)\b/i.test(value)&&/^\b(?:primer|segundo|tercer|cuarto|quinto|sexto)\b/i.test(value))return false;
 if(/[a-záéíóúñ][A-ZÁÉÍÓÚÑ]/.test(value)||/[A-Za-zÁÉÍÓÚÑáéíóúñ]{29,}/.test(value))return false;
 if(!continuation&&/^[a-záéíóúñ]/.test(value))return false;
 if(/\b(?:de|del|la|las|y|para|con|por|en|o|una|un)$/i.test(value))return false;
 return true;
}
function heading(value){
 const x=plain(value).replace(/\.$/,'');
 return x.length<=70&&x.split(' ').length<=9&&quality(x)&&!/[,;:]/.test(x);
}
function extractFromPage(section,page,ref){
 const original=String(page.texto_pagina||''),lines=original.split(/\r?\n/);
 const h=headingPosition(section,lines),body=lines.slice(h>=0?h+1:0);
 const contents=[],excluded=[],seen=new Set();let axis='',unclosed=null,index=0;
 const append=(value,fragments)=>{
  const clean=plain(value);
  if(!quality(clean)){excluded.push({text:clean,reason:'calidad_no_suficiente'});return}
  const key=canon(clean);
  if(seen.has(key))return;
  seen.add(key);
  contents.push({
   id:'tec-pdf:'+ref.sectionId+':p'+ref.page+':'+(++index),
   year:ref.year,component:ref.field==='formacion_general'?'FG':'FO',
   subject:section.asignatura,area:ref.area,axis,subaxis:'',
   text:clean,source:ref.source_url,page:ref.page,
   sourceReference:ref.id,documentalFragmentId:'pdf:'+ref.id+':'+index,
   field:ref.field,sourceYearConfidence:ref.confidence,
   provisional:true,pedagogicallyReviewed:false,
   sourceValidation:'fragmento_columna_contenidos_pdf_pendiente_revision',
   sourceFragments:fragments
  });
 };
 const consume=(txt,parts)=>{
  const chunks=txt.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ0-9(])/u);
  for(let i=0;i<chunks.length;i++){
   const fragment=plain(chunks[i]);
   if(!fragment)continue;
   if(i===chunks.length-1&&!/[.!?;:]$/.test(fragment)){
    if(heading(fragment))axis=fragment;
    else unclosed={text:fragment,parts};
   }else if(i===0&&chunks.length>1&&heading(fragment)&&fragment.length<=50){
    axis=fragment.replace(/\.$/,'');
   }else append(fragment,parts);
  }
 };
 for(const line of body){
  if(/Volver a vista anterior|^\s*Índice\b/i.test(line))break;
  if(/Indicadores de logro|Contenidos priorizados/i.test(line))continue;
  const value=rightColumn(line);
  if(!value)continue;
  if(unclosed){
   const prev=unclosed;unclosed=null;
   // Se reconstruye una continuación de renglón solo cuando comienza
   // en minúscula y ambos fragmentos provienen de la columna derecha.
   if(/^[a-záéíóúñ]/.test(value)&&
     quality(prev.text,{continuation:true})&&value.length<170){
    consume(prev.text+' '+value,[...prev.parts,value]);
    continue;
   }
   excluded.push({text:prev.text,reason:'continuacion_ambigua'});
  }
  consume(value,[value]);
 }
 if(unclosed)excluded.push({text:unclosed.text,reason:'texto_incompleto'});
 return {contents,excluded};
}
/**
 * Incorpora únicamente las páginas que no tenían contenidos individuales
 * cotejados en el banco preexistente. No sustituye el catálogo anterior.
 * No completa años dudosos ni inventa ejes, subejes, indicadores ni textos.
 */
export function desagregarPendientesTecnica(document,bank,pendientes){
 if(!document||document.schema!=='pci-tecnica-priorizados/2'||!Array.isArray(bank)||!Array.isArray(pendientes))
  throw new TypeError('Se requieren el documento técnico, el banco de páginas y las referencias pendientes.');
 const sections=new Map(asArray(document.asignaturas).map(s=>[s.id,s]));
 const refs=new Map(bank.map(r=>[r.id,r]));
 const contents=[],unresolved=[],details=[];
 for(const pending of pendientes){
  const ref=refs.get(pending.id),section=ref&&sections.get(ref.sectionId);
  const page=section?.paginas?.find(p=>Number(p.pagina_pdf)===Number(ref.page));
  if(!ref||!section||!page)throw Error('Referencia oficial inexistente: '+pending.id);
  if(!validYear(ref.year)){
   unresolved.push({...pending,reason:'sin_anio_verificable'});continue;
  }
  const extracted=extractFromPage(section,page,ref);
  if(extracted.contents.length===0){
   unresolved.push({...pending,reason:'extraccion_de_columnas_ambigua'});continue;
  }
  contents.push(...extracted.contents);
  details.push({refId:ref.id,year:ref.year,section:section.asignatura,
   page:ref.page,contents:extracted.contents.length,omitted:extracted.excluded.length});
 }
 return {version:DESAGREGACION_TECNICA_VERSION,contenidos:contents,pendientes:unresolved,
  detalle:details,estado:'banco_documental_provisional_sin_homologacion_pedagogica',
  resumen:{referenciasExaminadas:pendientes.length,
   referenciasDesagregadas:details.length,referenciasPendientes:unresolved.length,
   contenidosIndividualesProvisionales:contents.length}};
}