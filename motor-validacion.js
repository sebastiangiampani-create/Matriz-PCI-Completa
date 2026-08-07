(()=>{
  const frame=()=>document.getElementById('pci');
  const TARGET_HOURS=9;
  let timer;

  function normalize(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
  function groups(w){return Object.entries(w.app?.areas||{}).flatMap(([area,data])=>(data.groups||[]).map((group,index)=>({area,index,group})))}
  function range(group){const start=Math.max(1,Math.min(10,Number(group.termStart||group.term||1)));const end=Math.max(start,Math.min(10,Number(group.termEnd||group.term||start)));return [start,end]}
  function hoursForTerm(group,term){const fallback=Math.max(0,Number(group.weeklyHours??group.hours??0)||0);return group.hoursMode==='per_term'?Math.max(0,Number(group.hoursByTerm?.[term]??fallback)||0):fallback}
  function level(group){const [start]=range(group);return Number(group.level)||Math.ceil(start/2)}
  function isAnnual(group){const [start,end]=range(group);return end-start===1&&Math.ceil(start/2)===Math.ceil(end/2)}
  function kind(item){const text=normalize(`${item.group.type||''} ${item.group.name||''} ${item.area}`);if(text.includes('proyecto de vinculacion')||text.includes('vinculacion'))return 'proyecto';if(text.includes('laboratorio'))return 'laboratorio';if(text.includes('taller'))return 'taller';return 'otro'}

  function validate(w){
    const all=groups(w),issues=[],warnings=[];
    const termHours=Array(10).fill(0);
    all.forEach(item=>{
      const [start,end]=range(item.group);
      if(!String(item.group.name||'').trim())issues.push(`${item.area}: hay un espacio sin nombre.`);
      for(let term=start;term<=end;term++){
        const h=hoursForTerm(item.group,term);
        termHours[term-1]+=h;
        if(h<=0)issues.push(`${item.group.name||item.area}: falta carga horaria en C${term}.`);
      }
      if((w.CFG?.[item.area]?.l==='Nivel')&&!isAnnual(item.group))issues.push(`${item.group.name||item.area}: el espacio troncal debe ocupar los dos cuatrimestres del nivel.`);
    });

    termHours.forEach((total,index)=>{
      if(total!==TARGET_HOURS)issues.push(`C${index+1}: ${total} HC; se requieren ${TARGET_HOURS}.`);
    });
    const levelStatus=Array.from({length:5},(_,i)=>({level:i+1,c1:termHours[i*2],c2:termHours[(i*2)+1],valid:termHours[i*2]===TARGET_HOURS&&termHours[(i*2)+1]===TARGET_HOURS}));

    const oriented=all.map(item=>({...item,kind:kind(item)})).filter(item=>item.group.component==='formacion_orientada'||kind(item)!=='otro');
    const workshops=oriented.filter(item=>item.kind==='taller');
    const labs=oriented.filter(item=>item.kind==='laboratorio');
    const projects=oriented.filter(item=>item.kind==='proyecto');
    if(workshops.length!==3)issues.push(`Formación Orientada: hay ${workshops.length} talleres; deben ser 3.`);
    if(labs.length!==3)issues.push(`Formación Orientada: hay ${labs.length} laboratorios; deben ser 3.`);
    if(projects.length!==1)issues.push(`Formación Orientada: debe existir un único Proyecto de Vinculación; actualmente hay ${projects.length}.`);
    projects.forEach(item=>{if(level(item.group)!==5)issues.push('Proyecto de Vinculación: debe ubicarse en Nivel 5.');if(!isAnnual(item.group))issues.push('Proyecto de Vinculación: debe ser anual dentro del Nivel 5.')});

    const coveragePanel=w.document.getElementById('coveragePanel');
    const coverageText=coveragePanel?.textContent||'';
    if(coverageText&&/\b[1-9]\d* pendientes\b/.test(coverageText))warnings.push('Cobertura curricular: todavía hay contenidos priorizados pendientes.');

    return {issues:[...new Set(issues)],warnings:[...new Set(warnings)],termHours,levelStatus,workshops:workshops.length,labs:labs.length,projects:projects.length,ready:issues.length===0};
  }

  function render(){
    const f=frame(),w=f?.contentWindow,d=f?.contentDocument;if(!w||!d)return;
    const overlay=d.getElementById('integratedMap'),body=overlay?.querySelector('.integrated-map-body');if(!body)return;
    let panel=d.getElementById('validationPanel');
    if(!panel){
      const style=d.createElement('style');style.textContent=`#validationPanel{margin-bottom:12px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px}.validation-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.validation-light{font-weight:900;border-radius:999px;padding:7px 11px}.validation-light.ok{background:var(--okbg);color:var(--ok)}.validation-light.bad{background:var(--badbg);color:var(--bad)}.validation-levels{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:7px;margin:12px 0}.validation-level{border:1px solid var(--line);border-radius:11px;padding:8px;text-align:center}.validation-level.ok{background:var(--okbg);color:var(--ok)}.validation-level.bad{background:var(--badbg);color:var(--bad)}.validation-level strong,.validation-level span{display:block}.validation-list{margin:8px 0 0;padding-left:20px}.validation-sub{margin-top:12px;font-weight:900}@media(max-width:700px){.validation-levels{grid-template-columns:1fr}}`;
      d.head.appendChild(style);panel=d.createElement('section');panel.id='validationPanel';body.insertBefore(panel,body.firstChild);
    }
    const result=validate(w);
    panel.innerHTML=`<div class="validation-head"><div><strong>Validación institucional</strong><div>${result.issues.length} errores · ${result.warnings.length} advertencias</div></div><span class="validation-light ${result.ready?'ok':'bad'}">${result.ready?'PCI habilitado':'PCI no publicable'}</span></div><div class="validation-levels">${result.levelStatus.map(x=>`<div class="validation-level ${x.valid?'ok':'bad'}"><strong>Nivel ${x.level}</strong><span>C${x.level*2-1}: ${x.c1}/${TARGET_HOURS} HC</span><span>C${x.level*2}: ${x.c2}/${TARGET_HOURS} HC</span></div>`).join('')}</div><div><strong>Formación Orientada:</strong> ${result.workshops}/3 talleres · ${result.labs}/3 laboratorios · ${result.projects}/1 proyecto de vinculación</div>${result.issues.length?`<div class="validation-sub">Errores</div><ul class="validation-list">${result.issues.map(x=>`<li>${x}</li>`).join('')}</ul>`:''}${result.warnings.length?`<div class="validation-sub">Advertencias</div><ul class="validation-list">${result.warnings.map(x=>`<li>${x}</li>`).join('')}</ul>`:''}`;
  }

  function watch(){clearInterval(timer);timer=setInterval(()=>{try{render()}catch(error){console.error('Motor de validación:',error)}},900)}
  frame()?.addEventListener('load',watch);watch();
})();