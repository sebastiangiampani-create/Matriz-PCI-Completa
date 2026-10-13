import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareReview,approveReview,summarizeSource} from '../src/integracion-curricular/revision-importacion-original.js';
const source={
 schoolName:'Escuela de prueba',
 areas:{
  'Ciencias Sociales':{groups:Array.from({length:12},(_,i)=>({
   id:'social-'+i,kind:'laboratory',startTerm:i+1,items:['historia-3'],
   plansBimestrales:[{number:1,objectives:'Comprender',stages:{indagacion:{description:'Explorar fuentes'}}}]
  }))},
  Matemática:{groups:[{id:'mat-1',items:['mat-1'],customExtra:{createdAt:'2026-01-01'},
    plansBimestrales:[{number:1,stages:{produccion:{description:'Proyecto'}}}]}]}
 }};
test('copia original intacta por orientación, preservando etapas y campos extra',()=>{
 const before=JSON.stringify(source);
 const a=prepareReview(source,'Economía y Administración',{socialOption:'A'});
 const b=prepareReview(source,'Matemática y Física',{socialOption:'B'});
 assert.equal(a.summary.groupCount,13);
 assert.equal(a.summary.plans,13);
 assert.equal(a.summary.sequences,13);
 assert.equal(a.warnings[0].type,'revisar-laboratorio');
 assert.equal(b.warnings.some(w=>w.type==='revisar-laboratorio'),false);
 a.source.areas.Matemática.groups[0].customExtra.createdAt='cambiado';
 assert.equal(JSON.stringify(source),before);
 assert.equal(b.source.areas.Matemática.groups[0].customExtra.createdAt,'2026-01-01');
 assert.deepEqual(summarizeSource(source).areas.map(a=>a.groups),[12,1]);
});
test('OK no persiste ni muta el original, y se bloquea si cambió',()=>{
 const draft=prepareReview(source,'Economía y Administración',{socialOption:'A'});
 const before=JSON.stringify(source);
 const ok=approveReview(draft,source);
 assert.equal(ok.approved,true);
 assert.equal(draft.approved,false);
 assert.equal(JSON.stringify(source),before);
 assert.throws(()=>approveReview(draft,{...source,schoolName:'Otro'}),/cambió/);
});
