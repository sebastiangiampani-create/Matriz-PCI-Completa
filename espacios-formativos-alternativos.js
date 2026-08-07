(()=>{
  'use strict';
  const frame=()=>document.getElementById('pci');
  let installed=false;
  let migrated=false;

  function isAlternative(group){
    return !!group&&(
      group.alternative===true||
      group.kind==='espacio_formativo_alternativo'||
      group.type==='Espacio Formativo Alternativo'||
      group.elective===true
    );
  }

  function defaultRange(group){
    const start=Math.max(1,Math.min(10,Number(group.termStart||group.term||1)||1));
    const end=Math.max(start,Math.min(10,Number(group.termEnd||start)||start));
    return {start,end,level:Number(group.level)||Math.ceil(start/2)};
  }

  function ensureAlternativeGroupShape(group){
    if(!group)return false;
    let changed=false;
    const set=(key,value)=>{if(group[key]!==value){group[key]=value;changed=true}};
    const r=defaultRange(group);
    set('alternative',true);
    set('custom',true);
    set('elective',true);
    set('kind','espacio_formativo_alternativo');
    set('type','Espacio Formativo Alternativo');
    if(!group.component){group.component='formacion_general';changed=true}
    if(group.level==null){group.level=r.level;changed=true}
    if(group.termStart==null){group.termStart=r.start;changed=true}
    if(group.termEnd==null){group.termEnd=r.end;changed=true}
    if(group.term==null||group.term===''){group.term=String(group.termStart);changed=true}
    if(group.weeklyHours==null){group.weeklyHours=Math.max(0,Number(group.hours||0)||0);changed=true}
    if(group.hours==null){group.hours=group.weeklyHours;changed=true}
    if(!group.hoursMode){group.hoursMode='uniform';changed=true}
    if(!group.hoursByTerm||typeof group.hoursByTerm!=='object'){group.hoursByTerm={};changed=true}
    for(let term=group.termStart;term<=group.termEnd;term++){
      if(group.hoursByTerm[term]==null){group.hoursByTerm[term]=Number(group.weeklyHours)||0;changed=true}
    }
    if(group.objective==null){group.objective='';changed=true}
    if(group.context==null){group.context='';changed=true}
    if(!Array.isArray(group.items)){group.items=[];changed=true}
    if(!Array.isArray(group.subjects)){group.subjects=[];changed=true}
    return changed;
  }

  function addAlternative(){
    const f=frame(),w=f?.contentWindow,d=f?.contentDocument;
    if(!w||!d||!w.app?.current)return;
    const area=w.app.current;
    const cfg=w.CFG?.[area];
    const data=w.app.areas?.[area];
    if(!cfg?.e||!data)return;
    const count=(data.groups||[]).filter(isAlternative).length+1;
    const group={
      name:`Espacio Formativo Alternativo ${count}`,
      objective:'',
      context:'',
      type:'Espacio Formativo Alternativo',
      kind:'espacio_formativo_alternativo',
      component:'formacion_general',
      level:1,
      term:'1',
      termStart:1,
      termEnd:1,
      weeklyHours:0,
      hours:0,
      hoursMode:'uniform',
      hoursByTerm:{1:0},
      custom:true,
      elective:true,
      alternative:true,
      subjects:[],
      items:[]
    };
    data.groups.push(group);
    w.selected=data.groups.length-1;
    if(typeof w.save==='function')w.save(0);
    if(typeof w.renderBoard==='function')w.renderBoard();
    d.getElementById('integratedMapRefresh')?.click();
    setTimeout(()=>{
      const card=[...d.querySelectorAll('.group')][data.groups.length-1];
      card?.scrollIntoView({behavior:'smooth',block:'center'});
    },50);
  }

  function migrateExisting(w){
    if(migrated)return;
    let changed=false;
    Object.values(w.app?.areas||{}).forEach(area=>{
      (area.groups||[]).forEach(group=>{
        if(isAlternative(group))changed=ensureAlternativeGroupShape(group)||changed;
      });
    });
    migrated=true;
    if(changed&&typeof w.save==='function')w.save(0);
  }

  function syncFromBoard(w){
    const area=w.app?.current;
    if(!area)return;
    (w.app?.areas?.[area]?.groups||[]).forEach(group=>{
      if(!isAlternative(group))return;
      ensureAlternativeGroupShape(group);
      const start=Math.max(1,Math.min(10,Number(group.term)||Number(group.termStart)||1));
      group.termStart=start;
      group.termEnd=Math.max(start,Number(group.termEnd)||start);
      group.level=Math.ceil(start/2);
      group.term=String(start);
      group.weeklyHours=Math.max(0,Number(group.weeklyHours??group.hours??0)||0);
      group.hours=group.weeklyHours;
      if(group.hoursMode!=='per_term'){
        group.hoursMode='uniform';
        group.hoursByTerm={};
        for(let term=group.termStart;term<=group.termEnd;term++)group.hoursByTerm[term]=group.weeklyHours;
      }
    });
  }

  function relabel(){
    const f=frame(),w=f?.contentWindow,d=f?.contentDocument;
    if(!w||!d)return;
    migrateExisting(w);
    syncFromBoard(w);

    d.querySelectorAll('.area-meta').forEach(meta=>{
      meta.innerHTML=meta.innerHTML
        .replace(/electivos/gi,'Espacios Formativos Alternativos')
        .replace(/electivo/gi,'Espacio Formativo Alternativo');
    });

    d.querySelectorAll('.group').forEach(card=>{
      const index=Number(card.dataset.i);
      const group=w.app?.areas?.[w.app.current]?.groups?.[index];
      if(!isAlternative(group))return;
      ensureAlternativeGroupShape(group);
      card.classList.add('efa-group');
      const badge=card.querySelector('.badge');
      if(badge)badge.textContent='Espacio Formativo Alternativo';
      card.querySelectorAll('p.muted').forEach(p=>{
        if(/Tipo:/i.test(p.textContent))p.innerHTML='<b>Tipo:</b> Espacio Formativo Alternativo';
      });
      card.querySelectorAll('[data-delete]').forEach(btn=>{
        btn.textContent='Eliminar Espacio Formativo Alternativo';
      });
    });

    const tools=d.getElementById('electiveTools');
    const cfg=w.CFG?.[w.app?.current];
    if(tools){
      if(!cfg?.e){tools.innerHTML=''}
      else{
        let button=d.getElementById('addAlternativeGrouping');
        if(!button){
          tools.innerHTML='';
          button=d.createElement('button');
          button.id='addAlternativeGrouping';
          button.className='btn mint';
          button.type='button';
          button.textContent='＋ Agregar Espacio Formativo Alternativo';
          button.onclick=addAlternative;
          const note=d.createElement('span');
          note.className='muted';
          note.textContent='Es un agrupamiento más del área: se edita y recibe contenidos igual que los demás.';
          tools.append(button,note);
        }
      }
    }

    d.querySelectorAll('#sumBody .summary').forEach((card,index)=>{
      const group=w.app?.areas?.[w.app.current]?.groups?.[index];
      if(!isAlternative(group))return;
      card.classList.add('efa-summary');
      const badge=card.querySelector('.badge');
      if(badge)badge.textContent='Espacio Formativo Alternativo';
      card.querySelectorAll('p').forEach(p=>{
        if(/Tipo:\s*Electivo/i.test(p.textContent))p.innerHTML='<b>Tipo:</b> Espacio Formativo Alternativo';
      });
    });

    d.querySelectorAll('[data-map-area][data-map-index]').forEach(card=>{
      const area=card.dataset.mapArea;
      const index=Number(card.dataset.mapIndex);
      const group=w.app?.areas?.[area]?.groups?.[index];
      if(!isAlternative(group))return;
      card.classList.add('efa-map-group');
      if(!card.querySelector('[data-efa-map-label]')){
        const label=d.createElement('small');
        label.dataset.efaMapLabel='1';
        label.className='efa-map-label';
        label.textContent='Espacio Formativo Alternativo';
        card.appendChild(label);
      }
    });
  }

  function install(){
    const f=frame(),w=f?.contentWindow,d=f?.contentDocument;
    if(!w||!d||installed)return;
    installed=true;
    const style=d.createElement('style');
    style.textContent=`
      .group .badge{max-width:100%;white-space:normal;text-align:center}
      .efa-group,.efa-summary{border-color:#83ded3!important}
      .integrated-piece.efa-map-group{border-color:#83ded3}
      .efa-map-label{font-weight:900;color:#167557!important}
    `;
    d.head.appendChild(style);
    relabel();
    const observer=new MutationObserver(()=>relabel());
    observer.observe(d.body,{childList:true,subtree:true});
    d.addEventListener('change',()=>{syncFromBoard(w);if(typeof w.save==='function')w.save(0);d.getElementById('integratedMapRefresh')?.click();setTimeout(relabel,0)},true);
    d.addEventListener('click',()=>setTimeout(relabel,0),true);
  }

  frame()?.addEventListener('load',()=>setTimeout(install,300));
  setInterval(()=>{if(!installed)install()},600);
})();