/**
 * Régimen BA +15 turno noche: planificación de ambientes de aprendizaje.
 * RES 105/SSGDA/2026, Anexo I IF-2026-46303505-GCABA-DGEGE.
 * La resolución SOLO alcanza establecimientos de su Anexo II.
 *
 * Se registra la presencialidad/asincronía por CUATRIMESTRE. Las 38 horas
 * semanales del nivel se distribuyen 27 presenciales + 11 asincrónicas.
 * "Virtual" no significa videollamada sincrónica.
 *
 * Esta auditoría no redistribuye horas docentes ni altera el diseño NES.
 * No se homologa una escuela como alcanzada: requiere declaración explícita.
 */
import {BA15_NIVELES} from './reglas-curriculares.mjs';

export const BA15_AMBIENTES_105=Object.freeze({
 resolucion:'105/SSGDA/2026',
 articuloAplicacion:2,
 anexoLineamientos:'IF-2026-46303505-GCABA-DGEGE',
 anexoEscuelas:'IF-2026-46304820-GCABA-DGEGE',
 url:'https://www.boletinoficial.buenosaires.gob.ar/normativaba/norma/884400',
 cupoSemanal:38,
 presencialSemanal:27,
 asincronicasSemanales:11,
 alcance:'solo_escuelas_anexo_ii_turno_noche',
 // Comprobado en fuente pública 28/10/2026; no extrapolar a otros turnos.
 porcentajePresencialTroncal:80,
 presencialObligatoria:['Educación Física','Tutoría']
});

const entero=v=>Number.isInteger(v)&&v>=0;
const normalizarScope=v=>{
 if(v==='aplica_anexo_ii_turno_noche'||v==='no_alcanzado'||v==='pendiente_confirmacion')return v;
 return 'pendiente_confirmacion';
};
export function nuevaDistribucionBa15(){
 return {aplicacion:'pendiente_confirmacion',distribucion:{}};
}
export function auditarDistribucionBa15(config={},niveles=BA15_NIVELES){
 const aplicacion=normalizarScope(config?.aplicacion);
 const advertencias=[],errores=[],periodos=[];
 if(aplicacion==='pendiente_confirmacion'){
  advertencias.push('Confirmar si la escuela y el turno están comprendidos en el Anexo II de RES-105/SSGDA/2026.');
  return {aplica:false,aplicacion,errores,advertencias,periodos,completa:false};
 }
 if(aplicacion==='no_alcanzado')
  return {aplica:false,aplicacion,errores,advertencias,periodos,completa:true};
 if(!Array.isArray(niveles)||niveles.length!==4){
  errores.push('La distribución exige los cuatro niveles BA +15.');
  return {aplica:true,aplicacion,errores,advertencias,periodos,completa:false};
 }
 const info=config?.distribucion||{};
 for(let term=1;term<=8;term++){
  const level=Math.ceil(term/2),espacios=niveles[level-1];
  if(!Array.isArray(espacios)){errores.push('Nivel '+level+' inválido.');continue}
  const porPeriodo=info['c'+term]||{},detalle=[];
  for(const espacio of espacios){
   const horas=Number(espacio.horas),valor=porPeriodo[espacio.nombre];
   const empty=valor===undefined||valor===null||valor==='';
   const virtual=empty?null:Number(valor);
   const valid=!empty&&entero(virtual)&&virtual<=horas;
   if(!valid){
    errores.push('C'+term+': indicar horas asincrónicas enteras entre 0 y '+horas+' para '+espacio.nombre+'.');
   }else{
    const presencial=horas-virtual;
    if(espacio.formato==='troncal'&&presencial/horas*100+1e-8<BA15_AMBIENTES_105.porcentajePresencialTroncal)
     errores.push('C'+term+': '+espacio.nombre+' debe conservar al menos 80% presencial.');
    if(BA15_AMBIENTES_105.presencialObligatoria.includes(espacio.nombre)&&virtual!==0)
     errores.push('C'+term+': '+espacio.nombre+' requiere presencialidad completa.');
   }
   detalle.push({nombre:espacio.nombre,horas,asincronicas:valid?virtual:null,
    presenciales:valid?horas-virtual:null,completo:valid});
  }
  const completo=detalle.every(x=>x.completo);
  const presencial=completo?detalle.reduce((n,x)=>n+x.presenciales,0):null;
  const asincronico=completo?detalle.reduce((n,x)=>n+x.asincronicas,0):null;
  if(completo&&(asincronico!==BA15_AMBIENTES_105.asincronicasSemanales||
    presencial!==BA15_AMBIENTES_105.presencialSemanal))
   errores.push('C'+term+': la distribución debe ser 27 HC presenciales + 11 HC asincrónicas, no '+
    presencial+' + '+asincronico+'.');
  periodos.push({cuatrimestre:term,nivel:level,completo,presenciales:presencial,
   asincronicas:asincronico,detalle});
 }
 return {aplica:true,aplicacion,errores,advertencias,periodos,
  completa:periodos.length===8&&periodos.every(x=>x.completo)};
}
