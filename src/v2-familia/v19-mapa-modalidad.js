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
const techRepresentationYears=[1,2,...(CFG.model==='tecnica'&&(CFG.subjects||[]).some(x=>x.year===3&&/representaci/i.test(x.name))?[3]:[])];
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
 {k:'anualEsp',l:'Espacio anual de la especialidad',area:'Formación Técnico-Específica',annual:true,allowedYears:[4,5,6]},
 {k:'foN3',l:'Espacios de integración de la Especialidad',area:'Formación Técnico-Específica',format:'integracion',a:t=>t>=7},
 {k:'fct',l:'Científico-Tecnológica · ubicación según plan de la especialidad',area:'Formación Científico-Tecnológica',format:'integracion',a:t=>true},
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
  case 'anualEsp':
   return fte?[true,'']:[false,'El Espacio anual corresponde a la formación técnico-específica de 4.º a 6.º. Pág. 17.'];
  case 'foN3':
   if(fte)return [true,''];
   if(FLEX_SOCIAL.test(name))return [true,''];
   return [false,'Los espacios de integración de la Especialidad reorganizan la formación técnico-específica de 4.º a 6.º. Pág. 18.'];
  case 'fct':
   return area==='Formación Científico-Tecnológica'?[true,'']:[false,'Esta materia no es de Formación Científico-Tecnológica'];
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
 if(CFG.model==='tecnica')return techMember(r,s,level);
 if(CFG.model==='ba15')return baMember(r,s,level);
 const area=mappedArea(s);
 if(r.k==='anualEsp'&&fieldOf(s)==='formacion_tecnica_especifica')return [true,''];
 if(r.k==='foN3'&&s.origin==='FO'&&fieldOf(s)!=='practicas_profesionalizantes')return [true,''];
 if(r.k==='foTaller5'&&s.origin==='FO'&&fieldOf(s)==='formacion_tecnica_especifica')return [true,''];
 if(r.k==='fct'&&fieldOf(s)==='formacion_cientifico_tecnologica')return [true,''];
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
 const keys=[slot,slotPair(slot)].filter(Boolean),p=cur().placements;
 for(const key of keys){const list=p[key]||[];p[key]=add?[...new Set([...list,id])]:list.filter(x=>x!==id)}
}
function assignModal(slot,id){
 const s=byIdInMap(id),[ok,msg]=canAssign(slot,s);
 if(!ok){blocked(msg);return false}
 writePair(slot,id,true);cur().valid=false;picked=null;save();renderOffer();
 const t=slotTerm(slot);toast(t?s.name+' ubicada en C'+t+' y C'+(t%2?t+1:t-1):s.name+' ubicada en espacio anual');
 return true;
}
function moveModal(from,to,id){
 const s=byIdInMap(id);if(!s||from===to)return;
 const [ok,msg]=canAssign(to,s);if(!ok){blocked(msg);return}
 const snapshot=structuredClone(cur().placements);
 writePair(from,id,false);writePair(to,id,true);
 cur().valid=false;save();renderOffer();toast('Materia trasladada al nuevo espacio curricular');
}
function removeModal(slot,id){writePair(slot,id,false);cur().valid=false;save();renderOffer()}
function decodePayload(raw){
 if(!raw)return null;
 if(raw.startsWith('subject:'))return {kind:'subject',id:decodeURIComponent(raw.slice(8))};
 if(raw.startsWith('move:')){const rest=raw.slice(5),i=rest.indexOf(':');if(i<0)return null;return{kind:'move',from:decodeURIComponent(rest.slice(0,i)),id:decodeURIComponent(rest.slice(i+1))}}
 return {kind:'subject',id:raw};
}
function bindTouchDrag(handle,payload,label){
 if(!handle)return;
 handle.onpointerdown=e=>{
  if(!['touch','pen'].includes(e.pointerType))return;
  e.preventDefault();const ghost=document.createElement('div');
  ghost.className='drag-ghost';ghost.textContent=label;document.body.append(ghost);
  const move=ev=>{ghost.style.left=ev.clientX+'px';ghost.style.top=ev.clientY+'px'};
  const cleanup=()=>{ghost.remove();handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',cancel)};
  const up=ev=>{const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('[data-slot]');cleanup();if(target){if(payload.kind==='move')moveModal(payload.from,target.dataset.slot,payload.id);else assignModal(target.dataset.slot,payload.id)}};
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
 `;document.head.appendChild(st);
rowDefs=function(){return profileRows};
label=function(k,t){const row=profileRow(k);return row?row.l+' · C'+t:'C'+t};
placed=function(slot){return (cur().placements[slot]||[]).map(id=>{
 const s=byIdInMap(id);if(!s)return'';
 return '<div class="placed '+(s.origin==='FO'?'fo':'')+'" draggable="true" data-map-id="'+esc(id)+'" data-from="'+esc(slot)+'"><span class="map-grip">⠿</span>'+esc(s.name)+'<button data-rm="'+esc(id)+'" data-slot="'+esc(slot)+'">×</button></div>'
}).join('')};
renderBag=function(){
 const box=$id('bagContent'),m=cur(),year=Math.min(LV,Math.max(1,Number(m.bagYear)||1));m.bagYear=year;
 const set=allSubjects().filter(s=>s.year===year);
 let h='<div class="subhead">Materias de la modalidad · filtrar por nivel</div><div class="bag-filter">'+range(LV).map(n=>'<button type="button" data-bag-year="'+n+'" class="'+(n===year?'active':'')+'">'+n+'.º</button>').join('')+'</div>';
 const groups=[{origin:'FG',label:'Formación General',list:set.filter(s=>s.origin==='FG')},{origin:'FO',label:CFG.model==='tecnica'?'Científico-Tecnológica y Técnico-Específica':'Formación Orientada',list:set.filter(s=>s.origin==='FO')},{origin:'CUSTOM',label:'Materias agregadas por la escuela',list:set.filter(s=>s.origin==='CUSTOM')}];
 for(const group of groups)if(group.list.length){
  h+='<section class="year"><div class="year-head"><strong>'+group.label+' · Nivel '+year+'</strong><span>C'+(year*2-1)+' / C'+year*2+'</span></div>';
  h+=group.list.map(s=>{
   const used=usage(s.id);
   return '<div class="subject '+(used.size>=2?'used-two':'')+'" draggable="true" data-sub="'+esc(s.id)+'"><span class="drag-handle">⠿</span><span><strong>'+esc(s.name)+'</strong><small>'+esc(CFG.model==='tecnica'?({'formacion_cientifico_tecnologica':'Científico-Tecnológica','formacion_tecnica_especifica':'Técnico-Específica','practicas_profesionalizantes':'Prácticas Profesionalizantes'}[s.field]||'Formación General'):(s.origin==='FO'?'Formación Orientada':'Formación General'))+'</small></span><span class="usage">'+usageLabel(s)+'</span></div>'
  }).join('');
  h+='</section>';
 }
 if(!set.length)h+='<p>No hay materias para este nivel en la base de referencia.</p>';
 box.innerHTML=h;
 box.querySelectorAll('[data-bag-year]').forEach(el=>el.onclick=()=>{m.bagYear=Number(el.dataset.bagYear);save();renderBag()});
 box.querySelectorAll('[data-sub]').forEach(el=>{const id=el.dataset.sub;
  el.ondragstart=e=>e.dataTransfer.setData('text/plain','subject:'+encodeURIComponent(id));
  el.onclick=()=>{picked=id;box.querySelectorAll('.subject').forEach(x=>x.classList.toggle('selected',x===el));toast('Materia seleccionada: tocá el destino del mapa')};
  bindTouchDrag(el.querySelector('.drag-handle'),{kind:'subject',id},byIdInMap(id)?.name||id);
 });
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
     const slot=r.k+'-n'+year,defaultName=r.l+' · Nivel '+year;
     const name=cur().phase2V28?.groups?.[slot]?.name||defaultName;
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
 $id('matrix').innerHTML=html;
 $id('matrix').querySelectorAll('[data-slot]').forEach(el=>{
  el.ondragover=e=>{e.preventDefault();e.stopPropagation();el.classList.add('ready')};
  el.ondragleave=()=>el.classList.remove('ready');
  el.ondrop=e=>{e.preventDefault();e.stopPropagation();el.classList.remove('ready');const p=decodePayload(e.dataTransfer.getData('text/plain'));if(!p)return;if(p.kind==='move')moveModal(p.from,el.dataset.slot,p.id);else assignModal(el.dataset.slot,p.id)};
  el.onclick=e=>{if(e.target.closest('[data-rm]'))return;if(picked)assignModal(el.dataset.slot,picked)};
 });
 $id('matrix').querySelectorAll('[data-rm]').forEach(el=>el.onclick=e=>{e.stopPropagation();removeModal(el.dataset.slot,el.dataset.rm)});
 $id('matrix').querySelectorAll('[data-map-id]').forEach(el=>{
  const id=el.dataset.mapId,from=el.dataset.from;
  el.ondragstart=e=>e.dataTransfer.setData('text/plain','move:'+encodeURIComponent(from)+':'+encodeURIComponent(id));
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
 el.innerHTML='<strong>'+(result.errors.length?'El mapa no cumple la norma '+label:'Composición estructuralmente consistente con '+label)+'</strong>'+
  '<ul class="norma-list">'+items.slice(0,12).map(([k,x])=>'<li>'+k+': '+esc(x.message)+(x.page?(/^\d+\.\d/.test(String(x.page))?' (punto '+x.page+')':' (pág. '+x.page+')'):'')+'</li>').join('')+
  (items.length>12?'<li>… y '+(items.length-12)+' observaciones más.</li>':'')+
  (unverified?'<li>Pendiente: '+unverified+' espacios sin carga horaria declarada en el catálogo (no se verifica el tope de 9 horas).</li>':'')+'</ul>';
}
const BA_SOURCE='RES-1375-MEDGC-25, Anexo I (IF-2025), 6.3 y 6.5';
const BA_PLACEHOLDER=/^materias? de la orientaci[oó]n$/i;
function baEvaluate(){
 const errors=[],warnings=[],placements=cur().placements;
 const placedIn=y=>new Set(Object.entries(placements).filter(([k,ids])=>ids?.length&&slotYear(k)===y).flatMap(([,ids])=>ids));
 for(let y=1;y<=LV;y++){
  const req=allSubjects().filter(x=>x.year===y&&x.origin==='FG'),inLevel=placedIn(y);
  const hours=req.reduce((a,x)=>a+(Number(x.weeklyHours)||0),0);
  if(hours!==38)warnings.push({code:'BA_HOURS_'+y,message:'El catálogo del Nivel '+y+' suma '+hours+' h; la estructura establece 38 horas cátedra.',page:'6.3'});
  for(const x of req.filter(x=>!BA_PLACEHOLDER.test(x.name)))
   if(!inLevel.has(x.id))errors.push({code:'BA_MISSING_'+y,message:'Nivel '+y+': falta ubicar '+x.name+' ('+x.weeklyHours+' h).',page:'6.3'});
  if(y>=2){
   const orientation=Object.entries(placements).some(([k,ids])=>k.startsWith('foN3-')&&slotYear(k)===y&&ids?.length);
   if(!orientation)errors.push({code:'BA_ORIENTATION_'+y,message:'Nivel '+y+': el Área de la Orientación no tiene espacios curriculares.',page:'6.5'});
  }
 }
 warnings.push({code:'BA_PRESENCIAL',message:'Turno noche (SSGDA-105-26): troncales ≥80% presencial; laboratorios y talleres 60–70%; Educación Física y Tutoría 100% presencial; EDI 100% asincrónico. Se define en la grilla horaria.',page:'4.1'});
 return {ruleSet:'ba15-res-1375-25/1',source:BA_SOURCE,errors,warnings};
}
window.V2ModalNorma={spaces:()=>CFG.model==='tecnica'?techSpaces():[],
 evaluateBA15:baEvaluate,
 evaluate:()=>CFG.model==='ba15'?baEvaluate():CFG.model==='tecnica'&&NORM?NORM.validateFinalComposition({model:'tecnica',specialtyId:SPECIALTY,spaces:techSpaces()}):null};
validateOffer=function(){
 const invalid=[];for(const [slot,ids] of Object.entries(cur().placements)){
  for(const id of ids){const s=byIdInMap(id);const [ok,msg]=canAssign(slot,s);if(!ok)invalid.push(msg)}
 }
 if(invalid.length){blocked(invalid[0]);return}
 if(CFG.model==='ba15'){
  const result=baEvaluate();
  cur().normaComposicion={ruleSet:result.ruleSet,source:result.source,errors:result.errors.length,warnings:result.warnings.length,checkedAt:new Date().toISOString()};
  cur().valid=!result.errors.length;save();renderOffer();showNorma(result,'RES-1375-MEDGC-25 (Régimen +15)');
  toast(result.errors.length?'El mapa no cumple la estructura del Régimen +15':'Mapa consistente con el Régimen +15. Queda pendiente la revisión pedagógica.',!!result.errors.length);
  return;
 }
 if(CFG.model==='tecnica'){
  if(!NORM){blocked('No se pudo cargar la norma de composición; el mapa no se valida.');return}
  const result=window.V2ModalNorma.evaluate();
  cur().normaComposicion={ruleSet:result.ruleSet,source:result.source,errors:result.errors.length,warnings:result.warnings.length,checkedAt:new Date().toISOString()};
  if(result.errors.length){cur().valid=false;save();renderOffer();showNorma(result);toast('El mapa no cumple la norma de composición',true);return}
  cur().valid=true;save();renderOffer();showNorma(result);
  toast('Mapa consistente con la norma. Quedan pendientes de revisión pedagógica y del plan oficial.');
  return;
 }
 cur().valid=true;save();renderOffer();
 toast('Mapa estructural guardado en el borrador. La homologación requiere revisar la norma y contenidos de esta modalidad.');
};
const modal=$id('rulesModal');
if(modal){
 modal.innerHTML='<div class="modal-box"><div class="row" style="justify-content:space-between"><h2>Reglas de composición</h2><button id="closeModalV2" class="btn">Cerrar</button></div><div class="modal-rule-note"><strong>'+esc(CFG.model==='tecnica'?'Educación Técnica · seis niveles · C1–C12':'BA +15 · cuatro niveles · C1–C8')+'</strong></div><p>'+esc(CFG.sourceNote)+'</p>'+(CFG.model==='tecnica'?'<p><strong>IF-2026-51169092-GCABA-SSPIE · Modalidad Técnica</strong></p><ul class="norma-list"><li>Troncales anuales: Lengua y Literatura 1.º–5.º; Matemática y Lengua Adicional 1.º–5.º (6.º en Computación y Administración de Empresas).</li><li>Ciencias Sociales: 8 espacios de integración cuatrimestrales (10 en Computación; 4/5 EIO y 4/5 EIE). Ciudadanía y Trabajo / Ciencia y Tecnología se ubican en 4.º, 5.º o 6.º y pueden integrarse con la Formación Específica del mismo año.</li><li>Ciencias Naturales: 6 espacios en 1.º a 3.º (4 EIO y 2 EIE); solo en 1.º puede haber una única asignatura.</li><li>Educación Física: 12 espacios formativos cuatrimestrales. Educación Artística: 2, en 1.º.</li><li>Tecnología de la Representación: 2 o 3 anuales. Taller del 1.er ciclo: 2 anuales (1.º y 2.º).</li><li>Taller de la Especialidad: anual, de 3.º a 6.º según especialidad. Espacio anual de la especialidad: 4.º, 5.º y 6.º.</li><li>Espacios de integración de la Especialidad: 4 a 6 por año en 4.º a 6.º; no rige el tope de 9 horas.</li><li>Prácticas Profesionalizantes: 1 o 2, en 5.º/6.º, dentro del Proyecto de Vinculación con el Futuro.</li><li>Ningún espacio de integración o formativo supera 9 horas cátedra, salvo los de la Especialidad. Cada espacio integra al menos dos asignaturas del mismo año, salvo excepción del plan.</li></ul>':CFG.model==='ba15'?'<p><strong>RES-1375-MEDGC-25 · Régimen de Implementación Curricular +15</strong></p><ul class="norma-list"><li>Cuatro niveles (I a IV), 38 horas cátedra semanales por nivel (Anexo I, 6.3).</li><li>Troncales anuales en los cuatro niveles: Lengua y Literatura, Matemática y Lengua Adicional (Inglés).</li><li>Área de Ciencias Naturales: I Biología; II Biología y Físico-Química; III Física; IV Química.</li><li>Área de Ciencias Sociales: I y III Historia, Geografía y FEyC; II suma Economía; IV Filosofía.</li><li>Área de la Orientación: desde Nivel II; en Nivel IV suma Historia y Tecnologías de la Información orientadas.</li><li>Talleres: Educación Física (I–IV), Artes (I y III), Educación Tecnológica (I) y Tecnologías de la Información (II y III); EDI en formato taller; Tutoría en Nivel I.</li><li>Turno noche (SSGDA-105-26): 27 h presenciales y 11 asincrónicas.</li></ul>':'<p>Se respetan los niveles y el campo curricular de cada materia. Los espacios de integración y formativos se muestran como formatos diferentes. El mapa no se homologa automáticamente.</p>')+'<p>Las materias cuatrimestrales se asignan mediante el mismo drag and drop de V2; la distribución se replica al cuatrimestre par del nivel. Los espacios anuales ocupan ambos.</p></div>';
 modal.querySelector('#closeModalV2').onclick=()=>modal.classList.remove('open');
}
window.V2ModalMap={model:CFG.model,levels:LV,terms:TERMS,rowDefs,canAssign,assign:assignModal,move:moveModal,remove:removeModal};
})();