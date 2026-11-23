import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validarBaseTecnica,cargarBaseTecnicaReconstruida} from '../src/tecnica/base-contenidos-2026.mjs';

const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));

test('las 26 especialidades contienen banco de contenidos atomizados desde PDF con enlaces y años',async()=>{
 const index=await read('data/tecnica/base-curricular/indice.json');
 assert.equal(index.schema,'pci-tecnica-base-curricular-indice/3');
 assert.equal(index.totales.especialidades,26);
 const ids=new Set(),conceptIds=new Set();let contentCount=0;
 for(const spec of index.especialidades){
  const [document,base]=await Promise.all([
   read('data/tecnica/priorizados/'+spec.id+'.json'),
   read('data/tecnica/base-curricular/'+spec.id+'.json')
  ]);
  const rows=validarBaseTecnica(base,document);
  assert.equal(rows.length,spec.contenidos,spec.id);
  assert.ok(rows.some(x=>x.field==='formacion_general'),spec.id);
  assert.ok(rows.some(x=>x.field==='formacion_tecnica_especifica'),spec.id);
  for(const row of rows){
   assert.ok(!ids.has(row.id),row.id+' duplicado entre especialidades');
   ids.add(row.id);conceptIds.add(row.conceptId);
   assert.equal(row.documentallyVerified,true);
   assert.equal(row.provisional,false);
   assert.ok(row.page>=1);
  }
  contentCount+=rows.length;
 }
 assert.equal(contentCount,index.totales.contenidos);
 assert.equal(conceptIds.size,index.totales.conceptosUnicos);
});

test('el lector devuelve los contenidos de Computación listos para la bolsa V2',async()=>{
 const document=await read('data/tecnica/priorizados/computacion.json');
 const fetcher=async url=>{
  try{return new Response(await readFile(new URL('../'+url,import.meta.url)),{status:200})}
  catch{return new Response('No encontrado',{status:404})}
 };
 const {contenidos,base}=await cargarBaseTecnicaReconstruida(document,{fetcher});
 assert.ok(contenidos.length>1400);
 assert.ok(contenidos.some(c=>c.year===4&&c.subject==='Base de Datos'&&/Organización de datos/i.test(c.text)));
 assert.ok(contenidos.some(c=>c.year===1&&c.subject==='Música'&&c.page===14));
 assert.ok(contenidos.some(c=>c.year===1&&c.subject==='Diseño'&&c.page===14));
 assert.equal(base.fuente_sha256,document.sha256_pdf);
});
