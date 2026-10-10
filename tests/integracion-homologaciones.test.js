import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrientationPackage,chooseFgMode} from '../src/integracion-curricular/bridge.js';
import {stageFgContent,appendFgContent} from '../src/integracion-curricular/mapa-oferta.js';
import {
  mappingKey,suggestHomologations,approveHomologation,
  getApprovedHomologations,inspectHomologations
} from '../src/integracion-curricular/homologaciones.js';
import {curriculumTracking} from '../src/integracion-curricular/seguimiento.js';
import {matchMatrixToV2Fg,fgCoverageByLevel} from '../src/integracion-curricular/catalogos.js';

const matrix=[
  {id:'legacy-e3',area:'Ciencias Sociales',subject:'Economía',text:'Mercado, actores y cambios antiguos'},
  {id:'legacy-h3',area:'Ciencias Sociales',subject:'Historia',text:'La transformación industrial'}
];
const v2=[
  {id:'v2-e3',year:3,area:'Ciencias Sociales',subject:'Economía',axis:'Mercados',text:'Mercados y actores contemporáneos'},
  {id:'v2-e3b',year:3,area:'Ciencias Sociales',subject:'Economía',axis:'Actividad',text:'Economía social y circulación'},
  {id:'v2-h3',year:3,area:'Ciencias Sociales',subject:'Historia',text:'La transformación industrial'},
  {id:'v2-e4',year:4,area:'Ciencias Sociales',subject:'Economía',text:'Mercados y actores contemporáneos'},
  {id:'v2-m3',year:3,area:'Matemática',subject:'Matemática',text:'Multiplicación'}
];
const fo=[{id:'fo1',orientation:'Economía y Administración',text:'Gestión',block:'Organizaciones'}];
const orientations=[{id:'economia_administracion',name:'Economía y Administración'},
  {id:'ciencias_naturales',name:'Ciencias Naturales'}];
function original(){return {schemaVersion:10,schoolName:'Ejemplo',areas:{
  'Ciencias Sociales':{groups:[{
    id:'social3',kind:'laboratory',name:'Sociales de tercero',level:3,startTerm:5,endTerm:5,
    items:['legacy-e3','legacy-h3'],
    plansBimestrales:[{number:1,name:'Secuencia conservada',
      contentIds:['legacy-e3'],objectives:'Objetivos originales',
      stages:{punto_partida:{description:'No borrar esta secuencia'}}}]
  }]}
}};}
function pack(){return createOrientationPackage({legacyState:original(),schoolId:1001,
  orientationIds:['economia_administracion','ciencias_naturales']});}
