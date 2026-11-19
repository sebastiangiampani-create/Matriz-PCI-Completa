import test from 'node:test';
import assert from 'node:assert/strict';
import {
 HISTORIC_LINK_SCHEMA,inventoryFromLegacy,isLinkedToPci,linkedRowsForPci,
 filteredHistoricForPci,checkHistoricLinks,historicCountsForPci
} from '../src/vinculos-historicos.mjs';

const pcis=[
 {pci_id:'00000000-0000-4000-8000-000000000001',model:'comun',orientation_id:'comunicacion',shift_id:'manana'},
 {pci_id:'00000000-0000-4000-8000-000000000002',model:'comun',orientation_id:'economia_administracion',shift_id:'tarde'},
 {pci_id:'00000000-0000-4000-8000-000000000003',model:'tecnica',orientation_id:'tecnica_especialidad_a',shift_id:'vespertino'},
 {pci_id:'00000000-0000-4000-8000-000000000004',model:'ba15',orientation_id:'comunicacion',shift_id:'noche'},
 {pci_id:'00000000-0000-4000-8000-000000000005',model:'comun',orientation_id:'comunicacion',shift_id:'tarde'}
];
const source={schoolName:'Escuela original',profile:'tecnica',areas:{
 'Lengua y Literatura':{groups:[{id:'lengua-1',name:'Lengua 1º',items:[1,2],plansBimestrales:[{synopsis:'Producción de textos propios',objectives:'Aprender a escribir'}]}]},
 'Otros formatos pedagógicos':{groups:[{id:'orientada-1',name:'Proyecto Comunicación',items:[100],plansBimestrales:[{synopsis:'Comunicación y medios'}]}]},
 'Integración de la Especialidad':{groups:[{id:'tecnica-1',name:'Taller eléctrico',items:['T-1'],plansBimestrales:[{synopsis:'Circuitos de un taller'}]}]},
 'Matemática':{groups:[{id:'math-1',name:'Plantilla vacía',items:[],plansBimestrales:[]}]}
}};
const doc=()=>({
 schema:HISTORIC_LINK_SCHEMA,school_id:1017,source_updated_at:'2026-11-19T14:00:00Z',
 assignments:[
  {area:'Lengua y Literatura',id:'lengua-1',kind:'general',mode:'all',pci_ids:[]},
  {area:'Otros formatos pedagógicos',id:'orientada-1',kind:'orientada',mode:'selected',pci_ids:[pcis[0].pci_id,pcis[4].pci_id]},
  {area:'Integración de la Especialidad',id:'tecnica-1',kind:'tecnica',mode:'selected',pci_ids:[pcis[2].pci_id]}
 ]
});
test('FG general puede vincularse a uno, varios o TODOS los PCI incluso futuros',()=>{
 const rows=inventoryFromLegacy(source),d=doc();
 assert.deepEqual(checkHistoricLinks(d,rows,pcis),[]);
 for(const pci of pcis)assert.ok(linkedRowsForPci(rows,d,pci).some(x=>x.id==='lengua-1'));
 const future={pci_id:'00000000-0000-4000-8000-000000000006',model:'comun',orientation_id:'turismo'};
 assert.equal(isLinkedToPci(d.assignments[0],future),true);
 d.assignments[0]={...d.assignments[0],mode:'selected',pci_ids:[pcis[0].pci_id,pcis[2].pci_id]};
 assert.deepEqual(checkHistoricLinks(d,rows,pcis),[]);
 assert.equal(isLinkedToPci(d.assignments[0],pcis[0]),true);
 assert.equal(isLinkedToPci(d.assignments[0],pcis[1]),false);
 assert.equal(isLinkedToPci(d.assignments[0],pcis[2]),true);
});
test('Orientada de Comunicación solo entra a ese PCI y sus turnos; Técnica a su especialidad',()=>{
 const rows=inventoryFromLegacy(source),d=doc();
 assert.deepEqual(linkedRowsForPci(rows,d,pcis[0]).map(x=>x.id).sort(),['lengua-1','orientada-1']);
 assert.deepEqual(linkedRowsForPci(rows,d,pcis[1]).map(x=>x.id),['lengua-1']);
 assert.deepEqual(linkedRowsForPci(rows,d,pcis[2]).map(x=>x.id).sort(),['lengua-1','tecnica-1']);
 assert.deepEqual(historicCountsForPci(rows,d,pcis[0]),{
   total:2,general:1,orientada:1,tecnica:0,plans:2,contents:3
 });
});
test('El trabajo orientado o técnico no se convierte accidentalmente a FG',()=>{
 const before=structuredClone(source),d=doc();
 const media=filteredHistoricForPci(source,d,pcis[0]);
 assert.equal(media.legacyMode,'seleccion-explicita');
 assert.deepEqual(Object.keys(media.state.areas),['Lengua y Literatura']);
 assert.equal(media.state.areas['Lengua y Literatura'].groups[0].plansBimestrales[0].synopsis,'Producción de textos propios');
 assert.equal(media.state.profile,'comun','FG de fuente técnica seleccionada puede pasar a Media sin la especialidad');
 const tech=filteredHistoricForPci(source,d,pcis[2]);
 assert.deepEqual(Object.keys(tech.state.areas),['Lengua y Literatura','Integración de la Especialidad']);
 assert.equal(tech.state.areas['Integración de la Especialidad'].groups[0].plansBimestrales[0].synopsis,'Circuitos de un taller');
 const ba=filteredHistoricForPci(source,d,pcis[3]);
 assert.deepEqual(Object.keys(ba.state.areas),[],'BA+15 no debe importar automáticamente estructuras ajenas a C1–C8');
 assert.deepEqual(source,before,'El original histórico no cambia ni se borra');
});
test('Sin vínculos guardados conserva el comportamiento previo y los planes anteriores',()=>{
 const copy=filteredHistoricForPci(source,null,pcis[0]);
 assert.equal(copy.legacyMode,'compatibilidad');
 assert.deepEqual(copy.state,source);
});
test('Rechaza asignar específica de Técnica a Media, o FO a distintas orientaciones',()=>{
 const rows=inventoryFromLegacy(source);
 const d=doc();d.assignments[2].pci_ids.push(pcis[0].pci_id);
 assert.match(checkHistoricLinks(d,rows,pcis).join(' '),/trabajo técnico/i);
 const d2=doc();d2.assignments[1].pci_ids.push(pcis[1].pci_id);
 assert.match(checkHistoricLinks(d2,rows,pcis).join(' '),/una sola orientación/i);
 const d3=doc();d3.assignments[1].mode='all';
 assert.match(checkHistoricLinks(d3,rows,pcis).join(' '),/Solo FG compartida/i);
});
test('No permite grupos inexistentes, destinatarios externos ni entradas duplicadas',()=>{
 const rows=inventoryFromLegacy(source);
 const d=doc();d.assignments[0].pci_ids=['00000000-0000-4000-8000-000000004444'];d.assignments[0].mode='selected';
 assert.match(checkHistoricLinks(d,rows,pcis).join(' '),/otra escuela/i);
 const d2=doc();d2.assignments.push({...d2.assignments[0]});
 assert.match(checkHistoricLinks(d2,rows,pcis).join(' '),/duplicado/i);
 const d3=doc();d3.assignments[0].id='inexistente';
 assert.match(checkHistoricLinks(d3,rows,pcis).join(' '),/ya no está/i);
});
test('Conservar otros PCI y grupos fuente cuando se modifican vínculos',()=>{
 const d=doc(),prev=structuredClone(source),next=structuredClone(d);
 next.assignments[0].mode='selected';
 next.assignments[0].pci_ids=[pcis[1].pci_id];
 const schoolOne=filteredHistoricForPci(source,next,pcis[0]);
 const schoolTwo=filteredHistoricForPci(source,next,pcis[1]);
 assert.equal(Object.keys(schoolOne.state.areas).length,0);
 assert.ok(schoolTwo.state.areas['Lengua y Literatura']);
 assert.deepEqual(source,prev);
 assert.equal(d.assignments[0].mode,'all');
});
