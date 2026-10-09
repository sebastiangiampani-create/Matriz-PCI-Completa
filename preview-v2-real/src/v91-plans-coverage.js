(() => {
  const phase=()=>window.PCIPhase2V28;
  const coverage=()=>window.PCICoverageV91;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const metric=x=>Number(x?.total)?`${Number(x.used||0)}/${Number(x.total)} · ${Number(x.percent||0)}%`:'—';
  const isDual=g=>['laboratorio','taller'].includes(String(g?.type||'').toLowerCase());
  const typeLabel=g=>({
    troncal:'Troncal',
    laboratorio:'Laboratorio',
    taller:'Taller',
    proyecto:'Proyecto',
    seminario:'Seminario',
    asignatura:'Asignatura'
  })[String(g?.type||'').toLowerCase()]||'Espacio curricular';

  function hideLegacyPlanField(card){
    card.querySelectorAll('.v28-field').forEach(label=>{
      const title=label.querySelector(':scope > span')?.textContent||'';
      if(/^Planes \/ proyectos/i.test(title))label.style.display='none';
    });
  }

  function subjectRows(result){
    const rows=result?.bySubject||[];
    if(!rows.length)return'';
    return `<div class="v97-group-rows">${rows.map(x=>`
      <div class="v97-group-row">
        <div><small>Materia</small><strong>${esc(x.subject)}</strong></div>
        <div class="v97-group-value"><b>${Number(x.used||0)}/${Number(x.total||0)}</b><span>${Number(x.percent||0)}%</span></div>
        <div class="v97-group-bar"><i style="width:${Math.min(100,Number(x.percent||0))}%"></i></div>
      </div>`).join('')}</div>`;
  }

  function componentRows(result){
    if(result?.basis==='trajectory'&&result?.component==='FO'&&!result?.levelBasisAvailable){
      return '<div class="v97-group-pending">La base orientada actual todavía no permite calcular cobertura anual por nivel. Este bloque se completará con la base corregida.</div>';
    }
    const rows=result?.byComponent||[];
    if(!rows.length)return'';
    return `<div class="v97-group-rows">${rows.map(x=>`
      <div class="v97-group-row">
        <div><small>${esc(x.kind||'Componente')}</small><strong>${esc(x.label)}</strong></div>
        <div class="v97-group-value"><b>${Number(x.used||0)}/${Number(x.total||0)}</b><span>${Number(x.percent||0)}%</span></div>
        <div class="v97-group-bar"><i style="width:${Math.min(100,Number(x.percent||0))}%"></i></div>
      </div>`).join('')}</div>`;
  }

  function groupCoverageBlock(group,result){
    const dual=isDual(group);
    const term=phase()?.termText?.(group)||String(group?.term||'');
    const title=dual?'Cobertura del agrupamiento':'Cobertura anual del espacio';
    const helper=dual
      ?`Cada materia se coteja con su total anual prescripto de ${Number(group.year)||''}.º. Los contenidos repetidos no se vuelven a contar.`
      :`La materia se coteja con su total anual prescripto de ${Number(group.year)||''}.º. La cobertura acumulada usa contenidos únicos.`;

    return `<section class="v97-group-coverage">
      <header class="v97-group-head">
        <div><span>${esc(title)}</span><h4>${esc(typeLabel(group))} · Nivel ${esc(group.year)}${term?' · '+esc(term):''}</h4></div>
        <span class="v97-group-chip">${esc(dual?'Por materia':'Anual')}</span>
      </header>
      <p class="v97-group-help">${esc(helper)}</p>
      ${subjectRows(result)||componentRows(result)||'<div class="v97-group-pending">Todavía no hay contenidos oficiales calculables para este espacio.</div>'}
    </section>`;
  }

  function areaLevelCoverage(){
    const p=phase(),c=coverage();
    const area=p?.getActiveArea?.();
    const all=p?.groups?.()||[];
    if(!area)return[];
    const areaGroups=all.filter(g=>g?.area===area);
    return [1,2,3,4,5].map(year=>{
      const levelGroups=areaGroups.filter(g=>Number(g.year)===year);
      if(!levelGroups.length)return null;
      const result=c?.groupingLevelCoverage?.(levelGroups[0],all)||{};
      return {year,result};
    }).filter(Boolean);
  }

  function levelRows(result){
    const rows=result?.bySubject||[];
    if(rows.length)return `<div class="v100-level-rows">${rows.map(x=>`
      <div class="v100-level-row">
        <div><small>Materia</small><strong>${esc(x.subject)}</strong></div>
        <div class="v100-level-value"><b>${Number(x.used||0)}/${Number(x.total||0)}</b><span>${Number(x.percent||0)}%</span></div>
        <div class="v100-level-bar"><i style="width:${Math.min(100,Number(x.percent||0))}%"></i></div>
      </div>`).join('')}</div>`;
    if(result?.basis==='trajectory'&&result?.component==='FO'&&!result?.levelBasisAvailable){
      return '<div class="v100-level-pending">La base orientada actual todavía no permite desagregar esta cobertura anual por nivel.</div>';
    }
    const components=result?.byComponent||[];
    if(components.length)return `<div class="v100-level-rows">${components.map(x=>`
      <div class="v100-level-row">
        <div><small>${esc(x.kind||'Componente')}</small><strong>${esc(x.label)}</strong></div>
        <div class="v100-level-value"><b>${Number(x.used||0)}/${Number(x.total||0)}</b><span>${Number(x.percent||0)}%</span></div>
        <div class="v100-level-bar"><i style="width:${Math.min(100,Number(x.percent||0))}%"></i></div>
      </div>`).join('')}</div>`;
    return '<div class="v100-level-pending">Sin cobertura calculable para este nivel.</div>';
  }

  function decorateAreaCoverage(){
    const box=document.querySelector('#v28board .v28-coverage');
    if(!box)return;
    box.querySelector('.v100-level-breakdown')?.remove();
    const levels=areaLevelCoverage();
    if(!levels.length)return;
    const details=document.createElement('details');
    details.className='v100-level-breakdown';
    details.innerHTML=`
      <summary>
        <div><strong>Ver cobertura por nivel</strong><small>Contenidos únicos del nivel, materia por materia.</small></div>
        <span>${levels.length} nivel${levels.length===1?'':'es'}</span>
      </summary>
      <div class="v100-level-grid">
        ${levels.map(({year,result})=>`
          <section class="v100-level-card">
            <header><div><small>Cobertura anual</small><strong>Nivel ${year}</strong></div></header>
            ${levelRows(result)}
          </section>`).join('')}
      </div>`;
    box.appendChild(details);
  }

  function decorateGroup(card,group){
    if(!card||!group)return;
    card.querySelector('.v97-group-coverage')?.remove();
    card.querySelector('.v91-plans-block')?.remove();
    hideLegacyPlanField(card);

    const result=coverage()?.formatCoverage?.(group);
    if(!result)return;

    const host=document.createElement('div');
    host.innerHTML=groupCoverageBlock(group,result);
    const block=host.firstElementChild;
    const assigned=card.querySelector('.v28-assigned-wrap');
    if(assigned)assigned.insertAdjacentElement('afterend',block);
    else card.appendChild(block);
  }

  async function decorate(){
    const p=phase(),c=coverage();if(!p||!c)return;
    try{await c.ready()}catch(e){console.error('[V97 group coverage]',e);return}
    decorateAreaCoverage();
    document.querySelectorAll('#v28groups [data-g]').forEach(card=>{
      const group=p.gb?.(card.dataset.g);
      if(group)decorateGroup(card,group);
    });
  }

  const style=document.createElement('style');
  style.textContent=`
    .v97-group-coverage{margin-top:12px;padding:12px;border:1px solid #d8e1e8;border-radius:14px;background:#f8fbfd}
    .v97-group-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
    .v97-group-head>div>span{display:block;color:#126e65;font-size:.56rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em}
    .v97-group-head h4{margin:3px 0 0;color:#12395c;font-size:.82rem}
    .v97-group-chip{display:inline-flex;flex:0 0 auto;padding:4px 7px;border-radius:999px;background:#e7f8f5;color:#126e65;font-size:.52rem;font-weight:900}
    .v97-group-help{margin:7px 0 9px;color:#5f7382;font-size:.58rem;line-height:1.4}
    .v97-group-rows{display:grid;gap:6px}
    .v97-group-row{display:grid;grid-template-columns:minmax(130px,1fr) auto;gap:5px 10px;align-items:center;padding:8px 9px;border:1px solid #e1e8ec;border-radius:10px;background:#fff}
    .v97-group-row>div:first-child small,.v97-group-row>div:first-child strong{display:block}
    .v97-group-row>div:first-child small{color:#126e65;font-size:.45rem;font-weight:900;text-transform:uppercase}
    .v97-group-row>div:first-child strong{margin-top:1px;color:#12395c;font-size:.62rem}
    .v97-group-value{display:flex;align-items:baseline;gap:5px;white-space:nowrap}.v97-group-value b{font-size:.67rem;color:#12395c}.v97-group-value span{font-size:.57rem;color:#126e65;font-weight:900}
    .v97-group-bar{grid-column:1/-1;height:4px;border-radius:999px;background:#dce7e8;overflow:hidden}.v97-group-bar i{display:block;height:100%;background:#126e65}
    .v97-group-pending{padding:9px 10px;border:1px dashed #cbd8dc;border-radius:10px;background:#fff;color:#6b7f89;font-size:.6rem;line-height:1.4}
    .v100-level-breakdown{grid-column:1/-1;margin-top:2px;padding-top:10px;border-top:1px solid #e1e7ea}
    .v100-level-breakdown>summary{list-style:none;display:flex;justify-content:space-between;gap:10px;align-items:center;cursor:pointer}
    .v100-level-breakdown>summary::-webkit-details-marker{display:none}
    .v100-level-breakdown>summary strong,.v100-level-breakdown>summary small{display:block}
    .v100-level-breakdown>summary strong{font-size:.7rem;color:#12395c}
    .v100-level-breakdown>summary small{margin-top:2px;color:#5f7382;font-size:.55rem}
    .v100-level-breakdown>summary>span{display:inline-flex;padding:4px 7px;border-radius:999px;background:#e7f8f5;color:#126e65;font-size:.52rem;font-weight:900;white-space:nowrap}
    .v100-level-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;margin-top:9px}
    .v100-level-card{padding:9px;border:1px solid #dfe7ea;border-radius:10px;background:#f9fbfc}
    .v100-level-card header small,.v100-level-card header strong{display:block}
    .v100-level-card header small{color:#126e65;font-size:.42rem;font-weight:900;text-transform:uppercase}
    .v100-level-card header strong{margin-top:1px;font-size:.66rem;color:#12395c}
    .v100-level-rows{display:grid;gap:5px;margin-top:7px}
    .v100-level-row{display:grid;grid-template-columns:minmax(100px,1fr) auto;gap:4px 7px;align-items:center;padding:6px 7px;border:1px solid #e5ebee;border-radius:8px;background:#fff}
    .v100-level-row>div:first-child small,.v100-level-row>div:first-child strong{display:block}
    .v100-level-row>div:first-child small{color:#126e65;font-size:.38rem;font-weight:900;text-transform:uppercase}
    .v100-level-row>div:first-child strong{font-size:.52rem}
    .v100-level-value{display:flex;gap:4px;align-items:baseline;white-space:nowrap}.v100-level-value b{font-size:.55rem}.v100-level-value span{font-size:.48rem;color:#126e65;font-weight:900}
    .v100-level-bar{grid-column:1/-1;height:3px;border-radius:999px;background:#dce7e8;overflow:hidden}.v100-level-bar i{display:block;height:100%;background:#126e65}
    .v100-level-pending{margin-top:7px;padding:7px 8px;border:1px dashed #cbd8dc;border-radius:8px;background:#fff;color:#6b7f89;font-size:.52rem}
    @media(max-width:560px){.v97-group-head{align-items:flex-start}.v97-group-row{grid-template-columns:1fr auto}.v97-group-help{font-size:.62rem}.v100-level-grid{grid-template-columns:1fr}.v100-level-breakdown>summary{align-items:flex-start}}
  `;
  document.head.appendChild(style);

  window.PCIPlansCoverageV91={decorate,decorateAreaCoverage,areaLevelCoverage};
  window.addEventListener('pci-phase2-groups-rendered',()=>setTimeout(decorate,0));
  window.addEventListener('pci-app-ready',()=>setTimeout(decorate,1200));
})();
