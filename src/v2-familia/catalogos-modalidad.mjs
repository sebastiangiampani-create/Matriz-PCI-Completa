/**
 * Catálogos por modalidad para copias funcionales del motor V2.
 * Media NO usa este archivo: ejecuta vendor/pci-sec-aprende-v2 intacto.
 * Técnica: fuentes propias por especialidad; un corte de página NO implica
 * contenido atómico oficial validado. BA+15: 1.126 IDs FG originales, mapeados
 * a cuatro niveles según la equivalencia institucional establecida.
 */
import {findSpecialty,getAnnualSubjects} from '../tecnica/pautas-pci-20261005.mjs';
import {resolverPerfilEspecialidadTecnica} from '../tecnica/perfil-especialidad-2026.mjs';
import {technicalSubjectCards,technicalSubjectBank} from '../tecnica/espacio-trabajo-v2.mjs';
import {auditarPriorizadosTecnica} from '../tecnica/auditoria-priorizados-2026.mjs';
import {cargarBancoAtomicoTecnica,cotejarContenidosAtomicosTecnica} from '../tecnica/contenidos-atomicos-2026.mjs';
import {desagregarPendientesTecnica} from '../tecnica/desagregacion-documental-2026.mjs';
import {cargarBaseTecnicaReconstruida} from '../tecnica/base-contenidos-2026.mjs';
import {BA15_NIVELES} from '../ba15/reglas-curriculares.mjs';
import {BA15_FO_NORMA,auditarHorasFoBa15} from '../ba15/formacion-orientada-norma.mjs';
import {construirMateriasOrientadasNesBa15} from '../ba15/materias-orientacion-nes.mjs';
import {loadBa15FgBase,BA15_FG_LEVEL_MAP} from '../ba15/priorizados-base.mjs';
import {loadV2Fo,selectFoByOrientation} from '../integracion-curricular/catalogos.js';
import {ORIENTATIONS} from '../integracion-curricular/bridge.js';
const clone=v=>JSON.parse(JSON.stringify(v));
const text=v=>String(v??'').trim();
const safeId=id=>/^[a-z0-9_]{2,90}$/.test(text(id));
const uni=a=>[...new Set(a.filter(Boolean))];
const canonContent=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const contentKey=c=>[canonContent(c.subject),Number(c.year),canonContent(c.text)].join('|');
function common(model,track,levels,subjects,fgContents,foContents,note){
 if(!['tecnica','ba15'].includes(model)||!text(track)||![4,6].includes(levels))throw Error('Perfil V2 inválido');
 const ids=subjects.map(s=>s.id);
 if(ids.length!==new Set(ids).size)throw Error('La bolsa curricular tiene identificadores duplicados');
 const contents=[...fgContents,...foContents];
 if(contents.length!==new Set(contents.map(x=>x.id)).size)throw Error('La base de contenidos tiene IDs duplicados');
 return {model,track,levels,terms:levels*2,subjects:clone(subjects),contents:{fg:clone(fgContents),fo:clone(foContents)},
  sourceNote:note,verified:false};
}
function ba15Name(normalized){
 const s=text(normalized);
 if(/lengua adicional/i.test(s))return'Lengua Adicional';
 if(s==='EDI')return'Espacios de Definición Institucional';
 return s;
}
async function loadV2OrientationFile(orientationId,orientationName){
 if(!safeId(orientationId))throw Error('Orientación inválida');
 const response=await fetch('vendor/pci-sec-aprende-v2/data/orientaciones/'+orientationId+'.txt',{cache:'force-cache'});
 if(!response.ok)return [];
 const bytes=Uint8Array.from(atob((await response.text()).trim()),c=>c.charCodeAt(0));
 const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
 const rows=JSON.parse(await new Response(stream).text());
 if(!Array.isArray(rows))throw Error('Base de orientación V2 inválida: '+orientationId);
 // Estructura V2: bloque → eje → subeje → texto. En estos archivos el eje
 // llega como «Eje · Subeje»; se separa como en la base FO actual de V2.
 return rows.filter(r=>text(r.id)&&text(r.text)).map(r=>{
  const [axis,...rest]=text(r.axis).split(' · ');
  return {id:text(r.id),orientation:orientationName,block:text(r.block),subject:text(r.block),
   axis:text(axis),subaxis:text(rest.join(' · ')),text:text(r.text)};
 });
}
export async function loadBa15V2Profile(orientationId){
 const o=ORIENTATIONS.find(x=>x.id===orientationId);
 if(!o)throw Error('Orientación BA +15 inexistente');
 const fg=await loadBa15FgBase();
 const v2Fo=await loadV2Fo();
 let fo=selectFoByOrientation(v2Fo,orientationId,ORIENTATIONS),foSource='Referencia FO V2 (curriculum_v96)';
 // La base FO actual de V2 (860 contenidos) cubre 10 orientaciones. Para las
 // demás, V2 conserva sus contenidos en data/orientaciones/<id>.txt: mismo
 // diseño curricular que Media, sin crear contenidos nuevos.
 if(!fo.length){fo=await loadV2OrientationFile(orientationId,o.name);foSource='V2 data/orientaciones/'+orientationId+'.txt';}
 if(fg.length!==1126)throw Error('La base BA +15 no conserva los 1.126 contenidos priorizados');
 const foHours=auditarHorasFoBa15(BA15_NIVELES);
 if(foHours.some(x=>!x.valido))throw Error('La carga horaria de Formación Orientada no coincide con RES-1375/MEDGC/25.');
 const nesResponse=await fetch('vendor/pci-sec-aprende-v2/data/materias-v2.json',{cache:'force-cache'});
 if(!nesResponse.ok)throw Error('No se pudo cargar el catálogo de materias FO NES del V2 original.');
 const ofertaNes=construirMateriasOrientadasNesBa15({
  catalogo:await nesResponse.json(),orientacion:o.name
 });
 const subjects=[];
 for(let i=0;i<4;i++)for(const m of BA15_NIVELES[i]){
   const name=ba15Name(m.nombre);
   const id='ba15-fg-'+(i+1)+'-'+name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-');
   subjects.push({id,name,year:i+1,origin:'FG',area:m.area,format:m.formato,weeklyHours:m.horas,
    field:m.area==='Formación Orientada'?'formacion_orientada':'formacion_general',
    isOrientationHourBucket:/^materias? de la orientaci[oó]n$/i.test(m.nombre),
    prescribedFrom:'RES-1375/MEDGC/25 · Anexo I · 6.3'});

 }
 // Las asignaturas de Fase 1 provienen del plan NES de la orientación
 // por año y alternativa A/B. Los bloques FO v96 permanecen SOLO para Fase 2.
 // No se atribuyen horas a cada materia si el plan BA +15 no las detalla.
 const oriName=o.name;
 subjects.push(...ofertaNes.subjects);
 // Compatibilidad ADITIVA: los PCI BA +15 ya iniciados pueden conservar IDs
 // de la bolsa previa, que había confundido bloques de Media con materias.
 // Se retienen solo para lectura/revisión de asignaciones; no se ofrecen para
 // nuevos arrastres ni se reescribe ningún borrador escolar.
 const legacyBlocks=new Set(fo.map(row=>text(row.block||row.subject||'Formación Orientada')).filter(Boolean));
 const legacyIds=new Set(subjects.map(x=>x.id));
 for(const year of [2,3,4])for(const name of legacyBlocks){
  const historicalKey=year+':'+name;
  const legacyId='ba15-fo-'+historicalKey.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-');
  if(legacyIds.has(legacyId))continue;
  legacyIds.add(legacyId);
  subjects.push({id:legacyId,name,year,origin:'FO',area:'Formación Orientada',field:'formacion_orientada',
   legacyReference:true,referenceOnly:true,confirmedBa15Subject:false,weeklyHours:null,
   sourceType:'bloque_fo_v2_historico',source:'Bolsa FO anterior · conservar para revisión'});
 }
 const fgContents=fg.map(row=>({
   id:row.id,component:'FG',year:row.year,sourceYear:row.sourceYear,
   area:text(row.area),subject:text(row.subject),axis:text(row.axis),
   subaxis:text(row.subaxis),text:text(row.text),source:'FG V2 priorizados con equivalencia BA+15'
 }));
 const foContents=fo.map(row=>({
   id:row.id,component:'FO',area:'Formación Orientada',subject:text(row.block||row.subject),
   axis:text(row.axis),subaxis:text(row.subaxis),text:text(row.text),
   block:text(row.block),orientation:oriName,source:foSource+', referencia de contenidos sin homologación de materias',
   referenceOnly:true,confirmedBa15Subject:false,levelBasis:'no_declarado_en_fuente_FO'
 }));
 const profile=common('ba15',oriName,4,subjects,fgContents,foContents,
  'FG: 1126 contenidos NES 1+2→I, 3→II, 4→III, 5→IV. FO: materias del plan NES por orientación y alternativa A/B (3.º→II, 4.º→III, 5.º→IV), con cupos 4, 9 y 12+2+2 HC. Fase 2 usa bloques FO de referencia; no se declara homologación BA +15.');
 profile.foPlan=clone(BA15_FO_NORMA);
 profile.foHoursAudit=clone(foHours);
 profile.foSubjectStatus='materias_nes_por_nivel_y_alternativa_pendientes_de_validacion_ba15';
 profile.foAlternatives=clone(ofertaNes.alternativas);
 profile.foWarnings=clone(ofertaNes.warnings);
 profile.foSource={sourceFile:ofertaNes.sourceFile,version:ofertaNes.sourceVersion,
  levelMap:{3:2,4:3,5:4},defaultAlternative:ofertaNes.defaultAlternative,
  scope:'Plan NES de referencia. No incluye horas individuales ni homologación BA +15.'};
 return profile;
}
// Área de un contenido técnico = área curricular de su materia en el mapa
// (IF-2026-51169092: Física y Química integran Ciencias Naturales; Matemática
// es troncal; el Taller de 3.º en adelante es Taller de la Especialidad).
const TECH_MAP_AREAS=['Matemática','Lengua y Literatura','Lengua Adicional','Ciencias Naturales','Ciencias Sociales',
 'Educación Física','Educación Artística','Tecnología de la Representación','Taller del Primer Ciclo'];
