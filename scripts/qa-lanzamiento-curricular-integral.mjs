#!/usr/bin/env node
/**
 * Auditoria curricular integral de lectura, sin Supabase ni credenciales.
 * No homologa automaticamente PDF, materias, ejes, subejes o planes de estudio.
 * Las cifras de referencia pertenecen a archivos versionados del repositorio.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {SPECIALTIES} from '../src/tecnica/pautas-pci-20261005.mjs';
import {resolverPerfilEspecialidadTecnica} from '../src/tecnica/perfil-especialidad-2026.mjs';
import {technicalSubjectBank,technicalSubjectCards} from '../src/tecnica/espacio-trabajo-v2.mjs';
import {BA15_NIVELES,BA15_NORMATIVA,validarBa15} from '../src/ba15/reglas-curriculares.mjs';
import {BA15_FO_NORMA,auditarHorasFoBa15} from '../src/ba15/formacion-orientada-norma.mjs';
import {buildBa15FgBase,summarizeBa15FgBase} from '../src/ba15/priorizados-base.mjs';
import {loadV2Fg,loadV2Fo,selectFoByOrientation} from '../src/integracion-curricular/catalogos.js';
import {ORIENTATIONS} from '../src/integracion-curricular/bridge.js';
import {loadBa15V2Profile,loadTechnicalV2Profile} from '../src/v2-familia/catalogos-modalidad.mjs';

const root=new URL('../',import.meta.url);
const load=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const fetchFn=async url=>{
  try {const bytes=await readFile(url,'utf8');return {ok:true,text:async()=>bytes};}
  catch{return {ok:false,text:async()=>''};}
};
const issues=[];
const assertCond=(condition,message)=>{if(!condition)issues.push(message)};
assert.equal(SPECIALTIES.length,26,'Deben existir 26 especialidades técnicas');
assert.equal(ORIENTATIONS.length,16,'Deben existir 16 orientaciones');
const originalIndex=await load('data/tecnica/base-curricular/indice.json');
assert.equal(originalIndex.totales.especialidades,26);
assert.equal(originalIndex.totales.contenidos,61114);
assert.equal(originalIndex.homologacion,'no_declarada',
  'No se permite llamar homologada a una base sin reconocimiento pedagógico');
const technical=[];
const annualCounts={prescripto:0,no_definido_en_anexo:0,no_ofrece:0};
let totalReferences=0;
for(const specialty of SPECIALTIES){
  const profile=resolverPerfilEspecialidadTecnica(specialty.id);
  assert.ok(profile,'No se resolvió el perfil '+specialty.id);
  assert.equal(profile.levels,6);
  assert.equal(profile.terms,12);
  assert.equal(profile.planParticularVerificado,false,
    'No marcar plan particular como verificado sin una fuente por especialidad');
  const annual=profile.espacioAnual.status;
  assert.ok(annual in annualCounts,'Estado anual inesperado: '+annual);
  annualCounts[annual]++;
  const source=await load('data/tecnica/priorizados/'+specialty.id+'.json');
  assert.equal(source.especialidad_id,specialty.id);
  assert.equal(source.schema,'pci-tecnica-priorizados/2');
  const serialized=JSON.stringify(source);
  const bank=technicalSubjectBank(source);
  const refs=bank.length;
  const withoutYear=bank.filter(row=>!Number.isInteger(row.year)||row.year<1||row.year>6).length;
  totalReferences+=refs;
  const cards=technicalSubjectCards(bank);
  const content=await load('data/tecnica/base-curricular/'+specialty.id+'.json');
  const fieldInfo={rootKeys:Object.keys(content),count:
    Array.isArray(content.contenidos)?content.contenidos.length:
    Array.isArray(content.items)?content.items.length:null};
  const row={id:specialty.id,nombre:specialty.name,anual:annual,
    referencias:refs,referenciasSinAno:withoutYear,materiasDisponibles:cards.length,
    catalogo:fieldInfo,estado:source.estado};
  technical.push(row);
  if(!refs)issues.push('Sin referencias priorizadas: '+specialty.id);
  if(!cards.length)issues.push('Sin materias seleccionables: '+specialty.id);
  if(JSON.stringify(source)!==serialized)throw Error('Fuente técnica alterada: '+specialty.id);
}
assert.equal(totalReferences,2674,'Las referencias técnicas no coinciden con el corpus auditado');
assert.deepEqual(annualCounts,{prescripto:20,no_definido_en_anexo:5,no_ofrece:1});
const [fg,fo]=await Promise.all([loadV2Fg({fetchFn}),loadV2Fo({fetchFn})]);
assert.equal(fg.length,1126,'La referencia FG de Media no tiene 1126 contenidos');
assert.equal(fo.length,860,'La referencia FO de Media no tiene 860 contenidos');
const fgFingerprint=JSON.stringify(fg);
const projected=buildBa15FgBase(fg);
const summary=summarizeBa15FgBase(projected);
assert.equal(summary.uniqueIds,1126);
assert.deepEqual(summary.byLevel.map(x=>x.sourceYears),[[1,2],[3],[4],[5]]);
assert.equal(JSON.stringify(fg),fgFingerprint,'No modificar los contenidos Media V2');
assert.equal(BA15_NORMATIVA.niveles,4);
assert.deepEqual(BA15_NIVELES.map(items=>items.reduce((n,item)=>n+item.horas,0)),[38,38,38,38]);
assert.equal(validarBa15().valido,true,'La estructura básica BA+15 incumple la norma');
const auditedHours=auditarHorasFoBa15(BA15_NIVELES);
assert.ok(auditedHours.every(x=>x.valido),'Horas FO BA+15 incumplen la norma');
const foByOrientation=[];
for(const o of ORIENTATIONS){
  const primary=selectFoByOrientation(fo,o.id,ORIENTATIONS);
  let rows=primary,source='v2-fo-v96',fallbackCount=0;
  if(!rows.length){
    try{
      const encoded=await readFile(new URL('vendor/pci-sec-aprende-v2/data/orientaciones/'+o.id+'.txt',root),'utf8');
      const unpacked=JSON.parse(gunzipSync(Buffer.from(encoded.trim(),'base64')).toString('utf8'));
      assert.ok(Array.isArray(unpacked),'El respaldo de orientación no contiene un catálogo');
      rows=unpacked.filter(x=>String(x?.id||'').trim()&&String(x?.text||'').trim());
      fallbackCount=rows.length;
      source='v2-orientacion-'+o.id;
    }catch(e){issues.push('No se pudo leer FO V2 alternativa '+o.id+': '+String(e.message||e));}
  }
  foByOrientation.push({id:o.id,nombre:o.name,foReferences:rows.length,
    referenciasFuentePrimaria:primary.length,referenciasFallback:fallbackCount,fuente:source});
}
const emptyFo=foByOrientation.filter(row=>row.foReferences===0);
if(emptyFo.length)issues.push('Orientaciones sin ninguna fuente FO V2: '+emptyFo.map(r=>r.id).join(', '));
// Prueba de los perfiles REALES que usa el constructor en el navegador.
// Red estrictamente anulada: solo archivos estáticos del mismo repositorio.
const realFetch=globalThis.fetch;
globalThis.fetch=async (input)=>{
  const path=typeof input==='string'?input:String(input?.url??input);
  if(!path||/^[a-z]+:\/\//i.test(path)||path.startsWith('/')||path.includes('..'))
    throw Error('La auditoría no puede conectar con servicios externos: '+path);
  try{
    const contents=await readFile(new URL(path,root));
    return new Response(contents,{status:200});
  }catch(error){
    if(error?.code==='ENOENT')return new Response('Archivo local no encontrado',{status:404});
    throw error;
  }
};
const perfilesAbiertos={ba15:[],tecnica:[]};
try{
  for(const o of ORIENTATIONS){
    try{
      const profile=await loadBa15V2Profile(o.id);
      assert.equal(profile.levels,4);
      assert.equal(profile.terms,8);
      assert.equal(profile.contents.fg.length,1126);
      assert.ok(profile.contents.fo.length>0,'Sin FO para '+o.id);
      assert.ok(profile.subjects.length>0,'Sin materias para '+o.id);
      assert.equal(profile.verified,false,'No declarar homologación automática');
      perfilesAbiertos.ba15.push({id:o.id,materias:profile.subjects.length,
        fg:profile.contents.fg.length,fo:profile.contents.fo.length,
        cotejosNes:profile.foEvidenciaResumen});
    }catch(e){issues.push('Error cargando perfil real BA+15 '+o.id+': '+String(e.message||e));}
  }
  for(const spec of SPECIALTIES){
    try{
      const profile=await loadTechnicalV2Profile(spec.id);
      assert.equal(profile.levels,6);
      assert.equal(profile.terms,12);
      assert.ok(profile.subjects.length>0,'Sin materias de '+spec.id);
      assert.ok(profile.contents.fg.length+profile.contents.fo.length>0,'Sin contenidos de '+spec.id);
      assert.equal(profile.verified,false,'No declarar homologación automática');
      perfilesAbiertos.tecnica.push({id:spec.id,materias:profile.subjects.length,
        fg:profile.contents.fg.length,fo:profile.contents.fo.length});
    }catch(e){issues.push('Error cargando perfil real Técnica '+spec.id+': '+String(e.message||e));}
  }
}finally{globalThis.fetch=realFetch;}
if(perfilesAbiertos.ba15.length!==16)issues.push('No abrieron los 16 perfiles BA+15');
if(perfilesAbiertos.tecnica.length!==26)issues.push('No abrieron los 26 perfiles técnicos');
// Fallar CI cuando un perfil real no es abrible; mantener el reporte JSON.
const fallosDeApertura=issues.filter(x=>/Error cargando perfil real|No abrieron/.test(x));
const report={
 schema:'pci-auditoria-curricular-cierre/1',
 fecha:'2026-11-27',
 tipo:'lectura_integral_sin_homologacion',
 fuenteBa15:BA15_NORMATIVA,
 fuenteTecnica:'IF-2026-51169092-GCABA-SSPIE (codificado en src/normativa)',
 media:{fg:fg.length,fo:fo.length,datosOriginalesIntactos:true},
 ba15:{niveles:4,cuatrimestres:8,horasPorNivel:[38,38,38,38],
   fg:summary,horasFo:auditedHours,foPorOrientacion:foByOrientation,
   orientacionesSinFo:emptyFo.map(x=>x.id),
   requiereDocumentarArticulaciones:true,homologacionMateriasOrientacionAutomatica:false},
 perfilesReales:{...perfilesAbiertos,fallos:fallosDeApertura},
 tecnica:{especialidades:technical.length,cuatrimestres:12,
   prescripcionesAnuales:annualCounts,referenciasDocumentales:totalReferences,
   catalogoOriginal:originalIndex.totales,
   homologacionFuente:originalIndex.homologacion,
   especialidades:technical,
   planParticularVerificado:0},
 observaciones:issues,
 habilitacionMasiva:false,
 motivo:'Faltan homologación pedagógica de contenidos técnicos por especialidad, planes particulares y prueba operativa autenticada con escuela piloto.'
};
const dest=resolve('test-artifacts/auditoria-curricular');
await mkdir(dest,{recursive:true});
await writeFile(resolve(dest,'informe-completo-20261127.json'),JSON.stringify(report,null,2)+'\n');
console.log('AUDITORIA_CURRICULAR_RESUMEN='+JSON.stringify({
 tecnica:report.tecnica.especialidades,
 referencias:totalReferences,anuales:annualCounts,
 contenidosCatalogo:originalIndex.totales.contenidos,
 sinEjeExplicito:originalIndex.totales.sinEjeExplicito,
 sinSubejeExplicito:originalIndex.totales.sinSubejeExplicito,
 ba15Fg:fg.length,ba15Fo:fo.length,
 ba15NivelesHoras:report.ba15.horasPorNivel,
 orientacionesFoVacias:emptyFo.length,
 orientacionesConFallback:foByOrientation.filter(x=>x.referenciasFallback>0).length,
 observaciones:issues.length,habilitacionMasiva:false
}));
console.log('AUDITORIA_CURRICULAR_OBSERVACIONES='+JSON.stringify(issues));
console.log('AUDITORIA_PERFILES_REALES='+JSON.stringify({ba15:perfilesAbiertos.ba15.length,tecnica:perfilesAbiertos.tecnica.length,fallos:fallosDeApertura}));
if(fallosDeApertura.length)process.exitCode=1;
