import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SPECIALTIES, getAnnualSubjects} from '../src/tecnica/pautas-pci-20261005.mjs';
import {resolverPerfilEspecialidadTecnica,perfilesEspecialidadesTecnicas,ESPECIALIDADES_TECNICAS,
  comprobarPerfilTecnico,PERFIL_TECNICA_VERSION} from '../src/tecnica/perfil-especialidad-2026.mjs';
import {auditarPrescripcionesAnualesTecnica,prearmarAnualesTecnica,
  anualPrescriptoDeMateria,esMateriaAnualCorrecta} from '../src/tecnica/prescripciones-anuales-v2.mjs';
import {validateFinalComposition} from '../src/normativa/composicion-pci-20261117.mjs';

const subject=(id,name,year)=>({id,name,year,field:'formacion_tecnica_especifica',origin:'FO'});
const profile=id=>resolverPerfilEspecialidadTecnica(id);
const subjects=p=>(p.espacioAnual.espacios||[]).map(s=>subject('tec-anual-'+p.specialtyId+'-'+s.year,s.name,s.year));
const empty=()=>({placements:{},phase2V28:{groups:{}}});
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value};

test('26 perfiles técnicos, 20 anuales definidos, 5 pendientes y Geógrafo Matemático sin anual',()=>{
 const all=perfilesEspecialidadesTecnicas();
 assert.equal(all.length,26);
 assert.equal(SPECIALTIES.length,26);
 assert.equal(ESPECIALIDADES_TECNICAS.length,26);
 assert.equal(all.filter(x=>x.espacioAnual.status==='prescripto').length,20);
 assert.equal(all.filter(x=>x.espacioAnual.status==='no_definido_en_anexo').length,5);
 assert.equal(all.filter(x=>x.espacioAnual.status==='no_ofrece').length,1);
 assert.equal(profile('geografo_matematico').espacioAnual.espacios.length,0);
 assert.equal(profile('refrigeracion_ventilacion_calefaccion_aire').espacioAnual.espacios.length,0);
 for(const p of all){
  assert.equal(p.version,PERFIL_TECNICA_VERSION);
  assert.equal(p.terms,12);
  assert.equal(p.planParticularVerificado,false);
  assert.equal(comprobarPerfilTecnico(p),false);
  assert.ok(Object.isFrozen(p));
 }
 assert.equal(profile('orientacion_inexistente'),null);
});

test('los 20 anuales prescritos reproducen las 60 materias del Anexo, por año',()=>{
 const all=perfilesEspecialidadesTecnicas().filter(p=>p.espacioAnual.status==='prescripto');
 for(const p of all){
  const expected=getAnnualSubjects(p.specialtyId);
  assert.deepEqual(p.espacioAnual.espacios.map(s=>s.name),[expected[4],expected[5],expected[6]]);
  assert.deepEqual(p.espacioAnual.espacios.map(s=>s.year),[4,5,6]);
  assert.equal(p.espacioAnual.espacios.every(s=>s.duration==='anual'&&!s.editable),true);
 }
 assert.equal(all.reduce((a,p)=>a+p.espacioAnual.espacios.length,0),60);
});

test('asterisco: Matemática y Lengua Adicional en sexto sólo en Computación y ADE',()=>{
 for(const p of perfilesEspecialidadesTecnicas()){
  const isExtra=['computacion','administracion_empresas'].includes(p.specialtyId);
  assert.equal(p.troncales.matematica.length,isExtra?6:5);
  assert.equal(p.troncales.lenguaAdicional.length,isExtra?6:5);
  assert.equal(p.troncales.lenguaLiteratura.length,5);
 }
});

test('doble asterisco: Computación 10 Sociales y 5/5; demás 8 y 4/4',()=>{
 for(const p of perfilesEspecialidadesTecnicas()){
  const c=p.specialtyId==='computacion';
  assert.equal(p.sociales.total,c?10:8);
  assert.equal(p.sociales.obligatorios,c?5:4);
  assert.equal(p.sociales.electivos,c?5:4);
  assert.deepEqual(p.sociales.ubicacionFlexible,[4,5,6]);
  assert.equal(p.sociales.extraCuarto,c?2:0);
 }
 assert.deepEqual(profile('computacion').excepciones.socialesComputacion.subjects,['Historia','Geografía']);
});

test('triple asterisco: Taller, Representación y PP quedan pendientes del plan, sin cuotas inventadas',()=>{
 for(const p of perfilesEspecialidadesTecnicas()){
  for(const name of ['talleresEspecialidad','integracionesEspecialidad','practicasProfesionalizantes']){
   assert.equal(p[name].status,'requiere_plan_de_estudios');
   assert.equal(p[name].noPrearmar,true);
  }
  assert.equal(p.representacion.tercerNivel.noPrearmar,true);
  assert.equal(p.reglasCargaHoraria.integracionEspecialidad.excepcion,true);
  assert.equal(p.proyectoVinculacion.noEquivaleAlProyectoAnualDeMedia,true);
 }
 assert.equal(profile('mecanica').excepciones.metrologia.year,3);
 assert.equal(profile('computacion').excepciones.metrologia,null);
});

