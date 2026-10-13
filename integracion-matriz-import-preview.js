import { prepareReview, approveReview } from './src/integracion-curricular/revision-importacion-original.js';
const $ = id => document.getElementById(id);
const clean = text => String(text ?? '').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const dialog=$('pci-import-review');
const open=$('pciImportOpen');
let review=null, sourceSnapshot=null;
if(dialog&&open){
 const orientation=()=>$('pciDemoOrientationContext')?.textContent.trim()||'Orientación sin seleccionar';
 const original=()=>window.PCIApp?.getState?.();
 function status(message){$('pciImportResult').textContent=message;}
 function reset(){
   review=null;sourceSnapshot=null;
   $('pciImportReviewContent').hidden=true;$('pciImportReviewed').checked=false;
   $('pciImportApprove').disabled=true;$('pciImportExport').disabled=true;
 }
 open.addEventListener('click',()=>{reset();$('pciImportOrientation').textContent=orientation();status('La Matriz original no se modifica con esta revisión.');dialog.showModal();});
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
