import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 FINAL_RULESET_ID,FINAL_SOURCE,FINAL_COMMON,FINAL_BACHILLERATO,FINAL_TECNICA,
 validateCommonSpace,validateFinalComposition
} from '../src/normativa/composicion-pci-20261117.mjs';
import {
 SPECIALTIES,findSpecialty,RULESET_ID
} from '../src/tecnica/pautas-pci-20261005.mjs';
import {
 technicalOfferSeed,prepareTechnicalOfferFinal,addTechnicalProfessionalPractice,
 updateTechnicalSpace,validateTechnicalDraft,technicalMapRows
} from '../src/tecnica/espacio-trabajo-v2.mjs';

const school=(specialty='Computación')=>({
 model:'tecnica',pci_id:'22-unique',school_id:982,
 orientation_id:'tecnica_de_prueba',specialty_name:specialty,
 process_id:'2027-1',legacy_sha256:'a'.repeat(64),status:'borrador'
});
const src=specialty=>({
 especialidad_id:findSpecialty(specialty).id,sha256_pdf:'b'.repeat(64),
 asignaturas:[],especialidad_nombre:specialty
});
const seed=specialty=>technicalOfferSeed({pci:school(specialty),source:src(specialty)});
const issues=r=>r.errors.map(e=>e.code);
const warnings=r=>r.warnings.map(e=>e.code);
const slot=(format,area,year,term,duration='cuatrimestral',character='obligatorio')=>({
 id:format+'-'+area+'-'+year+'-'+term+'-'+Math.random().toString(36).slice(2,6),
 format,area,year,term,duration,
 endTerm:duration==='anual'?term+1:term,
 character,subjectIds:[],contentIds:[],weeklyHours:null,included:true
});
const annual=(area,year)=>slot('troncal',area,year,2*year-1,'anual');
function makeBach({orientation='Economía y Administración',social=10}={}){
 const spaces=[];
 for(const subject of ['Matemática','Lengua y Literatura','Lengua Adicional'])
  for(let year=1;year<=5;year++)spaces.push(annual(subject,year));
 for(let year=1;year<=5;year++)for(const half of [1,2]){
  const t=2*year-2+half;
  spaces.push(slot('laboratorio_social','Ciencias Sociales',year,t));
 }
 if(social===12)spaces.push(slot('laboratorio_social','Ciencias Sociales',3,5),
  slot('laboratorio_social','Ciencias Sociales',3,6));
 const natYears=/naturales/i.test(orientation)?4:5;
 for(let year=1;year<=natYears;year++)for(const half of [1,2])
  spaces.push(slot('laboratorio_natural','Ciencias Naturales',year,2*year-2+half));
 for(let year=1;year<=5;year++)for(const half of [1,2])
  spaces.push(slot('espacio_formativo','Educación Física',year,2*year-2+half,'cuatrimestral','electivo'));
 for(const year of [1,2,4])for(const half of [1,2])
  spaces.push(slot('espacio_formativo','Artes',year,2*year-2+half,'cuatrimestral','electivo'));
 for(const year of [1,2,3,4])for(const half of [1,2])
  spaces.push(slot('espacio_formativo','Tecnologías',year,2*year-2+half,'cuatrimestral','electivo'));
 for(const year of [3,4,5])for(let i=0;i<(year===5?2:1);i++){
  spaces.push(slot('laboratorio_orientacion','Formación Orientada',year,2*year-1+(i%2)));
  spaces.push(slot('taller_orientacion','Formación Orientada',year,2*year-1+(i%2),'cuatrimestral','electivo'));
 }
 spaces.push(slot('vinculacion_futuro','Proyecto de Vinculación con el Futuro',5,9,'anual'));
 const socials=spaces.filter(s=>s.format==='laboratorio_social');
 socials.forEach((s,i)=>s.character=i<(social===12?6:5)?'obligatorio':'electivo');
 const naturals=spaces.filter(s=>s.format==='laboratorio_natural');
 naturals.forEach((s,i)=>s.character=i<(natYears===4?4:5)?'obligatorio':'electivo');
 return {model:'bachillerato',orientation,selectedSocialOption:social,spaces};
}
test('proveniencia: Anexo II del 17/11/26 firmado y documento exacto, sin referencia XXX',()=>{
 assert.equal(FINAL_RULESET_ID,'pci-anexo-ii-2026-11-17/1');
 assert.equal(RULESET_ID,FINAL_RULESET_ID);
 assert.equal(FINAL_SOURCE.number,'IF-2026-51169092-GCABA-SSPIE');
 assert.equal(FINAL_SOURCE.pages,20);
 assert.equal(FINAL_SOURCE.pdfPagesIncludingSignature,21);
 assert.equal(FINAL_SOURCE.sha256.length,64);
 assert.equal(FINAL_COMMON.maxWeeklyHours,9);
 assert.deepEqual(FINAL_TECNICA.professionalPractices.totalRange,[1,2]);
 assert.equal(FINAL_BACHILLERATO.futureProject.total,1);
});
test('26 especialidades: nunca sembrar automáticamente dos proyectos anuales de Técnica',()=>{
 assert.equal(SPECIALTIES.length,26);
 for(const specialty of SPECIALTIES){
  const doc=seed(specialty.name);
  assert.equal(doc.ruleset,FINAL_RULESET_ID);
  assert.equal(doc.spaces.filter(s=>s.format==='vinculacion_futuro').length,0,specialty.id);
  const pp=doc.spaces.filter(s=>s.format==='practicas_profesionalizantes');
  assert.deepEqual(pp.map(s=>s.year),[5,6],specialty.id);
  assert.ok(pp.every(s=>s.included===false),specialty.id);
  assert.deepEqual(doc.spaces.filter(s=>s.format==='taller_especialidad'&&s.included!==false)
    .map(s=>s.year),[3],specialty.id);
 }
});
test('la selección de PP es reversible, aislada y exige plan de especialidad',()=>{
 const first=seed('Computación'),before=JSON.stringify(first);
 const one=addTechnicalProfessionalPractice(first,6);
 assert.equal(one.spaces.filter(s=>s.format==='practicas_profesionalizantes'&&s.included!==false).length,1);
 const two=addTechnicalProfessionalPractice(one,5);
 assert.deepEqual(two.spaces.filter(s=>s.format==='practicas_profesionalizantes'&&s.included!==false)
  .map(s=>s.year),[5,6]);
 assert.throws(()=>addTechnicalProfessionalPractice(two,5),/ya está activa/);
 const removed=updateTechnicalSpace(two,'t-practicas-5',{included:false});
 assert.equal(removed.spaces.find(s=>s.id==='t-practicas-5').included,false);
 assert.equal(removed.spaces.find(s=>s.id==='t-practicas-6').included,true);
 assert.equal(JSON.stringify(first),before,'No deben mutar los borradores originales');
 const invalid=validateFinalComposition({model:'tecnica',specialtyId:'computacion',
  spaces:two.spaces.map(s=>s.id==='t-practicas-5'?{...s,year:4}:s)});
 assert.ok(issues(invalid).includes('TECH_PP_YEAR'));
});
test('Migración anterior conserva ambos espacios, notas y los planes externos por ID',()=>{
 const older=seed('Computación'),originalRules='pci-pautas-2026-10-05/1';
 older.ruleset=originalRules;
 older.spaces=older.spaces.filter(s=>s.format!=='practicas_profesionalizantes');
 for(const year of [5,6]){
  older.spaces.push({...older.spaces[0],id:'t-pvf-'+year,
   format:'vinculacion_futuro',area:'Proyecto de Vinculación con el Futuro',
   year,term:2*year-1,endTerm:2*year,notes:'Original de escuela',contentIds:['contenido-antiguo'],
   duration:'anual',included:true});
 }
 const before=JSON.stringify(older);
 const migrated=prepareTechnicalOfferFinal(older);
 assert.equal(migrated.needsReview,true);
 assert.deepEqual(migrated.legacySpacesRetained,['t-pvf-5','t-pvf-6']);
 assert.equal(migrated.document.ruleset,FINAL_RULESET_ID);
 for(const year of [5,6]){
  const saved=migrated.document.spaces.find(s=>s.id==='t-pvf-'+year);
  assert.equal(saved.included,false);
  assert.equal(saved.archivedLegacy,true);
  assert.deepEqual(saved.contentIds,['contenido-antiguo']);
  assert.match(saved.notes,/Original de escuela/);
  assert.ok(migrated.document.spaces.some(s=>s.id==='t-practicas-'+year&&s.included===false));
 }
 assert.equal(JSON.stringify(older),before,'La migración no altera el dato histórico');
 const again=prepareTechnicalOfferFinal(migrated.document);
 assert.equal(again.needsReview,false);
 assert.deepEqual(again.document,migrated.document);
});
test('Técnica: 8/10 Sociales, 4/4 o 5/5, Naturales 6 con 4/2, años C1-C12',()=>{
 for(const sp of ['Computación','Mecánica','Geógrafo Matemático','Metalurgia']){
  const doc=seed(sp);
  const review=validateFinalComposition({model:'tecnica',specialtyId:doc.specialty_id,
   spaces:doc.spaces,officialPlan:findSpecialty(sp).status==='not_defined_in_document'?
    {annualSpecialtyDefined:false}:null});
  assert.equal(review.structurallyConsistent,true,
    sp+' no cumple norma: '+review.errors.map(e=>e.code+':'+e.message).join('; '));
  assert.equal(review.readyForPublication,false);
  assert.ok(warnings(review).includes('TECH_PP_PENDING'));
  assert.equal(review.counts.socials,sp==='Computación'?10:8);
  assert.equal(review.counts.naturals,6);
  assert.equal(review.counts.physical,12);
  assert.equal(review.counts.arts,2);
  assert.equal(review.counts.practices,0);
  assert.equal(technicalMapRows(doc).terms.length,12);
  assert.equal(validateTechnicalDraft(doc,[]).readyForPublication,false);
 }
});
test('Bachillerato: 10/12 Sociales, 5/6 EIO, Naturales 10/8, FO 4+4 y PVF único 5º',()=>{
 for(const options of [
  {orientation:'Economía y Administración',social:10,expectedNatural:10},
  {orientation:'Economía y Administración',social:12,expectedNatural:10},
  {orientation:'Ciencias Naturales',social:10,expectedNatural:8}
 ]){
  const draft=makeBach(options);
  const result=validateFinalComposition(draft);
  assert.equal(result.structurallyConsistent,true,
   JSON.stringify(result.errors.slice(0,6)));
  assert.equal(result.counts.socials,options.social);
  assert.equal(result.counts.naturals,options.expectedNatural);
  assert.equal(result.counts.projects,1);
  assert.equal(result.readyForPublication,false);
  assert.ok(warnings(result).includes('OFFICIAL_PLAN_REQUIRED'));
 }
});
test('Límite 9 horas salvo integración técnica y Orientación Ciencias Naturales en 5º',()=>{
 const common={model:'tecnica'};
 const s=(format,year,hours,model='tecnica')=>({format,year,term:2*year-1,
  duration:'cuatrimestral',weeklyHours:hours,subjectIds:['a','b']});
 assert.ok(issues(validateCommonSpace(s('integracion_social',4,10),common)).includes('MAX_9_HOURS'));
 const allowed=validateCommonSpace(s('integracion_especialidad',4,12),common);
 assert.ok(!issues(allowed).includes('MAX_9_HOURS'));
 assert.ok(warnings(allowed).includes('HOURS_EXCEPTION_REQUIRES_PLAN'));
 const bachNormal=validateCommonSpace(s('laboratorio_orientacion',5,10),
  {model:'bachillerato',orientation:'Informática'});
 assert.ok(issues(bachNormal).includes('MAX_9_HOURS'));
 const bachException=validateCommonSpace(s('laboratorio_orientacion',5,10),
  {model:'bachillerato',orientation:'Ciencias Naturales'});
 assert.ok(!issues(bachException).includes('MAX_9_HOURS'));
});
test('Materias únicas: Naturales Técnica 1º sí, 2º no; FO Bach 3º sí, 4º no',()=>{
 const one={format:'integracion_natural',year:1,term:1,
  duration:'cuatrimestral',subjectIds:['Biología'],weeklyHours:6};
 const two={...one,year:2,term:3};
 assert.ok(!issues(validateCommonSpace(one,{model:'tecnica'})).includes('SINGLE_SUBJECT_NOT_ALLOWED'));
 assert.ok(issues(validateCommonSpace(two,{model:'tecnica'})).includes('SINGLE_SUBJECT_NOT_ALLOWED'));
 const fo={format:'laboratorio_orientacion',year:3,term:5,
  duration:'cuatrimestral',subjectIds:['Orientada'],weeklyHours:6};
 assert.ok(!issues(validateCommonSpace(fo,{model:'bachillerato'})).includes('SINGLE_SUBJECT_NOT_ALLOWED'));
 assert.ok(issues(validateCommonSpace({...fo,year:4,term:7},{model:'bachillerato'}))
  .includes('SINGLE_SUBJECT_NOT_ALLOWED'));
});
test('Integración vs articulación; año y decisión previa al inicio del ciclo',()=>{
 const two=makeBach();
 const late=validateFinalComposition({...two,optionsLockedAt:'2027-03-01',schoolYearStart:'2027-02-25'});
 assert.ok(issues(late).includes('OPTIONS_LATE'));
 const relation=[{id:'a',year:4},{id:'b',year:5}];
 const wrong=validateFinalComposition({...two,relations:[{
  type:'integracion',spaces:relation,sharedPlan:false,collegiateEvaluation:false,sharedGrade:false
 }]});
 assert.ok(issues(wrong).includes('INTEGRATION_SHARED'));
 assert.ok(issues(wrong).includes('RELATION_SAME_YEAR'));
 const articulated=validateFinalComposition({...two,relations:[{
  type:'articulacion',spaces:[{id:'a',year:4},{id:'b',year:4}],
  sharedPlan:true,sharedGrade:true
 }]});
 assert.ok(issues(articulated).includes('ARTICULATION_INDEPENDENT'));
});
test('El nuevo validador no puede escribir escuelas ni proclamar un PCI aprobado',()=>{
 const src=readFileSync(new URL('../src/normativa/composicion-pci-20261117.mjs',import.meta.url),'utf8');
 assert.ok(!src.includes('supabase.co'));
 assert.ok(!src.includes('pci_proposals'));
 assert.equal(validateFinalComposition({model:'tecnica',specialtyId:'computacion'}).readyForPublication,false);
});