test('prescripción anual nueva: prearmar sin modificar entrada, sin tocar planes y sin duplicar',()=>{
 const p=profile('computacion'),s=subjects(p);
 const input=freeze(empty()),before=structuredClone(input);
 const res=prearmarAnualesTecnica(input,p,s);
 assert.deepEqual(input,before);
 assert.equal(res.applied.length,3);
 assert.equal(res.map.valid,false);
 for(const item of res.applied)assert.deepEqual(res.map.placements[item.slot],[item.subjectId]);
 const twice=prearmarAnualesTecnica(res.map,p,s);
 assert.equal(twice.applied.length,0);
 assert.deepEqual(twice.map,res.map);
 assert.equal(auditarPrescripcionesAnualesTecnica(res.map,p,s).prescripcionCompleta,true);
 assert.equal(esMateriaAnualCorrecta(p,s[0],4),true);
 assert.equal(anualPrescriptoDeMateria(p,s[0]).name,p.espacioAnual.espacios[0].name);
});

test('asignación histórica incompatible permanece intacta y se denuncia como conflicto',()=>{
 const p=profile('computacion'),s=subjects(p);
 const input=freeze({placements:{'anualEsp-n4':['asignatura-anterior']},
   phase2V28:{groups:{'anualEsp-n4':{
    name:'Plan histórico',objectives:'Objetivos preservados',contents:['contenido-historico'],
    plansBimestrales:[1,2,3,4].map(number=>({number,objectives:'Objetivo '+number,
       contentIds:['contenido-historico']}))}
   }}});
 const old=structuredClone(input);
 const res=prearmarAnualesTecnica(input,p,s);
 assert.equal(res.map.placements['anualEsp-n4'][0],'asignatura-anterior');
 assert.deepEqual(res.map.phase2V28,old.phase2V28);
 assert.deepEqual(input,old);
 assert.equal(res.applied.length,2);
 assert.ok(res.issues.some(x=>x.code==='ANUAL_INCOMPATIBLE'&&x.slot==='anualEsp-n4'));
});

test('desarrollo en fase 2 sin asignación no se asocia automáticamente a otra materia',()=>{
 const p=profile('computacion'),s=subjects(p);
 const map=freeze({placements:{},phase2V28:{groups:{'anualEsp-n5':{
  plansBimestrales:[{number:1,objectives:'Trabajo previo',contentIds:['c1']}]}}}});
 const res=prearmarAnualesTecnica(map,p,s);
 assert.equal(res.applied.length,2);
 assert.ok(res.issues.some(x=>x.code==='DESARROLLO_SIN_ASIGNACION'));
 assert.deepEqual(res.map.phase2V28,map.phase2V28);
});

test('si una materia anual está asignada a otro espacio no se duplica',()=>{
 const p=profile('computacion'),s=subjects(p);
 const source=freeze({placements:{'foN3-c7':[s[0].id]},phase2V28:{groups:{}}});
 const res=prearmarAnualesTecnica(source,p,s);
 assert.ok(res.issues.some(x=>x.code==='MATERIA_ASIGNADA_EN_OTRO_ESPACIO'));
 assert.equal(res.map.placements['anualEsp-n4'],undefined);
 assert.deepEqual(source.placements['foN3-c7'],[s[0].id]);
});

test('Geógrafo Matemático y las cinco especialidades pendientes no generan anuales ficticios',()=>{
 for(const id of ['geografo_matematico','metalurgia','ortesis_protesis','diseno_interiores',
  'diseno_artesanias','refrigeracion_ventilacion_calefaccion_aire']){
  const p=profile(id);
  const res=prearmarAnualesTecnica(freeze(empty()),p,[]);
  assert.equal(res.applied.length,0);
  assert.deepEqual(res.map.placements,{});
  assert.equal(auditarPrescripcionesAnualesTecnica(res.map,p,[]).prescripcionCompleta,false);
 }
 const p=profile('geografo_matematico');
 const conflict=auditarPrescripcionesAnualesTecnica({placements:{'anualEsp-n4':['legado']},
    phase2V28:{groups:{}}},p,[]);
 assert.ok(conflict.issues.some(x=>x.code==='ANUAL_NO_CORRESPONDE'));
});

test('si falta la materia anual en el banco no se inventa y se registra el pendiente',()=>{
 const p=profile('automotores'),r=prearmarAnualesTecnica(empty(),p,[]);
 assert.equal(r.applied.length,0);
 assert.equal(r.issues.filter(x=>x.code==='MATERIA_NO_DISPONIBLE').length,3);
});

test('la referencia de 4–6 integraciones por año no se interpreta como un límite rígido',()=>{
 const result=validateFinalComposition({model:'tecnica',specialtyId:'computacion',spaces:[]});
 assert.equal(result.errors.some(x=>x.code==='TECH_SPECIALTY_INTEGRATIONS'),false);
 assert.equal(result.warnings.filter(x=>x.code==='TECH_SPECIALTY_INTEGRATIONS_PLAN_PENDING').length,3);
 assert.equal(result.valid,false);
 assert.equal(result.readyForPublication,false);
 const approved=validateFinalComposition({model:'tecnica',specialtyId:'computacion',spaces:[],
    officialPlan:{integracionesEspecialidadPorAnio:{4:5,5:4,6:6}}});
 assert.equal(approved.errors.filter(x=>x.code==='TECH_SPECIALTY_INTEGRATIONS_BY_PLAN').length,3);
});

test('integración técnica sigue sin escribir en Supabase ni alterar el V2 original',()=>{
 const loader=readFileSync(new URL('../src/aplicacion-v2/cargador.mjs',import.meta.url),'utf8');
 const map=readFileSync(new URL('../src/v2-familia/v19-mapa-modalidad.js',import.meta.url),'utf8');
 assert.match(loader,/tecnicaAnuales/);
 assert.match(map,/prescribedAnnual/);
 assert.match(map,/Materia prescripta · Fija/);
 assert.match(map,/prearmTechnicalAnnuals/);
 assert.doesNotMatch(map,/(?:supabase|createElement\(['"]iframe)/i);
});
