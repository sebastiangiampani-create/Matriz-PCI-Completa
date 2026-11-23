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
const {nuevaDistribucionBa15,auditarDistribucionBa15}=await import('../src/ba15/ambientes-virtuales-105-2026.mjs');

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
 assert.ok(old.every(x=>x.id.startsWith('ba15-fo-')||x.id.startsWith('ba15-nes-fo-')),
  'Permanecen legibles los IDs históricos tanto de bloques FO como de materias NES A/B.');

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
 assert.equal(p.subjects.filter(s=>s.origin==='FO'&&!s.legacyReference&&s.year===4&&/historia.*orientad/i.test(s.name)).length,0,'Historia Orientada ya está prescrita por BA +15.');
 assert.equal(p.subjects.filter(s=>s.origin==='FO'&&!s.legacyReference&&s.year===4&&/tecnolog.*informaci.*orientad/i.test(s.name)).length,0,'TI Orientada ya está prescrita por BA +15.');
 const e=await loadV2ModalProfile({model:'ba15',orientation:'energia_sustentabilidad'});
 assert.deepEqual(e.foAlternatives,['A'],'Sin alternativa B no se ofrecen asignaturas inventadas.');
});

test('BA +15: cotejo automático de cuatro orientaciones con fuente NES y sumas 4/9/12 por alternativa',async()=>{
 const verified=['economia_administracion','ciencias_sociales_humanidades','turismo','educacion_fisica'];
 for(const orientation of verified){
  const p=await loadV2ModalProfile({model:'ba15',orientation});
  const records=p.foEvidenciaNes;
  const altA=p.foAlternatives.includes('A');
  const altB=p.foAlternatives.includes('B');
  assert.equal(altA,true,orientation+' sin alternativa A');
  assert.equal(altB,true,orientation+' sin alternativa B');
  assert.equal(p.foEvidenciaResumen.pendientes,0,orientation+' con carga NES sin fuente cotejada');
  for(const alt of ['A','B']){
   for(const [year,level,expected] of [[3,2,4],[4,3,9],[5,4,12]]){
    const record=records.find(r=>r.anio===year&&
     (r.alternativa===alt||(year===3&&r.alternativa==='comun')));
    assert.ok(record,orientation+' '+alt+' '+year+' sin cotejo');
    assert.equal(record.estado,'cotejado_fuente_primaria');
    assert.equal(record.sumaHorasNes,expected);
    assert.equal(record.coincideCupo,true);
    const subjects=p.subjects.filter(x=>x.origin==='FO'&&!x.legacyReference&&x.year===level&&
     (x.alternative===alt||x.alternative===null));
    assert.ok(subjects.length>0,orientation+' '+alt+' nivel '+level);
    assert.equal(subjects.reduce((acc,x)=>acc+x.sourceWeeklyHours,0),expected);
    assert.ok(subjects.every(x=>x.weeklyHours===null&&x.confirmedBa15Subject===false));
    assert.ok(subjects.every(x=>x.sourceHoursStatus==='nes_documentada'&&
     x.sourceUrl?.startsWith('https://buenosaires.gob.ar/')));
   }
  }
 }
});
test('BA +15: fuente NES corrige materias erróneas, sin reasignar IDs de borradores',async()=>{
 for(const orientacion of ['economia_administracion','ciencias_sociales_humanidades']){
  const p=await loadV2ModalProfile({model:'ba15',orientation:orientacion});
  const official=p.subjects.filter(x=>x.origin==='FO'&&x.year===3&&x.alternative==='B'&&!x.legacyReference);
  assert.ok(official.some(x=>x.name==='Psicología'||x.name==='Economía'));
  assert.ok(!official.some(x=>/Comunicaci[oó]n|Arte y sociedad|Teatro/i.test(x.name)),
   'El Anexo oficial no tiene materias de Comunicación/Artes en el 4.º de esta orientación');
  const old=p.subjects.filter(x=>x.origin==='FO'&&x.year===3&&x.alternative==='B'&&x.legacyReference);
  assert.ok(old.length>=2,'Se preservan referencias de asignaturas erróneas en mapas anteriores');
  assert.ok(old.every(x=>x.id.startsWith('ba15-nes-fo-')&&x.replacementSubjectId));
  assert.ok(p.foEvidenciaResumen.hayDiferencias);
 }
});
test('BA +15: Turismo y Educación Física distinguen A/B también en Nivel II',async()=>{
 const expectations=[
  ['turismo','Introducción al turismo','Turismo y sociedad'],
  ['educacion_fisica','Deportes abiertos y cerrados I','Deportes abiertos y cerrados']
 ];
 for(const [orientation,a,b] of expectations){
  const p=await loadV2ModalProfile({model:'ba15',orientation});
  const first=p.subjects.filter(x=>x.origin==='FO'&&x.year===2&&!x.legacyReference);
  assert.ok(first.some(x=>x.alternative==='A'&&x.name===a),orientation+' A incorrecta');
  assert.ok(first.some(x=>x.alternative==='B'&&x.name===b),orientation+' B incorrecta');
  assert.equal(first.some(x=>x.alternative===null),false,'Nivel II no es común para esta orientación');
  assert.equal(first.filter(x=>x.alternative==='A').reduce((n,x)=>n+x.sourceWeeklyHours,0),4);
  assert.equal(first.filter(x=>x.alternative==='B').reduce((n,x)=>n+x.sourceWeeklyHours,0),4);
  assert.ok(p.subjects.some(x=>x.year===2&&x.legacyReference&&x.alternative===null),
   'Los IDs de Nivel II anteriores deben conservarse como históricos');
 }
});
test('BA +15: las otras orientaciones siguen pendientes sin asignación artificial de horas',async()=>{
 const p=await loadV2ModalProfile({model:'ba15',orientation:'comunicacion'});
 assert.ok(p.foEvidenciaNes.some(x=>x.estado==='pendiente_documental'));
 assert.equal(p.foEvidenciaResumen.verificadas,0);
 assert.ok(p.subjects.filter(x=>x.sourceType==='asignatura_nes').every(x=>
  x.sourceWeeklyHours===null&&x.weeklyHours===null));
});

