(()=>{
  'use strict';
  const frame=()=>document.getElementById('pci');
  let installed=false;

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
      if(!(g?.custom||g?.elective||g?.alternative))return;
      g.alternative=true;
      if(!g.type||g.type==='Electivo')g.type='Espacio Formativo Alternativo';
      const badge=card.querySelector('.badge');
      if(badge)badge.textContent='Espacio Formativo Alternativo';
      card.querySelectorAll('p.muted').forEach(p=>{
        if(/Tipo:/i.test(p.textContent))p.innerHTML='<b>Tipo:</b> Espacio Formativo Alternativo';
      });
      card.querySelectorAll('[data-delete]').forEach(btn=>btn.textContent='Eliminar Espacio Formativo Alternativo');
    });

    const tools=d.getElementById('electiveTools');
    const add=d.getElementById('addElective');
    if(tools&&add){
      add.textContent='＋ Agregar Espacio Formativo Alternativo';
      const note=tools.querySelector('.muted');
      if(note)note.textContent='Se agrega a los espacios prescriptos del área y puede ubicarse en el cuatrimestre que corresponda.';
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
    style.textContent='.group .badge{max-width:100%;white-space:normal;text-align:center}';
    d.head.appendChild(style);

    relabel();
    const observer=new MutationObserver(()=>relabel());
    observer.observe(d.body,{childList:true,subtree:true});
    d.addEventListener('click',()=>setTimeout(relabel,0),true);
  }

  frame()?.addEventListener('load',()=>setTimeout(install,300));
  setInterval(()=>{if(!installed)install()},600);
})();