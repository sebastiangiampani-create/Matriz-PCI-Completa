(()=>{
  const temporal=document.createElement('script');
  temporal.src='temporal-model.js?v=step1-4';
  temporal.defer=true;
  document.head.appendChild(temporal);

  const AREAS=['Lengua y Literatura','Matemática','Lenguas Adicionales','Ciencias Sociales','Ciencias Naturales','Artes','Tecnologías','Educación Física'];
  const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let selectedSpace=null;

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
      .integrated-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:12px;align-items:start}
      .integrated-wrap{overflow:auto;border:1px solid var(--line);border-radius:16px;background:#fff}
      .integrated-levels{display:grid;grid-template-columns:170px repeat(5,360px);min-width:1970px}
      .integrated-level{padding:8px;text-align:center;background:#dff6f2;border-right:1px solid var(--line);border-bottom:1px solid var(--line);font-weight:900}
      .integrated-level:first-child{background:#fff}
      .integrated-grid{display:grid;grid-template-columns:170px repeat(10,180px);min-width:1970px}
      .integrated-cell{min-height:88px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:7px}
      .integrated-head{background:var(--ink);color:#fff;font-weight:900;text-align:center}
      .integrated-area{background:#edf5f6;font-weight:900;position:sticky;left:0;z-index:2}
      .integrated-piece{border:1px solid #bfd0d5;border-radius:10px;padding:8px;background:#fff;margin:3px 0;box-shadow:0 2px 8px #15374a14;cursor:pointer}
      .integrated-piece:hover,.integrated-piece.selected{border-color:var(--mint);outline:2px solid var(--mint)}
      .integrated-piece strong{display:block;font-size:.78rem}
      .integrated-piece small{display:block;color:var(--muted);margin-top:4px}
      .integrated-empty{color:var(--muted);font-size:.75rem}
      .integrated-inspector{position:sticky;top:66px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px;min-height:280px}
      .integrated-inspector h3{margin:0 0 10px}
      .integrated-inspector label{display:grid;gap:5px;margin:9px 0;font-size:.78rem;font-weight:850}
      .integrated-inspector input,.integrated-inspector select{width:100%;border:1px solid var(--line);border-radius:10px;padding:9px;background:#fbfcfc}
      .integrated-inspector-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      .integrated-inspector-empty{color:var(--muted);font-size:.86rem}
      @media(max-width:980px){.integrated-layout{grid-template-columns:1fr}.integrated-inspector{position:static}}
      @media(max-width:700px){.integrated-levels{grid-template-columns:120px repeat(5,310px);min-width:1670px}.integrated-grid{grid-template-columns:120px repeat(10,155px);min-width:1670px}}
      @media print{body>*:not(.integrated-map){display:none!important}.integrated-map{position:static;display:block!important}.integrated-map-head .btn,.integrated-inspector{display:none!important}.integrated-layout{display:block}}
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
        <div class="integrated-layout">
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
          <aside id="integratedInspector" class="integrated-inspector"><h3>Inspector</h3><div class="integrated-inspector-empty">Seleccioná una tarjeta del mapa para editarla.</div></aside>
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
    return {start,end,level,isAnnual};
  }

  function renderInspector(){
    const box=document.getElementById('integratedInspector');
    if(!box)return;
    if(!selectedSpace){box.innerHTML='<h3>Inspector</h3><div class="integrated-inspector-empty">Seleccioná una tarjeta del mapa para editarla.</div>';return}
    const {area,index}=selectedSpace;
    const group=app?.areas?.[area]?.groups?.[index];
    if(!group){selectedSpace=null;renderInspector();return}
    const range=groupRange(area,index,group);
    box.innerHTML=`<h3>${safe(group.name||'Espacio curricular')}</h3>
      <label>Nombre<input id="inspectorName" value="${safe(group.name||'')}"></label>
      <label>Componente<select id="inspectorComponent"><option value="formacion_general" ${group.component!=='formacion_orientada'?'selected':''}>Formación General</option><option value="formacion_orientada" ${group.component==='formacion_orientada'?'selected':''}>Formación Orientada</option></select></label>
      <label>Nivel<select id="inspectorLevel">${Array.from({length:5},(_,i)=>`<option value="${i+1}" ${range.level===i+1?'selected':''}>Nivel ${i+1}</option>`).join('')}</select></label>
      <label>Cuatrimestre inicial<select id="inspectorStart" ${range.isAnnual?'disabled':''}>${Array.from({length:10},(_,i)=>`<option value="${i+1}" ${range.start===i+1?'selected':''}>C${i+1}</option>`).join('')}</select></label>
      <label>Cuatrimestre final<select id="inspectorEnd" ${range.isAnnual?'disabled':''}>${Array.from({length:10},(_,i)=>`<option value="${i+1}" ${range.end===i+1?'selected':''}>C${i+1}</option>`).join('')}</select></label>
      <label>Horas semanales<input id="inspectorHours" type="number" min="0" step="0.5" value="${Number(group.weeklyHours||group.hours||0)}"></label>
      <div class="integrated-inspector-empty">${(group.items||[]).length} contenidos asignados · ${safe(area)}</div>
      <div class="integrated-inspector-actions"><button id="inspectorSave" class="btn primary">Guardar cambios</button><button id="inspectorOpenArea" class="btn">Abrir en matriz</button></div>`;
    document.getElementById('inspectorSave').onclick=saveInspector;
    document.getElementById('inspectorOpenArea').onclick=()=>{closeMap();openArea(area);selected=index;renderGroups()};
  }

  function saveInspector(){
    if(!selectedSpace)return;
    const {area,index}=selectedSpace;
    const group=app?.areas?.[area]?.groups?.[index];
    if(!group)return;
    group.name=document.getElementById('inspectorName').value.trim()||group.name;
    group.component=document.getElementById('inspectorComponent').value;
    group.level=Number(document.getElementById('inspectorLevel').value);
    group.weeklyHours=Math.max(0,Number(document.getElementById('inspectorHours').value)||0);
    group.hours=group.weeklyHours;
    if(CFG?.[area]?.l==='Nivel'){
      group.termStart=group.level*2-1;
      group.termEnd=group.level*2;
    }else{
      group.termStart=Number(document.getElementById('inspectorStart').value);
      group.termEnd=Math.max(group.termStart,Number(document.getElementById('inspectorEnd').value));
    }
    group.term=String(group.termStart);
    save(0);
    renderMap();
    renderInspector();
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
        const matching=groups.map((group,index)=>({group,index,range:groupRange(area,index,group)})).filter(item=>term>=item.range.start&&term<=item.range.end);
        const cards=matching.map(({group,index})=>{
          spaces+=1;
          hours+=Number(group.weeklyHours||group.hours||0);
          contents+=(group.items||[]).length;
          const component=group.component==='formacion_orientada'?'Formación Orientada':'Formación General';
          const selected=selectedSpace?.area===area&&selectedSpace?.index===index?' selected':'';
          return `<div class="integrated-piece${selected}" data-map-area="${safe(area)}" data-map-index="${index}"><strong>${safe(group.name||'Sin nombre')}</strong><small>${component} · ${Number(group.weeklyHours||group.hours||0)} h · ${(group.items||[]).length} contenidos</small></div>`;
        }).join('');
        rows.push(`<div class="integrated-cell">${cards||'<span class="integrated-empty">Sin espacios</span>'}</div>`);
      }
    });
    grid.innerHTML=rows.join('');
    document.querySelectorAll('[data-map-area]').forEach(card=>card.onclick=()=>{selectedSpace={area:card.dataset.mapArea,index:Number(card.dataset.mapIndex)};renderMap();renderInspector()});
    document.getElementById('integratedSpaces').textContent=spaces;
    document.getElementById('integratedHours').textContent=hours;
    document.getElementById('integratedContents').textContent=contents;
  }

  function openMap(){
    ensureOverlay().classList.add('open');
    document.body.style.overflow='hidden';
    renderMap();
    renderInspector();
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