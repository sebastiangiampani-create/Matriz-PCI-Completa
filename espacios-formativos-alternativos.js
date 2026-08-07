(()=>{
  'use strict';
  const frame=()=>document.getElementById('pci');
  let installed=false;

  function install(){
    const f=frame(),w=f?.contentWindow,d=f?.contentDocument;if(!w||!d||installed)return;
    if(typeof w.renderBoard!=='function'||typeof w.addElective!=='function'){setTimeout(install,300);return}
    installed=true;

    const style=d.createElement('style');
    style.textContent=`.efa-note{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.efa-badge{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;background:#eaf9f7;color:#167557;font-size:.74rem;font-weight:900}.efa-help{color:var(--muted);font-size:.84rem}.efa-card{border-color:#83ded3!important}`;
    d.head.appendChild(style);

    const originalNormalize=w.normalizeGroups;
    w.normalizeGroups=function(area){
      originalNormalize(area);
      (w.app?.areas?.[area]?.groups||[]).forEach((g,i)=>{
        if(g.custom||g.elective){g.alternative=true;g.elective=true;g.custom=true;if(!g.type||g.type==='Electivo')g.type='Espacio Formativo Alternativo'}
      });
    };

    w.addElective=function(){
      const area=w.app.current,c=w.CFG[area],data=w.app.areas[area];
      const count=data.groups.filter(g=>g.alternative||g.custom||g.elective).length+1;
      data.groups.push({name:`Espacio Formativo Alternativo ${count}`,objective:'',context:'',type:'Espacio Formativo Alternativo',term:'',custom:true,elective:true,alternative:true,items:[]});
      w.selected=data.groups.length-1;w.save(0);w.renderBoard();
      setTimeout(()=>d.getElementById('groups')?.scrollIntoView({behavior:'smooth',block:'start'}),50);
    };

    w.renderElectiveTools=function(){
      const c=w.CFG[w.app.current],box=d.getElementById('electiveTools');if(!box)return;
      if(!c.e){box.innerHTML='';return}
      box.innerHTML=`<div class="efa-note"><button id="addElective" class="btn mint">＋ Agregar Espacio Formativo Alternativo</button><span class="efa-help">Se agrega a los espacios prescriptos del área y puede ubicarse en el cuatrimestre que corresponda.</span></div>`;
      d.getElementById('addElective').onclick=w.addElective;
    };

    const originalRenderGroups=w.renderGroups;
    w.renderGroups=function(){
      originalRenderGroups();
      d.querySelectorAll('.group').forEach(card=>{
        const i=Number(card.dataset.i),g=w.app?.areas?.[w.app.current]?.groups?.[i];
        if(!(g?.alternative||g?.custom||g?.elective))return;
        card.classList.add('efa-card');
        const badge=card.querySelector('.badge');if(badge)badge.textContent='Espacio Formativo Alternativo';
        card.querySelectorAll('p.muted').forEach(p=>{if(/Tipo:/i.test(p.textContent))p.innerHTML='<b>Tipo:</b> Espacio Formativo Alternativo'});
        card.querySelectorAll('[data-delete]').forEach(btn=>btn.textContent='Eliminar Espacio Formativo Alternativo');
      });
    };

    const originalRenderAreas=w.renderAreas;
    w.renderAreas=function(){
      originalRenderAreas();
      d.querySelectorAll('.area-meta').forEach(meta=>{meta.innerHTML=meta.innerHTML.replace(/electivo(s)?/gi,'Espacio$1 Formativo$1 Alternativo$1')});
    };

    const originalSummary=w.renderSummary;
    w.renderSummary=function(){
      originalSummary();
      d.querySelectorAll('#sumBody .badge').forEach(b=>{if(/Electivo/i.test(b.textContent))b.textContent='Espacio Formativo Alternativo'});
      d.querySelectorAll('#sumBody p').forEach(p=>{if(/Tipo:\s*Electivo/i.test(p.textContent))p.innerHTML='<b>Tipo:</b> Espacio Formativo Alternativo'});
    };

    try{w.normalizeGroups(w.app.current);w.renderAreas();if(d.getElementById('board')?.classList.contains('active'))w.renderBoard()}catch{}
  }

  frame()?.addEventListener('load',()=>setTimeout(install,500));
  setInterval(()=>{if(!installed)install()},700);
})();