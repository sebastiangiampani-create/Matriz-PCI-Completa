/**
 * Edición pedagógica BA +15 aislada del mapa curricular.
 * Conserva todos los campos desconocidos/históricos de cada plan y etapa.
 * No cambia la estructura de persistencia ni los IDs del PCI.
 */
const clone=value=>JSON.parse(JSON.stringify(value));
export const PLAN_STAGES=Object.freeze(['punto_partida','indagacion','produccion','evaluacion']);
export function readStageDescription(plan,stage){
 if(!PLAN_STAGES.includes(stage))throw Error('Etapa pedagógica no reconocida.');
 const value=plan?.etapas?.[stage]??plan?.stages?.[stage];
 return typeof value==='string'?value:String(value?.description??'');
}
export function updateBa15Plan(draft,{schoolId,pciId,nivel,espacioId,planIndex,patch}){
 if(!draft||draft.schema!=='ba15-constructor-v1'||
  Number(draft.schoolId)!==Number(schoolId)||draft.pciId!==pciId)
  throw Error('El plan no pertenece a este PCI. No se modificó.');
 if(!Number.isInteger(nivel)||nivel<1||nivel>4||
   !Number.isInteger(planIndex)||planIndex<0||planIndex>3)
  throw Error('Nivel o plan inválido.');
 const next=clone(draft);
 const space=next.niveles?.[nivel-1]?.espacios?.find(e=>e.id===espacioId);
 const plan=space?.planes?.[planIndex];
 if(!plan)throw Error('No existe este plan en el PCI.');
 const safe=['nombre','sinopsis','objetivos','contenidosPropios'];
 for(const [key,value] of Object.entries(patch||{})){
  if(safe.includes(key)){
   if(typeof value!=='string')throw Error('Texto pedagógico inválido.');
   plan[key]=value;
  }else if(key==='contenidos'){
   if(!Array.isArray(value)||value.some(x=>typeof x!=='string'&&typeof x!=='number'))
    throw Error('Contenidos curriculares inválidos.');
   plan.contenidos=[...new Set(value)];
  }else if(PLAN_STAGES.includes(key)){
   const container=plan.etapas&&typeof plan.etapas==='object'?'etapas':'stages';
   if(typeof value!=='string')throw Error('Descripción de etapa inválida.');
   plan[container]??={};
   const previous=plan[container][key];
   plan[container][key]=previous&&typeof previous==='object'
    ?{...previous,description:value}
    :typeof previous==='string'?value:{description:value};
  }else throw Error('Campo no editable: '+key);
 }
 // La estructura de oferta, miembros, otros planes y metadatos se conserva.
 return next;
}
