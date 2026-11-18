import test from 'node:test';
import assert from 'node:assert/strict';
import {agruparPcis} from '../src/pci-turnos-organizacion.mjs';
const make=(id,shift_id,model,field)=>({
 pci_id:id,school_id:1001,shift_id,model,title:'PCI '+id,status:'borrador',
 orientation_id:model==='comun'?field:'tecnica_'+id,
 specialty_name:model==='tecnica'?field:null
});
const source=[
 make('media-manana-economia','manana','comun','economia_administracion'),
 make('media-manana-sociales','manana','comun','ciencias_sociales'),
 make('tecnica-manana-computacion','manana','tecnica','Computación'),
 make('media-tarde-economia','tarde','comun','economia_administracion'),
 make('tecnica-noche-electronica','noche','tecnica','Electrónica')
];
test('una escuela agrupa dos orientaciones y Técnica en el mismo turno y otras en turnos diferentes',()=>{
 const before=structuredClone(source);
 const groups=agruparPcis(source);
 assert.deepEqual(groups.map(g=>[g.id,g.cantidad]),[['manana',3],['tarde',1],['noche',1]]);
 assert.deepEqual(groups[0].modelos.map(g=>[g.id,g.pcis.length]),[['comun',2],['tecnica',1]]);
 assert.equal(groups[1].modelos[0].pcis[0].orientation_id,'economia_administracion');
 assert.notEqual(groups[0].modelos[0].pcis[0].pci_id,groups[1].modelos[0].pcis[0].pci_id);
 assert.equal(new Set(groups.flatMap(t=>t.modelos.flatMap(m=>m.pcis.map(p=>p.pci_id)))).size,5);
 assert.deepEqual(source,before,'nunca modifica los datos originales');
});
test('no admite turnos desconocidos, especialidad ausente ni PCI duplicado',()=>{
 assert.throws(()=>agruparPcis([...source,source[0]]),/duplicado/);
 assert.throws(()=>agruparPcis([{...source[0],shift_id:'invalido'}]),/incompleto/);
 assert.throws(()=>agruparPcis([{...source[2],specialty_name:null}]),/incompleto/);
});
test('la escuela sin nuevos PCI no borra los registros históricos',()=>{
 assert.deepEqual(agruparPcis([]),[]);
});
