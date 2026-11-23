(() => {
  const $id=id=>document.getElementById(id);
  const loadApi=()=>window.PCIDerivedTeacherLoadV52||null;
  const teamsApi=()=>window.PCIAutoAreaCoincidenceV54||null;
  const staffApi=()=>window.PCIStaffPlanningV68||null;
  const originalTeacherLoads=loadApi()?.teacherLoads?.bind(loadApi())||(()=>({}));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function root(){state.institutional=state.institutional||{};const r=state.institutional;r.teachers=r.teachers||{};r.areaTeams=r.areaTeams||{};r.outsideWork=r.outsideWork||{};return r}
  const teachers=()=>Object.values(root().teachers).sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));
  const teams=()=>Object.values(root().areaTeams||{});
  const semesterLoads=()=>originalTeacherLoads()||{};
  function front(tid){const l=semesterLoads()[tid]||{};return Math.max(Number(l.S1||0),Number(l.S2||0))}
  function pending(tid){const l=semesterLoads()[tid]||{};return Math.max(Number(l.pendingS1||0),Number(l.pendingS2||0))}
  function teamHours(tid){
    const derived=staffApi()?.teacherPlanning?.(tid);
    if(derived)return Number(derived.total||0);
    return teams().filter(t=>(t.teacherIds||[]).includes(tid)).reduce((a,t)=>a+Number(t.coordinationHours||0),0);
  }
  const explicitRows=()=>Object.values(root().outsideWork||{});
  const explicitOutside=tid=>explicitRows().filter(x=>x.teacherId===tid).reduce((a,x)=>a+Number(x.hours||0),0);
  function planningResidualRows(tid){
    const derived=staffApi()?.residualRows?.(tid);
    if(Array.isArray(derived))return derived;
    return teams().filter(t=>(t.teacherIds||[]).includes(tid)&&(t.teacherIds||[]).filter(id=>root().teachers[id]).length<2).map(t=>({id:`team-single-${t.id}-${tid}-annual`,teacherId:tid,label:`Planificación de equipo · ${t.name}`,hours:Number(t.coordinationHours||0),semester:'both',__v65TeamSingle:true}));
  }

  function offer(tid){
    teamsApi()?.deriveTeams?.();
    const f=front(tid),team=teamHours(tid),explicit=explicitOutside(tid),minimumOutside=team+explicit,minimumTotal=f+minimumOutside,minPct=minimumTotal?minimumOutside/minimumTotal*100:0,maxOutside=f,maxTotal=f+maxOutside,conflict=f>0&&minimumOutside>maxOutside;
    const targetOutside=minimumOutside;
    const configuredTotal=f+targetOutside,actualPct=configuredTotal?targetOutside/configuredTotal*100:0;
    const planning=staffApi()?.teacherPlanning?.(tid)||null;
    return{front:f,team,explicit,minimumOutside,minimumTotal,minPct,maxOutside,maxTotal,selected:minPct,targetOutside,configuredTotal,actualPct,additionalOutside:0,conflict,pending:pending(tid),planning,pendingPlanning:!!planning?.needsValidation,derived:true};
  }
  function syntheticOutsideRows(){
    const out=[...explicitRows().map(x=>({...x,semester:'both'}))];
    for(const t of teachers())out.push(...planningResidualRows(t.id));
    return out;
  }

  function render(){
    $id('v56OfferModel')?.remove();
    $id('v65AnnualOffer')?.remove();
    document.querySelectorAll('.v58-offer-conflict').forEach(box=>box.remove());
    window.PCIOfferModelV56={offer:(tid)=>offer(tid),teamHours,syntheticOutsideRows,render,__v65Annual:true,__derivedFromManagement:true};
  }
  function start(){render()}
  render();
  window.addEventListener('pci-app-ready',()=>setTimeout(start,700));
  document.addEventListener('click',e=>{if(e.target.closest('#openInstitutionalGeneral,#openInstitutional,[data-v71n-open]'))setTimeout(start,280)},true);
  setTimeout(start,900);

  window.PCIAnnualOfferV65={offer,front,semesterLoads,teamHours,syntheticOutsideRows,render};
})();