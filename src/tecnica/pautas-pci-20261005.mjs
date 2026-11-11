/**
 * Reglas curriculares tomadas de "Pautas para la construcción del PCI",
 * versión aportada 05-10-2026, pp. 3-18.
 *
 * No es un catálogo completo de planes de estudio por especialidad.
 * No ejecuta escrituras, ni lee/redacta la matriz histórica.
 */
export const RULESET_ID='pci-pautas-2026-10-05/1';
export const SOURCE={
  title:'Pautas para la construcción del Proyecto Curricular Institucional (PCI)',
  date:'2026-10-05',pages:19,
  sectionCommon:[3,4,5,6,7],
  sectionBachillerato:[8,9,10,11,12],
  sectionTecnica:[13,14,15,16,17,18],
  legalReference:'Res N°XXX (referencia incompleta en el documento entregado)',
  completeness:'reglas_generales_y_anuales; planes_por_especialidad_pendientes'
};
export const SHIFTS=Object.freeze(['manana','tarde','vespertino','noche']);
export const GENERAL={
  maxWeeklyHours:9,
  exceptionExceeds9:'integracion_especialidad_tecnica',
  annualCore:['Matemática','Lengua y Literatura','Lengua Adicional'],
  quarterFormats:['laboratorio','integracion','taller','espacio_formativo'],
  futureProject:'Proyecto de Vinculación con el Futuro',
  integration:{plan:'comun',evaluation:'colegiada',grade:'compartida'},
  articulation:{plan:'independiente',evaluation:'separada',grade:'individual'}
};
export const BACHILLERATO={
  levels:5,terms:10,
  core:{matematica:[1,2,3,4,5],lengua_literatura:[1,2,3,4,5],lengua_adicional:[1,2,3,4,5]},
  annualCore:true,
  socials:{byYear:[2,2,'2_o_4',2,2],requiredTotals:[10,12]},
  naturals:{byYear:[2,2,2,2,2],total:10,naturalesOrientationTotal:8},
  physicalEducation:{byYear:[2,2,2,2,2],total:10},
  arts:{byYear:[2,2,0,2,0],total:6},
  technology:{byYear:[2,2,2,2,0],total:8},
  orientationLabs:{byYear:[0,0,1,1,2],total:4,required:4},
  orientationWorkshops:{byYear:[0,0,1,1,2],total:4,electiveOffers:true},
  futureProject:{year:5,annual:true,total:1}
};
export const TECNICA={
  levels:6,terms:12,
  core:{
    matematica:{years:[1,2,3,4,5],sixthOnly:['computacion','administracion_empresas']},
    lengua_literatura:{years:[1,2,3,4,5]},
    lengua_adicional:{years:[1,2,3,4,5],sixthOnly:['computacion','administracion_empresas']}
  },
  socialIntegration:{
    total:8,compSpecialtyTotal:10,mandatory:4,elective:4,
    computacionMandatory:5,computacionElective:5,
    mainYears:[1,2,3],standardByYear:[2,2,2],
    flexibleYearForCiudadaniaTrabajoCienciaTecnologia:[4,5,6],
    compAdditionalInFourth:2
  },
  naturalIntegration:{
    total:6,mandatory:4,elective:2,byYear:[2,2,2,0,0,0],
    singleSubjectAllowedYears:[1]
  },
  physicalEducation:{total:12,byYear:[2,2,2,2,2,2]},
  artistic:{total:2,byYear:[2,0,0,0,0,0]},
  representation:{annual:true,years:[1,2],thirdDependsOnSpecialty:true},
  firstCycleWorkshop:{annual:true,years:[1,2],sections:['Tecnología de Base','Tecnología de Producción','Proyecto']},
  specialtyWorkshop:{annual:true,possibleYears:[3,4,5,6],countDependsOnSpecialty:true},
  specialtyAnnual:{annual:true,years:[4,5,6],exceptNoAnnual:['geografo_matematico']},
  specialtyIntegration:{quarterly:true,possiblePerYear:[4,6],years:[4,5,6],maxHoursDependsOnPlan:true},
  professionalPractices:{possibleYears:[5,6],countDependsOnSpecialty:true},
  futureProjectComponents:[
    'Actividades Educativas con Integración en Contextos',
    'Experiencias Formativas Vocacionales',
    'Prácticas Profesionalizantes'
  ],
  specialExceptions:{
    mecanica:{year:3,subject:'Metrología y Producción Industrial',
      duration:'cuatrimestral',separateFromSpecialtyWorkshop:true},
    computacion:{socialTotal:10,subjectPairInFourth:['Historia','Geografía']}
  }
};
// Espacio anual de la especialidad según la TABLA de las pp.16-17 del PDF.
// No atribuir este catálogo a asignaturas cuatrimestrales, que no figuran
// de forma exhaustiva en el documento.
const ANNUAL_ROWS=[
  ['automotores','Automotores','Mecanismo del Automotor y Fluídica','Dinámica del Automotor','Cálculo y Estructura de Mecanismos del Automotor'],
  ['computacion','Computación','Laboratorio de Algoritmos y Estructura de Datos','Laboratorio Orientado a Objetos','Desarrollo de Sistemas'],
  ['construcciones','Construcciones','Práctica Proyectual Integradora I','Práctica Proyectual Integradora II','Práctica Proyectual Integradora III'],
  ['diseno_comunicacion_publicitaria','Diseño y Comunicación Publicitaria','Práctica del Diseño I','Práctica del Diseño II','Práctica del Diseño III'],
  ['diseno_produccion_grafica','Diseño y Producción Gráfica','Diseño Gráfico I','Diseño Gráfico II','Gestión de Cómputo y Presupuesto de la Producción Gráfica'],
  ['electricidad','Electricidad','Circuitos Eléctricos y Mediciones','Análisis de Circuitos Eléctricos','Proyecto de Instalaciones Eléctricas'],
  ['electromecanica','Electromecánica','Circuitos Eléctricos y Magnéticos','Estructuras y Mecanismos','Proyecto de Instalaciones Eléctricas'],
  ['electronica','Electrónica','Circuitos Electrónicos I','Circuitos Electrónicos II','Sistemas Electrónicos Embebidos'],
  ['administracion_empresas','Administración de Empresas','Contabilidad I','Contabilidad II','Estados Contables'],
  ['industria_alimentos','Industria de los Alimentos','Tecnología Alimentaria I','Procesos Industriales de los Alimentos I','Procesos Industriales de los Alimentos II'],
  ['industria_indumentaria','Industria de la Indumentaria','Diseño I','Diseño II','Diseño de Colecciones'],
  ['industria_madera_mueble','Industrialización de la Madera y el Mueble','Dibujo y Representación del Mueble I','Dibujo y Representación del Mueble II','Dibujo y Representación del Mueble III'],
  ['industria_orfebreria','Industria de la Orfebrería','Diseño y Representación de la Orfebrería I','Diseño y Representación de la Orfebrería II','Diseño y Representación de la Orfebrería III'],
  ['jardineria_paisajismo_produccion_vegetal','Jardinería, Paisajismo y Producción Vegetal','Suelos I','Sanidad Vegetal II','Proyecto'],
  ['mecanica','Mecánica','Tecnología de los Materiales','Resistencia de Materiales','Proyecto Mecánico'],
  ['optica','Óptica','Óptica Geométrica','Óptica Oftálmica','Laboratorio de Contactología'],
  ['procesos_productivos_inteligentes','Procesos Productivos Inteligentes','Laboratorio Eléctrico, Electrónico y Automatización Industrial I','Laboratorio Eléctrico, Electrónico y Automatización Industrial II','Laboratorio de control, máquinas y accionamientos'],
  ['produccion_multimedial','Producción Multimedial','Laboratorio de Tecnología de la Postproducción de la Imagen y el Sonido','Arte, Tecnología y Comunicación','Arte Digital'],
  ['quimica','Química','Química Inorgánica','Química Orgánica I','Química Orgánica y Bioorgánica'],
  ['tic','Tecnologías de la Información y la Comunicación (TIC)','Laboratorio de Soporte de Equipos Informáticos','Laboratorio de Soporte de Sistemas Informáticos','Administración Avanzada de Sistemas y Redes']
];
export const ANNUAL_SPECIALTIES=Object.freeze(ANNUAL_ROWS.map(([id,name,y4,y5,y6])=>Object.freeze({
  id,name,status:'defined_in_document',subjects:Object.freeze({4:y4,5:y5,6:y6})
})));
export const PENDING_ANNUAL_SPECIALTIES=Object.freeze([
  'Refrigeración, Ventilación, Calefacción y Aire Acondicionado',
  'Metalurgia','Órtesis y Prótesis','Diseño de Interiores',
  'Diseño de Artesanías Aplicadas a la Industria'
].map((name,i)=>Object.freeze({id:['refrigeracion_ventilacion_calefaccion_aire','metalurgia',
  'ortesis_protesis','diseno_interiores','diseno_artesanias'][i],name,status:'not_defined_in_document'})));
