(()=>{
  'use strict';

  const APP_KEY='pciAppV2';
  const ACTIVE_KEY='pciActiveWorkspaceV1';
  const SNAPSHOT_PREFIX='pciWorkspaceV1:';
  const MODE_KEY='pciWorkspaceModeV1';
  const frame=()=>document.getElementById('pci');
  const clone=value=>JSON.parse(JSON.stringify(value));
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  const WORKSPACES=[
    {id:'model-1',name:'Modelo 1',code:'MOD-001',kind:'model',readOnly:true,description:'Ejemplo institucional cerrado para explorar y reutilizar.'},
    {id:'model-2',name:'Modelo 2',code:'MOD-002',kind:'model',readOnly:true,description:'Segundo ejemplo cerrado, con otra distribución curricular.'},
    {id:'builder-assisted',name:'Construcción desde modelos',code:'PCI-BASE',kind:'assisted',description:'Importá el PCI completo o áreas seleccionadas de los modelos.'},
    {id:'builder-zero',name:'Construcción desde cero',code:'PCI-CERO',kind:'blank',description:'Espacio completamente vacío, con todas las reglas activas.'},
    {id:'school-1',name:'Escuela 1',code:'PCI-101',kind:'school',description:'Proyecto institucional editable e independiente.'},
    {id:'school-2',name:'Escuela 2',code:'PCI-102',kind:'school',description:'Proyecto institucional editable e independiente.'},
    {id:'school-3',name:'Escuela 3',code:'PCI-103',kind:'school',description:'Proyecto institucional editable e independiente.'},
    {id:'school-4',name:'Escuela 4',code:'PCI-104',kind:'school',description:'Proyecto institucional editable e independiente.'}
  ];

  const AREA_CONFIG=[
    ['Lengua y Literatura','nivel',5],['Matemática','nivel',5],['Lenguas Adicionales','nivel',5],
    ['Ciencias Sociales','laboratorio',9],['Ciencias Naturales','laboratorio',9],
    ['Artes','taller',6],['Tecnologías','taller',6],['Educación Física','taller',10]
  ];

  function workspace(id){return WORKSPACES.find(item=>item.id===id)||WORKSPACES[4]}
  function snapshotKey(id){return `${SNAPSHOT_PREFIX}${id}`}
  function readJSON(key,fallback=null){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
  function writeJSON(key,value){localStorage.setItem(key,JSON.stringify(value))}
  function activeId(){return localStorage.getItem(ACTIVE_KEY)||'school-1'}
  function activeWorkspace(){return workspace(activeId())}

  function termObject(start,end,hours=0){return Object.fromEntries(Array.from({length:end-start+1},(_,i)=>[start+i,hours]))}
  function makeGroup({uid,name,type,kind,level,start,end,component='formacion_general',orientation='',custom=false}){
    return {uid,name,type:type||kind||'',kind:kind||type||'',component,orientation,level,termStart:start,termEnd:end,term:String(start),weeklyHours:0,hours:0,hoursMode:'uniform',hoursByTerm:termObject(start,end),subjects:[],linkedSpaces:[],items:[],objective:'',context:'',custom,elective:false};
  }
  function annualGroups(area){return Array.from({length:5},(_,i)=>makeGroup({uid:`${area}-nivel-${i+1}`,name:`${area} · Nivel ${i+1}`,type:'troncal',kind:'troncal',level:i+1,start:(i*2)+1,end:(i*2)+2}));}
  function distributedGroups(area,kind,count,variant){
    const sequences=variant===1?[1,2,3,4,5,6,7,8,9,10]:[2,1,4,3,6,5,8,7,10,9];
    return Array.from({length:count},(_,i)=>{const term=sequences[i%10],level=Math.ceil(term/2);return makeGroup({uid:`${area}-${kind}-${i+1}`,name:`${kind==='laboratorio'?'Laboratorio':'Taller'} ${area} ${i+1}`,type:kind,kind,level,start:term,end:term,custom:false})});
  }
  function orientationGroups(variant){
    const orientation=variant===1?'Ciencias Sociales':'Comunicación';
    const placements=variant===1?[
      ['laboratorio',3,5],['taller',3,6],['laboratorio',4,7],['taller',4,8],['laboratorio',5,9],['taller',5,10]
    ]:[
      ['taller',3,5],['laboratorio',3,6],['taller',4,7],['laboratorio',4,8],['taller',5,9],['laboratorio',5,10]
    ];
    const groups=placements.map(([kind,level,term],i)=>makeGroup({uid:`modelo-${variant}-fo-${kind}-${i+1}`,name:`${kind==='laboratorio'?'Laboratorio':'Taller'} Orientado ${Math.floor(i/2)+1}`,type:`${kind}_orientado`,kind,level,start:term,end:term,component:'formacion_orientada',orientation,custom:true}));
    groups.push(makeGroup({uid:`modelo-${variant}-fo-proyecto`,name:'Proyecto de Vinculación con el Futuro',type:'proyecto_vinculacion',kind:'proyecto',level:5,start:9,end:10,component:'formacion_orientada',orientation,custom:true}));
    return {orientation:{name:orientation,component:'formacion_orientada',model:true},groups};
  }
  function buildModel(variant){
    const areas={};
    AREA_CONFIG.forEach(([area,kind,count])=>{
      const groups=kind==='nivel'?annualGroups(area):distributedGroups(area,kind,count,variant);
      groups.forEach((group,index)=>{group.objective=variant===1?'Organización curricular de referencia.':'Propuesta alternativa de organización curricular.';group.context=kind==='laboratorio'?'Contexto problematizador de ejemplo.':'';group.modelExample=true;group.modelOrder=index+1});
      areas[area]={closed:true,groups};
    });
    const oriented=orientationGroups(variant);areas['Orientación']={closed:true,groups:oriented.groups};
    return {schemaVersion:6,areas,current:null,orientation:oriented.orientation,workspace:{id:`model-${variant}`,readOnly:true,code:`MOD-00${variant}`},modelStatus:'closed',createdAt:new Date().toISOString()};
  }
  function blankApp(item){return {schemaVersion:6,areas:{},current:null,workspace:{id:item.id,name:item.name,code:item.code,kind:item.kind,readOnly:false},createdAt:new Date().toISOString()}}

  function ensureSnapshots(){
    if(!localStorage.getItem(snapshotKey('model-1')))writeJSON(snapshotKey('model-1'),buildModel(1));
    if(!localStorage.getItem(snapshotKey('model-2')))writeJSON(snapshotKey('model-2'),buildModel(2));
    const existing=readJSON(APP_KEY,{areas:{}});
    if(!localStorage.getItem(snapshotKey('school-1'))&&Object.keys(existing?.areas||{}).length){
      existing.workspace={id:'school-1',name:'Escuela 1',code:'PCI-101',kind:'school',readOnly:false};
      writeJSON(snapshotKey('school-1'),existing);
    }
    WORKSPACES.filter(item=>!item.readOnly).forEach(item=>{if(!localStorage.getItem(snapshotKey(item.id)))writeJSON(snapshotKey(item.id),blankApp(item))});
    if(!localStorage.getItem(ACTIVE_KEY))localStorage.setItem(ACTIVE_KEY,'school-1');
  }

  function persistCurrent(){
    const current=activeWorkspace();if(current.readOnly)return;
    const app=readJSON(APP_KEY,null);if(!app)return;
    app.workspace={id:current.id,name:current.name,code:current.code,kind:current.kind,readOnly:false};
    app.updatedAt=new Date().toISOString();
    writeJSON(snapshotKey(current.id),app);
  }
  function loadWorkspace(id){
    persistCurrent();
    const item=workspace(id);let app=readJSON(snapshotKey(id),null);
    if(!app)app=item.readOnly?buildModel(id==='model-2'?2:1):blankApp(item);
    app.workspace={id:item.id,name:item.name,code:item.code,kind:item.kind,readOnly:item.readOnly};
    writeJSON(APP_KEY,app);localStorage.setItem(ACTIVE_KEY,item.id);writeJSON(MODE_KEY,{...item,openedAt:new Date().toISOString()});
    closeHub();reloadFrame();renderToolbar();renderHub();
  }
  function reloadFrame(){const f=frame();if(f)f.src=`app.html?workspace=${encodeURIComponent(activeId())}&v=${Date.now()}`}

  function stats(id){
    const app=readJSON(snapshotKey(id),{areas:{}}),areas=Object.keys(app?.areas||{}),groups=areas.reduce((n,area)=>n+(app.areas[area]?.groups?.length||0),0),contents=areas.reduce((n,area)=>n+(app.areas[area]?.groups||[]).reduce((m,g)=>m+(g.items?.length||0),0),0);
    return {areas:areas.length,groups,contents,updated:app?.updatedAt||app?.createdAt||null};
  }

  function applyReadOnly(){
    const item=activeWorkspace(),f=frame(),d=f?.contentDocument,w=f?.contentWindow;if(!d||!w)return;
    document.querySelectorAll('.admin-fab,.fo-fab,.pci-import-fab').forEach(el=>el.hidden=!!item.readOnly);
    d.body.classList.toggle('pci-readonly',!!item.readOnly);
    let style=d.getElementById('pci-readonly-style');
    if(!style){style=d.createElement('style');style.id='pci-readonly-style';style.textContent=`body.pci-readonly input,body.pci-readonly textarea,body.pci-readonly select{pointer-events:none!important;opacity:.72}body.pci-readonly #save,body.pci-readonly .remove,body.pci-readonly .group-actions,body.pci-readonly .selection-bar,body.pci-readonly .board-tools{display:none!important}body.pci-readonly .content,body.pci-readonly .integrated-piece{cursor:default!important}.pci-model-banner{position:sticky;top:58px;z-index:29;padding:9px 12px;background:#fff3d8;color:#8a5b00;border-bottom:1px solid #e7d29e;font-weight:900;text-align:center}`;d.head.appendChild(style)}
    d.getElementById('pciModelBanner')?.remove();
    if(item.readOnly){
      const banner=d.createElement('div');banner.id='pciModelBanner';banner.className='pci-model-banner';banner.textContent=`${item.name} · ${item.code} · Solo lectura. Podés explorarlo o importarlo desde Construcción desde modelos.`;d.body.prepend(banner);
      ['beforeinput','input','change','drop','dragstart'].forEach(type=>d.addEventListener(type,event=>{if(d.body.classList.contains('pci-readonly')){event.preventDefault();event.stopImmediatePropagation()}},true));
      try{w.save=()=>{};w.app=clone(readJSON(snapshotKey(item.id),w.app))}catch{}
    }
  }

  function areaOptions(selected=[]){
    const all=[...AREA_CONFIG.map(x=>x[0]),'Orientación'];
    return all.map(area=>`<label><input type="checkbox" data-import-area="${esc(area)}" ${selected.includes(area)?'checked':''}> ${esc(area)}</label>`).join('');
  }
  function openImport(){document.getElementById('pciImportModal')?.classList.add('open')}
  function closeImport(){document.getElementById('pciImportModal')?.classList.remove('open')}
  function importFromModel(){
    const sourceId=document.getElementById('pciImportSource').value,source=readJSON(snapshotKey(sourceId),null),current=readJSON(APP_KEY,blankApp(activeWorkspace()));if(!source)return;
    const selected=[...document.querySelectorAll('[data-import-area]:checked')].map(el=>el.dataset.importArea);
    if(!selected.length){setImportStatus('Seleccioná al menos un área.','bad');return}
    if(!current.areas)current.areas={};
    selected.forEach(area=>{if(source.areas?.[area])current.areas[area]=clone(source.areas[area])});
    if(selected.includes('Orientación')&&source.orientation)current.orientation=clone(source.orientation);
    current.workspace={id:activeId(),name:activeWorkspace().name,code:activeWorkspace().code,kind:'assisted',readOnly:false};current.importHistory=current.importHistory||[];current.importHistory.push({source:sourceId,areas:selected,date:new Date().toISOString()});
    writeJSON(APP_KEY,current);writeJSON(snapshotKey(activeId()),current);setImportStatus(`Importadas ${selected.length} áreas desde ${workspace(sourceId).name}.`,'ok');setTimeout(()=>{closeImport();reloadFrame()},500);
  }
  function setImportStatus(text,tone){const el=document.getElementById('pciImportStatus');if(el){el.textContent=text;el.className=`pci-import-status ${tone||''}`}}

  function renderHub(){
    const grid=document.getElementById('pciHubGrid');if(!grid)return;
    grid.innerHTML=WORKSPACES.map(item=>{const s=stats(item.id),active=item.id===activeId();return `<article class="pci-hub-card ${item.kind} ${active?'active':''}"><div class="pci-hub-card-head"><span>${item.kind==='model'?'Modelo':item.kind==='school'?'Escuela':item.kind==='assisted'?'Constructor asistido':'Constructor vacío'}</span><strong>${esc(item.code)}</strong></div><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><div class="pci-hub-stats"><span>${s.areas} áreas</span><span>${s.groups} espacios</span><span>${s.contents} asignaciones</span></div><button data-workspace-open="${item.id}" class="${active?'active':''}">${active?'Continuar':'Abrir'}${item.readOnly?' · solo lectura':''}</button></article>`}).join('');
    document.querySelectorAll('[data-workspace-open]').forEach(button=>button.onclick=()=>loadWorkspace(button.dataset.workspaceOpen));
  }
  function openHub(){persistCurrent();renderHub();document.getElementById('pciHub')?.classList.add('open')}
  function closeHub(){document.getElementById('pciHub')?.classList.remove('open')}
  function renderToolbar(){
    const item=activeWorkspace(),badge=document.getElementById('pciWorkspaceBadge'),importButton=document.getElementById('pciImportButton');
    if(badge)badge.innerHTML=`<strong>${esc(item.name)}</strong><span>${esc(item.code)}</span>${item.readOnly?'<em>Solo lectura</em>':''}`;
    if(importButton)importButton.hidden=item.kind!=='assisted'||item.readOnly;
    document.querySelectorAll('.admin-fab,.fo-fab').forEach(el=>el.hidden=!!item.readOnly);
  }

  function mount(){
    ensureSnapshots();
    const current=readJSON(snapshotKey(activeId()),blankApp(activeWorkspace()));writeJSON(APP_KEY,current);
    const style=document.createElement('style');style.textContent=`.pci-hub-button{position:fixed;top:12px;left:12px;z-index:12000;border:0;border-radius:12px;padding:9px 12px;background:#15374a;color:#fff;font:900 13px system-ui;box-shadow:0 6px 20px #0003}.pci-workspace-badge{position:fixed;top:12px;left:118px;z-index:11999;display:flex;gap:8px;align-items:center;background:#fff;border:1px solid #dbe5e8;border-radius:12px;padding:7px 10px;font:13px system-ui;color:#15374a;box-shadow:0 4px 14px #0001}.pci-workspace-badge span{font-weight:900;color:#687985}.pci-workspace-badge em{font-style:normal;background:#fff3d8;color:#8a5b00;border-radius:999px;padding:3px 7px;font-weight:900}.pci-import-fab{position:fixed;top:12px;right:12px;z-index:12000;border:0;border-radius:12px;padding:9px 12px;background:#83ded3;color:#15374a;font:900 13px system-ui}.pci-hub{position:fixed;inset:0;z-index:13000;display:none;background:#eef3f4;padding:22px;overflow:auto;font-family:system-ui;color:#15374a}.pci-hub.open{display:block}.pci-hub-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;max-width:1280px;margin:auto}.pci-hub-head h1{margin:0 auto 0 0}.pci-hub-head button{border:0;border-radius:12px;padding:10px 13px;font-weight:900}.pci-hub-grid{max-width:1280px;margin:20px auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(255px,1fr));gap:13px}.pci-hub-card{background:#fff;border:2px solid transparent;border-radius:18px;padding:16px;box-shadow:0 6px 20px #15374a12}.pci-hub-card.active{border-color:#83ded3}.pci-hub-card.model{background:#fffdf7}.pci-hub-card.assisted{background:#f1fbf9}.pci-hub-card-head{display:flex;justify-content:space-between;gap:8px;color:#687985;font-size:.78rem;font-weight:900;text-transform:uppercase}.pci-hub-card h3{margin:12px 0 6px}.pci-hub-card p{min-height:58px;color:#687985;font-size:.88rem}.pci-hub-stats{display:flex;gap:7px;flex-wrap:wrap;margin:11px 0}.pci-hub-stats span{background:#edf3f4;border-radius:999px;padding:5px 8px;font-size:.72rem;font-weight:850}.pci-hub-card button{width:100%;border:0;border-radius:11px;padding:10px;background:#e7edef;color:#15374a;font-weight:900}.pci-hub-card button.active{background:#15374a;color:#fff}.pci-import-modal{position:fixed;inset:0;z-index:14000;display:none;background:#0008;padding:20px;overflow:auto;font-family:system-ui;color:#15374a}.pci-import-modal.open{display:grid;place-items:center}.pci-import-card{width:min(760px,100%);background:#fff;border-radius:20px;padding:18px}.pci-import-card h2{margin-top:0}.pci-import-card select{width:100%;border:1px solid #dbe5e8;border-radius:10px;padding:9px}.pci-import-areas{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:7px;margin:12px 0;border:1px solid #dbe5e8;border-radius:13px;padding:12px}.pci-import-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}.pci-import-actions button{border:0;border-radius:11px;padding:9px 12px;font-weight:900}.pci-import-primary{background:#15374a;color:#fff}.pci-import-status{margin:10px 0;padding:9px;border-radius:10px;background:#eef6f7}.pci-import-status.bad{background:#ffe9ee;color:#a4263d}.pci-import-status.ok{background:#e5f6ef;color:#167557}@media(max-width:720px){.pci-workspace-badge{left:104px;right:8px}.pci-workspace-badge strong{max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pci-import-fab{top:auto;bottom:118px}.pci-hub{padding:14px}}`;
    document.head.appendChild(style);
    const hubButton=document.createElement('button');hubButton.className='pci-hub-button';hubButton.textContent='Inicio PCI';hubButton.onclick=openHub;
    const badge=document.createElement('div');badge.id='pciWorkspaceBadge';badge.className='pci-workspace-badge';
    const importButton=document.createElement('button');importButton.id='pciImportButton';importButton.className='pci-import-fab';importButton.textContent='Importar desde modelos';importButton.onclick=openImport;
    const hub=document.createElement('section');hub.id='pciHub';hub.className='pci-hub';hub.innerHTML=`<div class="pci-hub-head"><h1>Plataforma PCI · Espacios de trabajo</h1><button id="pciHubClose">Volver al proyecto activo</button></div><div id="pciHubGrid" class="pci-hub-grid"></div>`;
    const importModal=document.createElement('section');importModal.id='pciImportModal';importModal.className='pci-import-modal';importModal.innerHTML=`<div class="pci-import-card"><h2>Importar desde modelos cerrados</h2><label>Modelo de origen<select id="pciImportSource"><option value="model-1">Modelo 1</option><option value="model-2">Modelo 2</option></select></label><div class="pci-import-areas">${areaOptions()}</div><div id="pciImportStatus" class="pci-import-status">Elegí las áreas que querés incorporar. Las demás áreas del proyecto se conservan.</div><div class="pci-import-actions"><button id="pciImportAll">Seleccionar todo</button><button id="pciImportNone">Limpiar</button><button id="pciImportCancel">Cancelar</button><button id="pciImportApply" class="pci-import-primary">Importar selección</button></div></div>`;
    document.body.append(hubButton,badge,importButton,hub,importModal);
    document.getElementById('pciHubClose').onclick=closeHub;document.getElementById('pciImportCancel').onclick=closeImport;document.getElementById('pciImportApply').onclick=importFromModel;document.getElementById('pciImportAll').onclick=()=>document.querySelectorAll('[data-import-area]').forEach(el=>el.checked=true);document.getElementById('pciImportNone').onclick=()=>document.querySelectorAll('[data-import-area]').forEach(el=>el.checked=false);
    frame()?.addEventListener('load',()=>setTimeout(()=>{applyReadOnly();renderToolbar()},900));
    renderToolbar();renderHub();setInterval(()=>{persistCurrent();renderToolbar();if(document.getElementById('pciHub')?.classList.contains('open'))renderHub();if(activeWorkspace().readOnly)writeJSON(APP_KEY,readJSON(snapshotKey(activeId()),{}))},1200);
    window.addEventListener('beforeunload',persistCurrent);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();