function report(p){return curriculumTracking({
  pack:p,orientationId:'economia_administracion',
  matrixRows:matrix,v2FgRows:v2,v2FoRows:fo,orientations
});}
const args={
  orientationId:'economia_administracion',area:'Ciencias Sociales',year:3,
  matrixId:'legacy-e3',referenceId:'v2-e3',
  reason:'Se revisaron ejes y objetivos y se confirmó correspondencia pedagógica.',
  reviewer:'Revisor de prueba',matrixRows:matrix,v2FgRows:v2
};
test('sugiere candidatos de la misma materia y nivel, sin aprobar nada',()=>{
  const suggestion=suggestHomologations({
    matrixRows:matrix,v2FgRows:v2,area:'Ciencias Sociales',year:3,
    matrixId:'legacy-e3'
  });
  assert.equal(suggestion.source.id,'legacy-e3');
  assert.equal(suggestion.candidates.length,2);
  assert.ok(suggestion.candidates.every(x=>x.year===3&&x.subject==='Economía'));
  assert.equal(suggestion.exactCandidates,0);
  assert.equal(Object.keys(getApprovedHomologations(pack(),'economia_administracion')).length,0);
});
test('una homologación justificada permite contar sin cambiar ni planes ni matriz',()=>{
  const source=original(),originalPack=pack();
  const before=report(originalPack);
  const previous=before.fg.areasByLevel.find(x=>x.area==='Ciencias Sociales');
  assert.equal(previous.used,1);
  assert.equal(previous.confirmedPercent,null);
  const approved=approveHomologation(originalPack,args);
  const after=report(approved);
  const changed=after.fg.areasByLevel.find(x=>x.area==='Ciencias Sociales');
  assert.equal(changed.used,2);
  assert.equal(changed.total,3);
  assert.equal(changed.confirmedPercent,66.7);
  assert.equal(after.fg.subjectsByLevel.find(s=>s.subject==='Economía').confirmedPercent,50);
  assert.equal(approved.orientations.ciencias_naturales.fg.homologations,undefined);
  assert.deepEqual(original(),source);
  assert.deepEqual(originalPack,pack());
  assert.equal(approved.orientations.economia_administracion.fg.areas['Ciencias Sociales']
    .groups[0].plansBimestrales[0].stages.punto_partida.description,'No borrar esta secuencia');
});
test('no permite homologación a otro año, área o materia',()=>{
  const base=pack();
  for(const ref of ['v2-e4','v2-m3','inexistente'])
    assert.throws(()=>approveHomologation(base,{...args,referenceId:ref}));
  assert.throws(()=>approveHomologation(base,{...args,reason:'breve'}),/justificación/);
  assert.throws(()=>approveHomologation(base,{...args,reviewer:''}),/identificar/);
  assert.throws(()=>approveHomologation(base,{...args,matrixId:'no-asignado'}),/ubicado/);
  assert.throws(()=>approveHomologation(base,{...args,year:4}),/ubicado/);
});
test('una equivalencia manual inválida no cuenta, aunque venga inyectada en el paquete',()=>{
  const base=pack(),key=mappingKey('Ciencias Sociales',3,'legacy-e3');
  base.orientations.economia_administracion.fg.homologations={
    [key]:{status:'approved',referenceId:'v2-e4',year:3,area:'Ciencias Sociales',reason:'Justificada en prueba',reviewer:'A'}
  };
  const result=matchMatrixToV2Fg({
    matrixRows:matrix,v2FgRows:v2,contentId:'legacy-e3',level:3,area:'Ciencias Sociales',
    approvedMappings:getApprovedHomologations(base,'economia_administracion')
  });
  assert.equal(result.status,'unresolved');
  assert.equal(report(base).fg.areasByLevel.find(r=>r.area==='Ciencias Sociales').used,1);
  assert.equal(inspectHomologations(base,'economia_administracion',{matrixRows:matrix,v2FgRows:v2}).stale,1);
});
test('homologar dos veces lo mismo no genera duplicados ni cambia orientación hermana',()=>{
  const first=approveHomologation(pack(),args);
  const second=approveHomologation(first,args);
  assert.deepEqual(second,first);
  assert.equal(second.orientations.economia_administracion.fg.homologationHistory.length,1);
  const x=inspectHomologations(second,'economia_administracion',{matrixRows:matrix,v2FgRows:v2});
  assert.equal(x.valid,1);assert.equal(x.stale,0);
  const view=fgCoverageByLevel({
    areas:second.orientations.economia_administracion.fg.areas,matrixRows:matrix,
    v2FgRows:v2,area:'Ciencias Sociales',level:3,
    approvedMappings:getApprovedHomologations(second,'economia_administracion')
  });
  assert.equal(view.verifiedPercent,66.7);
});
test('cambiar homologación conserva la anterior en el historial',()=>{
  const first=approveHomologation(pack(),args);
  const second=approveHomologation(first,{...args,referenceId:'v2-e3b'});
  const history=second.orientations.economia_administracion.fg.homologationHistory;
  assert.equal(history.length,2);
  assert.equal(history[0].previous,null);
  assert.equal(history[1].previous.referenceId,'v2-e3');
  assert.equal(getApprovedHomologations(second,'economia_administracion')
    [mappingKey('Ciencias Sociales',3,'legacy-e3')].referenceId,'v2-e3b');
});

test('arrastre pendiente -> revisión pedagógica -> incorporación no altera plan previo',()=>{
  const old=original(),init=chooseFgMode(pack(),'economia_administracion','revisar');
  const extra={id:'legacy-extra',area:'Ciencias Sociales',subject:'Economía',text:'Texto escolar diferente'};
  const fullMatrix=[...matrix,extra];
  const waiting=stageFgContent(init,{
    orientationId:'economia_administracion',area:'Ciencias Sociales',groupId:'social3',
    contentId:'legacy-extra',matrixRows:fullMatrix
  });
  const groupBefore=waiting.orientations.economia_administracion.fg.areas['Ciencias Sociales'].groups[0];
  assert.equal(groupBefore.items.includes(extra.id),false);
  assert.equal(groupBefore.provisionalContentIds.includes(extra.id),true);
  assert.throws(()=>appendFgContent(waiting,{
    orientationId:'economia_administracion',area:'Ciencias Sociales',groupId:'social3',
    contentId:extra.id,matrixRows:fullMatrix,v2FgRows:v2
  }),/Revisar homologación/);
  const approved=approveHomologation(waiting,{
    ...args,matrixId:extra.id,matrixRows:fullMatrix
  });
  const promoted=appendFgContent(approved,{
    orientationId:'economia_administracion',area:'Ciencias Sociales',groupId:'social3',
    contentId:extra.id,matrixRows:fullMatrix,v2FgRows:v2
  });
  const next=promoted.orientations.economia_administracion.fg.areas['Ciencias Sociales'].groups[0];
  assert.ok(next.items.includes(extra.id));
  assert.deepEqual(next.provisionalContentIds,[]);
  assert.equal(next.plansBimestrales[0].stages.punto_partida.description,'No borrar esta secuencia');
  assert.deepEqual(old,original());
  assert.equal(promoted.orientations.ciencias_naturales.fg.areas['Ciencias Sociales'].groups[0].items.includes(extra.id),false);
});
