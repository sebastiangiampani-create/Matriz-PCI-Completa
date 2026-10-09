import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRIDGE_VERSION,FG_MODES,ORIENTATIONS,createOrientationPackage,
  chooseFgMode,getFgDecision,inspectIntegration,registerFoSpace,
  previewArticulation,queueReview
} from '../src/integracion-curricular/bridge.js';

function existingSchool() {
  return {
    schemaVersion:10,schoolName:'Escuela de prueba',
    areas:{
      'Ciencias Sociales':{groups:[{
        id:'social-3-c5',name:'Laboratorio de Ciencias Sociales 3.º',
        kind:'laboratory',level:3,startTerm:5,endTerm:5,
        items:['contenido:historia','contenido:economia'],
        objective:'Comprender transformaciones económicas',
        context:'Contexto escolar existente',
        synopsis:'Trabajo interdisciplinario',
        plansBimestrales:[{
          number:1,name:'Una secuencia que ya estaba hecha',
          synopsis:'Sinopsis de la secuencia',
          contentIds:['contenido:historia','contenido:economia'],
          objectives:'Analizar procesos económicos y sociales',
          stages:{
            punto_partida:{description:'Explorar ideas',duration:'20 min',resources:'Preguntas',activities:'Conversar'},
            indagacion:{description:'Buscar fuentes',duration:'2 clases',resources:'Textos',activities:'Leer'},
            produccion:{description:'Elaborar un afiche',duration:'2 clases',resources:'Cartulina',activities:'Diseñar'},
            evaluacion:{description:'Criterios de revisión',duration:'1 clase',resources:'Rúbrica',activities:'Autoevaluar'}
          },updatedAt:'2026-09-30T12:00:00Z'
        }]
      }]},
      'Ciencias Naturales':{groups:[{
        id:'natural-3-c5',name:'Laboratorio de Naturales 3.º',
        kind:'laboratory',level:3,startTerm:5,endTerm:5,
        items:['contenido:biologia'],plansBimestrales:[]
      }]},
      'Matemática':{groups:[{
        id:'mat-3',name:'Troncal de Matemática 3.º',
        kind:'trunk',level:3,startTerm:5,endTerm:6,
        items:['contenido:algebra'],plansBimestrales:[]
      }]}
    }
  };
}
const THREE=['economia_administracion','ciencias_sociales_humanidades','ciencias_naturales'];
const packageFor=(legacyState=existingSchool())=>createOrientationPackage({
  legacyState,schoolId:1001,orientationIds:THREE
});
function withEconomiaFo(pkg){
  return registerFoSpace(
    chooseFgMode(pkg,'economia_administracion',FG_MODES.REVISAR),
    'economia_administracion',
    {id:'fo-economia-n3',name:'Laboratorio FO de Economía',kind:'laboratorio',year:3}
  );
}

test('catalogo de orientaciones es independiente de la base institucional',()=>{
  assert.equal(BRIDGE_VERSION,'pci-integracion/1');
  assert.ok(ORIENTATIONS.length>=14);
  assert.ok(ORIENTATIONS.some(o=>o.id==='economia_administracion'));
});

test('tres orientaciones reciben la FG completa con planes y cuatro etapas',()=>{
  const original=existingSchool(),before=structuredClone(original);
  const pkg=packageFor(original);
  assert.deepEqual(original,before,'El origen no se modifica');
  for(const id of THREE){
    assert.deepEqual(pkg.orientations[id].fg.areas,original.areas);
    assert.equal(pkg.orientations[id].fg.mode,FG_MODES.CONSERVAR);
    assert.deepEqual(pkg.orientations[id].fo.spaces,[]);
    const plan=pkg.orientations[id].fg.areas['Ciencias Sociales'].groups[0].plansBimestrales[0];
    assert.equal(plan.name,'Una secuencia que ya estaba hecha');
    assert.deepEqual(Object.keys(plan.stages),
      ['punto_partida','indagacion','produccion','evaluacion']);
    assert.equal(plan.stages.indagacion.activities,'Leer');
  }
  const audit=inspectIntegration(original,pkg);
  assert.equal(audit.legacyUntouched,true);
  assert.equal(audit.original.plans,1);
  assert.equal(audit.original.stagesWithWork,4);
  assert.equal(audit.orientations.economia_administracion.countPreserved,true);
  assert.equal(audit.orientations.economia_administracion.linkedGroups,3);
});

