import test from 'node:test';
import assert from 'node:assert/strict';
import {crearBorradorBa15,crearEspacioBa15,asignarMateriaBa15,quitarMateriaBa15,actualizarEspacioBa15,eliminarEspacioBa15,validarBorradorBa15,BA15_TERMS} from '../src/ba15/constructor.mjs';
const id={pciId:'ba15-noche-1',schoolId:1001,orientationId:'turismo',shiftId:'noche'};
test('BA +15 conserva exactamente ocho cuatrimestres, agrupados en cuatro niveles',()=>{
 assert.deepEqual(BA15_TERMS.map(x=>x.nivel),[1,1,2,2,3,3,4,4]);
 const draft=crearBorradorBa15(id);
 assert.equal(draft.niveles.length,4);
 assert.equal(draft.ccc.length,10);
 assert.deepEqual(draft.niveles.map(x=>x.asignaturas.reduce((a,s)=>a+s.horas,0)),[38,38,38,38]);
 assert.equal(draft.shiftId,'noche');
});
test('agrupamientos con materias y cuatro planes se pueden editar sin modificar otros turnos',()=>{
 const before=crearBorradorBa15(id);
 let d=crearEspacioBa15(before,{nivel:1,term:1,nombre:'Laboratorio de ciencias',formato:'laboratorio'});
 const e=d.niveles[0].espacios[0],subject=d.niveles[0].asignaturas.find(x=>x.nombre==='Biología');
 assert.equal(e.planes.length,4);
 d=asignarMateriaBa15(d,{nivel:1,espacioId:e.id,materiaId:subject.id});
 assert.deepEqual(d.niveles[0].espacios[0].miembros,[subject.id]);
 assert.throws(()=>asignarMateriaBa15(d,{nivel:1,espacioId:e.id,materiaId:subject.id}),/asignada/);
 let newPlans=structuredClone(d.niveles[0].espacios[0].planes);
 newPlans[0].etapas.indagacion='Explorar fuentes';
 d=actualizarEspacioBa15(d,{nivel:1,espacioId:e.id,changes:{planes:newPlans,articulacion:'Articulación Biología y Matemática'}});
 assert.equal(d.niveles[0].espacios[0].planes[0].etapas.indagacion,'Explorar fuentes');
 assert.equal(before.niveles[0].espacios.length,0);
 d=quitarMateriaBa15(d,{nivel:1,espacioId:e.id,materiaId:subject.id});
 assert.equal(d.niveles[0].espacios[0].miembros.length,0);
 d=eliminarEspacioBa15(d,{nivel:1,espacioId:e.id});
 assert.equal(d.niveles[0].espacios.length,0);
});
test('impide colocar agrupamientos en un cuatrimestre de otro nivel',()=>{
 const d=crearBorradorBa15(id);
 assert.throws(()=>crearEspacioBa15(d,{nivel:1,term:3,nombre:'Error',formato:'laboratorio'}),/no corresponde/);
});
test('valida duplicación por cuatrimestre sin bloquear una materia en C1 y C2',()=>{
 let d=crearBorradorBa15(id);
 d=crearEspacioBa15(d,{nivel:1,term:1,nombre:'Lab 1',formato:'laboratorio'});
 d=crearEspacioBa15(d,{nivel:1,term:1,nombre:'Lab 2',formato:'laboratorio'});
 d=crearEspacioBa15(d,{nivel:1,term:2,nombre:'Lab 3',formato:'laboratorio'});
 const [a,b,c]=d.niveles[0].espacios,subject=d.niveles[0].asignaturas[4].id;
 d=asignarMateriaBa15(d,{nivel:1,espacioId:a.id,materiaId:subject});
 assert.throws(()=>asignarMateriaBa15(d,{nivel:1,espacioId:b.id,materiaId:subject}),/asignada/);
 d=asignarMateriaBa15(d,{nivel:1,espacioId:c.id,materiaId:subject});
 assert.ok(validarBorradorBa15(d).advertencias.length>0);
});

test('CCC queda fuera del cálculo y de los cuatrimestres; el trabajo previo se conserva',()=>{
 const draft=crearBorradorBa15(id);
 const before=structuredClone(draft);
 const result=validarBorradorBa15({...draft,ccc:[]});
 assert.equal(result.errores.some(x=>x.includes('CCC')),false);
 assert.equal(result.advertencias.some(x=>x.includes('CCC')),false);
 assert.equal(draft.ccc.length,10);
 assert.deepEqual(draft,before);
 assert.equal(BA15_TERMS.length,8);
});

test('Mapa V2 BA +15: troncal anual ocupa ambos cuatrimestres con un único ID y cuatro planes',()=>{
 const original=crearBorradorBa15(id);
 let draft=crearEspacioBa15(original,{nivel:1,term:2,nombre:'Matemática',formato:'troncal'});
 const annual=draft.niveles[0].espacios[0];
 const math=draft.niveles[0].asignaturas.find(x=>x.nombre==='Matemática');
 const language=draft.niveles[0].asignaturas.find(x=>x.nombre==='Lengua y Literatura');
 assert.equal(annual.term,1);
 assert.equal(annual.endTerm,2);
 assert.equal(annual.duration,'anual');
 assert.equal(annual.planes.length,4);
 draft=asignarMateriaBa15(draft,{nivel:1,espacioId:annual.id,materiaId:math.id});
 assert.deepEqual(draft.niveles[0].espacios[0].miembros,[math.id]);
 assert.throws(()=>asignarMateriaBa15(draft,{nivel:1,espacioId:annual.id,materiaId:language.id}),/troncal anual/);
 const validation=validarBorradorBa15(draft);
 assert.ok(!validation.advertencias.some(x=>/^Nivel 1 C[12]: falta ubicar Matemática$/.test(x)),
  'Un único espacio anual cubre C1 y C2 sin duplicar el agrupamiento');
 assert.equal(original.niveles[0].espacios.length,0,'No hay mutación del borrador anterior');
});
