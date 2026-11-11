import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const path=new URL('../supabase/functions/pci-access/',import.meta.url);
async function source(file){return readFile(new URL(file,path),'utf8')}
test('la entrega incluye TODA la Edge de producción con guardado anterior inalterado',async()=>{
  const [index,guard,handler]=await Promise.all([
    source('index.ts'),source('online-guard.mjs'),source('pci-workspace-handlers.mjs')
  ]);
  assert.match(index,/guardedStateRequest/);
  assert.match(index,/action==='get-state'\|\|action==='save-state'/);
  assert.match(index,/handleMultiPci/);
  assert.match(index,/await readToken\(body\.token\)/);
  assert.ok(index.indexOf('await readToken(body.token)')<index.indexOf('const multi=await handleMultiPci'));
  assert.match(index,/PCI_ORIENTACIONES_ENABLED/);
  assert.match(index,/PCI_ADMIN_HASH/);
  assert.doesNotMatch(index,/const ADMIN_HASH=['"][0-9a-f]{64}['"]/);
  assert.ok(guard.length>2000,'Falta la protección de guardado del sistema anterior');
  assert.match(handler,/pci_collab_save_unit_v1/);
  assert.match(handler,/pci_workspace_get_pci_v1/);
  assert.match(handler,/pci_workspace_create_pci_v2/);
  assert.match(handler,/pending_rules/);
  assert.match(handler,/423/);
  assert.doesNotMatch(handler, /\.from\(['"]pci_proposals['"]\)\.update/);
});
test('la función respeta la configuración de JWT institucional original',async()=>{
  const config=await readFile(new URL('../supabase/config.toml',import.meta.url),'utf8');
  assert.match(config,/\[functions\.pci-access\][\s\S]*verify_jwt = false/);
});
test('el handler duplicado del paquete es idéntico al módulo que se prueba',async()=>{
  const external=await readFile(new URL('../src/multipci/pci-workspace-handlers.mjs',import.meta.url),'utf8');
  assert.equal(await source('pci-workspace-handlers.mjs'),external);
});
