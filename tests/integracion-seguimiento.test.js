import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrientationPackage} from '../src/integracion-curricular/bridge.js';
import {curriculumTracking} from '../src/integracion-curricular/seguimiento.js';

const fakeMatrix=[
  {id:'econ',subject:'Economía',area:'Ciencias Sociales',text:'Los intercambios'},
  {id:'hist',subject:'Historia',area:'Ciencias Sociales',text:'Transformaciones de la ciudad'},
  {id:'old',subject:'Economía',area:'Ciencias Sociales',text:'Contenido anterior sin equivalente'},
  {id:'mate',subject:'Matemática',area:'Matemática',text:'Sucesiones'}
];
const fg=[
  {id:'e3',year:3,area:'Ciencias Sociales',subject:'Economía',text:'Los intercambios'},
  {id:'h3',year:3,area:'Ciencias Sociales',subject:'Historia',text:'Transformaciones de la ciudad'},
  {id:'g3',year:3,area:'Ciencias Sociales',subject:'Geografía',text:'Territorios'},
  {id:'m3',year:3,area:'Matemática',subject:'Matemática',text:'Sucesiones'},
  {id:'e4',year:4,area:'Ciencias Sociales',subject:'Economía',text:'Los intercambios'}
];
const fo=[
  {id:'fo-one',orientation:'Economía y Administración',variant:'',block:'Economía de la Orientación',text:'Producción'},
  {id:'fo-two',orientation:'Economía y Administración',variant:'',block:'Organizaciones',text:'Gestión'},
  {id:'other',orientation:'Ciencias Naturales',variant:'',block:'Ciencia',text:'Método'}
];
const orientations=[{id:'economia_administracion',name:'Economía y Administración'},
  {id:'ciencias_naturales',name:'Ciencias Naturales'}];