test('al seleccionar conservar no se modifica ninguna orientacion',()=>{
  const original=existingSchool(),pkg=packageFor(original);
  const kept=chooseFgMode(pkg,'economia_administracion','conservar');
  assert.deepEqual(kept.orientations.economia_administracion.fg.areas,original.areas);
  assert.deepEqual(original,existingSchool());
  assert.deepEqual(pkg,packageFor(original));
  const msg=getFgDecision(kept,'economia_administracion');
  assert.equal(msg.selected,FG_MODES.CONSERVAR);
  assert.match(msg.title,/Formación General/);
  assert.equal(msg.options.length,2);
});

test('al seleccionar revisar solo esa orientacion cambia de modo',()=>{
  const pkg=packageFor(),revised=chooseFgMode(pkg,'economia_administracion','revisar');
  assert.equal(revised.orientations.economia_administracion.fg.mode,'revisar');
  assert.equal(revised.orientations.ciencias_sociales_humanidades.fg.mode,'conservar');
  assert.equal(revised.orientations.ciencias_naturales.fg.mode,'conservar');
  assert.equal(pkg.orientations.economia_administracion.fg.mode,'conservar');
  assert.deepEqual(revised.orientations.economia_administracion.fg.areas,
    pkg.orientations.economia_administracion.fg.areas);
});

test('una edicion de FG copiada no se propaga a otras orientaciones ni al origen',()=>{
  const original=existingSchool(),pkg=packageFor(original);
  const edited=chooseFgMode(pkg,'economia_administracion','revisar');
  edited.orientations.economia_administracion.fg.areas['Ciencias Sociales'].groups[0].name='Nuevo agrupamiento para Economía';
  assert.equal(original.areas['Ciencias Sociales'].groups[0].name,'Laboratorio de Ciencias Sociales 3.º');
  assert.equal(pkg.orientations.economia_administracion.fg.areas['Ciencias Sociales'].groups[0].name,'Laboratorio de Ciencias Sociales 3.º');
  assert.equal(edited.orientations.ciencias_sociales_humanidades.fg.areas['Ciencias Sociales'].groups[0].name,'Laboratorio de Ciencias Sociales 3.º');
});

test('reseleccionar la orientacion no reconstruye su FG ni sobrescribe planes',()=>{
  const original=existingSchool();
  let pkg=chooseFgMode(packageFor(original),'economia_administracion','revisar');
  pkg.orientations.economia_administracion.fg.areas['Ciencias Sociales'].groups[0].plansBimestrales[0].name='Plan revisado por la orientación';
  const again=createOrientationPackage({
    legacyState:original,schoolId:1001,
    orientationIds:['economia_administracion','economia_administracion'],existing:pkg
  });
  assert.equal(again.orientations.economia_administracion.fg.areas['Ciencias Sociales'].groups[0].plansBimestrales[0].name,'Plan revisado por la orientación');
  assert.deepEqual(again,pkg);
});

test('agregar una cuarta orientacion no resetea las tres anteriores',()=>{
  const original=existingSchool(),initial=chooseFgMode(packageFor(original),'economia_administracion','revisar');
  const extended=createOrientationPackage({
    legacyState:original,schoolId:1001,orientationIds:['comunicacion'],existing:initial
  });
  assert.equal(extended.orientations.economia_administracion.fg.mode,'revisar');
  assert.equal(extended.orientations.comunicacion.fg.mode,'conservar');
  assert.deepEqual(extended.orientations.comunicacion.fg.areas,original.areas);
  assert.equal(Object.keys(extended.orientations).length,4);
});

test('si la FG original cambia se bloquea la reimportacion automatica',()=>{
  const original=existingSchool(),pkg=packageFor(original);
  const changed=structuredClone(original);
  changed.areas.Matemática.groups[0].objective='Nueva decisión';
  assert.throws(()=>createOrientationPackage({
    legacyState:changed,schoolId:1001,orientationIds:['comunicacion'],existing:pkg
  }),/conciliación/);
  assert.equal(inspectIntegration(changed,pkg).legacyUntouched,false);
});

