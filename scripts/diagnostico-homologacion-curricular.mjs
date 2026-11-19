/**
 * Diagnostic only. No writes. Counts exact matches between source catalogs.
 * Matrix content has no year; this reports candidates, NOT approved mappings.
 */
import {readFile} from 'node:fs/promises';
import {loadMatrixContents,loadV2Fg} from '../src/integracion-curricular/catalogos.js';
const fetchFn=async path=>{
  try{const content=await readFile(path,'utf8');return{ok:true,text:async()=>content};}
  catch{return{ok:false,text:async()=>''};}
};
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const subject=x=>({'lengua adicional':'lenguas adicionales','formacion etica ciudadana':'formacion etica y ciudadana'}[norm(x)]||norm(x));
const [matrix,fg]=await Promise.all([loadMatrixContents({fetchFn}),loadV2Fg({fetchFn})]);
const index=new Map();
for(const row of fg){
  const key=subject(row.subject)+'|'+norm(row.text);
  if(!index.has(key))index.set(key,[]);
  index.get(key).push(row);
}
let exact=0,ambiguous=0,unmatched=0;
const perArea={};
for(const row of matrix){
  const k=subject(row.subject)+'|'+norm(row.text);
  const hits=index.get(k)||[];
  const area=perArea[row.area]||(perArea[row.area]={total:0,exact:0,ambiguous:0,unmatched:0});
  area.total++;
  if(hits.length===1){exact++;area.exact++;}
  else if(hits.length>1){ambiguous++;area.ambiguous++;}
  else{unmatched++;area.unmatched++;}
}
console.log('CATALOG_SOURCE_MATRIX_COUNT='+matrix.length);
console.log('CATALOG_REFERENCE_V2_FG_COUNT='+fg.length);
console.log('CATALOG_SUBJECT_TEXT_EXACT='+exact);
console.log('CATALOG_SUBJECT_TEXT_AMBIGUOUS='+ambiguous);
console.log('CATALOG_SUBJECT_TEXT_UNMATCHED='+unmatched);
console.log('CATALOG_BY_AREA='+JSON.stringify(perArea));
