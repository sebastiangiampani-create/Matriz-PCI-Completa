/**
 * Construcción de contenidos atómicos de Técnica, sin convertir páginas enteras
 * en contenidos. Coteja solo ítems previamente estructurados contra el texto
 * de origen de los priorizados 2026 (por materia y página).
 *
 * Un cotejo textual NO es una homologación pedagógica. La ausencia de cotejo
 * nunca se corrige inventando contenidos. La página original queda auditada
 * y disponible mediante su URL, fuera de los contenidos seleccionables de V2.
 *
 * No toca el estado de las escuelas ni los archivos de origen.
 */
export const CONTENTS_ATOMICOS_TECNICA_VERSION='tecnica-contenidos-atomicos/1';

export const BANCOS_ATOMICOS_TECNICA=Object.freeze([
 'ciencias-naturales-01','ciencias-naturales-02','ciencias-naturales-03',
 'ciencias-sociales-01','ciencias-sociales-02','ciencias-sociales-03','ciencias-sociales-04',
 'educacion-artistica',
 'educacion-fisica-01','educacion-fisica-02',
 // Los bancos ingles-1..9 son arrays de cuatro columnas sin identificador,
 // materia ni año verificado por contenido; no se homologan por inferencia.
 // Lengua Adicional mantiene la base NES individual del constructor V2.
 'lengua-literatura',
 'matematica-01','matematica-02','matematica-03',
 'talleres','tecnologia-representacion'
]);

const text = v=>String(v??'').trim();
const canon=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const noNoise = t => !!t && t.length>=18 && t.split(' ').length>=4 &&
 !/^(contenidos priorizados|indicadores de logro|g c a b a|educativos educativos|especialidad)/i.test(t);
const normalizeLevel = x=>Number.isInteger(Number(x))&&Number(x)>=1&&Number(x)<=6?Number(x):null;
function splitAxis(axis) {
 const raw=text(axis),index=raw.indexOf(' - ');
 return index>0 ? [raw.slice(0,index).trim(),raw.slice(index+3).trim()] : [raw,''];
}
function sectionPageIndex(document,bank) {
 const pagesBySubject=new Map(),sectionMap=new Map((document.asignaturas||[]).map(s=>[s.id,s]));
 for(const ref of bank) {
  const section=sectionMap.get(ref.sectionId);
  if(!section)throw Error('El documento carece de la sección '+ref.sectionId);
  const key=canon(section.asignatura);
  if(!pagesBySubject.has(key))pagesBySubject.set(key,[]);
  pagesBySubject.get(key).push({id:ref.id,ref,section,normalizedPage:canon(ref.text)});
 }
 return pagesBySubject;
}
/**
 * normalizedRows: ítems ya separados del catálogo técnico preexistente,
 * con {id,subject,axis,text,area}; no texto de páginas.
 * Los documentos se cotejan exclusivamente con la especialidad seleccionada.
 */
export function cotejarContenidosAtomicosTecnica(document,bank,normalizedRows) {
 if(!document||document.schema!=='pci-tecnica-priorizados/2'||
  !Array.isArray(document.asignaturas)||!Array.isArray(bank)||!Array.isArray(normalizedRows))
  throw new TypeError('Se requiere el PDF estructurado, las referencias y el banco de contenidos individuales.');
 const sourcePages=sectionPageIndex(document,bank);
 const atomicos=[],used=new Set(),matchedPages=new Set(),noCotejados=[];
 for(const row of normalizedRows) {
  const texto=text(row?.text),norm=canon(texto),subject=canon(row?.subject);
  if(!noNoise(norm)||!text(row?.axis)||!subject||!text(row?.id)) {
   noCotejados.push({id:row?.id||'',razon:'contenido_no_apto'});
   continue;
  }
  const possibilities=(sourcePages.get(subject)||[]).filter(candidate=>
   normalizeLevel(candidate.ref.year)!==null &&
   candidate.normalizedPage.includes(norm));
  const years=new Set(possibilities.map(p=>normalizeLevel(p.ref.year)));
  if(!possibilities.length||years.size!==1) {
   noCotejados.push({id:row.id,razon:possibilities.length?'anio_ambiguo':'sin_cotejo_textual'});
   continue;
  }
  const first=possibilities[0],year=[...years][0];
  const id='tec-atom:'+document.especialidad_id+':'+row.id+':'+year;
  if(used.has(id))throw Error('Contenido atomizado duplicado '+id);
  used.add(id);
  for(const p of possibilities)matchedPages.add(p.id);
  const [axis,subaxis]=splitAxis(row.axis);
  atomicos.push({
    id,year,component:first.ref.field==='formacion_general'?'FG':'FO',
    subject:first.section.asignatura,area:row.area||first.ref.area,
    axis,subaxis,text:texto,
    source:document.fuente_url,page:first.ref.page,
    sourceReference:first.id,sourceRow:row.id,field:first.ref.field,
    sourceYearConfidence:first.ref.confidence,
    provisional:true,
    sourceValidation:'cotejo_textual_con_pdf_2026'
  });
 }
 const pending=bank.filter(p=>!matchedPages.has(p.id)).map(p=>({
  id:p.id,sectionId:p.sectionId,name:p.name,year:p.year,page:p.page
 }));
 return {
  version:CONTENTS_ATOMICOS_TECNICA_VERSION,
  contenidos:atomicos,
  estado:'cotejo_parcial_pendiente_de_revision_pedagogica',
  resumen:{
   fuentesTotal:bank.length,
   referenciasConContenidosAtomicos:matchedPages.size,
   referenciasPendientes:pending.length,
   contenidosAtomicos:atomicos.length,
   bancoCuradoNoCotejado:noCotejados.length,
   materiasConContenido:[...new Set(atomicos.map(x=>x.subject+':'+x.year))].length
  },
  pendientes:pending,
  noCotejados
 };
}
export async function cargarBancoAtomicoTecnica({
 fetcher=fetch,
 base='tecnica/data/',
 filenames=BANCOS_ATOMICOS_TECNICA
}={}) {
 if(typeof fetcher!=='function')throw new TypeError('Se requiere un lector de datos.');
 const results=await Promise.all(filenames.map(async name=>{
  if(!/^[a-z0-9-]+$/.test(name))throw Error('Nombre de banco inválido.');
  const response=await fetcher(base+name+'.json',{cache:'force-cache'});
  if(!response.ok)throw Error('No está disponible el banco estructurado de '+name);
  const rows=await response.json();
  if(!Array.isArray(rows)||rows.some(x=>!x?.id||!x?.subject||!x?.text))
    throw Error('Formato incorrecto del banco '+name);
  return rows;
 }));
 return results.flat();
}
