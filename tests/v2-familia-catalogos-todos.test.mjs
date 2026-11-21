import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';

globalThis.fetch=async url=>{
  try{
    const body=await readFile(new URL('../'+String(url).split('?')[0].replace(/^\.?\//,''),import.meta.url));
    return {ok:true,json:async()=>JSON.parse(body),text:async()=>String(body)};
  }catch{return {ok:false}}
};
const {loadV2ModalProfile}=await import('../src/v2-familia/catalogos-modalidad.mjs');
const {ORIENTATIONS}=await import('../src/integracion-curricular/bridge.js');

test('BA +15: todas las orientaciones tienen materias y contenidos de la orientación (bases de Media)', async()=>{
  for(const o of ORIENTATIONS){
    const p=await loadV2ModalProfile({model:'ba15',orientation:o.id});
    assert.equal(p.levels,4);
    assert.ok(p.subjects.some(s=>s.origin==='FO'),`${o.id} sin materias de la orientación`);
    assert.ok(p.contents.fo.length>0,`${o.id} sin contenidos de la orientación`);
    for(const y of [2,3,4])assert.ok(p.subjects.some(s=>s.origin==='FO'&&s.year===y),`${o.id}: falta la orientación en Nivel ${y}`);
    assert.equal(p.subjects.some(s=>s.origin==='FO'&&s.year===1),false,`${o.id}: la orientación no corresponde al Nivel 1`);
  }
});

test('BA +15: equivalencia de niveles con Media (1.º y 2.º→1, 3.º→2, 4.º→3, 5.º→4)', async()=>{
  const p=await loadV2ModalProfile({model:'ba15',orientation:'economia_administracion'});
  const esperado={1:1,2:1,3:2,4:3,5:4};
  assert.equal(p.contents.fg.length,1126);
  for(const c of p.contents.fg)assert.equal(c.year,esperado[c.sourceYear],`${c.id}: ${c.sourceYear}.º debe ir a Nivel ${esperado[c.sourceYear]}`);
});

test('Técnica: todas las especialidades cargan seis niveles con formación técnico-específica', async()=>{
  const ids=(await readdir(new URL('../data/tecnica/priorizados/',import.meta.url))).filter(f=>f.endsWith('.json')).map(f=>f.slice(0,-5)).filter(id=>id!=='tecnologia_representacion');
  assert.ok(ids.length>=26);
  for(const id of ids){
    const p=await loadV2ModalProfile({model:'tecnica',specialty:id});
    assert.equal(p.levels,6,id);
    assert.equal(new Set(p.subjects.map(s=>s.year)).size,6,`${id}: faltan niveles`);
    assert.ok(p.subjects.some(s=>s.field==='formacion_tecnica_especifica'),`${id}: sin formación técnico-específica`);
  }
});
