import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticallyValidateImportedFg,exportValidatedFgV2,
  AUTO_VALIDATION_LABEL,AUTO_VALIDATION_VERSION
} from '../src/integracion-curricular/auto-validacion-importacion.js';
import {mappingKey} from '../src/integracion-curricular/homologaciones.js';

const matrix=[
  {id:'antiguo-mercados',area:'Ciencias Sociales',subject:'Economía',
   axis:'Economía y mercado',text:'Mercados, actores, oferta, demanda y circulación de bienes'},
  {id:'antiguo-historia',area:'Ciencias Sociales',subject:'Historia',
   axis:'Industrialización',text:'Procesos de industrialización y producción'},
  {id:'antiguo-no-reconocido',area:'Ciencias Sociales',subject:'Economía',
   text:'Unidades históricas que no aparecen en la FG nueva: difusión monetaria ancestral'},
  {id:'antiguo-4',area:'Ciencias Sociales',subject:'Economía',
   text:'Cambios del mercado y las actividades comerciales en el tiempo'},
  {id:'antiguo-no-asignado',area:'Matemática',subject:'Matemática',
   text:'Este contenido existía en la base histórica, aunque no se asignó a ningún espacio'}
];
const v2=[
 {id:'v2-mercados',year:3,area:'Ciencias Sociales',subject:'Economía',
  text:'Los mercados y sus actores'},
 {id:'v2-oferta',year:3,area:'Ciencias Sociales',subject:'Economía',
  text:'La oferta y la demanda'},
 {id:'v2-bienes',year:3,area:'Ciencias Sociales',subject:'Economía',
  text:'Circulación de bienes y servicios'},
 {id:'v2-historia',year:3,area:'Ciencias Sociales',subject:'Historia',
  text:'Procesos de industrialización y producción'},
 {id:'v2-extra-no-trabajado',year:3,area:'Ciencias Sociales',subject:'Economía',
  text:'Estructura de políticas macroeconómicas y fiscales'},
 {id:'v2-4',year:4,area:'Ciencias Sociales',subject:'Economía',
  text:'Cambios del mercado y las actividades comerciales en el tiempo'},
 {id:'v2-matematica',year:3,area:'Matemática',subject:'Matemática',
  text:'Resolución de problemas de proporcionalidad'}
];
const original=()=>({
 schemaVersion:10,schoolName:'Institución de prueba con historia',
 current:'Ciencias Sociales',notes:{arbitrary:'No descartar ninguna propiedad adicional'},
 areas:{
   'Ciencias Sociales':{closed:false,groups:[
     {id:'c5',name:'Laboratorio C5',level:3,kind:'laboratory',startTerm:5,
      items:['antiguo-mercados','antiguo-historia','antiguo-no-reconocido'],
      plansBimestrales:[
        {number:1,name:'Plan histórico 1',contentIds:['antiguo-mercados','antiguo-no-reconocido'],
         objective:'Objetivo preservado',stages:{inicio:{activities:'SECUENCIA HISTORICA NO SE DEBE PERDER'}}},
        {number:2,name:'Plan histórico 2',contentIds:['antiguo-historia'],
         stages:{desarrollo:{resources:'Material didáctico histórico'}}}
      ]},
     {id:'c6',name:'Laboratorio paralelo C6',level:3,kind:'laboratory',
      items:['antiguo-mercados'],plansBimestrales:[]},
     {id:'c7',name:'Laboratorio C7',level:4,kind:'laboratory',
      items:['antiguo-mercados','antiguo-4'],plansBimestrales:[]}
   ]}
 }
});
const run=(options={})=>automaticallyValidateImportedFg({
 legacyState:original(),orientationId:'Economía y Administración',
 matrixRows:matrix,v2FgRows:v2,...options
});
const exportAndState=v=>({exported:exportValidatedFgV2(v),source:original()});

test('sin solicitar aprobación, homologa un contenido histórico a tres referencias V2 y acredita contra V2',()=>{
 const source=original(),before=structuredClone(source);
 const result=run({legacyState:source});
 assert.deepEqual(source,before);
 assert.equal(result.summary.autoValidationRequiresUserApproval,false);
 assert.equal(result.validationVersion,AUTO_VALIDATION_VERSION);
 const mapping=result.approvedMappings[mappingKey('Ciencias Sociales',3,'antiguo-mercados')];
 assert.equal(mapping.status,'approved');
 assert.deepEqual(mapping.referenceIds,['v2-mercados','v2-oferta','v2-bienes']);
 assert.equal(mapping.mappingType,'one-to-many');
 assert.equal(mapping.autoValidated,true);
 assert.equal(mapping.reviewRecommended,true);
 assert.match(mapping.label,/Conviene revisar/);
 const coverage=result.coverageOnV2.find(r=>r.area==='Ciencias Sociales'&&r.year===3);
 assert.equal(coverage.used,4,'Tres de Economía y uno de Historia');
 assert.equal(coverage.total,5,'El denominador es V2 y no el total de la Matriz histórica');
 assert.equal(coverage.percent,80);
 assert.equal(result.summary.withoutV2Match>=1,true);
 assert.equal(result.summary.plansPreserved,2);
});

