/**
 * Catálogo técnico reconstruido desde las posiciones de texto de los PDF oficiales.
 * Fuente: scripts/reconstruir-base-tecnica.py -> data/tecnica/base-curricular/.
 *
 * No usa páginas completas como contenidos ni infiere horas o formatos.
 * IDs estables, materias/años/fuentes trazables. No interactúa con Supabase.
 */
export const BASE_TECNICA_SCHEMA='pci-tecnica-base-contenidos/3';
const validId=id=>/^[a-z0-9_]{2,90}$/.test(String(id||''));
const text=x=>String(x??'').trim();
const validYear=y=>Number.isInteger(Number(y))&&Number(y)>=1&&Number(y)<=6;
export function validarBaseTecnica(base,document){
 if(!base||base.schema!==BASE_TECNICA_SCHEMA||base.especialidad_id!==document?.especialidad_id||
   base.fuente_sha256!==document.sha256_pdf||base.fuente_url!==document.fuente_url||
   !Array.isArray(base.contenidos)||!base.contenidos.length||
   !Array.isArray(base.materias)||!base.materias.length)
  throw Error('La base técnica reconstruida no corresponde a su PDF oficial: '+String(document?.especialidad_id||''));
 const sections=new Map(document.asignaturas.map(s=>[s.id,s]));
 const ids=new Set(),rows=[];
 for(const row of base.contenidos){
  const sectionId=text(row.sourceReference).split('@p')[0],section=sections.get(sectionId);
  if(!section||!text(row.id)||ids.has(row.id)||!validYear(row.year)||
    row.component!==(row.field==='formacion_general'?'FG':'FO')||
    row.subject!==section.asignatura||row.field!==section.campo_estimado||
    !text(row.text)||!text(row.source)||row.source!==document.fuente_url||
    !Number.isSafeInteger(Number(row.page))||Number(row.page)<1||
    row.sourceValidation!=='extraccion_geometrica_pdf_oficial'||
    row.documentallyVerified!==true)
    throw Error('Contenido técnico reconstruido inválido o duplicado: '+String(row.id||''));
  ids.add(row.id);
  rows.push({...row,year:Number(row.year),page:Number(row.page),
   axis:text(row.axis),subaxis:text(row.subaxis),subject:section.asignatura,
   provisional:false,
   documentallyVerified:true,pedagogicallyReviewed:false});
 }
 return rows;
}
export async function cargarBaseTecnicaReconstruida(document,{fetcher=fetch,base='data/tecnica/base-curricular/'}={}){
 const id=document?.especialidad_id;
 if(!validId(id))throw Error('Especialidad técnica inválida');
 const response=await fetcher(base+id+'.json',{cache:'no-store'});
 if(!response.ok)throw Error('No está publicada la base técnica reconstruida de '+id);
 const loaded=await response.json();
 return {base:loaded,contenidos:validarBaseTecnica(loaded,document)};
}
