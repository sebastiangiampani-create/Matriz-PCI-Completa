import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// La liberación de orientaciones es ADITIVA: el acceso escolar original mantiene
// exactamente su funcionamiento y los nuevos módulos no lo modifican.
test('la pantalla nueva no usa save-state ni altera el PCI histórico',async()=>{
  const html=await readFile(new URL('../pci-orientaciones.html',import.meta.url),'utf8');
  const module=await readFile(new URL('../src/orientaciones-online.mjs',import.meta.url),'utf8');
  const core=await readFile(new URL('../src/orientaciones-release-core.mjs',import.meta.url),'utf8');
  assert.match(html,/Mis PCI por orientación|Proyectos curriculares por orientación/);
  assert.doesNotMatch(html,/action:\s*['"]save-state/);
  assert.doesNotMatch(module,/action:\s*['"]save-state/);
  assert.doesNotMatch(core,/pci_proposals\.data/);
  assert.doesNotMatch(module,/localStorage\./);
  assert.match(module,/save-school-pci-unit/);
  assert.match(module,/expected_revision/);
});

test('la nueva FG se edita solo en copias con versión y procedencia',async()=>{
  const core=await readFile(new URL('../src/orientaciones-release-core.mjs',import.meta.url),'utf8');
  const handler=await readFile(new URL('../src/multipci/pci-workspace-handlers.mjs',import.meta.url),'utf8');
  assert.match(core,/original_sha256/);
  assert.match(core,/pci_id/);
  assert.match(handler,/pci_collab_save_unit_v1/);
  assert.match(handler,/p_expected_revision/);
  assert.doesNotMatch(handler,/\.from\(['"]pci_proposals['"]\)\.update/);
});
