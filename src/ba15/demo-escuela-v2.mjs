import {mostrarMapaBa15} from './mapa-ui.mjs';
import {montarConstructorBa15} from './constructor-ui.mjs';
import {crearBorradorBa15} from './constructor.mjs';

// Datos sinteticos; nunca conecta a la API, Supabase ni a escuelas reales.
const identity={schoolId:999999,pciId:'demo-ba15-economia',orientationId:'economia_administracion',shiftId:'noche'};
const $=id=>document.getElementById(id);
const draft=crearBorradorBa15(identity);
const ejemplos=[
 {n:1,t:1,f:'troncal',name:'Matemática · Nivel I',subjects:['Matemática']},
 {n:1,t:1,f:'troncal',name:'Lengua y Literatura · Nivel I',subjects:['Lengua y Literatura']},
 {n:1,t:1,f:'troncal',name:'Lenguas Adicionales · Nivel I',subjects:['Lengua Adicional (Inglés)']},
 {n:1,t:1,f:'laboratorio',name:'Laboratorio de Ciencias Naturales',subjects:['Biología']},
 {n:1,t:1,f:'laboratorio',name:'Laboratorio de Ciencias Sociales',subjects:['Historia','Geografía','Formación Ética y Ciudadana']},
 {n:1,t:2,f:'taller',name:'Taller de Artes y Educación Física',subjects:['Artes','Educación Física'],art:'Articulación pedagógica con Lengua y Ciencias Sociales.'},
 {n:1,t:2,f:'troncal',name:'Matemática · Nivel I',subjects:['Matemática']},
 {n:1,t:2,f:'laboratorio',name:'Laboratorio de Ciencias Naturales',subjects:['Biología']},
 {n:2,t:3,f:'troncal',name:'Lengua y Literatura · Nivel II',subjects:['Lengua y Literatura']},
 {n:2,t:3,f:'laboratorio',name:'Laboratorio de Ciencias Naturales II',subjects:['Biología','Físico-Química']},
 {n:2,t:4,f:'orientado',name:'Taller orientado de Economía',subjects:['Materia de la orientación']},
 {n:3,t:5,f:'laboratorio',name:'Laboratorio de Ciencias Sociales III',subjects:['Historia','Geografía','Formación Ética y Ciudadana']},
 {n:3,t:6,f:'orientado',name:'Economía y Administración · Nivel III',subjects:['Materias de la orientación']},
 {n:4,t:7,f:'orientado',name:'Historia y Tecnologías orientadas',subjects:['Historia Orientada','Tecnologías de la Información Orientada']},
 {n:4,t:8,f:'laboratorio',name:'Laboratorio de Química',subjects:['Química']}
];
for(const [i,ex] of ejemplos.entries()){
 const lvl=draft.niveles[ex.n-1],members=ex.subjects.map(name=>lvl.asignaturas.find(x=>x.nombre===name)?.id).filter(Boolean);
 const espacio={id:'demo-agrupamiento-'+(i+1),term:ex.t,nombre:ex.name,formato:ex.f,miembros:members,articulacion:ex.art||'',
 planes:Array.from({length:4},(_,idx)=>({
 numero:idx+1,nombre:'Plan de aprendizaje '+(idx+1),
 objetivos:idx===0?'Comprender relaciones entre los saberes seleccionados y situaciones de la vida cotidiana.':'',
 contenidos:[],etapas:{
 punto_partida:idx===0?'Problematización inicial a partir de situaciones del contexto.':'',
 indagacion:idx===0?'Lectura de fuentes, registros y comparación de procedimientos.':'',
 produccion:idx===0?'Producción colaborativa y sistematización de lo aprendido.':'',
 evaluacion:idx===0?'Autoevaluación, revisión y socialización de producciones.':''}
 }))};
 lvl.espacios.push(espacio);
}
const school=$('school');
school.append(new Option('Escuela Secundaria N.º 99 · Muestra','demo',true,true));
school.disabled=true;
$('schoolLabel').textContent='Escuela de prueba · No corresponde a una institución real';
$('turnFilter').replaceChildren(new Option('Noche','noche',true,true));$('turnFilter').disabled=true;
$('pciCounts').textContent='3 PCI ficticios · 1 seleccionado';
const list=$('pciList');
const group=(label)=>{const h=document.createElement('h3');h.className='pciModelHeading';h.textContent=label;list.append(h);};
const item=(title,sub,active)=>{const b=document.createElement('button');b.type='button';b.className='pciItem'+(active?' active':'');const strong=document.createElement('strong');strong.textContent=title;const small=document.createElement('small');small.textContent=sub;b.append(strong,small);b.addEventListener('click',()=>{if(active)$('ba15Builder').scrollIntoView({behavior:'smooth',block:'start'});else alert('Esta muestra desarrolla únicamente el PCI BA +15. Los demás modelos se conservan en la plataforma original.');});list.append(b);};
group('Turno mañana · Media');item('Bachillerato en Comunicación','PCI ficticio · Media',false);
group('Turno tarde · Técnica');item('Técnico en Informática','PCI ficticio · Técnica',false);
group('Turno noche · BA +15');item('Economía y Administración','PCI de demostración · BA +15',true);
$('btnAddPci').hidden=true;
$('status').textContent='Muestra aislada · Sin guardado online';
$('app').hidden=false;$('empty').hidden=true;$('ba15Pending').hidden=false;
$('ba15Name').textContent='BA +15 · Economía y Administración';
$('ba15Info').textContent='Escuela Secundaria N.º 99 (ficticia) · Turno noche · 4 niveles / C1–C8';
mostrarMapaBa15({metrics:$('ba15Metrics'),navigation:$('ba15Navigation'),map:$('ba15Map'),validation:$('ba15Validation')});
montarConstructorBa15($('ba15Builder'),identity,{initialDraft:draft,readOnlyDemo:true});
