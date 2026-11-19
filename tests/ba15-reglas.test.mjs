import test from 'node:test';
import assert from 'node:assert/strict';
import {BA15_NIVELES,BA15_CCC,BA15_NORMATIVA,validarBa15} from '../src/ba15/reglas-curriculares.mjs';
test('BA +15: 4 niveles con 38 horas semanales cada uno, según Anexo I',()=>{
 assert.equal(BA15_NORMATIVA.niveles,4);
 assert.deepEqual(BA15_NIVELES.map(n=>n.reduce((a,e)=>a+e.horas,0)),[38,38,38,38]);
 assert.equal(validarBa15().valido,true);
});
test('troncales en los cuatro niveles, cargas propias sin heredar Media',()=>{
 assert.deepEqual(BA15_NIVELES.map(n=>n.filter(e=>e.formato==='troncal').length),[3,3,3,3]);
 assert.deepEqual(BA15_NIVELES.map(n=>n.find(e=>e.nombre==='Matemática').horas),[5,4,4,4]);
 assert.deepEqual(BA15_NIVELES.map(n=>n.find(e=>e.nombre==='Lengua y Literatura').horas),[5,4,4,4]);
 assert.deepEqual(BA15_NIVELES.map(n=>n.find(e=>e.nombre==='Lengua Adicional (Inglés)').horas),[4,3,3,3]);
});
test('orientada solo desde nivel II y TI orientada en IV',()=>{
 assert.deepEqual(BA15_NIVELES.map(n=>n.filter(e=>e.area==='Formación Orientada').reduce((a,e)=>a+e.horas,0)),[0,4,9,16]);
 assert.ok(BA15_NIVELES[3].some(e=>e.nombre==='Historia Orientada'));
 assert.ok(BA15_NIVELES[3].some(e=>e.nombre==='Tecnologías de la Información Orientada'));
});
test('CCC es complementación del primer año NES, sin quinto nivel',()=>{
 assert.equal(BA15_CCC.length,10);
 assert.ok(BA15_CCC.includes('Educación Tecnológica'));
 assert.equal(BA15_NIVELES.length,4);
});
test('detecta carga faltante y exige documentar talleres articulados',()=>{
 const broken=BA15_NIVELES.map(x=>x.map(e=>({...e})));
 broken[1][0].horas=3;
 const result=validarBa15({niveles:broken});
 assert.equal(result.valido,false);
 assert.match(result.errores.join(' '),/37 de 38/);
 assert.ok(result.advertencias.some(x=>x.includes('articulación')));
});
