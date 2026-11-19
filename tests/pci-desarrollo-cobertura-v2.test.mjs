import test from 'node:test';
import assert from 'node:assert/strict';
import {
 uniqueIds,spaceContentIds,developmentCounts,fgCoverage,foCoverage,
 groupCoverageForLevel,coverageForPool
} from '../src/pci-desarrollo-cobertura-v2.mjs';
const fg=[
 {id:'a',year:1,area:'Ciencias Sociales',subject:'Historia'},
 {id:'b',year:1,area:'Ciencias Sociales',subject:'Historia'},
 {id:'c',year:1,area:'Ciencias Sociales',subject:'Geografía'},
 {id:'d',year:2,area:'Ciencias Sociales',subject:'Historia'}
];
test('PCI V2: el contenido repetido en dos planes y cuatrimestres cuenta solo una vez',()=>{
 const spaces=[
  {year:1,area:'Ciencias Sociales',subjects:[{name:'Historia'}],
    plansBimestrales:[{contentIds:['a','a']},{contentIds:['b','a']}]},
  {year:1,area:'Ciencias Sociales',subjects:[{name:'Historia'}],
    plansBimestrales:[{contentIds:['a']},{contentIds:[]}]}
 ];
 const info=developmentCounts(spaces);
 assert.deepEqual(info.selectedContentIds,['a','b']);
 assert.equal(info.plans,4);
 assert.deepEqual(info.uniqueContents,2);
 const grouped=groupCoverageForLevel(spaces,fg,{year:1,area:'Ciencias Sociales'});
 assert.equal(grouped.total,2);
 assert.equal(grouped.used,2);
 assert.equal(grouped.percent,100);
});
test('FG nivel y materia: numerador, denominador, porcentaje y faltantes',()=>{
 const info=fgCoverage(fg,{year:1,area:'Ciencias Sociales',subjects:['Historia'],ids:['a','a','d']});
 assert.equal(info.used,1);
 assert.equal(info.total,2);
 assert.equal(info.percent,50);
 assert.equal(info.unmatched,1);
 assert.equal(info.basis,'level');
});
test('FO sin años explícitos informa trayectoria, no cobertura anual ficticia',()=>{
 const info=foCoverage([
  {id:'fo1',year:null,subject:'Historia Orientada'},
  {id:'fo2',year:null,subject:'Historia Orientada'}
 ],{year:4,ids:['fo1'],orientationLabel:'Ciencias Sociales'});
 assert.equal(info.basis,'trajectory');
 assert.equal(info.total,2);
 assert.equal(info.used,1);
 assert.equal(info.percent,50);
 assert.equal(info.label,'Ciencias Sociales');
});
test('BA +15 sin referencia validada: cantidades reales y porcentaje pendiente',()=>{
 const info=coverageForPool([],['id1','id1','id2'],{verified:false,label:'BA +15'});
 assert.equal(info.selected,2);
 assert.equal(info.total,null);
 assert.equal(info.percent,null);
 assert.equal(info.pending,true);
});
test('Suma contenidos de documentos nuevos y antiguos sin duplicar identificadores',()=>{
 const info=spaceContentIds({contentIds:['1'],contents:['2'],planes:[{contenidos:[1,3]}],
 plansBimestrales:[{contentIds:['4','4']}]});
 assert.deepEqual(info,['1','2','4','3']);
 assert.deepEqual(uniqueIds(['x','x',null,0]),['x','0']);
});
