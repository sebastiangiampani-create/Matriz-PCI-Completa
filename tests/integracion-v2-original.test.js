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
 assert.equal(files.length,43);
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
 assert.match(map,/C\\$\\{t\\}/);
 const subjects=JSON.parse(await r('data/materias-v2.json'));
 assert.ok(subjects.formacion_general['3'].includes('Economía'));
 assert.ok(subjects.formacion_orientada['Economía y Administración']);
});

test('vista aislada sin endpoint escolar ni colisiones con el almacenamiento de V2',async()=>{
 const core=await r('app-core.html');
 assert.match(core,/pci-matriz-fg-v2-original-preview-20261009/);
 assert.doesNotMatch(core,/const STORAGE='pci-sa-v2-app-20260910-21'/);
 assert.doesNotMatch(core,/supabase\\.co|functions\\/v1\\//);
 assert.match(core,/\.\.\\/assets\\/ba-logo\.png/);
 assert.match(core,/\.\.\\/assets\\/ba-ciudad-footer\.png/);
});
