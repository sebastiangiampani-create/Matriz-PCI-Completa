(()=>{
  'use strict';

  const AREA='Orientación';
  const frame=()=>document.getElementById('pci');
  const norm=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  let selectedIndex=0;
  let mapObserver=null;

  function appWindow(){return frame()?.contentWindow||null}
  function save(w){
    try{if(typeof w.save==='function')w.save(0);else localStorage.setItem('pciAppV2',JSON.stringify(w.app))}catch{}
  }
  function uid(prefix,index){return `fo-${prefix}-${index+1}`}
  function defaultGroups(orientation){
    const placements=[
      ['laboratorio','Laboratorio Orientado 1',3,5,5],
      ['taller','Taller Orientado 1',3,6,6],
      ['laboratorio','Laboratorio Orientado 2',4,7,7],
      ['taller','Taller Orientado 2',4,8,8],
      ['laboratorio','Laboratorio Orientado 3',5,9,9],
      ['taller','Taller Orientado 3',5,10,10],
      ['proyecto','Proyecto de Vinculación con el Futuro',5,9,10]
    ];
    return placements.map(([kind,name,level,start,end],index)=>({
      uid:uid(kind,index),name,type:kind==='proyecto'?'proyecto_vinculacion':`${kind}_orientado`,kind,
      component:'formacion_orientada',orientation,level,termStart:start,termEnd:end,term:String(start),
      weeklyHours:0,hours:0,hoursMode:'uniform',hoursByTerm:Object.fromEntries(Array.from({length:end-start+1},(_,i)=>[start+i,0])),
      subjects:[],linkedSpaces:[],items:[],objective:'',context:'',custom:true,elective:false
    }));
  }
  function ensureStructure(w,orientation){
    if(!w.app||typeof w.app!=='object')return null;
    if(!w.app.areas)w.app.areas={};
    const name=String(orientation||w.app.orientation?.name||'Orientación sin definir').trim()||'Orientación sin definir';
    w.app.orientation={...(w.app.orientation||{}),name,component:'formacion_orientada',updatedAt:new Date().toISOString()};
    if(!w.app.areas[AREA])w.app.areas[AREA]={closed:false,groups:[]};
    const data=w.app.areas[AREA];if(!Array.isArray(data.groups))data.groups=[];
    const required=defaultGroups(name);
    required.forEach((template,index)=>{
      const existing=data.groups.find(g=>g.uid===template.uid)||data.groups.find(g=>g.kind===template.kind&&Number(String(g.uid||'').split('-').pop())===index+1);
      if(!existing)data.groups.push(template);
      else{existing.orientation=name;existing.component='formacion_orientada';existing.kind=existing.kind||template.kind;existing.type=existing.type||template.type;existing.uid=existing.uid||template.uid;if(!Array.isArray(existing.subjects))existing.subjects=[];if(!Array.isArray(existing.linkedSpaces))existing.linkedSpaces=[]}
    });
    const project=data.groups.find(g=>g.kind==='proyecto'||norm(g.type).includes('vinculacion'));
    if(project){project.kind='proyecto';project.type='proyecto_vinculacion';project.component='formacion_orientada';project.level=5;project.termStart=9;project.termEnd=10;project.term='9'}
    save(w);return data.groups;
  }
  function groups(w){return w?.app?.areas?.[AREA]?.groups||[]}
  function activeTerms(group){const start=Math.max(1,Math.min(10,Number(group.termStart||group.term||1))),end=Math.max(start,Math.min(10,Number(group.termEnd||group.term||start)));return {start,end}}
  function planRows(w){if(Array.isArray(w.PCI_STUDY_PLAN))return w.PCI_STUDY_PLAN;try{return JSON.parse(localStorage.getItem('pciStudyPlanV1')||'[]')}catch{return []}}
  function subjectRows(w,group){
    const orientation=w.app?.orientation?.name||'';
    return planRows(w).filter(row=>Number(row.year)===Number(group.level)&&(
      norm(row.component).includes('orient')||norm(row.area)===norm(AREA)||norm(row.area)===norm(orientation)
    ));
  }
  function targetHours(w,group){const selected=new Set((group.subjects||[]).map(String));return subjectRows(w,group).filter(row=>selected.has(String(row.id))||selected.has(String(row.subject))).reduce((sum,row)=>sum+(Number(row.hours)||0),0)}
  function counts(list){return {labs:list.filter(g=>g.kind==='laboratorio').length,workshops:list.filter(g=>g.kind==='taller').length,projects:list.filter(g=>g.kind==='proyecto').length}}
  function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
  function optionTerms(current){return Array.from({length:10},(_,i)=>`<option value="${i+1}" ${Number(current)===i+1?'selected':''}>C${i+1}</option>`).join('')}
  function optionLevels(current){return Array.from({length:5},(_,i)=>`<option value="${i+1}" ${Number(current)===i+1?'selected':''}>Nivel ${i+1}</option>`).join('')}

  function renderEditor(){
    const w=appWindow(),box=document.getElementById('foEditor');if(!w||!box)return;
    const list=groups(w),group=list[selectedIndex];
    if(!group){box.innerHTML='<p>No hay espacios orientados creados.</p>';return}
    const project=group.kind==='proyecto';
    const availableSubjects=subjectRows(w,group),selected=new Set((group.subjects||[]).map(String));
    const linkable=list.filter(g=>g.kind!=='proyecto');const linked=new Set((group.linkedSpaces||[]).map(String));
    box.innerHTML=`<h3>${esc(group.name)}</h3>
      <div class="fo-grid">
        <label>Nombre<input id="foName" value="${esc(group.name)}"></label>
        <label>Nivel<select id="foLevel" ${project?'disabled':''}>${optionLevels(group.level)}</select></label>
        <label>Cuatrimestre inicial<select id="foStart" ${project?'disabled':''}>${optionTerms(group.termStart)}</select></label>
        <label>Cuatrimestre final<select id="foEnd" ${project?'disabled':''}>${optionTerms(group.termEnd)}</select></label>
        <label>HC cargadas<input id="foHours" type="number" min="0" step="0.5" value="${Number(group.weeklyHours||0)}"></label>
      </div>
      <div class="fo-subtitle">Materias NES vinculadas · objetivo normativo: <strong>${targetHours(w,group)} HC</strong></div>
      <div class="fo-checks">${availableSubjects.length?availableSubjects.map(row=>`<label><input type="checkbox" data-fo-subject="${esc(row.id)}" ${selected.has(String(row.id))||selected.has(String(row.subject))?'checked':''}> ${esc(row.subject)} · ${row.hours} HC</label>`).join(''):'<span class="fo-muted">Cargá materias de Formación Orientada en el Plan de Estudios para este nivel.</span>'}</div>
      ${project?`<div class="fo-subtitle">Espacios que articulan con el proyecto</div><div class="fo-checks">${linkable.map(g=>`<label><input type="checkbox" data-fo-link="${esc(g.uid)}" ${linked.has(String(g.uid))?'checked':''}> ${esc(g.name)}</label>`).join('')}</div>`:''}
      <div class="fo-actions"><button id="foSave" class="fo-primary">Guardar espacio</button></div>`;
    document.getElementById('foSave').onclick=()=>{
      group.name=document.getElementById('foName').value.trim()||group.name;
      if(!project){group.level=Number(document.getElementById('foLevel').value);group.termStart=Number(document.getElementById('foStart').value);group.termEnd=Math.max(group.termStart,Number(document.getElementById('foEnd').value))}else{group.level=5;group.termStart=9;group.termEnd=10}
      group.term=String(group.termStart);group.weeklyHours=Math.max(0,Number(document.getElementById('foHours').value)||0);group.hours=group.weeklyHours;
      group.subjects=[...document.querySelectorAll('[data-fo-subject]:checked')].map(el=>el.dataset.foSubject);
      if(project)group.linkedSpaces=[...document.querySelectorAll('[data-fo-link]:checked')].map(el=>el.dataset.foLink);
      save(w);renderModal();renderOrientationRow();
    };
  }
  function renderModal(){
    const w=appWindow();if(!w)return;
    const list=groups(w),name=w.app?.orientation?.name||'',stats=counts(list);
    const nameInput=document.getElementById('foOrientationName');if(nameInput)nameInput.value=name;
    const status=document.getElementById('foStatus');if(status)status.innerHTML=`<strong>${esc(name||'Orientación sin definir')}</strong> · ${stats.labs}/3 laboratorios · ${stats.workshops}/3 talleres · ${stats.projects}/1 proyecto`;
    const nav=document.getElementById('foSpaces');if(nav)nav.innerHTML=list.map((g,i)=>`<button data-fo-index="${i}" class="${i===selectedIndex?'active':''}">${esc(g.name)}<small>Nivel ${g.level} · C${g.termStart}${g.termEnd!==g.termStart?`–C${g.termEnd}`:''}</small></button>`).join('');
    document.querySelectorAll('[data-fo-index]').forEach(btn=>btn.onclick=()=>{selectedIndex=Number(btn.dataset.foIndex);renderModal()});
    renderEditor();
  }
  function openModal(){document.getElementById('foModal')?.classList.add('open');renderModal()}
  function closeModal(){document.getElementById('foModal')?.classList.remove('open')}

  function mountParentUI(){
    if(document.getElementById('foModal'))return;
    const style=document.createElement('style');style.textContent=`.fo-fab{position:fixed;left:225px;bottom:16px;z-index:9998;border:0;border-radius:14px;padding:11px 14px;background:#83ded3;color:#15374a;font:900 14px system-ui;box-shadow:0 8px 24px #0003}.fo-modal{position:fixed;inset:0;z-index:10001;display:none;background:#0008;padding:18px;overflow:auto;font-family:system-ui;color:#15374a}.fo-modal.open{display:grid;place-items:center}.fo-card{width:min(1050px,100%);background:#fff;border-radius:20px;padding:18px}.fo-head{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.fo-head h2{margin:0 auto 0 0}.fo-head input{min-width:280px;border:1px solid #dbe5e8;border-radius:10px;padding:9px}.fo-layout{display:grid;grid-template-columns:300px 1fr;gap:12px;margin-top:12px}.fo-spaces{display:grid;gap:7px;align-content:start}.fo-spaces button{text-align:left;border:1px solid #dbe5e8;border-radius:11px;padding:9px;background:#fff;font-weight:800}.fo-spaces button.active{outline:3px solid #83ded3}.fo-spaces small{display:block;color:#687985;margin-top:3px}.fo-editor{border:1px solid #dbe5e8;border-radius:14px;padding:14px}.fo-editor h3{margin-top:0}.fo-grid{display:grid;grid-template-columns:repeat(5,minmax(110px,1fr));gap:8px}.fo-grid label{display:grid;gap:4px;font-size:.78rem;font-weight:800}.fo-grid input,.fo-grid select{width:100%;border:1px solid #dbe5e8;border-radius:9px;padding:8px}.fo-subtitle{font-weight:900;margin:14px 0 7px}.fo-checks{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:7px;border:1px solid #e4ecee;border-radius:11px;padding:10px}.fo-checks label{font-size:.82rem}.fo-muted{color:#687985}.fo-actions{display:flex;justify-content:flex-end;margin-top:12px}.fo-card button{border:0;border-radius:11px;padding:9px 12px;font-weight:850;background:#e7edef;cursor:pointer}.fo-card .fo-primary{background:#15374a;color:#fff}.fo-status{margin-top:10px;padding:10px;border-radius:11px;background:#eef6f7}@media(max-width:800px){.fo-fab{left:12px;bottom:66px}.fo-layout{grid-template-columns:1fr}.fo-grid{grid-template-columns:repeat(2,1fr)}.fo-head input{min-width:0;width:100%}}`;
    document.head.appendChild(style);
    const button=document.createElement('button');button.className='fo-fab';button.textContent='Formación Orientada';button.onclick=openModal;
    const modal=document.createElement('section');modal.id='foModal';modal.className='fo-modal';modal.innerHTML=`<div class="fo-card"><div class="fo-head"><h2>Constructor de Formación Orientada</h2><input id="foOrientationName" list="foOrientations" placeholder="Nombre de la orientación"><datalist id="foOrientations"><option value="Ciencias Sociales"><option value="Ciencias Naturales"><option value="Economía y Administración"><option value="Comunicación"><option value="Informática"><option value="Arte"></datalist><button id="foBuild" class="fo-primary">Crear/completar estructura</button><button id="foClose">Cerrar</button></div><div id="foStatus" class="fo-status"></div><div class="fo-layout"><nav id="foSpaces" class="fo-spaces"></nav><section id="foEditor" class="fo-editor"></section></div></div>`;
    document.body.append(button,modal);
    document.getElementById('foClose').onclick=closeModal;
    document.getElementById('foBuild').onclick=()=>{const w=appWindow();if(!w)return;ensureStructure(w,document.getElementById('foOrientationName').value);selectedIndex=0;renderModal();renderOrientationRow()};
  }

  function injectMapStyles(d){if(d.getElementById('fo-map-styles'))return;const style=d.createElement('style');style.id='fo-map-styles';style.textContent='.fo-piece{border-color:#7bb8d8;background:#eef8ff}.fo-piece small{color:#526e80}.fo-drop{background:#eef8ff!important}';d.head.appendChild(style)}
  function renderOrientationRow(){
    const w=appWindow(),d=frame()?.contentDocument,grid=d?.getElementById('integratedGrid');if(!w||!d||!grid)return;
    injectMapStyles(d);grid.querySelectorAll('[data-fo-row]').forEach(el=>el.remove());
    const list=groups(w);if(!list.length)return;
    const area=document.createElement('div');area.className='integrated-cell integrated-area';area.dataset.foRow='1';area.textContent=`Orientación · ${w.app?.orientation?.name||''}`;grid.appendChild(area);
    for(let term=1;term<=10;term++){
      const cell=document.createElement('div');cell.className='integrated-cell';cell.dataset.foRow='1';cell.dataset.foTerm=String(term);
      const matching=list.map((group,index)=>({group,index,...activeTerms(group)})).filter(x=>term>=x.start&&term<=x.end);
      cell.innerHTML=matching.length?matching.map(({group,index})=>`<div class="integrated-piece fo-piece" draggable="true" data-fo-card="${index}"><strong>${esc(group.name)}</strong><small>${group.kind==='proyecto'?'Proyecto anual':group.kind==='laboratorio'?'Laboratorio':'Taller'} · ${Number(group.weeklyHours||0)} HC · ${(group.subjects||[]).length} materias</small></div>`).join(''):'<span class="integrated-empty">Sin espacios</span>';
      cell.ondragover=e=>{e.preventDefault();cell.classList.add('fo-drop')};cell.ondragleave=()=>cell.classList.remove('fo-drop');cell.ondrop=e=>{e.preventDefault();cell.classList.remove('fo-drop');const index=Number(e.dataTransfer.getData('application/x-fo-index'));const group=list[index];if(!group||group.kind==='proyecto')return;const duration=Math.max(0,Number(group.termEnd)-Number(group.termStart));group.termStart=term;group.termEnd=Math.min(10,term+duration);group.level=Math.ceil(term/2);group.term=String(term);save(w);renderOrientationRow();renderModal()};
      grid.appendChild(cell);
    }
    grid.querySelectorAll('[data-fo-card]').forEach(card=>{card.ondragstart=e=>e.dataTransfer.setData('application/x-fo-index',card.dataset.foCard);card.onclick=()=>{selectedIndex=Number(card.dataset.foCard);openModal()}});
  }
  function watchMap(){
    const grid=frame()?.contentDocument?.getElementById('integratedGrid');if(!grid)return;
    if(mapObserver)mapObserver.disconnect();mapObserver=new MutationObserver(()=>{if(!grid.querySelector('[data-fo-row]'))renderOrientationRow()});mapObserver.observe(grid,{childList:true});renderOrientationRow();
  }
  function start(){mountParentUI();const f=frame();f?.addEventListener('load',()=>setTimeout(watchMap,1000));setInterval(()=>{try{if(frame()?.contentDocument?.getElementById('integratedGrid'))watchMap()}catch{}},2000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();