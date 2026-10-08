/**
 * One-time migration for the already-deployed Supabase function pci-access.
 * Usage: node scripts/patch-pci-catalog.mjs input-index.ts output-index.ts
 * The input is downloaded privately from Supabase and is never committed.
 * This script never connects to a remote service or modifies school data.
 */
import { readFile, writeFile } from 'node:fs/promises';

export function patchPciCatalog(source) {
  const start = source.indexOf('async function loadCatalog(){');
  const end = source.indexOf('function schoolMeta(', start);
  if (start === -1 || end === -1 || source.indexOf('async function loadCatalog(){', start + 1) !== -1) {
    throw new Error('Cannot locate unique catalogue functions. No output written.');
  }
  const original = source.slice(start, end);
  if (!original.includes('fetch(CATALOG_URL') ||
      !original.includes('async function ensureSchools(){') ||
      !original.includes('.upsert(')) {
    throw new Error('Deployed source differs from expected version. No output written.');
  }

  // The existing 233 rows already have their name, CUE and catalogue ID
  // inside data. Never fetch an external CSV or create rows during login.
  const corrected = `async function loadCatalog(){
  const {data:rows,error}=await supabase.from('pci_proposals')
    .select('school_id,data')
    .gte('school_id',FIRST_REAL_ID)
    .order('school_id');
  if(error)throw error;
  if(!rows?.length)throw new Error('No hay escuelas cargadas en Supabase');
  return rows.map((row)=>({
    school_id:Number(row.school_id),
    rid:String(row.data?._meta?.catalog_id||row.school_id),
    name:String(row.data?.schoolName||'Escuela '+row.school_id),
    cue:String(row.data?._meta?.cue||''),
    email:String(row.data?._meta?.email||''),
    entry_year:String(row.data?._meta?.entry_year||''),
    model:row.data?.profile==='tecnica'?'tecnica':'comun'
  }));
}
// Historical initialization hook: reads must never insert or reset PCI data.
async function ensureSchools(){return await loadCatalog()}
`;
  // Names and CUEs are already part of the public school selector.
  // Expose no credentials, user permissions, PCI content or email addresses.
  const entryPoint = "if(action==='admin-login'){";
  if (source.split(entryPoint).length !== 2) throw new Error('Unexpected action handlers');
  const publicAction = `if(action==='public-catalog'){
  const catalog=await loadCatalog();
  return new Response(JSON.stringify({schools:catalog.map(s=>({
    school_id:s.school_id,name:s.name,cue:s.cue,model:s.model
  }))}),{headers:cors})
}

`;
  const result = (source.slice(0, start) + corrected + source.slice(end))
    .replace(/^const CATALOG_URL=.*\r?\n/m, '')
    .replace(entryPoint, publicAction + entryPoint);
  if (result.includes('fetch(CATALOG_URL') || result.includes('const CATALOG_URL') ||
      !result.includes("if(action==='list-schools')") ||
      !result.includes("if(action==='save-state')")) {
    throw new Error('Safety verification failed. No output written.');
  }
  return result;
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  if (process.argv.length !== 4) {
    console.error('Usage: node scripts/patch-pci-catalog.mjs input-index.ts output-index.ts');
    process.exit(2);
  }
  const source = await readFile(process.argv[2], 'utf8');
  const changed = patchPciCatalog(source);
  await writeFile(process.argv[3], changed, { flag: 'wx', mode: 0o600 });
  console.log('Patched catalogue load in separate file; original remains intact.');
}
