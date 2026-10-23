(() => {
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const phase=()=>window.PCIPhase2V28;
  const coverage=()=>window.PCICoverageV91;
  const typeLabel=t=>({troncal:'Troncal',laboratorio:'Laboratorio',taller:'Taller',proyecto:'Proyecto',seminario:'Seminario',asignatura:'Asignatura'})[t]||'Espacio';
  const valueMetric=r=>Number(r?.total)?`${Number(r.used||0)}/${Number(r.total)} · ${Number(r.percent||0)}%`:'—';
  const metric=(used,total)=>Number(total)?`${Number(used||0)}/${Number(total)} · ${Math.round(Number(used||0)/Number(total)*1000)/10}%`:'—';

  let panelGroups=[];

  function visibleGroups(){
    const p=phase();if(!p?.groups)return[];
    const groups=p.groups()||[];
    const scope=p.getAccessScope?.()||{role:'admin',allowedAreasByOrientation:{}};
    if(['admin','coordinator'].includes(scope.role))return groups;
    if(scope.role!=='teacher')return[];
    const allowed=new Set(scope.allowedAreasByOrientation?.[state.active]||[]);
    return groups.filter(g=>allowed.has(g.area));
  }

  function subjectRows(result,compact=false){
    const rows=result?.bySubject||[];
    if(!rows.length)return'';
    return `<div class="v98d-subjects ${compact?'compact':''}">${rows.map(x=>`
      <div class="v98d-subject">
        <div class="v98d-subject-name"><small>Materia</small><strong>${esc(x.subject)}</strong></div>
        <div class="v98d-value"><b>${Number(x.used||0)}/${Number(x.total||0)}</b><span>${Number(x.percent||0)}%</span></div>
        <div class="v98d-bar"><i style="width:${Math.min(100,Number(x.percent||0))}%"></i></div>
      </div>`).join('')}</div>`;
  }

  function componentRows(result,compact=false){
    if(result?.basis==='trajectory'&&result?.component==='FO'&&!result?.levelBasisAvailable){
      return '<div class="v98d-pending">La base orientada actual no informa todavía un universo anual por nivel. Esta lectura se completará al reemplazar la base curricular.</div>';
    }
    const rows=result?.byComponent||[];
    if(!rows.length)return'';
    return `<div class="v98d-subjects ${compact?'compact':''}">${rows.map(x=>`
      <div class="v98d-subject">
        <div class="v98d-subject-name"><small>${esc(x.kind||'Componente')}</small><strong>${esc(x.label)}</strong></div>
        <div class="v98d-value"><b>${Number(x.used||0)}/${Number(x.total||0)}</b><span>${Number(x.percent||0)}%</span></div>
        <div class="v98d-bar"><i style="width:${Math.min(100,Number(x.percent||0))}%"></i></div>
      </div>`).join('')}</div>`;
  }

  function plansForGroup(g){return Array.isArray(g?.data?.plansBimestrales)?g.data.plansBimestrales:[]}

  function planRows(g,p){
    const r=coverage()?.planCoverage?.(g,p?.contentIds||[])||{rows:[],dual:false,basisLabel:`Nivel ${g?.year||''}`};
    if(!r.rows?.length)return'<div class="v99d-plan-empty">Sin contenidos oficiales asignados a este plan.</div>';
    return `<div class="v99d-plan-table ${r.dual?'dual':'single'}">
      <div class="v99d-plan-head"><span>Materia</span><span>Del anual</span>${r.dual?'<span>Dentro del agrupamiento</span>':''}</div>
      ${r.rows.map(x=>`
        <div class="v99d-plan-row">
          <strong>${esc(x.label)}</strong>
          <span>${metric(x.planUsed,x.annualTotal)}</span>
          ${r.dual?`<span>${metric(x.planUsed,x.groupingTotal)}</span>`:''}
        </div>`).join('')}
    </div>`;
  }

  function planCards(g){
    const plans=plansForGroup(g);
    if(!plans.length)return'';
    return `<details class="v99d-plans">
      <summary>
        <div><strong>Planes del agrupamiento</strong><small>La cobertura del nivel usa la unión de contenidos: si un contenido aparece en dos planes, se cuenta una sola vez.</small></div>
        <span>${plans.length}</span>
      </summary>
      <div class="v99d-plan-list">
        ${plans.map((p,i)=>`<article class="v99d-plan">
          <header><div><small>Plan ${Number(p?.number)||i+1}</small><strong>${esc(p?.name||`Bimestre ${Number(p?.number)||i+1}`)}</strong></div></header>
          ${planRows(g,p)}
        </article>`).join('')}
      </div>
    </details>`;
  }

  function groupName(g){return String(g?.data?.name||g?.name||'Espacio curricular')}

  function groupingCard(g){
    const r=coverage()?.formatCoverage?.(g)||{};
    const term=phase()?.termText?.(g)||String(g?.term||'');
    return `<article class="v98d-group">
      <header>
        <div><span>${esc(typeLabel(g.type))}${term?' · '+esc(term):''}</span><h5>${esc(groupName(g))}</h5></div>
        <em>Nivel ${esc(g.year)}</em>
      </header>
      ${subjectRows(r,true)||componentRows(r,true)||'<div class="v98d-pending">Sin contenidos oficiales calculables.</div>'}
      ${planCards(g)}
    </article>`;
  }

  function levelResult(rep,allGroups){return coverage()?.groupingLevelCoverage?.(rep,allGroups)||{}}
  function levelState(result){
    const total=Number(result?.total)||Number(result?.trajectoryTotal||0);
    const used=Number(result?.used||0)||Number(result?.trajectoryUsed||0);
    if(!used)return'empty';
    if(total&&used>=total)return'complete';
    return'progress';
  }

  function levelCard(year,levelGroups,allGroups){
    if(!levelGroups.length)return'';
    const result=levelResult(levelGroups[0],allGroups);
    const stateName=levelState(result);
    const subjectCount=(result.bySubject||[]).length||(result.byComponent||[]).length;
    return `<article class="v98d-level" data-coverage-state="${stateName}">
      <header class="v98d-level-head">
        <div>
          <span>Cobertura anual por materia</span>
          <h4>Nivel ${esc(year)}</h4>
          <p>Cada contenido se cuenta una sola vez en el nivel.</p>
        </div>
        <div class="v98d-level-meta">
          <span>${subjectCount} materia${subjectCount===1?'':'s'}</span>
          <span>${levelGroups.length} agrupamiento${levelGroups.length===1?'':'s'}</span>
        </div>
      </header>
      ${subjectRows(result)||componentRows(result)||'<div class="v98d-pending">Sin cobertura calculable para este nivel.</div>'}
      <details class="v98d-grouping">
        <summary>
          <div><strong>Agrupamientos del nivel</strong><small>Ver cómo se distribuye la cobertura en los espacios construidos.</small></div>
          <span>${levelGroups.length}</span>
        </summary>
        <div class="v98d-groups">${levelGroups.map(groupingCard).join('')}</div>
      </details>
    </article>`;
  }

  function areaCard(area,areaGroups,allGroups,open=false){
    const levels=[1,2,3,4,5].filter(y=>areaGroups.some(g=>Number(g.year)===y));
    return `<details class="v98d-area" ${open?'open':''}>
      <summary class="v98d-area-head">
        <div>
          <span>Área / agrupamiento</span>
          <h3>${esc(area)}</h3>
          <p>La lectura se organiza por materia y nivel; no se repite aquí el total general de la bolsa.</p>
        </div>
        <div class="v98d-area-meta"><b>${levels.length}</b><small>niveles</small><b>${areaGroups.length}</b><small>espacios</small></div>
      </summary>
      <div class="v98d-levels">${levels.map(y=>levelCard(y,areaGroups.filter(g=>Number(g.year)===y),allGroups)).join('')}</div>
    </details>`;
  }

  function filteredModel(){
    const area=$('v98dArea')?.value||'';
    const level=$('v98dLevel')?.value||'';
    const status=$('v98dStatus')?.value||'all';
    const groups=panelGroups.filter(g=>(!area||g.area===area)&&(!level||Number(g.year)===Number(level)));
    const areas=[...new Set(groups.map(g=>g.area).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    return {groups,areas,status};
  }

  function renderResults(){
    const host=$('v98dResults');if(!host)return;
    const {groups,areas,status}=filteredModel();
    if(!groups.length){
      host.innerHTML='<div class="v98d-empty">No hay agrupamientos para los filtros seleccionados.</div>';
      updateCounter(0,0);return;
    }

    let visibleLevels=0;
    let html='';
    areas.forEach((area,index)=>{
      const areaGroups=groups.filter(g=>g.area===area);
      const levels=[1,2,3,4,5].filter(y=>areaGroups.some(g=>Number(g.year)===y));
      const allowedLevels=levels.filter(year=>{
        if(status==='all')return true;
        const levelGroups=areaGroups.filter(g=>Number(g.year)===year);
        const result=levelResult(levelGroups[0],panelGroups);
        const st=levelState(result);
        return status==='coverage'?st!=='empty':st==='empty';
      });
      if(!allowedLevels.length)return;
      visibleLevels+=allowedLevels.length;
      const filteredAreaGroups=areaGroups.filter(g=>allowedLevels.includes(Number(g.year)));
      html+=areaCard(area,filteredAreaGroups,panelGroups,index===0);
    });

    host.innerHTML=html||'<div class="v98d-empty">No hay niveles que coincidan con el estado seleccionado.</div>';
    updateCounter(areas.length,visibleLevels);
  }

  function updateCounter(areas,levels){
    const n=$('v98dCounter');if(!n)return;
    n.textContent=`${areas} área${areas===1?'':'s'} · ${levels} nivel${levels===1?'':'es'}`;
  }

  function printPanel(){
    const source=$('v98dResults');if(!source)return;
    const clone=source.cloneNode(true);
    clone.querySelectorAll('details').forEach(d=>d.setAttribute('open',''));
    const area=$('v98dArea')?.selectedOptions?.[0]?.textContent||'Todas';
    const level=$('v98dLevel')?.selectedOptions?.[0]?.textContent||'Todos';
    const status=$('v98dStatus')?.selectedOptions?.[0]?.textContent||'Todos';
    const w=window.open('','_blank');
    if(!w){alert('El navegador bloqueó la vista de impresión. Habilitá ventanas emergentes.');return}
    w.document.open();
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Panel de cobertura curricular</title><style>
      @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body{margin:0;font-family:Arial,sans-serif;color:#12395c;font-size:10pt;background:#fff}.tools{position:sticky;top:0;padding:9px;background:#fff;border-bottom:1px solid #ccd6d9;z-index:10}.tools button{margin-right:7px;padding:8px 11px;border:0;border-radius:8px;background:#12395c;color:#fff;font-weight:700}
      .sheet{padding:12px}.brand{padding-bottom:9px;border-bottom:2px solid #12395c;margin-bottom:10px}.brand small{display:block;color:#126e65;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.brand h1{margin:3px 0;font-size:20pt}.meta{display:flex;gap:8px;flex-wrap:wrap;color:#5f7382;font-size:8.5pt}.meta span{padding:4px 7px;border-radius:999px;background:#edf3f8}
      details{display:block!important;border:1px solid #d8e1e8;border-radius:10px;margin-bottom:8px;break-inside:avoid}summary{list-style:none!important;padding:8px 10px;background:#f8fbfc}summary::-webkit-details-marker{display:none}
      .v98d-area-head,.v98d-level-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.v98d-area-head{padding:9px 10px}.v98d-area-head h3,.v98d-level-head h4{margin:2px 0}.v98d-area-head p,.v98d-level-head p{margin:0;color:#5f7382;font-size:7.5pt}.v98d-area-meta,.v98d-level-meta{display:flex;gap:5px;color:#5f7382;font-size:7pt}
      .v98d-levels{display:grid;gap:7px;padding:8px}.v98d-level{padding:9px;border:1px solid #e0e7ea;border-radius:9px;background:#fbfcfd;break-inside:avoid}.v98d-level-head{margin-bottom:6px}
      .v98d-subjects{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.v98d-subjects.compact{grid-template-columns:1fr}.v98d-subject{display:grid;grid-template-columns:1fr auto;gap:4px 7px;padding:6px 7px;border:1px solid #dce5e8;border-radius:7px;background:#fff}.v98d-subject small{display:block;color:#126e65;font-size:6pt;font-weight:800;text-transform:uppercase}.v98d-subject strong{font-size:8pt}.v98d-value{display:flex;gap:4px;white-space:nowrap;font-size:7.5pt}.v98d-value span{color:#126e65;font-weight:800}.v98d-bar{grid-column:1/-1;height:2px;background:#dce7e8}.v98d-bar i{display:block;height:100%;background:#126e65}
      .v98d-grouping{margin-top:7px;padding-top:6px;border-top:1px solid #e1e7ea}.v98d-grouping>summary,.v99d-plans>summary{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:5px 2px;background:transparent}.v98d-grouping summary strong,.v99d-plans summary strong{font-size:8pt}.v98d-grouping summary small,.v99d-plans summary small{display:block;color:#5f7382;font-size:6.5pt}
      .v98d-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:6px}.v98d-group{padding:7px;border:1px solid #dce4e8;border-radius:8px;background:#fff;break-inside:avoid}.v98d-group>header{display:flex;justify-content:space-between;gap:6px;margin-bottom:5px}.v98d-group h5{margin:2px 0;font-size:8.5pt}.v98d-group header span,.v98d-group em{font-size:6.5pt;color:#126e65}
      .v99d-plans{margin-top:6px;padding-top:5px;border-top:1px solid #e1e7ea;border-left:0;border-right:0;border-bottom:0;border-radius:0}.v99d-plan-list{display:grid;gap:5px;margin-top:5px}.v99d-plan{padding:6px;border:1px solid #e0e7ea;border-radius:7px;background:#fbfcfd}.v99d-plan header small,.v99d-plan header strong{display:block}.v99d-plan header small{font-size:6pt;color:#126e65;text-transform:uppercase}.v99d-plan header strong{font-size:7.5pt}
      .v99d-plan-table{margin-top:5px}.v99d-plan-head,.v99d-plan-row{display:grid;grid-template-columns:minmax(100px,1.3fr) minmax(80px,.8fr) minmax(95px,.9fr);gap:5px;align-items:center}.v99d-plan-table.single .v99d-plan-head,.v99d-plan-table.single .v99d-plan-row{grid-template-columns:minmax(100px,1.3fr) minmax(80px,.8fr)}.v99d-plan-head{font-size:5.5pt;color:#6a7d87;text-transform:uppercase;font-weight:800}.v99d-plan-row{padding:4px 0;border-top:1px solid #edf1f3;font-size:6.8pt}.v99d-plan-row strong{font-size:7pt}
      .v98d-pending,.v99d-plan-empty{padding:6px;border:1px dashed #cbd8dc;border-radius:6px;color:#6b7f89;font-size:7pt}.v98d-empty{padding:18px;text-align:center}
      @media print{.tools{display:none}.sheet{padding:0}}
    </style></head><body><div class="tools"><button onclick="window.print()">Imprimir / Guardar PDF</button><button onclick="window.close()">Cerrar</button></div><main class="sheet"><header class="brand"><small>Desarrollo Curricular</small><h1>Panel de cobertura curricular</h1><div class="meta"><span>${esc(state.school||'Escuela')}</span><span>${esc(state.active||'PCI')}</span><span>Área: ${esc(area)}</span><span>Nivel: ${esc(level)}</span><span>Estado: ${esc(status)}</span></div></header>${clone.innerHTML}</main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script></body></html>`);
    w.document.close();
  }

  function bindFilters(){
    ['v98dArea','v98dLevel','v98dStatus'].forEach(id=>{
      const el=$(id);if(!el)return;
      el.addEventListener('change',renderResults);
    });
    $('v99dPrint')?.addEventListener('click',printPanel);
    $('v98dReset')?.addEventListener('click',()=>{
      if($('v98dArea'))$('v98dArea').value='';
      if($('v98dLevel'))$('v98dLevel').value='';
      if($('v98dStatus'))$('v98dStatus').value='all';
      renderResults();
    });
  }

  function ensure(){
    let root=$('v93CoverageDashboard');
    if(root)return root;
    root=document.createElement('div');
    root.id='v93CoverageDashboard';root.hidden=true;
    root.innerHTML=`
      <div class="v98d-backdrop" data-v93d-close></div>
      <section class="v98d-shell" role="dialog" aria-modal="true">
        <header class="v98d-head">
          <div><div class="v98d-eye">Desarrollo Curricular</div><h1>Panel de cobertura curricular</h1><p>Cobertura anual por materia, nivel y agrupamiento construido en el Mapa de la Oferta.</p></div>
          <button type="button" data-v93d-close aria-label="Cerrar">×</button>
        </header>
        <div id="v93dBody" class="v98d-body"></div>
      </section>`;
    document.body.appendChild(root);
    root.querySelectorAll('[data-v93d-close]').forEach(x=>x.addEventListener('click',close));
    return root;
  }

  async function render(){
    const body=$('v93dBody');if(!body)return;
    body.innerHTML='<div class="v98d-loading">Calculando coberturas por materia…</div>';
    try{await coverage()?.ready?.()}catch(e){
      body.innerHTML=`<div class="v98d-loading">No se pudo cargar la base prescripta: ${esc(e?.message||e)}</div>`;return;
    }

    panelGroups=visibleGroups();
    const areas=[...new Set(panelGroups.map(g=>g.area).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    const levels=[1,2,3,4,5].filter(y=>panelGroups.some(g=>Number(g.year)===y));

    body.innerHTML=`
      <div class="v98d-toolbar">
        <div class="v98d-context">
          <strong>${esc(state.school||'Escuela')}</strong>
          <span>${esc(state.active||'PCI')}</span>
          <em id="v98dCounter"></em>
        </div>
        <div class="v98d-filters">
          <label><span>Área</span><select id="v98dArea"><option value="">Todas</option>${areas.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('')}</select></label>
          <label><span>Nivel</span><select id="v98dLevel"><option value="">Todos</option>${levels.map(y=>`<option value="${y}">${y}.º</option>`).join('')}</select></label>
          <label><span>Estado</span><select id="v98dStatus"><option value="all">Todos</option><option value="coverage">Con cobertura</option><option value="empty">Sin iniciar</option></select></label>
          <div class="v98d-actions"><button id="v99dPrint" type="button">Imprimir</button><button id="v98dReset" type="button">Limpiar</button></div>
        </div>
        <details class="v98d-help">
          <summary>Cómo se calcula</summary>
          <p>El denominador es el total anual prescripto de cada materia para ese nivel. La conformación de laboratorios, talleres y troncales proviene del Mapa de la Oferta. Si un contenido aparece en más de un espacio o en más de un plan, para la cobertura del nivel y del agrupamiento se cuenta una sola vez: los porcentajes de los planes no se suman entre sí.</p>
        </details>
      </div>
      <div id="v98dResults" class="v98d-results"></div>`;

    bindFilters();
    renderResults();
  }

  async function open(){const root=ensure();root.hidden=false;document.body.classList.add('v93d-open');await render()}
  function close(){const root=$('v93CoverageDashboard');if(root)root.hidden=true;document.body.classList.remove('v93d-open')}

  function decorate(){
    const proposal=$('proposal');if(!proposal||!proposal.classList.contains('active'))return;
    proposal.querySelectorAll('#v28home .v28-hero,#v28board .v28-hero').forEach(hero=>{
      const row=hero.querySelector('.v28-row');if(!row||row.querySelector('[data-v93-dashboard]'))return;
      const b=document.createElement('button');b.type='button';b.className='v28-btn accent';b.dataset.v93Dashboard='1';b.textContent='Panel de cobertura curricular';b.addEventListener('click',open);row.appendChild(b);
    });
  }

  let observer=null,timer=null;
  function refresh(){clearTimeout(timer);timer=setTimeout(decorate,60)}
  function start(){ensure();decorate();const proposal=$('proposal');if(proposal&&!observer){observer=new MutationObserver(refresh);observer.observe(proposal,{childList:true,subtree:true})}}

  const style=document.createElement('style');
  style.textContent=`
    body.v93d-open{overflow:hidden}#v93CoverageDashboard[hidden]{display:none!important}#v93CoverageDashboard{position:fixed;inset:0;z-index:100000;color:#12395c;font-family:inherit}
    .v98d-backdrop{position:absolute;inset:0;background:rgba(15,37,54,.56)}
    .v98d-shell{position:absolute;inset:3vh 3vw;background:#fff;border-radius:22px;box-shadow:0 30px 90px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden}
    .v98d-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;padding:18px 24px;background:#edf3f8;border-bottom:1px solid #d8e1e8}
    .v98d-eye{color:#126e65;font-size:.68rem;font-weight:900;letter-spacing:.09em;text-transform:uppercase}
    .v98d-head h1{margin:3px 0 4px;font-size:clamp(1.45rem,2.7vw,2.15rem)}
    .v98d-head p{margin:0;color:#5f7382;max-width:900px;font-size:.82rem}
    .v98d-head button{border:0;background:#fff;border-radius:999px;width:42px;height:42px;font-size:1.7rem;color:#12395c;box-shadow:0 3px 10px rgba(18,57,92,.08)}
    .v98d-body{padding:0;overflow:auto;background:#f7fafb}
    .v98d-toolbar{position:sticky;top:0;z-index:8;padding:12px 18px;border-bottom:1px solid #dfe7ea;background:rgba(255,255,255,.97);backdrop-filter:blur(8px)}
    .v98d-context{display:flex;align-items:center;gap:8px;margin-bottom:10px}.v98d-context strong{font-size:.78rem}.v98d-context span,.v98d-context em{display:inline-flex;padding:4px 7px;border-radius:999px;background:#edf3f8;color:#5f7382;font-size:.58rem;font-style:normal;font-weight:800}.v98d-context em{margin-left:auto;background:#e7f8f5;color:#126e65}
    .v98d-filters{display:grid;grid-template-columns:minmax(180px,1.4fr) minmax(100px,.6fr) minmax(140px,.8fr) auto;gap:8px;align-items:end}.v98d-actions{display:flex;gap:6px}
    .v98d-filters label{display:grid;gap:4px}.v98d-filters label>span{font-size:.52rem;font-weight:900;text-transform:uppercase;color:#5f7382;letter-spacing:.04em}
    .v98d-filters select{width:100%;min-height:36px;padding:7px 9px;border:1px solid #d3dee3;border-radius:9px;background:#fff;color:#12395c;font:inherit;font-size:.72rem}
    .v98d-filters button{min-height:36px;padding:7px 11px;border:1px solid #c8d6dc;border-radius:9px;background:#fff;color:#12395c;font-size:.66rem;font-weight:850}.v98d-actions #v99dPrint{border-color:#126e65;color:#126e65;background:#f1f8f7}
    .v98d-help{margin-top:8px;font-size:.62rem}.v98d-help summary{width:max-content;cursor:pointer;color:#126e65;font-weight:850}.v98d-help p{margin:6px 0 0;padding:8px 10px;border-radius:9px;background:#f1f8f7;color:#5f7382;line-height:1.45}
    .v98d-results{padding:14px 18px 28px;display:grid;gap:10px}
    .v98d-area{border:1px solid #d8e1e8;border-radius:16px;background:#fff;overflow:hidden;box-shadow:0 5px 15px rgba(18,57,92,.035)}
    .v98d-area>summary{list-style:none;cursor:pointer}.v98d-area>summary::-webkit-details-marker{display:none}
    .v98d-area-head{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:13px 15px}
    .v98d-area-head>div:first-child>span,.v98d-level-head>div>span{color:#126e65;font-size:.49rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em}
    .v98d-area-head h3{margin:2px 0 1px;font-size:.96rem}.v98d-area-head p{margin:0;color:#6a7d87;font-size:.55rem}
    .v98d-area-meta{display:grid;grid-template-columns:auto auto;gap:0 5px;align-items:baseline;min-width:104px;text-align:right}.v98d-area-meta b{font-size:.72rem}.v98d-area-meta small{font-size:.48rem;color:#6a7d87}
    .v98d-area[open]>.v98d-area-head{border-bottom:1px solid #e6ecef;background:#fbfdfd}
    .v98d-levels{display:grid;gap:9px;padding:10px}
    .v98d-level{padding:12px;border:1px solid #e0e7ea;border-radius:13px;background:#f9fbfc}
    .v98d-level-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:8px}.v98d-level-head h4{margin:2px 0 1px;font-size:.85rem}.v98d-level-head p{margin:0;color:#6a7d87;font-size:.52rem}
    .v98d-level-meta{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.v98d-level-meta span{padding:4px 7px;border-radius:999px;background:#edf3f8;color:#5f7382;font-size:.49rem;font-weight:800}
    .v98d-subjects{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:6px}.v98d-subjects.compact{grid-template-columns:1fr}
    .v98d-subject{display:grid;grid-template-columns:minmax(110px,1fr) auto;gap:5px 8px;align-items:center;padding:8px 9px;border:1px solid #dce5e8;border-radius:9px;background:#fff}
    .v98d-subject-name small,.v98d-subject-name strong{display:block}.v98d-subject-name small{color:#126e65;font-size:.4rem;font-weight:900;text-transform:uppercase}.v98d-subject-name strong{margin-top:1px;font-size:.58rem}
    .v98d-value{display:flex;align-items:baseline;gap:4px;white-space:nowrap}.v98d-value b{font-size:.62rem}.v98d-value span{color:#126e65;font-size:.53rem;font-weight:900}
    .v98d-bar{grid-column:1/-1;height:3px;border-radius:999px;background:#dce7e8;overflow:hidden}.v98d-bar i{display:block;height:100%;background:#126e65}
    .v98d-grouping{margin-top:9px;border-top:1px solid #e1e7ea;padding-top:8px}.v98d-grouping>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;padding:2px}.v98d-grouping>summary::-webkit-details-marker{display:none}
    .v98d-grouping>summary strong,.v98d-grouping>summary small{display:block}.v98d-grouping>summary strong{font-size:.62rem;color:#12395c}.v98d-grouping>summary small{margin-top:1px;color:#6a7d87;font-size:.48rem}.v98d-grouping>summary>span{display:inline-grid;place-items:center;min-width:24px;height:24px;padding:0 6px;border-radius:999px;background:#e7f8f5;color:#126e65;font-size:.55rem;font-weight:900}
    .v98d-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:8px}.v98d-group{padding:9px;border:1px solid #dce4e8;border-radius:10px;background:#fff}
    .v98d-group>header{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:6px}.v98d-group>header span{color:#126e65;font-size:.43rem;font-weight:900;text-transform:uppercase}.v98d-group h5{margin:2px 0 0;font-size:.61rem}.v98d-group em{font-style:normal;color:#6a7d87;font-size:.45rem;font-weight:800;white-space:nowrap}
    .v99d-plans{margin-top:7px;padding-top:6px;border-top:1px solid #e1e7ea}.v99d-plans>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer}.v99d-plans>summary::-webkit-details-marker{display:none}.v99d-plans>summary strong,.v99d-plans>summary small{display:block}.v99d-plans>summary strong{font-size:.56rem}.v99d-plans>summary small{margin-top:1px;color:#6a7d87;font-size:.44rem;line-height:1.3}.v99d-plans>summary>span{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#edf3f8;color:#365d78;font-size:.5rem;font-weight:900}
    .v99d-plan-list{display:grid;gap:6px;margin-top:7px}.v99d-plan{padding:8px;border:1px solid #e0e7ea;border-radius:8px;background:#fbfcfd}.v99d-plan header small,.v99d-plan header strong{display:block}.v99d-plan header small{color:#126e65;font-size:.4rem;font-weight:900;text-transform:uppercase}.v99d-plan header strong{margin-top:1px;font-size:.55rem}
    .v99d-plan-table{margin-top:6px}.v99d-plan-head,.v99d-plan-row{display:grid;grid-template-columns:minmax(100px,1.2fr) minmax(82px,.8fr) minmax(100px,.95fr);gap:6px;align-items:center}.v99d-plan-table.single .v99d-plan-head,.v99d-plan-table.single .v99d-plan-row{grid-template-columns:minmax(100px,1.2fr) minmax(82px,.8fr)}.v99d-plan-head{padding-bottom:3px;color:#7a8d99;font-size:.38rem;font-weight:900;text-transform:uppercase}.v99d-plan-row{padding:5px 0;border-top:1px solid #edf1f3}.v99d-plan-row strong{font-size:.5rem}.v99d-plan-row span{font-size:.45rem;color:#365d78;font-weight:800}.v99d-plan-empty{margin-top:6px;padding:7px 8px;border:1px dashed #cbd8dc;border-radius:7px;color:#6b7f89;font-size:.48rem}
    .v98d-pending,.v98d-empty{padding:10px 11px;border:1px dashed #cbd8dc;border-radius:10px;background:#fff;color:#6b7f89;font-size:.6rem;line-height:1.4}.v98d-empty{text-align:center;padding:28px}.v98d-loading{padding:34px;text-align:center;color:#5f7382}
    @media(max-width:820px){.v98d-shell{inset:1.5vh 2vw}.v98d-filters{grid-template-columns:1fr 1fr}.v98d-filters label:first-child{grid-column:1/-1}.v98d-groups{grid-template-columns:1fr}}
    @media(max-width:560px){.v98d-head{padding:14px}.v98d-head p{font-size:.72rem}.v98d-toolbar{padding:10px}.v98d-results{padding:10px}.v98d-context{flex-wrap:wrap}.v98d-context em{margin-left:0}.v98d-filters{grid-template-columns:1fr}.v98d-filters label:first-child{grid-column:auto}.v98d-actions{display:grid;grid-template-columns:1fr 1fr}.v98d-actions button{width:100%}.v98d-area-head,.v98d-level-head{align-items:flex-start;flex-direction:column}.v98d-area-meta{text-align:left}.v98d-level-meta{justify-content:flex-start}.v98d-subjects{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  window.addEventListener('pci-phase2-groups-rendered',refresh);
  window.addEventListener('pci-app-ready',()=>setTimeout(start,1400));
  setTimeout(start,2200);
  window.PCICoverageDashboardV93={open,close,render,visibleGroups,valueMetric,renderResults,printPanel};
})();
