import test from 'node:test';
import assert from 'node:assert/strict';
import {
  automaticallyValidateImportedFg, exportValidatedFgV2
} from '../src/integracion-curricular/auto-validacion-importacion.js';
import {mappingKey} from '../src/integracion-curricular/homologaciones.js';

const AREA='Ciencias Sociales';
const TARGET='fg-sec-aprende-v2/1';
const matrixRows=[
  {id:'old-a',area:AREA,subject:'Historia',text:'Procesos de industrialización y producción'},
  {id:'old-plan',area:AREA,subject:'Historia',text:'Transformaciones sociales de la urbanización'}
];
const v2FgRows=[
  {id:'new-a',year:3,area:AREA,subject:'Historia',text:matrixRows[0].text},
  {id:'new-b',year:3,area:AREA,subject:'Historia',text:'Participación política y ciudadanía'},
  {id:'new-plan',year:3,area:AREA,subject:'Historia',text:matrixRows[1].text},
  {id:'new-first',year:1,area:AREA,subject:'Historia',text:'Formas de vida en las primeras sociedades'}
];
function state(){
  return {schemaVersion:10,schoolName:'Escuela sintética de integración',areas:{[AREA]:{groups:[{
    id:'g3',name:'Laboratorio 3.º',level:3,items:['old-a'],
    fgV2ContentIds:['new-b','new-first'],
    plansBimestrales:[
      {number:1,name:'Plan mixto',contentIds:['old-a','new-b','new-first'],
       stages:{inicio:{activities:'Actividad original conservada'}}},
      {number:2,name:'Plan vacío conservado',contentIds:[],objective:'Objetivo original'}
    ]
  }]}}};
}
function run(legacyState=state(),extra={}){
  return automaticallyValidateImportedFg({legacyState,orientationId:'Economía y Administración',
    matrixRows,v2FgRows,...extra});
}
function group(result){return result.currentFg.areas[AREA].groups[0];}
function coverage(result,year){return result.coverageOnV2.find(x=>x.area===AREA&&x.year===year);}
const sorted=x=>[...x].sort();

test('conserva contenidos V2 de grupo y plan, aunque sean de otro año',()=>{
  const original=state(),before=structuredClone(original),result=run(original);
  assert.deepEqual(sorted(group(result).items),['new-a','new-b','new-first']);
  assert.deepEqual(sorted(group(result).plansBimestrales[0].contentIds),['new-a','new-b','new-first']);
  assert.deepEqual(group(result).items,group(result).fgV2ContentIds);
  assert.equal(coverage(result,3).used,2);
  assert.equal(coverage(result,3).total,3);
  assert.equal(coverage(result,3).percent,66.7);
  assert.equal(coverage(result,1).used,0,
    'Un contenido de 1.º ubicado en 3.º no acredita cobertura de ninguno de los dos niveles');
  assert.deepEqual(original,before);
  assert.equal(group(result).plansBimestrales[0].stages.inicio.activities,'Actividad original conservada');
  assert.equal(group(result).plansBimestrales[1].objective,'Objetivo original');
  assert.equal(result.summary.autoValidationRequiresUserApproval,false);
});

test('homologa automáticamente contenidos históricos que aparecen solo dentro de un plan',()=>{
  const original=state();
  original.areas[AREA].groups[0].plansBimestrales[1].contentIds=['old-plan'];
  const before=structuredClone(original),result=run(original);
  assert.deepEqual(group(result).plansBimestrales[1].contentIds,['new-plan']);
  assert.ok(group(result).items.includes('new-plan'),
    'El contenido trabajado en el plan integra la unión curricular del agrupamiento');
  assert.deepEqual(result.approvedMappings[mappingKey(AREA,3,'old-plan')].referenceIds,['new-plan']);
  assert.equal(result.summary.legacyContentsAnalyzed,2);
  assert.equal(result.summary.plansPreserved,2);
  assert.equal(coverage(result,3).used,3);
  assert.equal(coverage(result,3).total,3);
  assert.deepEqual(original,before);
});

test('reprocesar un currículo ya V2 no vacía planes ni lo trata como catálogo histórico',()=>{
  const first=run();
  const second=run(structuredClone(first.currentFg));
  assert.deepEqual(group(second).items,group(first).items);
  assert.deepEqual(group(second).plansBimestrales.map(p=>p.contentIds),
    group(first).plansBimestrales.map(p=>p.contentIds));
  assert.deepEqual(second.coverageOnV2,first.coverageOnV2);
  assert.equal(second.summary.withoutV2Match,0);
  assert.equal(second.summary.legacyContentsAnalyzed,0);
});

