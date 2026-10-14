import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('el acceso escolar de la rama de prueba bloquea antes de save-state y sólo permite consulta',async()=>{
 const html=await readFile(new URL('../escuela-online.html',import.meta.url),'utf8');
 const lock=html.indexOf('const MIGRATION_WRITE_LOCK=true;');
 const save=html.indexOf('async function saveNow(){if(MIGRATION_WRITE_LOCK){');
 const api=html.indexOf("await call({action:'save-state'");
 assert.ok(lock>=0,'Esta rama no debe habilitar grabaciones escolares');
 assert.ok(save>lock && api>save,'El bloqueador debe preceder cualquier llamada a save-state');
 assert.match(html,/const READ_ONLY=MIGRATION_WRITE_LOCK\|\|role/);
 assert.match(html,/Protección activa: guardado online deshabilitado/);
 assert.match(html,/Vista de prueba protegida: podés consultar el PCI original sin guardar/);
});

test('los módulos auxiliares nunca escriben directamente sobre la Matriz original',async()=>{
 const modules=[
 'common-workshop-guard.js','curriculum-ui.js','arts-multiple-workshops.js',
 'curriculum-ui-tuning.js','planes-bimestrales.js','plan-name-defaults.js',
 'other-formats-all-content.js','other-format-types-extension.js',
 'common-final-fixes.js'
 ];
 for(const path of modules){
   const source=await readFile(new URL('../'+path,import.meta.url),'utf8');
   assert.ok(source.includes('saveScopedState'),path+' debe utilizar la copia aprobada');
   assert.doesNotMatch(source,/localStorage\.setItem\(\s*(?:'pciAppV2'|STORAGE_KEY)/,
     path+' no debe sobrescribir el original');
 }
 const main=await readFile(new URL('../app.js',import.meta.url),'utf8');
 assert.match(main,/if \(activeDraftKey\) localStorage\.setItem\(activeDraftKey,/);
 assert.match(main,/if \(!activeDraftKey \|\| candidate !== app\) return false/);
});
