import test from 'node:test';
import assert from 'node:assert/strict';
import {SPECIALTIES,findSpecialty} from '../src/tecnica/pautas-pci-20261005.mjs';
import {
 TECH_OFFER_SCHEMA,TECH_OFFER_VERSION,TECH_PLAN_SCHEMA,TECH_PLAN_VERSION,
 technicalOfferSeed,technicalSubjectBank,technicalMapRows,technicalCoverage,
 validateTechnicalDraft,addTechnicalIntegration,moveTechnicalTerm,
 setTechnicalSubject,technicalPlanSeed,guardTechnicalOffer,guardTechnicalPlan,
 technicianTerms
} from '../src/tecnica/espacio-trabajo-v2.mjs';

const sha='a'.repeat(64),id='11111111-1111-4111-8111-111111111111';
const pci=(specialty='Computación')=>({
 pci_id:id,school_id:1001,orientation_id:'tecnica_1a2b3c4d',
 process_id:'process-specific',model:'tecnica',
 specialty_name:specialty,legacy_sha256:sha,status:'borrador'
});
const src=(specialty='Computación')=>{
 const code=findSpecialty(specialty)?.id;
 return {especialidad_id:code,sha256_pdf:'b'.repeat(64),
  especialidad_nombre:specialty,fuente_url:'https://static.buenosaires.gob.ar/test.pdf',
  asignaturas:[{
    id:code+'-matematica',asignatura:'Matemática',
    campo_estimado:'formacion_cientifico_tecnologica',
    anios_detectados:[1,2],paginas:[
      {pagina_pdf:15,anio_contextual_inferido:1,texto_pagina:'Matemática de primer año'},
      {pagina_pdf:16,anio_contextual_inferido:2,texto_pagina:'Matemática de segundo año'}
    ]
   },{
    id:code+'-taller',asignatura:'Taller de la Especialidad',
    campo_estimado:'formacion_tecnica_especifica',
    anios_detectados:[4],paginas:[
      {pagina_pdf:95,anio_contextual_inferido:4,texto_pagina:'Proyecto de especialidad cuarto año'}
    ]
   },{
    id:code+'-indefinida',asignatura:'Asignatura de año no especificado',
    campo_estimado:'formacion_tecnica_especifica',
    anios_detectados:[1,2,3],paginas:[
      {pagina_pdf:96,anio_contextual_inferido:null,texto_pagina:'Año no identificado'}
    ]
   }]
 };
};
const find=(map,id)=>map.spaces.find(x=>x.id===id);

