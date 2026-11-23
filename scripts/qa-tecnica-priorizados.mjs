#!/usr/bin/env node
/**
 * Auditoria documental de Técnica: no modifica catálogos ni estados de escuelas.
 * Desagregación provisional ≠ contenido homologado.
 * Produce evidencia reproducible para las 26 especialidades.
 */
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {SPECIALTIES} from '../src/tecnica/pautas-pci-20261005.mjs';
import {technicalSubjectBank} from '../src/tecnica/espacio-trabajo-v2.mjs';
import {cargarBancoAtomicoTecnica,cotejarContenidosAtomicosTecnica} from '../src/tecnica/contenidos-atomicos-2026.mjs';
import {desagregarPendientesTecnica} from '../src/tecnica/desagregacion-documental-2026.mjs';

const BASE=new URL('../',import.meta.url);
const file=async path=>JSON.parse(await readFile(new URL(path,BASE),'utf8'));
const fetchLocal=async path=>{
 try{
  if(!/^tecnica\/data\/[a-z0-9-]+\.json$/.test(String(path)))throw Error('Ruta no permitida');
  const data=await readFile(new URL(path,BASE));
  return new Response(data,{status:200,headers:{'content-type':'application/json'}});
 }catch{return new Response('No encontrado',{status:404})}
};
const tally=(a,key)=>{a[key]=(a[key]||0)+1;};
const rowKey=r=>r.reason||'sin_clasificar';
const curated=await cargarBancoAtomicoTecnica({fetcher:fetchLocal});
const results=[], totals={especialidades:0,referencias:0,atomicosCotejados:0,
 pendientesIniciales:0,referenciasDesagregadas:0,contenidosProvisionales:0,
 pendientesFinales:0,fragmentosSinEjeVerificado:0,fragmentosSinSubeje:0};
for(const spec of SPECIALTIES){
 const document=await file('data/tecnica/priorizados/'+spec.id+'.json');
 const original=JSON.stringify(document);
 const bank=technicalSubjectBank(document);
 const cotejo=cotejarContenidosAtomicosTecnica(document,bank,curated);
 const desagregacion=desagregarPendientesTecnica(document,bank,cotejo.pendientes);
 const motivos={},porCampo={},sinAnio=[],porAsignatura={};
 for(const ref of desagregacion.pendientes){
  tally(motivos,rowKey(ref));
  const source=bank.find(x=>x.id===ref.id);
  const campo=source?.field||'sin_campo';
  tally(porCampo,campo);
  tally(porAsignatura,source?.name||'sin_materia');
  if(ref.reason==='sin_anio_verificable'){
   sinAnio.push({id:ref.id,asignatura:source?.name||'',pagina:source?.page,fuente:source?.source_url});
  }
 }
 const review=desagregacion.contenidos.filter(c=>c.axisVerified!==true);
 const noSubaxis=desagregacion.contenidos.filter(c=>!String(c.subaxis||'').trim());
 const record={
  id:spec.id,especialidad:document.especialidad_nombre,fuente:document.fuente_url,
  referencias:bank.length,
  atomicosCotejados:cotejo.contenidos.length,
  pendientesIniciales:cotejo.pendientes.length,
  referenciasDesagregadas:desagregacion.resumen.referenciasDesagregadas,
  contenidosProvisionales:desagregacion.contenidos.length,
  pendientesFinales:desagregacion.pendientes.length,
  fragmentosSinEjeVerificado:review.length,
  fragmentosSinSubeje:noSubaxis.length,
  motivos,porCampo,porAsignatura,
  referenciasPendientes:desagregacion.pendientes.map(p=>{
   const ref=bank.find(x=>x.id===p.id);
   return {id:p.id,materia:ref?.name||'',anio:ref?.year??null,
    pagina:ref?.page,reason:p.reason,fuente:document.fuente_url};
  }),
  muestrasProvisionales:desagregacion.contenidos.slice(0,8).map(c=>({
   materia:c.subject,anio:c.year,pagina:c.page,texto:c.text,eje:c.axis
  }))
 };
 if(JSON.stringify(document)!==original)throw Error('Fuente modificada durante auditoria: '+spec.id);
 results.push(record);
 totals.especialidades++;
 for(const key of ['referencias','atomicosCotejados','pendientesIniciales',
  'referenciasDesagregadas','contenidosProvisionales','pendientesFinales',
  'fragmentosSinEjeVerificado','fragmentosSinSubeje'])totals[key]+=record[key];
}
if(totals.especialidades!==26||totals.referencias!==2674)
 throw Error('El universo documental cambió: '+JSON.stringify(totals));
const report={
 schema:'pci-tecnica-auditoria-documental/1',
 situacion:'borrador_en_revision',
 advertencia:'Los fragmentos de la extracción de PDF NO están pedagógicamente homologados.',
 totales:totals,especialidades:results
};
await mkdir(new URL('../test-artifacts/tecnica/',import.meta.url),{recursive:true});
await writeFile(new URL('../test-artifacts/tecnica/auditoria-pendientes-2026.json',import.meta.url),
 JSON.stringify(report,null,2)+'\n','utf8');
console.log('AUDITORIA_TECNICA_RESUMEN='+JSON.stringify(totals));
console.log('AUDITORIA_TECNICA_PENDIENTES_POR_ESPECIALIDAD='+JSON.stringify(
 results.filter(x=>x.pendientesFinales>0).map(x=>({id:x.id,pendientes:x.pendientesFinales,
  motivos:x.motivos,porCampo:x.porCampo}))));
console.log('AUDITORIA_TECNICA_MUESTRAS='+JSON.stringify(results
 .filter(x=>x.pendientesFinales>0)
 .slice(0,3).map(x=>({id:x.id,ejemplos:x.referenciasPendientes.slice(0,5)}))));