test('bloquea estado técnico y datos estructurales ambiguos',()=>{
  const technical=existingSchool();technical.profile='tecnica';
  assert.throws(()=>packageFor(technical),/técnico/);
  const broken=existingSchool();
  broken.areas['Ciencias Sociales'].groups.push(structuredClone(broken.areas['Ciencias Sociales'].groups[0]));
  assert.throws(()=>packageFor(broken),/duplicados/);
  assert.throws(()=>createOrientationPackage({
    legacyState:existingSchool(),schoolId:1001,orientationIds:['orientacion_inexistente']
  }),/desconocida/);
  assert.throws(()=>createOrientationPackage({
    legacyState:existingSchool(),schoolId:1002,orientationIds:THREE,existing:packageFor()
  }),/otra escuela/);
});

test('vista previa exige revision y un destino FO real del mismo año',()=>{
  const pkg=packageFor();
  const request={orientationId:'economia_administracion',area:'Ciencias Sociales',
    groupId:'social-3-c5',foSpaceId:'fo-economia-n3',subject:'Economía',year:3};
  assert.throws(()=>previewArticulation(pkg,request),/revisar/);
  const reviewing=chooseFgMode(pkg,'economia_administracion','revisar');
  assert.throws(()=>previewArticulation(reviewing,request),/todavía no fue creado/);
  assert.throws(()=>registerFoSpace(reviewing,'economia_administracion',{
    id:'fo-economia-n3',kind:'laboratorio',year:2
  }),/3.º a 5.º/);
  const fo=registerFoSpace(reviewing,'economia_administracion',{
    id:'fo-economia-n3',kind:'laboratorio',year:3
  });
  const preview=previewArticulation(fo,request);
  assert.equal(preview.canApply,false);
  assert.equal(preview.status,'pending-review');
  assert.equal(preview.affectedPlans.length,1);
  assert.deepEqual(preview.affectedPlans[0].stagesWithWork,
    ['punto_partida','indagacion','produccion','evaluacion']);
  assert.ok(preview.notices.some(n=>n.title==='Revisar laboratorio'));
  assert.ok(preview.notices.filter(n=>n.level==='blocking').length>=2);
  assert.deepEqual(pkg,packageFor());
});

test('el aviso de revisar laboratorio es idempotente y solo para Economia',()=>{
  const original=existingSchool(),initial=packageFor(original);
  const withFo=registerFoSpace(
    chooseFgMode(initial,'economia_administracion','revisar'),
    'economia_administracion',
    {id:'fo-economia-n3',kind:'laboratorio',year:3}
  );
  const args={orientationId:'economia_administracion',area:'Ciencias Sociales',
    groupId:'social-3-c5',foSpaceId:'fo-economia-n3',subject:'Economía',year:3};
  const preview=previewArticulation(withFo,args);
  const first=queueReview(withFo,preview);
  const second=queueReview(first,preview);
  assert.equal(second.orientations.economia_administracion.pendingReviews.length,1);
  assert.equal(second.orientations.ciencias_sociales_humanidades.pendingReviews.length,0);
  assert.equal(second.orientations.ciencias_naturales.pendingReviews.length,0);
  assert.equal(second.orientations.economia_administracion.fg.areas['Ciencias Sociales'].groups[0].items.length,2);
  assert.equal(second.orientations.economia_administracion.fg.areas['Ciencias Sociales'].groups[0].plansBimestrales[0].stages.produccion.description,'Elaborar un afiche');
  assert.deepEqual(original,existingSchool());
  assert.deepEqual(initial,packageFor());
  assert.equal(inspectIntegration(original,second).orientations.economia_administracion.pendingReviews,1);
});

test('no admite confirmaciones ni movimientos automaticos de articulaciones',()=>{
  const pkg=packageFor();
  assert.throws(()=>queueReview(pkg,{canApply:true,status:'pending-review',orientationId:'economia_administracion'}),/inválida/);
  assert.throws(()=>chooseFgMode(pkg,'economia_administracion','sobrescribir'),/conservar o revisar/);
  assert.throws(()=>registerFoSpace(pkg,'economia_administracion',{
    id:'fo-proyecto-3',kind:'proyecto',year:3
  }),/nivel 5/);
});
