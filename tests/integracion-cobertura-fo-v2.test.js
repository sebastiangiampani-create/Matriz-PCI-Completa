import test from 'node:test';
import assert from 'node:assert/strict';
import {ORIENTATIONS} from '../src/integracion-curricular/bridge.js';
import {foGroups,makeFoDraft,saveFoSpace,getFoSpace} from '../src/integracion-curricular/desarrollo-fo-modelo.js';
import {foCoverageSnapshot} from '../src/integracion-curricular/cobertura-fo-v2.js';

const row=(id,block,axis='Eje A',o='Economía y Administración')=>({
  id,orientation:o,block,subject:block,axis,year:null,
  kind:/historia.*orientad|tecnolog/i.test(block)?'Materia':'Bloque'
});
const reference=[
  row('a','Organizaciones'),row('b','Organizaciones'),row('c','Economía'),
  row('d','Economía'),row('e','Historia orientada'),row('f','Tecnologías de la Información (orientada)'),
  row('other','Economía','Eje X','Matemática y Física')
];
const map={
  foTypes:{'3':{'5':'lab','6':'taller'},'4':{'7':'lab','8':'taller'}},
  placements:{'foN3-c5':['eco-1'],'foN3-c6':['eco-2'],
    'foN4-c7':['eco-3'],'foN4-c8':['eco-4'],
    'foLab5-c9':['eco-5'],'foLab5-c10':['eco-6'],
    'foTaller5-c9':['eco-7'],'foTaller5-c10':['eco-8'],
    'proyecto-n5':['eco-9']}
};
const groups=['laboratorios','talleres','proyecto'].flatMap(type=>foGroups(map,type));
function withItems(draft,slot,items,planItems=[],planIndex=0) {
 const group=groups.find(g=>g.id===slot);
 const state=getFoSpace(draft,group).data;
 state.items=items;
 state.plansBimestrales[planIndex].contentIds=planItems;
 return saveFoSpace(draft,state);
}
test('FO conserva denominador por trayectoria y no inventa cobertura anual por nivel',()=>{
 let draft=makeFoDraft('Economía y Administración');
 draft=withItems(draft,'foN3-c5',['a','b'],['a'],0);
 draft=withItems(draft,'foN4-c7',['a'],[],2);
 draft=withItems(draft,'foN3-c6',['c'],[],2);
 const snap=foCoverageSnapshot({rows:reference,orientationId:'economia_administracion',
   orientations:ORIENTATIONS,map,draft});
 assert.equal(snap.trajectory.total,6);
 assert.equal(snap.trajectory.used,3,'Se deduplican contenidos repetidos entre laboratorios');
 assert.equal(snap.trajectory.percent,50);
 assert.equal(snap.levelBasisAvailable,false);
 assert.deepEqual(snap.years.map(y=>y.used),[3,1,0]);
 assert.ok(snap.years.every(y=>y.level.total===null && y.level.percent===null));
 assert.equal(snap.spaces.length,9);
 assert.equal(snap.formatRows.find(x=>x.format==='laboratorios').spaceCount,4);
 assert.equal(snap.formatRows.find(x=>x.format==='talleres').spaceCount,4);
 assert.equal(snap.formatRows.find(x=>x.format==='proyecto').spaceCount,1);
 assert.ok(!snap.spaces.some(x=>x.ids.includes('other')));
 assert.deepEqual(snap.bySubject.filter(x=>x.kind==='Materia').map(x=>x.label),
   ['Historia orientada','Tecnologías de la Información (orientada)']);
});
test('cobertura de plan contra bolsa oficial y contra agrupamiento con IDs únicos',()=>{
 let draft=makeFoDraft('Economía y Administración');
 draft=withItems(draft,'foN3-c5',['a','b'],['a'],0);
 const snap=foCoverageSnapshot({rows:reference,orientationId:'economia_administracion',
   orientations:ORIENTATIONS,map,draft});
 const space=snap.spaces.find(s=>s.id==='foN3-c5');
 assert.equal(space.plans.length,2,'C5 incluye solo bimestres 1 y 2');
 const plan=space.plans[0];
 assert.equal(plan.used,1);
 assert.equal(plan.totalOfficial,6);
 assert.equal(plan.officialPercent,16.7);
 assert.equal(plan.groupingUsed,1);
 assert.equal(plan.groupingTotal,2);
 assert.equal(plan.groupingPercent,50);
 assert.equal(plan.byComponent.find(c=>c.label==='Organizaciones').groupingTotal,2);
 assert.equal(plan.byComponent.find(c=>c.label==='Organizaciones').groupingPercent,50);
 assert.equal(snap.spaces.find(s=>s.id==='foN3-c6').plans[0].number,3);
 assert.equal(snap.spaces.find(s=>s.id==='proyecto-n5').plans.length,4);
});
test('al trasladar o repetir contenidos en planes el agregado no los duplica',()=>{
 let draft=makeFoDraft('Economía y Administración');
 draft=withItems(draft,'foLab5-c9',['a','b'],['a','b'],0);
 draft=withItems(draft,'foLab5-c10',['b'],['b'],2);
 const s=foCoverageSnapshot({rows:reference,orientationId:'economia_administracion',
   orientations:ORIENTATIONS,map,draft});
 assert.equal(s.trajectory.used,2);
 assert.equal(s.trajectory.total,6);
 assert.equal(s.spaces.find(x=>x.id==='foLab5-c9').plans[0].used,2);
 assert.equal(s.spaces.find(x=>x.id==='foLab5-c10').plans[0].used,1);
});
