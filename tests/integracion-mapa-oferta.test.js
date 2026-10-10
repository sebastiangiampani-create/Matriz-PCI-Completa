import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOrientationPackage,chooseFgMode} from '../src/integracion-curricular/bridge.js';
import {
  seedOfferStructure,foSubjectBank,setFoAlternative,assignFoSubject,
  moveFoSpace,validateOfferStructure,offerMapRows,
  stageFoContent,stageFgContent,appendFgContent,confirmFoContentAfterOffer
} from '../src/integracion-curricular/mapa-oferta.js';

const base='data/integracion-curricular/referencia-v2/';
const refs=Object.fromEntries([
  ['rules','reglas-v2.json'],['hours','horas-v2.json'],
  ['subjects','materias-v2.json'],['catalog','catalogo-orientaciones.json']
].map(([k,f])=>[k,JSON.parse(readFileSync(base+f,'utf8'))]));
function legacy(){
  return {schemaVersion:10,schoolName:'Escuela inventada',areas:{
    'Ciencias Sociales':{groups:[{
      id:'social3',kind:'laboratory',level:3,startTerm:5,endTerm:5,
      name:'Laboratorio Sociales 3.º',
      items:['matrix-economia','matrix-historia'],
      plansBimestrales:[{number:1,name:'Secuencia original',
        contentIds:['matrix-economia'],objectives:'Analizar economías',
        stages:{
          punto_partida:{description:'Preguntar',activities:'Pensar'},
          indagacion:{description:'Investigar',activities:'Leer'},
          produccion:{description:'Construir',activities:'Debatir'},
          evaluacion:{description:'Revisar',activities:'Argumentar'}
        }}]
    }]},
    'Matemática':{groups:[{
      id:'mat3',kind:'trunk',name:'Troncal Matemática 3',
      level:3,startTerm:5,endTerm:6,items:[],plansBimestrales:[]
    }]}
  }};
}
function make(){
  let pack=createOrientationPackage({
    legacyState:legacy(),schoolId:1001,
    orientationIds:['economia_administracion','ciencias_naturales','ciencias_sociales_humanidades']
  });
  pack=chooseFgMode(pack,'economia_administracion','revisar');
  return seedOfferStructure(pack,'economia_administracion',refs);
}
test('copia la oferta V2 con 4 laboratorios, 4 talleres y un proyecto anual C9-C10',()=>{
  const p=make(),w=p.orientations.economia_administracion;
  const spaces=w.fo.spaces;
  assert.equal(spaces.length,9);
  assert.equal(spaces.filter(x=>x.kind==='laboratorio').length,4);
  assert.equal(spaces.filter(x=>x.kind==='taller').length,4);
  assert.equal(spaces.filter(x=>x.kind==='proyecto').length,1);
  for(const year of [3,4,5]){
    const expected=year===5?2:1;
    assert.equal(spaces.filter(s=>s.year===year&&s.kind==='laboratorio').length,expected);
    assert.equal(spaces.filter(s=>s.year===year&&s.kind==='taller').length,expected);
  }
  assert.deepEqual(spaces.find(x=>x.kind==='proyecto')?.[ 'startTerm' ],9);
  assert.equal(spaces.find(x=>x.kind==='proyecto').endTerm,10);
  assert.equal(w.fo.subjectAlternative,'A');
  assert.deepEqual(p.orientations.ciencias_naturales.fo.spaces,[]);
  assert.equal(p.orientations.economia_administracion.fg.areas['Ciencias Sociales'].groups[0].plansBimestrales[0].stages.produccion.description,'Construir');
});
test('inicializar oferta una segunda vez no borra asignaciones ni modifica matriz',()=>{
  const p=make(),q=seedOfferStructure(p,'economia_administracion',refs);
  assert.deepEqual(p,q);
  assert.deepEqual(legacy(),legacy());
});
test('la bolsa FO ofrece materias oficiales por nivel y alternativa con HC',()=>{
  const b=foSubjectBank({orientationId:'economia_administracion',refs});
  assert.ok(b.subjects.some(x=>x.year===3&&x.name==='Organizaciones'&&x.hours===4));
  assert.ok(b.subjects.some(x=>x.year===4&&x.name==='Economía'&&x.hours===3));
  assert.ok(b.subjects.some(x=>x.year===5&&x.name==='Derecho'&&x.hours===3));
  assert.equal(b.subjects.filter(s=>s.year===3).length,1);
});
test('arrastre de materia FO verifica nivel, límites y mantiene mapa institucional',()=>{
  const p=make();
  const b=foSubjectBank({orientationId:'economia_administracion',refs});
  const y3=b.subjects.find(x=>x.year===3);
  assert.throws(()=>assignFoSubject(p,{
    orientationId:'economia_administracion',spaceId:'fo-laboratorio-4-1',
    subjectId:y3.id,refs
  }),/entre niveles/);
  const updated=assignFoSubject(p,{
    orientationId:'economia_administracion',spaceId:'fo-laboratorio-3-1',
    subjectId:y3.id,refs
  });
  assert.equal(updated.orientations.economia_administracion.fo.spaces
    .find(s=>s.id==='fo-laboratorio-3-1').members.length,1);
  assert.equal(p.orientations.economia_administracion.fo.spaces
    .find(s=>s.id==='fo-laboratorio-3-1').members.length,0);
  assert.equal(updated.orientations.economia_administracion.fg.areas['Ciencias Sociales']
    .groups[0].plansBimestrales[0].stages.evaluacion.description,'Revisar');
});
test('una materia anual de FO puede replicarse en el cuatrimestre par, sin duplicar el mismo C',()=>{
  const p=make(),b=foSubjectBank({orientationId:'economia_administracion',refs});
  const y5=b.subjects.find(x=>x.year===5&&x.name==='Derecho');
  assert.ok(y5);
  const placed=assignFoSubject(p,{
    orientationId:'economia_administracion',spaceId:'fo-laboratorio-5-1',
    subjectId:y5.id,refs
  });
  const rows=placed.orientations.economia_administracion.fo.spaces;
  assert.ok(rows.find(x=>x.id==='fo-laboratorio-5-1').members.some(x=>x.id===y5.id));
  assert.ok(rows.find(x=>x.id==='fo-laboratorio-5-2').members.some(x=>x.id===y5.id&&x.mirroredFrom));
  assert.throws(()=>assignFoSubject(placed,{
    orientationId:'economia_administracion',spaceId:'fo-taller-5-1',
    subjectId:y5.id,refs
  }),/mismo cuatrimestre/);
});
test('las asignaciones parciales no se declaran validadas como PCI',()=>{
  const p=make(),status=validateOfferStructure(p,'economia_administracion',refs);
  assert.equal(status.valid,false);
  assert.equal(status.foSpaces,9);
  assert.ok(status.errors.some(x=>x.includes('mínimo')));
  assert.ok(status.warnings.some(x=>x.includes('homologar')));
  assert.equal(status.fgUnchanged,true);
});
test('mover formato FO se limita a C del mismo nivel y no cambia secuencias',()=>{
  const p=make();
  const moved=moveFoSpace(p,{orientationId:'economia_administracion',
    spaceId:'fo-laboratorio-3-1',targetTerm:6});
  assert.equal(moved.orientations.economia_administracion.fo.spaces
    .find(x=>x.id==='fo-laboratorio-3-1').term,6);
  assert.equal(p.orientations.economia_administracion.fo.spaces
    .find(x=>x.id==='fo-laboratorio-3-1').term,5);
  assert.throws(()=>moveFoSpace(p,{orientationId:'economia_administracion',
    spaceId:'fo-laboratorio-3-1',targetTerm:9}),/mismo nivel/);
  assert.throws(()=>moveFoSpace(p,{orientationId:'economia_administracion',
    spaceId:'fo-proyecto-5-1',targetTerm:10}),/permanece/);
  const map=offerMapRows(moved,'economia_administracion');
  assert.equal(map.length,10);
  assert.ok(map[5].fo.some(x=>x.id==='fo-laboratorio-3-1'));
  assert.ok(map[4].fg.some(x=>x.id==='social3'));
});
test('arrastrar contenido FO queda provisional hasta validar Mapa Oferta',()=>{
  const p=make(),original=structuredClone(p);
  const revised=stageFoContent(p,{
    orientationId:'economia_administracion',spaceId:'fo-laboratorio-3-1',
    contentId:'fo:block:1',foRows:[{id:'fo:block:1',text:'Contenido de muestra'}]
  });
  const space=revised.orientations.economia_administracion.fo.spaces.find(x=>x.id==='fo-laboratorio-3-1');
  assert.deepEqual(space.provisionalContentIds,['fo:block:1']);
  assert.deepEqual(space.contentIds,[]);
  assert.deepEqual(p,original);
  assert.throws(()=>stageFoContent(p,{
    orientationId:'economia_administracion',spaceId:'fo-laboratorio-3-1',
    contentId:'no-oficial',foRows:[]
  }),/no identificado/);
});
test('arrastrar contenido Matriz se prepara y solo se incorpora tras verificar el año',()=>{
  const p=make(),original=legacy();
  const matrixRows=[{id:'extra',area:'Ciencias Sociales',subject:'Economía',text:'Nuevo contenido'}];
  const reference=[{id:'v2-extra',year:3,area:'Ciencias Sociales',subject:'Economía',text:'Nuevo contenido'}];
  const waiting=stageFgContent(p,{
    orientationId:'economia_administracion',area:'Ciencias Sociales',groupId:'social3',
    contentId:'extra',matrixRows
  });
  const before=waiting.orientations.economia_administracion.fg.areas['Ciencias Sociales'].groups[0];
  assert.ok(before.provisionalContentIds.includes('extra'));
  assert.ok(!before.items.includes('extra'));
  assert.throws(()=>appendFgContent(waiting,{
    orientationId:'economia_administracion',area:'Ciencias Sociales',groupId:'social3',
    contentId:'extra',matrixRows,v2FgRows:reference.map(x=>({...x,year:4}))
  }),/Revisar homologación/);
  const after=appendFgContent(waiting,{
    orientationId:'economia_administracion',area:'Ciencias Sociales',groupId:'social3',
    contentId:'extra',matrixRows,v2FgRows:reference
  });
  const changed=after.orientations.economia_administracion.fg.areas['Ciencias Sociales'].groups[0];
  assert.ok(changed.items.includes('extra'));
  assert.ok(!changed.provisionalContentIds.includes('extra'));
  assert.deepEqual(changed.plansBimestrales,before.plansBimestrales);
  assert.deepEqual(original,legacy());
  assert.ok(!after.orientations.ciencias_naturales.fg.areas['Ciencias Sociales'].groups[0].items.includes('extra'));
  const again=appendFgContent(after,{
    orientationId:'economia_administracion',area:'Ciencias Sociales',groupId:'social3',
    contentId:'extra',matrixRows,v2FgRows:reference
  });
  assert.equal(again.orientations.economia_administracion.fg.areas['Ciencias Sociales'].groups[0].items.filter(x=>x==='extra').length,1);
});
test('FO no confirma contenidos mientras el Mapa de la Oferta sea incompleto',()=>{
  const p=make();
  assert.throws(()=>confirmFoContentAfterOffer(p,{
    orientationId:'economia_administracion',refs,
    foRows:[{id:'fo-test',orientation:'Economía y Administración',text:'Contenido'}]
  }),/No se confirma contenido FO/);
});

test('cambiar alternativa se bloquea si las materias FO ya fueron compuestas',()=>{
  const p=make(),q=setFoAlternative(p,'economia_administracion','B');
  assert.equal(q.orientations.economia_administracion.fo.subjectAlternative,'B');
  const bank=foSubjectBank({orientationId:'economia_administracion',refs});
  const withOne=assignFoSubject(p,{
    orientationId:'economia_administracion',spaceId:'fo-laboratorio-3-1',subjectId:bank.subjects[0].id,refs
  });
  assert.throws(()=>setFoAlternative(withOne,'economia_administracion','B'),/revisar/);
});