test('el PCI nuevo contiene solo IDs V2; el archivo anterior conserva todos los contenidos, planes y secuencias',()=>{
 const validated=run();
 const result=exportValidatedFgV2(validated);
 const group=result.currentCurriculumV2.areas['Ciencias Sociales'].groups[0];
 assert.equal(result.coverageCatalog,'fg-sec-aprende-v2/1');
 assert.ok(group.items.every(x=>x.startsWith('v2-')));
 assert.ok(group.plansBimestrales[0].contentIds.every(x=>x.startsWith('v2-')));
 assert.ok(group.items.includes('v2-mercados'));
 assert.ok(group.plansBimestrales[0].contentIds.includes('v2-oferta'));
 assert.equal(group.plansBimestrales[0].stages.inicio.activities,
  'SECUENCIA HISTORICA NO SE DEBE PERDER');
 assert.equal(group.plansBimestrales[0].objective,'Objetivo preservado');
 const archived=result.historicalArchiveFull;
 assert.deepEqual(archived.originalState,original(),'Archivo completo e idéntico al original');
 assert.deepEqual(archived.originalCatalog,matrix,
  'No desaparece ninguno de los contenidos del catálogo antiguo');
 assert.ok(archived.originalState.areas['Ciencias Sociales'].groups[0]
  .items.includes('antiguo-no-reconocido'));
 assert.ok(archived.missingMappings.some(x=>x.matrixId==='antiguo-no-reconocido'));
 assert.equal(archived.originalState.notes.arbitrary,
  'No descartar ninguna propiedad adicional');
 assert.equal(result.validationNotice,AUTO_VALIDATION_LABEL);
});

test('el plan previo se conserva incluso cuando NO existe equivalencia para un contenido',()=>{
 const validated=run(),exp=exportValidatedFgV2(validated);
 const plan=exp.currentCurriculumV2.areas['Ciencias Sociales'].groups[0].plansBimestrales[0];
 assert.equal(plan.legacyConversion.unresolvedLegacyCount,1);
 assert.equal(plan.contentIds.length,3,'El plan vigente utiliza tres desagregaciones V2');
 assert.equal(plan.stages.inicio.activities,'SECUENCIA HISTORICA NO SE DEBE PERDER');
 const archived=exp.historicalArchiveFull.originalState
   .areas['Ciencias Sociales'].groups[0].plansBimestrales[0];
 assert.deepEqual(archived.contentIds,['antiguo-mercados','antiguo-no-reconocido']);
});

test('deduplica la cobertura cuando un contenido se repite en dos laboratorios',()=>{
 const v=run(),lvl=v.coverageOnV2.find(x=>x.area==='Ciencias Sociales'&&x.year===3);
 assert.equal(lvl.used,4);
 assert.equal(v.summary.oneToMany>=1,true);
 const b=v.currentFg.areas['Ciencias Sociales'].groups;
 assert.equal(b[0].items.includes('v2-mercados'),true);
 assert.equal(b[1].items.includes('v2-mercados'),true);
 assert.equal(lvl.percent,80);
});

test('no mezcla años y puede mapear el mismo contenido original en años distintos',()=>{
 const v=run(),g=v.currentFg.areas['Ciencias Sociales'].groups;
 assert.ok(g[2].items.every(id=>id==='v2-4'));
 assert.ok(!g[2].items.includes('v2-mercados'));
 const third=v.approvedMappings[mappingKey('Ciencias Sociales',3,'antiguo-mercados')];
 const fourth=v.approvedMappings[mappingKey('Ciencias Sociales',4,'antiguo-mercados')];
 assert.ok(third);
 assert.equal(fourth?.referenceIds?.includes('v2-mercados')||false,false);
 assert.equal(v.coverageOnV2.find(x=>x.area==='Ciencias Sociales'&&x.year===4).total,1);
});

test('la corrección posterior de la escuela tiene prioridad y no se restaura el contenido rechazado',()=>{
 const manualKey=mappingKey('Ciencias Sociales',3,'antiguo-mercados');
 const corrected=run({manualOverrides:{[manualKey]:{referenceIds:['v2-mercados']}}});
 const map=corrected.approvedMappings[manualKey];
 assert.deepEqual(map.referenceIds,['v2-mercados']);
 assert.equal(corrected.summary.manuallyCorrected,1);
 assert.equal(corrected.coverageOnV2.find(x=>x.area==='Ciencias Sociales'&&x.year===3).used,2);
 const dismissed=run({manualOverrides:{[manualKey]:{referenceIds:[]}}});
 assert.equal(dismissed.approvedMappings[manualKey],undefined);
 assert.ok(dismissed.unresolved.some(x=>x.matrixId==='antiguo-mercados'));
 assert.equal(dismissed.coverageOnV2.find(x=>x.area==='Ciencias Sociales'&&x.year===3).used,1);
 assert.throws(()=>run({manualOverrides:{[manualKey]:{referenceIds:['v2-4']}}}),/corrección institucional/i);
});

test('la validación de dos orientaciones es independiente y nunca modifica una copia hermana',()=>{
 const source=original(),snap=structuredClone(source);
 const a=automaticallyValidateImportedFg({
  legacyState:source,orientationId:'Ciencias Naturales',matrixRows:matrix,v2FgRows:v2
 });
 const b=automaticallyValidateImportedFg({
  legacyState:source,orientationId:'Economía y Administración',matrixRows:matrix,v2FgRows:v2
 });
 assert.deepEqual(source,snap);
 assert.notEqual(a.orientationId,b.orientationId);
 assert.deepEqual(a.coverageOnV2,b.coverageOnV2);
 a.currentFg.areas['Ciencias Sociales'].groups[0].name='Cambié un resultado local';
 assert.equal(b.currentFg.areas['Ciencias Sociales'].groups[0].name,'Laboratorio C5');
});

test('no permite exportar resultados incompletos ni una base V2 corrupta',()=>{
 assert.throws(()=>exportValidatedFgV2({}),/validación/);
 assert.throws(()=>run({v2FgRows:[]}),/bases curriculares/);
 assert.throws(()=>run({v2FgRows:[v2[0],v2[0]]}),/ID o año inválido/);
});
