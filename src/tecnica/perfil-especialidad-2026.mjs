/**
 * Perfiles normativos de Educación Técnica · Anexo II IF-2026-51169092-GCABA-SSPIE.
 * Base explícita (págs. 13–18); las variables de cada plan NO se completan por
 * inferencia. No accede a escuelas, redes, V2 ni persistencia.
 */
import { findSpecialty, getAnnualSubjects, SPECIALTIES } from './pautas-pci-20261005.mjs';

export const PERFIL_TECNICA_VERSION='tecnica-especialidad-anexo-ii/1';

const inmutable=x=>{
  if(x&&typeof x==='object'){Object.values(x).forEach(inmutable);Object.freeze(x)}
  return x;
};
const list=n=>Array.from({length:n},(_,i)=>i+1);
const unknown=(id,note,years=[])=>({
  id,status:'requiere_plan_de_estudios',years,note,
  noPrearmar:true,noValidarComoPrescripto:true
});
const normal=id=>String(id||'').trim().toLowerCase();

/**
 * El Anexo define 20 series anuales por nombre, 5 que todavía no estaban
 * definidas y una especialidad sin anual. No atribuye cantidades exactas de
 * integraciones de especialidad, talleres, prácticas ni horas a cada plan.
 */
export function resolverPerfilEspecialidadTecnica(id){
  const specialty=findSpecialty(id);
  if(!specialty)return null;
  const extra=['computacion','administracion_empresas'].includes(specialty.id);
  const computacion=specialty.id==='computacion';
  const anual=getAnnualSubjects(specialty.id);
  const sinAnual=specialty.status==='no_annual_space';
  const pendienteAnual=specialty.status==='not_defined_in_document';
  const definidos=anual?[4,5,6].map(year=>({
    year,name:anual[year],duration:'anual',sourcePage:year===4||year===5?17:18,
    status:'prescripto',editable:false
  })):[];
  const especiales={
    metrologia:specialty.id==='mecanica'?{
      year:3,subject:'Metrología y Producción Industrial',duration:'cuatrimestral',
      independentOf:'Taller de la Especialidad',sourcePage:16
    }:null,
    socialesComputacion:computacion?{
      year:4,subjects:['Historia','Geografía'],extraIntegrationSpaces:2,sourcePage:13
    }:null
  };
  return inmutable({
    version:PERFIL_TECNICA_VERSION,source:'IF-2026-51169092-GCABA-SSPIE',
    specialtyId:specialty.id,name:specialty.name,levels:6,terms:12,
    troncales:{
      matematica:extra?list(6):list(5),
      lenguaLiteratura:list(5),
      lenguaAdicional:extra?list(6):list(5)
    },
    sociales:{
      total:computacion?10:8,
      obligatorios:computacion?5:4,
      electivos:computacion?5:4,
      primerosTresNiveles:{1:2,2:2,3:2},
      flexibles:[
        'Ciudadanía y Trabajo','Ciencia y Tecnología'
      ],ubicacionFlexible:[4,5,6],
      extraCuarto:computacion?2:0
    },
    naturales:{total:6,obligatorios:4,electivos:2,porNivel:{1:2,2:2,3:2},
      unaMateriaPermitidaSoloEn:[1]},
    educacionFisica:{total:12,porNivel:Object.fromEntries(list(6).map(y=>[y,2]))},
    educacionArtistica:{total:2,porNivel:{1:2}},
    representacion:{
      prescriptos:[1,2],
      tercerNivel:unknown('representacion_3','La exigencia en 3.º depende del plan particular.',[3]),
      totalPosible:[2,3]
    },
    tallerPrimerCiclo:{prescriptos:[1,2],duration:'anual'},
    talleresEspecialidad:unknown('taller_especialidad',
      'La cantidad 1–4 y los años efectivos se determinan por especialidad.',[3,4,5,6]),
    espacioAnual:{
      status:sinAnual?'no_ofrece':pendienteAnual?'no_definido_en_anexo':'prescripto',
      espacios:definidos,
      requierePlan:pendienteAnual,
      nota:sinAnual?'Geógrafo Matemático no ofrece espacio anual.':
        pendienteAnual?'El Anexo no define todavía el espacio anual de esta especialidad.':
        'Una materia prescrita por cada año de 4.º a 6.º.'
    },
    integracionesEspecialidad:unknown('integraciones_especialidad',
      'Entre 4 y 6 por año es orientativo, NO una cuota rígida; cantidad, materias y horas dependen del plan.',[4,5,6]),
    practicasProfesionalizantes:unknown('practicas_profesionalizantes',
      'Una o dos en 5.º y/o 6.º según el diseño curricular. No preasignar.',[5,6]),
    proyectoVinculacion:{
      tipo:'recorrido_formativo_integrado',
      componentes:[
        'Actividades Educativas con Integración en Contextos',
        'Experiencias Formativas Vocacionales',
        'Prácticas Profesionalizantes'
      ],
      noEquivaleAlProyectoAnualDeMedia:true
    },
    reglasCargaHoraria:{
      maximoGeneral:9,
      integracionEspecialidad:{excepcion:true,horas:'requiere_plan_de_estudios'},
      conservacionCargaTotal:'obligatoria_según_diseño_curricular'
    },
    excepciones:especiales,
    variablesNoCertificadas:[
      'representacion_tercero','talleres_especialidad','integraciones_especialidad',
      'practicas_profesionalizantes',
      ...(pendienteAnual?['espacio_anual_pendiente']:[])
    ],
    planParticularVerificado:false
  });
}
export const ESPECIALIDADES_TECNICAS=inmutable(SPECIALTIES.map(s=>({
  id:s.id,name:s.name,statusAnual:s.status
})));
export function perfilesEspecialidadesTecnicas(){
  return ESPECIALIDADES_TECNICAS.map(x=>resolverPerfilEspecialidadTecnica(x.id));
}
export function comprobarPerfilTecnico(perfil){
  if(!perfil||perfil.version!==PERFIL_TECNICA_VERSION)return false;
  if(!perfil.planParticularVerificado||perfil.variablesNoCertificadas.length)return false;
  return true;
}
