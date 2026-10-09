(() => {
  const VERSION='V114';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  let selectedKey='',filters={orientation:'',year:'',course:''};

  function root(){
    state.institutional=state.institutional||{};
    const r=state.institutional;
    r.planCriteriaExcelV114=r.planCriteriaExcelV114||{contexts:{}};
    r.planCriteriaExcelV114.contexts=r.planCriteriaExcelV114.contexts||{};
    return r;
  }

  function withOrientation(orientation,fn){
    const prev=state.active;state.active=orientation;
    try{return fn()}finally{state.active=prev}
  }

  function groupsFor(orientation){
    return withOrientation(orientation,()=>window.PCIPhase2V28?.groups?.()||[]);
  }

  function commissionDefs(){
    return window.PCIStudentsCommissionsV72?.commissionDefs?.()||[];
  }

  function studentsFor(key){
    return window.PCIStudentsCommissionsV72?.studentsFor?.(key)||[];
  }

  function planCount(g){
    return String(g?.term||'').includes('-')?4:2;
  }

  function contextKey(orientation,g,n,commission){
    return [orientation,g.id,n,commission.key].join('|||');
  }

  function planName(ctx){
    const p=ctx.plan;
    const direct=String(p?.name||'').trim();
    if(direct)return direct;
    const a=String(p?.elective?.A?.name||'').trim(),b=String(p?.elective?.B?.name||'').trim();
    if(a&&b)return a+' / '+b;
    if(a)return a;if(b)return b;
    return `${ctx.group.data?.name||ctx.group.name||'Espacio'} · Plan ${ctx.planNumber}`;
  }

  function allContexts(){
    const out=[];
    for(const orientation of (state.selected||[])){
      const groups=groupsFor(orientation),commissions=commissionDefs().filter(c=>c.orientation===orientation);
      for(const g of groups){
        const matching=commissions.filter(c=>Number(c.year)===Number(g.year));
        for(const c of matching){
          for(let n=1;n<=planCount(g);n++){
            out.push({
              orientation,group:g,commission:c,plan:g.data?.plansBimestrales?.[n-1]||null,planNumber:n,
              key:contextKey(orientation,g,n,c)
            });
          }
        }
      }
    }
    return out;
  }

  function teachersFor(ctx){
    const api=window.PCIInstitutionalV48,assignments=root().assignments||{},teachers=root().teachers||{};
    if(!api?.implementationRows)return[];
    const ids=new Set();
    for(const row of api.implementationRows(ctx.orientation)||[]){
      if(row.course!==ctx.commission.course)continue;
      if(!(ctx.group.subjectIds||[]).map(String).includes(String(row.subjectId)))continue;
      const tid=assignments[row.instanceId];if(tid)ids.add(String(tid));
    }
    return [...ids].map(id=>teachers[id]).filter(Boolean).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));
  }

  function currentSession(){
    return window.PCIAppAccessV80?.getSession?.()||{role:'admin',teacherId:''};
  }

  function currentAccess(){
    return window.PCIAppAccessV80?.derivedAccess?.()||{role:'admin',editableAreasByOrientation:{}};
  }

  function scopedContexts(){
    const all=allContexts(),session=currentSession(),access=currentAccess();
    if(session.role==='admin')return all;
    if(session.role==='teacher'){
      return all.filter(ctx=>teachersFor(ctx).some(t=>String(t.id)===String(session.teacherId||'')));
    }
    if(session.role==='coordinator'){
      return all.filter(ctx=>(access.editableAreasByOrientation?.[ctx.orientation]||[]).includes(ctx.group.area));
    }
    return[];
  }

  function legacyCriteria(ctx){
    const old=root().grading?.plans?.[ctx.key];
    return Array.isArray(old?.criteria)?old.criteria.map(x=>String(x||'')):[];
  }

  function ensureRecord(ctx){
    const bag=root().planCriteriaExcelV114.contexts;
    let r=bag[ctx.key];
    if(!r){
      const legacy=legacyCriteria(ctx);
      r=bag[ctx.key]={
        version:1,key:ctx.key,orientation:ctx.orientation,groupId:ctx.group.id,planNumber:ctx.planNumber,
        commissionKey:ctx.commission.key,
        criteria:Array.from({length:Math.max(4,legacy.length)},(_,i)=>({
          id:`criterion-${i+1}`,text:legacy[i]||'',validations:{}
        }))
      };
    }
    r.criteria=Array.isArray(r.criteria)?r.criteria:[];
    r.criteria=r.criteria.map((c,i)=>typeof c==='string'?{id:`criterion-${i+1}`,text:c,validations:{}}:{
      id:String(c?.id||`criterion-${i+1}`),text:String(c?.text||''),validations:c?.validations&&typeof c.validations==='object'?c.validations:{}
    });
    while(r.criteria.length<4)r.criteria.push({id:`criterion-${r.criteria.length+1}`,text:'',validations:{}});
    return r;
  }

  function criteriaReady(record){
    return record.criteria.slice(0,4).every(c=>String(c.text||'').trim());
  }

  function validationStats(ctx,record){
    const teachers=teachersFor(ctx);
    let valid=0,total=0;
    for(const c of record.criteria){
      if(!String(c.text||'').trim())continue;
      for(const t of teachers){total++;if(c.validations?.[t.id])valid++}
    }
    return{valid,total,teachers};
  }

  function saveState(){
    try{save()}catch(e){console.warn('[V114 save]',e)}
  }

  function addCriterion(record){
    record.criteria.push({id:`criterion-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,text:'',validations:{}});
    saveState();
  }

  function removeCriterion(record,index){
    const i=Number(index);
    if(!Number.isInteger(i)||i<4||i>=record.criteria.length)return false;
    record.criteria.splice(i,1);saveState();return true;
  }

  function updateCriterion(record,index,text){
    const c=record.criteria[index];if(!c)return;
    const next=String(text||'').trimEnd();
    if(String(c.text||'')!==next){c.text=next;c.validations={};}
  }

  function toggleOwnValidation(ctx,record,index){
    const session=currentSession(),teacherId=String(session.teacherId||'');
    const team=teachersFor(ctx).map(t=>String(t.id));
    if(!teacherId||!team.includes(teacherId))return toast('Solo puede validar un docente asignado a este plan.',true);
    const c=record.criteria[index];
    if(!c||!String(c.text||'').trim())return toast('Primero escribí el criterio.',true);
    c.validations=c.validations||{};
    c.validations[teacherId]=!c.validations[teacherId];
    saveState();renderPlan();
  }

  function findContent(id){
    return window.PCIPhase2V28?.findContent?.(id)||null;
  }

  function planContents(ctx){
    return (ctx.plan?.contentIds||[]).map(id=>findContent(id)).filter(Boolean);
  }

  function ensureScreen(){
    let section=$('v114PlanCriteriaScreen');
    if(section)return section;
    const main=document.querySelector('main.wrap');if(!main)return null;
    section=document.createElement('section');section.id='v114PlanCriteriaScreen';section.className='screen';
    section.innerHTML='<div id="v114Root"></div>';
    main.appendChild(section);
    return section;
  }

  function ensureEntry(){
    const home=$('home');if(!home)return;
    let card=$('v114CriteriaEntry');
    if(!card){
      card=document.createElement('section');card.id='v114CriteriaEntry';card.className='card v114-entry';
    }
    const role=currentSession().role,allowed=['admin','teacher','coordinator'].includes(role);
    const management=$('v71LeanHomeEntry'),pciList=$('pciList');
    if(management?.parentNode){
      management.after(card);
    }else if(pciList?.parentNode){
      pciList.after(card);
    }else if(card.parentNode!==home){
      home.appendChild(card);
    }
    card.hidden=!allowed;
    card.innerHTML=`<div><div class="eyebrow">3 · Calificaciones</div><h2>Planes, criterios y Excel</h2><p>Seleccioná un plan, construí los criterios colegiados, registrá la validación del equipo docente y descargá la planilla vinculada al plan.</p></div><button type="button" class="btn primary" data-v114-open>Abrir Calificaciones</button>`;
    card.querySelector('[data-v114-open]').onclick=openModule;
  }

  function showScreen(){
    const section=ensureScreen();if(!section)return;
    document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
    section.classList.add('active');window.scrollTo(0,0);
  }

  function goHome(){
    document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
    $('home')?.classList.add('active');
    window.PCIHomeRedesignV74?.refresh?.();ensureEntry();window.scrollTo(0,0);
  }

  function openModule(){
    if(!['admin','teacher','coordinator'].includes(currentSession().role))return toast('No tenés permiso para acceder a este espacio.',true);
    selectedKey='';showScreen();renderBrowser();
  }

  function contextOrder(a,b){
    return String(a.orientation||'').localeCompare(String(b.orientation||''),'es')
      || Number(a.group?.year||0)-Number(b.group?.year||0)
      || String(a.commission?.course||'').localeCompare(String(b.commission?.course||''),'es',{numeric:true})
      || String(a.group?.area||'').localeCompare(String(b.group?.area||''),'es')
      || String(a.group?.data?.name||a.group?.name||'').localeCompare(String(b.group?.data?.name||b.group?.name||''),'es',{numeric:true})
      || Number(a.planNumber||0)-Number(b.planNumber||0);
  }

  function filteredContexts(){
    return scopedContexts().filter(ctx=>
      (!filters.orientation||ctx.orientation===filters.orientation)&&
      (!filters.year||String(ctx.group.year)===String(filters.year))&&
      (!filters.course||ctx.commission.course===filters.course)
    ).sort(contextOrder);
  }

  function renderBrowser(){
    const host=$('v114Root');if(!host)return;
    const all=scopedContexts(),list=filteredContexts();
    const orientations=[...new Set(all.map(x=>x.orientation))].sort((a,b)=>a.localeCompare(b,'es'));
    const years=[...new Set(all.map(x=>Number(x.group.year)))].filter(Boolean).sort((a,b)=>a-b);
    const courses=[...new Set(all.map(x=>x.commission.course))].sort((a,b)=>a.localeCompare(b,'es'));
    host.innerHTML=`
      <div class="v114-topbar"><button type="button" class="btn soft" data-v114-home>← Inicio</button></div>
      <div class="v114-hero"><div class="eyebrow">Calificaciones</div><h1>Planes, criterios y Excel</h1><p>Este espacio no carga calificaciones online: toma los planes existentes, construye criterios y genera la planilla de trabajo.</p></div>
      <section class="v114-filter card">
        <div class="v114-filter-head"><div><div class="eyebrow">Planes disponibles</div><h2>Elegí el plan y la comisión</h2></div><button class="btn soft" type="button" data-v114-clear>Limpiar filtros</button></div>
        <div class="v114-filter-grid">
          <label>Orientación<select data-v114-filter="orientation"><option value="">Todas</option>${orientations.map(x=>`<option value="${esc(x)}" ${filters.orientation===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label>
          <label>Nivel<select data-v114-filter="year"><option value="">Todos</option>${years.map(x=>`<option value="${x}" ${String(filters.year)===String(x)?'selected':''}>Nivel ${x}</option>`).join('')}</select></label>
          <label>Comisión<select data-v114-filter="course"><option value="">Todas</option>${courses.map(x=>`<option value="${esc(x)}" ${filters.course===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label>
        </div>
      </section>
      <div class="v114-list">${list.length?list.map(ctx=>{
        const rec=ensureRecord(ctx),stats=validationStats(ctx,rec),students=studentsFor(ctx.commission.key),teachers=stats.teachers;
        return `<article class="v114-plan-card">
          <div class="v114-card-top"><span>${esc(ctx.orientation)} · Nivel ${esc(ctx.group.year)} · ${esc(ctx.commission.course)}</span><b>${criteriaReady(rec)?'Criterios listos':'Criterios pendientes'}</b></div>
          <h3>${esc(ctx.group.data?.name||ctx.group.name)} · Plan ${ctx.planNumber}</h3>
          <p>${esc(planName(ctx))}</p>
          <div class="v114-meta"><span><strong>${teachers.length}</strong> docentes</span><span><strong>${students.length}</strong> estudiantes</span><span><strong>${stats.valid}/${stats.total}</strong> validaciones</span></div>
          <button type="button" class="btn primary" data-v114-plan="${esc(ctx.key)}">Abrir plan</button>
        </article>`;
      }).join(''):'<div class="v114-empty"><strong>No hay planes disponibles con este acceso o estos filtros.</strong><span>Revisá orientaciones, comisiones y asignaciones docentes.</span></div>'}</div>`;
    host.querySelector('[data-v114-home]').onclick=goHome;
    host.querySelector('[data-v114-clear]').onclick=()=>{filters={orientation:'',year:'',course:''};renderBrowser()};
    host.querySelectorAll('[data-v114-filter]').forEach(el=>el.onchange=()=>{filters[el.dataset.v114Filter]=el.value;renderBrowser()});
    host.querySelectorAll('[data-v114-plan]').forEach(b=>b.onclick=()=>{selectedKey=b.dataset.v114Plan;renderPlan()});
  }

  function renderPlan(){
    const host=$('v114Root');if(!host)return;
    const ctx=scopedContexts().find(x=>x.key===selectedKey)||allContexts().find(x=>x.key===selectedKey);
    if(!ctx)return renderBrowser();
    const rec=ensureRecord(ctx),teachers=teachersFor(ctx),students=studentsFor(ctx.commission.key),contents=planContents(ctx),stats=validationStats(ctx,rec),session=currentSession();
    const ownTeacher=teachers.some(t=>String(t.id)===String(session.teacherId||''));
    host.innerHTML=`
      <div class="v114-topbar"><button type="button" class="btn soft" data-v114-back>← Planes</button></div>
      <header class="v114-plan-head">
        <div><div class="eyebrow">${esc(ctx.orientation)} · ${esc(ctx.commission.course)}</div><h1>${esc(ctx.group.data?.name||ctx.group.name)} · Plan ${ctx.planNumber}</h1><p>${esc(planName(ctx))}</p></div>
        <button type="button" class="btn primary" data-v114-download>Descargar Excel</button>
      </header>
      <section class="card v114-readonly">
        <div class="eyebrow">Datos del plan · solo lectura</div>
        <div class="v114-plan-grid">
          <div><span>Objetivos de aprendizaje</span><p>${esc(ctx.plan?.objectives||'Sin objetivos cargados en el plan.')}</p></div>
          <div><span>Equipo docente</span><p>${teachers.length?teachers.map(t=>esc(t.name)).join(' · '):'Sin docentes asignados.'}</p></div>
        </div>
        <details open><summary>Contenidos del plan (${contents.length})</summary>
          <div class="v114-content-list">${contents.length?contents.map(c=>`<article><small>${esc(c.subject||'')}${c.axis?` · ${esc(c.axis)}`:''}${c.subaxis?` · ${esc(c.subaxis)}`:''}</small><p>${esc(c.text||'')}</p></article>`).join(''):'<p class="v114-muted">El plan todavía no tiene contenidos seleccionados.</p>'}</div>
        </details>
      </section>
      <section class="card v114-criteria">
        <div class="v114-section-head"><div><div class="eyebrow">Criterios colegiados</div><h2>Mínimo obligatorio: 4 criterios</h2><p>Si se modifica un criterio, sus validaciones anteriores se reinician automáticamente.</p></div><span>${stats.valid}/${stats.total} validaciones docentes</span></div>
        <div class="v114-criteria-grid">${rec.criteria.map((c,i)=>`
          <article class="v114-criterion">
            <div class="v114-criterion-title"><strong>Criterio ${i+1} ${i<4?'· obligatorio':'· adicional'}</strong>${i>=4?`<button type="button" data-v114-remove="${i}">Quitar</button>`:''}</div>
            <textarea data-v114-criterion="${i}" placeholder="Escribí el criterio acordado por el equipo docente">${esc(c.text)}</textarea>
            <div class="v114-validations">${teachers.length?teachers.map(t=>{
              const ok=!!c.validations?.[t.id],mine=String(t.id)===String(session.teacherId||'');
              return `<span class="${ok?'ok':'pending'}"><strong>${esc(t.name)}</strong><small>${ok?'Validado':'Pendiente'}</small>${mine&&String(c.text||'').trim()?`<button type="button" data-v114-validate="${i}">${ok?'Quitar validación':'Validar criterio'}</button>`:''}</span>`;
            }).join(''):'<span class="v114-no-team">Sin docentes asignados al plan.</span>'}</div>
          </article>`).join('')}</div>
        <div class="v114-actions">
          <button type="button" class="btn soft" data-v114-add>+ Agregar criterio</button>
          <button type="button" class="btn primary" data-v114-save>Guardar criterios</button>
          <span class="${criteriaReady(rec)?'ok':'pending'}">${criteriaReady(rec)?'Criterios mínimos completos':'Completá los 4 criterios obligatorios'}</span>
        </div>
        ${!ownTeacher&&['teacher','coordinator'].includes(session.role)?'<p class="v114-note">Podés construir criterios dentro de tu alcance, pero la validación individual solo la realiza un docente asignado al plan.</p>':''}
      </section>
      <section class="card v114-excel-info">
        <div class="eyebrow">Excel vinculado al plan</div><h2>El archivo tendrá 3 pestañas</h2>
        <div class="v114-three"><div><strong>PLAN</strong><span>Datos, objetivos y contenidos del plan.</span></div><div><strong>CRITERIOS</strong><span>Criterios y validación individual de cada docente.</span></div><div><strong>CARGA</strong><span>Listado de estudiantes con un casillero por criterio y por docente.</span></div></div>
      </section>`;
    host.querySelector('[data-v114-back]').onclick=renderBrowser;
    host.querySelectorAll('[data-v114-criterion]').forEach(el=>el.oninput=()=>updateCriterion(rec,Number(el.dataset.v114Criterion),el.value));
    host.querySelector('[data-v114-save]').onclick=()=>{host.querySelectorAll('[data-v114-criterion]').forEach(el=>updateCriterion(rec,Number(el.dataset.v114Criterion),el.value));saveState();renderPlan();toast('Criterios guardados.')};
    host.querySelector('[data-v114-add]').onclick=()=>{host.querySelectorAll('[data-v114-criterion]').forEach(el=>updateCriterion(rec,Number(el.dataset.v114Criterion),el.value));addCriterion(rec);renderPlan()};
    host.querySelectorAll('[data-v114-remove]').forEach(b=>b.onclick=()=>{host.querySelectorAll('[data-v114-criterion]').forEach(el=>updateCriterion(rec,Number(el.dataset.v114Criterion),el.value));if(removeCriterion(rec,Number(b.dataset.v114Remove)))renderPlan()});
    host.querySelectorAll('[data-v114-validate]').forEach(b=>b.onclick=()=>{host.querySelectorAll('[data-v114-criterion]').forEach(el=>updateCriterion(rec,Number(el.dataset.v114Criterion),el.value));saveState();toggleOwnValidation(ctx,rec,Number(b.dataset.v114Validate))});
    host.querySelector('[data-v114-download]').onclick=e=>downloadWorkbook(ctx,rec,e.currentTarget);
  }

  let excelLoaderPromise=null;
  function waitExcelScript(script,timeoutMs=9000){
    return new Promise((resolve,reject)=>{
      if(window.ExcelJS)return resolve(window.ExcelJS);
      let done=false;
      const finish=(ok,value)=>{if(done)return;done=true;clearTimeout(timer);script.removeEventListener('load',onload);script.removeEventListener('error',onerror);ok?resolve(value):reject(value)};
      const onload=()=>window.ExcelJS?finish(true,window.ExcelJS):finish(false,new Error('El generador de Excel cargó sin inicializarse.'));
      const onerror=()=>finish(false,new Error('No se pudo cargar el generador de Excel.'));
      const timer=setTimeout(()=>finish(false,new Error('La carga del generador de Excel demoró demasiado.')),timeoutMs);
      script.addEventListener('load',onload,{once:true});script.addEventListener('error',onerror,{once:true});
    });
  }

  function loadExcelJS(){
    if(window.ExcelJS)return Promise.resolve(window.ExcelJS);
    if(excelLoaderPromise)return excelLoaderPromise;
    excelLoaderPromise=(async()=>{
      const prior=document.querySelector('script[data-pci-exceljs]');
      if(prior&&!window.ExcelJS){
        try{return await waitExcelScript(prior,3500)}
        catch{try{prior.remove()}catch{}}
      }
      const urls=[
        'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
        'https://unpkg.com/exceljs@4.4.0/dist/exceljs.min.js'
      ];
      let lastError=null;
      for(const url of urls){
        const script=document.createElement('script');script.dataset.pciExceljs='1';script.async=true;script.src=url;document.head.appendChild(script);
        try{
          const lib=await waitExcelScript(script,10000);
          if(lib)return lib;
        }catch(error){lastError=error;try{script.remove()}catch{}}
      }
      throw lastError||new Error('No se pudo cargar el generador de Excel.');
    })();
    excelLoaderPromise.catch(()=>{excelLoaderPromise=null});
    return excelLoaderPromise;
  }

  function setSheetHeader(row){
    row.font={bold:true};row.alignment={vertical:'middle',wrapText:true};row.height=26;
  }

  function excelColumnName(number){
    let n=Math.max(1,Number(number)||1),out='';
    while(n>0){n--;out=String.fromCharCode(65+(n%26))+out;n=Math.floor(n/26)}
    return out;
  }

  async function downloadWorkbook(ctx,rec,trigger=null){
    if(!criteriaReady(rec))return toast('Primero completá y guardá los cuatro criterios obligatorios.',true);
    const originalText=trigger?.textContent||'Descargar Excel';
    if(trigger){trigger.disabled=true;trigger.textContent='Generando Excel…'}
    try{
      const ExcelJS=await loadExcelJS(),wb=new ExcelJS.Workbook(),teachers=teachersFor(ctx),students=studentsFor(ctx.commission.key),contents=planContents(ctx);
      wb.creator='PCI Secundaria Aprende';wb.created=new Date();

      const plan=wb.addWorksheet('PLAN');
      plan.columns=[{width:28},{width:70},{width:28},{width:28}];
      plan.addRow(['PLAN VINCULADO','','','']);plan.mergeCells('A1:D1');plan.getCell('A1').font={bold:true,size:16};
      [
        ['Escuela',state.school||''],['Orientación',ctx.orientation],['Nivel',Number(ctx.group.year)||''],['Comisión',ctx.commission.course],
        ['Área',ctx.group.area||''],['Espacio / agrupamiento',ctx.group.data?.name||ctx.group.name||''],['Plan',ctx.planNumber],['Nombre del plan',planName(ctx)],
        ['Equipo docente',teachers.map(t=>t.name).join(' · ')]
      ].forEach(r=>plan.addRow(r));
      plan.addRow([]);plan.addRow(['OBJETIVOS DE APRENDIZAJE']);plan.getRow(plan.rowCount).font={bold:true};
      const objectiveRow=plan.addRow([ctx.plan?.objectives||'Sin objetivos cargados']);plan.mergeCells(`A${objectiveRow.number}:D${objectiveRow.number}`);objectiveRow.alignment={wrapText:true,vertical:'top'};objectiveRow.height=60;
      plan.addRow([]);const ch=plan.addRow(['CONTENIDOS DEL PLAN','Materia','Eje / subeje','Contenido']);setSheetHeader(ch);
      if(contents.length){
        contents.forEach((c,i)=>plan.addRow([i+1,c.subject||'', [c.axis||'',c.subaxis||''].filter(Boolean).join(' · '), c.text||'']));
      }else plan.addRow(['—','','','Sin contenidos seleccionados']);
      const hiddenMeta=[
        ['__PLAN_KEY',ctx.key],['__GROUP_ID',ctx.group.id],['__COMMISSION_KEY',ctx.commission.key],['__PLAN_NUMBER',ctx.planNumber],['__VERSION',VERSION]
      ];
      plan.addRow([]);hiddenMeta.forEach(x=>{const row=plan.addRow(x);row.hidden=true});
      plan.views=[{state:'frozen',ySplit:1}];
      plan.eachRow(row=>row.alignment={...row.alignment,wrapText:true,vertical:'top'});

      const crit=wb.addWorksheet('CRITERIOS');
      crit.columns=[{header:'ID criterio',key:'id',width:18},{header:'Criterio',key:'n',width:12},{header:'Tipo',key:'type',width:16},{header:'Texto del criterio',key:'text',width:55},...teachers.map(t=>({header:t.name,key:`t_${t.id}`,width:22}))];
      setSheetHeader(crit.getRow(1));
      rec.criteria.filter(c=>String(c.text||'').trim()).forEach((c,i)=>{
        const row={id:c.id,n:`Criterio ${i+1}`,type:i<4?'Obligatorio':'Adicional',text:c.text};
        teachers.forEach(t=>row[`t_${t.id}`]=c.validations?.[t.id]?'VALIDADO':'PENDIENTE');
        crit.addRow(row);
      });
      crit.getColumn(1).hidden=true;crit.views=[{state:'frozen',ySplit:1}];crit.autoFilter={from:'A1',to:excelColumnName(crit.columnCount)+'1'};
      crit.eachRow(row=>row.alignment={vertical:'top',wrapText:true});

      const load=wb.addWorksheet('CARGA');
      const visibleCriteria=rec.criteria.filter(c=>String(c.text||'').trim());
      const gradeTeachers=teachers.length?teachers:[{id:'sin-docente',name:'Sin docente asignado'}];
      const criterionLoadColumns=visibleCriteria.flatMap((c,i)=>gradeTeachers.map((t,j)=>({
        header:`Criterio ${i+1} · ${c.text} · ${t.name||'Docente'}`,
        key:`c${i+1}_t${j+1}`,
        width:36
      })));
      load.columns=[
        {header:'__PLAN_KEY',key:'planKey',width:18},{header:'__STUDENT_ID',key:'studentId',width:18},{header:'DNI',key:'dni',width:16},
        {header:'Apellido',key:'lastName',width:24},{header:'Nombre',key:'firstName',width:24},
        ...criterionLoadColumns,
        {header:'Estado del plan',key:'status',width:20},{header:'Calificación final',key:'final',width:18},{header:'Observaciones',key:'notes',width:35}
      ];
      setSheetHeader(load.getRow(1));
      students.forEach(s=>load.addRow({planKey:ctx.key,studentId:s.dni||'',dni:s.dni||'',lastName:s.lastName||'',firstName:s.firstName||'',status:'',final:'',notes:''}));
      load.getColumn(1).hidden=true;load.getColumn(2).hidden=true;
      load.views=[{state:'frozen',ySplit:1,xSplit:5}];load.autoFilter={from:'A1',to:excelColumnName(load.columnCount)+'1'};
      const statusCol=5+criterionLoadColumns.length+1,finalCol=statusCol+1;
      for(let r=2;r<=Math.max(2,load.rowCount);r++){
        load.getCell(r,statusCol).dataValidation={type:'list',allowBlank:true,formulae:['"No iniciado,En proceso,Finalizado"']};
        load.getCell(r,finalCol).dataValidation={type:'whole',operator:'between',allowBlank:true,formulae:[6,10],showErrorMessage:true,errorTitle:'Calificación',error:'La calificación final debe estar entre 6 y 10.'};
      }
      load.eachRow(row=>row.alignment={vertical:'top',wrapText:true});

      const buffer=await wb.xlsx.writeBuffer(),blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      if(!blob.size)throw new Error('El archivo Excel se generó vacío.');
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=`plan-${ctx.planNumber}-${slug(ctx.group.data?.name||ctx.group.name)}-${slug(ctx.commission.course)}.xlsx`;
      a.style.display='none';document.body.appendChild(a);a.click();
      setTimeout(()=>{try{a.remove()}catch{}try{URL.revokeObjectURL(url)}catch{}},5000);
      toast(`Excel descargado: PLAN · CRITERIOS · CARGA (${students.length} estudiantes).`);
    }catch(e){
      console.error('[V114 Excel]',e);
      toast('No se pudo descargar el Excel. '+(e.message||String(e)),true);
    }finally{
      if(trigger){trigger.disabled=false;trigger.textContent=originalText}
    }
  }

  function refreshAccess(){
    ensureEntry();
    if($('v114PlanCriteriaScreen')?.classList.contains('active')&&!['admin','teacher','coordinator'].includes(currentSession().role))goHome();
  }

  function start(){ensureScreen();ensureEntry();refreshAccess();loadExcelJS().catch(()=>{})}
  window.addEventListener('pci-app-ready',()=>setTimeout(start,1100));
  window.addEventListener('pci-access-changed',()=>setTimeout(refreshAccess,50));
  setTimeout(start,1900);

  const style=document.createElement('style');style.textContent=`
    .v114-entry{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:24px;padding:20px;border-radius:22px;background:linear-gradient(135deg,#f8fbfd,#eef8f6);border-color:#a8d9d2}.v114-entry h2{margin:4px 0 6px}.v114-entry p{margin:0;color:var(--muted);font-size:.7rem;line-height:1.45;max-width:850px}
    .v114-topbar{margin-bottom:12px}.v114-hero{margin:-22px -24px 16px;padding:28px 24px;border-radius:0 0 28px 28px;background:linear-gradient(135deg,#edf3f8,#f7fbfa)}.v114-hero h1{margin:4px 0 6px;font-size:clamp(1.8rem,3vw,3rem)}.v114-hero p{margin:0;color:var(--muted)}
    .v114-filter{padding:16px}.v114-filter-head,.v114-section-head,.v114-plan-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.v114-filter-head h2,.v114-section-head h2{margin:4px 0}.v114-filter-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin-top:12px}.v114-filter-grid label{display:grid;gap:5px;font-size:.57rem;font-weight:900;color:var(--muted)}.v114-filter-grid select{padding:9px;border:1px solid var(--line);border-radius:10px;background:#fff}
    .v114-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}.v114-plan-card{padding:17px;border:1px solid var(--line);border-radius:18px;background:#fff;box-shadow:var(--shadow)}.v114-card-top{display:flex;justify-content:space-between;gap:8px;font-size:.54rem;color:var(--muted)}.v114-card-top b{color:var(--mint-dark)}.v114-plan-card h3{margin:8px 0 4px}.v114-plan-card p{margin:0;color:var(--muted);font-size:.62rem}.v114-meta{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}.v114-meta span{padding:6px 8px;border-radius:999px;background:var(--band);font-size:.54rem}.v114-meta strong{color:var(--ink)}
    .v114-empty{grid-column:1/-1;display:grid;gap:5px;padding:22px;border:1px dashed var(--line);border-radius:16px;color:var(--muted)}.v114-empty strong{color:var(--ink)}
    .v114-plan-head{margin-bottom:14px}.v114-plan-head h1{margin:4px 0}.v114-plan-head p{margin:0;color:var(--muted)}.v114-readonly,.v114-criteria,.v114-excel-info{padding:18px;margin-top:14px}.v114-plan-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:10px;margin-top:10px}.v114-plan-grid>div{padding:12px;border-radius:12px;background:var(--band)}.v114-plan-grid span{display:block;font-size:.55rem;font-weight:900;color:var(--muted)}.v114-plan-grid p{margin:5px 0 0;white-space:pre-wrap;font-size:.68rem;line-height:1.45}.v114-readonly details{margin-top:12px}.v114-readonly summary{font-weight:900;cursor:pointer}.v114-content-list{display:grid;gap:7px;margin-top:8px}.v114-content-list article{padding:9px;border:1px solid var(--line);border-radius:10px}.v114-content-list small{color:var(--mint-dark);font-size:.52rem;font-weight:850}.v114-content-list p{margin:4px 0 0;font-size:.64rem}.v114-muted{color:var(--muted)}
    .v114-section-head p{margin:0;color:var(--muted);font-size:.64rem}.v114-section-head>span{padding:7px 9px;border-radius:999px;background:var(--band);font-size:.55rem;font-weight:900}.v114-criteria-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:12px}.v114-criterion{padding:12px;border:1px solid var(--line);border-radius:13px}.v114-criterion-title{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:.6rem}.v114-criterion-title button{border:0;background:transparent;color:var(--danger);font-size:.52rem;font-weight:900}.v114-criterion textarea{width:100%;min-height:82px;margin-top:7px;padding:9px;border:1px solid var(--line);border-radius:9px;resize:vertical}.v114-validations{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.v114-validations>span{display:grid;gap:2px;min-width:120px;padding:7px;border-radius:9px;background:var(--band)}.v114-validations>span.ok{background:var(--ok-soft)}.v114-validations>span.pending{background:var(--gold-soft)}.v114-validations strong{font-size:.52rem}.v114-validations small{font-size:.47rem;color:var(--muted)}.v114-validations button{margin-top:3px;border:0;border-radius:999px;background:#fff;padding:5px 7px;font-size:.48rem;font-weight:900;color:var(--ink)}.v114-no-team{font-size:.52rem;color:var(--muted)}.v114-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}.v114-actions>span{font-size:.56rem;font-weight:900}.v114-actions>span.ok{color:var(--ok)}.v114-actions>span.pending{color:#8a6414}.v114-note{margin:10px 0 0;color:var(--muted);font-size:.58rem}
    .v114-excel-info h2{margin:4px 0 10px}.v114-three{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.v114-three div{padding:11px;border-radius:12px;background:var(--band)}.v114-three strong{display:block}.v114-three span{display:block;margin-top:3px;color:var(--muted);font-size:.58rem;line-height:1.35}
    @media(max-width:850px){.v114-list,.v114-criteria-grid,.v114-plan-grid,.v114-three{grid-template-columns:1fr}.v114-filter-grid{grid-template-columns:1fr 1fr}.v114-entry,.v114-plan-head,.v114-filter-head,.v114-section-head{align-items:flex-start;flex-direction:column}.v114-entry .btn,.v114-plan-head .btn{width:100%}}@media(max-width:620px){.v114-filter-grid{grid-template-columns:1fr}.v114-hero{margin:-18px -12px 14px;padding:20px 14px}.v114-entry{padding:16px}}
  `;document.head.appendChild(style);

  window.PCIPlanCriteriaExcelV114={
    openModule,allContexts,scopedContexts,ensureRecord,criteriaReady,validationStats,teachersFor,studentsFor,downloadWorkbook,
    addCriterion,removeCriterion,updateCriterion,contextOrder,excelColumnName,version:VERSION
  };
})();