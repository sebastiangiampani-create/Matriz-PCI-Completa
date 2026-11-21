import test from 'node:test';
import assert from 'node:assert/strict';
import {
 mediaDevelopmentSpaces,technicalDevelopmentSpaces,countsForDevelopment,
 spaceIds,uniqueContentIds,verifiedCoverage
} from '../src/pci-desarrollo-resumen.mjs';
test('Fase 2 hereda cada grupo histórico, nuevo FG y FO sin repetir el histórico',()=>{
 const old={id:'grupo-2026',name:'Ciencias Sociales',level:3,startTerm:5,
  items:['matriz:historia'],plansBimestrales:[
   {name:'1',contentIds:['v2a']},{name:'2',contentIds:['v2a']},
   {name:'3',contentIds:[]},{name:'4',contentIds:[]}
  ]};
 const original=structuredClone(old);
 const groups=mediaDevelopmentSpaces({
  historicalAreas:{'Ciencias Sociales':{groups:[old]}},
  composition:{groups:[
   {id:'copia',legacyGroupId:'grupo-2026',area:'Ciencias Sociales',year:3,
    members:[{component:'FG'}]},
   {id:'nuevo',name:'Laboratorio nuevo',area:'Ciencias Naturales',year:3,term:6,
    members:[{component:'FG',name:'Biología'}]},
   {id:'sin-fg',name:'Solo FO',area:'Ciencias Sociales',year:4,term:8,members:[{component:'FO'}]}
  ]},
  foSpaces:[{id:'fo-1',name:'Taller FO',year:3,term:6,kind:'taller'}]
 });
 assert.equal(groups.length,3);
 assert.deepEqual(groups.map(x=>x.key).sort(),[
  'FG:Ciencias Naturales:nuevo','FG:Ciencias Sociales:grupo-2026','FO:fo-1']);
 assert.equal(groups.find(x=>x.id==='grupo-2026').plans,4);
 assert.equal(groups.find(x=>x.id==='nuevo').plans,4);
 assert.deepEqual(old,original);
});
test('Los planes y contenidos repetidos se cuentan una sola vez entre cuatrimestres',()=>{
 const entries=mediaDevelopmentSpaces({historicalAreas:{Matemática:{groups:[
  {id:'m1',name:'Matemática I',level:1,startTerm:1,plansBimestrales:[
   {contentIds:['fg1','fg2']},{contentIds:['fg1']},{contentIds:[]},{contentIds:[]}]},
  {id:'m2',name:'Matemática II',level:1,startTerm:2,plansBimestrales:[
   {contentIds:['fg2']},{contentIds:[]},{contentIds:[]},{contentIds:[]}]}
 ]}}});
 const totals=countsForDevelopment(entries);
 assert.equal(totals.spaces,2);assert.equal(totals.plans,8);
 assert.deepEqual(totals.contentIds,['fg1','fg2']);
});
test('Cobertura V2 verifica denominador oficial y no inventa porcentajes',()=>{
 const rows=[
  {id:'a',area:'Ciencias Sociales',year:3,subject:'Historia'},
  {id:'b',area:'Ciencias Sociales',year:3,subject:'Historia'},
  {id:'c',area:'Ciencias Sociales',year:4,subject:'Historia'}
 ];
 const metric=verifiedCoverage({rows,ids:['a','a','c'],year:3,area:'Ciencias Sociales'});
 assert.deepEqual([metric.matched,metric.total,metric.percentage,metric.missing],[1,2,50,1]);
 const pending=verifiedCoverage({rows:[],ids:['hist1','hist1']});
 assert.equal(pending.selected,1);assert.equal(pending.percentage,null);
 assert.equal(pending.basis,'unverified');
});
test('Las materias Técnicas no trasladan contenidos ni copias a otra especialidad',()=>{
 const offer={spaces:[
  {id:'t1',name:'Integración 1',year:3,term:5,kind:'integracion',area:'Técnica',
   contentIds:['p1'],included:true},
  {id:'t2',name:'Espacio no incluido',year:3,term:6,included:false}
 ]};
 const original=structuredClone(offer);
 const spaces=technicalDevelopmentSpaces(offer);
 assert.equal(spaces.length,1);assert.equal(spaces[0].key,'T:t1');
 assert.deepEqual(spaceIds(spaces[0].document),['p1']);
 assert.deepEqual(offer,original);
});
test('Identificadores oficiales y documentales conservan ID, sin sumar objetos anónimos',()=>{
 assert.deepEqual(uniqueContentIds(['a','a',{id:'b'},{id:'b'},{text:'sin ID'},null,4]),
  ['a','b','4']);
});
