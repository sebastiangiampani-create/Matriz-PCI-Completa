(() => {
  const $=id=>document.getElementById(id);
  let timer=null,activeKey='home',applying=false;

  const defs=[
    {key:'docentes',title:'Docentes y cargos',desc:'Planta docente, cargos y datos de identificación.',icon:'👥',
      find:()=>[...document.querySelectorAll('#v48InstitutionalContent > .v71m-teacher-section')]},
    {key:'asignaciones',title:'Asignación a espacios',desc:'Cruce docente–espacio y coordinaciones de área/orientación derivadas de la estructura curricular.',icon:'↔',
      find:()=>[...document.querySelectorAll('#v48InstitutionalContent > .v71o-assignment,#v48InstitutionalContent > .v95-coordination')]},
    {key:'excel',title:'Carga masiva',desc:'Importación de planta, cargos y asignaciones mediante Excel.',icon:'⇩',
      find:()=>[$('v71SimpleAssignmentExcel')].filter(Boolean)}
  ];

  function host(){return $('v48InstitutionalContent')}
  function visibleManagement(){return !!$('institutional')?.classList.contains('active')}
  function findByHeading(re){
    const h=host();if(!h)return[];
    return [...h.children].filter(el=>re.test(el.querySelector?.('h2')?.textContent||''));
  }
  function institutional(){
    state.institutional=state.institutional||{};
    return state.institutional;
  }
  function rows(){return window.PCIInstitutionalV48?.allImplementationRows?.()||[]}
  function metrics(){
    const r=institutional(),all=rows(),teachers=Object.values(r.teachers||{}),assigned=all.filter(x=>r.assignments?.[x.instanceId]).length;
    const teachersAssigned=new Set(all.map(x=>r.assignments?.[x.instanceId]).filter(Boolean));
    const coordinations=Array.isArray(r.coordinations)?r.coordinations:[];
    return {teachers,assigned,total:all.length,teachersAssigned:teachersAssigned.size,coordinations};
  }

  function statusFor(key,m){
    if(key==='docentes')return `${m.teachers.length} docentes cargados`;
    if(key==='asignaciones')return `${m.assigned}/${m.total} espacios · ${m.coordinations.length} coordinaciones`;
    if(key==='excel')return 'Planta, cargos y asignaciones';
    return '';
  }

  function renderHome(){
    const h=host();if(!h||!visibleManagement())return;
    let home=$('v73ManagementHome');
    if(!home){
      home=document.createElement('section');
      home.id='v73ManagementHome';
      home.className='v73-management-home';
      h.prepend(home);
    }
    const m=metrics();
    const alerts=[];
    if(m.total-m.assigned>0)alerts.push(`${m.total-m.assigned} espacios sin docente`);


    home.innerHTML=`
      <div class="v73-hero">
        <div>
          <div class="eyebrow">Gestión institucional</div>
          <h2>Organización docente y académica</h2>
          <p>Administrá docentes, cargos y asignaciones a espacios curriculares. El cruce entre el Mapa de la Oferta y la asignación docente determina automáticamente qué áreas puede consultar cada docente y qué nivel, espacios y planes puede editar en Desarrollo Curricular.</p>
        </div>
        <div class="v73-kpis">
          <span><strong>${m.teachers.length}</strong> docentes</span>
          <span><strong>${m.assigned}/${m.total}</strong> espacios asignados</span>
          <span><strong>${m.teachersAssigned}</strong> docentes con espacios</span>
          <span><strong>${m.coordinations.length}</strong> coordinaciones</span>
        </div>
      </div>
      ${alerts.length?`<div class="v73-alert"><strong>Para revisar:</strong> ${alerts.join(' · ')}</div>`:'<div class="v73-ok">Gestión sin alertas críticas en este momento.</div>'}
      <div class="v73-grid">
        ${defs.map(d=>`<article class="v73-card" data-v73-card="${d.key}">
          <div class="v73-card-top"><span class="v73-card-icon">${d.icon}</span><span class="v73-status">${statusFor(d.key,m)}</span></div>
          <h3>${d.title}</h3>
          <p>${d.desc}</p>
          <button type="button" data-v73-open="${d.key}">Entrar</button>
        </article>`).join('')}
      </div>
      <div class="v73-danger">
        <div><strong>Reiniciar Gestión</strong><span>Borra únicamente los datos de Gestión Institucional. No modifica el Mapa de la Oferta ni el Desarrollo Curricular.</span></div>
        <button type="button" data-v73-reset>Reiniciar</button>
      </div>`;

    home.querySelectorAll('[data-v73-open]').forEach(b=>b.onclick=()=>openModule(b.dataset.v73Open));
    home.querySelector('[data-v73-reset]')?.addEventListener('click',()=>window.PCIManagementNavResetV71?.resetManagement?.());
  }

  function allAssignedHours(tid){
    return rows().filter(r=>institutional().assignments?.[r.instanceId]===tid).reduce((n,r)=>n+(Number(r.hours)||0),0);
  }

  function ensureToolbar(){
    const h=host();if(!h)return null;
    let bar=$('v73ModuleToolbar');
    if(!bar){
      bar=document.createElement('div');bar.id='v73ModuleToolbar';bar.className='v73-module-toolbar';
      h.prepend(bar);
    }
    return bar;
  }

  function prepareModule(key){
    try{
      if(key==='excel')window.PCISimpleAssignmentExcelV71?.render?.();
    }catch(e){console.warn('V73 prepare module',key,e)}
  }

  function openModule(key){
    activeKey=key;
    const def=defs.find(x=>x.key===key);if(!def)return;
    prepareModule(key);
    setTimeout(()=>{
      applyView();
      requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'smooth'}));
    },90);
  }
  function goHome(){activeKey='home';applyView();window.scrollTo({top:0,behavior:'smooth'})}

  function applyView(){
    const h=host();if(!h||!visibleManagement()||applying)return;
    applying=true;
    try{
    renderHome();
    const home=$('v73ManagementHome'),bar=ensureToolbar();
    const allChildren=[...h.children].filter(x=>x!==home&&x!==bar);
    allChildren.forEach(x=>x.classList.add('v73-hidden'));

    if(activeKey==='home'){
      if(home)home.classList.remove('v73-hidden');
      if(bar)bar.classList.add('v73-hidden');
      document.body.classList.add('v73-management-home-active');
    } else {
    document.body.classList.remove('v73-management-home-active');
    if(home)home.classList.add('v73-hidden');
    const def=defs.find(x=>x.key===activeKey);
    const targets=def?.find?.()||[];
    targets.forEach(x=>x?.classList.remove('v73-hidden'));
    if(bar){
      bar.classList.remove('v73-hidden');
      bar.innerHTML=`<button type="button" data-v73-home>← Inicio de Gestión</button><div><span>Gestión institucional</span><strong>${def?.title||''}</strong></div>`;
      bar.querySelector('[data-v73-home]').onclick=goHome;
    }
    }
    } finally {
      applying=false;
    }
  }

  function refresh(){
    clearTimeout(timer);
    timer=setTimeout(()=>{
      if(!visibleManagement())return;
      applyView();
    },80);
  }

  function start(){if(!host())return;refresh();}

  window.addEventListener('pci-app-ready',()=>setTimeout(start,900));
  document.addEventListener('click',e=>{if(e.target.closest('[data-v71n-open],#openInstitutional,#openInstitutionalGeneral')){activeKey='home';setTimeout(start,250)}},true);
  setTimeout(start,1600);

  const style=document.createElement('style');
  style.textContent=`
    .v73-hidden{display:none!important}
    .v73-management-home{display:grid;gap:16px}
    .v73-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,.7fr);gap:22px;padding:24px;border:1px solid #d8e1e8;border-radius:24px;background:linear-gradient(135deg,#f8fbfd 0%,#eef5f8 100%);box-shadow:0 14px 34px rgba(18,57,92,.08)}
    .v73-hero:after{content:"";position:absolute;width:210px;height:210px;border-radius:50%;right:-70px;bottom:-105px;background:#dfe7ec}
    .v73-hero>div{position:relative;z-index:1}.v73-hero h2{font-size:clamp(1.5rem,3vw,2.4rem);margin:5px 0 8px;letter-spacing:-.03em}.v73-hero p{margin:0;color:var(--muted);line-height:1.5;max-width:760px}
    .v73-kpis{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-content:start}.v73-kpis span{padding:12px;border:1px solid rgba(18,57,92,.08);border-radius:14px;background:rgba(255,255,255,.78);font-size:.68rem;color:var(--muted)}.v73-kpis strong{display:block;font-size:1.2rem;color:var(--ink);margin-bottom:2px}
    .v73-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .v73-card{display:flex;flex-direction:column;min-height:210px;padding:18px;border:1px solid var(--line);border-radius:20px;background:#fff;box-shadow:0 10px 26px rgba(18,57,92,.06);transition:.18s ease}.v73-card:hover{transform:translateY(-2px);box-shadow:0 16px 34px rgba(18,57,92,.1)}
    .v73-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.v73-card-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;background:var(--band);font-size:1.3rem}.v73-status{max-width:68%;padding:5px 7px;border-radius:999px;background:var(--mint-soft);color:var(--mint-dark);font-size:.51rem;font-weight:850;text-align:right}
    .v73-card h3{margin:15px 0 6px;font-size:1rem}.v73-card p{margin:0 0 16px;color:var(--muted);font-size:.67rem;line-height:1.45}.v73-card button{margin-top:auto;width:max-content;min-width:100px;padding:9px 16px;border:0;border-radius:999px;background:var(--ink);color:#fff;font-weight:850}
    .v73-alert,.v73-ok{padding:11px 14px;border-radius:14px;font-size:.67rem;line-height:1.4}.v73-alert{background:var(--danger-soft);color:var(--danger);border:1px solid #efcbd2}.v73-ok{background:var(--ok-soft);color:var(--ok);border:1px solid #c5e6d4}
    .v73-danger{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;border:1px solid #ebc8cf;border-radius:16px;background:#fffafb}.v73-danger strong{display:block;color:var(--danger);font-size:.72rem}.v73-danger span{display:block;margin-top:3px;color:var(--muted);font-size:.58rem}.v73-danger button{border:1px solid #d7a8b2;border-radius:999px;background:#fff5f6;color:var(--danger);padding:8px 13px;font-weight:850}
    .v73-module-toolbar{position:sticky;top:8px;z-index:95;display:flex;align-items:center;gap:12px;margin:0 0 14px;padding:9px 12px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.97);box-shadow:0 8px 22px rgba(18,57,92,.09);backdrop-filter:blur(10px)}
    .v73-module-toolbar button{border:1px solid var(--line);border-radius:999px;background:var(--band);color:var(--ink);padding:8px 12px;font-weight:850}.v73-module-toolbar span{display:block;color:var(--muted);font-size:.52rem}.v73-module-toolbar strong{display:block;font-size:.76rem}
    #institutional #v71ManagementNav{display:none!important}
    #institutional > .back[data-v48-panel],#institutional .v48-hero-actions{display:none!important}
    @media(max-width:1150px){.v73-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:850px){.v73-hero{grid-template-columns:1fr}.v73-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:600px){.v73-grid{grid-template-columns:1fr}.v73-hero{padding:18px;border-radius:20px}.v73-kpis{grid-template-columns:1fr 1fr}.v73-card{min-height:0}.v73-card button{width:100%}.v73-module-toolbar{top:6px}.v73-danger{align-items:stretch;flex-direction:column}.v73-danger button{width:100%}}
  `;
  document.head.appendChild(style);

  window.PCIManagementHomeV73={openModule,goHome,refresh};
})();