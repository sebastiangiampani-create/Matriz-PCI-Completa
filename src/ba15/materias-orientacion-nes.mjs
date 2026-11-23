/**
 * Bolsa FO del Régimen BA +15, tomada de las ASIGNATURAS NES del V2 real,
 * no de los bloques/ejes del catálogo de contenidos FO v96.
 *
 * La equivalencia de años es una decisión organizativa del PCI:
 * NES 3.º => BA +15 Nivel II; NES 4.º => Nivel III; NES 5.º => Nivel IV.
 * Los nombres son propuestas trazables al plan NES A/B de referencia:
 * sin horas individuales ni homologación automática de BA +15.
 */
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
 const subjects=[],seen=new Set(),warnings=[];
 const append=(names,nesYear,alternative)=>{
  for(let i=0;i<names.length;i++){
   const name=clean(names[i]),level=BA15_FO_NES_YEAR_MAP[nesYear];
   if(!name||level===4&&fixedAtLevelIV(name))continue;
   const key=[level,alternative||'comun',slug(name),i].join(':');
   if(seen.has(key))throw new Error('Materia NES repetida en el perfil: '+name);
   seen.add(key);
   subjects.push({
    id:'ba15-nes-fo-'+slug(orientacion)+'-'+level+'-'+(alternative||'comun').toLowerCase()+'-'+i,
    name,year:level,sourceYear:nesYear,sourceModel:'NES · V2',
    origin:'FO',field:'formacion_orientada',area:'Formación Orientada',
    alternative:alternative||null,referenceOnly:false,sourceType:'asignatura_nes',
    confirmedBa15Subject:false,weeklyHours:null,
    source:'vendor/pci-sec-aprende-v2/data/materias-v2.json'
   });
  }
 };
 append(data['3'],3,null);
 for(const alt of alternativas){
  append(data[alt]['4'],4,alt);
  append(data[alt]['5'],5,alt);
 }
 if(data.sourceWarning)warnings.push('Advertencia en catálogo NES de '+orientacion+': '+clean(data.sourceWarning));
 if(data.sinAlternativas)warnings.push('La orientación no contempla una alternativa B en el catálogo NES de referencia.');
 return {subjects,alternativas,warnings,defaultAlternative:'A',
  sourceVersion:catalogo.version??null,
  sourceFile:'vendor/pci-sec-aprende-v2/data/materias-v2.json'};
}
