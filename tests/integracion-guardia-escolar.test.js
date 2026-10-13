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
