import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ORIENTATIONS,createOrientationPackage} from '../src/integracion-curricular/bridge.js';
import {PVF_TABLE,PVF_SOURCE,PVF_RULESET,pvfReference,validatePvfProject} from '../src/integracion-curricular/proyecto-vinculacion-2026.mjs';
import {seedOfferStructure,setFoAlternative,assignPvfReference,foSubjectBank,validateOfferStructure,offerMapRows} from '../src/integracion-curricular/mapa-oferta.js';
const root='data/integracion-curricular/referencia-v2/';
const refs=Object.fromEntries([
 ['rules','reglas-v2.json'],['hours','horas-v2.json'],
 ['subjects','materias-v2.json'],['catalog','catalogo-orientaciones.json']
].map(([key,file])=>[key,JSON.parse(readFileSync(root+file,'utf8'))]));
const make=ids=>createOrientationPackage({
  legacyState:{schemaVersion:10,schoolName:'Institución ficticia',areas:{'Matemática':{groups:[]}}},
  schoolId:1001,orientationIds:ids
});
const project=(pack,id)=>pack.orientations[id].fo.spaces.find(s=>s.kind==='proyecto');
test('tabla documental completa: 16 orientaciones de la aplicación, ninguna omitida',()=>{
  assert.equal(PVF_TABLE.length,16);
  assert.equal(PVF_SOURCE.printedPage,11);
  assert.equal(PVF_SOURCE.pdfPage,12);
  assert.equal(PVF_RULESET,'pci-2026-10-05/pvf-bachillerato/1');
  assert.deepEqual(PVF_TABLE.map(x=>x.orientationId).sort(),ORIENTATIONS.map(x=>x.id).sort());
  for(const record of PVF_TABLE){
    assert.ok(record.A.name.length>2&&record.B.name.length>2);
    assert.ok(record.A.hours>=2&&record.A.hours<=4);
    assert.ok(record.B.hours>=2&&record.B.hours<=4);
  }
});
test('casos A/B distintos y horas de la tabla: Teatro, Literatura, Informática, Matemática/Física',()=>{
  const teatroA=pvfReference('arte_teatro','A'),teatroB=pvfReference('arte_teatro','B');
  assert.equal(teatroA.hours,4);assert.equal(teatroB.hours,3);
  assert.equal(teatroA.name,'Producción en artes escénicas y gestión cultural');
  assert.equal(teatroB.name,'Producción teatral y gestión cultural');
  const litA=pvfReference('literatura','A'),litB=pvfReference('literatura','B');
  assert.equal(litA.hours,3);assert.equal(litB.hours,4);
  assert.match(litA.name,/Mediación y\/o Promoción/);
  assert.equal(litB.name,'Proyecto de Mediación de la Lectura y la Escritura');
  assert.equal(pvfReference('informatica','A').name,'Proyectos de Producción');
  assert.equal(pvfReference('informatica','B').name,'Desarrollo de Proyectos de Producción');
  assert.equal(pvfReference('matematica_fisica','A').name,'Lógica y Filosofía de la Ciencia');
  assert.equal(pvfReference('matematica_fisica','B').name,'Ciencia en Contexto');
});
test('otras orientaciones: Economía, Sociales, Naturales, Energía y Agro',()=>{
  const eco=pvfReference('economia_administracion','A');
  assert.equal(eco.name,'Proyecto Organizacional');assert.equal(eco.hours,3);
  assert.deepEqual(pvfReference('ciencias_sociales_humanidades','A').hours,3);
  assert.equal(pvfReference('ciencias_naturales','B').hours,2);
  assert.equal(pvfReference('energia_sustentabilidad','A').name,'Proyecto: Consumidores/as y productores/as');
  assert.equal(pvfReference('agro_ambiente','B').name,'Espacio de integración teórico-práctico');
  assert.equal(pvfReference('turismo','B').hours,4);
});
test('cada PCI nuevo tiene un solo PVF anual en C9-C10, nunca dos proyectos',()=>{
  for(const {id} of ORIENTATIONS){
    const old=make([id]),before=JSON.stringify(old);
    const assigned=seedOfferStructure(old,id,refs);
    const p=project(assigned,id);
    const official=pvfReference(id,'A');
    assert.equal(assigned.orientations[id].fo.spaces.filter(x=>x.kind==='proyecto').length,1,id);
    assert.equal(p.members.length,1,id);
    assert.deepEqual(p.members[0],official,id);
    assert.equal(p.duration,'annual');assert.equal(p.year,5);
    assert.equal(p.startTerm,9);assert.equal(p.endTerm,10);
    assert.equal(JSON.stringify(old),before,'No debe modificar el paquete original');
    const map=offerMapRows(assigned,id);
    for(const term of [9,10]){
      assert.equal(map[term-1].fo.filter(s=>s.kind==='proyecto').length,1,id+' C'+term);
      assert.equal(map[term-1].fo.find(s=>s.kind==='proyecto').members[0].id,official.id);
    }
  }
});
test('cambiar alternativa actualiza solo el proyecto recién generado y respeta el origen',()=>{
  let pack=seedOfferStructure(make(['literatura','economia_administracion']),'literatura',refs);
  pack=seedOfferStructure(pack,'economia_administracion',refs);
  const before=JSON.stringify(pack);
  const converted=setFoAlternative(pack,'literatura','B');
  assert.equal(project(converted,'literatura').members[0].hours,4);
  assert.equal(project(pack,'literatura').members[0].hours,3);
  assert.equal(converted.orientations.literatura.fo.subjectAlternative,'B');
  assert.deepEqual(converted.orientations.economia_administracion,
    pack.orientations.economia_administracion);
  assert.equal(JSON.stringify(pack),before);
});
test('si el proyecto histórico tiene materia o trabajo previo, NUNCA sobrescribir',()=>{
  const id='arte_teatro',original=seedOfferStructure(make([id]),id,refs);
  const existing=structuredClone(original);
  project(existing,id).members=[{id:'legado',name:'Proyecto de la institución',hours:3}];
  const before=structuredClone(existing);
  assert.throws(()=>setFoAlternative(existing,id,'B'),/no coincide/);
  assert.throws(()=>assignPvfReference(existing,id),/no se reemplaza/i);
  assert.deepEqual(existing,before);
  const beforeReset=structuredClone(existing);
  assert.deepEqual(seedOfferStructure(existing,id,refs),beforeReset,'La inicialización no elimina proyectos históricos');
});
test('una escuela con proyecto original VACÍO puede incorporarlo explícitamente sin tocar otras áreas',()=>{
  const id='arte_teatro',original=seedOfferStructure(make([id]),id,refs);
  const historic=structuredClone(original);
  project(historic,id).members=[];
  const prev=structuredClone(historic);
  const revised=assignPvfReference(historic,id);
  assert.equal(project(revised,id).members[0].hours,4);
  assert.deepEqual(historic,prev);
  const right=assignPvfReference(revised,id);
  assert.deepEqual(right,revised);
});
test('comprobar obligatorio 5.º año, 2 términos, nombre y carga horaria',()=>{
  const id='arte_teatro',p=project(seedOfferStructure(make([id]),id,refs),id);
  assert.equal(validatePvfProject(p,{orientationId:id,alternative:'A'}).valid,true);
  assert.ok(!validatePvfProject({...p,members:[]},{orientationId:id}).valid);
  assert.ok(!validatePvfProject({...p,members:[{...p.members[0],hours:3}]},{orientationId:id}).valid);
  assert.ok(!validatePvfProject({...p,endTerm:9},{orientationId:id}).valid);
  assert.ok(!validatePvfProject({...p,members:[...p.members,...p.members]},{orientationId:id}).valid);
});
test('oferta incompleta conserva error de asignación, no declara proyecto no validado correcto',()=>{
  const id='economia_administracion',initial=seedOfferStructure(make([id]),id,refs);
  const modified=structuredClone(initial);
  project(modified,id).members=[];
  const check=validateOfferStructure(modified,id,refs);
  assert.ok(check.errors.some(x=>x.includes('Proyecto de Vinculación')));
  assert.equal(check.valid,false);
  const validPVF=validatePvfProject(project(initial,id),{orientationId:id,alternative:'A'});
  assert.equal(validPVF.valid,true);
});
test('la bolsa FO no reubica la materia anual PVF como laboratorio/taller',()=>{
  for(const id of ['economia_administracion','literatura','informatica']){
    for(const alt of ['A','B']){
      const proj=pvfReference(id,alt);
      const bank=foSubjectBank({orientationId:id,refs,alternative:alt});
      const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
      assert.equal(bank.subjects.filter(x=>x.year===5&&normalize(x.name)===normalize(proj.name)).length,0,
        id+' alternativa '+alt);
    }
  }
});

test('no cambiar alternativa sobre un Proyecto de Vinculación con planes o contenidos previos',()=>{
  const id='economia_administracion';
  const existing=seedOfferStructure(make([id]),id,refs);
  const prior=structuredClone(existing);
  project(prior,id).plans=[{id:'plan_histórico',stages:{evaluacion:{description:'No borrar'}}}];
  const before=structuredClone(prior);
  assert.throws(()=>setFoAlternative(prior,id,'B'),/Hay contenidos o planes/);
  assert.deepEqual(prior,before);
  assert.throws(()=>assignPvfReference(prior,id),/desarrollo pedagógico/);
});
