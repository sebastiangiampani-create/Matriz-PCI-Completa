(() => {
  function removeObsoleteNotice(){
    const offer=document.getElementById('offer');
    if(!offer)return;
    offer.querySelectorAll('.notice').forEach(el=>{
      const text=String(el.textContent||'').replace(/\s+/g,' ').trim();
      if(text.startsWith('Mapa inicial:'))el.remove();
    });
    offer.querySelectorAll('.hero p').forEach(el=>{
      const text=String(el.textContent||'').replace(/\s+/g,' ').trim();
      if(text.startsWith('La bolsa contiene todas las materias de Formación General'))el.remove();
    });
  }
  window.addEventListener('pci-app-ready',()=>{removeObsoleteNotice();setTimeout(removeObsoleteNotice,100);setTimeout(removeObsoleteNotice,500)});
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-go="offer"],#openOffer'))setTimeout(removeObsoleteNotice,0)},true);
  window.PCIRemoveObsoleteMapNoticeV112={removeObsoleteNotice};
})();