test('las 26 especialidades comparten el mismo motor Técnico sin cambiar su identidad',()=>{
 assert.equal(SPECIALTIES.length,26);
 for(const sp of SPECIALTIES){
  const map=technicalOfferSeed({pci:pci(sp.name),source:src(sp.name)});
  assert.equal(map.schema,TECH_OFFER_SCHEMA,sp.id);
  assert.equal(map.status,'borrador_no_homologado');
  assert.equal(map.specialty_id,sp.id);
  assert.equal(map.spaces.every(x=>x.year>=1&&x.year<=6),true);
  assert.equal(map.spaces.every(x=>x.term>=1&&x.endTerm<=12),true);
  assert.equal(map.spaces.every(x=>x.duration!=='anual'||x.endTerm===x.term+1),true);
  assert.equal(map.spaces.filter(x=>x.format==='vinculacion_futuro').length,2);
  assert.deepEqual(map.spaces.filter(x=>x.format==='vinculacion_futuro').map(x=>x.year),[5,6]);
 }
});
test('doce cuatrimestres, celdas anuales de dos términos y excepciones Computación',()=>{
 const p=pci(),map=technicalOfferSeed({pci:p,source:src()});
 const presentation=technicalMapRows(map);
 assert.equal(presentation.terms.length,12);
 for(let i=0;i<12;i++){
  assert.equal(presentation.terms[i].term,i+1);
  assert.equal(presentation.terms[i].year,Math.floor(i/2)+1);
 }
 assert.deepEqual(technicianTerms(6),[11,12]);
 assert.equal(map.spaces.filter(x=>x.format==='integracion_social').length,10);
 assert.equal(map.spaces.filter(x=>x.format==='integracion_natural').length,6);
 assert.equal(map.spaces.filter(x=>x.area==='Educación Física').length,12);
 assert.equal(map.spaces.filter(x=>x.area==='Educación Artística').length,2);
 assert.ok(find(map,'t-matematica-6'),'Computación tiene Matemática sexto');
 assert.ok(find(map,'t-lengua_adicional-6'),'Computación tiene Inglés sexto');
 assert.equal(find(map,'t-anual-4').name,'Laboratorio de Algoritmos y Estructura de Datos');
 assert.deepEqual([find(map,'t-pvf-5').endTerm,find(map,'t-pvf-6').endTerm],[10,12]);
});
test('excepciones Técnica: ADE tiene 6.º troncal, Geógrafo Matemático no tiene anual, Mecánica Metrología',()=>{
 const ade=technicalOfferSeed({pci:pci('Administración de Empresas'),source:src('Administración de Empresas')});
 assert.ok(find(ade,'t-matematica-6'));
 const geo=technicalOfferSeed({pci:pci('Geógrafo Matemático'),source:src('Geógrafo Matemático')});
 assert.equal(geo.spaces.filter(x=>x.format==='espacio_anual_especialidad').length,0);
 const mec=technicalOfferSeed({pci:pci('Mecánica'),source:src('Mecánica')});
 assert.ok(find(mec,'t-metrologia-3'));
 assert.equal(find(mec,'t-metrologia-3').duration,'cuatrimestral');
 assert.equal(mec.spaces.filter(x=>x.format==='integracion_social').length,8);
 assert.equal(mec.spaces.filter(x=>x.id==='t-matematica-6').length,0);
});
test('ubicación flexible C7 a C12 para Ciudadanía y Trabajo/Ciencia y Tecnología',()=>{
 const map=technicalOfferSeed({pci:pci(),source:src()});
 const moved=moveTechnicalTerm(map,'t-social-flex-1',11);
 assert.equal(find(moved,'t-social-flex-1').year,6);
 assert.equal(find(moved,'t-social-flex-1').term,11);
 assert.equal(find(map,'t-social-flex-1').term,7,'La edición no muta el original');
 assert.throws(()=>moveTechnicalTerm(map,'t-social-flex-1',3),/solo de 4/);
 assert.throws(()=>moveTechnicalTerm(map,'t-taller-especialidad-4',8),/primer cuatrimestre/);
 assert.throws(()=>moveTechnicalTerm(map,'t-matematica-1',3),/año curricular/);
});
test('cuatro a seis integraciones específicas por año sin mezclar los niveles',()=>{
 let map=technicalOfferSeed({pci:pci(),source:src()});
 assert.equal(map.spaces.filter(x=>x.format==='integracion_especialidad'&&x.year===4).length,4);
 map=addTechnicalIntegration(map,{year:4});
 map=addTechnicalIntegration(map,{year:4});
 assert.equal(map.spaces.filter(x=>x.format==='integracion_especialidad'&&x.year===4).length,6);
 assert.throws(()=>addTechnicalIntegration(map,{year:4}),/hasta seis/);
 assert.throws(()=>addTechnicalIntegration(map,{year:2}),/4.º a 6.º/);
});
test('materia + referencia a PDF se guardan por nivel y por especialidad, nunca se homologan solas',()=>{
 const p=pci(),source=src(),bank=technicalSubjectBank(source);
 const map=technicalOfferSeed({pci:p,source});
 assert.equal(bank.length,4);
 assert.deepEqual(bank.filter(x=>x.name==='Matemática').map(x=>x.year),[1,2]);
 assert.equal(bank.find(x=>x.page===96).year,null,'Sin año: no inventar año');
 const selection=setTechnicalSubject(map,'t-matematica-1',bank[0].id,bank,true);
 const target=find(selection,'t-matematica-1');
 assert.deepEqual(target.contentIds,[bank[0].id]);
 assert.deepEqual(target.subjectIds,[bank[0].sectionId]);
 assert.equal(find(map,'t-matematica-1').contentIds.length,0,'Edición inmutable');
 assert.throws(()=>setTechnicalSubject(map,'t-matematica-1',bank[1].id,bank,true),/otro año/);
 const foreign=technicalSubjectBank(src('Química'));
 assert.throws(()=>setTechnicalSubject(map,'t-matematica-1',foreign[0].id,foreign,true),/otra especialidad/);
 const coverage=technicalCoverage(selection,bank,{area:'Matemática',year:1});
 assert.deepEqual([coverage.used,coverage.denominator,coverage.percent],[1,1,100]);
 assert.equal(coverage.kind,'cobertura_documental_provisoria');
 assert.equal(coverage.curricularValidated,false,'100 % documental nunca equivale a validación del PCI');
 assert.equal(guardTechnicalOffer(selection,p,source).spatial_does_not_exist,undefined);
 assert.throws(()=>guardTechnicalOffer(selection,{...p,pci_id:'PCI-OTRO'},source),/otro PCI/);
});
test('cada espacio Técnico desarrolla cuatro planes y cuatro etapas sin alterar el mapa ni el origen',()=>{
 const p=pci(),source=src(),map=technicalOfferSeed({pci:p,source});
 const initial=JSON.stringify(map),space=map.spaces[0];
 const plan=technicalPlanSeed({pci:p,space,offer:map});
 assert.equal(plan.schema,TECH_PLAN_SCHEMA);
 assert.equal(plan.plansBimestrales.length,4);
 for(const item of plan.plansBimestrales){
  assert.deepEqual(Object.keys(item.stages),['punto_partida','indagacion','produccion','evaluacion']);
 }
 plan.plansBimestrales[0].stages.evaluacion.description='Producto de prueba';
 assert.equal(guardTechnicalPlan(plan,p,space,map).plansBimestrales[0].stages.evaluacion.description,'Producto de prueba');
 assert.equal(JSON.stringify(map),initial);
 assert.throws(()=>guardTechnicalPlan({...plan,pci_id:'otro'},p,space,map),/otro PCI/);
});
test('validación pedagógica separa errores reglamentarios y falta de carga horaria',()=>{
 const bank=technicalSubjectBank(src()),map=technicalOfferSeed({pci:pci(),source:src()});
 const audit=validateTechnicalDraft(map,bank);
 assert.equal(audit.valid,false,'No aprobar mapa sin plan curricular ni horas comprobadas');
 assert.equal(audit.readyForPublication,false);
 assert.equal(audit.sums.sociales,10);
 assert.equal(audit.sums.naturales,6);
 assert.ok(audit.warnings.some(x=>x.code==='DESIGN_HOURS_REQUIRED'));
});
