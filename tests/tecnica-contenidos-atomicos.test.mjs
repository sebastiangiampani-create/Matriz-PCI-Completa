import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {technicalSubjectBank} from '../src/tecnica/espacio-trabajo-v2.mjs';
import {
  BANCOS_ATOMICOS_TECNICA,
  CONTENTS_ATOMICOS_TECNICA_VERSION,
  cargarBancoAtomicoTecnica,
  cotejarContenidosAtomicosTecnica
} from '../src/tecnica/contenidos-atomicos-2026.mjs';
import {SPECIALTIES} from '../src/tecnica/pautas-pci-20261005.mjs';

const root=new URL('../',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const fetchLocal=async url=>{
 try{
  if(!/^tecnica\/data\/[a-z0-9-]+\.json$/.test(String(url)))
   throw Error('Recurso ajeno al banco estructurado: '+url);
  const bytes=await readFile(new URL('../'+url,import.meta.url));
  return new Response(bytes,{status:200,headers:{'content-type':'application/json'}});
 }catch{return new Response('no encontrado',{status:404})}
};
const normalized= s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();

test('el catálogo estructurado tiene referencias individuales, no páginas de PDF',async()=>{
 const rows=await cargarBancoAtomicoTecnica({fetcher:fetchLocal});
 assert.equal(BANCOS_ATOMICOS_TECNICA.length,16);
 assert.ok(BANCOS_ATOMICOS_TECNICA.every(x=>!x.startsWith('ingles-')),
   'No convertir bancos de Inglés sin identificadores ni años verificables.');
 assert.ok(rows.length>500);
 assert.ok(rows.every(row=>row.id&&row.subject&&row.axis&&row.text));
 assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
 assert.ok(rows.every(row=>row.text.length<1000));
 assert.ok(rows.every(row=>!/\bCONTENIDOS PRIORIZADOS\b/i.test(row.text)));
});

test('cotejo atómico conserva materia, año, eje/subeje, página y procedencia',()=>{
 const doc={schema:'pci-tecnica-priorizados/2',especialidad_id:'ejemplo',
  fuente_url:'https://example.invalid/ejemplo.pdf',
  asignaturas:[{id:'ejemplo-1',asignatura:'Biología'}]};
 const bank=[{id:'ejemplo-1@p8',sectionId:'ejemplo-1',name:'Biología',
  year:1,page:8,field:'formacion_general',source_url:doc.fuente_url,
  confidence:'página',text:'Materia viva. Unidad y diversidad de funciones y estructuras. Conclusiones.'}];
 const rows=[{id:'tec-test-1',subject:'Biología',area:'Ciencias Naturales',
  axis:'Seres vivos: unidad y diversidad. - Conceptos',
  text:'Unidad y diversidad de funciones y estructuras.'}];
 const before=structuredClone({doc,bank,rows});
 const r=cotejarContenidosAtomicosTecnica(doc,bank,rows);
 assert.equal(r.version,CONTENTS_ATOMICOS_TECNICA_VERSION);
 assert.equal(r.contenidos.length,1);
 assert.equal(r.resumen.referenciasPendientes,0);
 assert.deepEqual(r.contenidos[0],{
  id:'tec-atom:ejemplo:tec-test-1:1',
  year:1,component:'FG',subject:'Biología',area:'Ciencias Naturales',
  axis:'Seres vivos: unidad y diversidad.',subaxis:'Conceptos',
  text:'Unidad y diversidad de funciones y estructuras.',
  source:doc.fuente_url,page:8,sourceReference:'ejemplo-1@p8',
  sourceRow:'tec-test-1',field:'formacion_general',
  sourceYearConfidence:'página',provisional:true,
  sourceValidation:'cotejo_textual_con_pdf_2026'
 });
 assert.deepEqual({doc,bank,rows},before,'No se modifican los originales.');
});

test('las páginas enteras y el texto no cotejado jamás se ofrecen como un contenido',()=>{
 const doc={schema:'pci-tecnica-priorizados/2',especialidad_id:'ejemplo',
  fuente_url:'https://example.invalid/ejemplo.pdf',
  asignaturas:[{id:'ejemplo-1',asignatura:'Matemática'}]};
 const bank=[{id:'ejemplo-1@p3',sectionId:'ejemplo-1',name:'Matemática',
  year:2,page:3,field:'formacion_general',source_url:doc.fuente_url,
  text:'CONTENIDOS PRIORIZADOS... lista completa en una sola página'}];
 const rows=[
  {id:'no-valido',subject:'Matemática',axis:'Números',
   text:'CONTENIDOS PRIORIZADOS... lista completa en una sola página'},
  {id:'fuera-de-fuente',subject:'Matemática',axis:'Números',
   text:'Un contenido curricular que no está documentado en esta página.'}
 ];
 const r=cotejarContenidosAtomicosTecnica(doc,bank,rows);
 assert.equal(r.contenidos.length,0);
 assert.equal(r.pendientes.length,1);
 assert.equal(r.noCotejados.length,2);
});

test('las 26 especialidades conservan trazabilidad y revelan referencias pendientes',async()=>{
 const rows=await cargarBancoAtomicoTecnica({fetcher:fetchLocal});
 let total=0,verificados=0,unmatched=0;
 for(const spec of SPECIALTIES){
  const doc=await read('data/tecnica/priorizados/'+spec.id+'.json'),bank=technicalSubjectBank(doc);
  const original=JSON.stringify(doc);
  const r=cotejarContenidosAtomicosTecnica(doc,bank,rows);
  assert.equal(r.resumen.fuentesTotal,bank.length);
  assert.equal(r.resumen.referenciasConContenidosAtomicos+r.resumen.referenciasPendientes,bank.length);
  assert.equal(r.contenidos.length,new Set(r.contenidos.map(c=>c.id)).size,'IDs únicos '+spec.id);
  assert.ok(r.contenidos.length>0,'Sin contenidos cotejados '+spec.id);
  const index=new Map(bank.map(b=>[b.id,b]));
  for(const c of r.contenidos){
   const p=index.get(c.sourceReference);
   assert.ok(p,'Referencia del contenido no encontrada '+c.id);
   assert.equal(c.year,p.year);
   assert.equal(c.page,p.page);
   assert.equal(c.source,doc.fuente_url);
   assert.equal(c.field,p.field);
   assert.ok(normalized(p.text).includes(normalized(c.text)),'Texto no respaldado: '+c.id);
   assert.ok(!/\bCONTENIDOS PRIORIZADOS\b/i.test(c.text));
  }
  assert.equal(JSON.stringify(doc),original,'Fuente alterada '+spec.id);
  total+=bank.length;verificados+=r.contenidos.length;unmatched+=r.pendientes.length;
 }
 assert.equal(total,2674);
 console.log('ATOMIZACION_TECNICA_2026='+JSON.stringify({
  especialidades:26,referenciasOriginales:total,
  contenidosIndividualesCotejados:verificados,
  referenciasPendientes:unmatched
 }));
});

test('el cargador V2 enseña contenidos cortos y separados con evidencia de fuente',async()=>{
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async url=>{
  try{
   const clean=String(url).split('?')[0];
   const bytes=await readFile(new URL('../'+clean,import.meta.url));
   return new Response(bytes,{status:200,headers:{'content-type':'application/json'}});
  }catch{return new Response('No encontrado',{status:404})}
 };
 try {
  const {loadTechnicalV2Profile}=await import('../src/v2-familia/catalogos-modalidad.mjs');
  for(const id of ['computacion','mecanica','administracion_empresas']){
   const p=await loadTechnicalV2Profile(id);
   const atomic=[...p.contents.fg,...p.contents.fo].filter(c=>c.sourceRow);
   assert.ok(atomic.length>50,'Faltan contenidos separados para '+id);
   for(const c of atomic){
    assert.ok(c.id.startsWith('tec-atom:'),'No debe ser id@p de página: '+c.id);
    assert.ok(c.axis&&c.text&&c.sourceReference&&c.year&&c.page);
    assert.ok(c.text.length<1000);
    assert.ok(!/CONTENIDOS PRIORIZADOS/i.test(c.text));
   }
   assert.equal(atomic.length,p.priorizados.contenidosAtomicos.contenidosAtomicos);
   assert.equal(p.priorizados.contenidosAtomicos.fuentesTotal,p.priorizados.totalReferencias);
  }
 }finally{globalThis.fetch=oldFetch}
});

test('el mapa técnico elimina la fila FCT independiente y mantiene resguardo de trabajo anterior',async()=>{
 const source=await readFile(new URL('../src/v2-familia/v19-mapa-modalidad.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\{k:'fct',l:/);
 assert.match(source,/const legacyFieldSlots=/);
 assert.match(source,/renderLegacyScientificField/);
 assert.match(source,/TECH_CIENTIFICO_TECNOLOGICA_LEGADO/);
 assert.match(source,/html\+=renderLegacyScientificField\(\)/);
 assert.match(source,/const profileRows=CFG\.model==='tecnica'\?/);
 const publisher=await readFile(new URL('../scripts/preparar-publicacion-aplicacion-v2.mjs',import.meta.url),'utf8');
 assert.match(publisher,/'tecnica\/data'/);
});
