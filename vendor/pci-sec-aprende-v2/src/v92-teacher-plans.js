(() => {
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let selectedTeacher='';

  function root(){
    state.institutional=state.institutional||{};
    state.institutional.teachers=state.institutional.teachers||{};
    state.institutional.assignments=state.institutional.assignments||{};
    return state.institutional;
  }

  function teachers(){
    return Object.values(root().teachers||{}).map(t=>({
      id:String(t.id||''),
      name:String(t.name||t.fullName||t.nombre||t.email||t.id||'Docente'),
      email:String(t.email||'')
    })).filter(t=>t.id).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  }

  function implementationRows(){
    return window.PCIInstitutionalV48?.allImplementationRows?.()||[];
  }

  function rowsForTeacher(tid){
    const assignments=root().assignments||{};
    return implementationRows().filter(r=>String(assignments[r.instanceId]||'')===String(tid));
  }

  function slotYear(slot){
    const annual=String(slot).match(/-n(\d+)$/);
    if(annual)return Number(annual[1]);
    const term=String(slot).match(/-c(\d+)$/);
    return term?Math.ceil(Number(term[1])/2):0;
  }

  function slotsForRow(row){
    const map=state.maps?.[row.orientation]||{};
    const placements=map.placements||{};
    return Object.entries(placements)
      .filter(([slot,ids])=>slotYear(slot)===Number(row.year)&&(ids||[]).map(String).includes(String(row.subjectId)))
      .map(([slot])=>slot);
  }

  function withOrientation(orientation,fn){
    const previous=state.active;
    try{state.active=orientation;return fn()}
    finally{state.active=previous}
  }

  function groupData(orientation,slot){
    return withOrientation(orientation,()=>{
      const phase=window.PCIPhase2V28;
      const cover=window.PCICoverageV91;
      const plansApi=window.PCIPlansCoverageV91;
      const group=phase?.gb?.(slot);
      if(!group)return null;
      const format=cover?.formatCoverage?.(group)||{total:0,used:0,percent:0,year:group.year,bySubject:[]};
      const plans=plansApi?.allPlans?.(group)||[];
      const subjects=[...new Set((phase?.members?.(group)||[]).map(x=>String(x?.name||'').trim()).filter(Boolean))];
      return {
        id:group.id,
        name:group.data?.name||group.name||slot,
        year:group.year,
        term:group.term,
        area:group.area,
        subjects,
        format,
        plans:plans.map(p=>({
          number:Number(p.number),
          name:String(p.name||`Plan ${p.number}`),
          criteria:String(p.criteria||''),
          objectives:String(p.objectives||''),
          contents:[...(p.contents||[])],
          coverage:cover?.coverageForIds?.(group,p.contents||[])||{total:0,used:0,percent:0,bySubject:[]}
        }))
      };
    });
  }

  function teacherSpaces(tid){
    const rows=rowsForTeacher(tid);
    const bySpace=new Map();
    for(const row of rows){
      for(const slot of slotsForRow(row)){
        const key=`${row.orientation}::${slot}`;
        if(!bySpace.has(key)){
          const data=groupData(row.orientation,slot);
          if(!data)continue;
          bySpace.set(key,{...data,orientation:row.orientation,courses:new Set(),subjects:new Set(data.subjects||[])});
        }
        const x=bySpace.get(key);
        x.courses.add(row.course||`${row.year}.º ${row.division||''}`.trim());
        x.subjects.add(row.name||row.subjectId);
      }
    }
    return [...bySpace.values()].map(x=>({
      ...x,
      courses:[...x.courses].filter(Boolean).sort(),
      subjects:[...x.subjects].filter(Boolean).sort()
    })).sort((a,b)=>a.orientation.localeCompare(b.orientation,'es')||a.year-b.year||String(a.term).localeCompare(String(b.term)));
  }

  const pct=v=>Number(v?.total)?`${Number(v.percent||0).toLocaleString('es-AR',{maximumFractionDigits:1})}%`:'—';

  function subjectCoverage(result){
    const rows=result?.bySubject||[];
    if(!rows.length)return '';
    return `<div class="v92-subject-coverage">${rows.map(x=>`<span><strong>${esc(x.subject)}</strong><b>${Number(x.percent||0).toLocaleString('es-AR',{maximumFractionDigits:1})}%</b><small>${x.used}/${x.total}</small></span>`).join('')}</div>`;
  }

  function planMini(plan){
    return `<article class="v92-plan-mini">
      <div class="v92-plan-mini-head"><div><small>Plan ${plan.number}</small><strong>${esc(plan.name)}</strong></div><b>${pct(plan.coverage)}</b></div>
      <div class="v92-meter"><span style="width:${Math.min(100,Number(plan.coverage?.percent)||0)}%"></span></div>
      <span class="v92-detail">${plan.coverage?.total?`${plan.coverage.used}/${plan.coverage.total} contenidos prescriptos`:'Sin universo calculable'}</span>
      ${subjectCoverage(plan.coverage)}
    </article>`;
  }

  function spaceCard(space){
    return `<article class="v92-space">
      <header class="v92-space-head">
        <div>
          <span>${esc(space.orientation)} · Nivel ${space.year}</span>
          <h4>${esc(space.name)}</h4>
          <small>${esc(space.subjects.join(' + '))}${space.courses.length?' · '+esc(space.courses.join(', ')):''}</small>
        </div>
        <div class="v92-format-pct"><small>Cobertura del formato</small><strong>${pct(space.format)}</strong></div>
      </header>
      <div class="v92-meter v92-format-meter"><span style="width:${Math.min(100,Number(space.format?.percent)||0)}%"></span></div>
      ${subjectCoverage(space.format)}
      <div class="v92-plans">${space.plans.map(planMini).join('')}</div>
    </article>`;
  }

  async function render(){
    const host=$('v48InstitutionalContent');if(!host)return;
    let section=$('v92TeacherPlans');
    if(!section){
      section=document.createElement('section');
      section.id='v92TeacherPlans';
      section.className='card v92-teacher-plans';
      host.appendChild(section);
    }
    try{await window.PCICoverageV91?.ready?.()}catch{}

    const rows=teachers();
    if(!selectedTeacher||!rows.some(t=>t.id===selectedTeacher))selectedTeacher=rows[0]?.id||'';
    const current=rows.find(t=>t.id===selectedTeacher);
    const spaces=current?teacherSpaces(current.id):[];

    section.innerHTML=`
      <div class="v92-head">
        <div><div class="eyebrow">Planes por docente</div><h2>Asignaciones y planes correspondientes</h2><p>Cada docente ve los espacios que tiene asignados y los planes asociados, con la cobertura del formato y de cada plan sobre los contenidos prescriptos del año.</p></div>
        <label class="v92-select"><span>Docente</span><select>${rows.length?rows.map(t=>`<option value="${esc(t.id)}" ${t.id===selectedTeacher?'selected':''}>${esc(t.name)}${t.email?' · '+esc(t.email):''}</option>`).join(''):'<option value="">Sin docentes cargados</option>'}</select></label>
      </div>
      ${!current?'<div class="v92-empty">Primero cargá docentes y asignaciones.</div>':
        !spaces.length?'<div class="v92-empty">Este docente todavía no tiene espacios curriculares asignados.</div>':
        `<div class="v92-summary"><strong>${esc(current.name)}</strong><span>${spaces.length} espacio${spaces.length===1?'':'s'} curricular${spaces.length===1?'':'es'} con planes</span></div><div class="v92-space-grid">${spaces.map(spaceCard).join('')}</div>`}
    `;
    section.querySelector('select')?.addEventListener('change',e=>{selectedTeacher=e.target.value;render()});
  }

  const style=document.createElement('style');
  style.textContent=`
    .v92-teacher-plans{display:grid;gap:16px}.v92-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,340px);gap:18px;align-items:end}.v92-head h2{margin:4px 0 6px}.v92-head p{margin:0;color:var(--muted);line-height:1.45}
    .v92-select{display:grid;gap:5px}.v92-select span{font-size:.62rem;font-weight:900;color:var(--muted)}.v92-select select{width:100%;padding:10px 11px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--ink);font-weight:750}
    .v92-summary{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:11px 13px;border-radius:13px;background:var(--band)}.v92-summary strong{font-size:.8rem}.v92-summary span{font-size:.6rem;color:var(--muted)}
    .v92-space-grid{display:grid;gap:13px}.v92-space{padding:15px;border:1px solid var(--line);border-radius:18px;background:#fff;box-shadow:0 8px 22px rgba(18,57,92,.05)}.v92-space-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.v92-space-head span{font-size:.56rem;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:#126e65}.v92-space-head h4{margin:4px 0;font-size:.92rem}.v92-space-head small{display:block;color:var(--muted);font-size:.58rem;line-height:1.4}.v92-format-pct{text-align:right;min-width:120px}.v92-format-pct small{display:block}.v92-format-pct strong{display:block;margin-top:2px;font-size:1.25rem;color:#126e65}
    .v92-meter{height:6px;margin-top:8px;border-radius:999px;background:#dce7e8;overflow:hidden}.v92-meter span{display:block;height:100%;background:#126e65}.v92-format-meter{height:8px;margin-bottom:12px}
    .v92-plans{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.v92-plan-mini{padding:10px;border:1px solid #e1e7eb;border-radius:13px;background:#f9fbfc}.v92-plan-mini-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.v92-plan-mini-head small,.v92-plan-mini-head strong{display:block}.v92-plan-mini-head small{color:#126e65;font-size:.52rem;font-weight:900;text-transform:uppercase}.v92-plan-mini-head strong{margin-top:2px;font-size:.66rem}.v92-plan-mini-head b{color:#126e65;font-size:.8rem}.v92-detail{display:block;margin-top:5px;color:var(--muted);font-size:.52rem}
    .v92-empty{padding:18px;border:1px dashed var(--line);border-radius:14px;background:#f9fbfc;color:var(--muted);text-align:center;font-size:.68rem}
    @media(max-width:900px){.v92-plans{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.v92-head{grid-template-columns:1fr}.v92-space-head{flex-direction:column}.v92-format-pct{text-align:left}.v92-plans{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  window.PCITeacherPlansV92={render,teacherSpaces,rowsForTeacher};
  window.addEventListener('pci-app-ready',()=>setTimeout(render,1300));
})();