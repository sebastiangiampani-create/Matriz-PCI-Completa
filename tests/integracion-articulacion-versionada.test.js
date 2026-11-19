import test from 'node:test';
import assert from 'node:assert/strict';
import {processFG,linkedFGContent,createArticulation,validateArticulation,
coverageOfVersion,articulationSummary,LEGACY_FG,CURRENT_FG,CURRENT_FO}
 from '../src/integracion-curricular/articulacion-versionada.js';
const process=(version,id)=>processFG({id,orientation:'Economía y Administración',
 baseVersion:version,areas:{'Ciencias Sociales':{groups:[{id:'grupo-a',items:['fg-1','fg-2'],
 plansBimestrales:[{number:1,contentIds:['fg-1'],stages:{evaluacion:{description:'rúbrica'}}}]}]}}});
const historical=process(LEGACY_FG,'proceso-2025');
const current=process(CURRENT_FG,'proceso-2026');
const foo={orientation:'Economía y Administración',slot:'foLab5-c9',contentId:'fo-1',baseVersion:CURRENT_FO};
const validState={foSpaces:{'foLab5-c9':{orientation:'Economía y Administración'}},
 foCatalog:[{id:'fo-1'}]};
test('FG historica y actual conviven sin migracion implicita',()=>{
 const fgA=linkedFGContent(historical,'Ciencias Sociales','grupo-a','fg-1');
 const fgB=linkedFGContent(current,'Ciencias Sociales','grupo-a','fg-1');
 const lA=createArticulation({id:'a',fg:fgA,fo:foo},historical);
 const lB=createArticulation({id:'b',fg:fgB,fo:foo},current);
 assert.equal(validateArticulation(lA,{process:historical,...validState}).valid,true);
 assert.equal(validateArticulation(lB,{process:current,...validState}).valid,true);
 assert.equal(validateArticulation(lA,{process:current,...validState}).valid,false);
 assert.deepEqual(articulationSummary([lA,lB]),{
  links:2,fgHistorical:1,fgCurrent:1,modifiesCoverage:false});
 assert.equal(historical.areas['Ciencias Sociales'].groups[0].plansBimestrales[0].stages.evaluacion.description,'rúbrica');
});
test('Nunca aceptar contenidos ajenos o versiones FG no identificadas',()=>{
 assert.throws(()=>processFG({id:'nuevo',orientation:'Economía y Administración',baseVersion:'vigente',areas:{}}),/base FG/);
 assert.throws(()=>linkedFGContent(historical,'Ciencias Sociales','grupo-a','no-existe'),/no pertenece/);
 const origin=linkedFGContent(historical,'Ciencias Sociales','grupo-a','fg-1');
 assert.throws(()=>createArticulation({id:'x',fg:origin,fo:foo},current),/bloqueada/);
 assert.throws(()=>createArticulation({id:'x',fg:origin,fo:{...foo,baseVersion:LEGACY_FG}},historical),/FO/);
});
test('Cobertura usa el denominador de su version, nunca el ultimo catalogo',()=>{
 assert.deepEqual(coverageOfVersion(historical,['fg-1'],[
 {id:'fg-1',baseVersion:LEGACY_FG},{id:'fg-2',baseVersion:LEGACY_FG},
 {id:'fg-3',baseVersion:LEGACY_FG}]),{baseVersion:LEGACY_FG,used:1,total:3,percent:33.3});
 assert.deepEqual(coverageOfVersion(current,['fg-1'],[
 {id:'fg-1',baseVersion:CURRENT_FG},{id:'fg-2',baseVersion:CURRENT_FG}
 ]),{baseVersion:CURRENT_FG,used:1,total:2,percent:50});
 assert.throws(()=>coverageOfVersion(historical,['fg-1'],[
 {id:'fg-1',baseVersion:CURRENT_FG}]),/No mezclar/);
});
test('Los enlaces no asumen equivalencia curricular ni reemplazan la FO',()=>{
 const fg=linkedFGContent(historical,'Ciencias Sociales','grupo-a','fg-2');
 const link=createArticulation({id:'z',fg,fo:foo},historical);
 assert.deepEqual(validateArticulation(link,{process:historical,...validState}),{valid:true,reason:''});
 assert.equal(validateArticulation(link,{process:historical,foSpaces:{},foCatalog:validState.foCatalog}).valid,false);
 assert.equal(validateArticulation(link,{process:historical,foSpaces:validState.foSpaces,foCatalog:[]}).valid,false);
 assert.equal(link.relation,'articulacion');
 assert.equal(historical.areas['Ciencias Sociales'].groups[0].items.length,2);
});