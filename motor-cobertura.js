(()=>{
  const frame=()=>document.getElementById('pci');
  let timer=null;

  function calculate(w){
    const rows=[];
    const allAreas=new Set([
      ...Object.keys(w.CFG||{}),
      ...(w.DATA||[]).map(item=>item.area)
    ]);
    allAreas.forEach(area=>{
      const catalog=(w.DATA||[]).filter(item=>item.area===area);
      const catalogIds=new Set(catalog.map(item=>String(item.id)));
      const occurrences=new Map();
      const groups=w.app?.areas?.[area]?.groups||[];
      groups.forEach(group=>(group.items||[]).forEach(id=>{
        const key=String(typeof id==='object'?(id.id??id.contentId??JSON.stringify(id)):id);
        occurrences.set(key,(occurrences.get(key)||0)+1);
      }));
      const assigned=[...occurrences.keys()].filter(id=>catalogIds.has(id));
      const covered=assigned.length;
      const total=catalogIds.size;
      const duplicates=[...occurrences.entries()].filter(([id,count])=>catalogIds.has(id)&&count>1);
      const orphan=[...occurrences.keys()].filter(id=>!catalogIds.has(id));
      rows.push({area,total,covered,pending:Math.max(0,total-covered),percent:total?Math.round(covered*100/total):0,duplicates:duplicates.length,orphan:orphan.length,started:groups.length>0});
    });
    const total=rows.reduce((n,row)=>n+row.total,0);
    const covered=rows.reduce((n,row)=>n+row.covered,0);
    return {rows,total,covered,percent:total?Math.round(covered*100/total):0,duplicates:rows.reduce((n,row)=>n+row.duplicates,0)};
  }

  function tone(percent,started){
    if(!started||percent<50)return 'bad';
    if(percent<100)return 'warn';
    return 'ok';
  }

  function install(){
    const f=frame(),w=f?.contentWindow,d=f?.contentDocument;
    if(!w||!d||!Array.isArray(w.DATA)||!w.DATA.length)return;
    const overlay=d.getElementById('integratedMap');
    const body=overlay?.querySelector('.integrated-map-body');
    if(!body)return;
    let panel=d.getElementById('coveragePanel');
    if(!panel){
      const style=d.createElement('style');
      style.textContent=`#coveragePanel{margin-bottom:12px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px}.coverage-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.coverage-total{font-weight:900;font-size:1.15rem}.coverage-track{height:10px;background:#e5ebed;border-radius:999px;overflow:hidden;margin:10px 0 12px}.coverage-fill{height:100%;background:var(--mint)}.coverage-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}.coverage-card{border:1px solid var(--line);border-radius:12px;padding:10px}.coverage-card.ok{background:var(--okbg);color:var(--ok)}.coverage-card.warn{background:var(--warnbg);color:var(--warn)}.coverage-card.bad{background:var(--badbg);color:var(--bad)}.coverage-card strong,.coverage-card span{display:block}.coverage-card small{display:block;margin-top:4px}`;
      d.head.appendChild(style);
      panel=d.createElement('section');
      panel.id='coveragePanel';
      body.insertBefore(panel,body.firstChild);
    }
    const result=calculate(w);
    panel.innerHTML=`<div class="coverage-head"><div><strong>Cobertura curricular</strong><div>${result.covered} de ${result.total} contenidos priorizados</div></div><div class="coverage-total">${result.percent}%</div></div><div class="coverage-track"><div class="coverage-fill" style="width:${result.percent}%"></div></div><div class="coverage-grid">${result.rows.map(row=>`<div class="coverage-card ${tone(row.percent,row.started)}"><strong>${row.area}</strong><span>${row.percent}% · ${row.covered}/${row.total}</span><small>${row.pending} pendientes · ${row.duplicates} duplicados${row.orphan?` · ${row.orphan} referencias inválidas`:''}</small></div>`).join('')}</div>`;
  }

  function watch(){
    clearInterval(timer);
    timer=setInterval(()=>{try{install()}catch(error){console.error('Motor de cobertura:',error)}},800);
  }
  frame()?.addEventListener('load',watch);
  watch();
})();