import test from 'node:test';
import assert from 'node:assert/strict';
import {foGroups,FO_STAGES,makeFoDraft,getFoSpace,saveFoSpace,orphanedSpaces}
  from '../src/integracion-curricular/desarrollo-fo-modelo.js';
const offer={
 foTypes:{'3':{'5':'lab','6':'taller'},'4':{'7':'taller','8':'lab'}},
 placements:{
  'foN3-c5':['fo-economia-administracion-3-0'],
  'foN3-c6':['fo-economia-administracion-3-1'],
  'proyecto-n5':['fo-economia-administracion-5-0']
 }
};
test('FO abre desarrollo en laboratorios/talleres/proyecto, con asignación por año',()=>{
 const l=foGroups(offer,'laboratorios'),t=foGroups(offer,'talleres'),p=foGroups(offer,'proyecto');
 assert.equal(l.length,4);
 assert.equal(t.length,4);
 assert.equal(p.length,1);
 assert.equal(p[0].year,5);
 assert.equal(p[0].term,null);
 assert.equal(p[0].id,'proyecto-n5');
 assert.deepEqual(l.filter(x=>x.year===3).map(x=>x.id),['foN3-c5']);
});
test('planes y cuatro etapas permanecen separados por orientación, sin alterar oferta',()=>{
 const before=JSON.stringify(offer);
 const eco=makeFoDraft('Economía y Administración');
 const project=foGroups(offer,'proyecto')[0];
 const item=getFoSpace(eco,project);
 assert.equal(item.data.plansBimestrales.length,4);
 assert.deepEqual(Object.keys(item.data.plansBimestrales[0].stages),FO_STAGES.map(s=>s.id));
 item.data.items=['fov96:00112233'];
 item.data.plansBimestrales[2].objectives='Enseñar a investigar';
 item.data.plansBimestrales[2].stages.evaluacion.description='Rúbrica de proyecto';
 const persisted=saveFoSpace(eco,item.data);
 assert.equal(eco.spaces[project.id],undefined);
 assert.equal(persisted.spaces[project.id].plansBimestrales[2].stages.evaluacion.description,'Rúbrica de proyecto');
 assert.equal(JSON.stringify(offer),before);
 assert.equal(makeFoDraft('Matemática y Física').spaces[project.id],undefined);
 assert.throws(()=>makeFoDraft('Matemática y Física',persisted),/otra orientación/);
});
test('no elimina desarrollos cuando la escuela modifica el Mapa de la Oferta',()=>{
 const draft=makeFoDraft('Economía y Administración');
 const prepared=saveFoSpace(draft,getFoSpace(draft,foGroups(offer,'laboratorios')[0]).data);
 const changed={foTypes:{'3':{'5':'taller','6':'lab'}},placements:offer.placements};
 assert.deepEqual(orphanedSpaces(prepared,changed),['foN3-c5'].filter(x=>
   !foGroups(changed,'laboratorios').some(g=>g.id===x)&&
   !foGroups(changed,'talleres').some(g=>g.id===x)));
 assert.equal(prepared.spaces['foN3-c5']?.year,3);
 const mismatched=getFoSpace(prepared,foGroups(changed,'talleres').find(g=>g.id==='foN3-c5'));
 assert.equal(mismatched.needsReview,true);
});