function technicalContentArea(section,field,year,subjects){
 const name=text(section.asignatura);
 const subject=subjects.find(x=>x.name===name&&(!year||x.year===year))||subjects.find(x=>x.name===name);
 const area=text(subject?.area);
 if(area==='Taller del Primer Ciclo'&&Number(subject?.year)>=3)return'Formación Técnico-Específica';
 if(TECH_MAP_AREAS.includes(area))return area;
 if(field==='formacion_cientifico_tecnologica')return'Formación Científico-Tecnológica';
 if(field==='formacion_tecnica_especifica')return'Formación Técnico-Específica';
 if(field==='practicas_profesionalizantes')return'Prácticas Profesionalizantes';
 return area||'Formación General';
}
export async function loadTechnicalV2Profile(specialtyId){
 if(!safeId(specialtyId))throw Error('Identificador de especialidad técnica inválido');
 const specialty=findSpecialty(specialtyId);
 if(!specialty)throw Error('Especialidad técnica no reconocida');
 const result=await fetch('data/tecnica/priorizados/'+specialty.id+'.json',{cache:'no-store'});
 if(!result.ok)throw Error('No está disponible la base de contenidos priorizados de '+specialty.name);
 const document=await result.json();
 if(document.especialidad_id!==specialty.id||
    document.schema!=='pci-tecnica-priorizados/2'||!Array.isArray(document.asignaturas))
    throw Error('La base técnica no corresponde a la especialidad seleccionada');
 const bank=technicalSubjectBank(document);
 const cards=technicalSubjectCards(bank);
 const subjects=cards.map(card=>({
    id:'tec-'+card.key,year:card.year,name:card.name,area:card.area,
    field:card.field,origin:card.field==='formacion_general'?'FG':'FO',
    provisional:card.provisional,sourceHash:card.sourceSha,
    sourcePages:card.pages||[],source:document.fuente_url
 }));
 const annual=getAnnualSubjects(specialty.id);
 if(annual)for(const year of [4,5,6]){
   const name=text(annual[year]);if(!name)continue;
   if(!subjects.some(s=>s.name===name&&s.year===year&&s.field==='formacion_tecnica_especifica')){
     subjects.push({id:'tec-anual-'+specialty.id+'-'+year,year,name,
       area:'Espacio anual de la especialidad',field:'formacion_tecnica_especifica',origin:'FO',
       sourceHash:document.sha256_pdf,provisional:false});
   }
 }
 // Fuente única para Fase 1 y Fase 2: mismo año de referencia.
 // Si el año de página está vacío pero la sección tiene uno inequívoco,
 // el banco lo conserva como inferido, nunca como año oficialmente confirmado.
 const originalPages=bank; // Auditoría: conservar referencias por página en reporte, nunca como contenido seleccionable.
 const atomicRows=await cargarBancoAtomicoTecnica();
 const cotejo=cotejarContenidosAtomicosTecnica(document,originalPages,atomicRows);
 // Priorizar la base única reconstruida geométricamente desde el PDF oficial.
 // Los cotejos previos conservan sus IDs para no romper planes guardados.
 let reconstructed=null,documental=null;
 try {reconstructed=await cargarBaseTecnicaReconstruida(document);}
 catch(error){
  if(!/^No está publicada la base técnica reconstruida/.test(String(error?.message||'')))throw error;
  documental=desagregarPendientesTecnica(document,originalPages,cotejo.pendientes);
 }
 const candidates=reconstructed?.contenidos||documental.contenidos;
 const known=new Set(cotejo.contenidos.map(contentKey));
 const additional=candidates.filter(c=>{const key=contentKey(c);if(known.has(key))return false;known.add(key);return true;});
 const fgContents=[],foContents=[];
 for(const atomic of [...cotejo.contenidos,...additional]){
   const section= document.asignaturas.find(x=>x.id===atomic.sourceReference.split('@p')[0]);
   if(!section)throw Error('Falta la sección oficial del contenido '+atomic.id);
   const area=technicalContentArea(section,atomic.field,atomic.year,subjects);
   const row={...atomic,area,subject:text(section.asignatura)};
   (atomic.component==='FG'?fgContents:foContents).push(row);
 }
 if(!subjects.length)throw Error('Catálogo técnico sin materias.');
 // Lengua Adicional 1.º–5.º: troncal en Técnica (IF-2026-51169092, pág. 13).
 // Si el catálogo de la especialidad no la trae, se toma de la NES (mismo año).
 const missingLA=[1,2,3,4,5].filter(y=>!subjects.some(x=>x.year===y&&(x.area==='Lengua Adicional'||/^(lengua adicional|ingl[eé]s)/i.test(x.name))));
 if(missingLA.length){
  const nes=(await loadBa15FgBase()).filter(r=>/lenguas? adicional/i.test(r.area)&&missingLA.includes(Number(r.sourceYear)));
  const used=new Set(fgContents.map(x=>x.id));
  for(const y of missingLA){
   subjects.push({id:'tec-nes-'+y+'-lengua-adicional',name:'Lengua Adicional',year:y,origin:'FG',area:'Lengua Adicional',field:'formacion_general',source:'NES (Res. 321-MEGC/15)'});
   for(const r of nes.filter(r=>Number(r.sourceYear)===y)){
    const id='tec-nes:'+r.id;if(used.has(id))continue;used.add(id);
    fgContents.push({id,component:'FG',year:y,area:'Lengua Adicional',subject:'Lengua Adicional',axis:text(r.axis),subaxis:text(r.subaxis),text:text(r.text),source:'NES · Lenguas Adicionales '+y+'.º año'});
   }
  }
 }
 const profile=common('tecnica',specialty.name,6,subjects,fgContents,foContents,
  'Especialidad '+specialty.name+' · contenidos rearmados desde las columnas originales de los PDF oficiales 2026, por materia y año. No implica homologación normativa automática.');
 profile.specialtyId=specialty.id;
 profile.specialtyProfile=resolverPerfilEspecialidadTecnica(specialty.id);
 profile.priorizados={...auditarPriorizadosTecnica(document,bank),
  contenidosAtomicos:cotejo.resumen,
  desagregacionDocumental:documental?.resumen||null,
  baseReconstruida:reconstructed?{
   contenidosExtraidos:reconstructed.contenidos.length,
   nuevosSinDuplicar:additional.length,
   contenidosHistoricosConservados:cotejo.contenidos.length,
   conceptosUnicos:reconstructed.base.resumen?.conceptosUnicos,
   materias:reconstructed.base.materias?.length,
   incidencias:reconstructed.base.incidencias?.length||0,
   fuente:document.fuente_url
  }:null,
  pendientesDeAtomizacion:reconstructed?
   (reconstructed.base.incidencias||[]).map(x=>({id:'pagina-'+x.page,year:null,page:x.page,name:x.subject,reason:x.reason})):
   documental.pendientes.map(x=>({id:x.id,year:x.year,page:x.page,name:x.name,reason:x.reason})),
  advertenciaRevision:reconstructed?
   'Base reconstruida de las columnas originales del PDF oficial. No equivale a homologación normativa automática.':
   'Base antigua provisional hasta publicar el banco reconstruido.'};
 return profile;
}
export async function loadV2ModalProfile(params){
 const model=text(params.model);
 if(model==='tecnica')return loadTechnicalV2Profile(params.specialty);
 if(model==='ba15')return loadBa15V2Profile(params.orientation);
 throw Error('Solo Técnica y BA +15 utilizan el adaptador. Media usa V2 original.');
}
