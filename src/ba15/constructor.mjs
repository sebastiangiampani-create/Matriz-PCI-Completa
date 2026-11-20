import {BA15_NIVELES,BA15_CCC,validarBa15} from './reglas-curriculares.mjs';
import {BA15_FG_BASE_VERSION,BA15_FG_SOURCE_VERSION,BA15_FG_LEVEL_MAP,BA15_FG_LEVELS} from './priorizados-base.mjs';
export const BA15_TERMS=Object.freeze(Array.from({length:8},(_,i)=>Object.freeze({id:'C'+(i+1),nivel:Math.floor(i/2)+1,numero:i+1})));
const copy=v=>JSON.parse(JSON.stringify(v));
const validTerm=(n,level)=>Number.isInteger(n)&&n>=1&&n<=8&&Math.floor((n-1)/2)+1===level;
export function crearBorradorBa15({pciId,schoolId,orientationId,shiftId}){
 if(!pciId||!schoolId||!orientationId||!shiftId)throw Error('Falta identificar escuela, PCI, orientación o turno.');
 return {schema:'ba15-constructor-v1',pciId:String(pciId),schoolId:Number(schoolId),orientationId:String(orientationId),shiftId:String(shiftId),
  priorizadosFGBase:{
   version:BA15_FG_BASE_VERSION,
   source:BA15_FG_SOURCE_VERSION,
   yearToBa15Level:{...BA15_FG_LEVEL_MAP},
   levels:BA15_FG_LEVELS.map(x=>({level:x.level,sourceYears:[...x.sourceYears]}))
  },
  niveles:BA15_NIVELES.map((bank,i)=>({
   nivel:i+1,
   asignaturas:bank.map((e,j)=>({id:'n'+(i+1)+'s'+(j+1),nombre:e.nombre,horas:e.horas,area:e.area,formatoOriginal:e.formato})),
   espacios:[],
  })),ccc:BA15_CCC.map(nombre=>({nombre,dispositivo:''}))};
}
export function validarBorradorBa15(draft){
 const errors=[],warnings=[];
 if(!draft||draft.schema!=='ba15-constructor-v1'||!Array.isArray(draft.niveles)||draft.niveles.length!==4) return {valido:false,errores:['Borrador BA +15 inválido.'],advertencias:[]};
 const base=validarBa15();
 if(!base.valido)errors.push(...base.errores);
 // El CCC se conserva como metadato de reconocimiento, fuera de la cobertura C1-C8.
 // No puede impedir validar el armado curricular de los cuatro niveles.
 const ids=new Set();
 for(let index=0;index<4;index++){
  const level=draft.niveles[index];
  if(!level||level.nivel!==index+1||!Array.isArray(level.asignaturas)||!Array.isArray(level.espacios)){errors.push('Nivel '+(index+1)+' inválido.');continue;}
  const expected=BA15_NIVELES[index];
  if(level.asignaturas.length!==expected.length)errors.push('Nivel '+(index+1)+': cantidad de materias distinta al plan base.');
  for(let j=0;j<expected.length;j++){
   const actual=level.asignaturas[j],official=expected[j];
   if(!actual||actual.horas!==official.horas||actual.area!==official.area)errors.push('Nivel '+(index+1)+': revisar carga oficial de '+official.nombre);
  }
  const seen=new Map();
  for(const e of level.espacios){
   if(!e||typeof e.id!=='string'||ids.has(e.id)||!validTerm(e.term,index+1)||!['troncal','laboratorio','taller','orientado','otro'].includes(e.formato)) {errors.push('Nivel '+(index+1)+': espacio inválido o fuera de su cuatrimestre.');continue;}
   ids.add(e.id);
   if(!Array.isArray(e.miembros)||!Array.isArray(e.planes)||e.planes.length!==4){errors.push('Espacio '+e.id+': requiere cuatro planes bimestrales.');continue;}
   for(const member of e.miembros){
    const subject=level.asignaturas.find(s=>s.id===member);
    if(!subject){errors.push('Espacio '+e.id+': materia ajena al nivel.');continue;}
    const terms=e.formato==='troncal'&&e.duration==='anual'?
      [index*2+1,index*2+2]:[e.term];
    for(const term of terms){
      const key=term+':'+member;
      if(seen.has(key))errors.push('Nivel '+(index+1)+': materia repetida en C'+term+': '+subject.nombre);
      seen.set(key,e.id);
    }
   }
   if(!e.miembros.length)warnings.push('Espacio '+e.nombre+' sin materias asignadas.');
   if(!e.articulacion&&e.miembros.some(id=>level.asignaturas.find(s=>s.id===id)?.formatoOriginal==='taller'))
    warnings.push('Nivel '+(index+1)+': falta documentar articulación en '+e.nombre);
  }
  for(const subject of level.asignaturas){
   for(const term of [index*2+1,index*2+2]){
    if(!seen.has(term+':'+subject.id))warnings.push('Nivel '+(index+1)+' C'+term+': falta ubicar '+subject.nombre);
   }
  }
 }
 return {valido:errors.length===0&&warnings.length===0,errores:errors,advertencias:warnings};
}
export function crearEspacioBa15(draft,{nivel,term,nombre,formato}){
 if(!validTerm(term,nivel))throw Error('El cuatrimestre no corresponde al nivel seleccionado.');
 if(!['troncal','laboratorio','taller','orientado','otro'].includes(formato))throw Error('Formato desconocido.');
 if(!String(nombre||'').trim())throw Error('Ingresá nombre del espacio.');
 const next=copy(draft),level=next.niveles[nivel-1];if(!level)throw Error('Nivel inexistente.');
 const id='esp-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
 const annual=formato==='troncal';
 // Un troncal es anual: ocupa el par del nivel, con un solo ID y cuatro planes.
 // Los espacios históricos sin duration siguen legibles y no se migran al abrir.
 const startTerm=annual?2*nivel-1:term;
 level.espacios.push({id,term:startTerm,endTerm:annual?startTerm+1:startTerm,
  duration:annual?'anual':'cuatrimestral',nombre:String(nombre).trim(),
  formato,miembros:[],articulacion:'',
  planes:Array.from({length:4},(_,i)=>({numero:i+1,nombre:'Plan '+(i+1),objetivos:'',contenidos:[],etapas:{punto_partida:'',indagacion:'',produccion:'',evaluacion:''}}))});
 return next;
}
export function asignarMateriaBa15(draft,{nivel,espacioId,materiaId}){
 const next=copy(draft),level=next.niveles[nivel-1],space=level?.espacios.find(x=>x.id===espacioId);
 const subject=level?.asignaturas.find(s=>s.id===materiaId);
 if(!space||!subject)throw Error('Materia o espacio de otro nivel.');
 // Formatos expresamente prescriptos por el plan BA +15: una troncal
 // no puede arrastrarse a un taller ni viceversa.
 if(['troncal','taller'].includes(subject.formatoOriginal)&&
    space.formato!==subject.formatoOriginal)
   throw Error('Acción no permitida: '+subject.nombre+' corresponde a un espacio '+
     subject.formatoOriginal+'. Revisá la fila del mapa antes de asignarla.');
 const occupied=e=>e.formato==='troncal'&&e.duration==='anual'?
  [2*nivel-1,2*nivel]:[e.term];
 if(level.espacios.some(e=>e.miembros.includes(materiaId)&&
   occupied(e).some(term=>occupied(space).includes(term))))
  throw Error('La materia ya está asignada en este cuatrimestre.');
 space.miembros.push(materiaId);return next;
}
export function actualizarEspacioBa15(draft,{nivel,espacioId,changes}){
 const next=copy(draft),space=next.niveles[nivel-1]?.espacios.find(x=>x.id===espacioId);
 if(!space)throw Error('Espacio no encontrado.');
 const allowed=['nombre','articulacion','planes'];
 for(const k of Object.keys(changes))if(!allowed.includes(k))throw Error('Campo no editable: '+k);
 for(const key of allowed)if(Object.hasOwn(changes,key))space[key]=copy(changes[key]);
 return next;
}
export function quitarMateriaBa15(draft,{nivel,espacioId,materiaId}){
 const next=copy(draft),space=next.niveles[nivel-1]?.espacios.find(x=>x.id===espacioId);if(!space)throw Error('Espacio no encontrado.');
 space.miembros=space.miembros.filter(id=>id!==materiaId);return next;
}
export function eliminarEspacioBa15(draft,{nivel,espacioId}){
 const next=copy(draft),level=next.niveles[nivel-1];if(!level)throw Error('Nivel no encontrado.');
 level.espacios=level.espacios.filter(x=>x.id!==espacioId);return next;
}
