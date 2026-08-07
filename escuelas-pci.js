(()=>{
  'use strict';
  const frame=()=>document.getElementById('pci');
  const ACTIVE_KEY='pciActiveSchoolV1';
  const NAMES_KEY='pciSchoolNamesV1';
  const STATE_PREFIX='pciSchoolStateV1:';
  const SCHOOLS=[
    {code:'PCI-101',fallback:'Escuela 1'},
    {code:'PCI-102',fallback:'Escuela 2'},
    {code:'PCI-103',fallback:'Escuela 3'},
    {code:'PCI-104',fallback:'Escuela 4'}
  ];
  let overlay=null;

  function names(){try{return {...JSON.parse(localStorage.getItem(NAMES_KEY)||'{}')}}catch{return {}}}
  function schoolName(code){const item=SCHOOLS.find(x=>x.code===code);return names()[code]||item?.fallback||code}
  function activeCode(){return localStorage.getItem(ACTIVE_KEY)||''}
  function stateKey(code){return STATE_PREFIX+code}
  function emptyState(){return JSON.stringify({areas:{},current:null,schemaVersion:7})}
  function currentAppState(){return localStorage.getItem('pciAppV2')||emptyState()}
  function hasMeaningfulState(raw){try{const value=JSON.parse(raw||'{}');return !!Object.keys(value?.areas||{}).length}catch{return false}}
  function saveActiveSnapshot(){const code=activeCode();if(!code)return;localStorage.setItem(stateKey(code),currentAppState())}
  function setName(code,value){const all=names(),clean=String(value||'').trim();if(clean)all[code]=clean;else delete all[code];localStorage.setItem(NAMES_KEY,JSON.stringify(all));decorateFrame();renderOverlay()}

  function selectSchool(code){
    if(!SCHOOLS.some(item=>item.code===code))return;
    const previous=activeCode();
    if(previous)saveActiveSnapshot();
    const existing=localStorage.getItem(stateKey(code));
    if(!existing&&!previous&&hasMeaningfulState(currentAppState()))localStorage.setItem(stateKey(code),currentAppState());
    localStorage.setItem(ACTIVE_KEY,code);
    localStorage.setItem('pciAppV2',localStorage.getItem(stateKey(code))||emptyState());
    closeOverlay();
    const f=frame();
    if(f)f.src=`app.html?school=${encodeURIComponent(code)}&t=${Date.now()}`;
  }

  function renderOverlay(){
    if(!overlay)return;
    const active=activeCode();
    overlay.querySelector('[data-school-list]').innerHTML=SCHOOLS.map(item=>{
      const name=schoolName(item.code),selected=active===item.code;
      return `<article class="school-card ${selected?'selected':''}" data-school-card="${item.code}" tabindex="0" role="button" aria-label="Entrar a ${item.code} ${escapeHtml(name)}">
        <div class="school-open"><strong>${item.code}</strong><span>${escapeHtml(name)}</span>${selected?'<em>PCI activo</em>':''}</div>
        <label>Nombre de la escuela<input data-school-name="${item.code}" value="${escapeHtml(name)}" aria-label="Nombre de ${item.code}"></label>
        <button type="button" class="school-enter" data-school-open="${item.code}">Entrar</button>
      </article>`;
    }).join('');
    overlay.querySelectorAll('[data-school-card]').forEach(card=>{
      card.onclick=event=>{if(event.target.closest('input,button,label'))return;selectSchool(card.dataset.schoolCard)};
      card.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectSchool(card.dataset.schoolCard)}};
    });
    overlay.querySelectorAll('[data-school-open]').forEach(button=>button.onclick=event=>{event.stopPropagation();selectSchool(button.dataset.schoolOpen)});
    overlay.querySelectorAll('[data-school-name]').forEach(input=>{
      input.onclick=event=>event.stopPropagation();
      input.onkeydown=event=>event.stopPropagation();
      input.onchange=()=>setName(input.dataset.schoolName,input.value);
    });
  }

  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function openOverlay(){ensureOverlay();renderOverlay();overlay.classList.add('open')}
  function closeOverlay(){overlay?.classList.remove('open')}

  function ensureOverlay(){
    if(overlay)return overlay;
    const style=document.createElement('style');
    style.textContent=`
      .school-overlay{position:fixed;inset:0;z-index:20000;background:#f4f7f8ee;backdrop-filter:blur(8px);display:none;overflow:auto;padding:24px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#15374a}
      .school-overlay.open{display:block}.school-shell{width:min(920px,100%);margin:4vh auto;background:#fff;border:1px solid #dbe5e8;border-radius:24px;padding:22px;box-shadow:0 24px 70px #15374a26}.school-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;margin-bottom:18px}.school-head h1{margin:0;font-size:1.55rem}.school-head p{margin:5px 0 0;color:#687985}.school-close{border:0;border-radius:12px;padding:9px 12px;font-weight:900;background:#e7edef;color:#15374a}.school-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.school-card{border:2px solid #dbe5e8;border-radius:17px;padding:10px;background:#fff;cursor:pointer;transition:.15s}.school-card:hover,.school-card:focus{border-color:#83ded3;box-shadow:0 7px 20px #15374a18;outline:none}.school-card.selected{border-color:#83ded3}.school-open{width:100%;background:#f8fbfb;border-radius:13px;padding:14px;text-align:left;color:#15374a}.school-open strong{display:block;font-size:.8rem;color:#167557}.school-open span{display:block;font-size:1.05rem;font-weight:900;margin-top:3px}.school-open em{display:inline-block;margin-top:7px;padding:4px 7px;border-radius:999px;background:#e5f6ef;color:#167557;font-size:.7rem;font-style:normal;font-weight:900}.school-card label{display:grid;gap:5px;font-size:.73rem;font-weight:850;margin-top:9px;cursor:default}.school-card input{width:100%;border:1px solid #dbe5e8;border-radius:10px;padding:9px;background:#fff}.school-enter{width:100%;margin-top:10px;border:0;border-radius:11px;padding:10px 12px;background:#15374a;color:#fff;font-weight:900;cursor:pointer}.school-help{margin-top:15px;padding:11px;border-radius:12px;background:#edf5f6;color:#536b77;font-size:.8rem}@media(max-width:650px){.school-overlay{padding:10px}.school-list{grid-template-columns:1fr}.school-shell{margin:1vh auto;padding:14px}}
    `;
    document.head.appendChild(style);
    overlay=document.createElement('section');
    overlay.className='school-overlay';
    overlay.innerHTML=`<div class="school-shell"><div class="school-head"><div><h1>Seleccionar PCI institucional</h1><p>Elegí una escuela para ingresar a su matriz.</p></div><button class="school-close" type="button" data-school-close ${activeCode()?'':'hidden'}>Cerrar</button></div><div class="school-list" data-school-list></div><div class="school-help">Hacé clic en cualquier parte de la tarjeta o en “Entrar”. Los códigos PCI-101 a PCI-104 quedan fijos.</div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-school-close]').onclick=closeOverlay;
    return overlay;
  }

  function decorateFrame(){
    const f=frame(),w=f?.contentWindow,d=f?.contentDocument;if(!w||!d)return;
    const code=activeCode();if(!code)return;
    const name=schoolName(code);
    const actions=d.querySelector('.top .actions');
    if(actions){
      let button=d.getElementById('schoolSwitcher');
      if(!button){button=d.createElement('button');button.id='schoolSwitcher';button.className='btn';button.type='button';button.onclick=openOverlay;actions.insertBefore(button,actions.firstChild)}
      button.textContent=`${code} · ${name}`;
    }
    const brand=d.querySelector('.brand');
    if(brand){brand.dataset.schoolCode=code;brand.title=`${name} · ${code}`}
    const mapHead=d.querySelector('.integrated-map-head h2');
    if(mapHead)mapHead.textContent=`Mapa Curricular Institucional · ${name} · ${code}`;
    const summaryTitle=d.getElementById('sumTitle');
    if(summaryTitle&&!summaryTitle.dataset.schoolDecorated){summaryTitle.dataset.schoolDecorated='1';summaryTitle.insertAdjacentHTML('beforeend',` <small style="display:block;font-size:.45em;color:#687985">${escapeHtml(name)} · ${code}</small>`)}
  }

  function boot(){
    ensureOverlay();
    const f=frame();
    f?.addEventListener('load',()=>{setTimeout(decorateFrame,350);setTimeout(decorateFrame,1200)});
    setInterval(decorateFrame,1000);
    addEventListener('beforeunload',saveActiveSnapshot);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveActiveSnapshot()});
    if(!activeCode())openOverlay();else{
      const saved=localStorage.getItem(stateKey(activeCode()));
      if(saved&&saved!==currentAppState()){localStorage.setItem('pciAppV2',saved);if(f)f.src=`app.html?school=${encodeURIComponent(activeCode())}&t=${Date.now()}`}
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();