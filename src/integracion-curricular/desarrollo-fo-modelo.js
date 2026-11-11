/**
 * Edición curricular FO en borrador, aislada del guardado de las escuelas.
 * La composición proviene únicamente del Mapa de la Oferta. El desarrollo
 * nunca mueve espacios, no modifica Formación General ni altera Supabase.
 */
import { deriveFoFormatSummary } from './proyeccion-oferta-matriz.js';
export const FO_DRAFT_VERSION = 'pci-fo-desarrollo-borrador/1';
export const FO_STAGES = Object.freeze([
 {id:'punto_partida',label:'Punto de partida'},
 {id:'indagacion',label:'Indagación'},
 {id:'produccion',label:'Producción'},
 {id:'evaluacion',label:'Evaluación'}
]);
const clone=value=>JSON.parse(JSON.stringify(value));
const array=v=>Array.isArray(v)?v:[];
export function foGroups(map,format){
 const row=deriveFoFormatSummary(map).find(x=>x.id===format);
 if(!row)return [];
 return row.groups.map((group)=>{
   const id=String(group.slot);
   return {id,year:group.year,term:group.term,format:group.format,
     members:array(group.subjectIds).map(String)};
 });
}
export function emptyFoPlan(number) {
 const stages={};
 for(const stage of FO_STAGES)stages[stage.id]={
   description:'',duration:'',resources:'',activities:'',evidence:''
 };
 return {number,name:'Plan bimestral '+number,objectives:'',synopsis:'',
   contentIds:[],stages};
}
export function newFoDevelopment({orientation,slot,format,year}) {
 if(!orientation||typeof orientation!=='string'||!slot||!format||
     !Number.isInteger(year)||year<3||year>5)
   throw Error('La orientación, el formato, el espacio y el año son obligatorios.');
 return {slot:String(slot),orientation,format,year,objective:'',synopsis:'',
   context:'',practiceAxis:'',items:[],plansBimestrales:[1,2,3,4].map(emptyFoPlan)};
}
export function makeFoDraft(orientation,existing=null){
 if(!orientation)throw Error('Falta seleccionar una orientación.');
 if(existing && (existing.version!==FO_DRAFT_VERSION||existing.orientation!==orientation))
   throw Error('Los borradores pertenecen a otra orientación o versión.');
 const out=existing?clone(existing):{
  version:FO_DRAFT_VERSION,orientation,spaces:{}
 };
 if(!out.spaces||typeof out.spaces!=='object'||Array.isArray(out.spaces))
   throw Error('Estructura de borradores inválida.');
 return out;
}
export function getFoSpace(draft,group) {
 if(!draft||!group?.id)throw Error('No se puede abrir el espacio FO.');
 const previous=draft.spaces[group.id];
 // Las materias ubicadas se leen de la oferta, nunca se copian por encima del
 // trabajo pedagógico ni se pierden por cambiar el mapa.
 const data=previous?clone(previous):newFoDevelopment({
  orientation:draft.orientation,slot:group.id,format:group.format,year:group.year
 });
 return {data,members:group.members.slice(),
   needsReview:!!previous && (previous.format!==group.format||
     previous.year!==group.year)};
}
export function saveFoSpace(draft,data) {
 if(!draft||draft.version!==FO_DRAFT_VERSION||
   draft.orientation!==data?.orientation||
   typeof data.slot!=='string'||!data.slot||!array(data.plansBimestrales).length)
   throw Error('Borrador de orientación o espacio inválido.');
 if(draft.spaces?.[data.slot] && draft.spaces[data.slot].orientation!==data.orientation)
   throw Error('No se permite reemplazar el desarrollo de otra orientación.');
 return {...draft,spaces:{...draft.spaces,[data.slot]:clone(data)}};
}
export function orphanedSpaces(draft,map) {
 const legal=new Set(['laboratorios','talleres','proyecto']
  .flatMap(type=>foGroups(map,type).map(x=>x.id)));
 return Object.keys(draft?.spaces||{}).filter(id=>!legal.has(id));
}
