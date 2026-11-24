import test from 'node:test';
import assert from 'node:assert/strict';
import {atomizarCatalogoBa15,fragmentarContenidoFuente} from '../src/ba15/atomizacion-contenidos.mjs';
const text='Interpretación y comunicación de información técnica mediante códigos convencionales y representaciones gráficas. Construcción y lectura de planos de objetos técnicos, empleando criterios compartidos de representación. Desarrollo de croquis y bocetos para explicar soluciones y procesos de diseño en distintos contextos.';
const row={id:'nes-fg-primario-001',component:'FG',year:2,area:'Formación General',
 subject:'Tecnologías',axis:'Representación',subaxis:'Sistemas',text,
 source:'Prioritario original'};
test('separa literalmente varios saberes sin agregar ni reformular texto fuente',()=>{
 const parts=fragmentarContenidoFuente(text);
 assert.equal(parts.length,3);
 assert.equal(parts.join(' '),text);
 assert.ok(parts.every(s=>s.length>34));
 assert.deepEqual(fragmentarContenidoFuente('Representación en el espacio.'),[]);
});
test('los fragmentos heredan año, área, eje y fuente sin sobrescribir ID de origen',()=>{
 const input=[row],original=structuredClone(input);
 const a=atomizarCatalogoBa15(input,{component:'FG'});
 const b=atomizarCatalogoBa15(input,{component:'FG'});
 assert.deepEqual(input,original);
 assert.deepEqual(a,b);
 assert.deepEqual(a.padres,[row.id]);
 assert.equal(a.fragmentos.length,3);
 assert.equal(new Set(a.fragmentos.map(x=>x.id)).size,3);
 for(const [i,f] of a.fragmentos.entries()){
  assert.equal(f.component,'FG');assert.equal(f.year,row.year);
  assert.equal(f.source,row.source);assert.equal(f.subject,row.subject);
  assert.equal(f.atomizedFrom,row.id);assert.equal(f.atomIndex,i+1);
  assert.equal(f.atomCount,3);assert.equal(f.text,fragmentarContenidoFuente(text)[i]);
  assert.notEqual(f.id,row.id);
 }
});
test('las referencias FO V2 son desagregables pero nunca se homologan como materia nueva BA+15',()=>{
 const a=atomizarCatalogoBa15([{...row,component:'FO'}],{component:'FO'});
 assert.equal(a.fragmentos.length,3);
 assert.ok(a.fragmentos.every(r=>r.referenceOnly&&r.confirmedBa15Subject===false));
});
test('no inventar saberes si el texto no contiene cortes semánticos explícitos',()=>{
 for(const s of [
 'La importancia del pensamiento científico, la construcción de acuerdos colectivos y la diversidad en las relaciones interpersonales en distintos contextos y prácticas.',
 'Análisis de fuentes; diferencias.',
 'Un texto muy largo que enumera información sin puntos seguidos ni incisos suficientemente separados para realizar un corte correcto y reproducible manteniendo exactamente las palabras de origen y sin interpretaciones añadidas por el motor.'
 ])assert.deepEqual(fragmentarContenidoFuente(s),[]);
});

test('fragmenta enumeraciones separadas por punto y coma preservando literalmente la fuente',()=>{
 const original='Construcción y lectura de planos de objetos técnicos empleando criterios compartidos de representación; Interpretación de información técnica con códigos y convenciones gráficas de aplicación escolar; Producción de croquis y bocetos para comunicar soluciones técnicas en diferentes situaciones de trabajo';
 const parts=fragmentarContenidoFuente(original);
 assert.equal(parts.length,3);
 assert.equal(parts.join(' '),original);
 const atoms=atomizarCatalogoBa15([{...row,id:'nes-fg-lista-semis',text:original}],{component:'FG'});
 assert.equal(atoms.fragmentos.length,3);
 assert.ok(atoms.fragmentos.every(x=>x.atomizedFrom==='nes-fg-lista-semis'));
});
