(()=>{
  'use strict';
  const frame=()=>document.getElementById('pci');
  let installed=false;

  function hoursOf(group){
    const value=Number(group?.weeklyHours??group?.hours??0);
    return Number.isFinite(value)?value:0;
  }

  function decorate(){
    const f=frame(),w=f?.contentWindow,d=f?.contentDocument;
    if(!w||!d)return;
    const map=d.getElementById('integratedMap');
    if(!map)return;

    d.querySelectorAll('.integrated-piece[data-map-area][data-map-index]').forEach(card=>{
      const area=card.dataset.mapArea;
      const index=Number(card.dataset.mapIndex);
      const group=w.app?.areas?.[area]?.groups?.[index];
      if(!group)return;
      let meta=card.querySelector('small');
      if(!meta){
        meta=d.createElement('small');
        card.appendChild(meta);
      }
      meta.textContent=`${hoursOf(group)} HC`;
      card.title=`${group.name||'Agrupamiento'} · ${hoursOf(group)} HC · clic para ver detalle`;
    });
  }

  function install(){
    const f=frame(),d=f?.contentDocument;
    if(!d||installed)return;
    installed=true;
    const style=d.createElement('style');
    style.id='mapa-limpio-styles';
    style.textContent=`
      .integrated-cell{min-height:74px!important;padding:6px!important}
      .integrated-piece{padding:8px 9px!important;margin:2px 0!important;box-shadow:none!important}
      .integrated-piece strong{font-size:.8rem!important;line-height:1.2!important}
      .integrated-piece small{margin-top:3px!important;font-size:.72rem!important;font-weight:850!important;color:var(--muted)!important}
      .integrated-empty{opacity:.7}
    `;
    d.head.appendChild(style);
    decorate();
    const observer=new MutationObserver(decorate);
    observer.observe(d.body,{childList:true,subtree:true});
  }

  frame()?.addEventListener('load',()=>setTimeout(install,500));
  setInterval(()=>{if(!installed)install();else decorate()},800);
})();