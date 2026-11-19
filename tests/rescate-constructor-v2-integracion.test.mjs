import test from 'node:test';
import assert from 'node:assert/strict';
import {historicGroups,blankComposition,promoteHistoricGroup,placeSubject}
 from '../src/integracion-curricular/constructor-mapa-unificado.mjs';
import {projectMediaWorkspaceForFinalValidation}
 from '../src/normativa/adaptador-mapa-media-20261117.mjs';
import {emptyFgAreaUnit,inheritFgComposition} from '../src/pci-fase-desarrollo-fg.mjs';
import {moveFoSpace} from '../src/integracion-curricular/mapa-oferta.js';
const schoolId=1017,pciId='pci-rescate-v2',orientationId='comunicacion';
const pci={school_id:schoolId,pci_id:pciId,orientation_id:orientationId,
 legacy_sha256:'a'.repeat(64)};
const blank={id:'social-original',kind:'laboratory',level:3,startTerm:5,endTerm:5,
 name:'Sociales C5',items:[],plansBimestrales:[]};
function workspace(group=blank){
 const state={version:'pci-integracion/1',orientations:{[orientationId]:{
  fg:{areas:{'Ciencias Sociales':{groups:[structuredClone(group)]}}},
  fo:{spaces:[],composicionFgV2:blankComposition({
   schoolId,pciId,orientationId
  })}
 }}};
 return state;
}
const historia={id:'fg:3:historia',name:'Historia',component:'FG',
 area:'Ciencias Sociales',year:3,hours:2};
test('Una escuela nueva edita copia de plantilla FG sin reemplazar la FG original',()=>{
 const ws=workspace(),snapshot=structuredClone(ws);
 const original=historicGroups(ws,orientationId)[0];
 assert.equal(original.hasWork,false);
 let proposal=promoteHistoricGroup(blankComposition({schoolId,pciId,orientationId}),original);
 proposal=placeSubject(proposal,{groupId:original.id,subject:historia});
 const revised=structuredClone(ws);
 revised.orientations[orientationId].fo.composicionFgV2=proposal;
 const projection=projectMediaWorkspaceForFinalValidation(revised,orientationId);
 assert.equal(projection.spaces.filter(x=>x.id==='fg:Ciencias Sociales:social-original').length,1);
 const slot=projection.spaces.find(x=>x.id==='fg:Ciencias Sociales:social-original');
 assert.deepEqual(slot.subjectIds,[historia.id]);
 assert.equal(slot.origin,'copia_fg_revisada_sin_modificar_origen');
 assert.deepEqual(ws,snapshot);
 assert.deepEqual(revised.orientations[orientationId].fg.areas,ws.orientations[orientationId].fg.areas);
});
test('Una FG ya trabajada permanece protegida en la Fase 1',()=>{
 const worked={...blank,items:['contenido-nuevo']};
 const ws=workspace(worked),state=blankComposition({schoolId,pciId,orientationId});
 const existing=historicGroups(ws,orientationId)[0];
 assert.equal(existing.hasWork,true);
 assert.throws(()=>promoteHistoricGroup(state,existing),/planes trabajados|contiene contenidos/);
 assert.deepEqual(ws.orientations[orientationId].fg.areas['Ciencias Sociales'].groups[0],worked);
});
test('Un agrupamiento nuevo se incluye en la validación final, sin eliminar los anteriores',()=>{
 const ws=workspace(),snapshot=structuredClone(ws.orientations[orientationId].fg);
 const doc=ws.orientations[orientationId].fo.composicionFgV2;
 doc.groups.push({id:'ag-nuevo',area:'Ciencias Sociales',year:3,term:6,endTerm:6,
  kind:'laboratorio',members:[historia]});
 const projection=projectMediaWorkspaceForFinalValidation(ws,orientationId);
 assert.equal(projection.spaces.filter(x=>x.format==='laboratorio_social').length,2);
 assert.ok(projection.spaces.some(x=>x.id==='propuesto:ag-nuevo'));
 assert.deepEqual(ws.orientations[orientationId].fg,snapshot);
});
test('La Fase 2 completa solo una plantilla sin trabajo y preserva su identidad',()=>{
 const source=workspace();
 let proposed=promoteHistoricGroup(blankComposition({schoolId,pciId,orientationId}),
  historicGroups(source,orientationId)[0]);
 proposed=placeSubject(proposed,{groupId:blank.id,subject:historia});
 const unit=emptyFgAreaUnit(pci,'Ciencias Sociales');
 unit.groups.push(structuredClone(blank));
 const original=structuredClone(unit);
 const result=inheritFgComposition({unit,composition:proposed,pci,area:'Ciencias Sociales'});
 assert.equal(result.changed,true);
 assert.deepEqual(result.updated,['Sociales C5']);
 assert.deepEqual(result.unit.groups[0].curricularSubjects.map(m=>m.id),[historia.id]);
 assert.deepEqual(unit,original);
});
test('La Fase 2 no reescribe un contenido ni un plan histórico al conciliar',()=>{
 const source=workspace();
 let proposal=promoteHistoricGroup(blankComposition({schoolId,pciId,orientationId}),
  historicGroups(source,orientationId)[0]);
 proposal=placeSubject(proposal,{groupId:blank.id,subject:historia});
 const unit=emptyFgAreaUnit(pci,'Ciencias Sociales');
 unit.groups.push({...structuredClone(blank),items:['contenido-historico'],
  plansBimestrales:[{name:'Plan 1',objectives:'Trabajo histórico'}]});
 const original=structuredClone(unit);
 const result=inheritFgComposition({unit,composition:proposal,pci,area:'Ciencias Sociales'});
 assert.equal(result.changed,false);
 assert.ok(result.conflicts.length>0);
 assert.deepEqual(result.unit,original);
 assert.deepEqual(unit,original);
});

test('V2: los formatos FO cambian de cuatrimestre por drag sin salir del nivel ni modificar FG',()=>{
 const original=workspace();
 original.orientations[orientationId].fo.spaces=[
  {id:'fo-lab-3',kind:'laboratorio',year:3,term:5,startTerm:5,endTerm:5},
  {id:'fo-taller-3',kind:'taller',year:3,term:6,startTerm:6,endTerm:6},
  {id:'fo-pvf-5',kind:'proyecto',year:5,term:9,startTerm:9,endTerm:10}
 ];
 const snapshot=structuredClone(original);
 const moved=moveFoSpace(original,{orientationId,spaceId:'fo-lab-3',targetTerm:6});
 assert.equal(moved.orientations[orientationId].fo.spaces[0].term,6);
 assert.deepEqual(original,snapshot);
 assert.deepEqual(moved.orientations[orientationId].fg,original.orientations[orientationId].fg);
 assert.throws(()=>moveFoSpace(original,{orientationId,spaceId:'fo-lab-3',targetTerm:7}),/mismo nivel/);
 assert.throws(()=>moveFoSpace(original,{orientationId,spaceId:'fo-pvf-5',targetTerm:10}),/proyecto anual/);
});
