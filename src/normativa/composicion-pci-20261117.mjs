/**
 * FUENTE VIGENTE DE COMPOSICIÓN CURRICULAR — 17/11/2026
 * IF-2026-51169092-GCABA-SSPIE, Anexo II, "Construcción del mapa de la oferta curricular".
 * Es un validador PURO: no lee/escribe escuelas ni modifica objetos recibidos.
 *
 * El "total a cursar/acreditar" NO equivale necesariamente a la cantidad
 * de alternativas electivas que una escuela puede poner a disposición.
 * Los diseños curriculares de cada especialidad determinan las materias
 * reales y la carga total; esta norma no completa esas cajas curriculares.
 */
export const FINAL_RULESET_ID='pci-anexo-ii-2026-11-17/1';
export const FINAL_SOURCE=Object.freeze({
 number:'IF-2026-51169092-GCABA-SSPIE',
 date:'2026-11-17',title:'Construcción del mapa de la oferta curricular',
 pages:20,pdfPagesIncludingSignature:21,
 sha256:'0c789dfae6a2d7208b04a435b8ff652310d40c126a05c1d107d5ed3fab1974f5',
 printedPages:{common:[2,7],bachillerato:[8,12],tecnica:[13,19]},
 binding:'anexo_normativo_composicion; verificar planes_de_estudio_por_especialidad'
});
export const FINAL_COMMON=Object.freeze({
 maxWeeklyHours:9,exceptionExceeds9:'integracion_especialidad_tecnica',
 annualCore:['Matemática','Lengua y Literatura','Lengua Adicional'],
 quarterFormats:['laboratorio','integracion','taller','espacio_formativo'],
 futureProject:'Proyecto de Vinculación con el Futuro',
 integration:{plan:'comun',evaluation:'colegiada',grade:'compartida',newSpace:true},
 articulation:{plan:'independiente',evaluation:'separada',grade:'individual',newSpace:false},
 minimumSubjects:2,
 singleSubjectException:'solo_si_el_plan_de_estudios_contiene_una_unica_asignatura_del_area',
 optionsFixedBeforeSchoolYear:true,
 chosenOptionsFixedDuringSchoolYear:true
});
export const FINAL_BACHILLERATO=Object.freeze({
 levels:5,terms:10,
 core:{matematica:[1,2,3,4,5],lengua_literatura:[1,2,3,4,5],
       lengua_adicional:[1,2,3,4,5]},annualCore:true,
 socials:{byYear:[2,2,'2_o_4',2,2],requiredTotals:[10,12],
   compulsory:{10:5,12:6},elective:{10:5,12:6},
   thirdYearSplitOptional:true,singleSubjectAllowedYears:[5]},
 naturals:{byYear:[2,2,2,2,2],total:10,compulsory:5,elective:5,
   singleSubjectAllowedYears:[1,2,4,5],
   naturalesOrientationTotal:8,naturalesOrientationCompulsory:4,
   naturalesOrientationElective:4,naturalesOrientationYears:[1,2,3,4]},
 physicalEducation:{byYear:[2,2,2,2,2],total:10,elective:true},
 arts:{byYear:[2,2,0,2,0],total:6,elective:true},
 technology:{byYear:[2,2,2,2,0],total:8,elective:true},
 orientationLabs:{byYear:[0,0,1,1,2],total:4,required:4,quarterly:true,
   singleSubjectAllowedYears:[3]},
 orientationWorkshops:{byYear:[0,0,1,1,2],total:4,electiveOffers:true,quarterly:true,
   singleSubjectAllowedYears:[3]},
 futureProject:{year:5,annual:true,total:1},
 integratedFgFo:{fromYear:3,allowedGeneralAreas:['Ciencias Sociales','Ciencias Naturales'],
  preserveAtLeastTwoOrientationSubjects:true,maxWeeklyHours:9,
  noDoubleAssignments:true}
});
export const FINAL_TECNICA=Object.freeze({
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
  standaloneAllowedSubjects:['Ciudadanía y Trabajo','Ciencia y Tecnología'],
  compAdditionalInFourth:2,quarterly:true,maxHours:9
 },
 naturalIntegration:{
  total:6,mandatory:4,elective:2,byYear:[2,2,2,0,0,0],
  singleSubjectAllowedYears:[1],quarterly:true,maxHours:9
 },
 physicalEducation:{total:12,byYear:[2,2,2,2,2,2],quarterly:true,elective:true},
 artistic:{total:2,byYear:[2,0,0,0,0,0],quarterly:true,elective:true},
 representation:{annual:true,years:[1,2],thirdDependsOnSpecialty:true,total:[2,3]},
 firstCycleWorkshop:{annual:true,years:[1,2],total:2,
  sections:['Tecnología de Base','Tecnología de Producción','Proyecto']},
 specialtyWorkshop:{annual:true,possibleYears:[3,4,5,6],
  totalRange:[1,4],compulsory:true,countDependsOnSpecialty:true},
 specialtyAnnual:{annual:true,years:[4,5,6],total:3,
  exceptNoAnnual:['geografo_matematico'],pendingDefinitionSpecialties:5},
 specialtyIntegration:{quarterly:true,possiblePerYear:[4,6],years:[4,5,6],
  totalRange:[12,18],maxHoursDependsOnPlan:true},
 professionalPractices:{possibleYears:[5,6],totalRange:[1,2],
  countDependsOnSpecialty:true,partOfFutureProject:true},
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
});
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const arr=x=>Array.isArray(x)?x:[];
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLocaleLowerCase('es').trim();
const issue=(code,message,page,severity='error',spaceId=null)=>({
 code,message,page,severity,spaceId
});
const y=x=>Number(x?.year);
const included=x=>x?.included!==false&&!x?.archivedLegacy;
const fmt=x=>norm(x?.format);
const area=x=>norm(x?.area);
const part=(space,terms)=>terms.some(t=>fmt(space)===t||area(space).includes(t));
const isBachNaturales=orientation=>/ciencias?\s*[_-]?\s*naturales|naturales/.test(norm(orientation));
const termMatch=(space,levels)=>Number.isInteger(y(space))&&y(space)>=1&&y(space)<=levels&&
 Number.isInteger(Number(space.term))&&Math.ceil(Number(space.term)/2)===y(space);
