import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 technicalOfferSeed,technicalSubjectBank,technicalSubjectCards,placeTechnicalSubject
} from '../src/tecnica/espacio-trabajo-v2.mjs';
import {
 crearBorradorBa15,crearEspacioBa15,asignarMateriaBa15,validarBorradorBa15
} from '../src/ba15/constructor.mjs';

const sha='a'.repeat(64);
const pci={pci_id:'pci-turno-tarde-tecnica',school_id:1001,
 orientation_id:'especialidad-computacion',specialty_name:'Computación',
 process_id:'proceso-test',legacy_sha256:sha,model:'tecnica'};
const file={especialidad_id:'computacion',sha256_pdf:'b'.repeat(64),asignaturas:[
 {id:'computacion-matematica',asignatura:'Matemática',
  campo_estimado:'formacion_general',anios_detectados:[1,2],paginas:[
   {pagina_pdf:3,anio_contextual_inferido:1,texto_pagina:'Matemática 1.º'},
   {pagina_pdf:4,anio_contextual_inferido:2,texto_pagina:'Matemática 2.º'}]},
 {id:'computacion-sin-ano',asignatura:'Materia sin nivel',
  campo_estimado:'formacion_tecnica_especifica',anios_detectados:[],paginas:[
   {pagina_pdf:55,texto_pagina:'Sin año verificable'}]}
 ]};

test('Técnica: la bolsa contiene materias, no una tarjeta por página de contenido',()=>{
 const bank=technicalSubjectBank(file);
 const subjects=technicalSubjectCards(bank);
 assert.equal(bank.filter(x=>x.name==='Matemática').length,2);
 assert.equal(subjects.filter(x=>x.name==='Matemática').length,2);
 assert.equal(subjects.filter(x=>x.name==='Matemática'&&x.year===1).length,1);
 assert.equal(subjects.filter(x=>x.name==='Materia sin nivel').length,0);
});
test('Técnica: drag de materia a C1 sin insertar ni borrar contenidos o planes',()=>{
 const bank=technicalSubjectBank(file);
 const previous=technicalOfferSeed({pci,source:file});
 const before=structuredClone(previous);
 const subject=technicalSubjectCards(bank,{year:1}).find(x=>x.name==='Matemática');
 const next=placeTechnicalSubject(previous,{spaceId:'t-matematica-1',subjectKey:subject.key,bank});
 assert.ok(next.spaces.find(x=>x.id==='t-matematica-1').subjectIds.includes(subject.id));
 assert.deepEqual(next.spaces.find(x=>x.id==='t-matematica-1').contentIds,[]);
 assert.deepEqual(previous,before);
 assert.throws(()=>placeTechnicalSubject(previous,{spaceId:'t-matematica-2',
  subjectKey:subject.key,bank}),/nivel/);
 assert.throws(()=>placeTechnicalSubject(previous,{spaceId:'t-lengua_literatura-1',
  subjectKey:subject.key,bank}),/corresponde/);
});
test('BA +15: la composición se limita al PCI del turno; el desarrollo ya existente se conserva',()=>{
 const context={pciId:'pci-ba15-noche',schoolId:1001,orientationId:'turismo',shiftId:'noche'};
 let a=crearBorradorBa15(context);
 const untouched=crearBorradorBa15({...context,pciId:'pci-media-manana',shiftId:'manana'});
 const n=a.niveles[0].asignaturas[0];
 a=crearEspacioBa15(a,{nivel:1,term:1,nombre:n.nombre,formato:'troncal'});
 const space=a.niveles[0].espacios.at(-1);
 a=asignarMateriaBa15(a,{nivel:1,espacioId:space.id,materiaId:n.id});
 assert.equal(a.niveles[0].espacios[0].miembros.length,1);
 assert.equal(a.niveles[0].espacios[0].planes.length,4);
 assert.deepEqual(untouched.niveles.map(x=>x.espacios.length),[0,0,0,0]);
 assert.equal(validarBorradorBa15(a).valido,false,'La Fase 2 no se abre con mapa incompleto');
});
test('UI: las tres Fases 1 usan arrastre, no contenidos priorizados',async()=>{
 const media=await readFile(new URL('../src/constructor-v2-ui.mjs',import.meta.url),'utf8');
 const ba15=await readFile(new URL('../src/ba15/constructor-ui.mjs',import.meta.url),'utf8');
 const technical=await readFile(new URL('../src/tecnica/interfaz-integrada-v2.mjs',import.meta.url),'utf8');
 const online=await readFile(new URL('../src/orientaciones-online.mjs',import.meta.url),'utf8');
 assert.match(media,/dragstart/);
 assert.match(ba15,/function makeDropTarget/);
 assert.match(technical,/technicalSubjectCards\(bank/);
 assert.match(technical,/setupSubjectDrop/);
 assert.match(online,/\$\('confirmFoContents'\)\.hidden=true/);
 assert.match(online,/Contenidos priorizados del plan/);
 assert.match(technical,/Fase 2: materiales y contenidos se eligen aquí/);
});
