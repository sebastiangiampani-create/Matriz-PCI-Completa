(() => {
  const work=()=>window.PCIInstitutionalWorkV53||null;
  const offerApi=()=>window.PCIOfferModelV56||null;

  function patchScheduler(){
    const w=work(),api=offerApi();
    if(!w||!api?.syntheticOutsideRows)return;
    w.outsideRows=sem=>api.syntheticOutsideRows(Number(sem)||1);
    w.__v56Patched=true;
    w.__v63OfferPatched=true;
  }

  function fixConflictCopy(){
    document.querySelectorAll('.v58-offer-conflict').forEach(box=>box.remove());
  }

  patchScheduler();
  fixConflictCopy();
  window.addEventListener('pci-app-ready',()=>setTimeout(()=>{patchScheduler();fixConflictCopy()},120));
  document.addEventListener('click',e=>{
    if(e.target.closest('#openInstitutional,#openInstitutionalGeneral,[data-v71n-open],[data-v53-check],[data-v53-generate]')){
      setTimeout(()=>{patchScheduler();fixConflictCopy()},40);
    }
  },true);

  window.PCIOfferRuntimeFixV63={patchScheduler,fixConflictCopy};
})();