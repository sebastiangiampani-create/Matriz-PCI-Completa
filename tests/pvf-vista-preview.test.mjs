import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('vista de Bachillerato contiene A/B y se muestra debajo del mapa original C1-C10',async()=>{
  const [view,home,script]=await Promise.all([
    read('preview-v2-real/pvf-bachillerato.html'),
    read('preview-v2-real/institucion.html'),
    read('preview-v2-real/src/institucion-pci-demo.js')
  ]);
  assert.match(view,/Proyecto de Vinculación con el Futuro/);
  assert.match(view,/for\(const option of \['A','B'\]\)/);
  assert.match(view,/Alternativa '\+option/);
  assert.match(view,/C9 y C10/);
  assert.match(view,/proyecto-vinculacion-2026.mjs/);
  assert.match(home,/id="pvfPanel"/);
  assert.match(home,/id="pvfFrame"/);
  assert.match(home,/id="frame"/); // el mapa original sigue estando.
  assert.match(script,/pvf-bachillerato\.html/);
  assert.match(script,/source.searchParams.set\('pci',p.id\)/);
  assert.match(script,/source.searchParams.set\('orientacion',p.orientation\)/);
});
test('vista consulta datos locales y no modifica autenticación ni bases históricas',async()=>{
  const view=await read('preview-v2-real/pvf-bachillerato.html');
  assert.match(view,/localStorage\.getItem/);
  assert.doesNotMatch(view,/localStorage\.setItem|fetch\(|supabase\.co|save-school-pci-unit/);
  assert.match(view,/addEventListener\('storage'/);
  assert.match(view,/readonly:true/);
});
