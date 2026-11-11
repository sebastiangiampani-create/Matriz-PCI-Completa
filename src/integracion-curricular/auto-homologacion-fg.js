/**
 * Cruce automático por LOTES de FG histórica -> FG V2.
 *
 * Estados:
 *   confirmed: homologación institucional previamente validada.
 *   exact: correspondencia única exacta (ya reconocida por el motor existente).
 *   multiple-exact: ambiguo; no se acredita nada nuevo.
 *   proposed-multiple: un enunciado amplio podría desagregarse en 2..4 V2.
 *   proposed-single: posible correspondencia parcial.
 *   unmatched: no hay correspondencias textuales confiables.
 *
 * La propuesta nunca aprueba contenidos por similitud, no modifica el PCI,
 * no genera porcentajes ni sustituye los planes/secuencias previos.
 * El año de referencia sale EXCLUSIVAMENTE de group.level (la fila histórica
 * no tiene año). Las propuestas se fijan a los IDs y versiones concretos.
 */
import {matchMatrixToV2Fg} from './catalogos.js';
import {mappingKey} from './homologaciones.js';

export const AUTO_FG_SOURCE='fg-matriz-historica/1';
export const AUTO_FG_TARGET='fg-sec-aprende-v2/1';
export const AUTO_FG_METHOD='fg-lexical-preview/1';

const arr=x=>Array.isArray(x)?x:[];
const normalize=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const keyName=x=>({
  'lengua adicional':'lenguas adicionales',
  'lenguas adicional':'lenguas adicionales',
  'formacion etica ciudadana':'formacion etica y ciudadana',
  'tecnologia de la informacion':'tecnologias de la informacion',
  'educacion artistica artes visuales':'artes visuales'
}[normalize(x)]||normalize(x));
const stopwords=new Set([
  'para','como','desde','hasta','entre','sobre','segun','mediante','tambien',
  'cada','todo','todos','todas','esta','este','estos','estas','otras','otros',
  'contenido','contenidos','analisis','proceso','procesos','sistema','sistemas',
  'general','especifico','principales','diferentes','diversos','diversas',
  'relacion','relaciones','forma','formas','partir','comprension','comprender',
  'reconocimiento','identificacion','participacion','desarrollo','desarrollar',
  'abordaje','caracteristicas','elementos','concepto','conceptos','nocion',
  'nociones','utilizacion','aplicacion','importancia','situaciones','acerca',
  'ellas','ellos','donde','cuales','cual','este','esta','esos','esas','aquel',
  'sobre','cuando','manera','modo','posible','traves','parte','partes',
  'tiene','tienen','hacia','puede','pueden','organizacion','organizaciones'
]);
const commonConcepts=new Map([
  ['actores','actor'],['mercados','mercado'],['bienes','bien'],
  ['servicios','servicio'],['circulacion','circulacion'],
  ['informaciones','informacion'],['relaciones','relacion'],
  ['transacciones','transaccion'],['decisiones','decision']
]);
function token(word) {
  if (commonConcepts.has(word)) return commonConcepts.get(word);
  if (word.endsWith('es') && word.length>6 && !word.endsWith('iones')) return word.slice(0,-2);
  if (word.endsWith('s') && word.length>5) return word.slice(0,-1);
  return word;
}
function tokens(text){
  const items=normalize(text).split(' ').filter(Boolean);
  return new Set(items.map(token).filter(x=>x.length>=4&&!stopwords.has(x)));
}
const overlap=(a,b)=>[...a].filter(x=>b.has(x));
function scoreReference(original,reference){
  const source=tokens(original.text);
  const target=tokens(reference.text);
  if(source.size<2||target.size<2) return null;
  const shared=overlap(target,source);
  if(shared.length<2) return null;
  const precision=shared.length/target.size;
  const recall=shared.length/source.size;
  // Para un contenido original amplio, cada destino V2 puede desarrollar
  // solo una parte. La coincidencia debe cubrir conceptos distintivos de V2.
  const quality=Number((precision*.74+recall*.26).toFixed(3));
  if(precision<.55||quality<.48) return null;
  return {
    ...reference,
    lexicalScore:quality,
    commonConcepts:shared,
    candidateOnly:true,
    evidence:'solapamiento léxico; requiere revisión pedagógica'
  };
}
function proposedCandidates(src,universe,maxReferences){
  if(!src||!src.text)return [];
  const possibilities=universe.map(ref=>scoreReference(src,ref))
    .filter(Boolean)
    .sort((a,b)=>b.lexicalScore-a.lexicalScore||
      b.commonConcepts.length-a.commonConcepts.length||
      String(a.id).localeCompare(String(b.id)));
  const selected=[],covered=new Set();
  for(const candidate of possibilities){
    const novel=candidate.commonConcepts.filter(x=>!covered.has(x));
    // Dos referencias que dicen básicamente lo mismo no se consideran
    // desagregaciones nuevas de un mismo contenido.
    if(!novel.length) continue;
    for(const word of novel)covered.add(word);
    selected.push(candidate);
    if(selected.length>=maxReferences)break;
  }
  return selected;
}
function indexReference(v2FgRows){
  const index=new Map();
  for(const row of arr(v2FgRows)){
    const year=Number(row?.year);
    if(!Number.isInteger(year)||year<1||year>5||!row.id)continue;
    const key=JSON.stringify([normalize(row.area),year,keyName(row.subject)]);
    const list=index.get(key)||[];
    list.push(row);
    index.set(key,list);
  }
  return index;
}
function freezeJson(x){return JSON.parse(JSON.stringify(x));}
function valueStatus(result){
  return result==='confirmed'||result==='exact';
}
/**
 * A partir de la copia ya preparada para una ORIENTACIÓN, analiza los
 * contenidos colocados en todos sus niveles sin tocar siquiera un campo.
 */
