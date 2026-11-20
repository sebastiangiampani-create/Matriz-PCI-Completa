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
const profileRows=CFG.model==='tecnica'?[
 {k:'lengua',l:'Lengua y Literatura',area:'Lengua y Literatura',annual:true},
 {k:'matematica',l:'Matemática',area:'Matemática',annual:true},
 {k:'adicional',l:'Lengua Adicional',area:'Lengua Adicional',annual:true},
 {k:'naturales',l:'Espacios de integración · Ciencias Naturales',area:'Ciencias Naturales',format:'integracion',a:t=>true},
 {k:'socialA',l:'Espacios de integración · Ciencias Sociales',area:'Ciencias Sociales',format:'integracion',a:t=>true},
 {k:'artes',l:'Espacios formativos · Educación Artística',area:'Educación Artística',format:'formativo',a:t=>t<=2},
 {k:'ef',l:'Espacios formativos · Educación Física',area:'Educación Física',format:'formativo',a:t=>true},
 {k:'representacion',l:'Tecnología de la Representación',area:'Tecnología de la Representación',annual:true,allowedYears:[1,2]},
 {k:'taller1',l:'Espacio formativo · Taller primer ciclo',area:'Taller del Primer Ciclo',format:'formativo',annual:true,allowedYears:[1,2]},
 {k:'fct',l:'Espacios de integración · Científico-Tecnológica',area:'Formación Científico-Tecnológica',format:'integracion',a:t=>true},
 {k:'foN3',l:'Espacios de integración · Técnica Específica',area:'Formación Técnico-Específica',format:'integracion',a:t=>t>=5},
 {k:'foTaller5',l:'Espacios formativos · Taller especialidad',area:'Formación Técnico-Específica',format:'formativo',a:t=>t>=5},
 {k:'anualEsp',l:'Espacio anual de la especialidad',area:'Formación Técnico-Específica',annual:true,allowedYears:[4,5,6]},
 {k:'practicas',l:'Prácticas Profesionalizantes · según especialidad',area:'Prácticas Profesionalizantes',annual:true,allowedYears:[5,6]},
 {k:'otros',l:'Otros formatos pedagógicos',area:'Otros formatos pedagógicos',format:'otros',a:t=>true}
]:[
 {k:'lengua',l:'Lengua y Literatura',area:'Lengua y Literatura',annual:true},
 {k:'matematica',l:'Matemática',area:'Matemática',annual:true},
 {k:'adicional',l:'Lengua Adicional',area:'Lengua Adicional',annual:true},
 {k:'naturales',l:'Laboratorios · Ciencias Naturales',area:'Ciencias Naturales',format:'laboratorio',a:t=>true},
 {k:'socialA',l:'Laboratorios · Ciencias Sociales',area:'Ciencias Sociales',format:'laboratorio',a:t=>true},
 {k:'artes',l:'Talleres · Artes',area:'Talleres articulados',format:'taller',a:t=>true},
 {k:'tecnologias',l:'Talleres · Tecnologías',area:'Formación General',format:'taller',a:t=>true},
 {k:'ef',l:'Talleres · Educación Física',area:'Talleres articulados',format:'taller',a:t=>true},
 {k:'foN3',l:'Formación Orientada · espacios curriculares',area:'Formación Orientada',format:'orientacion',a:t=>t>=3},
 {k:'otros',l:'Tutoría, EDI y otros formatos',area:'Otros formatos pedagógicos',format:'otros',a:t=>true}
];
function profileRow(k){return profileRows.find(r=>r.k===k)}
function mappedArea(s){
 const area=areaOf(s),n=String(s?.name||'').toLowerCase();
 if(CFG.model==='tecnica'){
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
function canAssign(slot,s){
 const level=slotYear(slot),term=slotTerm(slot),r=profileRow(String(slot).replace(/-(?:n|c)\d+$/,''));
 if(!s||!r||!level||level>LV||level<1)return [false,'Espacio curricular inexistente'];
 if(term && (term>TERMS||!r.a?.(term)))return [false,'Este cuatrimestre no pertenece al mapa de esta modalidad'];
 if(!canSeeRow(r,level))return [false,'Este espacio no está disponible en ese nivel'];
 if(s.year!==level)return [false,'La materia de Nivel '+s.year+' no puede ubicarse en Nivel '+level];
 if(r.annual&&term)return [false,'El espacio anual debe ubicarse en una celda de nivel'];
 if(!r.annual&&!term)return [false,'Este formato requiere un cuatrimestre'];
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
    }else html+='<div class="cell annual inactive">—</div>';
   }
  }else for(let t=1;t<=TERMS;t++){
   if(r.a(t)){
    const slot=r.k+'-c'+t,name=cur().phase2V28?.groups?.[slot]?.name||r.l+' · C'+t;
    html+='<div class="cell"><div class="drop" data-slot="'+slot+'"><strong data-space-name="'+slot+'">'+esc(name)+'</strong>'+placed(slot)+'</div></div>';
   }else html+='<div class="cell inactive">—</div>';
  }
  html+='</div>';
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
validateOffer=function(){
 const invalid=[];for(const [slot,ids] of Object.entries(cur().placements)){
  for(const id of ids){const s=byIdInMap(id);const [ok,msg]=canAssign(slot,s);if(!ok)invalid.push(msg)}
 }
 if(invalid.length){blocked(invalid[0]);return}
 cur().valid=true;save();renderOffer();
 toast('Mapa estructural guardado en el borrador. La homologación requiere revisar la norma y contenidos de esta modalidad.');
};
const modal=$id('rulesModal');
if(modal){
 modal.innerHTML='<div class="modal-box"><div class="row" style="justify-content:space-between"><h2>Reglas de composición</h2><button id="closeModalV2" class="btn">Cerrar</button></div><div class="modal-rule-note"><strong>'+esc(CFG.model==='tecnica'?'Educación Técnica · seis niveles · C1–C12':'BA +15 · cuatro niveles · C1–C8')+'</strong></div><p>'+esc(CFG.sourceNote)+'</p><p>Se respetan los niveles y el campo curricular de cada materia. Los espacios de integración y formativos se muestran como formatos diferentes. El mapa no se homologa automáticamente.</p><p>Las materias cuatrimestrales se asignan mediante el mismo drag and drop de V2; la distribución se replica al cuatrimestre par del nivel. Los espacios anuales ocupan ambos.</p></div>';
 modal.querySelector('#closeModalV2').onclick=()=>modal.classList.remove('open');
}
window.V2ModalMap={model:CFG.model,levels:LV,terms:TERMS,rowDefs,canAssign,assign:assignModal,move:moveModal,remove:removeModal};
})();