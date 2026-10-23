import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeAutomaticFgMatches} from '../src/integracion-curricular/auto-homologacion-fg.js';
import {mappingKey,approveHomologation} from '../src/integracion-curricular/homologaciones.js';
import {matchMatrixToV2Fg,fgCoverageByLevel} from '../src/integracion-curricular/catalogos.js';

const matrix=[
  {id:'h-amplio',area:'Ciencias Sociales',subject:'Economía',axis:'Mercados',
   text:'Mercados, actores, oferta, demanda y circulación de bienes'},
  {id:'h-exacto',area:'Ciencias Sociales',subject:'Historia',
   text:'Procesos de industrialización y producción'},
  {id:'h-otro',area:'Ciencias Sociales',subject:'Economía',
   text:'Cuestiones macroeconómicas, presupuestos e impuestos'},
  {id:'h-ambiguo',area:'Ciencias Sociales',subject:'Economía',
   text:'La producción y las cadenas económicas'},
  {id:'h-otro-ano',area:'Ciencias Sociales',subject:'Economía',
   text:'El movimiento y la distribución de bienes'}
];
const v2=[
  {id:'e1',year:3,area:'Ciencias Sociales',subject:'Economía',axis:'Mercados',
   text:'Los mercados y sus actores'},
  {id:'e2',year:3,area:'Ciencias Sociales',subject:'Economía',axis:'Mercados',
   text:'La oferta y la demanda'},
  {id:'e3',year:3,area:'Ciencias Sociales',subject:'Economía',axis:'Circuitos',
   text:'Circulación de bienes y servicios'},
  {id:'h3',year:3,area:'Ciencias Sociales',subject:'Historia',
   text:'Procesos de industrialización y producción'},
  {id:'dub1',year:3,area:'Ciencias Sociales',subject:'Economía',
   text:'La producción y las cadenas económicas'},
  {id:'dub2',year:3,area:'Ciencias Sociales',subject:'Economía',
   text:'La producción y las cadenas económicas'},
  {id:'other-year',year:4,area:'Ciencias Sociales',subject:'Economía',
   text:'Los mercados y sus actores'},
  {id:'wrong-subject',year:3,area:'Ciencias Sociales',subject:'Historia',
   text:'Los mercados y sus actores'},
  {id:'wrong-area',year:3,area:'Matemática',subject:'Economía',
   text:'La oferta y la demanda'}
];
const workspace=()=>({
  'Ciencias Sociales':{groups:[
    {id:'C5',name:'Laboratorio Sociales 3.º',level:3,
     items:['h-amplio','h-exacto','h-otro','h-ambiguo','h-desconocido'],
     fgV2ContentIds:['e3'],
     plansBimestrales:[{number:1,name:'Plan anterior',contentIds:['h-amplio'],
       stages:{inicio:{activities:'Las actividades ya elaboradas'}}}]},
    {id:'C6',name:'Laboratorio paralelo 3.º',level:3,items:['h-amplio'],
     plansBimestrales:[{number:2,name:'Otro plan'}]},
    {id:'C7',name:'Laboratorio 4.º',level:4,items:['h-amplio','h-otro-ano'],
     plansBimestrales:[]}
  ]},
  'Otros formatos pedagógicos':{groups:[
    {id:'taller',name:'Espacio transversal 3.º',level:3,items:['h-amplio']},
    {id:'sin-anio',name:'Otro formato sin ubicación',level:0,items:['h-amplio']}
  ]}
});
const args={areas:workspace(),matrixRows:matrix,v2FgRows:v2,orientationId:'Economía y Administración'};
const by=(report,id,year=3)=>report.rows.find(r=>r.matrixId===id&&r.year===year);

test('la homologación automática descubre 1→3 pero no acredita contenido',()=>{
 const original=workspace(),snapshot=structuredClone(original);
 const report=analyzeAutomaticFgMatches({...args,areas:original});
 assert.deepEqual(original,snapshot,'Agrupamientos y planes quedan EXACTAMENTE igual');
 const broad=by(report,'h-amplio');
 assert.equal(broad.status,'proposed-multiple');
 assert.deepEqual(broad.references.map(r=>r.id).sort(),['e1','e2','e3']);
 assert.ok(broad.references.every(r=>r.candidateOnly===true));
 assert.equal(report.summary.automaticApprovalsCreated,0);
 assert.equal(report.summary.previousPlans,2);
 assert.equal(report.summary.skippedGroups,1);
 assert.equal(report.summary.placedOriginals,7,
   'Un contenido duplicado en paralelo del mismo nivel solo aparece una vez y 4.º conserva identidad distinta');
 assert.ok(report.summary.suggestedV2Ids>=3, 'El resumen también incluye otros contenidos sugeridos de 4.º');
 assert.equal(report.summary.validatedV2Ids,1,'Solo Historia exacta es reconocida por la regla actual');
 const stillUnmatched=fgCoverageByLevel({areas:original,matrixRows:matrix,v2FgRows:v2,
    area:'Ciencias Sociales',level:3});
 assert.equal(stillUnmatched.verifiedPercent,null);
 assert.equal(stillUnmatched.mappedUniqueContents,2,'Historia exacta y FG V2 directa, sin contar tres propuestas');
 assert.deepEqual(original['Ciencias Sociales'].groups[0].plansBimestrales[0].stages.inicio.activities,
   'Las actividades ya elaboradas');
});

