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
import {BA15_NIVELES} from '../ba15/reglas-curriculares.mjs';
import {loadBa15FgBase,BA15_FG_LEVEL_MAP} from '../ba15/priorizados-base.mjs';
import {loadV2Fo,selectFoByOrientation} from '../integracion-curricular/catalogos.js';
import {ORIENTATIONS} from '../integracion-curricular/bridge.js';
const clone=v=>JSON.parse(JSON.stringify(v));
const text=v=>String(v??'').trim();
const safeId=id=>/^[a-z0-9_]{2,90}$/.test(text(id));
const uni=a=>[...new Set(a.filter(Boolean))];
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
 const subjects=[];
 for(let i=0;i<4;i++)for(const m of BA15_NIVELES[i]){
   const name=ba15Name(m.nombre);
   const id='ba15-fg-'+(i+1)+'-'+name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-');
   subjects.push({id,name,year:i+1,origin:'FG',area:m.area,format:m.formato,weeklyHours:m.horas,field:'formacion_general'});
 }
 // El catálogo de orientación es referencia para el nuevo modelo;
 // se conserva la identificación V2 y no se inventan materias de BA+15.
 const oriName=o.name;
 const byYear=new Map();
 for(const row of fo){
   const key=text(row.block||row.subject||'Formación Orientada');
   if(!key)continue;
   // Bloques FO de Media no establecen equivalencia horaria BA+15.
   for(const year of [2,3,4])byYear.set(year+':'+key,{name:key,year,origin:'FO',field:'formacion_orientada',area:'Formación Orientada'});
 }
 for(const [key,row] of byYear)subjects.push({...row,id:'ba15-fo-'+key.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-')});
 const fgContents=fg.map(row=>({
   id:row.id,component:'FG',year:row.year,sourceYear:row.sourceYear,
   area:text(row.area),subject:text(row.subject),axis:text(row.axis),
   subaxis:text(row.subaxis),text:text(row.text),source:'FG V2 priorizados con equivalencia BA+15'
 }));
 const foContents=fo.map(row=>({
   id:row.id,component:'FO',area:'Formación Orientada',subject:text(row.block||row.subject),
   axis:text(row.axis),subaxis:text(row.subaxis),text:text(row.text),
   block:text(row.block),orientation:oriName,source:foSource+', mismo diseño que Media'
 }));
 return common('ba15',oriName,4,subjects,fgContents,foContents,
  'Base de Formación General: 1126 contenidos originales con NES 1+2→Nivel 1; NES 3→N2; NES 4→N3; NES 5→N4. Oferta FO orientada por verificar contra plan BA+15.');
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
 const fgContents=[],foContents=[];
 const sections=new Map(document.asignaturas.map(section=>[section.id,section]));
 for(const reference of bank){
   const section=sections.get(reference.sectionId);
   if(!section)throw Error('Referencia de contenido sin sección en el priorizado: '+reference.id);
   const field=text(reference.field);
   const component=field==='formacion_general'?'FG':'FO';
   const row={
     id:reference.id,component,year:reference.year,
     area:technicalContentArea(section,field,reference.year,subjects),
     subject:text(section.asignatura),axis:text(section.asignatura),
     subaxis:'Página '+reference.page+' · revisar selección curricular',
     text:reference.text,source:reference.source_url,
     page:reference.page,field,provisional:!section.campo_verificado||!section.anio_verificado,
     sourceYearConfidence:reference.confidence
   };
   (component==='FG'?fgContents:foContents).push(row);
 }
 if(!subjects.length||!fgContents.length)throw Error('Catálogo técnico sin materias o contenidos de FG');
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
  'Especialidad '+specialty.name+' · contenidos priorizados 2026 extraídos de PDF con página y fuente. La extracción requiere validación pedagógica; no equivale a homologación.');
 profile.specialtyId=specialty.id;
 profile.specialtyProfile=resolverPerfilEspecialidadTecnica(specialty.id);
 profile.priorizados=auditarPriorizadosTecnica(document,bank);
 return profile;
}
export async function loadV2ModalProfile(params){
 const model=text(params.model);
 if(model==='tecnica')return loadTechnicalV2Profile(params.specialty);
 if(model==='ba15')return loadBa15V2Profile(params.orientation);
 throw Error('Solo Técnica y BA +15 utilizan el adaptador. Media usa V2 original.');
}