export const NO_ANNUAL_SPECIALTIES=Object.freeze([
  {id:'geografo_matematico',name:'Geógrafo Matemático',status:'no_annual_space'}
]);
export const SPECIALTIES=Object.freeze([
  ...ANNUAL_SPECIALTIES,...PENDING_ANNUAL_SPECIALTIES,...NO_ANNUAL_SPECIALTIES
]);
const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function findSpecialty(nameOrId){
  const key=normalize(nameOrId);
  return SPECIALTIES.find(s=>normalize(s.id)===key||normalize(s.name)===key)??null;
}
export function getAnnualSubjects(specialty){
  const s=findSpecialty(specialty);
  return s?.status==='defined_in_document' ? {...s.subjects} : null;
}
const issue=(code,message,page,level='error')=>({code,message,page,level});
export function validateTechnicalSpace(space,{specialty=null,plan=null}={}){
  const errors=[],warnings=[];
  const year=Number(space?.year),hours=Number(space?.weeklyHours);
  const format=String(space?.format||''),area=String(space?.area||'');
  const duration=String(space?.duration||'');
  if(!Number.isInteger(year)||year<1||year>6)
    errors.push(issue('INVALID_LEVEL','La Técnica tiene seis niveles (1.º a 6.º).',13));
  if(duration && !['anual','cuatrimestral'].includes(duration))
    errors.push(issue('INVALID_DURATION','Duración curricular no reconocida.',4));
  const annual=['troncal','tecnologia_representacion','taller_primer_ciclo',
    'taller_especialidad','espacio_anual_especialidad','vinculacion_futuro'];
  const quarter=['integracion_social','integracion_natural','integracion_especialidad','espacio_formativo',
    'metrologia_mecanica'];
  if(annual.includes(format) && duration!=='anual')
    errors.push(issue('ANNUAL_FORMAT','Este formato debe tener duración anual.',[3,5,16].join('-')));
  if(quarter.includes(format)&&duration!=='cuatrimestral')
    errors.push(issue('QUARTER_FORMAT','Este formato debe ser cuatrimestral.',[4,14,17].join('-')));
  if(space?.term!==undefined && space?.term!==null){
    const term=Number(space.term);
    if(!Number.isInteger(term)||term<1||term>12||Math.ceil(term/2)!==year)
      errors.push(issue('TERM_LEVEL_MISMATCH','El cuatrimestre no coincide con el año técnico.',13));
  }
  if(space?.weeklyHours===null||space?.weeklyHours===undefined||space?.weeklyHours===''){
    warnings.push(issue('HOURS_UNVERIFIED','Falta comprobar la carga horaria del plan de estudios.',13,'warning'));
  }else if(!Number.isFinite(hours)||hours<=0){
    errors.push(issue('INVALID_HOURS','Las horas cátedra deben ser positivas.',6));
  }else if(['integracion_social','integracion_natural','espacio_formativo'].includes(format)&&hours>9){
    errors.push(issue('MAX_9_HOURS','El espacio supera las 9 horas cátedra semanales.',6));
  }else if(format==='integracion_especialidad'&&hours>9){
    warnings.push(issue('SPECIALTY_HOURS_REQUIRE_PLAN','La excepción al tope de nueve horas exige verificar el plan de la especialidad.',5,'warning'));
  }
  const memberCount=Array.isArray(space?.subjects)?space.subjects.length:null;
  if(format==='integracion_natural'&&[2,3].includes(year)&&memberCount!==null&&memberCount<2)
    errors.push(issue('NATURAL_MIN_2','En 2.º y 3.º, el espacio de integración de Naturales no puede tener una sola asignatura.',14));
  if(format==='integracion_natural'&&![1,2,3].includes(year))
    errors.push(issue('NATURAL_YEAR','Naturales de Técnica se organiza en 1.º, 2.º y 3.º.',13));
  if(format==='integracion_social'&&memberCount!==null&&memberCount<2){
    // Solo hay excepción si el DC de la especialidad prevé una única
    // materia del área para ese año: no inferirlo automáticamente.
    if(!plan?.singleSocialSubjectYears?.includes(year))
      errors.push(issue('SOCIAL_MIN_2','Para integrar una sola materia de Sociales debe constar expresamente en el plan de la especialidad.',14));
  }
  if(format==='integracion_especialidad'&&![4,5,6].includes(year))
    errors.push(issue('SPECIALTY_INTEGRATION_YEAR','Los espacios de integración de especialidad pertenecen al 2.º ciclo (4.º a 6.º).',17));
  if(format==='espacio_anual_especialidad'){
    const item=findSpecialty(specialty);
    if(![4,5,6].includes(year))
      errors.push(issue('SPECIALTY_ANNUAL_YEAR','El espacio anual de la especialidad corresponde a 4.º–6.º.',16));
    if(item?.status==='no_annual_space')
      errors.push(issue('SPECIALTY_NO_ANNUAL','Geógrafo Matemático no ofrece espacio anual de especialidad.',17));
    else if(item?.status==='not_defined_in_document'||!item)
      warnings.push(issue('SPECIALTY_ANNUAL_PENDING','Este espacio no está definido en las pautas aportadas; se necesita la definición específica.',17,'warning'));
    else if(space?.title && normalize(space.title)!==normalize(item.subjects[year]))
      errors.push(issue('ANNUAL_SUBJECT_MISMATCH','El nombre no coincide con el espacio anual establecido para esta especialidad y año.',16));
  }
  if(format==='metrologia_mecanica'&&!(findSpecialty(specialty)?.id==='mecanica'&&year===3))
    errors.push(issue('METROLOGY_EXCEPTION','Metrología y Producción Industrial es una excepción de Mecánica en 3.º.',15));
  return {valid:errors.length===0,errors,warnings,ruleSet:RULESET_ID};
}
export function validateRelation(relation){
  const errors=[];
  const type=relation?.type;
  if(!['articulacion','integracion'].includes(type))
    errors.push(issue('RELATION_TYPE','Indicar si se articula o se integra.',7));
  const spaces=Array.isArray(relation?.spaces)?relation.spaces:[];
  if(spaces.length<2)errors.push(issue('RELATION_MEMBERS','Se requieren espacios distintos para la vinculación.',7));
  const years=spaces.map(s=>Number(s.year));
  if(new Set(years).size>1||years.some(y=>!Number.isInteger(y)))
    errors.push(issue('RELATION_YEAR','Los espacios vinculados deben pertenecer al mismo año.',7));
  if(type==='articulacion'&&(relation.sharedPlan===true||relation.sharedGrade===true))
    errors.push(issue('ARTICULATION_INDEPENDENT','La articulación conserva plan, evaluación y calificación independientes.',7));
  if(type==='integracion'&&(relation.sharedPlan!==true||relation.sharedGrade!==true||relation.collegiateEvaluation!==true))
    errors.push(issue('INTEGRATION_SHARED','La integración requiere plan común, evaluación colegiada y calificación compartida.',7));
  return {valid:errors.length===0,errors,ruleSet:RULESET_ID};
}
export function validateTechnicalOverview({specialty,spaces=[],subjectPlan=null}={}){
  const found=findSpecialty(specialty), errors=[],warnings=[];
  if(!found)warnings.push(issue('UNKNOWN_SPECIALTY','La especialidad requiere catálogo y plan oficial.',16,'warning'));
  if(found?.status==='not_defined_in_document')
    warnings.push(issue('ANNUAL_UNDEFINED','El espacio anual de esta especialidad aún no está definido en el documento.',17,'warning'));
  for(const item of spaces){
    const v=validateTechnicalSpace(item,{specialty,plan:subjectPlan});
    errors.push(...v.errors.map(e=>({...e,spaceId:item?.id})));
    warnings.push(...v.warnings.map(e=>({...e,spaceId:item?.id})));
  }
  // Sin currículo detallado NO establecer como "validado": estas pautas
  // solo permiten comprobar reglas generales y 20 espacios anuales.
  if(!subjectPlan)
    warnings.push(issue('SPECIALTY_PLAN_REQUIRED','Falta el diseño curricular de la especialidad para verificar materias, horas y cobertura.',13,'warning'));
  return {valid:errors.length===0&&warnings.length===0,
    partial:errors.length===0,errors,warnings,ruleSet:RULESET_ID,
    model:'tecnica',specialtyId:found?.id??null};
}
export function technicalCalendar(){
  return Array.from({length:12},(_,i)=>({term:i+1,year:Math.floor(i/2)+1,
    half:(i%2)+1}));
}
