import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  COMPOSITION_VERSION,ROWS,fgSubjectsByYear,historicGroups,
  compositionFor,createGrouping,placeSubject,removeSubject,removeGrouping,
  arrangementWarnings,withComposition,quarterYear,pairedTerm
} from '../src/integracion-curricular/constructor-mapa-unificado.mjs';

const refs={subjects:JSON.parse(await readFile(new URL('../data/integracion-curricular/referencia-v2/materias-v2.json',import.meta.url),'utf8'))};
const pci={school_id:1017,pci_id:'00000000-0000-4000-8000-000000000017',orientation_id:'comunicacion',model:'comun'};
const originalGroup={
  id:'hist-fg-3',name:'Laboratorio Sociales · 3.º',
  kind:'laboratory',level:3,startTerm:5,endTerm:6,
  items:['hist-1','hist-2'],plansBimestrales:[{name:'Plan histórico'}]
};
const createWorkspace=()=>({orientations:{comunicacion:{
  fg:{mode:'conservar',areas:{'Ciencias Sociales':{groups:[structuredClone(originalGroup)]}}},
  fo:{spaces:[{id:'fo-lab-3',kind:'laboratorio',term:5,startTerm:5,endTerm:5,
    year:3,name:'Laboratorio FO 3.º',members:[],contentIds:[]}]}
}}});
test('Bolsa oficial FG contiene materias 1.º a 5.º sin mezclar años',()=>{
 const names1=fgSubjectsByYear(refs,1).map(s=>s.name);
 const names3=fgSubjectsByYear(refs,3).map(s=>s.name);
 assert.ok(names1.includes('Historia')&&names1.includes('Matemática'));
 assert.ok(names3.includes('Economía'));
 assert.equal(fgSubjectsByYear(refs,3).every(s=>s.year===3),true);
 assert.equal(quarterYear(5),3);assert.equal(pairedTerm(5),6);
 assert.ok(ROWS.includes('Laboratorios FG · Sociales'));
});
test('Mapa FG histórico conserva agrupamientos, contenidos y planes',()=>{
 const ws=createWorkspace(),before=structuredClone(ws);
 const groups=historicGroups(ws,'comunicacion');
 assert.equal(groups.length,1);
 assert.equal(groups[0].contents,2);
 assert.equal(groups[0].plans,1);
 const initial=compositionFor(ws,pci);
 assert.equal(initial.schema,COMPOSITION_VERSION);
 assert.equal(initial.groups.length,0);
 assert.deepEqual(ws,before);
});
test('Constructor agrupa materias del mismo año en ambos cuatrimestres',()=>{
 const ws=createWorkspace(),legacy=JSON.stringify(ws);
 let draft=compositionFor(ws,pci);
 draft=createGrouping(draft,{year:3,term:5,kind:'laboratorio',
   area:'Ciencias Sociales',name:'Laboratorio de Sociales 3.º'});
 assert.equal(draft.groups.length,2);
 assert.deepEqual(draft.groups.map(g=>g.term).sort(),[5,6]);
 const historia=fgSubjectsByYear(refs,3).find(s=>s.name==='Historia');
 assert.ok(historia);
 draft=placeSubject(draft,{groupId:draft.groups[0].id,subject:historia});
 assert.equal(draft.groups[0].members[0].name,'Historia');
 assert.equal(draft.groups[1].members[0].name,'Historia');
 const saved=withComposition(ws,pci,draft);
 assert.equal(saved.orientations.comunicacion.fo.composicionFgV2.groups.length,2);
 assert.equal(saved.orientations.comunicacion.fo.spaces.length,1,'FO original intacta');
 assert.equal(JSON.stringify(ws),legacy,'Workspace histórico no se muta');
 const recovered=compositionFor(saved,pci);
 assert.equal(recovered.groups[0].members.length,1);
 assert.equal(recovered.schoolId,pci.school_id);
 assert.equal(recovered.orientationId,pci.orientation_id);
 draft=removeSubject(recovered,{groupId:recovered.groups[1].id,subjectId:historia.id});
 assert.equal(draft.groups[0].members.length,0);
 assert.equal(draft.groups[1].members.length,0);
 draft=removeGrouping(draft,draft.groups[1].id);
 assert.equal(draft.groups.length,0);
 assert.deepEqual(ws,createWorkspace(),'Los borrados de propuesta nunca tocan el origen');
});
test('No se pueden mezclar años ni áreas, ni cruzar PCI en el guardado',()=>{
 const ws=createWorkspace(),base=compositionFor(ws,pci);
 const draft=createGrouping(base,{year:3,term:5,kind:'laboratorio',
   area:'Ciencias Sociales',name:'Sociales C5'});
 const target=draft.groups[0].id;
 const wrongYear=fgSubjectsByYear(refs,4).find(s=>s.name==='Historia');
 const wrongArea=fgSubjectsByYear(refs,3).find(s=>s.name==='Matemática');
 assert.throws(()=>placeSubject(draft,{groupId:target,subject:wrongYear}),/otro año/);
 assert.throws(()=>placeSubject(draft,{groupId:target,subject:wrongArea}),/área/);
 assert.throws(()=>createGrouping(base,{year:1,term:1,kind:'integrado',
   area:'Ciencias Sociales',name:'FG–FO 1.º'}),/desde 3/);
 assert.throws(()=>withComposition(ws,{...pci,pci_id:'otro'},draft),/otro PCI/);
 assert.equal(draft.groups[0].members.length,0);
});
test('La articulación integrada admite FG+FO de tercer año, sin marcarla automáticamente válida',()=>{
 const ws=createWorkspace();
 let draft=createGrouping(compositionFor(ws,pci),{
   year:3,term:5,kind:'integrado',area:'Ciencias Sociales',name:'Articulación FG–FO'});
 const subject=fgSubjectsByYear(refs,3).find(s=>s.name==='Historia');
 draft=placeSubject(draft,{groupId:draft.groups[0].id,subject});
 const warnings=arrangementWarnings(draft);
 assert.ok(warnings.some(x=>x.includes('sin Formación Orientada')));
 assert.ok(warnings.some(x=>x.includes('mínimo')));
 assert.throws(()=>placeSubject(draft,{groupId:draft.groups[0].id,
   subject:{id:'fo-4',name:'FO 4.º',component:'FO',area:'Formación Orientada',year:4}}),/otro año/);
 draft=placeSubject(draft,{groupId:draft.groups[0].id,
   subject:{id:'fo-3',name:'FO 3.º',component:'FO',area:'Formación Orientada',year:3}});
 assert.equal(draft.groups[0].members.length,2);
 assert.ok(!arrangementWarnings(draft).some(x=>x.includes('sin Formación Orientada')));
});
test('No reemplazar composición perteneciente a otra escuela ni otra orientación',()=>{
 const ws=createWorkspace();
 const own=compositionFor(ws,pci);
 const foreign={...own,schoolId:1200};
 assert.throws(()=>withComposition(ws,pci,foreign),/otro PCI/);
 const tampered=structuredClone(ws);
 tampered.orientations.comunicacion.fo.composicionFgV2={...own,pciId:'ajeno'};
 assert.throws(()=>compositionFor(tampered,pci),/otro PCI/);
});
test('El editor escolar no incluye altas institucionales y el API conserva la restricción administrativa',async()=>{
 const html=await readFile(new URL('../pci-orientaciones.html',import.meta.url),'utf8');
 const edge=await readFile(new URL('../supabase/functions/pci-multipci/index.ts',import.meta.url),'utf8');
 assert.ok(!html.includes('id="showNewSchool"'));
 assert.ok(!html.includes('id="formNewSchool"'));
 assert.match(edge,/if\(s\.role!=='admin'\)return err\('Solo administración\.',403\)/);
});