function group(spaces,check){return spaces.filter(check);}
function count(spaces,check){return group(spaces,check).length;}
function countByYear(spaces,check,years){
 return Object.fromEntries(years.map(year=>[year,count(spaces,s=>y(s)===year&&check(s))]));
}
function validityDate(option){return typeof option==='string'&&/^\d{4}-\d\d-\d\d$/.test(option);}
export function validateCommonSpace(space,{model='bachillerato',year=null,
 officialPlan=null,orientation=null}={}){
 const errors=[],warnings=[],format=fmt(space),hours=space?.weeklyHours;
 const level=Number(year??space?.year),max=model==='tecnica'?6:5;
 if(!Number.isInteger(level)||level<1||level>max)
  errors.push(issue('YEAR_INVALID','Año fuera de la trayectoria curricular.',model==='tecnica'?13:8));
 if(space?.term!==undefined&&!termMatch({...space,year:level},max))
  errors.push(issue('TERM_YEAR','El cuatrimestre no coincide con el año.',model==='tecnica'?13:8));
 const annual=['troncal','taller_especialidad','taller_primer_ciclo',
  'espacio_anual_especialidad','tecnologia_representacion','vinculacion_futuro'];
 const quarterly=['integracion_social','integracion_natural','integracion_especialidad',
  'laboratorio_social','laboratorio_natural','laboratorio_orientacion','taller_orientacion',
  'espacio_formativo','metrologia_mecanica'];
 if(annual.includes(format)&&space?.duration!=='anual')
  errors.push(issue('DURATION_ANNUAL','Este espacio curricular debe ser anual.',model==='tecnica'?14:9));
 if(quarterly.includes(format)&&space?.duration!=='cuatrimestral')
  errors.push(issue('DURATION_QUARTER','Este espacio curricular debe ser cuatrimestral.',model==='tecnica'?14:9));
 if(hours==null||hours==='')warnings.push(issue('HOURS_UNVERIFIED',
  'Falta comprobar la carga horaria en el diseño curricular vigente.',model==='tecnica'?13:8,'warning'));
 else{
  const n=Number(hours);
  if(!Number.isFinite(n)||n<=0)errors.push(issue('INVALID_HOURS','Las horas deben ser positivas.',6));
  else if(n>9){
   const exception=model==='tecnica'&&format==='integracion_especialidad';
   const bachException=model==='bachillerato'&&isBachNaturales(orientation)&&level===5&&
    ['laboratorio_orientacion','taller_orientacion'].includes(format);
   if(!exception&&!bachException&&quarterly.includes(format))
    errors.push(issue('MAX_9_HOURS','El espacio supera las 9 horas cátedra semanales sin excepción normativa.',6));
   if(exception||bachException)warnings.push(issue('HOURS_EXCEPTION_REQUIRES_PLAN',
    'La excepción a 9 horas exige contrastar la carga con el diseño curricular.',model==='tecnica'?18:10,'warning'));
  }
 }
 const members=arr(space?.subjectIds??space?.subjects);
 if(['integracion_social','integracion_natural','integracion_especialidad',
  'laboratorio_social','laboratorio_natural','laboratorio_orientacion',
  'taller_orientacion'].includes(format)){
  if(members.length===0)
   warnings.push(issue('SUBJECTS_PENDING',
    'Falta conformar el espacio con materias del mismo año; no se valida una integración vacía.',
    model==='tecnica'?15:9,'warning'));
  else if(members.length<2){
   const allowed=model==='tecnica'?
      format==='integracion_natural'&&level===1 ||
      (format==='integracion_social'&&arr(officialPlan?.singleSocialSubjectYears).includes(level)):
      format==='laboratorio_social'&&level===5 ||
      format==='laboratorio_natural'&&[1,2,4,5].includes(level) ||
      ['laboratorio_orientacion','taller_orientacion'].includes(format)&&level===3;
   if(!allowed)errors.push(issue('SINGLE_SUBJECT_NOT_ALLOWED',
    'Este espacio exige al menos dos materias del mismo año; verificar las excepciones del plan.',model==='tecnica'?15:10));
  }
 }
 return {valid:errors.length===0&&warnings.length===0,errors,warnings,ruleSet:FINAL_RULESET_ID};
}
export function validateFinalComposition({
 model,orientation=null,specialtyId=null,spaces=[],officialPlan=null,
 selectedSocialOption=null,optionsLockedAt=null,schoolYearStart=null,
 approvedHoursByYear=null,relations=[]
}={}){
 const errors=[],warnings=[];
 const mode=model==='tecnica'?'tecnica':model==='bachillerato'||model==='media'||model==='comun'?'bachillerato':null;
 if(!mode)return {valid:false,errors:[issue('MODEL_INVALID','Modalidad no reconocida.',2)],warnings,ruleSet:FINAL_RULESET_ID};
 const active=arr(spaces).filter(included), max=mode==='tecnica'?6:5;
 const annualCore=active.filter(s=>fmt(s)==='troncal');
 for(const s of annualCore)if(s.duration!=='anual')
  errors.push(issue('CORE_ANNUAL','Los espacios troncales son anuales.',3,'error',s.id));
 const slots=active.filter(s=>fmt(s)==='integracion_social'||fmt(s)==='laboratorio_social');
 const natural=active.filter(s=>fmt(s)==='integracion_natural'||fmt(s)==='laboratorio_natural');
 const physical=active.filter(s=>area(s)==='educacion fisica');
 const art=active.filter(s=>area(s)==='educacion artistica'||area(s)==='artes');
 const techForm=active.filter(s=>/tecnolog/.test(area(s)));
 const project=active.filter(s=>fmt(s)==='vinculacion_futuro');
 const pp=active.filter(s=>fmt(s)==='practicas_profesionalizantes');
 const st={
  socials:slots.length,naturals:natural.length,physical:physical.length,
  arts:art.length,technology:techForm.length,projects:project.length,
  practices:pp.length,totalSpaces:active.length
 };
 const review=(condition,code,message,page)=>{if(condition)warnings.push(issue(code,message,page,'warning'));};
 const bad=(condition,code,message,page)=>{if(condition)errors.push(issue(code,message,page));};
 if(mode==='tecnica'){
  const extra=norm(specialtyId)==='computacion';
  const socialTarget=extra?10:8;
  bad(slots.length!==socialTarget,'TECH_SOCIAL_COUNT',
    'Ciencias Sociales: '+socialTarget+' espacios en la trayectoria ('+
    (extra?'5':'4')+' EIO y '+(extra?'5':'4')+' EIE).',13);
  bad(natural.length!==6,'TECH_NATURAL_COUNT','Ciencias Naturales: seis espacios (4 EIO y 2 EIE).',13);
  bad(physical.length!==12,'TECH_EF_COUNT','Educación Física: doce espacios electivos.',13);
  bad(art.length!==2,'TECH_ART_COUNT','Educación Artística: dos espacios electivos.',13);
  bad(count(active,s=>fmt(s)==='taller_primer_ciclo')!==2,'TECH_FIRST_CYCLE_WORKSHOP',
    'El primer ciclo requiere dos talleres anuales (1.º y 2.º).',16);
  const repr=count(active,s=>fmt(s)==='tecnologia_representacion');
  bad(repr<2||repr>3,'TECH_REPRESENTATION_COUNT',
    'Tecnología de la Representación: dos o tres espacios anuales, según especialidad.',13);
  const workshops=count(active,s=>fmt(s)==='taller_especialidad');
  bad(workshops<1||workshops>4,'TECH_SPECIALTY_WORKSHOPS',
    'Taller de la Especialidad: entre uno y cuatro espacios anuales según especialidad.',13);
  const annual=count(active,s=>fmt(s)==='espacio_anual_especialidad');
  if(norm(specialtyId)==='geografo_matematico')
   bad(annual!==0,'TECH_GEO_NO_ANNUAL','Geógrafo Matemático no ofrece anual de especialidad.',18);
  else if(officialPlan?.annualSpecialtyDefined===false)
   review(true,'TECH_ANNUAL_UNDEFINED','El anual todavía no está definido para esta especialidad.',18);
  else bad(annual!==3,'TECH_ANNUAL_COUNT',
    'Debe haber un espacio anual de especialidad en 4.º, 5.º y 6.º, salvo excepción documentada.',13);
  for(const year of [4,5,6]){
   const n=count(active,s=>y(s)===year&&fmt(s)==='integracion_especialidad');
   bad(n<4||n>6,'TECH_SPECIALTY_INTEGRATIONS',
     'La especialidad requiere de cuatro a seis integraciones en '+year+'.º.',18);
  }
  bad(pp.length>2,'TECH_PP_TOO_MANY','Solo se contempla una o dos Prácticas Profesionalizantes.',13);
  review(pp.length===0,'TECH_PP_PENDING',
    'Seleccionar una o dos Prácticas Profesionalizantes en 5.º o 6.º según el plan.',13);
  bad(pp.some(s=>![5,6].includes(y(s))),
   'TECH_PP_YEAR','Las prácticas que integran el recorrido corresponden a 5.º o 6.º.',13);
  review(project.length>0,'TECH_PVF_LEGACY',
    'Los proyectos anuales independientes legados deben revisarse; el nuevo mapa cuenta Prácticas Profesionalizantes (1 o 2), no dos proyectos obligatorios.',13);
  const compulsorySoc=slots.filter(s=>s.character==='obligatorio').length;
  const compulsoryNat=natural.filter(s=>s.character==='obligatorio').length;
  if(slots.every(x=>['obligatorio','electivo'].includes(x.character)))
   bad(compulsorySoc!==(extra?5:4),'TECH_SOCIAL_EIO',
     'Obligatorios de Sociales: '+(extra?5:4)+'.',15);
  else review(true,'TECH_SOCIAL_EIO_PENDING','Falta definir las alternativas EIO/EIE de Sociales.',15);
  if(natural.every(x=>['obligatorio','electivo'].includes(x.character)))
   bad(compulsoryNat!==4,'TECH_NATURAL_EIO','Obligatorios de Naturales: 4.',15);
  else review(true,'TECH_NATURAL_EIO_PENDING','Falta definir las alternativas EIO/EIE de Naturales.',15);
  for(const s of slots){
   if(s.id?.startsWith('t-social-flex-'))bad(![4,5,6].includes(y(s)),
     'TECH_FLEX_SOCIAL_YEAR','Ciudadanía y Trabajo / Ciencia y Tecnología se ubica en 4.º, 5.º o 6.º.',13);
  }
 }else{
  const split=selectedSocialOption===12;
  const socialExpected=split?12:10;
  if(selectedSocialOption!=null&&![10,12].includes(selectedSocialOption))
    errors.push(issue('BACH_SOCIAL_OPTION','La opción de Ciencias Sociales debe ser 10 o 12 laboratorios.',9));
  bad(slots.length!==socialExpected,'BACH_SOCIAL_COUNT',
    'Ciencias Sociales: '+socialExpected+' laboratorios (con 3.º dividido si se eligen 12).',8);
  const expectedNat=isBachNaturales(orientation)?8:10;
  bad(natural.length!==expectedNat,'BACH_NATURAL_COUNT',
    'Ciencias Naturales: '+expectedNat+' laboratorios para esta orientación.',8);
  bad(physical.length!==10,'BACH_EF_COUNT','Educación Física: diez talleres.',8);
  bad(art.length!==6,'BACH_ART_COUNT','Artes: seis talleres.',8);
  bad(techForm.length!==8,'BACH_TECH_COUNT','Tecnologías: ocho talleres.',8);
  bad(project.length!==1||project.some(s=>y(s)!==5||s.duration!=='anual'),
    'BACH_PVF','Un Proyecto de Vinculación anual en 5.º.',11);
  const lab=count(active,s=>fmt(s)==='laboratorio_orientacion');
  const workshop=count(active,s=>fmt(s)==='taller_orientacion');
  bad(lab!==4||workshop!==4,'BACH_ORIENTED_COUNT',
    'Orientación: cuatro laboratorios obligatorios y cuatro talleres con propuestas electivas.',8);
  for(const year of [3,4,5]){
   const want=year===5?2:1;
   bad(count(active,s=>fmt(s)==='laboratorio_orientacion'&&y(s)===year)!==want ||
      count(active,s=>fmt(s)==='taller_orientacion'&&y(s)===year)!==want,
      'BACH_ORIENTED_BY_YEAR','En '+year+'.º se requieren '+want+' laboratorio(s) y '+want+' taller(es).',10);
  }
  const countSoc=slots.filter(s=>s.character==='obligatorio').length;
  const countNat=natural.filter(s=>s.character==='obligatorio').length;
  if(slots.every(x=>['obligatorio','electivo'].includes(x.character)))
   bad(countSoc!==(split?6:5),'BACH_SOCIAL_EIO',
     'Sociales requiere '+(split?6:5)+' laboratorios obligatorios.',9);
  else review(true,'BACH_SOCIAL_EIO_PENDING','Falta definir EIO/EIE de Sociales.',9);
  if(natural.every(x=>['obligatorio','electivo'].includes(x.character)))
   bad(countNat!==(isBachNaturales(orientation)?4:5),'BACH_NATURAL_EIO',
     'Naturales requiere '+(isBachNaturales(orientation)?4:5)+' laboratorios obligatorios.',10);
  else review(true,'BACH_NATURAL_EIO_PENDING','Falta definir EIO/EIE de Naturales.',10);
 }
 if(optionsLockedAt&&schoolYearStart){
  if(!validityDate(optionsLockedAt)||!validityDate(schoolYearStart))
   errors.push(issue('OPTIONS_DATES','Fechas de definición inválidas.',6));
  else if(optionsLockedAt>schoolYearStart)
   errors.push(issue('OPTIONS_LATE','Las opciones de conformación se definen antes del inicio del ciclo lectivo.',6));
 }
 // No declarar validados los totales horarios si el plan oficial no está contrastado.
 if(!obj(officialPlan)||!obj(approvedHoursByYear))
  warnings.push(issue('OFFICIAL_PLAN_REQUIRED','Falta contrastar materias y carga horaria total contra el diseño curricular vigente.',mode==='tecnica'?13:8,'warning'));
 for(const s of active){
  const v=validateCommonSpace(s,{model:mode,officialPlan,orientation});
  errors.push(...v.errors.map(x=>({...x,spaceId:s.id})));
  warnings.push(...v.warnings.map(x=>({...x,spaceId:s.id})));
 }
 for(const relation of arr(relations)){
  if(!obj(relation))continue;
  if(relation.type==='articulacion'&&(relation.sharedGrade===true||relation.sharedPlan===true))
   errors.push(issue('ARTICULATION_INDEPENDENT','Articulación conserva planes y calificaciones independientes.',7));
  if(relation.type==='integracion'&&
    (relation.sharedPlan!==true||relation.collegiateEvaluation!==true||relation.sharedGrade!==true))
   errors.push(issue('INTEGRATION_SHARED','Integración requiere plan común, evaluación colegiada y calificación compartida.',7));
  const years=arr(relation.spaces).map(x=>Number(x.year));
  if(years.length<2||new Set(years).size>1)
   errors.push(issue('RELATION_SAME_YEAR','No integrar espacios de diferentes años.',7));
 }
 return {ruleSet:FINAL_RULESET_ID,model:mode,counts:st,errors,warnings,
   valid:errors.length===0&&warnings.length===0,
   structurallyConsistent:errors.length===0,
   readyForPublication:false, // exige revisión pedagógica + plan oficial + cierre institucional
   officialPlanVerified:false,
   source:FINAL_SOURCE.number};
}
