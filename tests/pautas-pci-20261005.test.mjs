import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RULESET_ID,SOURCE,GENERAL,BACHILLERATO,TECNICA,
  ANNUAL_SPECIALTIES,PENDING_ANNUAL_SPECIALTIES,NO_ANNUAL_SPECIALTIES,
  SPECIALTIES,findSpecialty,getAnnualSubjects,
  validateTechnicalSpace,validateTechnicalOverview,validateRelation,technicalCalendar
} from '../src/tecnica/pautas-pci-20261005.mjs';
const check=(space,options)=>validateTechnicalSpace(space,options);
const codes=r=>r.errors.map(e=>e.code);
const warnings=r=>r.warnings.map(e=>e.code);
const space=(format,year,hours,other={})=>({
  id:'s1',format,year,weeklyHours:hours,
  duration:format==='troncal'||format==='taller_primer_ciclo'||
   format==='tecnologia_representacion'||format==='taller_especialidad'||
   format==='espacio_anual_especialidad'?'anual':'cuatrimestral',
  ...other
});
test('proveniencia textual: 19 páginas y advertencia de referencia normativa incompleta',()=>{
  assert.equal(SOURCE.pages,19);
  assert.equal(RULESET_ID,'pci-pautas-2026-10-05/1');
  assert.match(SOURCE.legalReference,/XXX/);
  assert.equal(TECNICA.levels,6);assert.equal(TECNICA.terms,12);
  assert.equal(BACHILLERATO.levels,5);assert.equal(BACHILLERATO.terms,10);
  assert.equal(GENERAL.maxWeeklyHours,9);
  assert.deepEqual(technicalCalendar().map(x=>x.term),Array.from({length:12},(_,i)=>i+1));
  assert.equal(technicalCalendar()[10].year,6);
});
test('tabla de 20 especialidades con tres espacios anuales: no inventar las pendientes',()=>{
  assert.equal(ANNUAL_SPECIALTIES.length,20);
  assert.equal(PENDING_ANNUAL_SPECIALTIES.length,5);
  assert.equal(NO_ANNUAL_SPECIALTIES.length,1);
  assert.equal(SPECIALTIES.length,26);
  assert.deepEqual(Object.keys(getAnnualSubjects('Computación')).map(Number),[4,5,6]);
  assert.equal(getAnnualSubjects('Computación')[6],'Desarrollo de Sistemas');
  assert.equal(getAnnualSubjects('Administración de Empresas')[4],'Contabilidad I');
  assert.equal(getAnnualSubjects('Mecánica')[6],'Proyecto Mecánico');
  assert.equal(getAnnualSubjects('Óptica')[6],'Laboratorio de Contactología');
  assert.equal(getAnnualSubjects('Geógrafo Matemático'),null);
  assert.equal(getAnnualSubjects('Metalurgia'),null);
  assert.equal(findSpecialty('ELECTROMECANICA').id,'electromecanica');
});
test('naturales de técnica 1.º puede tener una sola materia; 2.º y 3.º no',()=>{
  const a=check(space('integracion_natural',1,9,{subjects:['Biología']}));
  const b=check(space('integracion_natural',2,6,{subjects:['Física']}));
  const c=check(space('integracion_natural',3,5,{subjects:['Química']}));
  assert.equal(a.valid,true);
  assert.ok(codes(b).includes('NATURAL_MIN_2'));
  assert.ok(codes(c).includes('NATURAL_MIN_2'));
});
test('sociales técnica 1 materia solo si el plan la define para ese año',()=>{
  const x=space('integracion_social',4,6,{subjects:['Ciudadanía y Trabajo']});
  assert.ok(codes(check(x)).includes('SOCIAL_MIN_2'));
  assert.equal(check(x,{plan:{singleSocialSubjectYears:[4]}}).valid,true);
});
test('9 horas es límite, excepto integración de especialidad con plan específico',()=>{
  assert.equal(check(space('integracion_social',1,9,{subjects:['Historia','Geografía']})).valid,true);
  assert.ok(codes(check(space('integracion_social',1,10,{subjects:['Historia','Geografía']}))).includes('MAX_9_HOURS'));
  assert.ok(codes(check(space('integracion_natural',2,10,{subjects:['Física','Química']}))).includes('MAX_9_HOURS'));
  const exception=check(space('integracion_especialidad',5,12),{specialty:'Computación'});
  assert.equal(exception.errors.length,0);
  assert.ok(warnings(exception).includes('SPECIALTY_HOURS_REQUIRE_PLAN'));
});
test('no mezclar términos 1-12 con años erróneos',()=>{
  assert.equal(check(space('integracion_natural',2,6,{subjects:['Física','Química'],term:4})).valid,true);
  assert.ok(codes(check(space('integracion_natural',2,6,{subjects:['Física','Química'],term:6}))).includes('TERM_LEVEL_MISMATCH'));
  assert.ok(codes(check(space('integracion_natural',7,6,{subjects:['Física','Química']}))).includes('INVALID_LEVEL'));
});
test('anualidad del Taller del 1er Ciclo, Representación y especialidad',()=>{
  assert.ok(codes(check(space('taller_primer_ciclo',1,5,{duration:'cuatrimestral'}))).includes('ANNUAL_FORMAT'));
  assert.ok(codes(check(space('taller_primer_ciclo',3,5))).includes('FIRST_CYCLE_WORKSHOP_YEAR'));
  assert.equal(check(space('tecnologia_representacion',2,5)).valid,true);
  assert.ok(warnings(check(space('tecnologia_representacion',3,5))).includes('REPRESENTATION_THIRD_PENDING'));
  assert.equal(check(space('tecnologia_representacion',3,5),{plan:{representationThirdYear:true}}).warnings.length,0);
  assert.ok(codes(check(space('taller_especialidad',2,5))).includes('SPECIALTY_WORKSHOP_YEAR'));
  assert.ok(codes(check(space('integracion_especialidad',3,8))).includes('SPECIALTY_INTEGRATION_YEAR'));
});
test('en 6º Matemática / Lengua Adicional solo para Computación o ADE',()=>{
  assert.equal(check(space('troncal',6,5,{title:'Matemática'}),{specialty:'Computación'}).valid,true);
  assert.equal(check(space('troncal',6,4,{title:'Lengua Adicional'}),{specialty:'Administración de Empresas'}).valid,true);
  assert.ok(codes(check(space('troncal',6,5,{title:'Matemática'}),{specialty:'Mecánica'})).includes('SIXTH_YEAR_CORE_EXCEPTION'));
  assert.ok(codes(check(space('troncal',6,5,{title:'Lengua y Literatura'}),{specialty:'Computación'})).includes('SIXTH_YEAR_CORE'));
});
test('espacios anuales de 4º-6º según especialidad y excepción Geógrafo Matemático',()=>{
  const annual=space('espacio_anual_especialidad',5,7,{title:'Laboratorio Orientado a Objetos'});
  assert.equal(check(annual,{specialty:'Computación'}).valid,true);
  assert.ok(codes(check({...annual,title:'Proyecto Mecánico'},{specialty:'Computación'})).includes('ANNUAL_SUBJECT_MISMATCH'));
  assert.ok(codes(check(annual,{specialty:'Geógrafo Matemático'})).includes('SPECIALTY_NO_ANNUAL'));
  assert.ok(warnings(check(annual,{specialty:'Metalurgia'})).includes('SPECIALTY_ANNUAL_PENDING'));
});
test('Mecánica: Metrología y Producción Industrial cuatrimestral separado en 3º',()=>{
  assert.equal(check(space('metrologia_mecanica',3,5),{specialty:'Mecánica'}).valid,true);
  assert.ok(codes(check(space('metrologia_mecanica',4,5),{specialty:'Mecánica'})).includes('METROLOGY_EXCEPTION'));
  assert.ok(codes(check(space('metrologia_mecanica',3,5),{specialty:'Óptica'})).includes('METROLOGY_EXCEPTION'));
});
test('distinción entre articulación e integración: plan y evaluación',()=>{
  const a=[{id:'s1',year:3},{id:'s2',year:3}];
  assert.equal(validateRelation({type:'articulacion',spaces:a,sharedPlan:false,sharedGrade:false}).valid,true);
  assert.ok(codes(validateRelation({type:'articulacion',spaces:a,sharedPlan:true})).includes('ARTICULATION_INDEPENDENT'));
  assert.equal(validateRelation({type:'integracion',spaces:a,sharedPlan:true,sharedGrade:true,collegiateEvaluation:true}).valid,true);
  assert.ok(codes(validateRelation({type:'integracion',spaces:a,sharedPlan:false,sharedGrade:true})).includes('INTEGRATION_SHARED'));
  assert.ok(codes(validateRelation({type:'integracion',spaces:[a[0],{id:'s3',year:4}]})).includes('RELATION_YEAR'));
});
test('pauta general no equivale a validación integral sin plan de especialidad',()=>{
  const original=[space('integracion_especialidad',4,7)];
  const before=structuredClone(original);
  const v=validateTechnicalOverview({specialty:'Electromecánica',spaces:original});
  assert.equal(v.partial,true);
  assert.equal(v.valid,false);
  assert.ok(warnings(v).includes('SPECIALTY_PLAN_REQUIRED'));
  assert.deepEqual(original,before,'El validador mutó los documentos del PCI.');
});
test('Computación: excepción 10 sociales (5 obligatorios/5 electivos) y segundo ciclo',()=>{
  assert.equal(TECNICA.socialIntegration.compSpecialtyTotal,10);
  assert.equal(TECNICA.socialIntegration.computacionMandatory,5);
  assert.equal(TECNICA.socialIntegration.computacionElective,5);
  assert.equal(TECNICA.socialIntegration.compAdditionalInFourth,2);
  assert.equal(TECNICA.naturalIntegration.total,6);
  assert.equal(TECNICA.physicalEducation.total,12);
  assert.deepEqual(TECNICA.futureProjectComponents,[
    'Actividades Educativas con Integración en Contextos',
    'Experiencias Formativas Vocacionales','Prácticas Profesionalizantes'
  ]);
});
test('Bachillerato: conservar opciones de tercero y particularidad Naturales',()=>{
  assert.deepEqual(BACHILLERATO.socials.byYear,[2,2,'2_o_4',2,2]);
  assert.deepEqual(BACHILLERATO.socials.requiredTotals,[10,12]);
  assert.equal(BACHILLERATO.naturals.total,10);
  assert.equal(BACHILLERATO.naturals.naturalesOrientationTotal,8);
  assert.deepEqual(BACHILLERATO.orientationLabs.byYear,[0,0,1,1,2]);
  assert.deepEqual(BACHILLERATO.orientationWorkshops.byYear,[0,0,1,1,2]);
});
