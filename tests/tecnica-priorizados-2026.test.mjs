import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {SPECIALTIES} from '../src/tecnica/pautas-pci-20261005.mjs';
import {technicalSubjectBank,technicalSubjectCards} from '../src/tecnica/espacio-trabajo-v2.mjs';
import {auditarPriorizadosTecnica} from '../src/tecnica/auditoria-priorizados-2026.mjs';
import {validateCommonSpace} from '../src/normativa/composicion-pci-20261117.mjs';

const root=new URL('../data/tecnica/priorizados/',import.meta.url);
const safeRead=async id=>JSON.parse(await readFile(new URL(id+'.json',root),'utf8'));
const formacion=await Promise.all(SPECIALTIES.map(async spec=>{
  const doc=await safeRead(spec.id),bank=technicalSubjectBank(doc);
  return {spec,doc,bank,report:auditarPriorizadosTecnica(doc,bank)};
}));

test('las 26 especialidades tienen priorizados oficiales 2026, identificados y completos',async()=>{
 assert.equal(formacion.length,26);
 const files=await readdir(root);
 assert.equal(files.filter(f=>f.endsWith('.json')).length,27,
  '26 especialidades + catálogo transversal de Tecnología de la Representación');
 const ids=new Set();
 for(const {spec,doc,bank,report} of formacion){
   assert.equal(doc.especialidad_id,spec.id);
   assert.match(doc.fuente_url,/^https:\/\/static\.buenosaires\.gob\.ar\/sites\/default\/files\/2026-10\/[^?]+\.pdf$/);
   assert.equal(doc.schema,'pci-tecnica-priorizados/2');
   assert.ok(doc.asignaturas.length>0&&bank.length>0);
   assert.equal(report.totalSecciones,doc.asignaturas.length);
   assert.equal(report.totalReferencias,bank.length);
   assert.equal(report.referenciasConNivel+report.sinNivel.length,bank.length);
   assert.equal(report.horasNoIncluidas,true);
   assert.equal(report.camposEstimados,true);
   assert.equal(report.estado,'referencias_priorizadas_con_validacion_pedagogica_pendiente');
   assert.equal(new Set(bank.map(x=>x.id)).size,bank.length);
   for(const x of bank)assert.match(x.id,/^.+@p[1-9]\d*$/);
   assert.ok(!ids.has(spec.id));ids.add(spec.id);
 }
 const summary={
   especialidades:formacion.length,
   secciones:formacion.reduce((n,r)=>n+r.report.totalSecciones,0),
   referencias:formacion.reduce((n,r)=>n+r.report.totalReferencias,0),
   referenciadasConNivel:formacion.reduce((n,r)=>n+r.report.referenciasConNivel,0),
   pendientesSinNivel:formacion.reduce((n,r)=>n+r.report.sinNivel.length,0),
   fuentes:formacion.map(r=>r.spec.id)
 };
 assert.equal(summary.especialidades,26);
 console.log('AUDITORIA_PRIORIZADOS_TECNICA_2026='+JSON.stringify(summary));
});

test('el año de una sección inequívoca se aplica a sus páginas sin año propio, sin inventar años múltiples',async()=>{
 const doc=await safeRead('administracion_empresas');
 const section=doc.asignaturas.find(x=>x.asignatura==='Física'&&x.anios_detectados.length===1&&x.anios_detectados[0]===3);
 assert.ok(section);
 const page=section.paginas.find(x=>x.anio_contextual_inferido==null);
 assert.ok(page,'La fuente tiene una página Física sin año propio pero sección única en 3.º.');
 const bank=technicalSubjectBank(doc);
 const matching=bank.find(x=>x.id===section.id+'@p'+page.pagina_pdf);
 assert.equal(matching.year,3);
 const card=technicalSubjectCards(bank).find(x=>x.id===section.id&&x.year===3);
 assert.ok(card);assert.ok(card.pages.includes(page.pagina_pdf));
 const unknown=bank.filter(x=>x.year==null);
 assert.equal(auditarPriorizadosTecnica(doc,bank).sinNivel.length,unknown.length);
 for(const row of unknown)assert.equal(technicalSubjectCards(bank).some(c=>
   c.id===row.sectionId && c.pages.includes(row.page)),false,
   'La página sin nivel no debe mostrarse como materia en un curso inventado.');
});

