import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('despliegue exige copia de respaldo y no activa orientaciones por defecto',async()=>{
  const s=await readFile(new URL('../deployment/publicar-orientaciones.sh',import.meta.url),'utf8');
  assert.match(s,/pg_dump/);assert.match(s,/pg_restore --list/);
  assert.match(s,/PCI_RESTAURACION_EXTERNA_VERIFICADA/);
  assert.match(s,/PCI_PUBLICACION_AUTORIZADA/);
  assert.match(s,/PCI_ADMIN_HASH/);
  assert.match(s,/PCI_ORIENTACIONES_ENABLED=false/);
  assert.match(s,/PCI_ORIENTACIONES_ENABLED=true/);
  assert.ok(s.indexOf('003_supabase_scoped_units.sql')<s.indexOf('001_additive_school_pcis.sql'));
  assert.match(s,/cmp -s/);
});
