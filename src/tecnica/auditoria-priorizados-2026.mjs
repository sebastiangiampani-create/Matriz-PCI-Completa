/**
 * Auditoría de las bases 2026 de contenidos priorizados de Educación Técnica.
 * No modifica los PDF, sus referencias, la escuela ni el motor V2.
 * Separa páginas con año inferible de páginas sin año inequívoco.
 */
const arr=value=>Array.isArray(value)?value:[];
const validYear=value=>Number.isInteger(value)&&value>=1&&value<=6;
export const AUDITORIA_PRIORIZADOS_TECNICA_VERSION='priorizados-tecnica-2026/1';
export function auditarPriorizadosTecnica(document,bank){
 if(!document||document.schema!=='pci-tecnica-priorizados/2'||
   !Array.isArray(document.asignaturas)||!Array.isArray(bank)||
   document.especialidad_id==null)
  throw new TypeError('Se requiere catálogo técnico 2026 y banco de referencias.');
 const pages=new Map(),sources=new Map();
 for(const section of document.asignaturas){
  sources.set(section.id,section);
  for(const page of arr(section.paginas)){
   const id=section.id+'@p'+Number(page.pagina_pdf);
   if(pages.has(id))throw Error('Referencia duplicada en PDF: '+id);
   pages.set(id,page);
  }
 }
 if(pages.size!==bank.length||bank.some(item=>!pages.has(item.id)||
     item.sectionId!==item.id.split('@p')[0]))
  throw Error('El banco técnico no conserva todas las páginas priorizadas de origen.');
 const perYear=Object.fromEntries([1,2,3,4,5,6].map(y=>[y,{materias:0,referencias:0}]));
 const cataloged=new Map(),unknown=[],pendingYearVerification=new Set();
 for(const row of bank){
   if(!validYear(row.year)){
     unknown.push({id:row.id,seccion:row.name,pagina:row.page,
       campo:row.field,fuente:row.source_url});
     continue;
   }
   const sec=sources.get(row.sectionId);
   if(sec?.anio_verificado!==true)pendingYearVerification.add(row.sectionId);
   perYear[row.year].referencias++;
   cataloged.set(row.sectionId+':'+row.year,true);
 }
 for(const key of cataloged.keys())perYear[Number(key.split(':').pop())].materias++;
 return {
  version:AUDITORIA_PRIORIZADOS_TECNICA_VERSION,
  especialidadId:document.especialidad_id,
  nombre:document.especialidad_nombre,
  fuente:document.fuente_url,
  sha256:document.sha256_pdf,
  totalSecciones:document.asignaturas.length,
  totalReferencias:bank.length,
  referenciasConNivel:bank.length-unknown.length,
  sinNivel:unknown,
  seccionesConNivelPorVerificar:[...pendingYearVerification],
  porNivel:perYear,
  camposEstimados:true,
  horasNoIncluidas:true,
  estado:'referencias_priorizadas_con_validacion_pedagogica_pendiente'
 };
}
