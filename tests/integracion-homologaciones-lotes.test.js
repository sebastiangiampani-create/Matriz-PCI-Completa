import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHomologationReviewQueue, approveHomologation, mappingKey
} from '../src/integracion-curricular/homologaciones.js';
import {matchMatrixToV2Fg,fgCoverageByLevel} from '../src/integracion-curricular/catalogos.js';

const broad={
  id:'m-amplio',area:'Ciencias Sociales',subject:'Economía',
  axis:'Mercados',text:'Análisis de los mercados, sus actores, oferta, demanda y circulación de bienes'
};
const matrix=[broad];
const v2=[
 {id:'v2-a',year:3,area:'Ciencias Sociales',subject:'Economía',axis:'Mercados',text:'Los mercados y los actores'},
 {id:'v2-b',year:3,area:'Ciencias Sociales',subject:'Economía',axis:'Mercados',text:'Relaciones entre oferta y demanda'},
 {id:'v2-c',year:3,area:'Ciencias Sociales',subject:'Economía',axis:'Circuitos',text:'Circulación de bienes y servicios'},
 {id:'v2-4',year:4,area:'Ciencias Sociales',subject:'Economía',axis:'Mercados',text:'Los mercados y sus actores'},
 {id:'v2-3-historia',year:3,area:'Ciencias Sociales',subject:'Historia',text:'Los mercados y sus actores'},
 {id:'v2-3-geo',year:3,area:'Matemática',subject:'Economía',text:'Oferta y demanda'}
];
const area='Ciencias Sociales',year=3,orientationId='economia_administracion';
const areas=()=>({[area]:{groups:[
  {id:'sociales-3',kind:'laboratory',level:3,name:'Laboratorio 3.º · C5',
    items:['m-amplio'],plansBimestrales:[{number:1,name:'Plan original',
      contentIds:['m-amplio'],stages:{inicio:{activities:'Etapa histórica original'}}}]},
  {id:'sociales-4',kind:'laboratory',level:4,name:'Laboratorio 4.º · C7',
    items:[],plansBimestrales:[]}
]}});
const pack=()=>({orientations:{[orientationId]:{fg:{areas:areas()}}}});

test('un contenido amplio recibe un conjunto de tres posibles desagregaciones V2',()=>{
 const before=areas(),originals=structuredClone(matrix),refs=structuredClone(v2);
 const preview=buildHomologationReviewQueue({matrixRows:matrix,v2FgRows:v2,
   areas:before,area,year,maxSuggestions:6});
 assert.deepEqual(preview.rows[0].suggestedReferenceIds.sort(),['v2-a','v2-b','v2-c']);
 assert.equal(preview.summary.placedOriginals,1);
 assert.equal(preview.summary.needsReview,1);
 assert.equal(preview.summary.approvedByThisOperation,0);
 assert.ok(preview.rows[0].candidates.every(x=>x.year===3&&x.subject==='Economía'));
 assert.ok(preview.rows[0].candidates.every(x=>x.suggestedOnly));
 assert.deepEqual(before,areas(),'La previsualización no modifica la Matriz original');
 assert.deepEqual(matrix,originals);
 assert.deepEqual(v2,refs);
});

test('una sugerencia no suma cobertura hasta revisión y aprobación selectiva',()=>{
 const original=pack();
 const queue=buildHomologationReviewQueue({matrixRows:matrix,v2FgRows:v2,
   areas:original.orientations[orientationId].fg.areas,area,year});
 assert.equal(queue.summary.approvedByThisOperation,0);
 assert.equal(matchMatrixToV2Fg({matrixRows:matrix,v2FgRows:v2,
   area,level:year,contentId:broad.id}).status,'unresolved');
 const first=approveHomologation(original,{
   orientationId,area,year,matrixId:broad.id,referenceIds:['v2-a'],
   reason:'Se verificó expresamente el tratamiento de actores del mercado en el plan original.',
   reviewer:'Revisora curricular',matrixRows:matrix,v2FgRows:v2
 });
 const one=fgCoverageByLevel({areas:first.orientations[orientationId].fg.areas,
   matrixRows:matrix,v2FgRows:v2,area,level:year,
   approvedMappings:first.orientations[orientationId].fg.homologations});
 assert.equal(one.mappedUniqueContents,1);
 assert.equal(one.prescribedTotal,4, 'El universo del nivel incluye también Historia; la homologación es de Economía');
 const approved=approveHomologation(first,{
   orientationId,area,year,matrixId:broad.id,referenceIds:['v2-a','v2-b','v2-c'],
   reason:'Se verificaron individualmente actores, oferta-demanda y circulación en la propuesta didáctica.',
   reviewer:'Revisora curricular',matrixRows:matrix,v2FgRows:v2
 });
 const three=fgCoverageByLevel({areas:approved.orientations[orientationId].fg.areas,
   matrixRows:matrix,v2FgRows:v2,area,level:year,
   approvedMappings:approved.orientations[orientationId].fg.homologations});
 assert.equal(three.mappedUniqueContents,3);
 assert.equal(approved.orientations[orientationId].fg.homologationHistory.length,2);
 assert.deepEqual(approved.orientations[orientationId].fg.areas,areas());
 assert.deepEqual(original,pack());
 const record=approved.orientations[orientationId].fg.homologations[mappingKey(area,year,broad.id)];
 assert.equal(record.mappingType,'one-to-many');
});

test('no infiere año a contenidos históricos y separa lo que requiere revisión manual',()=>{
 const original=areas();
 original[area].groups[0].items.push('m-desconocido');
 const preview=buildHomologationReviewQueue({matrixRows:matrix,v2FgRows:v2,
   areas:original,area,year});
 assert.equal(preview.summary.missingOriginals,1);
 assert.equal(preview.rows.find(x=>x.matrixId==='m-desconocido').status,'missing-original');
 assert.equal(buildHomologationReviewQueue({matrixRows:matrix,v2FgRows:v2,
   areas:original,area,year:4}).summary.placedOriginals,0);
 assert.throws(()=>buildHomologationReviewQueue({matrixRows:matrix,v2FgRows:v2,
   areas:original,area,year:6}),/año/);
});
