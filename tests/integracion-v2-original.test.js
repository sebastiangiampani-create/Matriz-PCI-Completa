import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';

const dir='preview-v2-real/';
const r=async p=>readFile(dir+p,'utf8');

test('arranque V2 original con sus módulos completos y sin archivos ausentes',async()=>{
 const boot=await r('app.html');
 assert.match(boot,/fetchText\('app-core\.html'\)/);
 assert.match(boot,/src\/v47-phase2-matrix\.js/);
 assert.match(boot,/src\/v47-fo-content-atomicizer\.js/);
 const list=boot.match(/const modulePaths=\[([\s\S]*?)\]/)?.[1]||'';
 const files=[...list.matchAll(/'([^']+)'/g)].map(x=>x[1]);
 assert.equal(files.length,25);
 for(const file of files)await access(dir+file);
 for(const file of ['app-core.html','src/v47-phase2-matrix.js','src/v47-fo-content-atomicizer.js',
   'data/materias-v2.json','data/horas-v2.json','assets/logo-escuela-maestros.svg',
   'assets/logo-escuela-maestros-blanco.svg'])await access(dir+file);
 for(let i=1;i<=9;i++)await access(dir+'data/curriculum_v103/fg-all-p'+i+'.txt');
 await access(dir+'data/curriculum_v96/fo_all.txt');
 for(let i=2;i<=11;i++)await access(dir+'data/curriculum_v96/fo_part'+String(i).padStart(2,'0')+'.txt');
});

test('el mapa verdadero incluye las reglas de composición y la bolsa FG/FO',async()=>{
 const core=await r('app-core.html'),map=await r('src/v19-map.js');
 assert.match(core,/id=\"orientationList\"/);
 assert.match(core,/id=\"bagContent\"/);
 assert.match(core,/id=\"matrix\"/);
 assert.match(map,/renderMatrix = function/);
 assert.match(map,/data-format/);
 assert.match(map,/data-social-option/);
 assert.match(map,/foLab5/);
 assert.ok(map.includes('C${t}'));
 const subjects=JSON.parse(await r('data/materias-v2.json'));
 assert.ok(subjects.formacion_general['3'].includes('Economía'));
 assert.ok(subjects.formacion_orientada['Economía y Administración']);
});

test('vista aislada sin endpoint escolar ni colisiones con el almacenamiento de V2',async()=>{
 const core=await r('app-core.html');
 assert.match(core,/pci-matriz-fg-v2-original-preview-20261009/);
 assert.doesNotMatch(core,/const STORAGE='pci-sa-v2-app-20260910-21'/);
 assert.equal(core.includes('supabase.co'),false);
 assert.equal(core.includes('functions/v1/'),false);
 assert.ok(core.includes('../assets/ba-logo.png'));
 assert.ok(core.includes('../assets/em-logo-header.svg'));
 assert.ok(core.includes('../assets/em-logo-footer.svg'));
 assert.ok(core.includes('../assets/ministerio-footer.svg'));
 assert.ok(core.includes('estetica-matriz-compacta.css'));
});

test('copió las bases históricas de materias que V2 usa para completar su bolsa',async()=>{
 for(const part of ['db1','db2','db3','db4','rest1','rest2','rest3','rest4','rest5'])
   await access(dir+'data/formacion_general/'+part+'.txt');
 for(const orientation of [
   'agro_ambiente','arte','ciencias_naturales','ciencias_sociales_humanidades',
   'comunicacion','economia_administracion','educacion','educacion_fisica',
   'energia_sustentabilidad','informatica','lenguas','literatura',
   'matematica_fisica','turismo'
 ])await access(dir+'data/orientaciones/'+orientation+'.txt');
 for(let i=1;i<=9;i++)
   await access(dir+'data/curriculum_v96/fg-all-p'+i+'.txt');
 await access(dir+'data/tutoria.json');
 await access(dir+'data/contenidos-prescriptos-fg.json');
 await access(dir+'assets/ba-logo.png');
 await access(dir+'assets/ba-ciudad-footer.png');
});

test('no se copian usuarios, permisos ni módulos de gestión de V2',async()=>{
 const boot=await r('app.html');
 const forbidden=[
  'v22-teachers.js','v31-integration-hours-print.js',
  'v48-institutional-layer.js','v48-phase2-institutional-content.js',
  'v48-disable-phase1-teachers.js','v52-derived-teacher-load.js',
  'v57-custom-divisions.js','v68-institutional-export.js',
  'v71-lean-management.js','v71-management-nav-reset.js',
  'v71-simple-assignment-excel.js','v72-students-commissions.js',
  'v73-management-home.js','v74-home-redesign.js',
  'v75-app-architecture.js','v80-access-control.js','v85-access-panel.js'
 ];
 for(const name of forbidden){
   assert.equal(boot.includes(name),false,'No se debe iniciar '+name);
   await assert.rejects(access(dir+'src/'+name),{code:'ENOENT'});
 }
 assert.ok(boot.includes('v19-map.js'));
 assert.ok(boot.includes('v91-coverage-core.js'));
 assert.ok(boot.includes('v93-curricular-coverage-dashboard.js'));
 assert.ok(boot.includes('v47-phase2-matrix.js'));
});

test('no se incluye el módulo Calificaciones ni se pierde la etapa de evaluación curricular',async()=>{
 const boot=await r('app.html');
 assert.ok(!boot.includes('v114-plan-criteria-excel.js'));
 await assert.rejects(access(dir+'src/v114-plan-criteria-excel.js'),{code:'ENOENT'});
 const curricular=await r('src/v47-elective-plans.js');
 for(const stage of ['punto_partida','indagacion','produccion','evaluacion'])
   assert.ok(curricular.includes(stage),'Debe conservar la etapa pedagógica '+stage);
 const base=await r('app-core.html');
 assert.ok(base.includes('id="openOffer"'),'Se conserva el Mapa de la Oferta');
 assert.ok(base.includes('id="openProposal"'),'Se conserva el Desarrollo Curricular');
 assert.ok(!base.includes('v114CriteriaEntry'));
 assert.ok(!base.includes('v114PlanCriteriaScreen'));
});
