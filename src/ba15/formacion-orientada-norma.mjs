/**
 * BA +15: franja horaria de Formación Específica por nivel.
 * Fuente: RES-1375/MEDGC/25, Anexo I IF-2025-44785236-GCABA-SSPIE,
 * apartados 6.3 (estructura) y 6.5 (organización curricular).
 *
 * El Anexo NO enumera aquí las asignaturas de cada bachillerato. Esas
 * denominaciones se toman del diseño NES de la orientación de la escuela.
 * Ningún bloque de contenidos FO de Media equivale automáticamente a una
 * asignatura acreditada del Régimen BA +15.
 */
export const BA15_FO_NORMA = Object.freeze({
 resolucion:'1375/MEDGC/25',
 anexo:'IF-2025-44785236-GCABA-SSPIE',
 url:'https://documentosboletinoficial.buenosaires.gob.ar/publico/PE-RES-MEDGC-MEDGC-1375-25-ANX-2.pdf',
 niveles:Object.freeze([
  Object.freeze({nivel:1,horasOrientacion:0,horasFijas:0,horasFoTotales:0,materiasFijas:Object.freeze([])}),
  Object.freeze({nivel:2,horasOrientacion:4,horasFijas:0,horasFoTotales:4,materiasFijas:Object.freeze([])}),
  Object.freeze({nivel:3,horasOrientacion:9,horasFijas:0,horasFoTotales:9,materiasFijas:Object.freeze([])}),
  Object.freeze({nivel:4,horasOrientacion:12,horasFijas:4,horasFoTotales:16,materiasFijas:Object.freeze([
   Object.freeze({nombre:'Historia Orientada',horas:2}),
   Object.freeze({nombre:'Tecnologías de la Información Orientada',horas:2})
  ])})
 ]),
 equivalenciaBloquesMedia:'referencia_de_contenidos_sin_homologacion_de_materias',
 homologacionAutomatica:false
});
export function planFoBa15(nivel){
 const plan=BA15_FO_NORMA.niveles[Number(nivel)-1];
 if(!plan||plan.nivel!==Number(nivel))throw new RangeError('Nivel BA +15 inexistente.');
 return plan;
}
export function auditarHorasFoBa15(niveles){
 if(!Array.isArray(niveles)||niveles.length!==4)
  throw new Error('Se requieren las cuatro estructuras curriculares de BA +15.');
 return BA15_FO_NORMA.niveles.map(plan=>{
  const materias=niveles[plan.nivel-1];
  if(!Array.isArray(materias))throw new Error('Estructura incompleta de Nivel '+plan.nivel);
  const componente=materias.filter(m=>m.area==='Formación Orientada');
  const total=componente.reduce((n,m)=>n+(Number(m.horas)||0),0);
  const fijas=plan.materiasFijas.every(f=>componente.some(m=>m.nombre===f.nombre&&m.horas===f.horas));
  return {nivel:plan.nivel,horasPrescriptas:plan.horasFoTotales,horasCatalogo:total,
   horasAsignaturasPorDeterminar:plan.horasOrientacion,materiasFijasCorrectas:fijas,
   valido:total===plan.horasFoTotales&&fijas};
 });
}
