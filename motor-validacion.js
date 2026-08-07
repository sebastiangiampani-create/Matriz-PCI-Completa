(()=>{
  const frame=()=>document.getElementById('pci');
  let timer;

  function normalize(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
  function groups(w){return Object.entries(w.app?.areas||{}).flatMap(([area,data])=>(data.groups||[]).map((group,index)=>({area,index,group})))}
  function range(group){const start=Math.max(1,Math.min(10,Number(group.termStart||group.term||1)));const end=Math.max(start,Math.min(10,Number(group.termEnd||group.term||start)));return [start,end]}
  function hoursForTerm(group,term){const fallback=Math.max(0,Number(group.weeklyHours??group.hours??0)||0);return group.hoursMode==='per_term'?Math.max(0,Number(group.hoursByTerm?.[term]??fallback)||0):fallback}
  function level(group){const [start]=range(group);return Number(group.level)||Math.ceil(start/2)}
  function isAnnual(group){const [start,end]=range(group);return end-start===1&&Math.ceil(start/2)===Math.ceil(end/2)}
  function kind(item){const text=normalize(`${item.group.type||''} ${item.group.name||''} ${item.area}`);if(text.includes('proyecto de vinculacion')||text.includes('vinculacion'))return 'proyecto';if(text.includes('laboratorio'))return 'laboratorio';if(text.includes('taller'))return 'taller';return 'otro'}
  function planRows(w){if(Array.isArray(w.PCI_STUDY_PLAN))return w.PCI_STUDY_PLAN;try{return JSON.parse(localStorage.getItem('pciStudyPlanV1')||'[]')}catch{return []}}
  function targetHours(w,item){
    const plan=planRows(w),lvl=level(item.group);if(!plan.length)return null;
    let rows=plan.filter(row=>Number(row.year)===lvl);
    const subjects=Array.isArray(item.group.subjects)?item.group.subjects.map(String):[];
    if(subjects.length)rows=rows.filter(row=>subjects.includes(String(row.subject))||subjects.includes(String(row.id)));
    else rows=rows.filter(row=>String(row.area)===String(item.area));
    if(!rows.length)return null;
    return rows.reduce((sum,row)=>sum+(Number(row.hours)||0),0);
  }

  function validate(w){
    const all=groups(w),issues=[],warnings=[],plan=planRows(w);
    const levelStatus=Array.from({length:5},(_,i)=>({level:i+1,terms:[]}));
    if(!plan.length)issues.push('Plan de Estudios: falta cargar la base normativa de materias y HC.');

    all.forEach(item=>{
      const [start,end]=range(item.group),target=targetHours(w,item);
      if(!String(item.group.name||'').trim())issues.push(`${item.area}: hay un espacio sin nombre.`);
      if((w.CFG?.[item.area]?.l==='Nivel')&&!isAnnual(item.group))issues.push(`${item.group.name||item.area}: el espacio troncal debe ocupar los dos cuatrimestres del nivel.`);
      if(target==null)warnings.push(`${item.group.name||item.area}: no se pudo determinar la carga normativa desde el Plan de Estudios.`);
      for(let term=start;term<=end;term++){
        const actual=hoursForTerm(item.group,term);
        if(actual<=0)issues.push(`${item.group.name||item.area}: falta carga horaria en C${term}.`);
        if(target!=null&&actual!==target)issues.push(`${item.group.name||item.area} · C${term}: ${actual} HC cargadas; corresponden ${target} HC según el Plan de Estudios.`);
        const lvl=Math.ceil(term/2),slot=levelStatus[lvl-1];
        if(slot)slot.terms.push({term,actual,target,name:item.group.name||item.area});
      }
    });

    levelStatus.forEach(slot=>{
      const expected=[slot.level*2-1,slot.level*2];
      expected.forEach(term=>{if(!slot.terms.some(x=>x.term===term))warnings.push(`Nivel ${slot.level}: C${term} no tiene espacios registrados para validar.`)});
    });

    const oriented=all.map(item=>({...item,kind:kind(item)})).filter(item=>item.group.component==='formacion_orientada'||kind(item)!=='otro');
    const workshops=oriented.filter(item=>item.kind==='taller');
    const labs=oriented.filter(item=>item.kind==='laboratorio');
    const projects=oriented.filter(item=>item.kind==='proyecto');
    if(workshops.length!==3)issues.push(`Formación Orientada: hay ${workshops.length} talleres; deben ser 3.`);
    if(labs.length!==3)issues.push(`Formación Orientada: hay ${labs.length} laboratorios; deben ser 3.`);
    if(projects.length!==1)issues.push(`Formación Orientada: debe existir un único Proyecto de Vinculación; actualmente hay ${projects.length}.`);
    projects.forEach(item=>{if(level(item.group)!==5)issues.push('Proyecto de Vinculación: debe ubicarse en Nivel 5.');if(!isAnnual(item.group))issues.push('Proyecto de Vinculación: debe ser anual dentro del Nivel 5.')});

    const coverageText=w.document.getElementById('coveragePanel')?.textContent||'';
    if(coverageText&&/\b[1-9]\d* pendientes\b/.test(coverageText))warnings.push('Cobertura curricular: todavía hay contenidos priorizados pendientes.');

    return {issues:[...new Set(issues)],warnings:[...new Set(warnings)],levelStatus,workshops:workshops.length,labs:labs.length,projects:projects.length,ready:issues.length===0,hasPlan:plan.length>0};
  }

  function render(){
    const f=frame(),w=f?.contentWindow,d=f?.contentDocument;if(!w||!d)return;
    const body=d.getElementById('integratedMap')?.querySelector('.integrated-map-body');if(!body)return;
    let panel=d.getElementById('validationPanel');
    if(!panel){
      const style=d.createElement('style');style.textContent=`#validationPanel{margin-bottom:12px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px}.validation-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.validation-light{font-weight:900;border-radius:999px;padding:7px 11px}.validation-light.ok{background:var(--okbg);color:var(--ok)}.validation-light.bad{background:var(--badbg);color:var(--bad)}.validation-levels{display:grid;grid-template-columns:repeat(5,minmax(150px,1fr));gap:7px;margin:12px 0}.validation-level{border:1px solid var(--line);border-radius:11px;padding:8px}.validation-level strong{display:block;text-align:center}.validation-level small{display:block;margin-top:4px}.validation-list{margin:8px 0 0;padding-left:20px}.validation-sub{margin-top:12px;font-weight:900}@media(max-width:700px){.validation-levels{grid-template-columns:1fr}}`;
      d.head.appendChild(style);panel=d.createElement('section');panel.id='validationPanel';body.insertBefore(panel,body.firstChild);
    }
    const result=validate(w);
    const levelCards=result.levelStatus.map(slot=>`<div class="validation-level"><strong>Nivel ${slot.level}</strong>${slot.terms.length?slot.terms.map(x=>`<small>C${x.term} · ${x.name}: ${x.actual} HC${x.target!=null?` / ${x.target} normativas`:' / objetivo pendiente'}</small>`).join(''):'<small>Sin espacios para validar</small>'}</div>`).join('');
    panel.innerHTML=`<div class="validation-head"><div><strong>Validación institucional</strong><div>${result.issues.length} errores · ${result.warnings.length} advertencias</div></div><span class="validation-light ${result.ready?'ok':'bad'}">${result.ready?'PCI habilitado':'PCI no publicable'}</span></div><div class="validation-levels">${levelCards}</div><div><strong>Base normativa:</strong> ${result.hasPlan?'Plan de Estudios cargado':'pendiente de carga'}</div><div><strong>Formación Orientada:</strong> ${result.workshops}/3 talleres · ${result.labs}/3 laboratorios · ${result.projects}/1 proyecto de vinculación</div>${result.issues.length?`<div class="validation-sub">Errores</div><ul class="validation-list">${result.issues.map(x=>`<li>${x}</li>`).join('')}</ul>`:''}${result.warnings.length?`<div class="validation-sub">Advertencias</div><ul class="validation-list">${result.warnings.map(x=>`<li>${x}</li>`).join('')}</ul>`:''}`;
  }

  function watch(){clearInterval(timer);timer=setInterval(()=>{try{render()}catch(error){console.error('Motor de validación:',error)}},900)}
  frame()?.addEventListener('load',watch);watch();
})();