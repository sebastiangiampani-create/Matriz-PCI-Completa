/**
 * Fase 1 V2, copia de la lógica y las clases visuales de v19-map.js.
 * Archivo de las modalidades derivadas: la versión Media real usa su V19
 * original SIN CAMBIOS. Las variantes no cargan ningún constructor anterior.
 */
(() => {
'use strict';
const CFG=window.__V2_MODAL;
if(!CFG||!['tecnica','ba15'].includes(CFG.model))throw Error('Falta perfil curricular de modalidad');
const $id=id=>document.getElementById(id),cur=()=>ensure(state.active);
const LV=Number(CFG.levels),TERMS=Number(CFG.terms);
if(TERMS!==LV*2||(LV!==6&&LV!==4))throw Error('La estructura modal no tiene pares cuatrimestrales válidos');
const range=n=>Array.from({length:n},(_,i)=>i+1);
const areaOf=s=>String(s?.area||''),fieldOf=s=>String(s?.field||'');
const slotTerm=slot=>Number(String(slot).match(/-c(\d+)$/)?.[1])||0;
const slotYear=slot=>Number(String(slot).match(/-n(\d+)$/)?.[1])||Math.ceil(slotTerm(slot)/2);
const slotPair=slot=>{const n=slotTerm(slot);if(!n)return null;return slot.replace(/-c\d+$/,'-c'+(n%2?n+1:n-1))};
const allSubjects=()=>subjects();
const byIdInMap=id=>allSubjects().find(s=>s.id===id);
const isAssigned=(id,slot)=>!!cur().placements[slot]?.includes(id);
const canSeeRow=(r,y)=>!r.allowedYears||r.allowedYears.includes(y);
const matching=(text,values)=>values.some(v=>String(v).toLocaleLowerCase('es')===String(text).toLocaleLowerCase('es'));
// Técnica: filas y ubicaciones según IF-2026-51169092-GCABA-SSPIE, págs. 13–18.
// Se conservan las claves de slot existentes para no perder borradores.
const SPECIALTY=String(CFG.specialtyId||'');
const SIXTH_CORE=['computacion','administracion_empresas'].includes(SPECIALTY);
const NORM=window.__PCI_NORMA||null;
const TECH_PROFILE=CFG.model==='tecnica'?CFG.specialtyProfile||null:null;
const TECH_PRIORIZADOS=CFG.model==='tecnica'?CFG.priorizados||null:null;
const TECH_TOOL=window.__PCI_APLICACION_CONFIG?.tecnicaAnuales||null;
const TECH_ANNUALS=TECH_PROFILE?.espacioAnual?.espacios||[];
const normalizeTechnical=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/\s+/g,' ').trim();
const prescribedAnnual=year=>TECH_ANNUALS.find(x=>x.year===Number(year))||null;
const prescribedForSubject=s=>TECH_ANNUALS.find(x=>
  x.year===Number(s?.year)&&normalizeTechnical(x.name)===normalizeTechnical(s?.name))||null;
const lockedAnnual=(slot,id)=>{
  const year=slotYear(slot),subject=byIdInMap(id),spec=prescribedAnnual(year);
  return !!(String(slot)==='anualEsp-n'+year&&spec&&subject&&
    prescribedForSubject(subject) && subject.origin==='FO'&&fieldOf(subject)==='formacion_tecnica_especifica');
};
// El PDF puede contener representación en 3.º. Permitir trabajarla
// como opción visible y PROVISIONAL, sin declararla prescripta si el plan
// particular todavía no está verificado.
const techRepresentationThird=Boolean((CFG.subjects||[]).some(x=>x.year===3&&/representaci/i.test(x.name)));
const techRepresentationYears=[1,2,...(techRepresentationThird?[3]:[])];
const profileRows=CFG.model==='tecnica'?[
 {k:'lengua',l:'Lengua y Literatura',area:'Lengua y Literatura',annual:true,allowedYears:[1,2,3,4,5]},
 {k:'matematica',l:'Matemática',area:'Matemática',annual:true,allowedYears:SIXTH_CORE?[1,2,3,4,5,6]:[1,2,3,4,5]},
 {k:'adicional',l:'Lengua Adicional',area:'Lengua Adicional',annual:true,allowedYears:SIXTH_CORE?[1,2,3,4,5,6]:[1,2,3,4,5]},
 {k:'naturales',l:'Espacios de integración · Ciencias Naturales',area:'Ciencias Naturales',format:'integracion',a:t=>t<=6},
 {k:'socialA',l:'Espacios de integración · Ciencias Sociales',area:'Ciencias Sociales',format:'integracion',a:t=>true},
 {k:'artes',l:'Espacios formativos · Educación Artística',area:'Educación Artística',format:'formativo',a:t=>t<=2},
 {k:'ef',l:'Espacios formativos · Educación Física',area:'Educación Física',format:'formativo',a:t=>true},
 {k:'representacion',l:'Tecnología de la Representación (anual)',area:'Tecnología de la Representación',annual:true,allowedYears:techRepresentationYears},
 {k:'taller1',l:'Taller del 1.er ciclo (anual)',area:'Taller del Primer Ciclo',format:'formativo',annual:true,allowedYears:[1,2]},
 {k:'foTaller5',l:'Taller de la Especialidad (anual)',area:'Formación Técnico-Específica',format:'formativo',annual:true,allowedYears:[3,4,5,6]},
 {k:'anualEsp',l:'Espacio anual de la especialidad',area:'Formación Técnico-Específica',annual:true,allowedYears:TECH_PROFILE?TECH_ANNUALS.map(x=>x.year):[4,5,6]},
 {k:'foN3',l:'Espacios de integración de la Especialidad',area:'Formación Técnico-Específica',format:'integracion',a:t=>t>=7},
 {k:'practicas',l:'Prácticas Profesionalizantes (Proyecto de Vinculación con el Futuro)',area:'Prácticas Profesionalizantes',annual:true,allowedYears:[5,6]},
 {k:'otros',l:'Otros formatos pedagógicos',area:'Otros formatos pedagógicos',format:'otros',a:t=>true}
]:[
 // BA +15: RES-1375-MEDGC-25, Anexo I, 6.3 (estructura) y 6.5 (áreas); formatos de SSGDA-105-26.
 {k:'lengua',l:'Lengua y Literatura',area:'Lengua y Literatura',annual:true,allowedYears:[1,2,3,4]},
 {k:'matematica',l:'Matemática',area:'Matemática',annual:true,allowedYears:[1,2,3,4]},
 {k:'adicional',l:'Lengua Adicional (Inglés)',area:'Lengua Adicional',annual:true,allowedYears:[1,2,3,4]},
 {k:'naturales',l:'Laboratorio de Ciencias Naturales',area:'Ciencias Naturales',format:'laboratorio',a:t=>true},
 {k:'socialA',l:'Laboratorio de Ciencias Sociales',area:'Ciencias Sociales',format:'laboratorio',a:t=>true},
 {k:'artes',l:'Talleres · Artes',area:'Talleres articulados',format:'taller',a:t=>t<=2||t===5||t===6},
 {k:'tecnologias',l:'Talleres · Educación Tecnológica / Tecnologías de la Información',area:'Formación General',format:'taller',a:t=>t<=6},
 {k:'ef',l:'Talleres · Educación Física',area:'Talleres articulados',format:'taller',a:t=>true},
 {k:'foN3',l:'Laboratorio de la Orientación (Área de la Orientación)',area:'Formación Orientada',format:'orientacion',a:t=>t>=3},
 {k:'otros',l:'Tutoría (Nivel I) y EDI (taller)',area:'Otros formatos pedagógicos',format:'otros',a:t=>true}
];
function profileRow(k){return profileRows.find(r=>r.k===k)}
function mappedArea(s){
 const area=areaOf(s),n=String(s?.name||'').toLowerCase();
 if(CFG.model==='tecnica'){
  if(['Matemática','Lengua y Literatura','Lengua Adicional','Ciencias Naturales','Ciencias Sociales','Educación Física','Educación Artística','Tecnología de la Representación','Taller del Primer Ciclo'].includes(area))return area;
  if(/^tecnolog[ií]as? de la representaci/i.test(s.name))return'Tecnología de la Representación';
  if(fieldOf(s)==='formacion_cientifico_tecnologica')return'Formación Científico-Tecnológica';
  if(fieldOf(s)==='formacion_tecnica_especifica')return'Formación Técnico-Específica';
  if(fieldOf(s)==='practicas_profesionalizantes')return'Prácticas Profesionalizantes';
  return area;
 }
 if(s.origin==='FO')return'Formación Orientada';
 if(/matemática/i.test(s.name))return'Matemática';
 if(/lengua y literatura/i.test(s.name))return'Lengua y Literatura';
 if(/lengua adicional/i.test(s.name))return'Lengua Adicional';
 if(/educación física|artes|edi/i.test(s.name))return'Talleres articulados';
 if(/tecnologías/i.test(s.name))return'Formación General';
 if(/tutoría/i.test(s.name))return'Otros formatos pedagógicos';
 return area;
}
const FLEX_SOCIAL=/^(ciudadan[ií]a y trabajo|ciencia y tecnolog[ií]a)$/i;
function techMember(r,s,level){
 const area=mappedArea(s),name=String(s.name||''),fte=fieldOf(s)==='formacion_tecnica_especifica';
 switch(r.k){
  case 'lengua':case 'matematica':case 'adicional':case 'naturales':case 'artes':case 'ef':case 'representacion':
   return area===r.area||(r.k==='adicional'&&/ingl[eé]s|lengua adicional/i.test(name))?[true,'']:[false,'Esta materia no pertenece a '+r.l+' del Nivel '+level];
  case 'socialA':
   if(area!=='Ciencias Sociales')return [false,'Esta materia no pertenece a Ciencias Sociales'];
   if(level<=3||FLEX_SOCIAL.test(name))return [true,''];
   if(SPECIALTY==='computacion'&&level===4&&/^(historia|geograf[ií]a)$/i.test(name))return [true,''];
   return [false,'Desde Nivel 4 solo se ubican Ciudadanía y Trabajo / Ciencia y Tecnología (y, en Computación, Historia y Geografía en 4.º). IF-2026-51169092, pág. 13.'];
  case 'taller1':
   return level<=2&&area==='Taller del Primer Ciclo'?[true,'']:[false,'El Taller del 1.er ciclo es anual y corresponde a 1.º y 2.º año. Pág. 16.'];
  case 'foTaller5':
   return fte||(level>=3&&area==='Taller del Primer Ciclo')?[true,'']:[false,'El Taller de la Especialidad integra formación técnico-específica (3.º a 6.º). Pág. 17.'];
  case 'anualEsp':{
   const fixed=prescribedAnnual(level);
   if(TECH_PROFILE){
     if(!fixed)return [false,'El Anexo II no prescribe un espacio anual para esta especialidad y año. No se inventan asignaturas.'];
     return fte&&normalizeTechnical(name)===normalizeTechnical(fixed.name)?
       [true,'']:[false,'En '+level+'.º la materia anual prescripta es '+fixed.name+'. No puede reemplazarse.'];
   }
   return fte?[true,'']:[false,'El Espacio anual corresponde a la formación técnico-específica de 4.º a 6.º. Pág. 17.'];
  }
  case 'foN3':
   if(fte)return [true,''];
   if(FLEX_SOCIAL.test(name))return [true,''];
   return [false,'Los espacios de integración de la Especialidad reorganizan la formación técnico-específica de 4.º a 6.º. Pág. 18.'];
  case 'practicas':
   return fieldOf(s)==='practicas_profesionalizantes'?[true,'']:[false,'Solo Prácticas Profesionalizantes, en 5.º o 6.º. Pág. 13.'];
  case 'otros':
   return /Tutoría|EDI|Espacios de Definición/i.test(name)||s.origin==='CUSTOM'?[true,'']:[false,'Solo Tutoría, EDI y espacios agregados por la escuela'];
 }
 return [false,'Espacio curricular inexistente'];
}
function baMember(r,s,level){
 const area=mappedArea(s),name=String(s.name||''),orient=s.origin==='FO'||areaOf(s)==='Formación Orientada';
 const no=msg=>[false,msg+' RES-1375-MEDGC-25, Anexo I, 6.5.'];
 if(s.isOrientationHourBucket)return no('El cupo horario no es una materia; arrastrá las asignaturas NES de la bolsa FO.');
 if(s.legacyReference)return no('Este bloque FO histórico se conserva para revisión del trabajo anterior, pero no se asigna como materia nueva.');
 if(s.origin==='FO'&&s.alternative&&s.alternative!==(cur().alt||'A'))
  return no('Esta materia corresponde a otra alternativa curricular; conservá el mapa y cambiá la alternativa antes de ubicarla.');
 switch(r.k){
  case 'lengua':return /^lengua y literatura$/i.test(name)?[true,'']:no('Solo Lengua y Literatura.');
  case 'matematica':return /^matem[aá]tica$/i.test(name)?[true,'']:no('Solo Matemática.');
  case 'adicional':return /^(lengua adicional|ingl[eé]s)/i.test(name)?[true,'']:no('Solo Lengua Adicional (Inglés).');
  case 'naturales':return !orient&&area==='Ciencias Naturales'?[true,'']:no('El Área de Ciencias Naturales integra Biología, Físico-Química, Física y Química según el nivel.');
  case 'socialA':return !orient&&area==='Ciencias Sociales'?[true,'']:no('El Área de Ciencias Sociales integra Historia, Geografía, Formación Ética y Ciudadana, Economía y Filosofía según el nivel.');
  case 'artes':return /^artes$/i.test(name)?[true,'']:no('Artes se organiza en taller (Nivel I y III).');
  case 'ef':return /^educaci[oó]n f[ií]sica$/i.test(name)?[true,'']:no('Solo Educación Física.');
  case 'tecnologias':return !orient&&/^(educaci[oó]n tecnol[oó]gica|tecnolog[ií]as de la informaci[oó]n)$/i.test(name)?[true,'']:no('Taller de Educación Tecnológica (I) o Tecnologías de la Información (II y III).');
  case 'foN3':return orient&&level>=2?[true,'']:no('El Área de la Orientación comienza en Nivel II; en Nivel IV suma Historia y Tecnologías de la Información orientadas.');
  case 'otros':
   if(/^tutor[ií]a/i.test(name))return level===1?[true,'']:no('Tutoría corresponde al Nivel I.');
   return /Espacios de Definición|^EDI/i.test(name)||s.origin==='CUSTOM'?[true,'']:no('Solo Tutoría, EDI y espacios agregados por la escuela.');
 }
 return [false,'Espacio curricular inexistente'];
}
function canAssign(slot,s){
 const level=slotYear(slot),term=slotTerm(slot),r=profileRow(String(slot).replace(/-(?:n|c)\d+$/,''));
 if(!s||!r||!level||level>LV||level<1)return [false,'Espacio curricular inexistente'];
 if(term && (term>TERMS||!r.a?.(term)))return [false,'Este cuatrimestre no pertenece al mapa de esta modalidad'];
 if(!canSeeRow(r,level))return [false,'Este espacio no está disponible en ese nivel'];
 if(s.year!==level)return [false,'La materia de Nivel '+s.year+' no puede ubicarse en Nivel '+level];
 if(r.annual&&term)return [false,'El espacio anual debe ubicarse en una celda de nivel'];
 if(!r.annual&&!term)return [false,'Este formato requiere un cuatrimestre'];
 if(CFG.model==='tecnica'){
  if(TECH_PROFILE){
   const annualSubject=prescribedForSubject(s);
   if(annualSubject&&r.k!=='anualEsp')
    return [false,'La materia '+annualSubject.name+' debe permanecer en el espacio anual prescripto de '+annualSubject.year+'.º.'];
   if(r.k==='anualEsp'){
    const existing=cur().placements[slot]||[];
    if(existing.length&&!existing.includes(s.id))
      return [false,'Este espacio anual tiene una asignación anterior que requiere revisión. No se sobrescribe.'];
   }
  }
  return techMember(r,s,level);
 }
 if(CFG.model==='ba15')return baMember(r,s,level);
 const area=mappedArea(s);
 if(r.k==='anualEsp'&&fieldOf(s)==='formacion_tecnica_especifica')return [true,''];
 if(r.k==='foN3'&&s.origin==='FO'&&fieldOf(s)!=='practicas_profesionalizantes')return [true,''];
 if(r.k==='foTaller5'&&s.origin==='FO'&&fieldOf(s)==='formacion_tecnica_especifica')return [true,''];
 if(r.k==='otros'&&/Tutoría|EDI|Espacios de Definición/i.test(s.name))return [true,''];
 if(r.k==='artes'&&/art/i.test(s.name))return [true,''];
 if(r.k==='ef'&&/educaci[oó]n f[ií]sica/i.test(s.name))return [true,''];
 if(r.k==='adicional'&&/ingl[eé]s|lengua adicional/i.test(s.name))return [true,''];
 if(r.k==='taller1'&&/taller/i.test(s.name)&&s.origin==='FG')return [true,''];
 if(r.k==='practicas'&&fieldOf(s)==='practicas_profesionalizantes')return [true,''];
 if(r.k==='tecnologias'&&/tecnolog/i.test(s.name))return [true,''];
 if(r.k==='otros'&&s.origin==='CUSTOM')return [true,''];
 if(r.area===area)return [true,''];
 return [false,'Esta materia no pertenece a '+r.l+' del Nivel '+level];
}
function blocked(msg){const el=$id('validation');if(el){el.className='validation rule-block';el.textContent='Acción no permitida: '+msg}toast(msg,true)}
function writePair(slot,id,add){
 // En BA +15 las celdas C1-C8 son independientes. Solo las troncales -n son anuales.
 // Técnica conserva sin cambios la distribución previa del motor.
 const keys=CFG.model==='ba15'?[slot]:[slot,slotPair(slot)].filter(Boolean),p=cur().placements;
 for(const key of keys){const list=p[key]||[];p[key]=add?[...new Set([...list,id])]:list.filter(x=>x!==id)}
}
function assignModal(slot,id){
 const s=byIdInMap(id),[ok,msg]=canAssign(slot,s);
 if(!ok){blocked(msg);return false}
 writePair(slot,id,true);cur().valid=false;picked=null;save();renderOffer();
 const t=slotTerm(slot);toast(t?s.name+' ubicada en C'+t+
  (CFG.model==='ba15'?'':' y C'+(t%2?t+1:t-1)):s.name+' ubicada en espacio anual');
 return true;
}
function moveModal(from,to,id){
 const s=byIdInMap(id);if(!s||from===to)return;
 if(CFG.model==='tecnica'&&lockedAnnual(from,id)){
  blocked('El espacio anual prescripto es fijo. No se traslada ni se elimina.');return false;
 }
 const [ok,msg]=canAssign(to,s);if(!ok){blocked(msg);return}
 const snapshot=structuredClone(cur().placements);
 writePair(from,id,false);writePair(to,id,true);
 cur().valid=false;save();renderOffer();toast('Materia trasladada al nuevo espacio curricular');
}
function removeModal(slot,id){
 if(CFG.model==='tecnica'&&lockedAnnual(slot,id)){
  blocked('La materia anual de la especialidad es prescripta y fija.');return false;
 }
 writePair(slot,id,false);cur().valid=false;save();renderOffer();return true;
}
function decodePayload(raw){
 if(!raw)return null;
 if(raw.startsWith('subject:'))return {kind:'subject',id:decodeURIComponent(raw.slice(8))};
 if(raw.startsWith('move:')){const rest=raw.slice(5),i=rest.indexOf(':');if(i<0)return null;return{kind:'move',from:decodeURIComponent(rest.slice(0,i)),id:decodeURIComponent(rest.slice(i+1))}}
 return {kind:'subject',id:raw};
}
let modalBagQuery='';
const modalWritable=()=>window.__PCI_APLICACION_CONFIG?.contexto?.permissions?.puedeEditar!==false;
function bindTouchDrag(handle,payload,label){
 if(!handle)return;
 handle.onpointerdown=e=>{
  if(!['touch','pen'].includes(e.pointerType))return;
  e.preventDefault();const ghost=document.createElement('div');
  ghost.className='drag-ghost';ghost.textContent=label;document.body.append(ghost);
  const move=ev=>{ghost.style.left=ev.clientX+'px';ghost.style.top=ev.clientY+'px'};
  const cleanup=()=>{ghost.remove();handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',cancel)};
  const up=ev=>{const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('[data-slot]');cleanup();if(target){if(payload.kind==='move')moveModal(payload.from,target.dataset.slot,payload.id);else assignModal(target.dataset.slot,payload.id)}else if(payload.kind==='subject'){picked=payload.id;toast('Materia seleccionada. Tocá una celda del mapa para ubicarla.')}};
  const cancel=()=>cleanup();move(e);handle.setPointerCapture?.(e.pointerId);
  handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',cancel);
 };
}
const st=document.createElement('style');st.textContent=`
 .bag-filter{display:grid;grid-template-columns:repeat(${LV},1fr);gap:5px;margin:8px 0 10px}
 .bag-filter button{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:9px;padding:7px 3px;font-size:.62rem;font-weight:900}
 .bag-filter button.active{background:var(--ink);color:#fff;border-color:var(--ink)}
 .drag-handle,.map-grip{font-weight:900;cursor:grab;touch-action:none;user-select:none}
 .map-grip{display:inline-block;margin-right:4px;color:var(--muted)}
 .drag-ghost{position:fixed;z-index:10000;pointer-events:none;background:#fff;border:1px solid var(--ink);border-radius:9px;padding:7px 10px;max-width:240px;font:700 12px Archivo,Arial,sans-serif;box-shadow:0 8px 24px rgba(18,57,92,.18);transform:translate(10px,10px)}
 .rule-block{background:var(--danger-soft)!important;color:var(--danger)!important;border:1px solid #efb8c4}
 .modal-rule-note{padding:9px 0;line-height:1.45}
 .legacy-out{outline:2px dashed var(--danger,#b42318);background:var(--danger-soft,#fdecee)}
 .legacy-strip{margin:4px 0 8px;padding:8px;border:1px dashed var(--danger,#b42318);border-radius:9px;font-size:.78rem}
 .norma-list{margin:6px 0 0 18px;padding:0}.norma-list li{margin:2px 0}
 .v2-compact-detail{border-top:1px solid var(--line,#dae4e9);padding:7px 0;margin-top:8px;font-size:.8rem}
 .v2-compact-detail summary{cursor:pointer;color:var(--ink);font-weight:850;padding:7px 0}
 .v2-compact-detail[open] summary{margin-bottom:8px}
 .v2-compact-summary{font-size:.82rem;line-height:1.45;color:var(--ink);margin:5px 0 3px}
 #techSpecialtyPrescription,#ba15OrientationPlan,#ba15VirtualPanel{padding:12px 16px;margin:8px 0}
 #techSpecialtyPrescription p,#ba15OrientationPlan p,#ba15VirtualPanel p{margin:8px 0;font-size:.78rem;line-height:1.45}
 #techSpecialtyPrescription .subhead,#ba15OrientationPlan .subhead,#ba15VirtualPanel .subhead{font-size:.67rem;margin-bottom:3px}
 #ba15VirtualPanel select{max-width:100%;min-height:35px;font-size:.78rem}
 .mod-bag-search{display:block;margin:8px 0;font-size:.72rem;font-weight:850}
 .mod-bag-search input{display:block;width:100%;padding:10px 12px;margin-top:4px;background:#fff;border:1px solid var(--line);border-radius:10px;color:var(--ink);font:inherit}
 .mod-bag-help{font-size:.7rem;line-height:1.4;margin:4px 0 11px;color:var(--muted)}
 .mod-drag-target{min-height:56px}
 .mod-drag-target.ready{outline:3px dashed var(--md,#237a6a);outline-offset:-4px;background:#e8f8f4}
 .subject[data-sub]{cursor:grab}.subject[data-sub]:active{cursor:grabbing}
 .subject[data-sub]:focus-visible{outline:2px solid var(--md,#237a6a)}
 .modal-bag-empty{font-size:.75rem;color:var(--muted);padding:9px 0}
 #bagContent .year[hidden],#bagContent .subject[hidden]{display:none!important}
 `;document.head.appendChild(st);
rowDefs=function(){return profileRows};
label=function(k,t){const row=profileRow(k);return row?row.l+' · C'+t:'C'+t};
placed=function(slot){return (cur().placements[slot]||[]).map(id=>{
 const s=byIdInMap(id);if(!s)return'';
 const fixed=CFG.model==='tecnica'&&lockedAnnual(slot,id);
 return '<div class="placed '+(s.origin==='FO'?'fo':'')+'" draggable="'+(fixed?'false':'true')+'" data-map-id="'+esc(id)+'" data-from="'+esc(slot)+'">'+
 (fixed?'<span class="map-grip" aria-hidden="true">✓</span>':'<span class="map-grip">⠿</span>')+esc(s.name)+
 (s.legacyReference?'<small style="display:inline-block;margin-left:6px">Referencia histórica · revisar</small>':'')+
 (fixed?'<small style="display:inline-block;margin-left:6px">Fija</small>':'<button data-rm="'+esc(id)+'" data-slot="'+esc(slot)+'">×</button>')+'</div>'
}).join('')};
renderBag=function(){
 const box=$id('bagContent'),m=cur(),year=Math.min(LV,Math.max(1,Number(m.bagYear)||1));m.bagYear=year;
 const alternative=String(m.alt||'A');
 const set=allSubjects().filter(s=>s.year===year&&!s.isOrientationHourBucket&&!s.legacyReference&&
  (!s.alternative||s.alternative===alternative));
 let h='<div class="subhead">Materias de la modalidad · filtrar por nivel</div>'+
  (CFG.model==='tecnica'?'<p class="modal-rule-note">Materias extraídas de los contenidos priorizados oficiales 2026. Elegí el nivel y arrastrá cada materia al espacio correspondiente. Las agrupaciones se definen según las reglas de la especialidad; no se solicita carga horaria para armar el mapa.</p>':'')+
  '<div class="bag-filter">'+range(LV).map(n=>'<button type="button" data-bag-year="'+n+'" class="'+(n===year?'active':'')+'">'+n+'.º</button>').join('')+'</div>';
 if(CFG.model==='ba15'){
  h+='<p class="modal-rule-note">Materias de la orientación NES: 3.º→Nivel II, 4.º→III y 5.º→IV. Sus contenidos se consultan en Fase 2; todavía no se homologan automáticamente para BA +15.</p>';
  if((CFG.foAlternatives||[]).length>1)
   h+='<div class="bag-filter" role="group" aria-label="Alternativa curricular NES">'+
    CFG.foAlternatives.map(a=>'<button type="button" data-fo-alt="'+esc(a)+'" class="'+
      (a===alternative?'active':'')+'">Alternativa '+esc(a)+'</button>').join('')+'</div>';
  if(alternative==='B'&&(CFG.foWarnings||[]).length)
   h+='<p class="modal-rule-note"><strong>Advertencia sobre la fuente:</strong> '+
    esc(CFG.foWarnings.join(' · '))+'</p>';
 }
 h+='<label class="mod-bag-search" for="modBagQuery">Buscar materia de este nivel<input type="search" id="modBagQuery" placeholder="Nombre, área o campo" autocomplete="off"></label>'+
    '<p class="mod-bag-help">Arrastrá ⠿ hasta una celda. Alternativa accesible: seleccioná la materia y tocá el destino.</p>';
 const groups=[{origin:'FG',label:'Formación General',list:set.filter(s=>s.origin==='FG')},{origin:'FO',label:CFG.model==='tecnica'?'Científico-Tecnológica y Técnico-Específica':'Formación Orientada',list:set.filter(s=>s.origin==='FO')},{origin:'CUSTOM',label:'Materias agregadas por la escuela',list:set.filter(s=>s.origin==='CUSTOM')}];
 for(const group of groups)if(group.list.length){
  h+='<section class="year"><div class="year-head"><strong>'+group.label+' · Nivel '+year+'</strong><span>C'+(year*2-1)+' / C'+year*2+'</span></div>';
  h+=group.list.map(s=>{
   const used=usage(s.id);
   return '<div class="subject '+(used.size>=2?'used-two':'')+'" draggable="true" data-sub="'+esc(s.id)+'"><span class="drag-handle">⠿</span><span><strong>'+esc(s.name)+'</strong><small>'+esc(CFG.model==='tecnica'?({'formacion_cientifico_tecnologica':'Científico-Tecnológica','formacion_tecnica_especifica':'Técnico-Específica','practicas_profesionalizantes':'Prácticas Profesionalizantes'}[s.field]||'Formación General'):(s.origin==='FO'?'Materia NES '+s.sourceYear+'º · '+(s.alternative?'alternativa '+s.alternative:'común')+
     (s.sourceHoursStatus==='nes_documentada'?' · '+s.sourceWeeklyHours+' HC NES (Anexo cotejado)':' · horas NES pendientes')+
     ' · no homologada BA +15':'Formación General'))+'</small></span><span class="usage">'+usageLabel(s)+'</span></div>'
  }).join('');
  h+='</section>';
 }
 if(!set.length)h+='<p>No hay materias para este nivel en la base de referencia.</p>';
 box.innerHTML=h;
 box.querySelectorAll('[data-bag-year]').forEach(el=>el.onclick=()=>{m.bagYear=Number(el.dataset.bagYear);save();renderBag()});
 box.querySelectorAll('[data-fo-alt]').forEach(el=>el.onclick=()=>{
  const next=el.dataset.foAlt;
  if(next===m.alt||!(CFG.foAlternatives||[]).includes(next))return;
  m.alt=next;m.valid=false;save();renderOffer();
  toast('Alternativa '+next+': se conserva el mapa anterior para revisar, sin sobrescribir asignaciones.');
 });
 box.querySelectorAll('[data-sub]').forEach(el=>{const id=el.dataset.sub;
  el.setAttribute('tabindex','0');
  el.ondragstart=e=>{
   if(!modalWritable()){e.preventDefault();return}
   e.dataTransfer.effectAllowed='copy';
   e.dataTransfer.setData('text/plain','subject:'+encodeURIComponent(id));
   e.dataTransfer.setData('application/x-pci-subject',id);
  };
  el.ondragend=()=>document.querySelectorAll('.mod-drag-target.ready').forEach(z=>z.classList.remove('ready'));
  const pick=()=>{picked=id;box.querySelectorAll('.subject').forEach(x=>x.classList.toggle('selected',x===el));toast('Materia seleccionada. Elegí el espacio de destino.')};
  el.onclick=pick;
  el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick()}};
  if(modalWritable())bindTouchDrag(el,{kind:'subject',id},byIdInMap(id)?.name||id);
 });
 const search=$id('modBagQuery');
 if(search){
  search.value=modalBagQuery;
  const filter=()=>{
   modalBagQuery=search.value;
   const q=normalizeTechnical(modalBagQuery);
   let shown=0;
   box.querySelectorAll('.year').forEach(section=>{
    let inSection=0;
    section.querySelectorAll('[data-sub]').forEach(tile=>{
     const subject=byIdInMap(tile.dataset.sub);
     const text=[subject?.name,subject?.area,subject?.field].join(' ');
     const visible=!q||normalizeTechnical(text).includes(q);
     tile.hidden=!visible;if(visible){inSection++;shown++}
    });
    section.hidden=!inSection;
   });
   let empty=box.querySelector('.modal-bag-empty');
   if(!shown){if(!empty){empty=document.createElement('p');empty.className='modal-bag-empty';box.appendChild(empty)}empty.textContent='No hay materias con ese nombre en este nivel. Probá otro año o término.'}
   else empty?.remove();
  };
  search.oninput=filter;
  filter();
 }
};
renderMatrix=function(){
 let html='<div class="grid levels"><div></div>';
 for(let year=1;year<=LV;year++)html+='<div class="level">Nivel '+year+'</div>';
 html+='</div><div class="grid"><div class="term">Espacio</div>';
 for(let t=1;t<=TERMS;t++)html+='<div class="term">C'+t+'</div>';
 html+='</div>';
 for(const r of rowDefs()){
  html+='<div class="grid"><div class="rowlabel">'+esc(r.l)+'</div>';
  if(r.annual){
   for(let year=1;year<=LV;year++){
    if(canSeeRow(r,year)){
     const slot=r.k+'-n'+year,defaultName=r.l+' · Nivel '+year+
       (r.k==='representacion'&&year===3&&TECH_PROFILE?.planParticularVerificado!==true?' · Sujeto al plan particular':'');
     const fixed=CFG.model==='tecnica'&&r.k==='anualEsp'?prescribedAnnual(year):null;
     const name=fixed?fixed.name+' · Materia prescripta · Fija':
       cur().phase2V28?.groups?.[slot]?.name||defaultName;
     html+='<div class="cell annual"><div class="drop" data-slot="'+slot+'"><strong data-space-name="'+slot+'">'+esc(name)+'</strong>'+placed(slot)+'</div></div>';
    }else if((cur().placements[r.k+'-n'+year]||[]).length){
     const slot=r.k+'-n'+year;
     html+='<div class="cell annual legacy-out"><div class="drop" data-slot="'+slot+'"><strong>Fuera de la norma · revisar</strong>'+placed(slot)+'</div></div>';
    }else html+='<div class="cell annual inactive">—</div>';
   }
  }else for(let t=1;t<=TERMS;t++){
   if(r.a(t)){
    const slot=r.k+'-c'+t,name=cur().phase2V28?.groups?.[slot]?.name||r.l+' · C'+t;
    html+='<div class="cell"><div class="drop" data-slot="'+slot+'"><strong data-space-name="'+slot+'">'+esc(name)+'</strong>'+placed(slot)+'</div></div>';
   }else if((cur().placements[r.k+'-c'+t]||[]).length){
    const slot=r.k+'-c'+t;
    html+='<div class="cell legacy-out"><div class="drop" data-slot="'+slot+'"><strong>Fuera de la norma · revisar</strong>'+placed(slot)+'</div></div>';
   }else html+='<div class="cell inactive">—</div>';
  }
  html+='</div>';
  if(r.annual){
   const legacy=Object.keys(cur().placements).filter(k=>k.startsWith(r.k+'-c')&&(cur().placements[k]||[]).length);
   if(legacy.length)html+='<div class="legacy-strip"><strong>'+esc(r.l)+':</strong> materias ubicadas como cuatrimestrales en un borrador anterior. Arrastrarlas a la celda anual del nivel: '+legacy.map(k=>'<span class="drop legacy-out" data-slot="'+esc(k)+'">C'+slotTerm(k)+' '+placed(k)+'</span>').join(' ')+'</div>';
  }
 }
 html+=renderLegacyScientificField();
 $id('matrix').innerHTML=html;
 $id('matrix').querySelectorAll('[data-slot]').forEach(el=>{
  el.classList.add('mod-drag-target');
  el.ondragover=e=>{if(!modalWritable())return;e.preventDefault();e.stopPropagation();el.classList.add('ready');e.dataTransfer.dropEffect='copy'};
  el.ondragleave=()=>el.classList.remove('ready');
  el.ondrop=e=>{e.preventDefault();e.stopPropagation();el.classList.remove('ready');if(!modalWritable())return;const p=decodePayload(e.dataTransfer.getData('text/plain'));if(!p)return;if(p.kind==='move')moveModal(p.from,el.dataset.slot,p.id);else assignModal(el.dataset.slot,p.id)};
  el.onclick=e=>{if(e.target.closest('[data-rm]'))return;if(picked)assignModal(el.dataset.slot,picked)};
 });
 $id('matrix').querySelectorAll('[data-rm]').forEach(el=>el.onclick=e=>{e.stopPropagation();removeModal(el.dataset.slot,el.dataset.rm)});
 $id('matrix').querySelectorAll('[data-map-id]').forEach(el=>{
  const id=el.dataset.mapId,from=el.dataset.from;
  el.ondragstart=e=>{if(!modalWritable()){e.preventDefault();return}e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','move:'+encodeURIComponent(from)+':'+encodeURIComponent(id))};
  bindTouchDrag(el.querySelector('.map-grip'),{kind:'move',from,id},byIdInMap(id)?.name||id)
 });
};
assign=assignModal;removeOne=removeModal;validTarget=canAssign;
renderSocial=function(){};
validateSocial=function(){return{ok:true,msg:'Constructor '+(CFG.model==='tecnica'?'técnico':'BA +15')+' · distribución por niveles y campos propios. '+CFG.sourceNote}};
const TECH_FORMAT={lengua:['troncal','Lengua y Literatura'],matematica:['troncal','Matemática'],adicional:['troncal','Lengua Adicional'],
 naturales:['integracion_natural','Ciencias Naturales'],socialA:['integracion_social','Ciencias Sociales'],
 artes:['espacio_formativo','Educación Artística'],ef:['espacio_formativo','Educación Física'],
 representacion:['tecnologia_representacion','Tecnología de la Representación'],taller1:['taller_primer_ciclo','Taller del Primer Ciclo'],
 foTaller5:['taller_especialidad','Formación Técnico-Específica'],anualEsp:['espacio_anual_especialidad','Formación Técnico-Específica'],
 foN3:['integracion_especialidad','Formación Técnico-Específica'],practicas:['practicas_profesionalizantes','Prácticas Profesionalizantes']};
const ANNUAL_FORMATS=['troncal','tecnologia_representacion','taller_primer_ciclo','taller_especialidad','espacio_anual_especialidad'];
function techSpaces(){
 const spaces=[];
 for(const [slot,ids] of Object.entries(cur().placements)){
  if(!ids?.length)continue;
  const key=slot.replace(/-(?:n|c)\d+$/,''),def=TECH_FORMAT[key];if(!def)continue;
  const list=ids.map(byIdInMap).filter(Boolean),term=slotTerm(slot),year=slotYear(slot);
  const hours=list.map(x=>Number(x.weeklyHours));
  let id=slot;
  if(key==='socialA'&&year>=4)id=(list.every(x=>FLEX_SOCIAL.test(x.name))?'t-social-flex-':'t-social-comp-')+slot;
  spaces.push({id,year,...(term?{term}:{}),format:def[0],area:def[1],name:def[1],
   duration:ANNUAL_FORMATS.includes(def[0])?'anual':'cuatrimestral',
   subjectIds:list.map(x=>x.id),weeklyHours:hours.length&&hours.every(h=>h>0)?hours.reduce((a,b)=>a+b,0):null,
   character:cur().phase2V28?.groups?.[slot]?.character});
 }
 return spaces;
}
function showNorma(result,label='IF-2026-51169092-GCABA-SSPIE'){
 const el=$id('validation');if(!el)return;
 const items=[...result.errors.map(x=>['Error',x]),...result.warnings.filter(x=>x.code!=='HOURS_UNVERIFIED'&&x.code!=='SUBJECTS_PENDING').map(x=>['Pendiente',x])];
 const unverified=result.warnings.filter(x=>x.code==='HOURS_UNVERIFIED').length;
 el.className='validation '+(result.errors.length?'rule-block':'');
 el.innerHTML='<strong>'+(result.errors.length?'El mapa no cumple la norma '+label:
   CFG.model==='ba15'&&result.structurallyConsistent?'Estructura curricular consistente · '+label:
   !result.valid?'Composición revisada, pendiente de plan oficial · '+label:
   'Composición validada con '+label)+'</strong>'+
  '<ul class="norma-list">'+items.slice(0,12).map(([k,x])=>'<li>'+k+': '+esc(x.message)+(x.page?(/^\d+\.\d/.test(String(x.page))?' (punto '+x.page+')':' (pág. '+x.page+')'):'')+'</li>').join('')+
  (items.length>12?'<li>… y '+(items.length-12)+' observaciones más.</li>':'')+
  (unverified&&CFG.model!=='tecnica'?'<li>Pendiente: '+unverified+' espacios sin carga horaria declarada en el catálogo (no se verifica el tope de 9 horas).</li>':'')+'</ul>';
}
const BA_SOURCE='RES-1375-MEDGC-25, Anexo I (IF-2025), 6.3 y 6.5';
const BA_PLACEHOLDER=/^materias? de la orientaci[oó]n$/i;
const BA_FO_PLAN=CFG.model==='ba15'?CFG.foPlan?.niveles||[]:[];
// La RES-105/SSGDA/26 SOLO alcanza turno noche de escuelas de su Anexo II.
function baVirtualState(){
 const m=cur();
 if(!m.ba15Ambientes||typeof m.ba15Ambientes!=='object')
  m.ba15Ambientes={aplicacion:'pendiente_confirmacion',distribucion:{}};
 if(!m.ba15Ambientes.distribucion||typeof m.ba15Ambientes.distribucion!=='object')
  m.ba15Ambientes.distribucion={};
 return m.ba15Ambientes;
}
function baVirtualAudit(){
 const cfg=baVirtualState(),rule=CFG.ambientesVirtualesNorma||{},
  errores=[],advertencias=[],periodos=[];
 if(cfg.aplicacion==='no_alcanzado')
  return {aplica:false,completa:true,errores,advertencias,periodos};
 if(cfg.aplicacion!=='aplica_anexo_ii_turno_noche'){
  advertencias.push({code:'BA_VIRTUAL_ALCANCE',message:'Confirmar si el turno noche de esta escuela está incluido en el Anexo II de RES-105/SSGDA/2026.'});
  return {aplica:false,completa:false,errores,advertencias,periodos};
 }
 for(let t=1;t<=8;t++){
  const y=Math.ceil(t/2),registros=allSubjects().filter(x=>x.year===y&&x.origin==='FG'),
   campo=cfg.distribucion['c'+t]||{},detalle=[];
  for(const subject of registros){
   const horas=Number(subject.weeklyHours),raw=campo[subject.name],
    complete=raw!==undefined&&raw!==null&&raw!=='',
    asin=complete?Number(raw):null,
    valid=complete&&Number.isInteger(asin)&&asin>=0&&asin<=horas;
   if(!valid)errores.push({code:'BA_VIRTUAL_INCOMPLETA_C'+t,
    message:'C'+t+': indicar horas asincrónicas enteras (0 a '+horas+') de '+subject.name+'.'});
   else{
    const presencial=horas-asin;
    if(subject.format==='troncal'&&100*presencial/horas+1e-8<(rule.porcentajePresencialTroncal||80))
     errores.push({code:'BA_VIRTUAL_TRONCAL_C'+t,
      message:'C'+t+': '+subject.name+' debe conservar al menos 80% presencial.'});
    if(['Educación Física','Tutoría'].includes(subject.name)&&asin!==0)
     errores.push({code:'BA_VIRTUAL_PRESENCIAL_C'+t,
      message:'C'+t+': '+subject.name+' requiere presencialidad completa.'});
   }
   detalle.push({nombre:subject.name,horas,presenciales:valid?horas-asin:null,
    asincronicas:valid?asin:null,completo:valid});
  }
  const completo=detalle.length>0&&detalle.every(x=>x.completo),
   presenciales=completo?detalle.reduce((n,x)=>n+x.presenciales,0):null,
   asincronicas=completo?detalle.reduce((n,x)=>n+x.asincronicas,0):null;
  if(completo&&(presenciales!==27||asincronicas!==11))
   errores.push({code:'BA_VIRTUAL_TOTAL_C'+t,message:'C'+t+
    ': se requieren 27 HC presenciales + 11 HC asincrónicas; hay '+presenciales+' + '+asincronicas+'.'});
  periodos.push({cuatrimestre:t,nivel:y,completo,presenciales,asincronicas,detalle});
 }
 return {aplica:true,completa:periodos.every(x=>x.completo),errores,advertencias,periodos};
}

function baEvaluate(){
 const errors=[],warnings=[],placements=cur().placements;
 // El Anexo I 6.3 y 6.5 prescribe materias, áreas y 38 h por NIVEL.
 // No prescribe repetir una materia en cada cuatrimestre del mapa del PCI.
 const placedInLevel=y=>new Set(Object.entries(placements)
  .filter(([slot,ids])=>ids?.length&&slotYear(slot)===y)
  .flatMap(([,ids])=>ids));
 const placedInTerm=term=>new Set(Object.entries(placements)
  .filter(([slot,ids])=>ids?.length&&(slotTerm(slot)===term||(!slotTerm(slot)&&slotYear(slot)===Math.ceil(term/2))))
  .flatMap(([,ids])=>ids));
 for(let y=1;y<=LV;y++){
  const req=allSubjects().filter(x=>x.year===y&&x.origin==='FG');
  const inLevel=placedInLevel(y);
  const hours=req.reduce((a,x)=>a+(Number(x.weeklyHours)||0),0);
  if(hours!==38)errors.push({code:'BA_HOURS_'+y,message:'El catálogo del Nivel '+y+' suma '+hours+' h; la estructura establece 38 horas cátedra.',page:'6.3'});
  for(const x of req.filter(x=>!BA_PLACEHOLDER.test(x.name)))
   if(!inLevel.has(x.id))errors.push({code:'BA_MISSING_'+y,
    message:'Nivel '+y+': falta ubicar '+x.name+' ('+x.weeklyHours+' h).',page:'6.3'});
  if(y>=2){
   const plan=BA_FO_PLAN.find(x=>x.nivel===y);
   if(!plan||plan.horasOrientacion!==({2:4,3:9,4:12}[y]))
    errors.push({code:'BA_FO_PLAN_'+y,
     message:'La carga de la orientación no coincide con el Anexo I en Nivel '+y+'.',page:'6.3'});
   const orientados=Object.entries(placements).filter(([slot,ids])=>
    /^foN3-c\d+$/.test(slot)&&slotYear(slot)===y&&ids?.length)
    .flatMap(([,ids])=>ids.map(byIdInMap).filter(x=>x?.origin==='FO'));
   if(!orientados.length)errors.push({code:'BA_ORIENTATION_'+y,
    message:'Nivel '+y+': falta incorporar una propuesta de Formación Orientada.',page:'6.5'});
   if(orientados.some(x=>x.alternative&&x.alternative!==(cur().alt||'A')))
    errors.push({code:'BA_FO_ALTERNATIVA_'+y,message:'Nivel '+y+
     ': hay materias de otra alternativa NES. Conservar y revisar antes de validar.',page:'6.5'});
   // Sumatoria de asignaturas distintas: una materia en C impar y par NO
   // duplica horas. Solo se aplica si el Anexo NES está efectivamente cotejado.
   const proof=(CFG.foEvidenciaNes||[]).find(x=>x.anio===y+1&&
    (x.alternativa===(cur().alt||'A')||x.alternativa==='comun'));
   if(proof?.estado==='cotejado_fuente_primaria'){
    const ids=new Map(orientados.filter(x=>x.sourceHoursStatus==='nes_documentada')
     .map(x=>[x.id,x]));
    const total=[...ids.values()].reduce((n,x)=>n+Number(x.sourceWeeklyHours||0),0);
    if(total!==plan.horasOrientacion)
     errors.push({code:'BA_FO_CUPO_COTEJADO_'+y,
      message:'Nivel '+y+': materias ubicadas '+total+' HC NES documentadas; el Anexo I prevé '+
       plan.horasOrientacion+' HC de orientación. Corregir composición o revisar borrador histórico.',page:'6.3'});
   }else if(proof?.estado==='cotejado_con_excepcion_horaria'){
    errors.push({code:'BA_FO_ADECUACION_NATURALES_'+y,
     message:'Nivel '+y+': Ciencias Naturales NES suma '+proof.sumaHorasNes+
      ' HC y BA +15 prescribe '+plan.horasOrientacion+
      ' HC. Es necesaria una adaptación curricular documentada; no se pueden reasignar horas automáticamente.',page:'6.3'});
   }else warnings.push({code:'BA_FO_HORAS_DOCUMENTALES_PENDIENTES_'+y,
    message:'Nivel '+y+': falta cotejar las horas individuales de esta orientación y alternativa con el Anexo NES. No se homologan automáticamente.',page:'6.3'});
   if(orientados.some(x=>x.legacyReference))
    warnings.push({code:'BA_FO_BLOQUES_HISTORICOS_'+y,
     message:'Nivel '+y+': se conservan ubicaciones de bloques FO antiguos. Sustituirlos por materias NES al revisar el PCI sin eliminar sus planes anteriores.',page:'6.5'});
   if(orientados.some(x=>x.confirmedBa15Subject!==true))
    warnings.push({code:'BA_FO_MATERIAS_NES_PENDIENTES_'+y,
     message:'Nivel '+y+': hay materias identificadas en el plan NES ('+plan?.horasOrientacion+
     ' HC de orientación), pero sus horas individuales y la correspondencia específica con BA +15 requieren verificación.',page:'6.3'});
  }
  // Diagnóstico pedagógico por cuatrimestre: alerta, NO infracción normativa.
  // Permite que una materia integre laboratorios distintos en C impar y C par.
  for(const term of [y*2-1,y*2]){
   const inTerm=placedInTerm(term);
   for(const [area,code] of [['Ciencias Naturales','NAT'],['Ciencias Sociales','SOC']]){
    const areaSubjects=req.filter(x=>x.area===area);
    if(areaSubjects.length&&!areaSubjects.some(x=>inTerm.has(x.id)))
     warnings.push({code:'BA_'+code+'_C'+term,
      message:'C'+term+': sin asignaturas del área '+area+'. Revisar su organización cuatrimestral en el PCI.',page:'6.5'});
   }
   if(y>=2&&!Object.entries(placements).some(([slot,ids])=>
    slot==='foN3-c'+term&&ids?.some(id=>byIdInMap(id)?.origin==='FO')))
    warnings.push({code:'BA_FO_C'+term,
     message:'C'+term+': sin espacio específico FO; revisar distribución de la orientación dentro del nivel.',page:'6.5'});
  }
 }
 warnings.push({code:'BA_FO_REFERENCIA_PENDIENTE',message:'La bolsa de Fase 1 contiene materias NES del bachillerato por año y alternativa; la Fase 2 contiene bloques de referencia FO de Media V2. Falta verificar las cargas individuales y la correspondencia oficial del plan BA +15 con los cupos: II 4 h, III 9 h y IV 12+2+2 h.',page:'6.3'});
 if((cur().alt||'A')==='B'&&(CFG.foWarnings||[]).length)
  warnings.push({code:'BA_FO_FUENTE_B_PENDIENTE',
   message:CFG.foWarnings.join(' '),page:'6.3'});
 const ambientes=baVirtualAudit();
 if(ambientes.aplica)errors.push(...ambientes.errores);
 else warnings.push(...ambientes.advertencias);
 warnings.push({code:'BA_AMBIENTES_ALCANCE',message:'La distribución 27 HC presenciales + 11 asincrónicas de RES-105/SSGDA/26 se aplica solo a escuelas de turno noche del Anexo II.',page:'105/2026'});
 return {ruleSet:'ba15-res-1375-25/1',source:BA_SOURCE,errors,warnings,
  structurallyConsistent:errors.length===0,valid:false,homologated:false};
}
function auditAnnuals(){
 if(CFG.model!=='tecnica'||!TECH_PROFILE)return null;
 if(TECH_TOOL)return TECH_TOOL.auditarPrescripcionesAnualesTecnica(cur(),TECH_PROFILE,allSubjects());
 const issues=[],annuals=TECH_ANNUALS;
 for(const y of [4,5,6]){
  const target=annuals.find(x=>x.year===y),ids=cur().placements['anualEsp-n'+y]||[];
  if(!target){if(ids.length)issues.push({code:'ANUAL_NO_CORRESPONDE',year:y,slot:'anualEsp-n'+y,message:'El Anexo no prescribe un espacio anual en '+y+'.º para esta especialidad.'});continue}
  const subject=allSubjects().filter(s=>s.year===y&&s.origin==='FO'&&fieldOf(s)==='formacion_tecnica_especifica'&&normalizeTechnical(s.name)===normalizeTechnical(target.name));
  if(subject.length!==1||ids.length!==1||ids[0]!==subject[0]?.id)
    issues.push({code:'ANUAL_PRESCRIPTO_INCOMPLETO',slot:'anualEsp-n'+y,year:y,message:'Falta la materia anual prescripta: '+target.name+'.'});
 }
 return {issues,expected:annuals};
}
const legacyFieldSlots=()=>{
 if(CFG.model!=='tecnica')return [];
 const map=cur(),p=map.placements||{},g=map.phase2V28?.groups||{};
 const keys=[...new Set([...Object.keys(p),...Object.keys(g)])]
  .filter(key=>/^fct-c(?:[1-9]|1[0-2])$/.test(key));
 const hasWork=group=>{
  const data=group?.data||group||{};
  const contents=data.contents||group?.contents||[];
  if(Array.isArray(contents)&&contents.length)return true;
  if([data.objectives,data.synopsis,data.context].some(x=>String(x||'').trim()))return true;
  return (data.plansBimestrales||[]).some(plan=>
   (plan?.contentIds||[]).length||[plan?.objectives,plan?.synopsis].some(x=>String(x||'').trim())||
   Object.values(plan?.stages||{}).some(stage=>
    ['description','activities','resources','evidence'].some(k=>String(stage?.[k]||'').trim())));
 };
 return keys.filter(slot=>(p[slot]||[]).length>0||hasWork(g[slot]));
};
function renderLegacyScientificField(){
 if(CFG.model!=='tecnica')return '';
 const slots=legacyFieldSlots();
 if(!slots.length)return '';
 const details=slots.map(slot=>{
   const ids=cur().placements?.[slot]||[];
   const names=ids.map(id=>byIdInMap(id)?.name||id);
   return '<li><strong>C'+slotTerm(slot)+'</strong>: '+esc(names.join(', ')||'Desarrollo curricular previo')+'</li>';
 }).join('');
 return '<section class="legacy-strip" role="note"><details><summary>'+
   'Asignaciones anteriores del campo Científico-Tecnológico · '+slots.length+' espacio(s) para revisar</summary>'+
   '<p>El campo Científico-Tecnológico es una clasificación del plan, no un formato curricular independiente. '+
   'Estas asignaciones y sus planes permanecen guardados, pero no se habilitan nuevos espacios. '+
   'Revisar su ubicación según la especialidad antes de validar el mapa.</p><ul>'+details+'</ul></details></section>';
}
function techAudit(){
 const plan=TECH_PROFILE?.espacioAnual.status==='no_definido_en_anexo'?
   {annualSpecialtyDefined:false}:null;
 const result=NORM.validateFinalComposition({model:'tecnica',specialtyId:SPECIALTY,
  spaces:techSpaces(),officialPlan:plan});
 const legacy=legacyFieldSlots();
 if(legacy.length)result.errors.push({code:'TECH_CIENTIFICO_TECNOLOGICA_LEGADO',
   message:'Hay '+legacy.length+' asignaciones anteriores en una fila no prescripta. Se preservan para revisión.',
   severity:'error',page:13});
 const fixed=auditAnnuals();
 if(fixed)for(const issue of fixed.issues)result.errors.push({
  code:'TECH_'+issue.code,message:issue.message,spaceId:issue.slot,
  severity:'error',page:17
 });
 if(TECH_PROFILE?.variablesNoCertificadas?.length)
  result.warnings.push({code:'TECH_SPECIALTY_PLAN_PENDING',
   message:'Faltan verificar con el diseño de '+TECH_PROFILE.name+
    ': '+TECH_PROFILE.variablesNoCertificadas.join(', ')+'.',
   severity:'warning',page:13});
 result.valid=result.errors.length===0&&result.warnings.length===0;
 result.structurallyConsistent=result.errors.length===0;
 return result;
}
window.V2ModalNorma={spaces:()=>CFG.model==='tecnica'?techSpaces():[],
 evaluateBA15:baEvaluate,
 evaluate:()=>CFG.model==='ba15'?baEvaluate():CFG.model==='tecnica'&&NORM?techAudit():null};
validateOffer=function(){
 const invalid=[];for(const [slot,ids] of Object.entries(cur().placements)){
  for(const id of ids){const s=byIdInMap(id);const [ok,msg]=canAssign(slot,s);if(!ok)invalid.push(msg)}
 }
 if(invalid.length){blocked(invalid[0]);return}
 if(CFG.model==='ba15'){
  const result=baEvaluate();
  cur().normaComposicion={ruleSet:result.ruleSet,source:result.source,
   errors:result.errors.length,warnings:result.warnings.length,
   estado:result.structurallyConsistent?'estructura_consistente_pendiente_homologacion':'requiere_correccion',
   homologated:false,checkedAt:new Date().toISOString()};
  cur().valid=result.structurallyConsistent;save();renderOffer();showNorma(result,'RES-1375-MEDGC-25 (Régimen +15)');
  toast(result.errors.length?'El mapa no cumple la estructura del Régimen +15':'Mapa consistente con el Régimen +15. Queda pendiente la revisión pedagógica.',!!result.errors.length);
  return;
 }
 if(CFG.model==='tecnica'){
  if(!NORM){blocked('No se pudo cargar la norma de composición; el mapa no se valida.');return}
  const result=window.V2ModalNorma.evaluate();
  cur().normaComposicion={ruleSet:result.ruleSet,source:result.source,
    errors:result.errors.length,warnings:result.warnings.length,
    estado:result.errors.length?'requiere_correccion':result.valid?'validacion_completa':'pendiente_plan_especialidad',
    checkedAt:new Date().toISOString()};
  cur().valid=result.valid===true;
  save();renderOffer();showNorma(result);
  toast(result.errors.length?'El mapa requiere correcciones de composición':
    !result.valid?'Mapa revisado: pendiente contrastar el plan de la especialidad; no queda validado.':
    'Mapa validado con todas las verificaciones disponibles.',!!result.errors.length);
  return;
 }
 cur().valid=true;save();renderOffer();
 toast('Mapa estructural guardado en el borrador. La homologación requiere revisar la norma y contenidos de esta modalidad.');
};
const modal=$id('rulesModal');
if(modal){
 modal.innerHTML='<div class="modal-box"><div class="row" style="justify-content:space-between"><h2>Reglas de composición</h2><button id="closeModalV2" class="btn">Cerrar</button></div><div class="modal-rule-note"><strong>'+esc(CFG.model==='tecnica'?'Educación Técnica · seis niveles · C1–C12':'BA +15 · cuatro niveles · C1–C8')+'</strong></div><p>'+esc(CFG.sourceNote)+'</p>'+(CFG.model==='tecnica'?'<p><strong>IF-2026-51169092-GCABA-SSPIE · Modalidad Técnica</strong></p><ul class="norma-list"><li>Troncales anuales: Lengua y Literatura 1.º–5.º; Matemática y Lengua Adicional 1.º–5.º (6.º en Computación y Administración de Empresas).</li><li>Ciencias Sociales: 8 espacios de integración cuatrimestrales (10 en Computación; 4/5 EIO y 4/5 EIE). Ciudadanía y Trabajo / Ciencia y Tecnología se ubican en 4.º, 5.º o 6.º y pueden integrarse con la Formación Específica del mismo año.</li><li>Ciencias Naturales: 6 espacios en 1.º a 3.º (4 EIO y 2 EIE); solo en 1.º puede haber una única asignatura.</li><li>Educación Física: 12 espacios formativos cuatrimestrales. Educación Artística: 2, en 1.º.</li><li>Tecnología de la Representación: 2 o 3 anuales. Taller del 1.er ciclo: 2 anuales (1.º y 2.º).</li><li>Taller de la Especialidad: anual, de 3.º a 6.º según especialidad. Espacio anual de la especialidad: 4.º, 5.º y 6.º.</li><li>Espacios de integración de la Especialidad: 4 a 6 por año en 4.º a 6.º; no rige el tope de 9 horas.</li><li>Prácticas Profesionalizantes: 1 o 2, en 5.º/6.º, dentro del Proyecto de Vinculación con el Futuro.</li><li>Ningún espacio de integración o formativo supera 9 horas cátedra, salvo los de la Especialidad. Cada espacio integra al menos dos asignaturas del mismo año, salvo excepción del plan.</li></ul>':CFG.model==='ba15'?'<p><strong>RES-1375-MEDGC-25 · Régimen de Implementación Curricular +15</strong></p><ul class="norma-list"><li>Cuatro niveles (I a IV), 38 horas cátedra semanales por nivel (Anexo I, 6.3).</li><li>Troncales anuales en los cuatro niveles: Lengua y Literatura, Matemática y Lengua Adicional (Inglés).</li><li>Área de Ciencias Naturales: I Biología; II Biología y Físico-Química; III Física; IV Química.</li><li>Área de Ciencias Sociales: I y III Historia, Geografía y FEyC; II suma Economía; IV Filosofía.</li><li>Área de la Orientación: desde Nivel II; en Nivel IV suma Historia y Tecnologías de la Información orientadas.</li><li>Talleres: Educación Física (I–IV), Artes (I y III), Educación Tecnológica (I) y Tecnologías de la Información (II y III); EDI en formato taller; Tutoría en Nivel I.</li><li>Turno noche (SSGDA-105-26): 27 h presenciales y 11 asincrónicas.</li><li>El Área de la Orientación tiene 4 h en Nivel II, 9 h en Nivel III y 12 h en Nivel IV, más Historia Orientada 2 h y Tecnologías de la Información Orientada 2 h (Anexo I, 6.3).</li><li>Los bloques de contenidos FO de Media son referencias, no una lista validada de materias de BA +15. La denominación de asignaturas requiere el plan NES de cada orientación.</li><li>El CCC acredita equivalencias; no es una materia ni un cuatrimestre adicional del mapa C1–C8.</li></ul>':'<p>Se respetan los niveles y el campo curricular de cada materia. Los espacios de integración y formativos se muestran como formatos diferentes. El mapa no se homologa automáticamente.</p>')+'<p>Arrastrá las materias al mapa V2. En BA +15 los formatos cuatrimestrales se organizan por separado en C1–C8; las troncales anuales abarcan los dos cuatrimestres de su nivel. En Técnica se conserva su distribución específica.</p></div>';
 modal.querySelector('#closeModalV2').onclick=()=>modal.classList.remove('open');
}
function prearmTechnicalAnnuals(){
 if(CFG.model!=='tecnica'||!TECH_TOOL||!TECH_PROFILE||
   window.__PCI_APLICACION_CONFIG?.contexto?.permissions?.puedeEditar!==true)return {applied:[],issues:[]};
 const result=TECH_TOOL.prearmarAnualesTecnica(cur(),TECH_PROFILE,allSubjects());
 if(result.applied.length){
  cur().placements=result.map.placements;cur().valid=false;
  save();renderOffer();
 }
 return result;
}
function renderTechPrescriptionPanel(){
 if(CFG.model!=='tecnica'||!TECH_PROFILE)return;
 const hero=$id('offer')?.querySelector('.hero');if(!hero)return;
 let panel=$id('techSpecialtyPrescription');
 if(!panel){panel=document.createElement('section');panel.id='techSpecialtyPrescription';
  panel.className='card';hero.after(panel)}
 const check=auditAnnuals();
 const rows=TECH_ANNUALS.map(x=>'<li><strong>'+x.year+'.º:</strong> '+esc(x.name)+' · anual · fija</li>').join('');
 const stateDesc=TECH_PROFILE.espacioAnual.status==='no_ofrece'?
  'La especialidad no contempla espacio anual propio.':
  TECH_PROFILE.espacioAnual.status==='no_definido_en_anexo'?
  'El Anexo aún no define el anual. No se incorpora una materia inventada.':
  'Espacios anuales prescriptos:';
 const warnings=check?.issues?.length?
  '<p><strong>Requiere revisión:</strong> '+esc(check.issues[0].message)+'</p>':'';
 const prior=TECH_PRIORIZADOS;
 const validSource=prior && /^https:\/\/static\.buenosaires\.gob\.ar\/sites\/default\/files\/2026-10\/[\w%\-]+\.pdf$/.test(prior.fuente);
 const unresolved=prior?.sinNivel||[];
 const pending=unresolved.map(item=>'<li>'+esc(item.seccion)+' · página '+Number(item.pagina)+'</li>');
 const sourceLine=prior?
  '<p><strong>Fuente:</strong> contenidos priorizados oficiales de '+esc(TECH_PROFILE.name)+
  ' · '+Number(prior.totalSecciones)+' secciones y '+Number(prior.totalReferencias)+
  ' referencias de contenido ('+Number(prior.referenciasConNivel)+' con nivel identificable). '+
  (validSource?'<a href="'+esc(prior.fuente)+'" target="_blank" rel="noopener noreferrer">Consultar PDF oficial</a>. ':'')+
  '</p>'+ (unresolved.length?
    '<details><summary>'+unresolved.length+' referencias sin año identificable · revisar antes de ubicarlas</summary>'+
    '<ul class="norma-list">'+pending.slice(0,20).join('')+
    (pending.length>20?'<li>… y '+(pending.length-20)+' referencias más en el catálogo original.</li>':'')+
    '</ul></details>':'<p>Todas las referencias cuentan con un año identificable en la fuente extraída.</p>') : '';
 const atom=prior?.contenidosAtomicos,documental=prior?.desagregacionDocumental,
       reconstruida=prior?.baseReconstruida;
 const atomLine=reconstruida?
  '<p><strong>Base curricular reconstruida:</strong> '+
  Number(reconstruida.contenidosExtraidos)+' contenidos individualizados directamente de los PDF oficiales, '+
  Number(reconstruida.nuevosSinDuplicar)+' incorporados sin duplicar textos previamente cotejados. '+
  'Se conservaron '+Number(reconstruida.contenidosHistoricosConservados)+' IDs de contenidos anteriores para proteger desarrollos ya guardados. '+
  'No se requiere revisar registros uno por uno; la base no constituye homologación normativa automática.</p>':
  atom?'<p><strong>Contenidos en Fase 2:</strong> '+
   Number(atom.contenidosAtomicos)+' contenidos con cotejo previo. '+
   (documental?Number(documental.contenidosIndividualesProvisionales)+' fragmentos provisionales y '+
   Number(documental.referenciasPendientes)+' referencias pendientes. ':
   Number(atom.referenciasPendientes)+' referencias por completar. ')+
   'La base original queda como respaldo hasta que se publique el banco reconstruido.</p>':'';
  const stillPending=prior?.pendientesDeAtomizacion||[];
 const detailPending=stillPending.length?
  '<details><summary>Revisar '+stillPending.length+' referencias todavía sin contenidos individuales seguros</summary>'+
  '<ul class="norma-list">'+stillPending.slice(0,80).map(x=>{
    const p=Number(x.page),page=Number.isSafeInteger(p)&&p>0?p:null;
    const label=esc(String(x.name||'Materia sin identificar'))+
      ' · '+(x.year?'año '+Number(x.year):'año por verificar')+
      (page?' · página '+page:'');
    return '<li>'+(validSource&&page?
      '<a href="'+esc(prior.fuente)+'#page='+page+'" target="_blank" rel="noopener noreferrer">'+label+'</a>':label)+
      ' · '+(x.reason==='sin_anio_verificable'?'sin año verificable':x.reason==='pagina_sin_texto_extraido'?'página sin texto extraído · verificar PDF':'extracción de columnas ambigua')+'</li>';
   }).join('')+
   (stillPending.length>80?'<li>… y '+(stillPending.length-80)+' referencias adicionales. Consultar el catálogo completo.</li>':'')+
   '</ul></details>':'';
 panel.innerHTML='<div class="subhead">Educación Técnica · Anexo II</div>'+
  '<div class="v2-compact-summary"><strong>'+esc(TECH_PROFILE.name)+'</strong> · '+
  (TECH_ANNUALS.length?TECH_ANNUALS.length+' materia(s) anual(es) prescripta(s)':'Plan anual a revisar')+
  (check?.issues?.length?' · '+check.issues.length+' observación(es)':'')+'</div>'+
  '<details class="v2-compact-detail"><summary>Ver prescripciones, fuentes y auditoría de contenidos</summary>'+
  '<p>'+esc(stateDesc)+'</p>'+
  (rows?'<ul class="norma-list">'+rows+'</ul>':'')+warnings+sourceLine+atomLine+detailPending+
  '<p><strong>Composición:</strong> Matemática y Lengua Adicional: '+TECH_PROFILE.troncales.matematica.length+
  ' años. Sociales: '+TECH_PROFILE.sociales.total+' integraciones ('+
  TECH_PROFILE.sociales.obligatorios+' obligatorias y '+TECH_PROFILE.sociales.electivos+
  ' electivas). Para talleres, integraciones y prácticas, contrastar con el plan particular. '+
  'La integración de la Especialidad está exceptuada del máximo general de 9 HC; '+
  'Sociales y Naturales conservan ese límite.</p></details>';
}
function renderBa15OrientationPanel(){
 if(CFG.model!=='ba15'||!BA_FO_PLAN.length)return;
 const hero=$id('offer')?.querySelector('.hero');if(!hero)return;
 let panel=$id('ba15OrientationPlan');
 if(!panel){panel=document.createElement('section');panel.id='ba15OrientationPlan';
  panel.className='card';hero.after(panel);}
 const rows=BA_FO_PLAN.map(item=>{
  const fixed=item.materiasFijas||[];
  const extra=fixed.length?' + '+fixed.map(x=>esc(x.nombre)+' '+Number(x.horas)+' HC').join(' + '):'';
  return '<li><strong>Nivel '+['I','II','III','IV'][item.nivel-1]+'</strong>: '+
   (item.horasOrientacion?Number(item.horasOrientacion)+' HC de materias propias de la orientación':'sin Formación Orientada')+
   extra+'</li>';
 });
 const activeAlt=String(cur().alt||'A');
 const audit=(CFG.foEvidenciaNes||[]).filter(x=>x.alternativa==='comun'||x.alternativa===activeAlt);
 const auditList=audit.length?'<ul class="norma-list">'+audit.map(x=>
   '<li>Nivel '+['','I','II','III','IV'][x.anio-1]+' · '+esc(x.estado==='cotejado_fuente_primaria'?
    (x.sumaHorasNes+' HC NES cotejadas · '+x.fuente.norma):
    'horas individuales pendientes de fuente oficial')+'</li>').join('')+'</ul>':'';
 panel.innerHTML='<div class="subhead">BA +15 · Formación Orientada</div>'+
  '<div class="v2-compact-summary"><strong>'+esc(state.active)+'</strong> · alternativa '+esc(activeAlt)+
  ' · cuatro niveles y ocho cuatrimestres. Las materias NES son de referencia hasta su adaptación al régimen BA +15.</div>'+
  '<details class="v2-compact-detail"><summary>Ver cargas horarias por nivel y cotejo NES</summary>'+
  '<p>El Anexo I (6.3) fija los cupos; las materias se contrastan con el diseño NES de esta orientación.</p>'+
  '<ul class="norma-list">'+rows.join('')+'</ul>'+
  '<p><strong>Fase 1:</strong> bolsa NES por año y alternativa. Horas de fuente, sin homologación automática.</p>'+
  '<p><strong>Alternativa '+esc(activeAlt)+' · evidencia NES:</strong></p>'+auditList+
  '<p><strong>Fase 2:</strong> bloques de referencia FO de Media, para desarrollo de contenidos. No constituyen materias homologadas.</p>'+
  '<p><small>El CCC acredita saberes previos; no agrega cuatrimestres a C1–C8.</small></p></details>';
}
function renderBa15VirtualPanel(){
 if(CFG.model!=='ba15')return;
 const hero=$id('offer')?.querySelector('.hero');if(!hero)return;
 let panel=$id('ba15VirtualPanel');
 if(!panel){
  panel=document.createElement('section');panel.id='ba15VirtualPanel';
  panel.className='card';($id('ba15OrientationPlan')||hero).after(panel);
 }
 const open=[...panel.querySelectorAll('details[open]')].map(x=>Number(x.dataset.c));
 const config=baVirtualState(),audit=baVirtualAudit();
 let html='<div class="subhead">BA +15 · Presencialidad y virtualidad</div>'+
  '<div class="v2-compact-summary">Solo para escuelas y turnos alcanzados por RES-105/2026: '+
  '<strong>27 HC presenciales + 11 asincrónicas</strong>.</div>'+
  '<label for="ba15AmbientesAlcance">Aplicación del Anexo II: </label> '+
  '<select id="ba15AmbientesAlcance">'+[
   ['pendiente_confirmacion','Pendiente de confirmar con Anexo II'],
   ['aplica_anexo_ii_turno_noche','Sí, turno noche incluido en Anexo II'],
   ['no_alcanzado','No, no está alcanzado por esta resolución']
  ].map(([value,label])=>'<option value="'+value+'"'+
   (config.aplicacion===value?' selected':'')+'>'+esc(label)+'</option>').join('')+
  '</select>';
 html+='<details class="v2-compact-detail"><summary>Alcance de la resolución y condiciones de actividades asincrónicas</summary>'+
   '<p>Solo corresponde al turno noche de las escuelas incluidas en el Anexo II de RES-105/SSGDA/2026. Las horas asincrónicas no requieren videollamadas simultáneas. Confirmá la inclusión institucional antes de completar la distribución.</p></details>';
 if(audit.aplica){
  const passed=audit.periodos.filter(x=>x.completo&&x.presenciales===27&&x.asincronicas===11).length;
  html+='<p>Ingresá las <strong>horas asincrónicas</strong> de cada espacio. Las presenciales '+
   'se calculan automáticamente. La Formación Orientada figura como cupo global '+
   'hasta completar las materias individuales.</p>'+
   '<p><strong>Cuatrimestres con distribución 27 + 11:</strong> '+passed+' de 8.</p>';
  for(const item of audit.periodos){
   const t=item.cuatrimestre,period=config.distribucion['c'+t]||{};
   const expand=open.length?open.includes(t):t===1;
   html+='<details data-c="'+t+'"'+(expand?' open':'')+'><summary><strong>Nivel '+
    item.nivel+' · C'+t+'</strong> · '+(item.completo?
    item.presenciales+' HC presenciales + '+item.asincronicas+' HC asincrónicas':
    'distribución pendiente')+'</summary><div style="overflow-x:auto"><table style="width:100%">'+
    '<thead><tr><th>Espacio curricular</th><th>Total HC</th>'+
    '<th>HC asincrónicas</th><th>HC presenciales</th></tr></thead><tbody>';
   for(const e of item.detalle){
    const raw=period[e.nombre],value=raw===undefined||raw===null?'':String(raw);
    html+='<tr><td>'+esc(e.nombre)+'</td><td>'+e.horas+'</td>'+
     '<td><input type="number" min="0" max="'+e.horas+'" step="1" data-vterm="'+t+
     '" data-vname="'+esc(e.nombre)+'" aria-label="C'+t+' horas asincrónicas de '+esc(e.nombre)+
     '" value="'+esc(value)+'" style="width:5rem"></td><td>'+
     (e.presenciales===null?'—':e.presenciales)+'</td></tr>';
   }
   html+='</tbody></table></div></details>';
  }
  if(audit.errores.length)
   html+='<p><strong>Revisión:</strong> '+audit.errores.length+
    ' observaciones. '+esc(audit.errores.slice(0,3).map(e=>e.message).join(' · '))+'</p>';
 }else if(audit.advertencias.length)
  html+='<p>'+esc(audit.advertencias.map(e=>e.message).join(' '))+'</p>';
 panel.innerHTML=html;
 panel.querySelector('#ba15AmbientesAlcance').onchange=e=>{
  config.aplicacion=e.target.value;cur().valid=false;save();renderBa15VirtualPanel();
 };
 panel.querySelectorAll('[data-vterm]').forEach(el=>el.onchange=()=>{
  const term='c'+el.dataset.vterm,name=el.dataset.vname;
  if(!config.distribucion[term])config.distribucion[term]={};
  if(el.value==='')delete config.distribucion[term][name];
  else config.distribucion[term][name]=Number(el.value);
  cur().valid=false;save();renderBa15VirtualPanel();
 });
}

const previousRenderOffer=renderOffer;
renderOffer=function(...args){const result=previousRenderOffer(...args);
 renderTechPrescriptionPanel();renderBa15OrientationPanel();renderBa15VirtualPanel();return result};
if(CFG.model==='tecnica')window.addEventListener('pci-app-ready',()=>{
 prearmTechnicalAnnuals();renderTechPrescriptionPanel();
});
window.V2ModalVirtual={evaluate:baVirtualAudit,state:baVirtualState,render:renderBa15VirtualPanel};
window.V2ModalMap={model:CFG.model,levels:LV,terms:TERMS,rowDefs,canAssign,
 assign:assignModal,move:moveModal,remove:removeModal,
 profile:TECH_PROFILE,auditAnnuals,prearmAnnuals:prearmTechnicalAnnuals};
})();