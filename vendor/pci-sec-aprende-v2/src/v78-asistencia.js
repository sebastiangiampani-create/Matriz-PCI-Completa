(() => {
  const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const TYPES=[['TARDE','Tarde',0.5],['AUSENTE','Ausente',1],['AUSENTE_PRESENCIA','Ausente con presencia',1],['AUSENTE_EF','Ausente a EF',0.5]];
  const localDate=now=>new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
  let commission='',date=localDate(new Date()),view='daily',reportDni='',reportYear=Number(date.slice(0,4));
  let accessScope={role:'admin',commissionKeys:null};
  function root(){state.institutional=state.institutional||{};state.institutional.attendance=state.institutional.attendance||{records:[]};state.institutional.attendance.records=Array.isArray(state.institutional.attendance.records)?state.institutional.attendance.records:[];return state.institutional.attendance}
  function defs(){const all=window.PCIStudentsCommissionsV72?.commissionDefs?.()||[];if(accessScope.role==='admin')return all;if(accessScope.role!=='teacher'||!Array.isArray(accessScope.commissionKeys))return[];const allowed=new Set(accessScope.commissionKeys);return all.filter(x=>allowed.has(x.key))}
  function students(k){return window.PCIStudentsCommissionsV72?.studentsFor?.(k)||[]}
  function studentsInScope(){
    const map=new Map();
    for(const def of defs()){
      for(const student of students(def.key)){
        const dni=String(student?.dni||'');if(!dni)continue;
        if(!map.has(dni))map.set(dni,{...student,commissions:[]});
        map.get(dni).commissions.push({key:def.key,course:def.course,orientation:def.orientation,year:def.year,division:def.division});
      }
    }
    return [...map.values()].sort((x,y)=>String(x.lastName||'').localeCompare(String(y.lastName||''),'es')||String(x.firstName||'').localeCompare(String(y.firstName||''),'es'));
  }
  function commissionState(key){
    const ds=defs(),all=studentsInScope(),list=key?students(key):[];
    if(!ds.length)return{state:'no-commissions',count:0,totalStudents:all.length};
    if(!all.length)return{state:'installation-empty',count:list.length,totalStudents:0};
    if(!list.length)return{state:'commission-empty',count:0,totalStudents:all.length};
    return{state:'loaded',count:list.length,totalStudents:all.length};
  }
  function reportRecords(dni,year){
    const allowed=new Set(defs().map(x=>x.key)),y=Number(year);
    return root().records.filter(r=>String(r.dni)===String(dni)&&allowed.has(String(r.commissionKey))&&(!y||String(r.date||'').startsWith(String(y)+'-'))).sort((x,y)=>String(y.date||'').localeCompare(String(x.date||'')));
  }
  function studentReport(dni,year=reportYear){
    const student=studentsInScope().find(s=>String(s.dni)===String(dni))||null;
    const history=reportRecords(dni,year);
    const justified=history.filter(r=>r.justified).reduce((n,r)=>n+Number(r.value||0),0);
    const unjustified=history.filter(r=>!r.justified).reduce((n,r)=>n+Number(r.value||0),0);
    const periods=window.PCIRegularityV79?.periodsFor?.(Number(year))||[];
    const periodRows=periods.map(p=>{
      const value=history.filter(r=>!r.justified&&r.date>=p.start&&r.date<=p.end).reduce((n,r)=>n+Number(r.value||0),0);
      return{...p,value,exceeded:value>5};
    });
    const regular=unjustified<=20&&!periodRows.some(p=>p.exceeded);
    return{student,year:Number(year),history,justified,unjustified,periods:periodRows,regular,status:regular?'Regular':'No Regular'};
  }
  function val(t){return TYPES.find(x=>x[0]===t)?.[2]||0}
  function dayRecords(dni,d){return root().records.filter(r=>r.dni===dni&&r.date===d)}
  function total(dni,d){return dayRecords(dni,d).reduce((n,r)=>n+Number(r.value||0),0)}
  function conditionFor(dni,year=Number(date.slice(0,4))){const a=root().records.filter(r=>r.dni===dni&&!r.justified&&String(r.date||'').startsWith(String(year)+'-')).reduce((n,r)=>n+Number(r.value||0),0);return{annual:a,regular:a<=20}}
  function validateAddition(x){
    const v=val(x.type), existing=dayRecords(x.dni,x.date);
    if(existing.some(r=>r.type===x.type))throw new Error('Ese tipo de falta ya fue registrado para este estudiante en la fecha seleccionada.');
    if(total(x.dni,x.date)+v>1)throw new Error('La suma de faltas no puede superar 1 por estudiante y por día.');
    return v
  }
  function add(x){
    if(!['admin','teacher'].includes(accessScope.role))throw new Error('No tenés permiso para registrar asistencia.');
    const v=validateAddition(x);
    root().records.push({id:'att-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),...x,value:v,createdAt:new Date().toISOString()});save()
  }
  function del(id){if(!['admin','teacher'].includes(accessScope.role))return toast('No tenés permiso para modificar asistencia.',true);root().records=root().records.filter(r=>r.id!==id);save();render()}
  function ensure(){
    let e=$('v78Attendance');if(e)return e;
    const main=document.querySelector('main.wrap');if(!main)return null;
    e=document.createElement('section');e.id='v78Attendance';e.className='screen';
    e.innerHTML='<div id="v78AttendanceRoot"></div>';
    main.appendChild(e);return e
  }
  function host(){ensure();return $('v78AttendanceRoot')}
  function show(){
    const e=ensure();if(!e)return;
    document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
    e.classList.add('active');window.scrollTo(0,0)
  }
  function goHome(){
    const home=$('home');if(!home)return;
    document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
    home.classList.add('active');
    window.PCIHomeRedesignV74?.refresh?.();
    window.scrollTo(0,0)
  }
  function patchHome(){
    const home=$('home');if(!home)return;
    let card=$('v78AttendanceEntry');
    if(!card){
      card=document.createElement('article');
      card.id='v78AttendanceEntry';card.className='card v75-grading v78-home-entry';
      const anchor=$('v77BulletinsEntry')||$('v75Grading')||$('v71LeanHomeEntry');
      anchor?.after(card);
    }
    card.innerHTML='<div><div class="eyebrow">5 · Asistencia</div><h2>Asistencia</h2><p>Registro diario por estudiante, tipo de falta, motivo y justificación.</p><small>Usa las comisiones y los estudiantes cargados en Gestión, identificados por DNI.</small></div><button type="button" class="btn primary" data-v78-open>Abrir Asistencia</button>';
    card.hidden=!['admin','teacher'].includes(accessScope.role);
    card.querySelector('[data-v78-open]')?.addEventListener('click',open);
  }
  function emptyDailyMessage(state){
    if(state.state==='no-commissions')return '<div class="v78-empty-card"><strong>No hay comisiones disponibles.</strong><span>Revisá la configuración de cursos y los permisos de acceso.</span></div>';
    if(state.state==='installation-empty')return '<div class="v78-empty-card warning"><strong>No hay estudiantes cargados en esta copia de la aplicación.</strong><span>Los listados guardados en otro navegador, localhost, GitHub Pages o instalación offline no se transfieren automáticamente. Cargalos desde Gestión → Comisiones y estudiantes.</span></div>';
    if(state.state==='commission-empty')return '<div class="v78-empty-card"><strong>Esta comisión no tiene estudiantes cargados en esta instalación.</strong><span>Elegí otra comisión o cargá su listado desde Gestión → Comisiones y estudiantes.</span></div>';
    return '';
  }
  function render(){
    const h=host();if(!h)return;
    const ds=defs();
    if(!ds.some(x=>x.key===commission))commission=ds[0]?.key||'';
    const ss=commission?students(commission):[];
    const rs=root().records.filter(r=>r.commissionKey===commission&&r.date===date);
    const scoped=studentsInScope();
    if(!scoped.some(s=>String(s.dni)===String(reportDni)))reportDni=scoped[0]?.dni||'';
    const years=[...new Set([Number(date.slice(0,4)),...root().records.map(r=>Number(String(r.date||'').slice(0,4))).filter(Number.isFinite)])].sort((x,y)=>y-x);
    if(!years.includes(Number(reportYear)))reportYear=years[0]||Number(date.slice(0,4));
    const report=reportDni?studentReport(reportDni,reportYear):null;
    const cState=commissionState(commission);

    const dailyHtml=`
      <div class="v78-filters">
        <label>Comisión<select data-c>${ds.map(c=>{const count=students(c.key).length;return `<option value="${esc(c.key)}" ${c.key===commission?'selected':''}>${esc(c.course)} · ${esc(c.orientation)} — ${count?count+' estudiante'+(count===1?'':'s'):'sin estudiantes'}</option>`}).join('')}</select></label>
        <label>Fecha<input type="date" data-d value="${date}"></label>
      </div>
      <div class="v78-commission-status ${cState.state}"><strong>${cState.count} estudiante${cState.count===1?'':'s'} en la comisión seleccionada</strong><span>${cState.totalStudents} estudiante${cState.totalStudents===1?'':'s'} cargado${cState.totalStudents===1?'':'s'} en esta instalación y dentro de tu alcance.</span></div>
      <div class="v78-list">${ss.length?ss.map(s=>{const rr=rs.filter(r=>r.dni===s.dni),sum=rr.reduce((n,r)=>n+Number(r.value||0),0),co=conditionFor(s.dni);return `<article class="v78-row" data-dni="${esc(s.dni)}"><div><strong>${esc(s.lastName||'')} ${esc(s.firstName||'')}</strong><small>DNI ${esc(s.dni)} · Día: ${sum} · Injustificadas ${reportYear}: ${co.annual}</small></div><select data-t>${TYPES.map(([k,l,v])=>`<option value="${k}">${l} (+${v})</option>`).join('')}</select><input data-r placeholder="Motivo"><label><input type="checkbox" data-j> Justificada</label><button data-a>Registrar</button><div class="v78-tags">${rr.map(r=>`<span>${TYPES.find(x=>x[0]===r.type)?.[1]} +${r.value} · ${r.justified?'Justificada':'Injustificada'}${r.reason?' · '+esc(r.reason):''}<button data-x="${r.id}">×</button></span>`).join('')}</div></article>`}).join(''):emptyDailyMessage(cState)}</div>
    `;

    const contexts=report?.student?.commissions||[];
    const reportHtml=scoped.length?`
      <div class="v78-report-filters">
        <label>Estudiante<select data-v78-student>${scoped.map(s=>`<option value="${esc(s.dni)}" ${String(s.dni)===String(reportDni)?'selected':''}>${esc(s.lastName||'')} ${esc(s.firstName||'')} — DNI ${esc(s.dni)}</option>`).join('')}</select></label>
        <label>Año<select data-v78-year>${years.map(y=>`<option value="${y}" ${Number(y)===Number(reportYear)?'selected':''}>${y}</option>`).join('')}</select></label>
      </div>
      <section class="v78-student-report">
        <div class="v78-student-head"><div><div class="eyebrow">Reporte individual</div><h3>${esc(report?.student?.lastName||'')} ${esc(report?.student?.firstName||'')}</h3><p>DNI ${esc(reportDni)}${contexts.length?' · '+contexts.map(c=>esc(c.course+' · '+c.orientation)).join(' / '):''}</p></div><span class="v78-regularity ${report?.regular?'ok':'bad'}">${report?.status||'—'}</span></div>
        <div class="v78-summary-grid">
          <article><small>Injustificadas ${reportYear}</small><strong>${report?.unjustified||0}</strong></article>
          <article><small>Justificadas ${reportYear}</small><strong>${report?.justified||0}</strong></article>
          <article><small>Registros</small><strong>${report?.history?.length||0}</strong></article>
        </div>
        <div class="v78-periods">${report?.periods?.length?report.periods.map(p=>`<div class="${p.exceeded?'bad':''}"><span>${esc(p.label)}</span><strong>${p.value}</strong><small>límite: 5</small></div>`).join(''):'<p>No hay períodos de regularidad configurados para este año.</p>'}</div>
        <div class="v78-history"><h4>Historial de asistencia</h4>${report?.history?.length?`<div class="v78-history-table"><div class="head"><span>Fecha</span><span>Tipo</span><span>Cómputo</span><span>Estado</span><span>Motivo</span></div>${report.history.map(r=>`<div><span>${esc(String(r.date||'').split('-').reverse().join('/'))}</span><span>${esc(TYPES.find(x=>x[0]===r.type)?.[1]||r.type)}</span><span>${Number(r.value||0)}</span><span>${r.justified?'Justificada':'Injustificada'}</span><span>${esc(r.reason||'—')}</span></div>`).join('')}</div>`:'<p class="v78-empty-inline">No hay registros de asistencia para este estudiante en '+reportYear+'.</p>'}</div>
      </section>
    `:'<div class="v78-empty-card warning"><strong>No hay estudiantes para generar reportes.</strong><span>Primero cargá estudiantes en Gestión → Comisiones y estudiantes.</span></div>';

    h.innerHTML=`<div class="v78-topbar"><button type="button" class="btn soft" data-v78-home>← Inicio</button></div><div class="v78-hero"><div class="eyebrow">Asistencia</div><h2>Asistencia y regularidad</h2><p>Registro diario por comisión y seguimiento histórico por estudiante.</p></div>
    <div class="v78-tabs"><button type="button" class="${view==='daily'?'active':''}" data-v78-tab="daily">Registro diario</button><button type="button" class="${view==='student'?'active':''}" data-v78-tab="student">Reporte por estudiante</button></div>
    ${view==='daily'?dailyHtml:reportHtml}`;

    h.querySelector('[data-v78-home]')?.addEventListener('click',goHome);
    h.querySelectorAll('[data-v78-tab]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.v78Tab;render()}));
    h.querySelector('[data-c]')?.addEventListener('change',e=>{commission=e.target.value;render()});
    h.querySelector('[data-d]')?.addEventListener('change',e=>{date=e.target.value;reportYear=Number(date.slice(0,4));render()});
    h.querySelector('[data-v78-student]')?.addEventListener('change',e=>{reportDni=e.target.value;render()});
    h.querySelector('[data-v78-year]')?.addEventListener('change',e=>{reportYear=Number(e.target.value);render()});
    h.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const r=b.closest('[data-dni]');try{add({commissionKey:commission,dni:r.dataset.dni,date,type:r.querySelector('[data-t]').value,reason:r.querySelector('[data-r]').value.trim(),justified:r.querySelector('[data-j]').checked});render();toast('Asistencia registrada.')}catch(e){toast(e.message,true)}});
    h.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>del(b.dataset.x));
  }
  const s=document.createElement('style');s.textContent=`
  #v78Attendance.screen{display:none;gap:14px}#v78Attendance.screen.active{display:grid}
  .v78-hero,.v78-filters,.v78-row,.v78-report-filters,.v78-student-report{border:1px solid var(--line);border-radius:18px;background:#fff;padding:16px}
  .v78-hero{background:linear-gradient(135deg,#f8fbfd,#eef5f8)}.v78-hero h2{margin:4px 0}.v78-hero p{margin:0;color:var(--muted)}
  .v78-tabs{display:flex;gap:8px;flex-wrap:wrap}.v78-tabs button{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:999px;padding:9px 13px;font-weight:850}.v78-tabs button.active{background:var(--ink);color:#fff;border-color:var(--ink)}
  .v78-filters,.v78-report-filters{display:grid;grid-template-columns:2fr 1fr;gap:10px}.v78-filters label,.v78-report-filters label{display:grid;gap:5px;font-weight:800}
  .v78-filters select,.v78-filters input,.v78-report-filters select,.v78-row select,.v78-row>input{padding:9px;border:1px solid var(--line);border-radius:10px;background:#fff}
  .v78-commission-status{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--band)}.v78-commission-status span{color:var(--muted);font-size:.58rem}.v78-commission-status strong{font-size:.64rem}.v78-commission-status.installation-empty,.v78-commission-status.commission-empty{background:#fff8df;border-color:#dfc476}
  .v78-list{display:grid;gap:9px}.v78-row{display:grid;grid-template-columns:minmax(220px,1.5fr) 180px minmax(140px,1fr) auto auto;gap:8px;align-items:center}.v78-row small{display:block;color:var(--muted);margin-top:3px}.v78-row>button{border:0;border-radius:999px;background:var(--ink);color:#fff;padding:9px 12px;font-weight:850}.v78-tags{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap}.v78-tags span{padding:5px 8px;border-radius:999px;background:var(--band);font-size:.55rem}.v78-tags button{border:0;background:transparent;font-weight:900}
  .v78-empty-card{display:grid;gap:5px;padding:17px;border:1px dashed var(--line);border-radius:15px;background:#fff}.v78-empty-card.warning{background:#fff8df;border-style:solid;border-color:#dfc476}.v78-empty-card span{color:var(--muted);line-height:1.45;font-size:.64rem}
  .v78-student-report{display:grid;gap:14px}.v78-student-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v78-student-head h3{margin:3px 0;font-size:1.05rem}.v78-student-head p{margin:0;color:var(--muted);font-size:.62rem}.v78-regularity{padding:7px 10px;border-radius:999px;font-weight:900;font-size:.62rem}.v78-regularity.ok{background:var(--ok-soft);color:var(--ok)}.v78-regularity.bad{background:var(--danger-soft);color:var(--danger)}
  .v78-summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.v78-summary-grid article{padding:11px;border:1px solid var(--line);border-radius:12px;background:var(--band)}.v78-summary-grid small{display:block;color:var(--muted);font-size:.54rem}.v78-summary-grid strong{display:block;margin-top:4px;font-size:1rem}
  .v78-periods{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:7px}.v78-periods>div{padding:9px;border:1px solid var(--line);border-radius:11px}.v78-periods>div.bad{background:var(--danger-soft);border-color:#e3b5c0}.v78-periods span,.v78-periods small{display:block;font-size:.52rem}.v78-periods strong{display:block;font-size:.9rem;margin:3px 0}
  .v78-history h4{margin:0 0 8px}.v78-history-table{display:grid;border:1px solid var(--line);border-radius:12px;overflow:hidden}.v78-history-table>div{display:grid;grid-template-columns:110px 1.2fr 90px 1fr 1.5fr;gap:8px;padding:8px 10px;border-top:1px solid var(--line);font-size:.57rem}.v78-history-table>div:first-child{border-top:0}.v78-history-table .head{font-weight:900;background:var(--band)}.v78-empty-inline{color:var(--muted)}
  @media(max-width:850px){.v78-filters,.v78-report-filters,.v78-row{grid-template-columns:1fr}.v78-tags{grid-column:1}.v78-row>button{width:100%}.v78-commission-status,.v78-student-head{align-items:flex-start;flex-direction:column}.v78-summary-grid{grid-template-columns:1fr}.v78-history-table>div{grid-template-columns:1fr;gap:2px}.v78-history-table .head{display:none}.v78-history-table>div span:before{font-weight:800}.v78-history-table>div span:nth-child(1):before{content:'Fecha: '}.v78-history-table>div span:nth-child(2):before{content:'Tipo: '}.v78-history-table>div span:nth-child(3):before{content:'Cómputo: '}.v78-history-table>div span:nth-child(4):before{content:'Estado: '}.v78-history-table>div span:nth-child(5):before{content:'Motivo: '}}
  `;document.head.appendChild(s);
  function open(){if(!['admin','teacher'].includes(accessScope.role))return toast('No tenés permiso para acceder a Asistencia.',true);show();render()}
  function setAccessScope(scope={}){accessScope={role:['admin','teacher','student','family'].includes(scope.role)?scope.role:'admin',commissionKeys:Array.isArray(scope.commissionKeys)?scope.commissionKeys.map(String):null};commission='';reportDni='';patchHome();if($('v78Attendance')?.classList.contains('active'))render()}
  function start(){ensure();patchHome()}
  window.addEventListener('pci-app-ready',()=>setTimeout(start,1100));setTimeout(start,1800);
  window.PCIAttendanceV78={render,open,addRecord:add,records:()=>root().records,conditionFor,total,dayRecords,validateAddition,setAccessScope,getAccessScope:()=>({...accessScope}),defs,studentsInScope,commissionState,studentReport,reportRecords};
})();
