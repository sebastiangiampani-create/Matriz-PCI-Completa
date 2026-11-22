import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SPECIALTIES} from '../src/tecnica/pautas-pci-20261005.mjs';
import {technicalSubjectBank} from '../src/tecnica/espacio-trabajo-v2.mjs';
import {cotejarContenidosAtomicosTecnica,cargarBancoAtomicoTecnica} from '../src/tecnica/contenidos-atomicos-2026.mjs';
import {
 anioDeclaradoEnPaginaTecnica,resolverAnioReferenciaTecnica,
 desagregarPendientesTecnica,DESAGREGACION_TECNICA_VERSION
} from '../src/tecnica/desagregacion-documental-2026.mjs';

const root=new URL('../',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const fetchLocal=async url=>{
 try{
  if(!/^tecnica\/data\/[a-z0-9-]+\.json$/.test(String(url)))throw Error('Ruta inesperada');
  const bytes=await readFile(new URL('../'+url,import.meta.url));
  return new Response(bytes,{status:200,headers:{'content-type':'application/json'}});
 }catch{return new Response('No encontrado',{status:404})}
};

test('recupera los años que el PDF declara explícitamente, sin atribuirlos a otra materia',async()=>{
 const doc=await read('data/tecnica/priorizados/computacion.json');
 const target=doc.asignaturas.find(s=>s.asignatura==='Administración y Gestión de Base de Datos');
 const page=target.paginas.find(p=>p.pagina_pdf===89);
 assert.equal(page.anio_contextual_inferido,null);
 assert.equal(anioDeclaradoEnPaginaTecnica(target,page),5);
 assert.equal(resolverAnioReferenciaTecnica(target,page).year,5);
 const bank=technicalSubjectBank(doc);
 assert.equal(bank.find(x=>x.id===target.id+'@p89').year,5);
 const redes=doc.asignaturas.find(s=>s.asignatura==='Redes');
 assert.equal(anioDeclaradoEnPaginaTecnica(redes,redes.paginas[0]),5);
 assert.equal(bank.find(x=>x.id===redes.id+'@p92').year,5);
});

test('separación conservadora no convierte páginas ni indicadores en contenidos completos',()=>{
 const doc={schema:'pci-tecnica-priorizados/2',especialidad_id:'test',asignaturas:[{
  id:'t-1',asignatura:'Base de Datos',paginas:[{
   pagina_pdf:11,anio_contextual_inferido:4,
   texto_pagina:'BASE DE DATOS\nCuarto año\nIndicadores de logro de los aprendizajes                      Contenidos priorizados\n'+
    'Comprende la gestión de datos y su seguridad.                 Organización de datos. SQL y modelos relacionales.\n'+
    'Evalúa el funcionamiento de los sistemas de datos.            Consultas anidadas. Tablas relacionadas. Consultas de datos.\n'
  }]
 }]};
 const bank=[{id:'t-1@p11',sectionId:'t-1',field:'formacion_tecnica_especifica',
  page:11,year:4,name:'Base de Datos',source_url:'https://example.invalid/base.pdf',area:'Formación Técnico-Específica',
  confidence:'encabezado_explicito_pdf'}];
 const r=desagregarPendientesTecnica(doc,bank,[{id:bank[0].id}]);
 assert.equal(r.version,DESAGREGACION_TECNICA_VERSION);
 assert.equal(r.contenidos.some(x=>x.text.includes('Comprende la gestión')),false);
 assert.ok(r.contenidos.length>0);
 assert.ok(r.contenidos.every(x=>x.text.length<230&&x.year===4&&x.page===11));
 assert.ok(r.contenidos.every(x=>x.provisional&&x.pedagogicallyReviewed===false));
});

test('todas las especialidades conservan referencias y distinguen el inventario provisional',async()=>{
 const curated=await cargarBancoAtomicoTecnica({fetcher:fetchLocal});
 const stats={especialidades:0,referencias:0,pendientesOriginales:0,
   referenciasDesagregadas:0,contenidosDocumentales:0,pendientesFinales:0};
 for(const specialty of SPECIALTIES){
  const doc=await read('data/tecnica/priorizados/'+specialty.id+'.json');
  const unchanged=JSON.stringify(doc),bank=technicalSubjectBank(doc);
  const matched=cotejarContenidosAtomicosTecnica(doc,bank,curated);
  const r=desagregarPendientesTecnica(doc,bank,matched.pendientes);
  assert.equal(r.resumen.referenciasExaminadas,matched.pendientes.length);
  assert.equal(r.resumen.referenciasDesagregadas+r.resumen.referenciasPendientes,
    matched.pendientes.length);
  assert.equal(new Set(r.contenidos.map(x=>x.id)).size,r.contenidos.length);
  const refs=new Map(bank.map(x=>[x.id,x]));
  for(const c of r.contenidos){
   const source=refs.get(c.sourceReference);
   assert.ok(source,c.id);
   assert.equal(c.year,source.year,c.id);
   assert.equal(c.page,source.page,c.id);
   assert.equal(c.subject,source.name,c.id);
   assert.equal(c.source,source.source_url,c.id);
   assert.equal(c.provisional,true,c.id);
   assert.equal(c.pedagogicallyReviewed,false,c.id);
   assert.ok(c.text.length>=13&&c.text.length<=230,c.id);
   assert.ok(!/CONTENIDOS PRIORIZADOS|Indicadores de logro|Volver a vista anterior/i.test(c.text),c.id);
  }
  assert.equal(JSON.stringify(doc),unchanged,'PDF estructurado modificado: '+specialty.id);
  stats.especialidades++;
  stats.referencias+=bank.length;
  stats.pendientesOriginales+=matched.pendientes.length;
  stats.referenciasDesagregadas+=r.resumen.referenciasDesagregadas;
  stats.contenidosDocumentales+=r.contenidos.length;
  stats.pendientesFinales+=r.resumen.referenciasPendientes;
 }
 assert.equal(stats.especialidades,26);
 assert.equal(stats.referencias,2674);
 assert.ok(stats.contenidosDocumentales>0);
 console.log('DESAGREGACION_DOCUMENTAL_TECNICA_2026='+JSON.stringify(stats));
});

test('Fase 2 ofrece fragmentos por nivel en especialidad Computación, diferenciados de homologación',async()=>{
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async url=>{
  try{
   const bytes=await readFile(new URL('../'+String(url).split('?')[0],import.meta.url));
   return new Response(bytes,{status:200,headers:{'content-type':'application/json'}});
  }catch{return new Response('no encontrado',{status:404})}
 };
 try{
  const {loadTechnicalV2Profile}=await import('../src/v2-familia/catalogos-modalidad.mjs');
  const profile=await loadTechnicalV2Profile('computacion');
  const specifics=profile.contents.fo.filter(c=>c.documentalFragmentId);
  assert.ok(specifics.some(c=>c.subject==='Base de Datos'&&c.year===4));
  assert.ok(specifics.some(c=>c.subject==='Administración y Gestión de Base de Datos'&&c.year===5));
  assert.ok(specifics.some(c=>c.subject==='Programación sobre Redes'&&c.year===6));
  assert.ok(specifics.every(c=>c.provisional&&c.pedagogicallyReviewed===false));
  assert.equal(profile.priorizados.desagregacionDocumental.contenidosIndividualesProvisionales,
    [...profile.contents.fg,...profile.contents.fo].filter(c=>c.documentalFragmentId).length);
 }finally{globalThis.fetch=oldFetch}
});
