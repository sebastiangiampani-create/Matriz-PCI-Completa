(()=>{
  const CONTROL_VERSION='20260925-content-control-v96';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  function appState(){try{return typeof state!=='undefined'?state:(window.state||{})}catch{return window.state||{}}}
  const FG_FILES=['db1.txt','db2.txt','db3.txt','db4.txt','rest1.txt','rest2.txt','rest3.txt','rest4.txt','rest5.txt'].map(x=>`data/formacion_general/${x}?v=${CONTROL_VERSION}`);
  const ORI={
    'Ciencias Naturales':{f:'ciencias_naturales'},
    'Matemática y Física':{f:'matematica_fisica'},
    'Energía y Sustentabilidad':{f:'energia_sustentabilidad'},
    'Economía y Administración':{f:'economia_administracion'},
    'Educación Física':{f:'educacion_fisica'},
    'Comunicación':{f:'comunicacion'},
    'Literatura':{f:'literatura'},
    'Turismo':{f:'turismo'},
    'Lenguas':{f:'lenguas'},
    'Informática':{f:'informatica'},
    'Educación':{f:'educacion'},
    'Ciencias Sociales y Humanidades':{f:'ciencias_sociales_humanidades'},
    'Arte - Artes Visuales':{f:'arte',v:'artes_visuales'},
    'Arte - Música':{f:'arte',v:'musica'},
    'Arte - Teatro':{f:'arte',v:'teatro'},
    'Agro y Ambiente':{f:'agro_ambiente',dcj:true}
  };
  let fgCache=null,foCache=new Map(),observer=null,timer=null,currentRows=[];

  async function unzip(txt){
    const bytes=Uint8Array.from(atob(String(txt||'').trim()),c=>c.charCodeAt(0));
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
  }

  async function loadFG(){
    if(fgCache)return fgCache;
    const parts=await Promise.all(FG_FILES.map(async path=>{
      const r=await fetch(path,{cache:'force-cache'});
      if(!r.ok)throw new Error('No se pudo cargar la base de Formación General.');
      return r.text();
    }));
    fgCache=(await unzip(parts.join(''))).map(([id,area,subject,axis,text])=>({
      id:`fg:${id}`,component:'FG',area,subject,axis,text
    }));
    return fgCache;
  }

  async function loadFO(){
    const orientation=String(appState().active||'');
    const meta=ORI[orientation]||{};
    const key=`${meta.f||''}:${meta.v||''}`;
    if(foCache.has(key))return foCache.get(key);
    if(!meta.f){foCache.set(key,[]);return[]}
    const r=await fetch(`data/orientaciones/${meta.f}.txt?v=${CONTROL_VERSION}`,{cache:'force-cache'});
    if(!r.ok){
      if(meta.dcj){foCache.set(key,[]);return[]}
      throw new Error(`No se pudo cargar la bolsa de ${orientation}.`);
    }
    let rows=await unzip(await r.text());
    if(meta.v)rows=rows.filter(x=>x.variant===meta.v);
    rows=rows.map(x=>({
      ...x,
      id:`fo:${x.id}`,
      component:'FO',
      area:'Formación Orientada',
      subject:String(x.block||'Formación Orientada').replace(/^Bloque:\s*/i,'')||'Formación Orientada',
      axis:String(x.axis||'').replace(/^Eje:\s*/i,'')
    }));
    foCache.set(key,rows);
    return rows;
  }

  function api(){return window.PCIPhase2V28}
  function termText(g){
    const t=String(g?.term||'');
    if(!t)return'—';
    if(t.includes('-')){
      const [a,b]=t.split('-');
      return `C${a}–C${b}`;
    }
    return `C${t}`;
  }
  function groupName(g){return String(g?.data?.name||g?.name||'Espacio curricular')}
  function sourceAreaFor(row){return row.component==='FO'?'Formación Orientada':String(row.area||'')}
  function hasFO(g){return g?.area==='Formación Orientada'||(api()?.members?.(g)||[]).some(s=>s?.origin==='FO')}

  function visibleArea(area,groupsForContent=[]){
    const scope=api()?.getAccessScope?.()||{role:'admin',allowedAreasByOrientation:{}};
    if(scope.role==='admin')return true;
    if(scope.role!=='teacher')return false;
    const allowed=new Set(scope.allowedAreasByOrientation?.[appState().active]||[]);
    return allowed.has(area)||groupsForContent.some(g=>allowed.has(g.area));
  }

  async function buildRows(){
    const phase=api();
    if(!phase?.groups)throw new Error('Desarrollo Curricular todavía no está disponible.');
    const groups=phase.groups()||[];
    if(!phase.loadCurriculum)throw new Error('La nueva base curricular V96 todavía no está disponible.');
    await phase.loadCurriculum();
    const official=[...(phase.getFGCatalog?.()||[]),...(phase.getFOCatalog?.()||[])];
    const byId=new Map(official.map(x=>[String(x.id),x]));

    const locations=new Map();
    for(const g of groups){
      for(const rawId of (g?.data?.contents||[])){
        const id=String(rawId);
        if(!locations.has(id))locations.set(id,[]);
        locations.get(id).push(g);
      }
    }

    // Conserva también los contenidos institucionales ya asignados, sin tocar su almacenamiento.
    for(const id of locations.keys()){
      if(byId.has(id))continue;
      const row=phase.findContent?.(id);
      if(row)byId.set(id,{...row,component:row.component||'CUSTOM'});
    }

    const rows=[];
    for(const row of byId.values()){
      const locs=locations.get(String(row.id))||[];
      const area=sourceAreaFor(row);
      if(!visibleArea(area,locs))continue;

      // Los contenidos oficiales solo se muestran cuando son utilizables en la estructura actual.
      if(row.component==='FG'){
        if(!groups.some(g=>g.area===row.area))continue;
      }
      if(row.component==='FO'&&!groups.some(g=>hasFO(g)))continue;

      const uniqueLocs=[...new Map(locs.map(g=>[g.id,g])).values()];
      rows.push({
        id:String(row.id),
        component:row.component||'',
        area,
        year:Number(row.year)||0,
        level:row.component==='FG'&&Number(row.year)?String(Number(row.year))+'.º':'Trayectoria orientada',
        subject:String(row.subject||''),
        axis:String(row.axis||''),
        subaxis:String(row.subaxis||''),
        text:String(row.text||''),
        locations:uniqueLocs.map(g=>({
          id:g.id,
          area:g.area,
          name:groupName(g),
          term:termText(g)
        }))
      });
    }

    rows.sort((a,b)=>
      a.area.localeCompare(b.area,'es')||
      a.subject.localeCompare(b.subject,'es')||
      a.axis.localeCompare(b.axis,'es')||
      a.text.localeCompare(b.text,'es')
    );
    return rows;
  }

  function statusOf(row){
    if(!row.locations.length)return'pending';
    if(row.locations.length>1)return'multiple';
    return'assigned';
  }

  function ensureModal(){
    let root=$('v84ContentControl');
    if(root)return root;
    root=document.createElement('div');
    root.id='v84ContentControl';
    root.hidden=true;
    root.innerHTML=`
      <div class="v84cc-backdrop" data-v84-close></div>
      <section class="v84cc-shell" role="dialog" aria-modal="true" aria-labelledby="v84ccTitle">
        <header class="v84cc-head">
          <div>
            <div class="v84cc-eye">Desarrollo Curricular · control de contenidos</div>
            <h1 id="v84ccTitle">Tabla de control de contenidos</h1>
            <p>Consulta de solo lectura. Muestra dónde está ubicado cada contenido sin modificar la matriz ni las asignaciones.</p>
          </div>
          <button type="button" class="v84cc-close" data-v84-close aria-label="Cerrar">×</button>
        </header>
        <div id="v84ccBody" class="v84cc-body"></div>
      </section>`;
    document.body.appendChild(root);
    root.querySelectorAll('[data-v84-close]').forEach(x=>x.addEventListener('click',close));
    return root;
  }

  function stats(rows){
    const assigned=rows.filter(x=>x.locations.length).length;
    const multiple=rows.filter(x=>x.locations.length>1).length;
    return {total:rows.length,assigned,pending:rows.length-assigned,multiple};
  }

  function render(rows=currentRows){
    const root=ensureModal(),body=$('v84ccBody');
    if(!body)return;
    const s=stats(rows);
    const areas=[...new Set(rows.map(x=>x.area).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    const subjects=[...new Set(rows.map(x=>x.subject).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));

    body.innerHTML=`
      <div class="v84cc-summary">
        <div><strong>${s.assigned}</strong><span>ubicados</span></div>
        <div><strong>${s.pending}</strong><span>pendientes</span></div>
        <div><strong>${s.multiple}</strong><span>múltiples ubicaciones</span></div>
        <div><strong>${s.total}</strong><span>totales</span></div>
      </div>
      <div class="v84cc-note">Un contenido puede utilizarse en más de un espacio. “Múltiples ubicaciones” es un dato de control, no un error.</div>
      <div class="v84cc-tools">
        <input id="v84ccSearch" type="search" placeholder="Buscar contenido, materia, eje o espacio">
        <select id="v84ccStatus">
          <option value="">Todos los estados</option>
          <option value="assigned">Ubicados</option>
          <option value="pending">Pendientes</option>
          <option value="multiple">Múltiples ubicaciones</option>
        </select>
        <select id="v84ccArea"><option value="">Todas las áreas</option>${areas.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select>
        <select id="v84ccSubject"><option value="">Todas las materias</option>${subjects.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select>
        <button type="button" class="v84cc-btn" data-v84-csv>Descargar CSV</button>
        <button type="button" class="v84cc-btn primary" data-v84-print>Imprimir / PDF</button>
      </div>
      <div class="v84cc-table-wrap">
        <table class="v84cc-table">
          <thead><tr><th>Estado</th><th>Área</th><th>Materia</th><th>Eje / bloque</th><th>Contenido priorizado</th><th>Ubicado en</th><th>C1–C10</th></tr></thead>
          <tbody id="v84ccRows"></tbody>
        </table>
      </div>
      <div id="v84ccEmpty" class="v84cc-empty" hidden>No hay contenidos que coincidan con estos filtros.</div>`;

    ['v84ccSearch','v84ccStatus','v84ccArea','v84ccSubject'].forEach(id=>{
      $(id)?.addEventListener('input',applyFilters);
      $(id)?.addEventListener('change',applyFilters);
    });
    body.querySelector('[data-v84-csv]')?.addEventListener('click',downloadCsv);
    body.querySelector('[data-v84-print]')?.addEventListener('click',printTable);
    applyFilters();
  }

  function filteredRows(){
    const q=norm($('v84ccSearch')?.value||'');
    const status=$('v84ccStatus')?.value||'';
    const area=$('v84ccArea')?.value||'';
    const subject=$('v84ccSubject')?.value||'';
    return currentRows.filter(row=>{
      if(status&&statusOf(row)!==status&&!(status==='assigned'&&row.locations.length))return false;
      if(area&&row.area!==area)return false;
      if(subject&&row.subject!==subject)return false;
      if(q){
        const hay=norm([row.level,row.year,row.area,row.subject,row.axis,row.subaxis,row.text,...row.locations.flatMap(x=>[x.area,x.name,x.term])].join(' '));
        if(!hay.includes(q))return false;
      }
      return true;
    });
  }

  function applyFilters(){
    const rows=filteredRows(),tbody=$('v84ccRows'),empty=$('v84ccEmpty');
    if(!tbody)return;
    tbody.innerHTML=rows.map(row=>{
      const st=statusOf(row);
      const label=st==='pending'?'Pendiente':st==='multiple'?'Múltiple':'Ubicado';
      const location=row.locations.length?row.locations.map(x=>`<div><strong>${esc(x.name)}</strong><small>${esc(x.area)}</small></div>`).join(''):'<span class="v84cc-pending">Sin asignar</span>';
      const terms=row.locations.length?[...new Set(row.locations.map(x=>x.term))].join(' · '):'—';
      return `<tr>
        <td><span class="v84cc-state ${st}">${label}</span></td>
        <td>${esc(row.area)}</td>
        <td>${esc(row.subject||'—')}</td>
        <td>${esc(row.axis||'—')}</td>
        <td class="v84cc-content">${esc(row.text||'—')}</td>
        <td class="v84cc-locations">${location}</td>
        <td>${esc(terms)}</td>
      </tr>`;
    }).join('');
    if(empty)empty.hidden=!!rows.length;
  }

  function csvCell(v){return '"'+String(v??'').replace(/"/g,'""')+'"'}
  function downloadCsv(){
    const rows=filteredRows();
    const head=['Estado','Área','Materia','Eje/Bloque','Contenido priorizado','Ubicado en','C1-C10'];
    const lines=[head,...rows.map(row=>[
      statusOf(row)==='pending'?'Pendiente':statusOf(row)==='multiple'?'Múltiple':'Ubicado',
      row.area,row.subject,row.axis,row.text,
      row.locations.map(x=>x.name).join(' | '),
      [...new Set(row.locations.map(x=>x.term))].join(' | ')
    ])].map(cols=>cols.map(csvCell).join(';')).join('\n');
    const blob=new Blob(['\ufeff'+lines],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`ubicacion-contenidos-${String(appState().active||'pci').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.csv`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  function printTable(){
    const rows=filteredRows(),s=stats(rows),w=window.open('','_blank');
    if(!w){alert('Habilitá ventanas emergentes para imprimir la tabla de control.');return}
    const body=rows.map(row=>`<tr><td>${esc(statusOf(row)==='pending'?'Pendiente':statusOf(row)==='multiple'?'Múltiple':'Ubicado')}</td><td>${esc(row.area)}</td><td>${esc(row.subject||'')}</td><td>${esc(row.axis||'')}</td><td>${esc(row.text||'')}</td><td>${esc(row.locations.map(x=>x.name).join(' | ')||'Sin asignar')}</td><td>${esc([...new Set(row.locations.map(x=>x.term))].join(' · ')||'—')}</td></tr>`).join('');
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Tabla de control de contenidos</title><style>body{font-family:Arial,sans-serif;color:#12395c;margin:24px}h1{margin-bottom:4px}.meta{margin-bottom:18px;color:#5f7382}.stats{display:flex;gap:16px;margin:14px 0;font-weight:bold}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #cfd9e0;padding:6px;vertical-align:top}th{background:#edf3f8;text-align:left}@media print{body{margin:8mm}}</style></head><body><h1>Tabla de control de contenidos</h1><div class="meta">${esc(appState().school||'')} · ${esc(appState().active||'')}</div><div class="stats"><span>${s.assigned} ubicados</span><span>${s.pending} pendientes</span><span>${s.total} totales</span></div><table><thead><tr><th>Estado</th><th>Área</th><th>Materia</th><th>Eje/Bloque</th><th>Contenido priorizado</th><th>Ubicado en</th><th>C1–C10</th></tr></thead><tbody>${body}</tbody></table></body></html>`);
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }

  async function open(){
    const root=ensureModal(),body=$('v84ccBody');
    root.hidden=false;document.body.classList.add('v84cc-open');
    if(body)body.innerHTML='<div class="v84cc-loading">Construyendo tabla de control…</div>';
    try{
      currentRows=await buildRows();
      render(currentRows);
    }catch(error){
      if(body)body.innerHTML=`<div class="v84cc-error"><strong>No se pudo construir la tabla de control.</strong><span>${esc(error?.message||error)}</span></div>`;
    }
  }
  function close(){const root=$('v84ContentControl');if(root)root.hidden=true;document.body.classList.remove('v84cc-open')}

  function decorate(){
    const proposal=$('proposal');
    if(!proposal||!proposal.classList.contains('active'))return;
    for(const hero of proposal.querySelectorAll('#v28home .v28-hero,#v28board .v28-hero')){
      const row=hero.querySelector('.v28-row');
      if(!row||row.querySelector('[data-v84-control]'))continue;
      const b=document.createElement('button');
      b.type='button';b.className='v28-btn accent';b.dataset.v84Control='1';b.textContent='Tabla de control de contenidos';
      b.addEventListener('click',open);
      row.appendChild(b);
    }
  }

  function refresh(){clearTimeout(timer);timer=setTimeout(decorate,60)}
  function start(){
    ensureModal();decorate();
    const proposal=$('proposal');
    if(proposal&&!observer){observer=new MutationObserver(refresh);observer.observe(proposal,{childList:true,subtree:true})}
  }

  const style=document.createElement('style');
  style.textContent=`
    body.v84cc-open{overflow:hidden}
    #v84ContentControl[hidden]{display:none!important}
    #v84ContentControl{position:fixed;inset:0;z-index:99999;color:#12395c;font-family:inherit}
    .v84cc-backdrop{position:absolute;inset:0;background:rgba(15,37,54,.56)}
    .v84cc-shell{position:absolute;inset:3vh 3vw;background:#fff;border-radius:22px;box-shadow:0 30px 90px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden}
    .v84cc-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;padding:22px 24px;background:#edf3f8;border-bottom:1px solid #d8e1e8}
    .v84cc-head h1{margin:3px 0 6px;font-size:clamp(1.55rem,3vw,2.35rem)}
    .v84cc-head p{margin:0;color:#5f7382;max-width:900px}
    .v84cc-eye{color:#126e65;font-size:.72rem;font-weight:900;letter-spacing:.09em;text-transform:uppercase}
    .v84cc-close{border:0;background:#fff;border-radius:999px;width:42px;height:42px;font-size:1.7rem;color:#12395c}
    .v84cc-body{padding:18px 22px 26px;overflow:auto}
    .v84cc-summary{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:10px;margin-bottom:10px}
    .v84cc-summary>div{padding:13px 15px;border:1px solid #d8e1e8;border-radius:16px;background:#fff}
    .v84cc-summary strong{display:block;font-size:1.5rem}.v84cc-summary span{font-size:.72rem;color:#5f7382;font-weight:800}
    .v84cc-note{padding:10px 13px;margin-bottom:12px;border-radius:12px;background:#fff5dc;color:#7a5a11;font-size:.76rem}
    .v84cc-tools{display:grid;grid-template-columns:minmax(220px,2fr) repeat(3,minmax(150px,1fr)) auto auto;gap:8px;margin-bottom:12px}
    .v84cc-tools input,.v84cc-tools select,.v84cc-btn{min-height:40px;border:1px solid #d8e1e8;border-radius:11px;background:#fff;padding:8px 10px;color:#12395c}
    .v84cc-btn{font-weight:850;white-space:nowrap}.v84cc-btn.primary{background:#12395c;color:#fff;border-color:#12395c}
    .v84cc-table-wrap{overflow:auto;border:1px solid #d8e1e8;border-radius:15px}
    .v84cc-table{width:100%;min-width:1120px;border-collapse:collapse;font-size:.72rem}
    .v84cc-table th{position:sticky;top:0;z-index:1;padding:9px;background:#edf3f8;text-align:left;border-bottom:1px solid #d8e1e8}
    .v84cc-table td{padding:9px;border-bottom:1px solid #e7edf1;vertical-align:top}
    .v84cc-content{min-width:300px;line-height:1.35}.v84cc-locations{min-width:220px}.v84cc-locations div+div{margin-top:6px}.v84cc-locations small{display:block;color:#6c7f8d}
    .v84cc-state{display:inline-flex;padding:4px 7px;border-radius:999px;font-size:.62rem;font-weight:900}.v84cc-state.assigned{background:#e7f8f5;color:#126e65}.v84cc-state.pending{background:#fff1e9;color:#a24516}.v84cc-state.multiple{background:#edf1ff;color:#3b4f9a}
    .v84cc-pending{color:#a24516;font-weight:850}.v84cc-empty,.v84cc-loading,.v84cc-error{padding:34px;text-align:center;color:#5f7382}.v84cc-error span{display:block;margin-top:6px}
    @media(max-width:900px){.v84cc-shell{inset:1.5vh 2vw}.v84cc-head{padding:16px}.v84cc-body{padding:12px}.v84cc-summary{grid-template-columns:1fr 1fr}.v84cc-tools{grid-template-columns:1fr 1fr}.v84cc-tools input{grid-column:1/-1}}
    @media(max-width:560px){.v84cc-summary,.v84cc-tools{grid-template-columns:1fr}.v84cc-tools input{grid-column:auto}.v84cc-head p{font-size:.8rem}}
  `;
  document.head.appendChild(style);

  window.addEventListener('pci-app-ready',()=>setTimeout(start,900));
  setTimeout(start,1800);
  window.PCIContentControlV84={open,close,buildRows,decorate,getRows:()=>currentRows.slice()};
})();