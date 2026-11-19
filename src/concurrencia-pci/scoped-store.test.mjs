import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryScopedStore, VERSIONS, stageHistoricalAreas, overlayHistoricalAreas } from './scoped-store.mjs';

const scope = (area, schoolId = 1001, baseVersion = VERSIONS.FG_HISTORICA) => ({
 schoolId, component:'fg', orientationId:'sociales', processId:'proceso-2026',
 kind:'area', scopeId:area, baseVersion
});
const actor = (id, schoolId=1001, orientations=['sociales']) => ({
 verified:true,id,grants:[{schoolId,orientations,permissions:['pci.view','pci.edit']}]
});
const areas = Object.freeze({
 'Ciencias Sociales': { groups:[{id:'s1', items:['h-1'], plansBimestrales:[{number:1,stages:{inicio:{activity:'Lectura'}}}]}]},
 'Ciencias Naturales': { groups:[{id:'n1',items:['b-1'],plansBimestrales:[{number:1,stages:{inicio:{activity:'Experimento'}}}]}]}
});

test('Sociales y Naturales editan simultáneamente sin pisarse',async()=>{
 const store=new MemoryScopedStore();
 const s=scope('Ciencias Sociales'),n=scope('Ciencias Naturales');
 const [a,b]=await Promise.all([
  store.save(actor('docente-sociales'),s,areas['Ciencias Sociales'],0),
  store.save(actor('docente-naturales'),n,areas['Ciencias Naturales'],0)
 ]);
 assert.equal(a.revision,1);assert.equal(b.revision,1);
 const a2=await store.save(actor('docente-sociales'),s,{...a.document,observacion:'Nuevo plan'},1);
 const natural=await store.read(actor('docente-naturales'),n);
 assert.equal(a2.revision,2);
 assert.deepEqual(natural.document,areas['Ciencias Naturales']);
 assert.equal(store.history.length,3);
});

test('dos docentes en el mismo espacio: el segundo recibe 409',async()=>{
 const store=new MemoryScopedStore(),s=scope('Ciencias Sociales');
 await store.save(actor('A'),s,{groups:[{id:'a'}]},0);
 const outcomes=await Promise.allSettled([
  store.save(actor('A'),s,{groups:[{id:'a'}, {id:'c'}]},1),
  store.save(actor('B'),s,{groups:[{id:'a'},{id:'d'}]},1)
 ]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 const failure=outcomes.find(x=>x.status==='rejected');
 assert.equal(failure.reason.status,409);
 assert.equal((await store.read(actor('A'),s)).revision,2);
});

test('separación por escuela y orientación obligatoria',async()=>{
 const store=new MemoryScopedStore();
 await store.save(actor('A'),scope('Ciencias Sociales'),{groups:[]},0);
 await assert.rejects(store.read(actor('A'),scope('Ciencias Sociales',1002)),{status:403});
 await assert.rejects(store.save(actor('A',1001,['naturales']),scope('Ciencias Sociales'),{},1),{status:403});
});

test('preserva snapshot FG histórico y planes idénticos',async()=>{
 const original={schemaVersion:10,schoolName:'Prueba',areas:structuredClone(areas)};
 const snapshot=structuredClone(original);
 const prepared=stageHistoricalAreas(original,{schoolId:1001,orientationId:'sociales',processId:'proceso-2026',baseVersion:VERSIONS.FG_HISTORICA});
 assert.equal(prepared.length,2);
 assert.deepEqual(original,snapshot);
 const rebuilt=overlayHistoricalAreas(original,prepared.map(x=>({scope:x.scope,document:x.document})),
  {schoolId:1001,orientationId:'sociales',processId:'proceso-2026',baseVersion:VERSIONS.FG_HISTORICA});
 assert.deepEqual(rebuilt,original);
 assert.deepEqual(rebuilt.areas['Ciencias Sociales'].groups[0].plansBimestrales,original.areas['Ciencias Sociales'].groups[0].plansBimestrales);
});

test('impide alterar versión curricular del proceso',async()=>{
 const store=new MemoryScopedStore(),s=scope('Ciencias Sociales');
 await store.save(actor('A'),s,{groups:[]},0);
 await assert.rejects(store.save(actor('A'),scope('Ciencias Sociales',1001,VERSIONS.FG_VIGENTE),{groups:[]},1),{status:409});
});

test('un identificador de componente FO requiere versión FO y orientación',async()=>{
 const store=new MemoryScopedStore();
 await assert.rejects(store.save(actor('A'),{...scope('Historia Orientada'),component:'fo',kind:'space'}, {},0),{status:400});
 await assert.rejects(store.save(actor('A'),{...scope('Historia Orientada'),component:'fo',kind:'space',baseVersion:VERSIONS.FO_VIGENTE,orientationId:'_general'}, {},0),{status:400});
});

test('no permite representación vacía de permisos ni datos escolares completos',async()=>{
 const store=new MemoryScopedStore();
 await assert.rejects(store.save({verified:false,id:'A'},scope('Ciencias Sociales'),{},0),{status:401});
 await assert.rejects(store.save(actor('A'),scope('Ciencias Sociales'),[],0),{status:400});
});
