/**
 * Regresión de resguardo: datos de ejemplo sintéticos, jamás de producción.
 * No usa red, credenciales ni Supabase. Simula una revisión optimista y
 * demuestra que la Fase 2 conserva la FG original de la escuela.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {newFgUnit,guardFgUnit} from '../src/orientaciones-release-core.mjs';
import {inheritFgComposition} from '../src/pci-fase-desarrollo-fg.mjs';
import {crearBorradorBa15,crearEspacioBa15} from '../src/ba15/constructor.mjs';
import {updateBa15Plan} from '../src/ba15/desarrollo-plan-seguro.mjs';

const makeStages=()=>Object.fromEntries(
 ['punto_partida','indagacion','produccion','evaluacion']
 .map(key=>[key,{description:'Texto histórico '+key,resources:'Materiales',evidence:'Producción histórica'}])
);
const oldPlans=Array.from({length:4},(_,i)=>({
 id:'plan-historico-'+i,name:'Plan histórico '+(i+1),
 synopsis:'Sinopsis ya escrita',objectives:'Objetivo ya escrito',
 stages:makeStages(),extraLegacy:{original:true}
}));
const legacy={
 schemaVersion:10,schoolName:'Escuela de prueba sintética',
 areas:{
  'Ciencias Sociales':{groups:[{
   id:'grupo-historico',name:'Historia - espacio existente',level:3,
   items:[{id:'contenido-historico',text:'Contenido escrito por la escuela'}],
   plansBimestrales:oldPlans,customMetadata:{preservar:'sí'}
  }]},
  'Matemática':{groups:[{
   id:'otro-grupo',name:'Matemática - existente',items:[{id:'mat-original'}],
   plansBimestrales:oldPlans
  }]}
 }
};
const pci={
 school_id:1999,pci_id:'pci-media-prueba',orientation_id:'comunicacion',
 process_id:'proceso-prueba',legacy_sha256:'a'.repeat(64),
 legacy_state:legacy
};
test('La herencia Fase 1 -> Fase 2 no reescribe ningún plan ni contenido original',()=>{
 const before=structuredClone(pci.legacy_state);
 const fg=newFgUnit({pci,area:'Ciencias Sociales',convertedAreas:{}});
 const composition={
  pciId:pci.pci_id,schoolId:pci.school_id,orientationId:pci.orientation_id,
  groups:[{id:'grupo-nuevo',name:'Laboratorio C5',area:'Ciencias Sociales',year:3,
   term:5,endTerm:5,kind:'laboratorio',
   members:[{id:'fg-historia',name:'Historia',component:'FG',year:3,hours:3}]}]
 };
 const newUnit=inheritFgComposition({unit:fg,composition,pci,area:'Ciencias Sociales'});
 assert.equal(newUnit.changed,true);
 assert.equal(newUnit.unit.groups.length,2);
 assert.deepEqual(newUnit.unit.groups[0],before.areas['Ciencias Sociales'].groups[0]);
 assert.equal(newUnit.unit.groups[1].plansBimestrales.length,4);
 assert.deepEqual(pci.legacy_state,before,'La FG original no se puede modificar');
 const validated=guardFgUnit(newUnit.unit,pci,'Ciencias Sociales');
 assert.deepEqual(validated.groups[0],before.areas['Ciencias Sociales'].groups[0]);
 assert.notStrictEqual(validated,newUnit.unit,'Guardar debe devolver copia independiente');
 const same=inheritFgComposition({unit:validated,composition,pci,area:'Ciencias Sociales'});
 assert.equal(same.changed,false,'Reabrir no debe duplicar agrupamientos');
 assert.equal(same.unit.groups.length,2);
 assert.deepEqual(same.unit.groups[0],before.areas['Ciencias Sociales'].groups[0]);
 assert.deepEqual(pci.legacy_state,before);
 assert.throws(()=>guardFgUnit(validated,{...pci,school_id:2000},'Ciencias Sociales'),
  /no pertenece|Datos institucionales|inválidos/);
});

test('Guardar y reabrir con revisión optimista rechaza una escritura obsoleta (simulación sin Supabase)',()=>{
 const original=structuredClone(pci.legacy_state);
 const unit=newFgUnit({pci,area:'Ciencias Sociales',convertedAreas:{}});
 const store=new Map();
 const scoped=pci.school_id+'|'+pci.pci_id+'|fg|Ciencias Sociales';
 function save(document,expectedRevision){
  const last=store.get(scoped);
  const current=last?.revision||0;
  if(current!==expectedRevision)throw Error('Conflicto de revisión');
  const result={revision:current+1,document:structuredClone(
   guardFgUnit(document,pci,'Ciencias Sociales'))};
  store.set(scoped,result);
  return result.revision;
 }
 assert.equal(save(unit,0),1);
 const reopened=structuredClone(store.get(scoped).document);
 assert.deepEqual(reopened.groups[0].plansBimestrales,original.areas['Ciencias Sociales'].groups[0].plansBimestrales);
 assert.throws(()=>save(unit,0),/Conflicto/);
 assert.deepEqual(pci.legacy_state,original);
});

test('BA +15 edita una etapa de un plan sin perder otras etapas, planes ni agrupamientos',()=>{
 const identity={schoolId:1999,pciId:'pci-ba15-prueba',orientationId:'comunicacion',shiftId:'vespertino'};
 const start=crearEspacioBa15(crearBorradorBa15(identity),{nivel:1,term:1,nombre:'Laboratorio',formato:'laboratorio'});
 const id=start.niveles[0].espacios[0].id;
 const history=structuredClone(start);
 history.niveles[0].espacios[0].planes[0].etapas.punto_partida={
  description:'Descripción histórica',resources:'Recursos anteriores',evidence:'Evidencias anteriores',
  extras:{institutional:'sí'}
 };
 const before=structuredClone(history);
 const edited=updateBa15Plan(history,{
  schoolId:1999,pciId:'pci-ba15-prueba',nivel:1,espacioId:id,planIndex:0,
  patch:{stagePatch:{stage:'punto_partida',field:'activities',value:'Actividad nueva'}}
 });
 const first=edited.niveles[0].espacios[0].planes[0];
 assert.equal(first.etapas.punto_partida.activities,'Actividad nueva');
 assert.equal(first.etapas.punto_partida.resources,'Recursos anteriores');
 assert.equal(first.etapas.punto_partida.evidence,'Evidencias anteriores');
 assert.deepEqual(first.etapas.punto_partida.extras,{institutional:'sí'});
 assert.deepEqual(edited.niveles[0].espacios[0].planes.slice(1),before.niveles[0].espacios[0].planes.slice(1));
 assert.deepEqual(edited.niveles[0].espacios[0].miembros,before.niveles[0].espacios[0].miembros);
 assert.deepEqual(history,before,'El documento previo a editar debe quedar intacto');
 assert.throws(()=>updateBa15Plan(history,{
  schoolId:2000,pciId:identity.pciId,nivel:1,espacioId:id,planIndex:0,
  patch:{nombre:'No permitido'}
 }),/no pertenece/);
});
