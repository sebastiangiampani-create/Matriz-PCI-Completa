import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateState} from '../../pci-model.js';
import {
 officialFgRowsFor, officialIdsInGroup, stageOfficialFgInGroup,
 removeOfficialFgFromGroup, officialFgCoverageAtYear
} from './fg-year-bag.mjs';

const rows=[
 {id:'fg:1',area:'Lengua y Literatura',subject:'Lengua',axis:'Lectura',year:1,text:'Leer relatos'},
 {id:'fg:2',area:'Lengua y Literatura',subject:'Lengua',axis:'Lectura',year:2,text:'Leer novelas'},
 {id:'fg:3',area:'Lengua y Literatura',subject:'Lengua',axis:'Escritura',year:3,text:'Escribir ensayos'},
 {id:'fg:4',area:'Lengua y Literatura',subject:'Lengua',axis:'Escritura',year:3,text:'Escribir reseñas'},
 {id:'fg:n',area:'Ciencias Naturales',subject:'Biología',axis:'Seres vivos',year:3,text:'Biodiversidad'},
];
const original=()=>migrateState({});
test('la bolsa recupera los años FG 1.º-5.º de la base oficial',()=>{
 assert.deepEqual(officialFgRowsFor({rows,area:'Lengua y Literatura',year:1}).map(x=>x.id),['fg:1']);
 assert.deepEqual(officialFgRowsFor({rows,area:'Lengua y Literatura',year:2}).map(x=>x.id),['fg:2']);
 assert.deepEqual(officialFgRowsFor({rows,area:'Lengua y Literatura',year:3}).map(x=>x.id),['fg:3','fg:4']);
 assert.equal(officialFgRowsFor({rows,area:'Lengua y Literatura',year:4}).length,0);
 assert.equal(officialFgRowsFor({rows,area:'Lengua y Literatura',year:0}).length,4);
 assert.deepEqual(officialFgRowsFor({rows,area:'Lengua y Literatura',year:3,query:'reseñas'}).map(x=>x.id),['fg:4']);
});

test('no se insertan identificadores nuevos dentro de items históricos',()=>{
 const state=original(),group=state.areas['Lengua y Literatura'].groups[2];
 group.items=['historico:141'];
 const before=[...group.items];
 assert.deepEqual(stageOfficialFgInGroup(group,['fg:1','fg:3'],rows,'Lengua y Literatura'),{added:2,total:2});
 assert.deepEqual(group.items,before);
 assert.deepEqual(officialIdsInGroup(group),['fg:1','fg:3']);
 assert.deepEqual(stageOfficialFgInGroup(group,['fg:3'],rows,'Lengua y Literatura'),{added:0,total:2});
 assert.throws(()=>stageOfficialFgInGroup(group,['fg:n'],rows,'Lengua y Literatura'),/no pertenecen/);
 const recovered=migrateState(JSON.parse(JSON.stringify(state)));
 assert.deepEqual(recovered.areas['Lengua y Literatura'].groups[2].fgV2ContentIds,['fg:1','fg:3']);
 assert.deepEqual(recovered.areas['Lengua y Literatura'].groups[2].items,before);
});

test('se permite mezclar contenidos de distintos años sin falsear cobertura',()=>{
 const state=original(),g3=state.areas['Lengua y Literatura'].groups[2];
 stageOfficialFgInGroup(g3,['fg:1','fg:3','fg:4'],rows,'Lengua y Literatura');
 const result=officialFgCoverageAtYear({areas:state.areas,rows,area:'Lengua y Literatura',year:3});
 assert.deepEqual(result,{year:3,used:2,total:2,percent:100,placedFromOtherYears:1,source:'fg-sec-aprende-v2/1'});
 const year1=officialFgCoverageAtYear({areas:state.areas,rows,area:'Lengua y Literatura',year:1});
 assert.equal(year1.used,0);
 const g1=state.areas['Lengua y Literatura'].groups[0];
 stageOfficialFgInGroup(g1,['fg:1'],rows,'Lengua y Literatura');
 assert.equal(officialFgCoverageAtYear({areas:state.areas,rows,area:'Lengua y Literatura',year:1}).used,1);
});

test('retirar un contenido oficial no modifica el contenido histórico',()=>{
 const state=original(),g1=state.areas['Lengua y Literatura'].groups[0];
 g1.items=['original:5'];
 stageOfficialFgInGroup(g1,['fg:1'],rows,'Lengua y Literatura');
 removeOfficialFgFromGroup(g1,'fg:1');
 assert.deepEqual(officialIdsInGroup(g1),[]);
 assert.deepEqual(g1.items,['original:5']);
});
