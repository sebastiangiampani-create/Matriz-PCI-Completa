import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateFgComposition} from '../src/integracion-curricular/reglas-composicion-fg.js';
import {createOrientationPackage} from '../src/integracion-curricular/bridge.js';
import {seedOfferStructure,validateOfferStructure} from '../src/integracion-curricular/mapa-oferta.js';

const dir='data/integracion-curricular/referencia-v2/';
const refs=Object.fromEntries([
  ['rules','reglas-v2.json'],['subjects','materias-v2.json'],
  ['hours','horas-v2.json'],['catalog','catalogo-orientaciones.json']
].map(([key,path])=>[key,JSON.parse(readFileSync(dir+path,'utf8'))]));
const lab='laboratory',workshop='workshop';
const slot=(area,kind,term,index)=>{
  const year=Math.ceil(term/2);
  return {id:area+'-'+index,name:area+' '+index,kind,
    level:year,startTerm:term,endTerm:term,items:[],
    plansBimestrales:[]};
};
function fullStructure(){
  const areas={};
  for(const area of ['Matemática','Lengua y Literatura','Lenguas Adicionales'])
    areas[area]={groups:Array.from({length:5},(_,i)=>({
      id:area+'-'+i,name:area+' '+(i+1),kind:'trunk',level:i+1,
      startTerm:i*2+1,endTerm:i*2+2,items:[],plansBimestrales:[]
    }))};
  for(const [area,kind,terms] of [
    ['Ciencias Naturales',lab,[1,2,3,4,5,6,7,8,9,10]],
    ['Ciencias Sociales',lab,[1,2,3,4,5,5,6,6,7,8,9,10]],
    ['Artes',workshop,[1,2,3,4,7,8]],
    ['Tecnologías',workshop,[1,2,3,4,5,6,7,8]],
    ['Educación Física',workshop,[1,2,3,4,5,6,7,8,9,10]]
  ])areas[area]={groups:terms.map((term,i)=>slot(area,kind,term,i+1))};
  return areas;
}
test('valida la estructura completa de V2 sin rearmar los agrupamientos de Matriz',()=>{
  const areas=fullStructure(),before=structuredClone(areas);
  const r=validateFgComposition(areas,refs);
  assert.equal(r.errors.length,0);
  assert.ok(r.warnings.length>0,'Matriz aún no identifica las materias estructurales');
  assert.equal(r.valid,false);
  assert.deepEqual(areas,before);
});
test('detecta 11 laboratorios Sociales, Naturales incompleta y troncales entre niveles',()=>{
  const areas=fullStructure();
  areas['Ciencias Sociales'].groups.pop();
  areas['Ciencias Naturales'].groups.pop();
  areas.Matemática.groups[2].endTerm=9;
  const audit=validateFgComposition(areas,refs);
  assert.ok(audit.errors.some(x=>x.includes('10 o 12')));
  assert.ok(audit.errors.some(x=>x.includes('Ciencias Naturales')));
  assert.ok(audit.errors.some(x=>x.includes('nivel/cuatrimestres anuales incorrectos')));
});
test('Sociales 3.º opción B respeta parejas de C5-C6 al confirmar materias',()=>{
  const areas=fullStructure(),s=areas['Ciencias Sociales'].groups.filter(g=>g.level===3);
  const A=['Economía','Historia'],B=['Geografía','Formación Ética y Ciudadana'];
  s.filter(g=>g.startTerm===5).forEach((g,i)=>{
    g.curricularSubjects=i===0?A:B;g.compositionReviewed=true;
  });
  s.filter(g=>g.startTerm===6).forEach((g,i)=>{
    g.curricularSubjects=i===0?A:B;g.compositionReviewed=true;
  });
  const valid=validateFgComposition(areas,refs);
  assert.equal(valid.errors.length,0);
  s.find(g=>g.startTerm===6).curricularSubjects=['Economía','Geografía'];
  const wrong=validateFgComposition(areas,refs);
  assert.ok(wrong.errors.some(x=>x.includes('misma conformación')));
});
test('una composición aprobada de un laboratorio no puede exceder 9 HC',()=>{
  const areas=fullStructure(),s=areas['Ciencias Sociales'].groups.find(g=>g.level===3);
  s.curricularSubjects=['Economía','Historia','Geografía','Formación Ética y Ciudadana'];
  s.compositionReviewed=true;
  const reasonable=validateFgComposition(areas,refs);
  assert.ok(!reasonable.errors.some(x=>x.includes('supera las 9 horas')));
  // Repetition is also forbidden and must be reported.
  s.curricularSubjects=['Economía','Economía','Historia','Geografía'];
  const duplicate=validateFgComposition(areas,refs);
  assert.ok(duplicate.errors.some(x=>x.includes('materias repetidas')));
});
test('validar oferta agrega los errores FG y FO sin tocar los planes existentes',()=>{
  const areas=fullStructure(),source={schemaVersion:10,schoolName:'Ejemplo',areas};
  const before=structuredClone(source);
  let p=createOrientationPackage({
    legacyState:source,schoolId:1001,orientationIds:['economia_administracion']
  });
  p=seedOfferStructure(p,'economia_administracion',refs);
  const result=validateOfferStructure(p,'economia_administracion',refs);
  assert.equal(result.fgUnchanged,true);
  assert.equal(result.fgValidation.errors.length,0);
  assert.ok(result.errors.length>0);
  assert.ok(result.warnings.some(x=>x.includes('homologar')));
  assert.deepEqual(source,before);
});
