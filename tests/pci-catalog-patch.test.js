import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { patchPciCatalog } from '../scripts/patch-pci-catalog.mjs';

const existingSource = [
  "const CATALOG_URL='https://example.invalid/schools-catalog.csv';",
  'const FIRST_REAL_ID=1001;',
  "async function loadCatalog(){const r=await fetch(CATALOG_URL);if(!r.ok)throw Error('CSV');return [];}",
  "async function ensureSchools(){const catalog=await loadCatalog();await supabase.from('pci_proposals').upsert([]);return catalog}",
  'function schoolMeta(rows){return rows}',
  "if(action==='admin-login'){const unchanged='admin';}",
  "if(action==='list-schools'){await ensureSchools();}",
  "if(action==='save-state'){const unchanged='save_state';}",
  "if(action==='get-state'){const unchanged='get_state';}"
].join('\n');

function loadFunction(source, rows, error = null) {
  const start = source.indexOf('async function loadCatalog(){');
  const stop = source.indexOf('async function ensureSchools(){', start);
  assert.ok(start >= 0 && stop > start);
  let reads = 0;
  let writes = 0;
  const db = {
    from(name) {
      assert.equal(name, 'pci_proposals');
      reads++;
      return {
        select(columns) { assert.equal(columns, 'school_id,data'); return this; },
        gte(column, min) { assert.equal(column, 'school_id'); assert.equal(min, 1001); return this; },
        order(column) { assert.equal(column, 'school_id'); return Promise.resolve({data:rows,error}); },
        upsert() { writes++; throw Error('Unexpected write'); }
      };
    }
  };
  const expression = source.slice(start, stop) + '\nloadCatalog()';
  const result = vm.runInNewContext(expression, {supabase:db, FIRST_REAL_ID:1001});
  return {result, stats:()=>({reads,writes})};
}

test('patch removes the remote CSV dependency and the implicit upsert', () => {
  const patched = patchPciCatalog(existingSource);
  assert.doesNotMatch(patched, /CATALOG_URL|fetch\(CATALOG_URL|\.upsert\(/);
  assert.match(patched, /\.from\('pci_proposals'\)/);
  assert.ok(patched.includes("if(action==='save-state'){const unchanged='save_state';}"));
  assert.ok(patched.includes("if(action==='get-state'){const unchanged='get_state';}"));
  assert.match(patched, /if\(action==='public-catalog'\)/);
  const publicHandler=patched.split("if(action==='public-catalog'){")[1].split("if(action==='admin-login'){")[0];
  assert.match(publicHandler, /school_id:s.school_id,name:s.name,cue:s.cue,model:s.model/);
  assert.doesNotMatch(publicHandler, /edit_code|primary_code|email|password|secret/);
  assert.equal(patched.slice(patched.indexOf("if(action==='admin-login')")),
    existingSource.slice(existingSource.indexOf("if(action==='admin-login')")));
});

test('reads 233 schools using stored metadata, without any write', async () => {
  const patched = patchPciCatalog(existingSource);
  const rows = Array.from({length:233}, (_, i) => ({
    school_id:i+1001,
    data:{profile:i===0?'tecnica':'comun',schoolName:'Escuela '+(i+1),_meta:{catalog_id:'C'+(i+1),cue:'000'+i,email:'x@example.edu.ar',entry_year:'2026'}}
  }));
  const {result,stats} = loadFunction(patched,rows);
  const catalog = await result;
  assert.equal(catalog.length,233);
  assert.equal(catalog[0].school_id,1001);
  assert.equal(catalog[0].rid,'C1');
  assert.equal(catalog[0].name,'Escuela 1');
  assert.equal(catalog[0].model,'tecnica');
  assert.equal(catalog[1].model,'comun');
  assert.equal(catalog[232].school_id,1233);
  assert.equal(stats().writes,0);
  assert.equal(stats().reads,1);
});

test('does not report a healthy catalogue if the query fails or is empty', async () => {
  const patched=patchPciCatalog(existingSource);
  await assert.rejects(loadFunction(patched,[],new Error('Database unavailable')).result,/Database unavailable/);
  await assert.rejects(loadFunction(patched,[]).result,/No hay escuelas cargadas/);
});

test('fails closed if the source version no longer matches', () => {
  assert.throws(()=>patchPciCatalog('function noPatch(){}'), /Cannot locate/);
  assert.throws(()=>patchPciCatalog(existingSource.replace('fetch(CATALOG_URL','fetch(OTHER_URL')), /differs from expected version/);
  assert.throws(()=>patchPciCatalog(existingSource.replace('upsert(', 'insert(')), /differs from expected version/);
});
