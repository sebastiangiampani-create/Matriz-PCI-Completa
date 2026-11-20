import test from 'node:test';
import assert from 'node:assert/strict';
import {phaseGate,phaseText} from '../src/pci-flujo-fases.mjs';
import {crearBorradorBa15,validarBorradorBa15,crearEspacioBa15,asignarMateriaBa15,actualizarEspacioBa15} from '../src/ba15/constructor.mjs';
test('Fase 2 no se abre antes de guardar el mapa del PCI',()=>{
 const gate=phaseGate({revision:0,issues:[]});
 assert.equal(gate.ready,false);
 assert.match(phaseText(gate),/Fase 1 pendiente/);
 assert.match(gate.detail,/Guardá el mapa/);
});
test('Una composición incompleta guardada permanece en Fase 1',()=>{
 const gate=phaseGate({revision:1,issues:['Falta el laboratorio de C5','El proyecto no tiene materias']});
 assert.equal(gate.ready,false);
 assert.equal(gate.issues.length,2);
 assert.match(gate.detail,/2 pendientes/);
});
test('La estructura terminada debe estar guardada y sin cambios pendientes',()=>{
 assert.equal(phaseGate({revision:5,issues:[],warnings:['Pendiente de homologación externa']}).ready,true);
 assert.equal(phaseGate({revision:5,dirty:true,issues:[]}).ready,false);
 assert.equal(phaseGate({revision:5,dirty:false,issues:[]}).step,'desarrollo');
});
test('Cada orientación o PCI se evalúa individualmente: la revisión de uno no habilita otros',()=>{
 const developed=phaseGate({revision:4,issues:[]});
 const newPci=phaseGate({revision:0,issues:[]});
 assert.equal(developed.ready,true);assert.equal(newPci.ready,false);
});
test('La validación real BA +15 bloquea Fase 2 con materias sin ubicar',()=>{
 const draft=crearBorradorBa15({
   schoolId:1017,pciId:'test-pci-ba15',orientationId:'economia_administracion',shiftId:'noche'
 });
 const result=validarBorradorBa15(draft);
 assert.equal(result.valido,false);
 const gate=phaseGate({revision:1,issues:[...result.errores,...result.advertencias]});
 assert.equal(gate.ready,false);
 assert.ok(gate.issues.some(msg=>/falta ubicar/i.test(msg)));
});
test('Las funciones de fase nunca modifican planes, agrupamientos o documentos de las escuelas',()=>{
 const document={pci_id:'seguro',fo:{spaces:[{name:'Laboratorio',members:[1]}]},plans:[{name:'Plan anterior'}]};
 const before=structuredClone(document);
 phaseGate({revision:0,dirty:true,issues:['sin materias'],warnings:['revisar']});
 assert.deepEqual(document,before);
});

test('BA +15 completo: al guardar la estructura se habilita la Fase 2 de ese PCI',()=>{
 let draft=crearBorradorBa15({schoolId:1017,pciId:'pci-completo',orientationId:'economia_administracion',shiftId:'noche'});
 for(let level=1;level<=4;level++){
  const subjects=draft.niveles[level-1].asignaturas;
  for(const term of [level*2-1,level*2]){
   // No ubicar troncales ni talleres en un laboratorio ficticio:
   // cada materia respeta el formato identificado por el plan BA +15.
   const formats=new Map();
   for(const subject of subjects){
    const format=['troncal','taller','orientado'].includes(subject.formatoOriginal)?
     subject.formatoOriginal:'laboratorio';
    const key=format+':'+(format==='troncal'?subject.id:subject.area);
    if(!formats.has(key)){
     draft=crearEspacioBa15(draft,{nivel:level,term,
      nombre:subject.nombre+' · C'+term,formato:format});
     formats.set(key,draft.niveles[level-1].espacios.at(-1).id);
    }
    draft=asignarMateriaBa15(draft,{nivel:level,espacioId:formats.get(key),materiaId:subject.id});
   }
   for(const id of formats.values())draft=actualizarEspacioBa15(draft,{nivel:level,espacioId:id,
    changes:{articulacion:'Articulación pedagógica de este espacio curricular del nivel'}});
  }
 }
 const audit=validarBorradorBa15(draft);
 assert.deepEqual(audit.errores,[], 'La propuesta debe cumplir el esquema curricular BA +15');
 assert.deepEqual(audit.advertencias,[], 'Todas las materias deben estar ubicadas en C1–C8');
 assert.equal(phaseGate({revision:0,issues:[...audit.errores,...audit.advertencias]}).ready,false,
   'Sin guardar online no se puede entrar a Desarrollo');
 assert.equal(phaseGate({revision:1,issues:[...audit.errores,...audit.advertencias]}).ready,true,
   'Revisión guardada y validada habilita Desarrollo');
});
