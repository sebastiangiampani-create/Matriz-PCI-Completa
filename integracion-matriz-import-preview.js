import { prepareReview, approveReview, assessPriorWork } from './src/integracion-curricular/revision-importacion-original.js';
const $ = id => document.getElementById(id);
const clean = text => String(text ?? '').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const dialog=$('pci-import-review');
const open=$('pciImportOpen');
let review=null, sourceSnapshot=null;
if(dialog&&open){
 const orientation=()=>$('pciDemoOrientationContext')?.textContent.trim()||'Orientación sin seleccionar';
 const original=()=>window.PCIApp?.getState?.();
 function updateSavedStatus(){
   const found=assessPriorWork(original());
   const side=$('pciImportSavedStatus'), detail=$('pciImportSavedDetail');
   if(found.available){
     const chunks=[
       found.contentCount ? found.contentCount+(found.contentCount===1?' contenido ubicado':' contenidos ubicados') : '',
       found.developedPlans ? found.developedPlans+' planes desarrollados' : '',
       found.sequenceCount ? found.sequenceCount+' secuencias con etapas' : '',
       found.describedGroups ? found.describedGroups+' agrupamientos con desarrollo' : ''
     ].filter(Boolean);
     const numbers=chunks.join(' · ');
     if(side)side.textContent='Hay trabajo cargado en esta Matriz: '+numbers+'. Podés preparar una copia para revisarlo y reutilizarlo, sin perder el original.';
     if(detail)detail.textContent='Se encontró información en la Matriz disponible en esta sesión: '+numbers+'. La copia conserva lo existente y permite revisarlo antes del OK.';
   }else{
     if(side)side.textContent='¿Ya trabajaste en la Matriz anterior? La información guardada se podrá reutilizar, sin empezar de cero. En esta sesión todavía no se detecta trabajo previo; ingresá desde el acceso de tu escuela para consultar los datos guardados.';
     if(detail)detail.textContent='En la Matriz disponible en esta sesión todavía no se detectan contenidos, planes o secuencias cargados. Si tu escuela ya trabajó online, accedé con su usuario habitual para recuperar el estado guardado antes de preparar la copia.';
   }
   if(side)side.dataset.priorWork=found.available?'found':'unverified';
   if(detail)detail.dataset.priorWork=found.available?'found':'unverified';
 }
 window.addEventListener('pci-state-change',updateSavedStatus);
 updateSavedStatus();
 function status(message){$('pciImportResult').textContent=message;}
 function reset(){
   review=null;sourceSnapshot=null;
   $('pciImportReviewContent').hidden=true;$('pciImportReviewed').checked=false;
   $('pciImportApprove').disabled=true;$('pciImportExport').disabled=true;
 }
 open.addEventListener('click',()=>{reset();updateSavedStatus();$('pciImportOrientation').textContent=orientation();status('La Matriz original no se modifica con esta revisión.');dialog.showModal();});
 $('pciImportClose').addEventListener('click',()=>dialog.close());
 $('pciImportPrepare').addEventListener('click',()=>{
   try{
     const state=original();
     if(!state) throw new Error('La Matriz original todavía no terminó de cargar.');
     const selected=orientation();
     const mapState=JSON.parse(localStorage.getItem('pci-matriz-fg-v2-original-preview-20261009')||'{}');
     review=prepareReview(state,selected,mapState?.maps?.[selected]);
     sourceSnapshot=JSON.stringify(state);
     const summary=review.summary;
     $('pciImportMetrics').innerHTML=[
       ['Áreas',summary.areaCount],['Agrupamientos',summary.groupCount],
       ['Contenidos distintos',summary.contentCount],['Planes guardados',summary.plans],
       ['Planes con información',summary.plansWithData],['Secuencias con etapas',summary.sequences]
     ].map(([label,value])=>'<div><strong>'+Number(value)+'</strong><small>'+clean(label)+'</small></div>').join('');
     $('pciImportAreas').innerHTML=summary.areas.map(area=>
       '<div class="pci-import-area"><strong>'+clean(area.name)+'</strong><span>'+
       area.groups+' agrupamientos · '+area.contents+' contenidos · '+area.plans+' planes · '+area.sequences+' secuencias con etapas</span></div>'
     ).join('');
     $('pciImportWarnings').innerHTML=review.warnings.length
       ? review.warnings.map(w=>'<p><strong>'+clean(w.area)+':</strong> '+clean(w.message)+'</p>').join('')
       : '<p>Sin diferencias estructurales detectadas por esta revisión preliminar. Todavía falta verificar la homologación de contenidos y la persistencia por orientación.</p>';
     $('pciImportReviewContent').hidden=false;
     $('pciImportExport').disabled=false;
     $('pciImportReviewed').checked=false;
     $('pciImportApprove').disabled=true;
     status('Copia de revisión preparada en memoria. Nada se importó ni se guardó online.');
   }catch(e){reset();status(e.message);}
 });
 $('pciImportReviewed').addEventListener('change',event=>{
   $('pciImportApprove').disabled=!event.target.checked||!review;
 });
 $('pciImportApprove').addEventListener('click',()=>{
   try{
     if(!review||!$('pciImportReviewed').checked)throw new Error('Primero revisá y confirmá la copia.');
     if(orientation()!==review.orientation)throw new Error('Cambiaste de orientación. Prepará una nueva copia para revisarla.');
     review=approveReview(review,original());
     $('pciImportApprove').disabled=true;$('pciImportReviewed').disabled=true;
     status('OK de revisión registrado solo en esta ventana. Importación definitiva pendiente: no se escribió ningún dato escolar.');
   }catch(e){status(e.message);}
 });
 $('pciImportExport').addEventListener('click',()=>{
   if(!review)return;
   const payload={format:review.format,orientation:review.orientation,
     summary:review.summary,warnings:review.warnings,reviewed:review.reviewed,
     approved:review.approved,source:review.source};
   const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
   const uri=URL.createObjectURL(blob);
   const link=document.createElement('a');
   link.href=uri;link.download='Revision_Matriz_'+review.orientation.replace(/[^a-z0-9]+/gi,'_')+'.json';
   link.click();URL.revokeObjectURL(uri);
 });
 dialog.addEventListener('close',()=>{$('pciImportReviewed').disabled=false;});
}
