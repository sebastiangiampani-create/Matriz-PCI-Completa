import test from 'node:test';
import assert from 'node:assert/strict';
import {projectMediaWorkspaceForFinalValidation,validateMediaWorkspaceFinal}
 from '../src/normativa/adaptador-mapa-media-20261117.mjs';

const data=(orientationId='economia_administracion',{socialOption='A'}={})=>{
 const areas={};
 function add(area,kind,year,term,duration='cuatrimestral'){
  if(!areas[area])areas[area]={groups:[]};
  const n=areas[area].groups.length;
  areas[area].groups.push({
   id:'grupo-'+area+'-'+n,level:year,startTerm:term,
   endTerm:duration==='anual'?term+1:term,kind,
   name:area+' · '+year+'º',items:[{id:'LEGADO-'+area+'-'+n}],
   plansBimestrales:[{name:'Plan 1',objectives:'Trabajo original de la escuela',
    stages:{punto_partida:{description:'NO MODIFICAR'},indagacion:{description:''},
      produccion:{description:''},evaluacion:{description:''}}}]
  });
 }
 for(const area of ['Matemática','Lengua y Literatura','Lenguas Adicionales'])
  for(let year=1;year<=5;year++)add(area,'trunk',year,year*2-1,'anual');
 for(let year=1;year<=5;year++)for(let half=1;half<=2;half++)
  add('Ciencias Sociales','laboratory',year,year*2-2+half);
 if(socialOption==='B'){
  add('Ciencias Sociales','laboratory',3,5);
  add('Ciencias Sociales','laboratory',3,6);
 }
 const nYears=orientationId==='ciencias_naturales'?4:5;
 for(let year=1;year<=nYears;year++)for(let half=1;half<=2;half++)
  add('Ciencias Naturales','laboratory',year,year*2-2+half);
 for(let year=1;year<=5;year++)for(let half=1;half<=2;half++)
  add('Educación Física','workshop',year,year*2-2+half);
 for(const year of [1,2,4])for(let half=1;half<=2;half++)
  add('Artes','workshop',year,year*2-2+half);
 for(const year of [1,2,3,4])for(let half=1;half<=2;half++)
  add('Tecnologías','workshop',year,year*2-2+half);
 const spaces=[];
 for(const year of [3,4,5]){
  const number=year===5?2:1;
  for(let i=0;i<number;i++)for(const kind of ['laboratorio','taller'])
   spaces.push({id:'fo-'+kind+'-'+year+'-'+i,year,kind,term:year*2-1+i,
    startTerm:year*2-1+i,endTerm:year*2-1+i,name:kind+' '+year, members:[],
    plansBimestrales:[{name:'Plan de escuela',synopsis:'NO BORRAR'}]});
 }
 spaces.push({id:'fo-proyecto-5-1',year:5,kind:'proyecto',term:9,
  startTerm:9,endTerm:10,members:[{name:'Proyecto anual original',hours:3}],
  plansBimestrales:[{name:'Plan original PVF'}]});
 return {version:'pci-integracion/1',orientations:{
  [orientationId]:{id:orientationId,name:orientationId,fg:{areas},fo:{spaces}}
 }};
};
test('Media: mismo mapa de 10 cuatrimestres, FG y FO intactas, PVF anual único',()=>{
 const original=data(),before=JSON.stringify(original);
 const projection=projectMediaWorkspaceForFinalValidation(original,'economia_administracion');
 assert.equal(projection.sourceSchema,'pci-integracion/1');
 assert.equal(projection.explicitFgCompositions,0,'No inferir homologación de materias');
 assert.equal(projection.spaces.filter(s=>s.format==='troncal').length,15);
 assert.equal(projection.spaces.filter(s=>s.format==='laboratorio_social').length,10);
 assert.equal(projection.spaces.filter(s=>s.format==='laboratorio_natural').length,10);
 assert.equal(projection.spaces.filter(s=>s.format==='laboratorio_orientacion').length,4);
 assert.equal(projection.spaces.filter(s=>s.format==='taller_orientacion').length,4);
 assert.equal(projection.spaces.filter(s=>s.format==='vinculacion_futuro').length,1);
 const check=validateMediaWorkspaceFinal(original,'economia_administracion');
 assert.equal(check.structurallyConsistent,true,JSON.stringify(check.errors));
 assert.equal(check.legacyPreserved,true);
 assert.equal(check.readyForPublication,false);
 assert.ok(check.warnings.some(s=>s.code==='BACH_SOCIAL_EIO_PENDING'));
 assert.equal(JSON.stringify(original),before,'No modificar ni una etapa de escuela');
});
test('Media: opción de 12 Sociales en tercero no cambia las áreas históricas',()=>{
 const original=data('economia_administracion',{socialOption:'B'});
 const check=validateMediaWorkspaceFinal(original,'economia_administracion');
 assert.equal(check.counts.socials,12);
 assert.equal(check.structurallyConsistent,true,JSON.stringify(check.errors));
 assert.equal(original.orientations.economia_administracion.fg.areas['Ciencias Sociales'].groups.length,12);
});
test('Media Ciencias Naturales: 8 laboratorios hasta cuarto, no 10, con advertencia curricular',()=>{
 const original=data('ciencias_naturales');
 const check=validateMediaWorkspaceFinal(original,'ciencias_naturales');
 assert.equal(check.counts.naturals,8);
 assert.equal(check.structurallyConsistent,true,JSON.stringify(check.errors));
 assert.equal(check.readyForPublication,false);
});
test('Media: una fuente sin año ni materias revisadas NO se certifica por tener grupos completos',()=>{
 const original=data();
 const r=validateMediaWorkspaceFinal(original,'economia_administracion');
 assert.equal(r.valid,false);
 assert.ok(r.warnings.some(e=>e.code==='OFFICIAL_PLAN_REQUIRED'));
 assert.equal(r.explicitFgCompositions,0);
});
test('Media: una orientación o área no homologada se identifica, nunca se pierde',()=>{
 const original=data();
 original.orientations.economia_administracion.fg.areas['Otros formatos pedagógicos']={
  groups:[{id:'antiguo-institucional',items:['contenido-que-no-puede-perderse'],
   plansBimestrales:[{synopsis:'Secuencia original'}]}]
 };
 const before=JSON.stringify(original);
 const result=validateMediaWorkspaceFinal(original,'economia_administracion');
 assert.ok(result.warnings.some(x=>x.code==='AREA_NOT_HOMOLOGATED'));
 assert.equal(JSON.stringify(original),before);
});
