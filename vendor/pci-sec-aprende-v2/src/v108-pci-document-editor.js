(() => {
  const VERSION='V108';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const phase=()=>window.PCIPhase2V28;
  const coverage=()=>window.PCICoverageV91;
  const manualDefaults=[
    {id:'contexto',title:'Identidad y contexto institucional',html:'<p>Completar el encuadre institucional, características de la comunidad educativa y aspectos relevantes para la propuesta curricular.</p>'},
    {id:'fundamentacion',title:'Fundamentación pedagógica',html:'<p>Completar los fundamentos y decisiones pedagógicas que orientan este PCI.</p>'},
    {id:'acuerdos',title:'Acuerdos institucionales de enseñanza y evaluación',html:'<p>Completar acuerdos generales de enseñanza, evaluación, acompañamiento y retroalimentación.</p>'},
    {id:'articulacion',title:'Articulación e implementación',html:'<p>Completar criterios institucionales de articulación entre niveles, áreas, formatos y proyectos.</p>'},
    {id:'seguimiento',title:'Seguimiento y revisión del PCI',html:'<p>Completar responsables, instancias y criterios previstos para el seguimiento y la actualización del PCI.</p>'}
  ];
  let overlay=null;
  let activeEditable=null;

  function documentStore(){
    const api=phase();
    if(!api?.p2)return null;
    const p2=api.p2();
    p2.printDocumentV108=p2.printDocumentV108||{};
    const doc=p2.printDocumentV108;
    if(!Array.isArray(doc.manualSections)||!doc.manualSections.length){
      doc.manualSections=manualDefaults.map(x=>({...x}));
    }
    if(typeof doc.includeCoverage!=='boolean')doc.includeCoverage=true;
    if(typeof doc.includeContents!=='boolean')doc.includeContents=true;
    if(typeof doc.includePlans!=='boolean')doc.includePlans=true;
    return doc;
  }

  function persist(){
    phase()?.save?.();
  }

  function groupName(g){return String(g?.data?.name||g?.name||'Espacio curricular').trim()}
  function members(g){return phase()?.members?.(g)||[]}
  function termLabel(g){return phase()?.termText?.(g)||String(g?.term||'')}
  function typeLabel(g){return phase()?.typeLabel?.(g?.type)||String(g?.type||'Espacio curricular')}
  function allGroups(){return (phase()?.groups?.()||[]).slice().sort((a,b)=>Number(a.year)-Number(b.year)||String(a.area).localeCompare(String(b.area),'es')||String(a.term).localeCompare(String(b.term),'es'))}
  function contentRows(g){return (g?.data?.contents||[]).map(id=>phase()?.findContent?.(id)).filter(Boolean)}
  function plans(g){return Array.isArray(g?.data?.plansBimestrales)?g.data.plansBimestrales:[]}

  function coverageText(g){
    const r=coverage()?.formatCoverage?.(g);
    if(!r)return'';
    if(Array.isArray(r.bySubject)&&r.bySubject.length){
      return r.bySubject.map(x=>`${x.subject}: ${Number(x.used||0)}/${Number(x.total||0)} · ${Number(x.percent||0)}%`).join(' · ');
    }
    if(Array.isArray(r.byComponent)&&r.byComponent.length){
      return r.byComponent.map(x=>`${x.label}: ${Number(x.used||0)}/${Number(x.total||0)} · ${Number(x.percent||0)}%`).join(' · ');
    }
    return Number(r.total)?`${Number(r.used||0)}/${Number(r.total)} · ${Number(r.percent||0)}%`:'';
  }

  function meshTable(groups){
    const rows=groups.map(g=>{
      const ms=members(g).map(x=>x.name).filter(Boolean).join(' + ')||'—';
      return `<tr><td>${esc(g.area||'')}</td><td>${esc(g.year)}.º</td><td>${esc(termLabel(g))}</td><td><strong>${esc(groupName(g))}</strong><small>${esc(typeLabel(g))}</small></td><td>${esc(ms)}</td></tr>`;
    }).join('');
    return `<section class="v108-auto"><h2>Mallado curricular</h2><p class="v108-lead">Se reconstruye automáticamente desde el Mapa de la Oferta y el Desarrollo Curricular vigente.</p><div class="v108-table-wrap"><table class="v108-mesh"><thead><tr><th>Área</th><th>Nivel</th><th>Período</th><th>Espacio curricular</th><th>Materias / componentes</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }

  function groupedContents(g){
    const rows=contentRows(g);
    if(!rows.length)return'<p class="v108-empty">Sin contenidos cargados.</p>';
    const by=new Map();
    rows.forEach(c=>{
      const key=[c.subject||'Contenido',c.axis||'',c.subaxis||''].join('|||');
      if(!by.has(key))by.set(key,{subject:c.subject||'Contenido',axis:c.axis||'',subaxis:c.subaxis||'',rows:[]});
      by.get(key).rows.push(c);
    });
    return [...by.values()].map(x=>`<div class="v108-content-block"><h5>${esc(x.subject)}</h5>${x.axis?`<p class="v108-meta"><b>Eje / núcleo:</b> ${esc(x.axis)}${x.subaxis?` · <b>Subeje:</b> ${esc(x.subaxis)}`:''}</p>`:''}<ul>${x.rows.map(c=>`<li>${esc(c.text||'')}</li>`).join('')}</ul></div>`).join('');
  }

  function planDetail(g){
    const ps=plans(g);
    if(!ps.length)return'<p class="v108-empty">Sin planes cargados.</p>';
    return ps.map((p,i)=>{
      const ids=Array.isArray(p?.contentIds)?p.contentIds:[];
      const contents=ids.map(id=>phase()?.findContent?.(id)).filter(Boolean);
      return `<article class="v108-plan"><h5>Plan ${Number(p?.number)||i+1} · ${esc(p?.name||'')}</h5>${p?.objectives?`<p><b>Objetivos:</b> ${esc(p.objectives)}</p>`:''}${p?.description?`<p>${esc(p.description)}</p>`:''}${contents.length?`<ul>${contents.map(c=>`<li>${esc(c.subject||'')} · ${esc(c.text||'')}</li>`).join('')}</ul>`:'<p class="v108-empty">Sin contenidos asignados a este plan.</p>'}</article>`;
    }).join('');
  }

  function groupSection(g,doc){
    const d=g.data||{};
    const ms=members(g).map(x=>x.name).filter(Boolean).join(' + ')||'—';
    const cov=doc.includeCoverage?coverageText(g):'';
    return `<article class="v108-space">
      <header><div><span>${esc(g.area||'')} · Nivel ${esc(g.year)} · ${esc(termLabel(g))}</span><h3>${esc(groupName(g))}</h3></div><em>${esc(typeLabel(g))}</em></header>
      <dl>
        <dt>Materias / componentes</dt><dd>${esc(ms)}</dd>
        ${d.objectives?`<dt>Objetivos de aprendizaje</dt><dd>${esc(d.objectives)}</dd>`:''}
        ${d.context?`<dt>Contexto problematizador</dt><dd>${esc(d.context)}</dd>`:''}
        ${d.practice?`<dt>Práctica / producción / producto / eje</dt><dd>${esc(d.practice)}</dd>`:''}
        ${d.synopsis?`<dt>Sinopsis</dt><dd>${esc(d.synopsis)}</dd>`:''}
        ${d.door?`<dt>Puerta de entrada</dt><dd>${esc(d.door)}</dd>`:''}
        ${d.plans?`<dt>Planes / proyectos</dt><dd>${esc(d.plans)}</dd>`:''}
        ${cov?`<dt>Cobertura</dt><dd>${esc(cov)}</dd>`:''}
      </dl>
      ${doc.includeContents?`<details open><summary>Contenidos curriculares</summary>${groupedContents(g)}</details>`:''}
      ${doc.includePlans?`<details open><summary>Planes del espacio</summary>${planDetail(g)}</details>`:''}
    </article>`;
  }

  function automaticBody(doc){
    const groups=allGroups();
    const school=String(window.state?.school||window.state?.schoolName||'Escuela');
    const orientation=String(window.state?.active||'');
    return `<section class="v108-cover"><img src="assets/logo-escuela-maestros.svg" alt="Escuela de Maestros"><p>Proyecto Curricular Institucional</p><h1>${esc(school)}</h1><h2>${esc(orientation)}</h2><small>Documento construido desde el PCI Secundaria Aprende</small></section>
      ${meshTable(groups)}
      <section class="v108-auto"><h2>Desarrollo curricular por espacio</h2><p class="v108-lead">Los nombres, agrupamientos, contenidos y planes se leen desde la estructura vigente del sistema.</p>${groups.map(g=>groupSection(g,doc)).join('')}</section>`;
  }

  function manualEditor(section,index){
    return `<article class="v108-manual-card" data-manual-card="${esc(section.id)}">
      <div class="v108-manual-head"><span>Sección editable</span><div><button type="button" data-move="-1" data-index="${index}" title="Subir">↑</button><button type="button" data-move="1" data-index="${index}" title="Bajar">↓</button><button type="button" data-delete-manual="${esc(section.id)}" title="Eliminar">×</button></div></div>
      <input class="v108-title-input" data-manual-title="${esc(section.id)}" value="${esc(section.title)}" aria-label="Título de sección">
      <div class="v108-rich" contenteditable="true" data-manual-body="${esc(section.id)}">${section.html||''}</div>
    </article>`;
  }

  function toolbar(){
    const buttons=[
      ['undo','↶','Deshacer'],['redo','↷','Rehacer'],['bold','B','Negrita'],['italic','I','Cursiva'],['underline','U','Subrayado'],
      ['formatBlock:h2','H2','Título'],['formatBlock:h3','H3','Subtítulo'],['formatBlock:p','¶','Párrafo'],
      ['insertUnorderedList','• Lista','Lista con viñetas'],['insertOrderedList','1. Lista','Lista numerada'],
      ['justifyLeft','≡','Alinear izquierda'],['justifyCenter','≡','Centrar'],['justifyRight','≡','Alinear derecha'],
      ['createLink','🔗','Insertar vínculo'],['removeFormat','Tx','Quitar formato']
    ];
    return `<div class="v108-toolbar">${buttons.map(([cmd,label,title])=>`<button type="button" data-cmd="${esc(cmd)}" title="${esc(title)}">${label}</button>`).join('')}</div>`;
  }

  function render(){
    const doc=documentStore();if(!doc)return;
    if(!overlay)createOverlay();
    const auto=$('v108Auto');
    const manual=$('v108Manual');
    if(auto)auto.innerHTML=automaticBody(doc);
    if(manual)manual.innerHTML=doc.manualSections.map(manualEditor).join('');
    const cov=$('v108Coverage'),cont=$('v108Contents'),pl=$('v108Plans');
    if(cov)cov.checked=doc.includeCoverage;
    if(cont)cont.checked=doc.includeContents;
    if(pl)pl.checked=doc.includePlans;
    bindEditors();
  }

  function bindEditors(){
    document.querySelectorAll('[data-manual-body]').forEach(el=>{
      el.onfocus=()=>{activeEditable=el};
      el.oninput=()=>{
        const doc=documentStore(),s=doc?.manualSections.find(x=>x.id===el.dataset.manualBody);
        if(s){s.html=el.innerHTML;persist()}
      };
    });
    document.querySelectorAll('[data-manual-title]').forEach(el=>el.oninput=()=>{
      const doc=documentStore(),s=doc?.manualSections.find(x=>x.id===el.dataset.manualTitle);
      if(s){s.title=el.value;persist()}
    });
    document.querySelectorAll('[data-delete-manual]').forEach(btn=>btn.onclick=()=>{
      const doc=documentStore();if(!doc)return;
      doc.manualSections=doc.manualSections.filter(x=>x.id!==btn.dataset.deleteManual);persist();render();
    });
    document.querySelectorAll('[data-move]').forEach(btn=>btn.onclick=()=>{
      const doc=documentStore();if(!doc)return;
      const from=Number(btn.dataset.index),to=from+Number(btn.dataset.move);
      if(to<0||to>=doc.manualSections.length)return;
      const [item]=doc.manualSections.splice(from,1);doc.manualSections.splice(to,0,item);persist();render();
    });
  }

  function execCommand(raw){
    if(!activeEditable||!document.body.contains(activeEditable))activeEditable=document.querySelector('[data-manual-body]');
    activeEditable?.focus();
    let cmd=raw,arg=null;
    if(raw.startsWith('formatBlock:')){cmd='formatBlock';arg=raw.split(':')[1]}
    if(cmd==='createLink'){const url=prompt('Pegá la URL del vínculo:');if(!url)return;arg=url}
    try{document.execCommand(cmd,false,arg)}catch{}
    activeEditable?.dispatchEvent(new Event('input',{bubbles:true}));
  }

  function addManual(){
    const doc=documentStore();if(!doc)return;
    const id='manual-'+Date.now().toString(36);
    doc.manualSections.push({id,title:'Nueva sección',html:'<p>Escribí aquí…</p>'});persist();render();
    setTimeout(()=>document.querySelector(`[data-manual-card="${id}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),0);
  }

  function setOption(key,value){
    const doc=documentStore();if(!doc)return;doc[key]=!!value;persist();render();
  }

  function manualPrintBody(doc){
    return doc.manualSections.map(s=>`<section class="v108-manual-print"><h2>${esc(s.title||'Sección')}</h2><div>${s.html||''}</div></section>`).join('');
  }

  function printableHTML(){
    const doc=documentStore();
    const school=String(window.state?.school||window.state?.schoolName||'Escuela');
    const orientation=String(window.state?.active||'');
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>PCI · ${esc(school)} · ${esc(orientation)}</title><style>${printCSS()}</style></head><body><div class="v108-document">${automaticBody(doc)}${manualPrintBody(doc)}</div></body></html>`;
  }

  function printCSS(){
    return `@page{size:A4 portrait;margin:16mm 14mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:Arial,sans-serif;color:#12395c;margin:0;font-size:9.5pt;line-height:1.45}.v108-cover{min-height:245mm;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;page-break-after:always}.v108-cover img{width:220px;margin-bottom:35mm}.v108-cover p{font-size:10pt;text-transform:uppercase;letter-spacing:.12em;color:#126e65;font-weight:700}.v108-cover h1{font-size:28pt;margin:4mm 0 2mm}.v108-cover h2{font-size:18pt;margin:0 0 8mm;font-weight:500}.v108-cover small{color:#657783}.v108-auto,.v108-manual-print{page-break-before:auto;margin-bottom:12mm}.v108-auto>h2,.v108-manual-print>h2{font-size:17pt;border-bottom:2px solid #12395c;padding-bottom:3mm;margin:0 0 5mm}.v108-lead{color:#657783}.v108-table-wrap{overflow:visible}.v108-mesh{width:100%;border-collapse:collapse;font-size:7.5pt}.v108-mesh th,.v108-mesh td{border:1px solid #ccd8df;padding:5px;vertical-align:top}.v108-mesh th{background:#edf3f8;text-align:left}.v108-mesh small{display:block;color:#657783;margin-top:2px}.v108-space{border:1px solid #d8e1e8;border-radius:8px;padding:10px;margin:0 0 8px;break-inside:avoid-page}.v108-space header{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #e1e8ec;padding-bottom:6px;margin-bottom:7px}.v108-space header span{font-size:7pt;color:#126e65;text-transform:uppercase;font-weight:700}.v108-space h3{font-size:12pt;margin:2px 0}.v108-space em{font-size:7pt;color:#657783}.v108-space dl{display:grid;grid-template-columns:42mm 1fr;margin:0;gap:3px 8px}.v108-space dt{font-weight:700}.v108-space dd{margin:0;white-space:pre-wrap}.v108-space details{margin-top:7px}.v108-space summary{font-weight:700}.v108-content-block h5,.v108-plan h5{margin:6px 0 2px;font-size:9pt}.v108-content-block ul,.v108-plan ul{margin:3px 0;padding-left:18px}.v108-meta,.v108-empty{color:#657783;font-size:8pt}.v108-manual-print{page-break-before:always}.v108-manual-print p{margin:0 0 3mm}.v108-manual-print h2{margin-top:0}.v108-manual-print h3{font-size:13pt}.v108-manual-print ul,.v108-manual-print ol{padding-left:22px}@media print{details{display:block}details>summary{display:list-item}}`;
  }

  function printDocument(){
    const w=window.open('','_blank');
    if(!w){alert('El navegador bloqueó la vista de impresión. Habilitá ventanas emergentes.');return}
    w.document.open();w.document.write(printableHTML());w.document.close();
    w.focus();setTimeout(()=>w.print(),250);
  }

  function exportWord(){
    const html=printableHTML();
    const blob=new Blob(['\ufeff',html],{type:'application/msword'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    const school=String(window.state?.school||window.state?.schoolName||'PCI').replace(/[^a-z0-9áéíóúüñ_-]+/gi,'-');
    const orientation=String(window.state?.active||'').replace(/[^a-z0-9áéíóúüñ_-]+/gi,'-');
    a.download=`PCI-${school}-${orientation}.doc`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  function createOverlay(){
    overlay=document.createElement('div');overlay.id='v108Overlay';overlay.innerHTML=`
      <div class="v108-shell">
        <header class="v108-top"><div><span>Documento institucional</span><h1>Impresión / Documento PCI</h1><p>La estructura curricular es automática. Los bloques institucionales son editables y quedan guardados por orientación.</p></div><button id="v108Close" type="button">Cerrar</button></header>
        <div class="v108-actions">
          <button id="v108Print" type="button" class="primary">Imprimir / PDF</button>
          <button id="v108Word" type="button">Descargar Word</button>
          <button id="v108Add" type="button">+ Agregar sección de texto</button>
          <label><input id="v108Coverage" type="checkbox"> Cobertura</label>
          <label><input id="v108Contents" type="checkbox"> Contenidos</label>
          <label><input id="v108Plans" type="checkbox"> Planes</label>
        </div>
        ${toolbar()}
        <main class="v108-work"><section><div class="v108-caption"><strong>Contenido automático</strong><span>Se regenera desde el PCI actual.</span></div><div id="v108Auto" class="v108-paper"></div></section><aside><div class="v108-caption"><strong>Texto institucional editable</strong><span>Formato enriquecido tipo procesador de texto.</span></div><div id="v108Manual"></div></aside></main>
      </div>`;
    document.body.appendChild(overlay);
    $('v108Close').onclick=close;
    $('v108Print').onclick=printDocument;
    $('v108Word').onclick=exportWord;
    $('v108Add').onclick=addManual;
    $('v108Coverage').onchange=e=>setOption('includeCoverage',e.target.checked);
    $('v108Contents').onchange=e=>setOption('includeContents',e.target.checked);
    $('v108Plans').onchange=e=>setOption('includePlans',e.target.checked);
    overlay.querySelectorAll('[data-cmd]').forEach(b=>b.onclick=()=>execCommand(b.dataset.cmd));
  }

  function open(){
    const old=$('printModal');if(old)old.classList.remove('open');
    render();overlay.classList.add('open');document.body.classList.add('v108-lock');
  }
  function close(){overlay?.classList.remove('open');document.body.classList.remove('v108-lock')}

  function install(){
    const btn=$('printBtn');if(btn){btn.textContent='Impresión / Documento PCI';btn.onclick=open}
    if(!$('v108Styles')){
      const style=document.createElement('style');style.id='v108Styles';style.textContent=`
        body.v108-lock{overflow:hidden}#v108Overlay{position:fixed;inset:0;z-index:500;background:#f3f6f8;display:none;overflow:auto;color:#12395c}#v108Overlay.open{display:block}.v108-shell{max-width:1720px;margin:auto;padding:18px 22px 50px}.v108-top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;background:#fff;border:1px solid #d8e1e8;border-radius:18px;padding:18px 20px}.v108-top span,.v108-caption span{font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;color:#126e65;font-weight:850}.v108-top h1{margin:4px 0;font-size:1.7rem}.v108-top p{margin:0;color:#5f7382}.v108-top button,.v108-actions button,.v108-toolbar button,.v108-manual-head button{border:1px solid #cbd7df;background:#fff;color:#12395c;border-radius:9px;padding:8px 10px;font-weight:800}.v108-actions{position:sticky;top:0;z-index:4;display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0;padding:10px;background:#fff;border:1px solid #d8e1e8;border-radius:14px;box-shadow:0 8px 24px rgba(18,57,92,.07)}.v108-actions .primary{background:#12395c;color:#fff;border-color:#12395c}.v108-actions label{display:flex;gap:5px;align-items:center;font-size:.74rem;font-weight:800}.v108-toolbar{position:sticky;top:67px;z-index:3;display:flex;gap:4px;flex-wrap:wrap;padding:8px;background:#edf3f8;border:1px solid #d8e1e8;border-radius:12px}.v108-toolbar button{padding:6px 8px;font-size:.72rem;min-width:31px}.v108-work{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(360px,.65fr);gap:14px;margin-top:12px;align-items:start}.v108-caption{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:6px}.v108-paper,.v108-manual-card{background:#fff;border:1px solid #d8e1e8;box-shadow:0 8px 24px rgba(18,57,92,.05)}.v108-paper{padding:28px;min-height:500px}.v108-cover{padding:34px 8px 48px;border-bottom:1px solid #d8e1e8;margin-bottom:28px}.v108-cover img{width:min(260px,70%);margin-bottom:34px}.v108-cover p{font-size:.75rem;color:#126e65;font-weight:850;text-transform:uppercase;letter-spacing:.08em}.v108-cover h1{font-size:2rem;margin:5px 0}.v108-cover h2{font-size:1.2rem;margin:0 0 16px;font-weight:600}.v108-auto>h2{margin-top:30px;border-bottom:2px solid #12395c;padding-bottom:8px}.v108-lead{color:#5f7382}.v108-table-wrap{overflow:auto}.v108-mesh{width:100%;border-collapse:collapse;font-size:.72rem}.v108-mesh th,.v108-mesh td{border:1px solid #d8e1e8;padding:7px;text-align:left;vertical-align:top}.v108-mesh th{background:#edf3f8}.v108-mesh small{display:block;color:#5f7382;margin-top:3px}.v108-space{border:1px solid #d8e1e8;border-radius:12px;padding:13px;margin:10px 0}.v108-space header{display:flex;justify-content:space-between;gap:10px}.v108-space header span{font-size:.64rem;color:#126e65;font-weight:850;text-transform:uppercase}.v108-space h3{margin:3px 0 10px}.v108-space em{font-size:.7rem;color:#5f7382}.v108-space dl{display:grid;grid-template-columns:190px minmax(0,1fr);gap:5px 8px;font-size:.78rem}.v108-space dt{font-weight:850}.v108-space dd{margin:0;white-space:pre-wrap}.v108-space details{margin-top:8px;border-top:1px solid #e6ecef;padding-top:7px}.v108-space summary{cursor:pointer;font-weight:850}.v108-content-block h5,.v108-plan h5{margin:8px 0 3px}.v108-content-block ul,.v108-plan ul{margin:4px 0;padding-left:20px}.v108-meta,.v108-empty{color:#5f7382;font-size:.72rem}.v108-manual-card{border-radius:14px;padding:12px;margin-bottom:10px}.v108-manual-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.v108-manual-head>span{font-size:.62rem;color:#126e65;text-transform:uppercase;font-weight:850}.v108-manual-head button{padding:4px 7px;font-size:.7rem}.v108-title-input{width:100%;border:0;border-bottom:1px solid #d8e1e8;padding:7px 2px;font-size:1rem;font-weight:900;color:#12395c;outline:none}.v108-rich{min-height:160px;padding:12px 4px;outline:none;line-height:1.55;font-family:Arial,sans-serif;color:#243f55}.v108-rich:focus{box-shadow:inset 0 0 0 2px #83ded3;border-radius:8px;padding:12px}.v108-rich h2,.v108-rich h3{color:#12395c}.v108-rich a{color:#126e65}@media(max-width:1050px){.v108-work{grid-template-columns:1fr}.v108-toolbar{top:74px}.v108-paper{padding:18px}}@media(max-width:650px){.v108-shell{padding:8px}.v108-top{border-radius:12px}.v108-actions{top:0}.v108-toolbar{position:static}.v108-space dl{grid-template-columns:1fr}.v108-paper{padding:12px}}
      `;document.head.appendChild(style);
    }
  }

  window.PCIPrintDocumentV108={open,render,printDocument,exportWord,getDocument:documentStore,version:VERSION};
  window.addEventListener('pci-app-ready',install);
  if(document.readyState!=='loading')setTimeout(install,0);
})();