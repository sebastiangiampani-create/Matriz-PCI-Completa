import test from 'node:test';
import assert from 'node:assert/strict';
import {crearBorradorBa15,crearEspacioBa15} from '../src/ba15/constructor.mjs';
import {updateBa15Plan,readStageDescription} from '../src/ba15/desarrollo-plan-seguro.mjs';
const identity={pciId:'pci-demo',schoolId:1017,orientationId:'sociales',shiftId:'vespertino'};
const base=crearEspacioBa15(crearBorradorBa15(identity),{nivel:1,term:1,nombre:'Laboratorio de Ciencias',formato:'laboratorio'});
const space=base.niveles[0].espacios[0];
test('Desarrollo actualiza un plan sin modificar el mapa ni los otros planes',()=>{
 const snapshot=structuredClone(base);
 const edited=updateBa15Plan(base,{schoolId:1017,pciId:'pci-demo',nivel:1,espacioId:space.id,planIndex:0,patch:{objetivos:'Investigar',punto_partida:'Problematización'}});
 assert.equal(edited.niveles[0].espacios[0].planes[0].objetivos,'Investigar');
 assert.equal(readStageDescription(edited.niveles[0].espacios[0].planes[0],'punto_partida'),'Problematización');
 assert.deepEqual(base,snapshot);
 assert.deepEqual(edited.niveles[0].espacios[0].planes.slice(1),base.niveles[0].espacios[0].planes.slice(1));
 assert.deepEqual(edited.niveles[0].espacios[0].miembros,base.niveles[0].espacios[0].miembros);
});
test('Campos históricos adicionales de las etapas y planes permanecen intactos',()=>{
 const historical=structuredClone(base);
 historical.niveles[0].espacios[0].planes[0].etapas.punto_partida={description:'Viejo',evidencias:['fuente'],originalText:'texto'};
 historical.niveles[0].espacios[0].planes[0].evaluacionHistorica={instrumentos:['rúbrica']};
 const edited=updateBa15Plan(historical,{schoolId:1017,pciId:'pci-demo',nivel:1,espacioId:space.id,planIndex:0,patch:{punto_partida:'Nuevo'}});
 const plan=edited.niveles[0].espacios[0].planes[0];
 assert.deepEqual(plan.etapas.punto_partida,{description:'Nuevo',evidencias:['fuente'],originalText:'texto'});
 assert.deepEqual(plan.evaluacionHistorica,{instrumentos:['rúbrica']});
});
test('Rechaza otro PCI, otra escuela y campos de composición',()=>{
 const options={schoolId:1017,pciId:'pci-demo',nivel:1,espacioId:space.id,planIndex:0,patch:{objetivos:'A'}};
 assert.throws(()=>updateBa15Plan(base,{...options,pciId:'otro'}),/no pertenece/);
 assert.throws(()=>updateBa15Plan(base,{...options,schoolId:9999}),/no pertenece/);
 assert.throws(()=>updateBa15Plan(base,{...options,patch:{miembros:[]}}),/no editable/);
});