test('Rescate V2: bloquear formato contrario a la prescripción del área',()=>{
 const initial=compositionFor(createWorkspace(),pci);
 assert.throws(()=>createGrouping(initial,{year:3,term:5,kind:'taller',
  area:'Ciencias Sociales',name:'Formato incorrecto'}),/formato prescripto|se organiza como laboratorio/);
 assert.throws(()=>createGrouping(initial,{year:1,term:1,kind:'laboratorio',
  area:'Matemática',name:'Troncal incorrecta'}),/se organiza como troncal/);
});
test('Rescate V2: una troncal se ubica una sola vez por nivel y ocupa los dos cuatrimestres',()=>{
 let draft=compositionFor(createWorkspace(),pci);
 draft=createGrouping(draft,{year:1,term:2,kind:'troncal',area:'Matemática',name:'Matemática nivel 1'});
 assert.deepEqual([draft.groups[0].term,draft.groups[0].endTerm],[1,2]);
 assert.throws(()=>createGrouping(draft,{year:1,term:1,kind:'troncal',
  area:'Matemática',name:'Matemática duplicada'}),/ya tiene un espacio troncal/);
});
test('Rescate V2: materia no se duplica dentro del cuatrimestre por cambiar formato',()=>{
 let draft=compositionFor(createWorkspace(),pci);
 draft=createGrouping(draft,{year:3,term:5,kind:'laboratorio',
  area:'Ciencias Naturales',name:'Naturales',replicate:false});
 draft=createGrouping(draft,{year:3,term:5,kind:'otro',
  area:'Otros formatos',name:'Otro formato',replicate:false});
 const subject={id:'fg:3:biologia',name:'Biología',component:'FG',year:3,
  area:'Ciencias Naturales',hours:3};
 draft=placeSubject(draft,{groupId:draft.groups[0].id,subject});
 assert.throws(()=>placeSubject(draft,{groupId:draft.groups[1].id,subject}),
 /ya figura en C5/);
});
test('Rescate V2: bloquear de inmediato laboratorios que superan nueve horas',()=>{
 let draft=createGrouping(compositionFor(createWorkspace(),pci),{year:3,term:5,
  kind:'laboratorio',area:'Ciencias Naturales',name:'Naturales',replicate:false});
 const add=(id,name,hours)=>({id,name,hours,year:3,area:'Ciencias Naturales',component:'FG'});
 draft=placeSubject(draft,{groupId:draft.groups[0].id,subject:add('q','Química',5)});
 assert.throws(()=>placeSubject(draft,{groupId:draft.groups[0].id,subject:add('b','Biología',5)}),
 /9 horas/);
 assert.deepEqual(draft.groups[0].members.map(m=>m.id),['q']);
});
test('Rescate V2: Sociales 3.º admite hasta dos laboratorios por cuatrimestre',()=>{
 let draft=compositionFor(createWorkspace(),pci);
 draft=createGrouping(draft,{year:3,term:5,kind:'laboratorio',
  area:'Ciencias Sociales',name:'Sociales A',replicate:true});
 draft=createGrouping(draft,{year:3,term:5,kind:'laboratorio',
  area:'Ciencias Sociales',name:'Sociales B',replicate:true});
 assert.throws(()=>createGrouping(draft,{year:3,term:5,kind:'laboratorio',
  area:'Ciencias Sociales',name:'Sociales C',replicate:true}),/no tres/);
});
test('Rescate V2: la bolsa conserva las horas oficiales como metadato interno',async()=>{
 const hours=JSON.parse(await readFile(new URL('../data/integracion-curricular/referencia-v2/horas-v2.json',import.meta.url),'utf8'));
 const subjects=fgSubjectsByYear({...refs,hours},3);
 assert.equal(subjects.find(s=>s.name==='Matemática')?.hours,4);
 assert.equal(subjects.find(s=>s.name==='Historia')?.hours,2);
});