export function analyzeAutomaticFgMatches({
  areas,matrixRows,v2FgRows,orientationId,
  approvedMappings={},maxReferences=4
}){
  if(!areas||typeof areas!=='object'||Array.isArray(areas))
    throw new TypeError('Falta la FG de la orientación.');
  if(!String(orientationId||'').trim())
    throw new TypeError('Falta la orientación de la copia de trabajo.');
  if(!Array.isArray(matrixRows)||!Array.isArray(v2FgRows)||
    !Number.isInteger(maxReferences)||maxReferences<1||maxReferences>8)
    throw new TypeError('Catálogos o cantidad de sugerencias inválidos.');
  const legacyById=new Map(matrixRows.map(r=>[String(r.id),r]));
  const indexed=indexReference(v2FgRows),placed=new Map();
  let scannedGroups=0,previousPlans=0;
  const skippedGroups=[];

  for(const [groupArea,block] of Object.entries(areas)){
    for(const g of arr(block?.groups)){
      const level=Number(g?.level);
      scannedGroups++;
      previousPlans+=arr(g?.plansBimestrales).length;
      if(!Number.isInteger(level)||level<1||level>5){
        skippedGroups.push({area:groupArea,groupId:String(g?.id??''),reason:'Año no definido'});
        continue;
      }
      for(const id of arr(g.items)){
        const matrixId=String(id),original=legacyById.get(matrixId);
        // Los formatos transversales se cotejan según el área REAL de
        // procedencia del contenido, no la etiqueta del contenedor.
        const area=original?.area||groupArea;
        const key=mappingKey(area,level,matrixId);
        if(!placed.has(key)){
          placed.set(key,{
            key,year:level,area,matrixId,
            source:original?{
              id:matrixId,subject:original.subject,axis:original.axis,text:original.text
            }:null,
            groups:[],status:'unmatched',reason:'',
            references:[],suggestedOnly:false
          });
        }
        const p=placed.get(key);
        if(!p.groups.some(x=>x.id===String(g.id))){
          p.groups.push({id:String(g.id),name:String(g.name||g.id),containerArea:groupArea});
        }
      }
    }
  }
  const rows=[];
  for(const p of placed.values()){
    const source=legacyById.get(p.matrixId);
    if(!source){
      p.status='unmatched';p.reason='ID histórico sin referencia en Matriz.';
      rows.push(p);continue;
    }
    const match=matchMatrixToV2Fg({
      matrixRows,v2FgRows,contentId:p.matrixId,
      level:p.year,area:p.area,approvedMappings
    });
    const reviewed=approvedMappings[mappingKey(p.area,p.year,p.matrixId)];
    if(reviewed&&match.status!=='matched'){
      p.status='review-invalid';
      p.reason='La homologación previa necesita revisión; nunca se sustituye automáticamente.';
      rows.push(p);continue;
    }
    if(match.status==='matched'){
      p.status=match.approved?'confirmed':'exact';
      p.references=arr(match.references).map(x=>({
        id:x.id,year:x.year,area:x.area,subject:x.subject,
        text:x.text,axis:x.axis,subaxis:x.subaxis
      }));
      p.reason=p.status==='exact'
        ? 'Texto idéntico, materia, área y año; coincidencia reconocida por la regla existente.'
        : 'Homologación pedagógica previamente aprobada: se conserva.';
      rows.push(p);continue;
    }
    if(match.status==='ambiguous'){
      p.status='multiple-exact';p.reason='Hay varios destinos de texto idéntico: elegir uno o varios requiere revisión.';
      p.references=arr(match.matches).map(id=>({id,year:p.year,area:p.area}));
      rows.push(p);continue;
    }
    const lookup=JSON.stringify([normalize(p.area),p.year,keyName(source.subject)]);
    const sameLevelSubject=indexed.get(lookup)||[];
    const candidates=proposedCandidates(source,sameLevelSubject,maxReferences);
    p.suggestedOnly=candidates.length>0;
    p.references=candidates.map(({id,year,area,subject,text,axis,subaxis,
      lexicalScore,commonConcepts,candidateOnly,evidence})=>({
      id,year,area,subject,text,axis,subaxis,lexicalScore,commonConcepts,candidateOnly,evidence
    }));
    p.status=candidates.length>1?'proposed-multiple':
      candidates.length===1?'proposed-single':'unmatched';
    p.reason=candidates.length>1
      ? 'Un contenido original podría desagregarse en varias referencias V2; validar individualmente.'
      : candidates.length===1
        ? 'Correspondencia parcial posible; validar alcance.'
        : 'No se encontró coincidencia textual suficiente: revisión específica.';
    rows.push(p);
  }
  rows.sort((a,b)=>a.year-b.year||a.area.localeCompare(b.area,'es')||
    a.source?.subject?.localeCompare(b.source?.subject,'es')||a.matrixId.localeCompare(b.matrixId));
  const summary={
    placedOriginals:rows.length,scannedGroups,previousPlans,
    confirmed:rows.filter(r=>r.status==='confirmed').length,
    exact:rows.filter(r=>r.status==='exact').length,
    proposedMultiple:rows.filter(r=>r.status==='proposed-multiple').length,
    proposedSingle:rows.filter(r=>r.status==='proposed-single').length,
    ambiguous:rows.filter(r=>r.status==='multiple-exact').length,
    reviewInvalid:rows.filter(r=>r.status==='review-invalid').length,
    unmatched:rows.filter(r=>r.status==='unmatched').length,
    skippedGroups:skippedGroups.length,
    validatedV2Ids:[...new Set(rows.filter(r=>valueStatus(r.status))
      .flatMap(r=>r.references.map(ref=>String(ref.id))))].length,
    suggestedV2Ids:[...new Set(rows.filter(r=>r.suggestedOnly)
      .flatMap(r=>r.references.map(ref=>String(ref.id))))].length,
    automaticApprovalsCreated:0
  };
  return freezeJson({
    method:AUTO_FG_METHOD,
    sourceVersion:AUTO_FG_SOURCE,targetVersion:AUTO_FG_TARGET,
    orientationId:String(orientationId),
    summary,skippedGroups,rows,
    notes:[
      'La Matriz original, agrupamientos, planes y secuencias no se modifican.',
      'Las coincidencias exactas únicas siguen la regla V2 existente.',
      'Ninguna sugerencia 1 a varios se acredita como cobertura sin validación pedagógica.',
      'El año se toma del agrupamiento, no del catálogo histórico.',
      'Las referencias repetidas se cuentan una vez en su mismo nivel.'
    ]
  });
}
