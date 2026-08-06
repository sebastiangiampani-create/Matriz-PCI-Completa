(()=>{
  const temporal=document.createElement('script');
  temporal.src='temporal-model.js?v=step1-3';
  temporal.defer=true;
  document.head.appendChild(temporal);

  const AREAS=['Lengua y Literatura','Matemática','Lenguas Adicionales','Ciencias Sociales','Ciencias Naturales','Artes','Tecnologías','Educación Física'];
  const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function injectStyles(){
    if(document.getElementById('integrated-map-styles'))return;
    const style=document.createElement('style');
    style.id='integrated-map-styles';
    style.textContent=`
      .integrated-map{position:fixed;inset:0;z-index:180;background:#f4f7f8;display:none;overflow:auto}
      .integrated-map.open{display:block}
      .integrated-map-head{position:sticky;top:0;z-index:8;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;background:#fff;border-bottom:1px solid var(--line)}
      .integrated-map-head h2{margin:0 auto 0 0;font-size:1rem}
      .integrated-map-body{padding:14px}
      .integrated-summary{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
      .integrated-metric{background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 12px;min-width:150px}
      .integrated-metric b{font-size:1.25rem}
      .integrated-wrap{overflow:auto;border:1px solid var(--line);border-radius:16px;background:#fff}
      .integrated-levels{display:grid;grid-template-columns:170px repeat(5,360px);min-width:1970px}
      .integrated-level{padding:8px;text-align:center;background:#dff6f2;border-right:1px solid var(--line);border-bottom:1px solid var(--line);font-weight:900}
      .integrated-level:first-child{background:#fff}
      .integrated-grid{display:grid;grid-template-columns:170px repeat(10,180px);min-width:1970px}
      .integrated-cell{min-height:88px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:7px}
      .integrated-head{background:var(--ink);color:#fff;font-weight:900;text-align:center}
      .integrated-area{background:#edf5f6;font-weight:900;position:sticky;left:0;z-index:2}
      .integrated-piece{border:1px solid #bfd0d5;border-radius:10px;padding:8px;background:#fff;margin:3px 0;box-shadow:0 2px 8px #15374a14}
      .integrated-piece strong{display:block;font-size:.78rem}
      .integrated-piece small{display:block;color:var(--muted);margin-top:4px}
      .integrated-empty{color:var(--muted);font-size:.75rem}
      @media(max-width:700px){.integrated-levels{grid-template-columns:120px repeat(5,310px);min-width:1670px}.integrated-grid{grid-template-columns:120px repeat(10,155px);min-width:1670px}}
      @media print{body>*:not(.integrated-map){display:none!important}.integrated-map{position:static;display:block!important}.integrated-map-head .btn{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay(){
    let overlay=document.getElementById('integratedMap');
    if(overlay)return overlay;
    overlay=document.createElement('section');
    overlay.id='integratedMap';
    overlay.className='integrated-map';
    overlay.innerHTML=`
      <div class="integrated-map-head">
        <h2>Mapa Curricular Institucional</h2>
        <button id="integratedMapRefresh" class="btn">Actualizar</button>
        <button id="integratedMapPrint" class="btn primary">Imprimir</button>
        <button id="integratedMapClose" class="btn danger">Volver</button>
      </div>
      <div class="integrated-map-body">
        <div class="integrated-summary">
          <div class="integrated-metric"><b id="integratedSpaces">0</b><div>espacios curriculares</div></div>
          <div class="integrated-metric"><b id="integratedHours">0</b><div>horas semanales cargadas</div></div>
          <div class="integrated-metric"><b id="integratedContents">0</b><div>asignaciones de contenidos</div></div>
        </div>
        <div class="integrated-wrap">
          <div class="integrated-levels">
            <div class="integrated-level">Área</div>
            <div class="integrated-level">Nivel 1 · C1–C2</div>
            <div class="integrated-level">Nivel 2 · C3–C4</div>
            <div class="integrated-level">Nivel 3 · C5–C6</div>
            <div class="integrated-level">Nivel 4 · C7–C8</div>
            <div class="integrated-level">Nivel 5 · C9–C10</div>
          </div>
          <div id="integratedGrid" class="integrated-grid"></div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('integratedMapClose').onclick=closeMap;
    document.getElementById('integratedMapRefresh').onclick=renderMap;
    document.getElementById('integratedMapPrint').onclick=()=>window.print();
    return overlay;
  }

  function groupRange(area,index,group){
    const isAnnual=CFG?.[area]?.l==='Nivel';
    const level=Number(group.level||Math.min(5,index+1)||1);
    let start=Number(group.termStart||group.term||(isAnnual?level*2-1:index+1));
    let end=Number(group.termEnd||group.term||(isAnnual?level*2:start));
    if(isAnnual){start=level*2-1;end=level*2}
    start=Math.max(1,Math.min(10,start||1));
    end=Math.max(start,Math.min(10,end||start));
    return {start,end};
  }

  function renderMap(){
    const grid=document.getElementById('integratedGrid');
    if(!grid)return;
    const rows=[];
    let spaces=0,hours=0,contents=0;
    rows.push('<div class="integrated-cell integrated-head">Área</div>'+Array.from({length:10},(_,i)=>`<div class="integrated-cell integrated-head">C${i+1}</div>`).join(''));
    AREAS.forEach(area=>{
      const groups=app?.areas?.[area]?.groups||[];
      rows.push(`<div class="integrated-cell integrated-area">${safe(area)}</div>`);
      for(let term=1;term<=10;term++){
        const matching=groups.filter((group,index)=>{const range=groupRange(area,index,group);return term>=range.start&&term<=range.end});
        const cards=matching.map(group=>{
          spaces+=1;
          hours+=Number(group.weeklyHours||group.hours||0);
          contents+=(group.items||[]).length;
          const component=group.component==='formacion_orientada'?'Formación Orientada':'Formación General';
          return `<div class="integrated-piece"><strong>${safe(group.name||'Sin nombre')}</strong><small>${component} · ${Number(group.weeklyHours||group.hours||0)} h · ${(group.items||[]).length} contenidos</small></div>`;
        }).join('');
        rows.push(`<div class="integrated-cell">${cards||'<span class="integrated-empty">Sin espacios</span>'}</div>`);
      }
    });
    grid.innerHTML=rows.join('');
    document.getElementById('integratedSpaces').textContent=spaces;
    document.getElementById('integratedHours').textContent=hours;
    document.getElementById('integratedContents').textContent=contents;
  }

  function openMap(){
    ensureOverlay().classList.add('open');
    document.body.style.overflow='hidden';
    renderMap();
    window.scrollTo(0,0);
  }

  function closeMap(){
    document.getElementById('integratedMap')?.classList.remove('open');
    document.body.style.overflow='';
  }

  function addMapAccess(){
    injectStyles();
    const actions=document.querySelector('.top .actions');
    if(!actions||document.getElementById('openMap'))return;
    const button=document.createElement('button');
    button.id='openMap';
    button.className='btn mint';
    button.type='button';
    button.textContent='Mapa curricular';
    button.onclick=openMap;
    actions.insertBefore(button,actions.firstChild);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addMapAccess,{once:true});
  else addMapAccess();
})();