test('la selección oficial de un plan no necesita repetirse en la lista del grupo',()=>{
  const original=state(),g=original.areas[AREA].groups[0];
  g.fgV2ContentIds=[];
  g.plansBimestrales[0].contentIds=[];
  g.plansBimestrales[0].fgV2ContentIds=['new-b','new-first'];
  const result=run(original),plan=group(result).plansBimestrales[0];
  assert.deepEqual(sorted(plan.contentIds),['new-b','new-first']);
  assert.deepEqual(sorted(plan.fgV2ContentIds),['new-b','new-first']);
  assert.deepEqual(sorted(group(result).items),['new-a','new-b','new-first']);
  assert.equal(coverage(result,3).used,2);
  assert.equal(coverage(result,1).used,0);
});

test('la procedencia explícita resuelve IDs iguales entre el catálogo viejo y el nuevo',()=>{
  const old=[{id:'42',area:AREA,subject:'Historia',text:'Texto histórico específico'}];
  const refs=[
    {id:'new-42',year:3,area:AREA,subject:'Historia',text:'Texto histórico específico'},
    {id:'42',year:3,area:AREA,subject:'Historia',text:'Otro contenido oficial completamente distinto'}
  ];
  const original=state(),g=original.areas[AREA].groups[0];
  g.items=['42'];g.fgV2ContentIds=[];
  g.plansBimestrales=[{number:1,curriculumCatalog:TARGET,contentIds:['42']}];
  const result=run(original,{matrixRows:old,v2FgRows:refs});
  assert.deepEqual(group(result).plansBimestrales[0].contentIds,['42']);
  assert.deepEqual(sorted(group(result).items),['42','new-42']);
  assert.deepEqual(result.approvedMappings[mappingKey(AREA,3,'42')].referenceIds,['new-42']);
});

test('un rechazo manual de homologación también rige para el contenido histórico de un plan',()=>{
  const original=state();
  original.areas[AREA].groups[0].plansBimestrales[1].contentIds=['old-plan'];
  const manualOverrides={[mappingKey(AREA,3,'old-plan')]:{referenceIds:[]}};
  const result=run(original,{manualOverrides});
  assert.deepEqual(group(result).plansBimestrales[1].contentIds,[]);
  assert.ok(!group(result).items.includes('new-plan'));
  assert.ok(result.unresolved.some(x=>x.matrixId==='old-plan'));
  const output=exportValidatedFgV2(result);
  assert.deepEqual(output.historicalArchiveFull.originalState,original);
  assert.equal(group(result).plansBimestrales[1].legacyConversion.unresolvedLegacyCount,1);
});

test('la exportación conserva texto, secuencias y cuatro planes, sin inflar contenido repetido',()=>{
  const original=state(),g=original.areas[AREA].groups[0];
  g.plansBimestrales=[1,2,3,4].map(number=>({number,name:'Plan '+number,
    contentIds:['old-a','new-b','new-b'],stages:{inicio:{activities:'Secuencia '+number}}}));
  const result=run(original),output=exportValidatedFgV2(result);
  assert.equal(result.summary.plansPreserved,4);
  assert.equal(group(result).plansBimestrales.length,4);
  assert.equal(coverage(result,3).used,2);
  for(const plan of group(result).plansBimestrales){
    assert.deepEqual(sorted(plan.contentIds),['new-a','new-b']);
    assert.equal(plan.stages.inicio.activities,'Secuencia '+plan.number);
  }
  assert.deepEqual(output.historicalArchiveFull.originalState,original);
  assert.deepEqual(output.historicalArchiveFull.originalCatalog,matrixRows);
});

test('un ID oficial desconocido no se inventa ni desaparece del respaldo',()=>{
  const original=state(),g=original.areas[AREA].groups[0];
  g.fgV2ContentIds.push('id-inexistente');
  g.plansBimestrales[0].fgV2ContentIds=['new-b','id-inexistente'];
  const result=run(original),plan=group(result).plansBimestrales[0];
  assert.ok(!group(result).items.includes('id-inexistente'));
  assert.ok(!plan.contentIds.includes('id-inexistente'));
  assert.ok(!plan.fgV2ContentIds.includes('id-inexistente'));
  assert.equal(plan.legacyConversion.unresolvedDirectCount,1);
  assert.deepEqual(exportValidatedFgV2(result).historicalArchiveFull.originalState,original);
});
