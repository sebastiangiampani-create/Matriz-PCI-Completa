(()=>{
  const TARGET_HOURS=9;
  const frame=()=>document.getElementById('pci');
  let timer=null;

  function range(w,area,index,group){
    const annual=w.CFG?.[area]?.l==='Nivel';
    const level=Number(group.level||Math.min(5,index+1)||1);
    let start=Number(group.termStart||group.term||(annual?level*2-1:index+1));
    let end=Number(group.termEnd||group.term||(annual?level*2:start));
    if(annual){start=level*2-1;end=level*2}
    return {start:Math.max(1,Math.min(10,start)),end:Math.max(1,Math.min(10,end))};
  }

  function hoursForTerm(group,term){
    const fallback=Math.max(0,Number(group.weeklyHours??group.hours??0)||0);
    if(group.hoursMode==='per_term')return Math.max(0,Number(group.hoursByTerm?.[term]??fallback)||0);
    return fallback;
  }

  function calculate(w){
    const terms=Array.from({length:10},(_,i)=>({term:i+1,hours:0,spaces:0,missingHours:0}));
    const annualErrors=[];
    Object.entries(w.app?.areas||{}).forEach(([area,data])=>{
      (data.groups||[]).forEach((group,index)=>{
        const r=range(w,area,index,group);
        for(let term=r.start;term<=r.end;term++){
          const hours=hoursForTerm(group,term);
          terms[term-1].hours+=hours;
          terms[term-1].spaces+=1;
          if(hours===0)terms[term-1].missingHours+=1;
        }
        if(w.CFG?.[area]?.l==='Nivel'&&(r.end-r.start!==1||r.start%2===0))annualErrors.push(group.name||`${area} ${index+1}`);
      });
    });
    return {terms,annualErrors};
  }

  function status(hours,missing){
    if(missing>0)return {label:'Faltan horas',cls:'warn'};
    if(hours===TARGET_HOURS)return {label:'Validado',cls:'ok'};
    if(hours<TARGET_HOURS)return {label:`Faltan ${TARGET_HOURS-hours} h`,cls:'warn'};
    return {label:`Exceso ${hours-TARGET_HOURS} h`,cls:'bad'};
  }

  function install(){
    const f=frame(),w=f?.contentWindow,d=f?.contentDocument;
    if(!w||!d)return;
    const overlay=d.getElementById('integratedMap');
    const summary=overlay?.querySelector('.integrated-summary');
    if(!summary)return;
    let panel=d.getElementById('hourValidationPanel');
    if(!panel){
      const style=d.createElement('style');
      style.textContent=`#hourValidationPanel{width:100%;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px}.hour-title{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.hour-title strong{font-size:.95rem}.hour-grid{display:grid;grid-template-columns:repeat(10,minmax(85px,1fr));gap:7px;overflow:auto}.hour-card{border:1px solid var(--line);border-radius:10px;padding:8px;text-align:center;min-width:85px}.hour-card b{display:block;font-size:1.05rem}.hour-card small{display:block;margin-top:3px}.hour-card.ok{background:#e5f6ef;color:#167557}.hour-card.warn{background:#fff3d8;color:#8a5b00}.hour-card.bad{background:#ffe9ee;color:#a4263d}.hour-note{margin-top:8px;color:var(--muted);font-size:.78rem}`;
      d.head.appendChild(style);
      panel=d.createElement('div');
      panel.id='hourValidationPanel';
      summary.appendChild(panel);
    }
    const result=calculate(w);
    const cards=result.terms.map(item=>{
      const s=status(item.hours,item.missingHours);
      return `<div class="hour-card ${s.cls}"><b>C${item.term} · ${item.hours} h</b><small>${s.label}</small><small>${item.spaces} espacios</small></div>`;
    }).join('');
    panel.innerHTML=`<div class="hour-title"><strong>Validación horaria por cuatrimestre</strong><span>Objetivo: ${TARGET_HOURS} HC en cada cuatrimestre</span></div><div class="hour-grid">${cards}</div><div class="hour-note">Cada cuatrimestre se valida por separado. Si un espacio ocupa C1 y C2, puede registrar cargas distintas; por ejemplo, C1=9 y C2=5 deja C2 pendiente. ${result.annualErrors.length?`Hay ${result.annualErrors.length} troncal(es) que no ocupan correctamente dos cuatrimestres.`:'Las troncales anuales respetan dos cuatrimestres.'}</div>`;
  }

  function watch(){
    clearInterval(timer);
    timer=setInterval(()=>{try{install()}catch(error){console.error('Motor horario:',error)}},700);
  }
  frame()?.addEventListener('load',watch);
  watch();
})();