function original(){
  return {schoolName:'Escuela de prueba',schemaVersion:10,areas:{
    'Ciencias Sociales':{groups:[
      {id:'s1',name:'Laboratorio Sociales C5',kind:'laboratory',level:3,startTerm:5,endTerm:5,
        curricularSubjects:['Economía','Historia'],
        items:['econ','hist','old'],
        plansBimestrales:[{number:1,name:'Secuencia histórica',
          contentIds:['econ','hist','econ'],objectives:'Comprender intercambios',
          stages:{
            punto_partida:{description:'Preguntar'},
            indagacion:{description:'Leer documentos'},
            produccion:{description:'Escribir'},
            evaluacion:{description:'Argumentar'}
          }}
        ]},
      {id:'s2',name:'Laboratorio Sociales C6',kind:'laboratory',level:3,startTerm:6,endTerm:6,
        items:['hist'],plansBimestrales:[{number:1,name:'Segunda secuencia',contentIds:['hist'],
          stages:{punto_partida:{description:''}}}]}
    ]},
    'Matemática':{groups:[{
      id:'m3',name:'Matemática de 3.º',kind:'trunk',level:3,startTerm:5,endTerm:6,
      curricularSubjects:['Matemática'],items:['mate'],plansBimestrales:[]
    }]}
  }};
}
const make=()=>{
  const pack=createOrientationPackage({legacyState:original(),schoolId:1001,
    orientationIds:['economia_administracion','ciencias_naturales']});
  pack.orientations.economia_administracion.fo.spaces=[
    {id:'fo3',year:3,term:5,name:'FO C5',kind:'laboratorio',
      contentIds:['fo-one'],provisionalContentIds:['fo-two'],members:[{id:'orga'}]},
    {id:'fo4',year:4,term:7,name:'FO C7',kind:'laboratorio',
      contentIds:['fo-one'],provisionalContentIds:['fo-two'],members:[]}
  ];
  return pack;
};
const report=pack=>curriculumTracking({
  pack,orientationId:'economia_administracion',
  matrixRows:fakeMatrix,v2FgRows:fg,v2FoRows:fo,orientations
});
test('nivel y materia cuentan contenido único de laboratorios paralelos',()=>{
  const result=report(make());
  const social=result.fg.areasByLevel.find(r=>r.area==='Ciencias Sociales'&&r.year===3);
  assert.equal(social.used,2);
  assert.equal(social.total,3);
  assert.equal(social.confirmedPercent,null);
  assert.equal(social.mappedPercentMinimum,66.7);
  const hist=result.fg.subjectsByLevel.find(r=>r.subject==='Historia');
  assert.equal(hist.used,1);
  assert.equal(hist.total,1);
  assert.equal(hist.confirmedPercent,100);
  const econ=result.fg.subjectsByLevel.find(r=>r.subject==='Economía');
  assert.equal(econ.used,1);
  assert.equal(econ.confirmedPercent,null);
});
test('agrupamiento con materias explícitas y otro sin homologación no se confunden',()=>{
  const result=report(make()),groups=result.fg.groupings;
  const first=groups.find(r=>r.groupId==='s1'),second=groups.find(r=>r.groupId==='s2');
  assert.equal(first.denominatorType,'materias-explicitas');
  assert.equal(first.total,2);
  assert.equal(first.status,'pending-homologation');
  assert.equal(first.confirmedPercent,null);
  assert.equal(second.denominatorType,'area-nivel-provisional');
  assert.equal(second.total,3);
  assert.equal(second.confirmedPercent,null);
  assert.equal(second.status,'pending-group-membership');
  assert.equal(first.plans[0].stageCountWithWork,4);
});
test('planes no duplican contenidos y muestran cobertura dentro del laboratorio',()=>{
  const result=report(make());
  const one=result.fg.plans.find(p=>p.name==='Secuencia histórica');
  assert.equal(one.legacyContents,2);
  assert.equal(one.inGroup,2);
  assert.equal(one.groupContents,3);
  assert.equal(one.localPercent,66.7);
  assert.equal(one.stageCountWithWork,4);
  assert.equal(one.hasTeachingSequence,true);
  assert.equal(result.fg.preservedPlanCount,2);
  assert.equal(result.fg.preservedTeachingSequences,1);
});
test('formato suma contenidos de espacios sin duplicar entre cuatrimestres',()=>{
  const result=report(make());
  const socialLab=result.fg.formatsByLevel.find(f=>f.area==='Ciencias Sociales'&&f.year===3&&f.format==='Laboratorio');
  assert.equal(socialLab.used,2);
  assert.equal(socialLab.groups,2);
  assert.equal(socialLab.total,3);
  assert.equal(socialLab.confirmedPercent,null);
});
test('FO se mide por trayectoria; no inventa cobertura anual',()=>{
  const result=report(make());
  assert.equal(result.fo.basis,'trayectoria');
  assert.equal(result.fo.used,1);
  assert.equal(result.fo.total,2);
  assert.equal(result.fo.percent,50);
  assert.equal(result.fo.provisionalAssignments,2);
  assert.equal(result.fo.spaces.length,2);
  assert.ok(result.fo.spaces.every(s=>s.yearCoveragePercent===null));
  assert.ok(result.warnings.some(x=>x.includes('Formación Orientada')));
});
test('orientaciones no comparten decisiones, porcentajes ni secuencias',()=>{
  const pack=make();
  const econ=report(pack);
  const natural=curriculumTracking({
    pack,orientationId:'ciencias_naturales',
    matrixRows:fakeMatrix,v2FgRows:fg,v2FoRows:fo,orientations
  });
  assert.equal(econ.fo.used,1);
  assert.equal(natural.fo.used,0);
  assert.equal(econ.fo.total,2);
  assert.equal(natural.fo.total,1);
  assert.equal(econ.fg.preservedPlanCount,natural.fg.preservedPlanCount);
  assert.deepEqual(pack.orientations.economia_administracion.fg.areas,
    pack.orientations.ciencias_naturales.fg.areas);
});
