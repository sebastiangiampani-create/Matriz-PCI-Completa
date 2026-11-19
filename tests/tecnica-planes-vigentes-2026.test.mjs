import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const index=read('data/tecnica/planes-vigentes/indice-fuentes-oficiales.json');
const computer=read('data/tecnica/planes-vigentes/computacion-res80-2026.json');
const priors=read('data/tecnica/fuentes-priorizadas-caba-2026.json');
const years=[3,4,5,6];
test('No reemplazar contenidos priorizados por planes de estudio ni inventar fuentes para 23 especialidades',()=>{
 assert.equal(index.especialidades.length,26);
 assert.deepEqual(new Set(index.especialidades.map(x=>x.id)),
   new Set(priors.especialidades.map(x=>x.id)));
 assert.equal(index.disenos_con_caja_extraida,1);
 assert.equal(index.normas_verificadas,3);
 assert.equal(index.especialidades.filter(x=>x.horas_semanales_verificadas).length,1);
 for(const x of index.especialidades.filter(x=>!x.horas_semanales_verificadas))
  assert.equal(x.estructura_archivo,undefined);
});
test('Computación 2026: las cuatro columnas del Segundo Ciclo corresponden a 3º–6º',()=>{
 assert.equal(computer.especialidad_id,'computacion');
 assert.equal(computer.schema,'pci-tecnica-plan-vigente-v1');
 assert.equal(computer.vigencia_desde,2026);
 assert.match(computer.norma,/80\/MEDGC\/2026/);
 assert.match(computer.fuente.url,/MEDGC-80-26-ANX-2\.pdf$/);
 assert.equal(computer.unidades.length,32);
 for(const x of computer.unidades){
  assert.ok(['DET+DGEGP','DET','DGEGP'].includes(x.criterio));
  assert.ok(['formacion_general','formacion_cientifico_tecnologica',
   'formacion_tecnica_especifica','practicas_profesionalizantes'].includes(x.campo));
  for(const key of Object.keys(x.horas_catedra_semanales)){
   assert.ok(years.includes(Number(key)));
   assert.ok(Number.isSafeInteger(x.horas_catedra_semanales[key]));
   assert.ok(x.horas_catedra_semanales[key]>0);
  }
 }
});
test('Distinción DET y DGEGP: no intercambiar proyectos o prácticas ni horas',()=>{
 for(const criterio of ['DET','DGEGP']){
  const sum=years.map(year=>computer.unidades.filter(u=>u.criterio==='DET+DGEGP'||u.criterio===criterio)
   .reduce((acc,u)=>acc+(u.horas_catedra_semanales[year]||0),0));
  assert.deepEqual(sum,years.map(year=>computer.horas_semanales_por_anio[criterio][year]));
 }
 assert.deepEqual(years.map(y=>computer.horas_semanales_por_anio.DET[y]),[46,46,48,46]);
 assert.deepEqual(years.map(y=>computer.horas_semanales_por_anio.DGEGP[y]),[46,46,46,46]);
 assert.equal(computer.unidades.find(u=>u.id==='pp_1').criterio,'DET');
 assert.equal(computer.unidades.find(u=>u.id==='proyecto_informatico_2').criterio,'DGEGP');
 assert.equal(computer.unidades.find(u=>u.id==='pp_dgegp').criterio,'DGEGP');
 assert.deepEqual(computer.horas_reloj_segundo_ciclo,{DET:4464,DGEGP:4416});
});
test('La referencia curricular por hora no se guarda automáticamente ni crea PCI escolares',()=>{
 assert.ok(computer.advertencias.some(a=>/no se aplica automáticamente/i.test(a)));
 assert.ok(index.especialidades.every(x=>x.priorizados_url.startsWith('https://static.buenosaires.gob.ar/')));
 const joined=JSON.stringify({computer,index});
 assert.ok(!/secret|service_role|access_token|password/.test(joined));
});
