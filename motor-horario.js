(()=>{
  const frame=()=>document.getElementById('pci');
  let timer=null;

  function range(w,area,index,group){
    const annual=w.CFG?.[area]?.l==='Nivel';
    const level=Number(group.level||Math.min(5,index+1)||1);
    let start=Number(group.termStart||group.term||(annual?level*2-1:index+1));
    let end=Number(group.termEnd||group.term||(annual?level*2:start));
    if(annual){start=level*2-1;end=level*2}
    return {level,start:Math.max(1,Math.min(10,start)),end:Math.max(1,Math.min(10,end))};
  }

  function hoursForTerm(group,term){
    const fallback=Math.max(0,Number(group.weeklyHours??group.hours??0)||0);
    if(group.hoursMode==='per_term')return Math.max(0,Number(group.hoursByTerm?.[term]??fallback)||0);
    return fallback;
  }

  function planRows(w){
    if(Array.isArray(w.PCI_STUDY_PLAN))return w.PCI_STUDY_PLAN;
    try{return JSON.parse(localStorage.getItem('pciStudyPlanV1')||'[]')}catch{return []}
  }

  function normativeHours(w,area,level,group){
    const plan=planRows(w);
    if(!plan.length)return null;
    const subjects=Array.isArray(group.subjects)?group.subjects.map(String):[];
    let rows=plan.filter(row=>Number(row.year)===Number(level));
    if(subjects.length)rows=rows.filter(row=>subjects.includes(String(row.subject))||subjects.includes(String(row.id)));
    else rows=rows.filter(row=>String(row.area)===String(area));
    if(!rows.length)return null;
    return rows.reduce((sum,row)=>sum+(Number(row.hours)||0),0);
  }

  function calculate(w){
    const terms=Array.from({length:10},(_,i)=>({term:i+1,actual:0,target:0,targetKnown:true,spaces:0,missingHours:0,details:[]}));
    const annualErrors=[];
    Object.entries(w.app?.areas||{}).forEach(([area,data])=>{
      (data.groups||[]).forEach((group,index)=>{
        const r=range(w,area,index,group);
        const target=normativeHours(w,area,r.level,group);
        for(let term=r.start;term<=r.end;term++){
          const actual=hoursForTerm(group,term),item=terms[term-1];
          item.actual+=actual;item.spaces+=1;if(actual===0)item.missingHours+=1;
          if(target==null)item.targetKnown=false;else item.target+=target;
          item.details.push({area,name:group.name||area,level:r.level,actual,target});
        }
        if(w.CFG?.[area]?.l==='Nivel'&&(r.end-r.start!==1||r.start%2===0))annualErrors.push(group.name||`${area} ${index+1}`);
      });
    });
    return {terms,annualErrors,hasPlan:planRows(w).length>0};
  }

  function status(item){
    if(!item.targetKnown)return {label:'Falta plan de estudios',cls:'warn'};
    if(item.missingHours>0)return {label:'Faltan horas cargadas',cls:'warn'};
    if(item.actual===item.target)return {label:'Validado',cls:'ok'};
    if(item.actual<item.target)return {label:`Faltan ${item.target-item.actual} HC`,cls:'warn'};
    return {label:`Exceso ${item.actual-item.target} HC`,cls:'bad'};
  }

  function install(){
    const f=frame(),w=f?.contentWindow,d=f?.contentDocument;if(!w||!d)return;
    const summary=d.getElementById('integratedMap')?.querySelector('.integrated-summary');if(!summary)return;
    let panel=d.getElementById('hourValidationPanel');
    if(!panel){const style=d.createElement('style');style.textContent=`#hourValidationPanel{width:100%;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px}.hour-title{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap}.hour-grid{display:grid;grid-template-columns:repeat(10,minmax(100px,1fr));gap:7px;overflow:auto}.hour-card{border:1px solid var(--line);border-radius:10px;padding:8px;text-align:center;min-width:100px}.hour-card b,.hour-card small{display:block}.hour-card.ok{background:#e5f6ef;color:#167557}.hour-card.warn{background:#fff3d8;color:#8a5b00}.hour-card.bad{background:#ffe9ee;color:#a4263d}.hour-note{margin-top:8px;color:var(--muted);font-size:.78rem}`;d.head.appendChild(style);panel=d.createElement('div');panel.id='hourValidationPanel';summary.appendChild(panel)}
    const result=calculate(w);
    const cards=result.terms.map(item=>{const s=status(item);return `<div class="hour-card ${s.cls}"><b>C${item.term} · ${item.actual} HC</b><small>${item.targetKnown?`Objetivo ${item.target} HC`:'Objetivo pendiente'}</small><small>${s.label}</small></div>`}).join('');
    panel.innerHTML=`<div class="hour-title"><strong>Validación horaria normativa</strong><span>${result.hasPlan?'Objetivos calculados desde el Plan de Estudios':'Cargá el Plan de Estudios para habilitar objetivos normativos'}</span></div><div class="hour-grid">${cards}</div><div class="hour-note">Las troncales respetan la HC normativa de su año. En agrupamientos/laboratorios, el objetivo es la suma de las HC de las materias que integran el agrupamiento en ese nivel. Cada cuatrimestre del nivel debe cumplir ese objetivo. ${result.annualErrors.length?`Hay ${result.annualErrors.length} troncal(es) con estructura temporal incorrecta.`:'Las troncales anuales respetan dos cuatrimestres.'}</div>`;
  }

  function watch(){clearInterval(timer);timer=setInterval(()=>{try{install()}catch(error){console.error('Motor horario:',error)}},700)}
  frame()?.addEventListener('load',watch);watch();
})();