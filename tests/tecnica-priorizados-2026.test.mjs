import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const root=new URL('../',import.meta.url);
const file=p=>join(root.pathname,p);
const catalog=read(file('data/tecnica/fuentes-priorizadas-caba-2026.json'));
const annualSource=readFileSync(file('src/tecnica/pautas-pci-20261005.mjs'),'utf8');

test('26 especialidades oficiales, un documento transversal y IDs univocos',()=>{
  assert.equal(catalog.especialidades.length,26);
  assert.equal(catalog.transversal.length,1);
  const all=[...catalog.especialidades,...catalog.transversal];
  assert.equal(new Set(all.map(x=>x.id)).size,27);
  assert.ok(all.every(x=>x.archivo?.endsWith('.pdf')&&x.url.startsWith('https://static.buenosaires.gob.ar/')));
  assert.equal(catalog.transversal[0].id,'tecnologia_representacion');
});
test('los IDs son los del catalogo de reglas vigentes, no nuevos PCI duplicados',()=>{
  const annualRows=annualSource.match(/const ANNUAL_ROWS=\[([\s\S]*?)\];/)[1];
  const names=[...annualRows.matchAll(/\['([a-z0-9_]+)','[^']+',/g)].map(x=>x[1]);
  for(const id of names)assert.ok(catalog.especialidades.some(x=>x.id===id),id);
  const pending=['refrigeracion_ventilacion_calefaccion_aire','metalurgia',
    'ortesis_protesis','diseno_interiores','diseno_artesanias','geografo_matematico'];
  for(const id of pending)assert.ok(catalog.especialidades.some(x=>x.id===id),id);
});
test('el visor y el importador no escriben en la base escolar',()=>{
  const code=readFileSync(file('scripts/tecnica/importar_priorizados_2026.py'),'utf8');
  const viewer=readFileSync(file('pci-tecnica-priorizados.html'),'utf8');
  assert.ok(!/supabase\.co|pci_online_save|\bpci_proposals\b/i.test(code));
  assert.ok(!/supabase\.co|pci_online_save|\bpci_proposals\b/i.test(viewer));
  assert.match(code,/requiere_validacion_pedagogica/);
  assert.match(viewer,/Consulta independiente, sin guardado escolar/);
});
test('no afirmar que todos los contenidos estan cargados antes de una extraccion y revision completas',()=>{
 const index=file('data/tecnica/catalogo-priorizados-2026.json');
 if(!existsSync(index))return;
 const data=read(index);
 assert.equal(data.esquema_escolar_modificado,false);
 assert.equal(data.debe_aplicarse_a_pci_existentes,false);
 assert.equal(data.requiere_validacion_pedagogica,true);
});
