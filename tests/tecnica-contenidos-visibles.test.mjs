/**
 * Regresión C4 (auditoría 26/11/2026): todo contenido de cada especialidad
 * técnica pertenece a un área que el mapa técnico muestra (IF-2026-51169092,
 * pág. 13: troncales, integración, formativos, formación específica y PVF).
 * Mismos IDs: la prueba solo verifica la ubicación visible.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';

const raiz=new URL('../',import.meta.url);
globalThis.fetch=async ruta=>{
  try{const bytes=await readFile(new URL(String(ruta).replace(/^\.?\//,'').replace(/\?.*$/,''),raiz));
    return new Response(bytes,{status:200});}
  catch{return new Response('',{status:404});}
};
const {loadV2ModalProfile}=await import('../src/v2-familia/catalogos-modalidad.mjs');
// Áreas de las filas del mapa técnico (v19-mapa-modalidad.js, profileRows de Técnica).
const AREAS_MAPA=new Set(['Lengua y Literatura','Matemática','Lengua Adicional','Ciencias Naturales',
  'Ciencias Sociales','Educación Artística','Educación Física','Tecnología de la Representación',
  'Taller del Primer Ciclo','Formación Técnico-Específica','Prácticas Profesionalizantes','Otros formatos pedagógicos']);
const especialidades=(await readdir(new URL('data/tecnica/priorizados/',raiz)))
  .map(f=>f.replace(/\.json$/,'')).filter(id=>id!=='tecnologia_representacion');

test('las 26 especialidades no tienen contenidos fuera de las áreas del mapa',async()=>{
  assert.equal(especialidades.length,26);
  for(const id of especialidades){
    const perfil=await loadV2ModalProfile({model:'tecnica',specialty:id});
    const fuera=[...perfil.contents.fg,...perfil.contents.fo].filter(c=>!AREAS_MAPA.has(c.area));
    assert.equal(fuera.length,0,id+': '+fuera.length+' contenidos en áreas no visibles ('+
      [...new Set(fuera.map(c=>c.area))].join(', ')+')');
  }
});

test('el campo Científico-Tecnológico conserva su rastro en field y se ubica en Especialidad',async()=>{
  const perfil=await loadV2ModalProfile({model:'tecnica',specialty:'computacion'});
  const fct=[...perfil.contents.fg,...perfil.contents.fo].filter(c=>
    /^(Econom[ií]a y Gesti[oó]n de las Organizaciones|Gesti[oó]n de los Procesos Productivos|Taller de Tecnolog[ií]a y Control)$/.test(c.subject));
  assert.ok(fct.length>0,'Computación tiene materias del campo Científico-Tecnológico');
  assert.ok(fct.every(c=>c.field==='formacion_cientifico_tecnologica'),'Se conserva el campo de origen');
  assert.ok(fct.every(c=>c.area==='Formación Técnico-Específica'),'Se desarrollan dentro de Especialidad');
});