test('las coincidencias exactas únicas se reconocen como las de la regla existente',()=>{
 const result=analyzeAutomaticFgMatches(args);
 assert.equal(by(result,'h-exacto').status,'exact');
 assert.deepEqual(by(result,'h-exacto').references.map(x=>x.id),['h3']);
 assert.equal(matchMatrixToV2Fg({
   matrixRows:matrix,v2FgRows:v2,contentId:'h-exacto',level:3,area:'Ciencias Sociales'
 }).status,'matched');
});

test('dos textos exactos en V2 generan ambigüedad, nunca aprobación arbitraria',()=>{
 const report=analyzeAutomaticFgMatches(args);
 assert.equal(by(report,'h-ambiguo').status,'multiple-exact');
 assert.deepEqual(by(report,'h-ambiguo').references.map(x=>x.id),['dub1','dub2']);
 assert.equal(by(report,'h-desconocido').status,'unmatched');
});

test('los años se toman de las tarjetas, nunca del contenido histórico',()=>{
 const result=analyzeAutomaticFgMatches(args);
 const year4=by(result,'h-amplio',4);
 assert.ok(year4);
 assert.equal(year4.status,'proposed-single','Una semejanza en 4.º es solo propuesta, no homologación reconocida');
 assert.ok(year4.references.every(r=>r.year===4&&r.id!=='e1'), 'Nunca trasladar IDs V2 de 3.º al universo de 4.º');
 assert.equal(by(result,'h-amplio').groups.length,3,
   'El mismo contenido de 3.º aparece en Sociales, paralelo y formato transversal una sola vez');
 assert.notEqual(by(result,'h-amplio').key,year4.key);
 assert.equal(result.rows.some(r=>r.area==='Matemática'&&r.matrixId==='h-amplio'),false);
});

test('una homologación aprobada previamente se respeta y no se reescribe',()=>{
 const packet={orientations:{eco:{fg:{areas:workspace()}}}};
 const previously=approveHomologation(packet,{
   orientationId:'eco',area:'Ciencias Sociales',year:3,matrixId:'h-amplio',
   referenceIds:['e1','e2'],matrixRows:matrix,v2FgRows:v2,
   reviewer:'Equipo pedagógico',reason:'Se revisaron efectivamente actores del mercado y oferta-demanda.'
 });
 const snapshot=structuredClone(previously);
 const approvedMappings=previously.orientations.eco.fg.homologations;
 const r=analyzeAutomaticFgMatches({...args,approvedMappings});
 assert.equal(by(r,'h-amplio').status,'confirmed');
 assert.deepEqual(by(r,'h-amplio').references.map(x=>x.id),['e1','e2']);
 assert.deepEqual(previously,snapshot,'No cambia historial, secuencia ni aprobación previa');
 assert.ok(approvedMappings[mappingKey('Ciencias Sociales',3,'h-amplio')]);
});

test('el escáner no mezcla trabajo de dos orientaciones',()=>{
 const a=analyzeAutomaticFgMatches({...args,orientationId:'Ciencias Sociales'});
 const b=analyzeAutomaticFgMatches({...args,orientationId:'Economía y Administración'});
 assert.equal(a.orientationId,'Ciencias Sociales');
 assert.equal(b.orientationId,'Economía y Administración');
 assert.deepEqual(a.rows,b.rows);
 a.rows[0].groups[0].name='Modificado solo informe A';
 assert.notDeepEqual(a.rows,b.rows);
 assert.deepEqual(workspace(),args.areas);
});

test('los elementos no homologados siguen en la Matriz, sin marcar 100%',()=>{
 const result=analyzeAutomaticFgMatches(args);
 assert.ok(result.summary.unmatched>=2);
 assert.ok(result.notes.some(n=>n.includes('ninguna sugerencia')||
 n.includes('Ninguna sugerencia')));
 assert.equal(result.summary.automaticApprovalsCreated,0);
 assert.throws(()=>analyzeAutomaticFgMatches({...args,orientationId:''}),/orientación/);
 assert.throws(()=>analyzeAutomaticFgMatches({...args,maxReferences:20}),/inválidos/);
});
