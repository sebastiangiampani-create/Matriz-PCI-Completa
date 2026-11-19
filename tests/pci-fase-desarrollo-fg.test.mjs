import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyFgAreaUnit,inheritFgComposition,proposedFgAreas} from '../src/pci-fase-desarrollo-fg.mjs';
const pci={school_id:1017,pci_id:'pci-media-1',orientation_id:'comunicacion',legacy_sha256:'a'.repeat(64)};
const stageOne={pciId:pci.pci_id,schoolId:pci.school_id,orientationId:pci.orientation_id,groups:[
 {id:'g-social-5',name:'Laboratorio Sociales C5',year:3,term:5,endTerm:5,area:'Ciencias Sociales',
   kind:'laboratorio',members:[{id:'fg-historia-3',name:'Historia',component:'FG',year:3}]},
 {id:'g-social-6',name:'Laboratorio Sociales C6',year:3,term:6,endTerm:6,area:'Ciencias Sociales',
   kind:'laboratorio',members:[{id:'fg-historia-3',name:'Historia',component:'FG',year:3}]},
 {id:'fo-only',name:'Proyecto FO',area:'Formación Orientada',year:3,term:5,endTerm:5,kind:'taller',
   members:[{id:'fo-id',name:'Materia FO',component:'FO',year:3}]}
]};
test('Fase 2 encuentra las áreas FG construidas por cada orientación',()=>{
 assert.deepEqual(proposedFgAreas(stageOne),['Ciencias Sociales']);
});
test('Fase 1 crea una copia de desarrollo con cuatro planes por agrupamiento sin tocar el original',()=>{
 const unit=emptyFgAreaUnit(pci,'Ciencias Sociales'),original=structuredClone(unit);
 const result=inheritFgComposition({unit,composition:stageOne,pci,area:'Ciencias Sociales'});
 assert.equal(result.changed,true);
 assert.equal(result.unit.groups.length,2);
 assert.equal(result.unit.groups[0].plansBimestrales.length,4);
 assert.equal(result.unit.groups[0].curricularSubjects[0].name,'Historia');
 assert.deepEqual(unit,original);
});
test('Un desarrollo histórico previo permanece intacto al sumar agrupamientos nuevos',()=>{
 const unit=emptyFgAreaUnit(pci,'Ciencias Sociales');
 unit.groups.push({id:'hist-1',name:'Trabajo histórico',items:['id-contenido'],plansBimestrales:[{name:'Plan trabajado',synopsis:'Trabajo pedagógico anterior'}]});
 const result=inheritFgComposition({unit,composition:stageOne,pci,area:'Ciencias Sociales'});
 assert.deepEqual(result.unit.groups[0],unit.groups[0]);
 assert.equal(result.unit.groups.length,3);
});
test('Cambiar la composición de Fase 1 no reescribe automáticamente un plan desarrollado',()=>{
 const unit=emptyFgAreaUnit(pci,'Ciencias Sociales');
 const first=inheritFgComposition({unit,composition:stageOne,pci,area:'Ciencias Sociales'}).unit;
 first.groups[0].plansBimestrales[0].synopsis='Desarrollo escrito por la escuela';
 const altered=structuredClone(stageOne);
 altered.groups[0].members.push({id:'fg-geografia-3',name:'Geografía',component:'FG',year:3});
 const changed=inheritFgComposition({unit:first,composition:altered,pci,area:'Ciencias Sociales'});
 assert.equal(changed.changed,false);
 assert.equal(changed.conflicts.length,1);
 assert.equal(changed.unit.groups[0].plansBimestrales[0].synopsis,'Desarrollo escrito por la escuela');
 assert.equal(changed.unit.groups[0].curricularSubjects.length,1);
});
test('No heredar trabajo de otra escuela, PCI u orientación',()=>{
 const unit=emptyFgAreaUnit(pci,'Ciencias Sociales');
 assert.throws(()=>inheritFgComposition({unit,composition:{...stageOne,pciId:'otro-pci'},pci,area:'Ciencias Sociales'}),/otro PCI/);
 assert.throws(()=>inheritFgComposition({unit,composition:stageOne,pci:{...pci,school_id:1018},area:'Ciencias Sociales'}),/otro PCI/);
});
