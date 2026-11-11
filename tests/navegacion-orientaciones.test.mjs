import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('los accesos nuevos usan la sesión existente, sin sustituir el editor original',async()=>{
  const general=await readFile(new URL('../panel-general.html',import.meta.url),'utf8');
  const school=await readFile(new URL('../panel-escuela.html',import.meta.url),'utf8');
  assert.match(general,/id="orientacionesLink"/);
  assert.match(general,/id="addSchoolDirect"/);
  assert.match(general,/pci-orientaciones\.html\?accion=alta-escuela/);
  assert.match(general,/session\.role!=='admin'/);
  assert.match(general, /has\('pci\.view'\)/);
  assert.match(school,/id="openOrientaciones"/);
  assert.match(school,/pci-orientaciones\.html\?school=\$\{sid\}/);
  assert.match(school,/escuela-online\.html\?school=\$\{sid\}/);
  assert.match(general,/panel-usuarios\.html/);
  assert.match(school,/panel-general\.html/);
  assert.match(school,/id="openPci"/);
});

test('la alta directa valida la sesión y solo se abre para administradores',async()=>{
  const module=await readFile(new URL('../src/orientaciones-online.mjs',import.meta.url),'utf8');
  assert.match(module,/function canCreateSchool\(\)\{return session\?\.role==='admin';\}/);
  assert.match(module,/get\('accion'\)==='alta-escuela'&&canCreateSchool\(\)/);
  assert.match(module,/call\('create-school-v2',body\)/);
});
