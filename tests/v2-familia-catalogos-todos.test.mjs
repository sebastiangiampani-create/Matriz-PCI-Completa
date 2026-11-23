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
const {BA15_FO_NORMA,auditarHorasFoBa15}=await import('../src/ba15/formacion-orientada-norma.mjs');
const {BA15_NIVELES}=await import('../src/ba15/reglas-curriculares.mjs');

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

test('BA +15: las franjas FO oficiales son 0, 4, 9, 12+2+2 horas y los bloques Media no son materias',async()=>{
 const hours=auditarHorasFoBa15(BA15_NIVELES);
 assert.ok(hours.every(x=>x.valido),'La estructura BA +15 debe coincidir con el Anexo I 6.3');
 assert.deepEqual(BA15_FO_NORMA.niveles.map(p=>p.horasFoTotales),[0,4,9,16]);
 assert.deepEqual(BA15_FO_NORMA.niveles.map(p=>p.horasOrientacion),[0,4,9,12]);
 assert.deepEqual(BA15_FO_NORMA.niveles[3].materiasFijas.map(x=>x.horas),[2,2]);
 const altered=structuredClone(BA15_NIVELES);
 altered[2].find(x=>x.nombre==='Materias de la orientación').horas=8;
 assert.equal(auditarHorasFoBa15(altered)[2].valido,false,'No homologar una estructura con horas FO alteradas');
 const p=await loadV2ModalProfile({model:'ba15',orientation:'economia_administracion'});
 assert.deepEqual(p.foHoursAudit.map(x=>x.valido),[true,true,true,true]);
 assert.equal(p.foSubjectStatus,'materias_nes_por_nivel_y_alternativa_pendientes_de_validacion_ba15');
 assert.equal(p.foSource.levelMap[3],2);
 assert.equal(p.foSource.levelMap[4],3);
 assert.equal(p.foSource.levelMap[5],4);
 assert.ok(p.foAlternatives.includes('A'));
 assert.equal(p.foPlan.homologacionAutomatica,false);
 for(const subject of p.subjects.filter(x=>x.origin==='FO'&&!x.legacyReference)){
  assert.equal(subject.referenceOnly,false,'Fase 1 debe usar asignaturas NES, no bloques de contenidos');
  assert.equal(subject.sourceType,'asignatura_nes');
  assert.equal(subject.confirmedBa15Subject,false,'La materia NES no equivale a homologación BA +15');
  assert.equal(subject.year,subject.sourceYear-1);
  assert.equal(subject.weeklyHours,null,'No inventar horas por asignatura');
  if(subject.year>2)assert.ok(['A','B'].includes(subject.alternative));
 }
 assert.ok(p.contents.fo.every(x=>x.referenceOnly===true&&x.levelBasis==='no_declarado_en_fuente_FO'));
 const old=p.subjects.filter(x=>x.legacyReference);
 assert.ok(old.length>0,'Conservar identificadores de las referencias FO de borradores antiguos.');
 assert.ok(old.every(x=>x.referenceOnly===true&&x.confirmedBa15Subject===false));
 assert.ok(old.every(x=>x.id.startsWith('ba15-fo-')),'Los IDs de la versión anterior permanecen legibles.');

});

test('BA +15: Fase 1 toma las materias NES exactas según orientación y alternativa',async()=>{
 const p=await loadV2ModalProfile({model:'ba15',orientation:'economia_administracion'});
 const nivel2=p.subjects.filter(s=>s.origin==='FO'&&s.year===2&&!s.legacyReference);
 assert.deepEqual(nivel2.map(x=>x.name),['Organizaciones']);
 assert.ok(nivel2.every(x=>x.alternative===null&&x.sourceYear===3));
 assert.ok(p.subjects.some(x=>x.origin==='FO'&&x.year===3&&x.alternative==='A'&&x.name==='Sistemas Administrativos'));
 assert.ok(p.subjects.some(x=>x.origin==='FO'&&x.year===4&&x.alternative==='A'&&x.name==='Proyecto Organizacional'));
 assert.ok(p.subjects.some(x=>x.origin==='FO'&&x.year===3&&x.alternative==='B'));
 assert.ok(p.foWarnings.some(x=>/Alternativa B/.test(x)),'Conservar la advertencia del catálogo NES sobre Economía B.');
 assert.equal(p.subjects.filter(s=>s.origin==='FO'&&s.year===4&&/historia.*orientad/i.test(s.name)).length,0,'Historia Orientada ya está prescrita por BA +15.');
 assert.equal(p.subjects.filter(s=>s.origin==='FO'&&s.year===4&&/tecnolog.*informaci.*orientad/i.test(s.name)).length,0,'TI Orientada ya está prescrita por BA +15.');
 const e=await loadV2ModalProfile({model:'ba15',orientation:'energia_sustentabilidad'});
 assert.deepEqual(e.foAlternatives,['A'],'Sin alternativa B no se ofrecen asignaturas inventadas.');
});

test('Técnica: todas las especialidades cargan seis niveles con formación técnico-específica', async()=>{
  const ids=(await readdir(new URL('../data/tecnica/priorizados/',import.meta.url))).filter(f=>f.endsWith('.json')).map(f=>f.slice(0,-5)).filter(id=>id!=='tecnologia_representacion');
  assert.ok(ids.length>=26);
  for(const id of ids){
    const p=await loadV2ModalProfile({model:'tecnica',specialty:id});
    assert.equal(p.levels,6,id);
    assert.equal(new Set(p.subjects.map(s=>s.year)).size,6,`${id}: faltan niveles`);
    assert.ok(p.subjects.some(s=>s.field==='formacion_tecnica_especifica'),`${id}: sin formación técnico-específica`);
    for(const y of [1,2,3,4,5]){
      assert.ok(p.subjects.some(s=>s.year===y&&(s.area==='Lengua Adicional'||/^(lengua adicional|ingl)/i.test(s.name))),`${id}: falta Lengua Adicional en ${y}.º`);
      assert.ok(p.contents.fg.some(c=>c.year===y&&c.area==='Lengua Adicional')||p.subjects.some(s=>s.year===y&&/ingl/i.test(s.name)),`${id}: sin contenidos de Lengua Adicional en ${y}.º`);
    }
  }
});
