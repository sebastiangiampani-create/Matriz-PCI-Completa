(()=>{
  const temporal=document.createElement('script');
  temporal.src='temporal-model.js?v=step1-2';
  temporal.defer=true;
  document.head.appendChild(temporal);

  function addMapAccess(){
    const actions=document.querySelector('.top .actions');
    if(!actions||document.getElementById('openMap'))return;
    const link=document.createElement('a');
    link.id='openMap';
    link.className='btn mint';
    link.href='mapa.html';
    link.textContent='Mapa curricular';
    link.setAttribute('aria-label','Abrir Mapa Curricular Institucional');
    actions.insertBefore(link,actions.firstChild);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',addMapAccess,{once:true});
  }else{
    addMapAccess();
  }
})();