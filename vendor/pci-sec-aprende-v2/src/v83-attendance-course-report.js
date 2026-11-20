(() => {
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nowYear=()=>new Date().getFullYear();
  let active=false,commission='',year=nowYear(),periodKey='ANNUAL',timer=null,observer=null;

  function attendance(){return window.PCIAttendanceV78||null}
  function studentsApi(){return window.PCIStudentsCommissionsV72||null}
  function regularity(){return window.PCIRegularityV79||null}
  function defs(){return attendance()?.defs?.()||[]}
  function studentsFor(key){return studentsApi()?.studentsFor?.(key)||[]}
  function records(){try{return attendance()?.records?.()||[]}catch{return[]}}
  function periodsFor(y){try{return regularity()?.periodsFor?.(Number(y))||[]}catch{return[]}}
  function years(){
    const out=new Set([nowYear()]);
    for(const r of records()){const y=Number(String(r?.date||'').slice(0,4));if(Number.isInteger(y)&&y>2000)out.add(y)}
    return [...out].sort((a,b)=>b-a);
  }
  function rangeFor(y,key){
    const yr=Number(y);
    if(key==='ANNUAL')return{key:'ANNUAL',label:'Ciclo lectivo completo',start:String(yr)+'-01-01',end:String(yr)+'-12-31'};
    return periodsFor(yr).find(p=>p.key===key)||{key:'ANNUAL',label:'Ciclo lectivo completo',start:String(yr)+'-01-01',end:String(yr)+'-12-31'};
  }
  function studentRecords(dni,y,key,commissionKey=''){
    const range=rangeFor(y,key);
    return records().filter(r=>String(r?.dni||'')===String(dni)&&(!commissionKey||String(r?.commissionKey||'')===String(commissionKey))&&String(r?.date||'')>=range.start&&String(r?.date||'')<=range.end);
  }
  function statusFor(dni,y,key){
    if(key==='ANNUAL'){
      try{const r=attendance()?.studentReport?.(dni,Number(y));if(r)return{regular:!!r.regular,status:r.status|| (r.regular?'Regular':'No Regular')}}catch{}
      const unjustified=studentRecords(dni,y,key).filter(r=>!r.justified).reduce((n,r)=>n+Number(r.value||0),0);
      return{regular:unjustified<=20,status:unjustified<=20?'Regular':'No Regular'};
    }
    try{const r=regularity()?.statusForPeriod?.(dni,key,Number(y));if(r)return{regular:!!r.regular,status:r.status|| (r.regular?'Regular':'No Regular')}}catch{}
    const unjustified=studentRecords(dni,y,key).filter(r=>!r.justified).reduce((n,r)=>n+Number(r.value||0),0);
    return{regular:unjustified<=5,status:unjustified<=5?'Regular':'No Regular'};
  }
  function courseReport(key,y=year,pKey=periodKey){
    const def=defs().find(d=>d.key===key)||null;
    const range=rangeFor(y,pKey);
    const rows=studentsFor(key).map(student=>{
      const dni=String(student?.dni||'');
      const history=studentRecords(dni,y,pKey,key);
      const status=statusFor(dni,y,pKey);
      const tardies=history.filter(r=>r.type==='TARDE').length;
      const absences=history.filter(r=>r.type!=='TARDE').length;
      const justified=history.filter(r=>r.justified).reduce((n,r)=>n+Number(r.value||0),0);
      const unjustified=history.filter(r=>!r.justified).reduce((n,r)=>n+Number(r.value||0),0);
      return{student,dni,tardies,absences,justified,unjustified,records:history.length,regular:status.regular,status:status.status};
    });
    return{
      commission:def,year:Number(y),period:range,rows,students:rows.length,
      regular:rows.filter(r=>r.regular).length,nonRegular:rows.filter(r=>!r.regular).length,
      justified:rows.reduce((n,r)=>n+r.justified,0),unjustified:rows.reduce((n,r)=>n+r.unjustified,0)
    };
  }

  function ensureStyle(){
    if(document.getElementById('v83AttendanceCourseStyle'))return;
    const s=document.createElement('style');s.id='v83AttendanceCourseStyle';
    s.textContent='.v83-course-root{display:grid;gap:12px}.v83-course-filters,.v83-course-report{border:1px solid var(--line);border-radius:18px;background:#fff;padding:16px}.v83-course-filters{display:grid;grid-template-columns:2fr 1fr 1.2fr;gap:10px}.v83-course-filters label{display:grid;gap:5px;font-weight:800}.v83-course-filters select{padding:9px;border:1px solid var(--line);border-radius:10px;background:#fff}.v83-course-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v83-course-head h3{margin:3px 0}.v83-course-head p{margin:0;color:var(--muted);font-size:.62rem}.v83-course-head>span{padding:6px 9px;border-radius:999px;background:var(--band);font-size:.56rem;font-weight:850}.v83-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-top:12px}.v83-summary article{padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--band)}.v83-summary small{display:block;color:var(--muted);font-size:.52rem}.v83-summary strong{display:block;margin-top:4px;font-size:.95rem}.v83-table{display:grid;border:1px solid var(--line);border-radius:12px;overflow:auto;margin-top:12px}.v83-table>div{display:grid;grid-template-columns:minmax(210px,1.7fr) 75px 90px 100px 110px 120px;min-width:820px;border-top:1px solid var(--line)}.v83-table>div:first-child{border-top:0}.v83-table>div>span{padding:8px 9px;font-size:.56rem;display:flex;align-items:center}.v83-table .head{background:var(--band);font-weight:900}.v83-table small{display:block;color:var(--muted);margin-top:2px}.v83-status{display:inline-block;padding:5px 7px;border-radius:999px;font-size:.5rem;font-weight:900}.v83-status.ok{background:var(--ok-soft);color:var(--ok)}.v83-status.bad{background:var(--danger-soft);color:var(--danger)}.v83-empty{padding:18px;border:1px dashed var(--line);border-radius:14px;background:#fbfcfd}.v83-empty strong,.v83-empty span{display:block}.v83-empty span{margin-top:4px;color:var(--muted);font-size:.62rem}@media(max-width:850px){.v83-course-filters{grid-template-columns:1fr}.v83-summary{grid-template-columns:1fr}.v83-course-head{flex-direction:column}}';
    document.head.appendChild(s);
  }
  function ensureTab(root){
    const tabs=root.querySelector('.v78-tabs');if(!tabs)return null;
    let b=tabs.querySelector('[data-v83-course-tab]');
    if(!b){b=document.createElement('button');b.type='button';b.dataset.v83CourseTab='1';b.textContent='Reporte por curso';tabs.appendChild(b)}
    b.classList.toggle('active',active);
    if(active)tabs.querySelectorAll('[data-v78-tab]').forEach(x=>x.classList.remove('active'));
    return b;
  }
  function hideBase(root){
    const tabs=root.querySelector('.v78-tabs');if(!tabs)return;
    let seen=false;
    [...root.children].forEach(node=>{
      if(node===tabs){seen=true;return}
      if(seen&&node.classList?.contains('v83-course-root')===false)node.hidden=active;
    });
  }
  function reportHtml(report,ds,ys,ps){
    const commissionOptions=ds.map(d=>{const n=studentsFor(d.key).length;return '<option value="'+esc(d.key)+'" '+(d.key===commission?'selected':'')+'>'+esc(d.course)+' · '+esc(d.orientation)+' — '+(n?n+' estudiante'+(n===1?'':'s'):'sin estudiantes')+'</option>'}).join('');
    const yearOptions=ys.map(y=>'<option value="'+y+'" '+(Number(y)===Number(year)?'selected':'')+'>'+y+'</option>').join('');
    const periodOptions='<option value="ANNUAL" '+(periodKey==='ANNUAL'?'selected':'')+'>Ciclo lectivo completo</option>'+ps.map(p=>'<option value="'+esc(p.key)+'" '+(p.key===periodKey?'selected':'')+'>'+esc(p.label)+'</option>').join('');
    if(!report.commission)return '<div class="v83-empty"><strong>No hay una comisión disponible.</strong><span>Revisá la configuración de cursos y permisos.</span></div>';
    const summary='<div class="v83-summary"><article><small>Estudiantes</small><strong>'+report.students+'</strong></article><article><small>Regulares</small><strong>'+report.regular+'</strong></article><article><small>No Regulares</small><strong>'+report.nonRegular+'</strong></article><article><small>Injustificadas</small><strong>'+report.unjustified+'</strong></article><article><small>Justificadas</small><strong>'+report.justified+'</strong></article></div>';
    const rows=report.rows.map(r=>'<div><span><span><strong>'+esc(r.student?.lastName||'')+' '+esc(r.student?.firstName||'')+'</strong><small>DNI '+esc(r.dni)+'</small></span></span><span>'+r.tardies+'</span><span>'+r.absences+'</span><span>'+r.justified+'</span><span>'+r.unjustified+'</span><span><b class="v83-status '+(r.regular?'ok':'bad')+'">'+esc(r.status)+'</b></span></div>').join('');
    const table=report.rows.length?'<div class="v83-table"><div class="head"><span>Estudiante</span><span>Tardes</span><span>Ausencias</span><span>Justificadas</span><span>Injustificadas</span><span>Condición</span></div>'+rows+'</div>':'<div class="v83-empty"><strong>Esta comisión no tiene estudiantes cargados.</strong><span>Cargá el listado desde Gestión → Comisiones y estudiantes.</span></div>';
    return '<div class="v83-course-filters"><label>Comisión<select data-v83-commission>'+commissionOptions+'</select></label><label>Año<select data-v83-year>'+yearOptions+'</select></label><label>Período<select data-v83-period>'+periodOptions+'</select></label></div><section class="v83-course-report"><div class="v83-course-head"><div><div class="eyebrow">Reporte por curso</div><h3>'+esc(report.commission.course)+' · '+esc(report.commission.orientation)+'</h3><p>'+esc(report.period.label)+' · '+report.year+'</p></div><span>'+report.students+' estudiante'+(report.students===1?'':'s')+'</span></div>'+summary+table+'</section>';
  }
  function renderCourse(root){
    if(!active)return;
    const ds=defs();
    if(!ds.some(d=>d.key===commission))commission=ds[0]?.key||'';
    const ys=years();if(!ys.includes(Number(year)))year=ys[0]||nowYear();
    const ps=periodsFor(year);if(periodKey!=='ANNUAL'&&!ps.some(p=>p.key===periodKey))periodKey='ANNUAL';
    let host=root.querySelector('.v83-course-root');if(!host){host=document.createElement('div');host.className='v83-course-root';root.appendChild(host)}
    host.hidden=false;
    const report=courseReport(commission,year,periodKey);
    const signature=JSON.stringify({commission,year,periodKey,rows:report.rows.map(r=>[r.dni,r.tardies,r.absences,r.justified,r.unjustified,r.status])});
    if(host.dataset.signature!==signature){host.dataset.signature=signature;host.innerHTML=reportHtml(report,ds,ys,ps)}
    host.querySelector('[data-v83-commission]')?.addEventListener('change',e=>{commission=e.target.value;renderCourse(root)});
    host.querySelector('[data-v83-year]')?.addEventListener('change',e=>{year=Number(e.target.value);periodKey='ANNUAL';renderCourse(root)});
    host.querySelector('[data-v83-period]')?.addEventListener('change',e=>{periodKey=e.target.value;renderCourse(root)});
  }
  function decorate(){
    const root=$('v78AttendanceRoot');if(!root||!$('v78Attendance')?.classList.contains('active'))return;
    ensureStyle();const tab=ensureTab(root);if(!tab)return;
    hideBase(root);
    if(active)renderCourse(root);else{const h=root.querySelector('.v83-course-root');if(h)h.hidden=true}
  }
  function refresh(){clearTimeout(timer);timer=setTimeout(decorate,50)}
  function start(){
    const root=$('v78AttendanceRoot');
    if(root&&!observer){observer=new MutationObserver(refresh);observer.observe(root,{childList:true,subtree:true})}
    decorate();
  }
  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-v83-course-tab]')){active=true;decorate();window.scrollTo(0,0);return}
    if(e.target.closest?.('[data-v78-tab]')){active=false;setTimeout(decorate,20)}
  },true);
  window.addEventListener('pci-app-ready',()=>setTimeout(start,1700));
  setTimeout(start,2600);
  window.PCIAttendanceCourseReportV83={courseReport,studentRecords,statusFor,rangeFor,periodsFor,years,setActive:v=>{active=!!v;decorate()},getState:()=>({active,commission,year,periodKey})};
})();