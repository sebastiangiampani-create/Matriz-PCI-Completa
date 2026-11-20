import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadV2Fg,FG_REFERENCE} from '../src/integracion-curricular/catalogos.js';
import {
 buildBa15FgBase,summarizeBa15FgBase,BA15_FG_BASE_VERSION,
 BA15_FG_SOURCE_VERSION,BA15_FG_LEVEL_MAP
} from '../src/ba15/priorizados-base.mjs';
import {crearBorradorBa15} from '../src/ba15/constructor.mjs';

const fetchFn=async url=>{
 try{const data=await readFile(url,'utf8');return {ok:true,text:async()=>data};}
 catch{return {ok:false,text:async()=>''};}
};
test('BA +15 construye una base independiente con los 1126 priorizados FG de Media',async()=>{
 const source=await loadV2Fg({fetchFn});
 const before=structuredClone(source);
 const base=buildBa15FgBase(source);
 assert.equal(source.length,1126);
 assert.equal(base.length,1126);
 assert.equal(new Set(base.map(x=>x.id)).size,1126);
 assert.equal(BA15_FG_SOURCE_VERSION,FG_REFERENCE);
 assert.equal(base[0].baseVersion,BA15_FG_BASE_VERSION);
 assert.deepEqual(source,before,'El catálogo original de Media no se modifica');
});
test('La equivalencia de años es exacta: NES 1+2, 3, 4 y 5 pasan a BA +15 1, 2, 3 y 4',async()=>{
 const source=await loadV2Fg({fetchFn}),base=buildBa15FgBase(source);
 for(const row of base){
  assert.equal(row.ba15Level,BA15_FG_LEVEL_MAP[row.sourceYear]);
  assert.equal(row.year,row.ba15Level);
  assert.equal(row.level,row.ba15Level);
  assert.ok(row.id);
  assert.equal(row.sourceYear,source.find(x=>x.id===row.id).year);
 }
 const counts=summarizeBa15FgBase(base);
 assert.equal(counts.total,1126);
 assert.equal(counts.uniqueIds,1126);
 assert.deepEqual(counts.byLevel.map(x=>x.sourceYears),[[1,2],[3],[4],[5]]);
 assert.ok(counts.byLevel.every(x=>x.total>0));
});
test('Nivel 1 combina ambos años de origen sin perder el año ni los metadatos del contenido',async()=>{
 const source=await loadV2Fg({fetchFn}),base=buildBa15FgBase(source);
 const level1=base.filter(x=>x.ba15Level===1);
 assert.ok(level1.some(x=>x.sourceYear===1));
 assert.ok(level1.some(x=>x.sourceYear===2));
 for(const row of level1){
  const original=source.find(x=>x.id===row.id);
  assert.equal(row.sourceYear,original.year);
  assert.equal(row.area,original.area);
  assert.equal(row.subject,original.subject);
  assert.equal(row.axis,original.axis);
  assert.equal(row.subaxis,original.subaxis);
  assert.equal(row.text,original.text);
 }
});
test('Los niveles 2, 3 y 4 conservan respectivamente los contenidos NES 3, 4 y 5',async()=>{
 const base=buildBa15FgBase(await loadV2Fg({fetchFn}));
 for(const [level,sourceYear] of [[2,3],[3,4],[4,5]]){
  const rows=base.filter(x=>x.ba15Level===level);
  assert.ok(rows.length>0);
  assert.ok(rows.every(x=>x.sourceYear===sourceYear));
 }
});
test('La base rechaza catálogo incompleto, años desconocidos e IDs repetidos',()=>{
 const small=[
  {id:'a',year:1,area:'A',subject:'S',axis:'E',subaxis:'X',text:'1'},
  {id:'b',year:2,area:'A',subject:'S',axis:'E',subaxis:'X',text:'2'},
  {id:'c',year:3,area:'A',subject:'S',axis:'E',subaxis:'X',text:'3'},
  {id:'d',year:4,area:'A',subject:'S',axis:'E',subaxis:'X',text:'4'},
  {id:'e',year:5,area:'A',subject:'S',axis:'E',subaxis:'X',text:'5'}
 ];
 assert.equal(buildBa15FgBase(small,{expectedCount:5}).length,5);
 assert.throws(()=>buildBa15FgBase(small),/incompleta/);
 assert.throws(()=>buildBa15FgBase([...small,{...small[0],id:'f',year:6}],{expectedCount:6}),/año de origen/);
 assert.throws(()=>buildBa15FgBase([...small,{...small[0]}],{expectedCount:6}),/ID vacío o duplicado/);
});

test('Cada nuevo PCI BA +15 registra versión y tabla de equivalencias de su base FG',()=>{
 const draft=crearBorradorBa15({pciId:'ba15-noche',schoolId:99,
  orientationId:'turismo',shiftId:'noche'});
 assert.equal(draft.priorizadosFGBase.version,BA15_FG_BASE_VERSION);
 assert.equal(draft.priorizadosFGBase.source,BA15_FG_SOURCE_VERSION);
 assert.deepEqual(draft.priorizadosFGBase.yearToBa15Level,{1:1,2:1,3:2,4:3,5:4});
 assert.deepEqual(draft.priorizadosFGBase.levels.map(x=>x.sourceYears),[[1,2],[3],[4],[5]]);
 assert.equal(draft.niveles.length,4);
});