function completarHorasVirtualesValidadas(){
 const cfg=nuevaDistribucionBa15();
 cfg.aplicacion='aplica_anexo_ii_turno_noche';
 for(let t=1;t<=8;t++){
  let pendientes=11;
  const espacios=BA15_NIVELES[Math.ceil(t/2)-1],campos={};
  for(const m of espacios){
   const max=(m.formato==='troncal')?Math.floor(m.horas*0.2):
    (['Educación Física','Tutoría'].includes(m.nombre)?0:m.horas);
   const asignadas=Math.min(max,pendientes);
   campos[m.nombre]=asignadas;
   pendientes-=asignadas;
  }
  assert.equal(pendientes,0,'El Nivel '+Math.ceil(t/2)+' debe admitir 11 HC asincrónicas.');
  cfg.distribucion['c'+t]=campos;
 }
 return cfg;
}
test('BA +15: 27 horas presenciales + 11 asincrónicas por C1-C8, solo si Anexo II aplica',()=>{
 const empty=nuevaDistribucionBa15();
 const pending=auditarDistribucionBa15(empty);
 assert.equal(pending.aplica,false);
 assert.equal(pending.errores.length,0);
 assert.ok(pending.advertencias.some(x=>/Anexo II/.test(x)));
 empty.aplicacion='no_alcanzado';
 const absent=auditarDistribucionBa15(empty);
 assert.equal(absent.aplica,false);
 assert.equal(absent.errores.length,0);
 const valid=auditarDistribucionBa15(completarHorasVirtualesValidadas());
 assert.equal(valid.aplica,true);
 assert.equal(valid.completa,true);
 assert.deepEqual(valid.errores,[]);
 assert.equal(valid.periodos.length,8);
 assert.ok(valid.periodos.every(x=>x.presenciales===27&&x.asincronicas===11));
});
test('BA +15: no superar virtualidad en troncales, Educación Física ni Tutoría',()=>{
 const initial=completarHorasVirtualesValidadas();
 const tooVirtual=structuredClone(initial);
 tooVirtual.distribucion.c1['Matemática']=2;
 let audit=auditarDistribucionBa15(tooVirtual);
 assert.ok(audit.errores.some(x=>/Matemática.*80%/.test(x)));
 const ef=structuredClone(initial);
 ef.distribucion.c3['Educación Física']=1;
 audit=auditarDistribucionBa15(ef);
 assert.ok(audit.errores.some(x=>/Educación Física.*presencialidad completa/.test(x)));
 const tutela=structuredClone(initial);
 tutela.distribucion.c1['Tutoría']=1;
 audit=auditarDistribucionBa15(tutela);
 assert.ok(audit.errores.some(x=>/Tutoría.*presencialidad completa/.test(x)));
});
test('BA +15: detectar incompletos o total virtual incorrecto sin alterar la distribución original',()=>{
 const valid=completarHorasVirtualesValidadas();
 const snapshot=JSON.stringify(valid);
 const miss=structuredClone(valid);
 delete miss.distribucion.c5['Matemática'];
 assert.ok(auditarDistribucionBa15(miss).errores.some(x=>/C5.*Matemática/.test(x)));
 const wrong=structuredClone(valid);
 wrong.distribucion.c8['Materias de la orientación']=(wrong.distribucion.c8['Materias de la orientación']||0)+1;
 assert.ok(auditarDistribucionBa15(wrong).errores.some(x=>/C8.*27 HC/.test(x)));
 assert.equal(JSON.stringify(valid),snapshot,'La auditoría no puede modificar los borradores.');
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
