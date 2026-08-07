(()=>{
  'use strict';
  const frame=()=>document.getElementById('pci');
  let installed=false;

  function ensureAlternativeGroupShape(group){
    if(!group)return;
    group.alternative=true;
    group.custom=true;
    group.elective=true;
    group.type='Espacio Formativo Alternativo';
    if(group.objective==null)group.objective='';
    if(group.context==null)group.context='';
    if(group.term==null)group.term='';
    if(!Array.isArray(group.items))group.items=[];
  }

  function addAlternative(){
    const f=frame(),w=f?.contentWindow,d=f?.contentDocument;
    if(!w||!d||!w.app?.current)return;
    const area=w.app.current;
    const data=w.app.areas?.[area];
    if(!data)return;
    const count=(data.groups||[]).filter(g=>g.alternative||g.type==='Espacio Formativo Alternativo').length+1;
    const group={
      name:`Espacio Formativo Alternativo ${count}`,
      objective:'',
      context:'',
      type:'Espacio Formativo Alternativo',
      term:'',
      custom:true,
      elective:true,
      alternative:true,
      items:[]
    };
    data.groups.push(group);
    if(typeof w.selected!=='undefined')w.selected=data.groups.length-1;
    if(typeof w.save==='function')w.save(0);
    if(typeof w.renderBoard==='function')w.renderBoard();
    setTimeout(()=>{
      const cards=[...d.querySelectorAll('.group')];
      const card=cards[data.groups.length-1];
      card?.scrollIntoView({behavior:'smooth',block:'center'});
    },50);
  }

  function relabel(){
    const f=frame(),w=f?.contentWindow,d=f?.contentDocument;
    if(!w||!d)return;

    d.querySelectorAll('.area-meta').forEach(meta=>{
      meta.innerHTML=meta.innerHTML
        .replace(/electivos/gi,'Espacios Formativos Alternativos')
        .replace(/electivo/gi,'Espacio Formativo Alternativo');
    });

    d.querySelectorAll('.group').forEach(card=>{
      const i=Number(card.dataset.i);
      const g=w.app?.areas?.[w.app.current]?.groups?.[i];
      if(!(g?.custom||g?.elective||g?.alternative||g?.type==='Espacio Formativo Alternativo'))return;
      ensureAlternativeGroupShape(g);
      card.classList.add('efa-group');
      const badge=card.querySelector('.badge');
      if(badge)badge.textContent='Espacio Formativo Alternativo';
      card.querySelectorAll('p.muted').forEach(p=>{
        if(/Tipo:/i.test(p.textContent))p.innerHTML='<b>Tipo:</b> Espacio Formativo Alternativo';
      });
      card.querySelectorAll('[data-delete]').forEach(btn=>btn.textContent='Eliminar Espacio Formativo Alternativo');
    });

    const board=d.getElementById('board');
    const tools=d.getElementById('electiveTools');
    if(board&&tools){
      let add=d.getElementById('addAlternativeGrouping');
      if(!add){
        tools.innerHTML='';
        add=d.createElement('button');
        add.id='addAlternativeGrouping';
        add.className='btn mint';
        add.textContent='＋ Agregar Espacio Formativo Alternativo';
        add.onclick=addAlternative;
        const note=d.createElement('span');
        note.className='muted';
        note.textContent='Es un agrupamiento más del área: se edita y recibe contenidos igual que los demás.';
        tools.append(add,note);
      }
    }

    d.querySelectorAll('#sumBody .badge').forEach(b=>{
      if(/Electivo/i.test(b.textContent))b.textContent='Espacio Formativo Alternativo';
    });
    d.querySelectorAll('#sumBody p').forEach(p=>{
      if(/Tipo:\s*Electivo/i.test(p.textContent))p.innerHTML='<b>Tipo:</b> Espacio Formativo Alternativo';
    });
  }

  function install(){
    const f=frame(),w=f?.contentWindow,d=f?.contentDocument;
    if(!w||!d||installed)return;
    installed=true;

    const style=d.createElement('style');
    style.textContent='.group .badge{max-width:100%;white-space:normal;text-align:center}.efa-group{border-color:#83ded3!important}';
    d.head.appendChild(style);

    relabel();
    const observer=new MutationObserver(()=>relabel());
    observer.observe(d.body,{childList:true,subtree:true});
    d.addEventListener('click',()=>setTimeout(relabel,0),true);
  }

  frame()?.addEventListener('load',()=>setTimeout(install,300));
  setInterval(()=>{if(!installed)install()},600);
})();