test('la carga de materias y contenidos en V2 comparte año y referencia por página',async()=>{
 const before=globalThis.fetch;
 globalThis.fetch=async (url)=>{
  try{
   const path=String(url).split('?')[0].replace(/^\.?\//,'');
   const body=await readFile(new URL('../'+path,import.meta.url));
   return new Response(body,{status:200});
  }catch{return new Response('No encontrado',{status:404});}
 };
 try{
  const {loadTechnicalV2Profile}=await import('../src/v2-familia/catalogos-modalidad.mjs');
  for(const specId of ['administracion_empresas','computacion','mecanica']){
   const profile=await loadTechnicalV2Profile(specId);
   const audit=profile.priorizados;
   const doc=await safeRead(specId);
   const bank=technicalSubjectBank(doc);
   assert.equal(audit.totalReferencias,bank.length);
   assert.equal(audit.sinNivel.length,bank.filter(x=>x.year==null).length);
   for(const row of bank.filter(x=>x.year!==null)){
    const content=[...profile.contents.fg,...profile.contents.fo].find(c=>c.id===row.id);
    assert.ok(content,'Falta contenido original '+row.id);
    assert.equal(content.year,row.year,'Fase 2 debe usar mismo año que la materia '+row.id);
    assert.equal(content.page,row.page);
    assert.equal(content.source,doc.fuente_url);
   }
   for(const subject of profile.subjects.filter(s=>s.sourcePages?.length)){
    assert.ok(subject.sourcePages.every(p=>Number.isInteger(p)&&p>0));
    assert.equal(subject.source,doc.fuente_url);
   }
   assert.equal(profile.specialtyId,specId);
  }
 }finally{globalThis.fetch=before}
});

test('no son obligatorias las horas para componer; excepción de integración de Especialidad y tope en las demás',()=>{
 const base={year:4,term:7,duration:'cuatrimestral',
   format:'integracion_especialidad',subjectIds:['mat1','mat2']};
 const missing=validateCommonSpace({...base,weeklyHours:null},{model:'tecnica'});
 assert.equal(missing.errors.some(x=>x.code==='INVALID_HOURS'||x.code==='MAX_9_HOURS'),false);
 assert.ok(missing.warnings.some(x=>x.code==='HOURS_UNVERIFIED'));
 const over=validateCommonSpace({...base,weeklyHours:12},{model:'tecnica'});
 assert.equal(over.errors.some(x=>x.code==='MAX_9_HOURS'),false);
 assert.ok(over.warnings.some(x=>x.code==='HOURS_EXCEPTION_REQUIRES_PLAN'));
 const naturals=validateCommonSpace({...base,format:'integracion_natural',weeklyHours:12},{model:'tecnica'});
 assert.ok(naturals.errors.some(x=>x.code==='MAX_9_HOURS'));
 const social=validateCommonSpace({...base,format:'integracion_social',weeklyHours:12},{model:'tecnica'});
 assert.ok(social.errors.some(x=>x.code==='MAX_9_HOURS'));
});

test('la auditoría no modifica los catálogos y marca los campos por verificar',async()=>{
 const doc=await safeRead('mecanica'),prior=JSON.stringify(doc);
 const report=auditarPriorizadosTecnica(doc,technicalSubjectBank(doc));
 assert.ok(report.seccionesConNivelPorVerificar.length>0);
 assert.equal(JSON.stringify(doc),prior);
 assert.equal(report.porNivel[1].referencias>0,true);
 assert.equal(report.porNivel[6].referencias>0,true);
});
