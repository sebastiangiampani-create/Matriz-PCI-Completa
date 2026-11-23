/**
 * Bolsa FO del Régimen BA +15, tomada de las ASIGNATURAS NES del V2 real,
 * no de los bloques/ejes del catálogo de contenidos FO v96.
 *
 * La equivalencia de años es una decisión organizativa del PCI:
 * NES 3.º => BA +15 Nivel II; NES 4.º => Nivel III; NES 5.º => Nivel IV.
 * Los nombres son propuestas trazables al plan NES A/B de referencia:
 * sin horas individuales ni homologación automática de BA +15.
 */
import {cotejarHorasNesOrientadas} from './horas-nes-oficiales.mjs';
const clean=v=>String(v??'').trim();
const slug=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90);
export const BA15_FO_NES_YEAR_MAP=Object.freeze({3:2,4:3,5:4});
const fixedAtLevelIV=name=>{
 const normalized=slug(name).replace(/-/g,' ');
 return /^historia orientada\b/.test(normalized)||
  /^tecnologias? de la informacion orientada\b/.test(normalized);
};
export function construirMateriasOrientadasNesBa15({catalogo,orientacion}){
 if(!catalogo||!catalogo.formacion_orientada||typeof catalogo.formacion_orientada!=='object')
  throw new Error('No está disponible el catálogo de materias FO del V2 original.');
 const data=catalogo.formacion_orientada[orientacion];
 if(!data||typeof data!=='object')throw new Error('La orientación no figura en el catálogo de materias NES: '+orientacion);
 const alternativas=['A','B'].filter(alt=>Array.isArray(data[alt]?.['4'])&&
  Array.isArray(data[alt]?.['5'])&&
  (data[alt]['4'].length>0||data[alt]['5'].length>0));
 if(!alternativas.includes('A'))throw new Error('La orientación no dispone de una Alternativa A NES verificable: '+orientacion);
 if(!Array.isArray(data['3'])||!data['3'].length)
  throw new Error('La orientación no tiene materias NES 3.º para el Nivel II de BA +15: '+orientacion);
 const subjects=[],seen=new Set(),warnings=[],cotejos=[];
 const append=(names,nesYear,alternative)=>{
  const cotejo=cotejarHorasNesOrientadas({
   orientacion,alternativa,anio:nesYear,materiasReferencia:names
  });
  cotejos.push({anio:nesYear,alternativa:alternative||'comun',estado:cotejo.estado,
   cupoPrevisto:cotejo.cupoPrevisto,sumaHorasNes:cotejo.sumaHorasNes,
   coincideCupo:cotejo.coincideCupo,discrepancias:cotejo.discrepancias,
   fuente:cotejo.fuente});
  const sourceItems=cotejo.materias;
  for(let i=0;i<sourceItems.length;i++){
   const item=sourceItems[i],name=clean(item.nombre),level=BA15_FO_NES_YEAR_MAP[nesYear];
   if(!name||level===4&&fixedAtLevelIV(name))continue;
   const oldName=clean(names[i]||'');
   // No reutilizar el ID de otra asignatura: la fuente NES B había
   // atribuido materias de Comunicación al 4.º de Economía.
   const changed=cotejo.estado==='cotejado_fuente_primaria'&&
    oldName&&slug(oldName)!==slug(name);
   const prefix='ba15-nes-fo-'+slug(orientacion)+'-'+level+'-'+
    (alternative||'comun').toLowerCase()+'-';
   const id=prefix+(changed?'anexo321-':'')+i;
   if(seen.has(id))throw new Error('Materia NES repetida en el perfil: '+name);
   seen.add(id);
   const verified=cotejo.estado==='cotejado_fuente_primaria';
   subjects.push({
    id,name,year:level,sourceYear:nesYear,
    sourceModel:verified?'NES · RES-321/15 Anexo oficial':'NES · V2',
    origin:'FO',field:'formacion_orientada',area:'Formación Orientada',
    alternative:alternative||null,referenceOnly:false,sourceType:'asignatura_nes',
    confirmedBa15Subject:false,weeklyHours:null,
    sourceWeeklyHours:verified?Number(item.horasNes):null,
    sourceHoursStatus:verified?'nes_documentada':'pendiente_documental',
    sourceUrl:verified?cotejo.fuente.url:null,
    sourcePages:verified?cotejo.fuente.paginas:[],
    source:verified?'RES-321/MEGC/2015 · Anexo VII':
     'vendor/pci-sec-aprende-v2/data/materias-v2.json'
   });
   if(changed){
    const legacyId=prefix+i;
    if(seen.has(legacyId))throw new Error('ID curricular histórico duplicado: '+legacyId);
    seen.add(legacyId);
    subjects.push({
     id:legacyId,name:oldName,year:level,sourceYear:nesYear,
     origin:'FO',field:'formacion_orientada',area:'Formación Orientada',
     alternative:alternative||null,referenceOnly:true,legacyReference:true,
     sourceType:'materia_nes_historica_incorrecta',
     confirmedBa15Subject:false,weeklyHours:null,sourceWeeklyHours:null,
     replacementSubjectId:id,sourceHoursStatus:'requiere_reasignacion',
     source:'Catálogo V2 histórico: conservar asignaciones previas para revisión'
    });
   }
  }
  if(cotejo.estado==='cotejado_fuente_primaria'&&
    (cotejo.discrepancias.enCatalogoSinFuente.length||
     cotejo.discrepancias.enFuenteSinCatalogo.length))
    warnings.push('Cotejo '+orientacion+' '+nesYear+'º alternativa '+
     (alternative||'común')+': el catálogo V2 difiere del Anexo VII. '+
     'Se ofrecen las materias oficiales; las antiguas conservan sus IDs para revisión.');
 };
 append(data['3'],3,null);
 for(const alt of alternativas){
  append(data[alt]['4'],4,alt);
  append(data[alt]['5'],5,alt);
 }
 if(data.sourceWarning)warnings.push('Advertencia en catálogo NES de '+orientacion+': '+clean(data.sourceWarning));
 if(data.sinAlternativas)warnings.push('La orientación no contempla una alternativa B en el catálogo NES de referencia.');
 return {subjects,alternativas,warnings,cotejos,defaultAlternative:'A',
  sourceVersion:catalogo.version??null,
  sourceFile:'vendor/pci-sec-aprende-v2/data/materias-v2.json'};
}
