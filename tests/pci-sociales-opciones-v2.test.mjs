import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateState} from '../pci-model.js';
import {
 projectSocialGroupsForPci,blankComposition,selectSocialOption,withComposition
} from '../src/integracion-curricular/constructor-mapa-unificado.mjs';
import {projectMediaWorkspaceForFinalValidation}
 from '../src/normativa/adaptador-mapa-media-20261117.mjs';
const original=()=>migrateState({}).areas['Ciencias Sociales'].groups;
const terms=groups=>groups.filter(x=>!x.excludedFromPci).map(x=>Number(x.startTerm));
const id={schoolId:1017,pciId:'pci-sociales',orientationId:'turismo'};
test('Sociales: 12 laboratorios se muestran dos en C5 y dos en C6, no en C7 duplicado',()=>{
 const groups=original(),snap=structuredClone(groups);
 const result=projectSocialGroupsForPci(groups,12);
 assert.equal(result.conflicts.length,0);
 assert.deepEqual(terms(result.groups).sort((a,b)=>a-b),
  [1,2,3,4,5,5,6,6,7,8,9,10]);
 assert.deepEqual(groups,snap,'La FG histórica original no se modifica');
});
test('Sociales: opción de 10 laboratorios descarta solo plantillas duplicadas vacías',()=>{
 const groups=original(),before=structuredClone(groups);
 const result=projectSocialGroupsForPci(groups,10);
 assert.equal(result.conflicts.length,0);
 assert.deepEqual(terms(result.groups).sort((a,b)=>a-b),[1,2,3,4,5,6,7,8,9,10]);
 assert.deepEqual(groups,before);
});
test('Sociales: una escuela con C7 histórico trabajado nunca pierde contenidos ni planes',()=>{
 const groups=original(),extra=groups.filter(x=>Number(x.startTerm)===7).at(-1);
 extra.items=['contenido-escolar-historico'];
 extra.plansBimestrales=[{name:'Plan histórico',objectives:'Objetivos escritos'}];
 const snapshot=structuredClone(groups);
 for(const option of [10,12]){
  const projected=projectSocialGroupsForPci(groups,option);
  assert.ok(projected.conflicts.length>0);
  assert.ok(projected.groups.some(g=>g.id===extra.id&&!g.excludedFromPci));
  assert.deepEqual(groups,snapshot);
 }
});
test('El selector 10/12 queda aislado por orientación, escuela y PCI',()=>{
 const initial=blankComposition(id);
 const altered=selectSocialOption(initial,12);
 assert.equal(altered.socialOption,12);assert.equal(initial.socialOption,null);
 assert.throws(()=>selectSocialOption(initial,11),/10 o 12/);
 const ws={orientations:{turismo:{fg:{areas:{'Ciencias Sociales':{groups:original()}}},
  fo:{spaces:[]}}}};
 const after=withComposition(ws,{school_id:1017,pci_id:'pci-sociales',
  orientation_id:'turismo'},altered);
 assert.equal(after.orientations.turismo.fo.composicionFgV2.socialOption,12);
 assert.equal(ws.orientations.turismo.fo.composicionFgV2,undefined);
 const projected=projectMediaWorkspaceForFinalValidation(after,'turismo');
 const socials=projected.spaces.filter(x=>x.format==='laboratorio_social');
 assert.equal(socials.length,12);
 assert.deepEqual(socials.filter(x=>x.year===3).map(x=>x.term).sort((a,b)=>a-b),
  [5,5,6,6]);
});
