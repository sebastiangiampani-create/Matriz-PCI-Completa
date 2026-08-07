(()=>{
  const frame=()=>document.getElementById('pci');
  const CONTENT_KEY='pciCurricularBaseV1';
  const CONTENT_VERSION_KEY='pciCurricularBaseVersionsV1';
  const PLAN_KEY='pciStudyPlanV1';
  const PLAN_VERSION_KEY='pciStudyPlanVersionsV1';

  const normalizeHeader=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_');
  function splitCSV(line){const out=[];let cell='',quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if((ch===','||ch===';')&&!quoted){out.push(cell.trim());cell=''}else cell+=ch}out.push(cell.trim());return out}
  function lines(text){return String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim())}
  function indexByAliases(headers,aliases){return headers.findIndex(h=>aliases.includes(h))}

  function parseContents(text){
    const data=lines(text);if(!data.length)return [];
    const headers=splitCSV(data.shift()).map(normalizeHeader);
    const idx={
      id:indexByAliases(headers,['codigo','id','codigo_contenido']),
      area:indexByAliases(headers,['area']),
      subject:indexByAliases(headers,['materia','materia_nes','asignatura']),
      axis:indexByAliases(headers,['eje','bloque','eje_de_contenido']),
      text:indexByAliases(headers,['contenido','contenido_priorizado','descripcion'])
    };
    if(idx.area<0||idx.subject<0||idx.axis<0||idx.text<0)throw new Error('Contenidos: faltan columnas area, materia, eje o contenido.');
    return data.map((line,row)=>{const c=splitCSV(line),area=c[idx.area]?.trim(),subject=c[idx.subject]?.trim(),axis=c[idx.axis]?.trim(),content=c[idx.text]?.trim();if(!area||!subject||!axis||!content)return null;const id=(idx.id>=0&&c[idx.id]?.trim())||`CONT-${Date.now()}-${row+1}`;return [String(id),area,subject,axis,content]}).filter(Boolean);
  }

  function parsePlan(text){
    const data=lines(text);if(!data.length)return [];
    const headers=splitCSV(data.shift()).map(normalizeHeader);
    const idx={
      id:indexByAliases(headers,['codigo','id','codigo_materia']),
      area:indexByAliases(headers,['area']),
      subject:indexByAliases(headers,['materia','materia_nes','asignatura']),
      year:indexByAliases(headers,['anio','ano','año','nivel']),
      hours:indexByAliases(headers,['hc','horas','horas_catedra','carga_horaria']),
      component:indexByAliases(headers,['componente','formacion','tipo_formacion'])
    };
    if(idx.area<0||idx.subject<0||idx.year<0||idx.hours<0)throw new Error('Plan de estudios: faltan columnas area, materia, año/nivel o HC.');
    return data.map((line,row)=>{const c=splitCSV(line),area=c[idx.area]?.trim(),subject=c[idx.subject]?.trim(),year=Number(c[idx.year]),hours=Number(String(c[idx.hours]||'').replace(',','.'));if(!area||!subject||!Number.isFinite(year)||year<1||year>5||!Number.isFinite(hours)||hours<0)return null;const id=(idx.id>=0&&c[idx.id]?.trim())||`PLAN-${Date.now()}-${row+1}`;const component=(idx.component>=0&&c[idx.component]?.trim())||'formacion_general';return {id:String(id),area,subject,year,hours,component}}).filter(Boolean);
  }

  function pushVersion(key,count,label){const versions=JSON.parse(localStorage.getItem(key)||'[]');versions.unshift({id:`v${versions.length+1}`,date:new Date().toISOString(),count,label});localStorage.setItem(key,JSON.stringify(versions.slice(0,20)))}
  function applyContents(rows){const w=frame()?.contentWindow;if(!w)return;w.DATA=rows.map(([id,area,subject,axis,text])=>({id,area,subject,axis,text}));localStorage.setItem(CONTENT_KEY,JSON.stringify(rows));pushVersion(CONTENT_VERSION_KEY,rows.length,'contenidos');try{w.renderAreas?.();w.renderBoard?.()}catch{}}
  function applyPlan(rows){const w=frame()?.contentWindow;if(!w)return;w.PCI_STUDY_PLAN=rows;localStorage.setItem(PLAN_KEY,JSON.stringify(rows));pushVersion(PLAN_VERSION_KEY,rows.length,'materias/año');}
  function restoreSaved(){const w=frame()?.contentWindow;if(!w)return;try{const contents=localStorage.getItem(CONTENT_KEY);if(contents)w.DATA=JSON.parse(contents).map(([id,area,subject,axis,text])=>({id,area,subject,axis,text}));const plan=localStorage.getItem(PLAN_KEY);if(plan)w.PCI_STUDY_PLAN=JSON.parse(plan)}catch{}}
  function download(name,content){const blob=new Blob([content],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
  function contentTemplate(){download('plantilla-contenidos-priorizados.csv','codigo,area,materia,eje,contenido\nCONT-001,Ciencias Sociales,Historia,Sociedades,Contenido priorizado de ejemplo\n')}
  function planTemplate(){download('plantilla-plan-de-estudios.csv','codigo,area,materia,anio,hc,componente\nPLAN-001,Ciencias Sociales,Historia,1,4,formacion_general\nPLAN-002,Ciencias Sociales,Geografia,1,5,formacion_general\n')}

  function mount(){
    if(document.getElementById('curricularAdmin'))return;
    const style=document.createElement('style');
    style.textContent=`.admin-fab{position:fixed;left:16px;bottom:16px;z-index:9999;border:0;border-radius:14px;padding:11px 14px;background:#15374a;color:#fff;font:800 14px system-ui;box-shadow:0 8px 24px #0003}.admin-modal{position:fixed;inset:0;z-index:10000;display:none;background:#0008;padding:20px;overflow:auto}.admin-modal.open{display:grid;place-items:center}.admin-card{width:min(860px,100%);background:#fff;border-radius:20px;padding:20px;font-family:system-ui;color:#15374a}.admin-card h2,.admin-card h3{margin-top:0}.admin-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.admin-section{border:1px solid #dbe5e8;border-radius:16px;padding:14px}.admin-row{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.admin-card button,.admin-card label{border:0;border-radius:12px;padding:10px 13px;font-weight:800;cursor:pointer;background:#e7edef}.admin-card .primary{background:#15374a;color:#fff}.admin-note{color:#687985;font-size:.88rem}.admin-status{padding:10px;border-radius:12px;background:#eef6f7;margin-top:10px}.admin-list{max-height:180px;overflow:auto;border:1px solid #dbe5e8;border-radius:12px;padding:8px;font-size:.82rem}@media(max-width:760px){.admin-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
    const button=document.createElement('button');button.className='admin-fab';button.textContent='Diseño Curricular Base';button.onclick=()=>modal.classList.add('open');
    const modal=document.createElement('section');modal.id='curricularAdmin';modal.className='admin-modal';modal.innerHTML=`<div class="admin-card"><h2>Administrador del Diseño Curricular Base</h2><p class="admin-note">El Plan de Estudios define materias y HC normativas por año. Los Contenidos Priorizados definen qué debe cubrir el PCI.</p><div class="admin-grid"><section class="admin-section"><h3>1. Plan de Estudios</h3><p class="admin-note">Columnas: código, área, materia, año/nivel, HC y componente.</p><div class="admin-row"><label class="primary">Importar plan CSV<input id="studyPlanFile" type="file" accept=".csv,text/csv" hidden></label><button id="studyPlanTemplate">Plantilla</button></div><div id="studyPlanStatus" class="admin-status">Sin plan importado en esta sesión.</div><h4>Versiones</h4><div id="studyPlanVersions" class="admin-list"></div></section><section class="admin-section"><h3>2. Contenidos Priorizados</h3><p class="admin-note">Columnas: código, área, materia, eje y contenido.</p><div class="admin-row"><label class="primary">Importar contenidos CSV<input id="contentFile" type="file" accept=".csv,text/csv" hidden></label><button id="contentTemplate">Plantilla</button></div><div id="contentStatus" class="admin-status">Sin cambios en contenidos.</div><h4>Versiones</h4><div id="contentVersions" class="admin-list"></div></section></div><div class="admin-row"><button id="curricularRestore">Restablecer bases locales</button><button id="curricularClose">Cerrar</button></div></div>`;
    document.body.append(button,modal);
    const renderVersions=(key,el)=>{const data=JSON.parse(localStorage.getItem(key)||'[]');el.innerHTML=data.length?data.map(v=>`<div><strong>${v.id}</strong> · ${v.count} ${v.label||'registros'} · ${new Date(v.date).toLocaleString('es-AR')}</div>`).join(''):'Todavía no hay versiones importadas.'};
    const planStatus=modal.querySelector('#studyPlanStatus'),contentStatus=modal.querySelector('#contentStatus'),planVersions=modal.querySelector('#studyPlanVersions'),contentVersions=modal.querySelector('#contentVersions');
    modal.querySelector('#curricularClose').onclick=()=>modal.classList.remove('open');
    modal.querySelector('#studyPlanTemplate').onclick=planTemplate;
    modal.querySelector('#contentTemplate').onclick=contentTemplate;
    modal.querySelector('#curricularRestore').onclick=()=>{localStorage.removeItem(PLAN_KEY);localStorage.removeItem(CONTENT_KEY);location.reload()};
    modal.querySelector('#studyPlanFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const rows=parsePlan(await file.text());if(!rows.length)throw new Error('La planilla no contiene filas válidas.');applyPlan(rows);planStatus.textContent=`Plan importado: ${rows.length} registros normativos.`;renderVersions(PLAN_VERSION_KEY,planVersions)}catch(error){planStatus.textContent=`Error: ${error.message}`}};
    modal.querySelector('#contentFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const rows=parseContents(await file.text());if(!rows.length)throw new Error('La planilla no contiene filas válidas.');applyContents(rows);contentStatus.textContent=`Base importada: ${rows.length} contenidos priorizados.`;renderVersions(CONTENT_VERSION_KEY,contentVersions)}catch(error){contentStatus.textContent=`Error: ${error.message}`}};
    renderVersions(PLAN_VERSION_KEY,planVersions);renderVersions(CONTENT_VERSION_KEY,contentVersions);
    frame()?.addEventListener('load',()=>setTimeout(restoreSaved,700));setTimeout(restoreSaved,700);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();