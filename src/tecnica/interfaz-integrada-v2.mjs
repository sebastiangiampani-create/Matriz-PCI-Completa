/**
 * Adaptador de Educación Técnica A LA MISMA interfaz PCI V2.
 * Reutiliza #editor, #fgPane, #offerPane y #foPane, tarjetas, mapa y CSS.
 * No hay segunda aplicación ni sesión nueva. No llama a Supabase directamente.
 */
import {findSpecialty,TECNICA,validateRelation} from './pautas-pci-20261005.mjs';
import {phaseGate as evaluatePhaseGate} from '../pci-flujo-fases.mjs';
import {
 TECH_FIELDS,TECH_FG_AREAS,TECH_SPECIFIC_AREAS,TECH_OFFER_VERSION,TECH_PLAN_VERSION,
 technicalSubjectBank,technicalSubjectCards,placeTechnicalSubject,
 technicalOfferSeed,guardTechnicalOffer,guardTechnicalPlan,
 technicalMapRows,technicalCoverage,technicalPlanSeed,validateTechnicalDraft,
 prepareTechnicalOfferFinal,
 addTechnicalIntegration,addTechnicalRepresentationThird,addTechnicalAnnualPending,
 addTechnicalProfessionalPractice,moveTechnicalTerm,setTechnicalSubject,updateTechnicalSpace,
 technicianTerms,TECH_STAGES
} from './espacio-trabajo-v2.mjs';

const $=id=>document.getElementById(id);
const copy=x=>JSON.parse(JSON.stringify(x));
const el=(tag,host,label,cls)=>{
 const e=document.createElement(tag);if(label!==undefined)e.textContent=String(label);
 if(cls)e.className=cls;if(host)host.appendChild(e);return e;
};
const btn=(host,label,handler,cls='btn')=>{
 const e=el('button',host,label,cls);e.type='button';e.onclick=handler;return e;
};
const picker=(host,label,choices,value,callback)=>{
 const wrapper=el('label',host);
 el('span',wrapper,label);
 const select=el('select',wrapper);
 for(const [key,label] of choices){const option=el('option',select,label);option.value=String(key);}
 select.value=String(value??'');
 select.addEventListener('change',()=>callback(select.value));
 return select;
};
const field=(host,label,value,callback,{multiline=true}={})=>{
 const wrapper=el('label',host);el('span',wrapper,label);
 const input=el(multiline?'textarea':'input',wrapper);
 input.value=value==null?'':String(value);
 input.addEventListener('change',()=>callback(input.value));
 return input;
};
const normalized=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const labels={punto_partida:'Punto de partida',indagacion:'Indagación',
 produccion:'Producción',evaluacion:'Evaluación'};
const defaultText={
 tab3:'2 · Desarrollo FO',heading3:'Planes de aprendizaje',heading1:'Formación General por área',
 heading2:'Mapa de la Oferta · C1 a C10'
};
function choiceLabel(s){return s.character==='electivo'?'Electivo':'Obligatorio';}
function inputCombo(host,choices,chosen,placeholder){
 const s=el('select',host);const first=el('option',s,placeholder);
 first.value='';
 for(const [value,label] of choices){
  const option=el('option',s,label);option.value=String(value);
 }
 s.value=chosen??'';
 return s;
}
function sourcePdf(row){
 if(!row||typeof row.source_url!=='string')return null;
 try{
  const url=new URL(row.source_url);
  if(url.protocol!=='https:'||url.hostname!=='static.buenosaires.gob.ar')return null;
  if(!url.pathname.toLowerCase().endsWith('.pdf'))return null;
  return url.href+'#page='+row.page;
 }catch{return null;}
}
const createWarning=(host,message)=>el('p',host,message,'muted');
export function createIntegratedTechnicalUI({
 canEdit=()=>false,getUnit,saveUnit,saveSafe,
 download,rememberDraft,forgetDraft,recallDraft,
 message=()=>{},status=()=>{},onPhaseChange=()=>{}
}){
 let pci=null,source=null,bank=[],offer=null,offerRevision=0,offerDirty=false;
 let activeArea='Ciencias Sociales',activeSpace=null,activePlanId=null,plan=null,
   planRevision=0,planDirty=false,tab='fg',loading=0;
 let search='',yearFilter=0,spaceYear=0,spaceArea='';
 let sourceWarnings=[];
 let historicalForDisplay=null;
 function writable(){
  return !!pci&&canEdit()&&['borrador','en_revision'].includes(pci.status);
 }
 function phaseGate(){
   if(!pci||!offer)return evaluatePhaseGate({issues:['El mapa técnico no está disponible.']});
   const audit=validateTechnicalDraft(offer,bank);
   const issues=(audit.issues||[]).map(x=>x.message);
   if(offer.needsNormativeReview&&!offer.normativeReviewAcknowledged)
     issues.push('Revisá los espacios históricos y las Prácticas Profesionalizantes antes de continuar.');
   return evaluatePhaseGate({
     revision:offerRevision,dirty:offerDirty,issues,warnings:(audit.warnings||[]).map(x=>x.message),
     label:'Constructor de Educación Técnica'
   });
 }
 let selectedTechnicalSubject=null,draggedTechnicalSubject=null,draggedTechnicalSpace=null;
 function assignSubject(space,subjectKey){
  if(!writable())return;
  try{
   offer=placeTechnicalSubject(offer,{spaceId:space.id,subjectKey,bank});
   selectedTechnicalSubject=null;draggedTechnicalSubject=null;
   activeSpace=space.id;changedOffer();
  }catch(error){message(error.message,'error');}
 }
 function setupSubjectDrop(node,space){
  if(!writable())return;
  node.classList.add('drop-zone');
  node.addEventListener('dragover',e=>{
   if(!draggedTechnicalSubject)return;
   e.preventDefault();node.classList.add('drop-over');
   if(e.dataTransfer)e.dataTransfer.dropEffect='move';
  });
  node.addEventListener('dragleave',()=>node.classList.remove('drop-over'));
  node.addEventListener('drop',e=>{
   if(!draggedTechnicalSubject)return;
   e.preventDefault();e.stopPropagation();node.classList.remove('drop-over');
   assignSubject(space,draggedTechnicalSubject);
  });
 }
 function changedOffer(){
  offerDirty=true;
  rememberDraft('oferta-tecnica','mapa-oferta-tecnica-v1',offer,offerRevision);
  renderOffer();onPhaseChange();
  message('Mapa técnico modificado. Guardá el borrador; el PCI histórico permanece intacto.','warn');
 }
 function changedPlan(){
  planDirty=true;rememberDraft('tecnica-plan',plan.space_id,plan,planRevision);
  message('Cambios del plan técnico pendientes de guardar.','warn');
 }
 function setLabels(tech){
  $('downloadOriginal').textContent=tech?'Descargar PCI histórico':'Descargar FG original';
  const n=document.querySelector('[data-tab="fo"]');
  if(n)n.textContent=tech?'2 · Desarrollo técnico-específico':'2 · Desarrollo FO';
  const fgDescription=$('fgPane')?.querySelector('.topline .muted');
  if(fgDescription)fgDescription.textContent=tech?
    'Formación General y Científico-Tecnológica: materias y páginas oficiales por nivel. Los agrupamientos y planes históricos siguen disponibles como resguardo; no se eliminan.':
    'Los contenidos y las secuencias anteriores se importan sin cambiar el documento original. Las equivalencias V2 se identifican automáticamente.';
  const offerDescription=$('offerPane')?.querySelector('.topline .muted');
  if(offerDescription)offerDescription.textContent=tech?
    'Seis niveles con troncales anuales, integraciones, espacios formativos, especialidad y recorrido de Vinculación con 1 o 2 Prácticas Profesionalizantes según el plan. La carga horaria requiere validación.':
    'Distribución de laboratorios, talleres y Proyecto de Vinculación. Las materias de FO se seleccionan según la orientación y su carga horaria.';
  const fgEyebrow=$('fgPane')?.querySelector('.topline .eyebrow');
  if(fgEyebrow)fgEyebrow.textContent=tech?
    'Formación General + Científico-Tecnológica':'FG Matriz histórica → FG V2';
  const offerEyebrow=$('offerPane')?.querySelector('.topline .eyebrow');
  if(offerEyebrow)offerEyebrow.textContent=tech?
    'Mapa de la oferta · Educación Técnica':'Formación General + Formación Orientada';
  const foEyebrow=$('foPane')?.querySelector('.topline .eyebrow');
  if(foEyebrow)foEyebrow.textContent=tech?
    'Desarrollo curricular técnico':'FO · Desarrollo curricular';
  const offerListTitle=$('offerPane')?.querySelector(':scope > h4');
  if(offerListTitle)offerListTitle.textContent=tech?
    'Espacios curriculares de Educación Técnica':'Espacios de Formación Orientada';
  $('foSpaces')?.classList.toggle('tech-plan-index',tech);
  const fgH=$('fgPane')?.querySelector('.topline h3');
  const offerH=$('offerPane')?.querySelector('.topline h3');
  const foH=$('foPane')?.querySelector('.topline h3');
  if(fgH)fgH.textContent=tech?'Formación General y Científico-Tecnológica':defaultText.heading1;
  if(offerH)offerH.textContent=tech?'Mapa de la Oferta · C1 a C12':defaultText.heading2;
  if(foH)foH.textContent=tech?'Desarrollo curricular y planes de aprendizaje':'Planes de aprendizaje';
  const a=$('foAlternative')?.closest('label');
  if(a)a.hidden=tech;
  if(!tech)$('offerGrid').classList.remove('tech-offer-view');
  $('confirmFoContents').hidden=tech;
  $('saveOffer').textContent=tech?'Guardar mapa técnico':'Guardar mapa';
  const foDescription=$('foPane')?.querySelector('.topline .muted');
  if(foDescription)foDescription.textContent=tech?
   'Cuatro planes por espacio y sus etapas, con referencias a contenidos priorizados. Cada desarrollo tiene revisión propia.':
   'Cada espacio FO guarda sus objetivos, sinopsis y las cuatro etapas de cada plan, con control de versiones.';
 }
 function buildHeader(){
  $('pciName').textContent=pci.title||'PCI '+source.especialidad_nombre;
  $('pciTag').textContent='Educación Técnica · '+source.especialidad_nombre;
  $('pciInfo').textContent='Niveles 1.º a 6.º · C1–C12 · 26 especialidades oficiales · '+
   'Plan particular y horas pendientes de validación · Documento escolar anterior protegido';
  const stats=$('metrics');stats.replaceChildren();
  const spaces=offer.spaces,validated=spaces.filter(x=>x.confirmed).length;
  const metrics=[
   [6,'Niveles'],[12,'Cuatrimestres'],
   [spaces.length,'Espacios en el mapa'],[validated,'Espacios revisados']
  ];
  for(const [value,label] of metrics){
   const div=el('div',stats,undefined,'metric');el('strong',div,value);el('small',div,label);
  }
  $('saveOffer').disabled=!writable();
 }
 function summarizeMap(){
  const audit=validateTechnicalDraft(offer,bank),coverage=technicalCoverage(offer,bank);
  const count=offer.spaces.reduce((out,s)=>out+s.contentIds.length,0);
  const flag=audit.issues.length?
    audit.issues.length+' espacios requieren revisión de composición':'Estructura provisional';
  $('offerValidation').textContent=flag+' · '+audit.warnings.length+' observaciones pendientes'+
    ' · '+count+' referencias documentales distribuidas'+
    ' · revisión '+offerRevision+(offerDirty?' · Sin guardar':' · Guardado');
  $('offerValidation').title=[...audit.issues.slice(0,30),...audit.warnings.slice(0,30)]
   .map(x=>x.message).join('\n');
 }
 function renderFg(){
  const areas=$('areaList'),body=$('areaEditor');
  areas.replaceChildren();body.replaceChildren();
  const counts=new Map();
  for(const area of TECH_FG_AREAS)counts.set(area,offer.spaces.filter(s=>s.area===area).length);
  for(const area of TECH_FG_AREAS){
   const b=btn(areas,area+' · '+counts.get(area)+' espacios',()=>{activeArea=area;renderFg();},
     'areaItem'+(area===activeArea?' active':''));
   b.type='button';
  }
  el('h3',body,activeArea);
  const related=offer.spaces.filter(s=>s.area===activeArea).sort((a,b)=>a.year-b.year||a.term-b.term);
  const areaCoverage=technicalCoverage(offer,bank,{area:activeArea});
  createWarning(body,areaCoverage.used+' / '+areaCoverage.denominator+
   ' referencias documentales distribuidas · '+(areaCoverage.percent??'—')+
   '% de revisión documental provisional. No equivale a validación curricular.');
  // La FG histórica no se transforma ni se borra en una importación automática.
  const history=(historicalForDisplay||pci.legacy_state)?.areas?.[activeArea];
  if(history){
   const historyBox=el('details',body,undefined,'workCard');
   el('summary',historyBox,'Resguardo de agrupamientos históricos · lectura, sin reemplazo');
   const groups=Array.isArray(history.groups)?history.groups:[];
   for(const g of groups){
    el('strong',historyBox,g.name||g.id||'Agrupamiento anterior');
    createWarning(historyBox,(g.items||[]).length+' contenidos · '+
      (g.plansBimestrales||[]).length+' planes anteriores intactos');
   }
  }
  for(const s of related){
   const card=el('div',body,undefined,'workCard');
   el('strong',card,s.name);
   createWarning(card,s.year+'º · C'+s.term+(s.duration==='anual'?'–C'+s.endTerm:'')+
     ' · '+choiceLabel(s)+' · '+s.contentIds.length+' referencias vinculadas');
   btn(card,'Editar espacio en el mapa',()=>{activeSpace=s.id;tab='oferta';activateTab();});
   btn(card,'Desarrollar los cuatro planes',()=>{tab='fo';activateTab();openPlan(s.id);});
  }
 }
 function renderTable(){
  const h=$('mapHead'),body=$('mapBody');h.replaceChildren();body.replaceChildren();
  const bands=el('tr',h);el('th',bands,'Área / nivel').rowSpan=2;
  for(let y=1;y<=6;y++){const th=el('th',bands,'Nivel '+y);th.colSpan=2;}
  const terms=el('tr',h);
  for(let t=1;t<=12;t++)el('th',terms,'C'+t);
  const map=technicalMapRows(offer);
  for(const group of map.areas){
   const tr=el('tr',body);el('th',tr,group.area);
   for(let i=0;i<group.cells.length;i++){
    const cell=group.cells[i],td=el('td',tr);
    // Los espacios anuales ocupan ambos cuatrimestres del nivel.
    // No ocultar contenidos de C par: unir columnas únicamente cuando ambas
    // celdas muestran exactamente los mismos espacios anuales del nivel.
    const nextCell=group.cells[i+1];
    const annual=cell.term%2===1&&cell.spaces.length>0&&
      cell.spaces.every(x=>x.duration==='anual'&&x.term===cell.term)&&
      nextCell?.spaces.length===cell.spaces.length&&
      nextCell.spaces.every(x=>cell.spaces.some(y=>y.id===x.id));
    if(annual){td.colSpan=2;td.dataset.pciAnnual='true';i++;}
    // Una zona vacía admite mover el formato dentro de los cuatrimestres
    // permitidos por la regla Técnica, sin modificar sus contenidos.
    td.classList.add('constructor-cell');
    td.addEventListener('dragover',e=>{
     if(!draggedTechnicalSpace)return;
     e.preventDefault();td.classList.add('drop-over');
    });
    td.addEventListener('dragleave',()=>td.classList.remove('drop-over'));
    td.addEventListener('drop',e=>{
     if(!draggedTechnicalSpace)return;
     e.preventDefault();e.stopPropagation();td.classList.remove('drop-over');
     const sourceSpace=offer.spaces.find(x=>x.id===draggedTechnicalSpace);
     if(!sourceSpace||sourceSpace.area!==group.area){
      message('El formato técnico permanece en su área original.','error');return;
     }
     try{
      offer=moveTechnicalTerm(offer,sourceSpace.id,cell.term);
      draggedTechnicalSpace=null;changedOffer();
     }catch(error){message(error.message,'error');}
    });
    for(const s of cell.spaces){
     const name=s.name.replace(/\s+·\s+\d+º$/,'');
     const button=btn(td,name+(s.duration==='anual'?' · anual':''),()=>{
      if(selectedTechnicalSubject)assignSubject(s,selectedTechnicalSubject);
      else {activeSpace=s.id;renderOffer();}
     },'slot'+(s.provisional?' pending':''));
     button.title='Soltá una materia del mismo nivel o elegí el espacio.';
     setupSubjectDrop(button,s);
     button.draggable=writable()&&s.duration==='cuatrimestral';
     if(button.draggable){
      button.addEventListener('dragstart',e=>{
       draggedTechnicalSubject=null;draggedTechnicalSpace=s.id;
       e.dataTransfer?.setData('application/x-pci-technical-space',s.id);
      });
      button.addEventListener('dragend',()=>{draggedTechnicalSpace=null});
     }
    }
   }
  }
 }
 function availableForSpace(space){
  const fields=space.kind==='fg'?
   new Set(['formacion_general','formacion_cientifico_tecnologica']):
   new Set(['formacion_tecnica_especifica','formacion_cientifico_tecnologica','practicas_profesionalizantes']);
  const relevant=bank.filter(x=>fields.has(x.field)&&(x.year===null||x.year===space.year));
  // Puede vincularse un contenido de otro campo mediante articulación aprobada;
  // no inferir esa decisión en forma automática.
  return relevant;
 }
 function renderOffer(){
  if(!offer)return;
  renderTable();
  const target=$('offerGrid');target.replaceChildren();target.classList.add('tech-offer-view');
  const tools=el('div',target,undefined,'actions');
  picker(tools,'Año',[['0','Todos'],...[1,2,3,4,5,6].map(y=>[y,y+'º'])],spaceYear,v=>{
   spaceYear=Number(v);activeSpace=null;renderOffer();
  });
  picker(tools,'Formato', [['','Todos'],...['Troncales','Ciencias Sociales','Ciencias Naturales',
   'Taller de la Especialidad','Espacio anual de la especialidad','Integración de la Especialidad',
   'Prácticas Profesionalizantes'].map(x=>[x,x])],
   spaceArea,v=>{spaceArea=v;activeSpace=null;renderOffer()});
  const pvfLegend=el('p',target,
    'Proyecto de Vinculación con el Futuro (Técnica): Recorrido Formativo Integrado — '+
    'Actividades Educativas con Integración en Contextos, Experiencias Formativas Vocacionales y '+
    'una o dos Prácticas Profesionalizantes en 5.º/6.º según la especialidad. '+
    'No se crean dos proyectos anuales independientes.','muted');
  pvfLegend.style.margin='2px 0 12px';
  const year=Number(spaceYear);
  const list=offer.spaces.filter(x=>(!year||x.year===year)&&(!spaceArea||x.area===spaceArea)).sort(
   (a,b)=>a.year-b.year||a.term-b.term||a.area.localeCompare(b.area));
  const subjectYear=year||offer.spaces.find(x=>x.id===activeSpace)?.year||1;
  const subjectBag=el('section',target,undefined,'tech-subject-bank workCard');
  el('h4',subjectBag,'Bolsa de materias · '+subjectYear+'º · '+pci.specialty_name);
  createWarning(subjectBag,'Arrastrá las materias al mapa C1–C12. La identificación de los años procede del PDF priorizado y requiere revisión del plan oficial. Los contenidos se desarrollan en Fase 2.');
  const cards=el('div',subjectBag,undefined,'tech-subject-cards');
  const choices=technicalSubjectCards(bank,{year:subjectYear});
  for(const subject of choices){
   const card=btn(cards,subject.name+' · '+subject.area,()=>{
    selectedTechnicalSubject=selectedTechnicalSubject===subject.key?null:subject.key;
    renderOffer();
   },'constructor-bank-subject'+(selectedTechnicalSubject===subject.key?' active':''));
   card.draggable=writable();
   card.title='Materia del nivel '+subjectYear+' identificada en el catálogo de la especialidad. Arrastrar a un espacio del mapa.';
   if(card.draggable){
    card.addEventListener('dragstart',e=>{
     draggedTechnicalSubject=subject.key;draggedTechnicalSpace=null;
     e.dataTransfer?.setData('text/plain',subject.key);
     if(e.dataTransfer)e.dataTransfer.effectAllowed='move';
    });
    card.addEventListener('dragend',()=>{draggedTechnicalSubject=null});
   }
  }
  if(!choices.length)createWarning(cards,'No hay materias de año identificable. Revisá el documento oficial; no se inventan asignaturas.');

  const layout=el('div',target,undefined,'split');
  const short=el('div',layout,undefined,'areaList');
  short.setAttribute('aria-label','Espacios curriculares del PCI Técnico');
  for(const s of list){
   const b=btn(short,(s.included===false?'[Por definir] ':'')+s.name+' · '+s.year+'º C'+s.term+
     (s.duration==='anual'?'–C'+s.endTerm:'')+' · '+s.subjectIds.length+' materias',
     ()=>{
      if(selectedTechnicalSubject)assignSubject(s,selectedTechnicalSubject);
      else {activeSpace=s.id;renderOffer();}
     },'areaItem'+(s.id===activeSpace?' active':''));
   setupSubjectDrop(b,s);
   b.title='Abrir agrupamiento curricular';
  }
  for(let y=4;y<=6;y++){
   const count=offer.spaces.filter(x=>x.format==='integracion_especialidad'&&x.year===y).length;
   const b=btn(tools,'+ Integración de '+y+'º ('+count+'/6)',()=>{
    try{offer=addTechnicalIntegration(offer,{year:y});changedOffer();}
    catch(err){message(err.message,'error');}
   });
   b.disabled=!writable()||count>=6;
  }
  // Condiciones particulares: habilitar solamente alternativas documentadas
  // como dependientes del diseño curricular, nunca prescribirlas de oficio.
  const specialty=findSpecialty(pci.specialty_name);
  if(!offer.spaces.some(s=>s.id==='t-representacion-3')){
   const button=btn(tools,'+ Representación anual 3.º · según plan',()=>{
    try{offer=addTechnicalRepresentationThird(offer);changedOffer();}
    catch(err){message(err.message,'error');}
   });button.disabled=!writable();button.title='Requiere comprobar que el plan de esta especialidad la incluye en 3.º';
  }
  if(specialty?.status==='not_defined_in_document'){
   for(const year of [4,5,6]){
    if(offer.spaces.some(s=>s.id==='t-anual-'+year))continue;
    const button=btn(tools,'+ Espacio anual de '+year+'º · por definir',()=>{
     try{offer=addTechnicalAnnualPending(offer,year);changedOffer();}
     catch(err){message(err.message,'error');}
    });
    button.disabled=!writable();
    button.title='Solo si el diseño curricular vigente lo determina; el Anexo II del 17/11/2026 no define esta especialidad.';
   }
  }
  for(const year of [5,6]){
   if(offer.spaces.some(s=>s.id==='t-practicas-'+year&&s.included!==false))continue;
   const button=btn(tools,'+ Prácticas Profesionalizantes '+year+'º',()=>{
    try{offer=addTechnicalProfessionalPractice(offer,year);changedOffer();}
    catch(err){message(err.message,'error');}
   });
   button.disabled=!writable();
   button.title='Incluir práctica de este año solo si corresponde al diseño curricular de la especialidad';
  }
  const s=offer.spaces.find(x=>x.id===activeSpace);
  if(!s){createWarning(layout,'Elegí un espacio del mapa o de la lista para distribuir materias, contenidos y planificar.');summarizeMap();return;}
  const panel=el('div',layout,undefined,'workCard');
  el('h4',panel,s.name+' · '+s.year+'º');
  createWarning(panel,'C'+s.term+(s.duration==='anual'?'–C'+s.endTerm:'')+
   ' · '+choiceLabel(s)+' · '+s.format);
  if(/^t-taller-especialidad-[456]$/.test(s.id)){
   const opt=btn(panel,s.included===false?'Incorporar este taller según el plan de la especialidad':
     'Marcar este taller como no ofertado, sin borrar sus datos',()=>{
    if(s.included!==false && !confirm(
      'El taller se ocultará del mapa pero sus datos permanecerán en el borrador. ¿Continuar?'))return;
    try{offer=updateTechnicalSpace(offer,s.id,{included:s.included===false});changedOffer();}
    catch(err){message(err.message,'error');}
   });
   opt.disabled=!writable();
   createWarning(panel,'La cantidad de Talleres de la Especialidad (1 a 4) depende del diseño curricular vigente. '+
     (s.included===false?'Este espacio variable NO está incorporado en la oferta.':'Este espacio se considera parte de la oferta.'));
  }
  if(/^t-practicas-[56]$/.test(s.id)){
   const toggle=btn(panel,s.included===false?
     'Incorporar Práctica Profesionalizante según plan':
     'Desactivar esta práctica sin borrar sus contenidos',()=>{
       if(s.included!==false&&!confirm(
         'Se ocultará la práctica del mapa, pero el borrador conservará sus referencias y planes. ¿Continuar?'))return;
       try{offer=updateTechnicalSpace(offer,s.id,{included:s.included===false});changedOffer();}
       catch(err){message(err.message,'error');}
     });
   toggle.disabled=!writable();
   createWarning(panel,'El diseño curricular determina si la especialidad acredita una o dos '+
     'Prácticas Profesionalizantes en 5.º y/o 6.º. No se asignan automáticamente.');
  }
  if(s.archivedLegacy)
   createWarning(panel,'Espacio histórico preservado por cambio normativo 17/11/2026. '+
    'No se eliminó: revisar su relación con las Prácticas Profesionalizantes antes de modificarlo.');
  const detail=el('div',panel,undefined,'split');
  const basics=el('div',detail);
  const nameInput=field(basics,'Nombre del espacio',s.name,v=>{
    try{offer=updateTechnicalSpace(offer,s.id,{name:v});changedOffer();}
    catch(err){message(err.message,'error');}
  },{multiline:false});
  nameInput.disabled=!writable();
  const char=picker(basics,'Carácter',[['obligatorio','Obligatorio'],['electivo','Electivo']],
   s.character,v=>{try{offer=updateTechnicalSpace(offer,s.id,{character:v});changedOffer();}
     catch(err){message(err.message,'error');}});
  char.disabled=!writable();
  const hours=field(basics,'Horas semanales (según diseño curricular)',s.weeklyHours??'',v=>{
   try{offer=updateTechnicalSpace(offer,s.id,{weeklyHours:v.trim()?Number(v):null});changedOffer();}
   catch(err){message(err.message,'error');}
  },{multiline:false});hours.type='number';hours.min='0.5';hours.max='45';hours.step='0.5';
  hours.disabled=!writable();
  const notes=field(basics,'Observaciones y acuerdos de integración',s.notes,v=>{
   try{offer=updateTechnicalSpace(offer,s.id,{notes:v});changedOffer();}
   catch(err){message(err.message,'error');}
  });notes.disabled=!writable();
  if(s.id.startsWith('t-social-flex-')){
   const terms=[4,5,6].flatMap(year=>technicianTerms(year).map(t=>[t,'C'+t+' · '+year+'º']));
   const mover=picker(basics,'Ubicar Ciudadanía y Trabajo / Ciencia y Tecnología',terms,s.term,v=>{
    try{offer=moveTechnicalTerm(offer,s.id,Number(v));changedOffer();}
    catch(err){message(err.message,'error');}
   });
   mover.disabled=!writable();
  }
  if(s.duration==='cuatrimestral'&&!s.id.startsWith('t-social-flex-')){
   const mover=picker(basics,'Cuatrimestre',technicianTerms(s.year).map(t=>[t,'C'+t]),s.term,v=>{
    try{offer=moveTechnicalTerm(offer,s.id,Number(v));changedOffer();}
    catch(err){message(err.message,'error');}
   });mover.disabled=!writable();
  }
  const subjectsPanel=el('div',detail,undefined,'workCard');
  el('h4',subjectsPanel,'Materias del agrupamiento · Fase 1');
  const chosenSubjects=technicalSubjectCards(bank,{year:s.year})
   .filter(x=>s.subjectIds.includes(x.id));
  for(const subject of chosenSubjects){
   const line=el('div',subjectsPanel,undefined,'ba15Member');
   el('strong',line,subject.name);
   el('small',line,subject.area+' · año a verificar con el diseño curricular');
   const remove=btn(line,'Quitar del mapa',()=>{
    const fresh=copy(offer),space=fresh.spaces.find(x=>x.id===s.id);
    space.subjectIds=space.subjectIds.filter(id=>id!==subject.id);
    space.confirmed=false;offer=fresh;changedOffer();
   });
   remove.disabled=!writable();
  }
  if(!chosenSubjects.length)createWarning(subjectsPanel,'Todavía no hay materias ubicadas. Arrastralas desde la bolsa a esta celda.');
  if(s.contentIds?.length)createWarning(subjectsPanel,
   'Hay '+s.contentIds.length+' referencias de contenidos históricos protegidas; no se eliminan ni editan durante la composición.');
  const planBtn=btn(panel,'2 · Abrir desarrollo del espacio',()=>{
   const gate=phaseGate();
   if(!gate.ready){message('Primero completá el constructor técnico de este PCI. '+gate.detail,'warn');return;}
   tab='fo';activateTab();openPlan(s.id);
  });planBtn.disabled=!pci||(s.included===false&&!s.archivedLegacy)||!phaseGate().ready;
  summarizeMap();buildHeader();
 }
 function renderPlanList(){
  const host=$('foSpaces');host.replaceChildren();
  if(!pci||!offer)return;
  const head=el('div',host,undefined,'actions');
  picker(head,'Año',[['0','Todos'],...[1,2,3,4,5,6].map(y=>[y,y+'º'])],spaceYear,v=>{
   spaceYear=Number(v);renderPlanList();
  });
  for(const s of offer.spaces.filter(x=>!spaceYear||x.year===spaceYear).sort((a,b)=>a.year-b.year||a.term-b.term)){
   const b=btn(host,s.name+' · '+s.year+'º'+(s.duration==='anual'?' anual':' C'+s.term),
    ()=>openPlan(s.id),'areaItem'+(activePlanId===s.id?' active':''));
   b.disabled=!pci||(s.included===false&&!s.archivedLegacy);
  }
 }
 async function openPlan(id){
  if(!phaseGate().ready){message('Primero completá y guardá el mapa técnico. '+phaseGate().detail,'warn');return;}
  if(planDirty&&activePlanId!==id&&!confirm('Este plan tiene cambios sin guardar. ¿Descartar la edición al abrir otro espacio?'))return;
  const s=offer?.spaces.find(x=>x.id===id);if(!s)return;
  const token=++loading;
  try{
   status('Cargando planes del espacio...');
   const remote=await getUnit(pci,'fo','space',id,TECH_PLAN_VERSION);
   if(token!==loading)return;
   if(s.archivedLegacy&&!remote.exists)
     throw Error('Este espacio es histórico, pero no tiene planes guardados en la nueva unidad. '+
       'El origen permanece conservado sin convertirlo.');
   const incoming=remote.exists?guardTechnicalPlan(remote.document,pci,s,offer):
     technicalPlanSeed({pci,space:s,offer});
   planRevision=Number(remote.revision)||0;
   const restored=recallDraft('tecnica-plan',id,planRevision,pci,
     value=>guardTechnicalPlan(value,pci,s,offer));
   plan=copy(restored||incoming);planDirty=!!restored;activePlanId=id;
   renderPlanList();renderPlan();
   status('Planes técnicos listos');
  }catch(error){message('No se pudieron abrir los planes de Técnica: '+error.message,'error');}
 }
 function renderPlan(){
  const host=$('foEditor');host.replaceChildren();
  if(!plan)return createWarning(host,'Elegí un espacio para desarrollar sus cuatro planes.');
  el('h3',host,plan.name);
  createWarning(host,'4 planes bimestrales · '+plan.year+'º · revisión '+planRevision+
   ' · '+(planDirty?'cambios sin guardar':'borrador disponible'));
  const card=el('div',host,undefined,'workCard');
  for(const [label,key] of [['Objetivo general','objective'],['Sinopsis general','synopsis'],
   ['Contexto problematizador','context'],['Práctica / producto / eje','practiceAxis']]){
    const inp=field(card,label,plan[key],v=>{plan[key]=v;changedPlan();});
    inp.disabled=!writable();
  }
  const space=offer.spaces.find(x=>x.id===plan.space_id);
  // Fase 2: materiales y contenidos se eligen aquí, no durante el
  // arrastre del mapa. Se preservan las referencias históricas si existen.
  const contentOptions=bank.filter(x=>space?.contentIds.includes(x.id)||
   space?.subjectIds.includes(x.sectionId)&&x.year===space.year);
  for(const [index,p] of plan.plansBimestrales.entries()){
   const details=el('details',card);if(index===0)details.open=true;
   el('summary',details,p.name||'Plan '+(index+1));
   const title=field(details,'Nombre',p.name,v=>{p.name=v;changedPlan();},{multiline:false});
   title.disabled=!writable();
   const syn=field(details,'Sinopsis',p.synopsis,v=>{p.synopsis=v;changedPlan();});
   const obj=field(details,'Objetivos de aprendizaje',p.objectives,v=>{p.objectives=v;changedPlan();});
   syn.disabled=!writable();obj.disabled=!writable();
   const contentBox=el('div',details,undefined,'workCard');
   el('strong',contentBox,'Referencias documentales en este plan');
   for(const ref of contentOptions){
    const label=el('label',contentBox);
    const check=el('input',label);check.type='checkbox';check.checked=(p.contentIds||[]).includes(ref.id);
    check.disabled=!writable();
    check.addEventListener('change',()=>{
     const ids=new Set(p.contentIds||[]);
     if(check.checked)ids.add(ref.id);else ids.delete(ref.id);
     p.contentIds=[...ids];changedPlan();
    });
    el('span',label,ref.name+' · p. '+ref.page);
   }
   if(!contentOptions.length)createWarning(contentBox,'No hay referencias disponibles para las materias de este espacio. Revisá primero su composición curricular.');
   for(const stage of TECH_STAGES){
    const val=p.stages?.[stage]?.description||'';
    const input=field(details,labels[stage],val,v=>{
     p.stages={...p.stages,[stage]:{...(p.stages?.[stage]||{}),description:v}};
     changedPlan();
    });input.disabled=!writable();
   }
  }
  const actions=el('div',host,undefined,'actions');
  const save=btn(actions,'Guardar los cuatro planes',()=>savePlan(),'btn primary');
  save.disabled=!writable()||offer.spaces.find(s=>s.id===plan?.space_id)?.archivedLegacy;
  btn(actions,'Descargar planes en JSON',()=>download(
   'tecnica-planes-'+pci.school_id+'-'+pci.pci_id+'-'+plan.space_id+'.json',plan));
 }
 async function saveOffer(){
  if(!pci||!writable())return;
  if(offer.needsNormativeReview&&!offer.normativeReviewAcknowledged){
   if(!confirm('El mapa anterior contiene espacios de una versión previa. '+
     'Se conservaron sus datos sin borrarlos. Antes de guardar, verificá las Prácticas Profesionalizantes '+
     '(una o dos según especialidad) y el plan vigente. ¿Confirmás que revisaste esta diferencia normativa?'))return;
   offer={...offer,normativeReviewAcknowledged:true};
   rememberDraft('oferta-tecnica','mapa-oferta-tecnica-v1',offer,offerRevision);
  }
  try{
   const payload=guardTechnicalOffer(offer,pci,source);
   const result=await saveSafe(async()=>await saveUnit('oferta','map','mapa-oferta-tecnica-v1',
      TECH_OFFER_VERSION,payload,offerRevision));
   if(!result)return;
   offerRevision=Number(result.revision);offerDirty=false;
   forgetDraft('oferta-tecnica','mapa-oferta-tecnica-v1');
   buildHeader();renderOffer();onPhaseChange();
   message('Mapa de la Oferta Técnica guardado por PCI con revisión '+offerRevision+
     '. Sigue pendiente la validación del plan de estudios.','');
  }catch(error){message('No se guardó el mapa técnico: '+error.message,'error');}
 }
 async function savePlan(){
  if(!phaseGate().ready){message('El mapa técnico ya no está confirmado. '+phaseGate().detail,'warn');return;}
  if(!pci||!plan||!writable()||offer.spaces.find(s=>s.id===plan.space_id)?.archivedLegacy)return;
  const space=offer.spaces.find(x=>x.id===plan.space_id);
  if(!space)return;
  try{
   const payload=guardTechnicalPlan(plan,pci,space,offer);
   const result=await saveSafe(async()=>await saveUnit('fo','space',space.id,
    TECH_PLAN_VERSION,payload,planRevision));
   if(!result)return;
   planRevision=Number(result.revision);planDirty=false;
   forgetDraft('tecnica-plan',space.id);
   renderPlan();message('Cuatro planes técnicos guardados con revisión '+planRevision+'.');
  }catch(error){message('No se guardaron los planes: '+error.message,'error');}
 }
 function renderTab(next){
  if(next!=='oferta'&&!phaseGate().ready){
   message('Fase 1 pendiente: completá y guardá el constructor técnico. '+phaseGate().detail,'warn');
   next='oferta';
  }
  tab=next;
  if(next==='fg')renderFg();
  else if(next==='oferta')renderOffer();
  else if(next==='fo'){renderPlanList();renderPlan();}
 }
 function activateTab(){
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  for(const kind of ['fg','offer','fo'])$(kind+'Pane').hidden=tab!==(kind==='offer'?'oferta':kind);
  renderTab(tab);
 }
 async function open(next,assignedHistorical=null){
  const token=++loading;
  const specialty=findSpecialty(next?.specialty_name);
  if(!specialty)throw Error('La especialidad técnica no existe en el catálogo oficial.');
  const url='data/tecnica/priorizados/'+encodeURIComponent(specialty.id)+'.json';
  const res=await fetch(url,{cache:'no-store'});
  if(!res.ok)throw Error('No se pudo cargar el documento oficial de '+specialty.name);
  const file=await res.json();
  if(file.especialidad_id!==specialty.id||!file.sha256_pdf||!Array.isArray(file.asignaturas))
    throw Error('La fuente técnica no coincide con la especialidad.');
  const saved=await getUnit(next,'oferta','map','mapa-oferta-tecnica-v1',TECH_OFFER_VERSION);
  if(token!==loading)return;
  const initial=saved.exists?guardTechnicalOffer(saved.document,next,file):
   technicalOfferSeed({pci:next,source:file});
  const revision=Number(saved.revision)||0;
  const restored=recallDraft('oferta-tecnica','mapa-oferta-tecnica-v1',revision,next,
    value=>guardTechnicalOffer(value,next,file));
  const prepared=prepareTechnicalOfferFinal(restored||initial);
  pci=next;historicalForDisplay=assignedHistorical||next.legacy_state;source=file;bank=technicalSubjectBank(file);offer=prepared.document;
  offerRevision=revision;offerDirty=!!restored||prepared.needsReview;plan=null;
  if(prepared.needsReview)
   rememberDraft('oferta-tecnica','mapa-oferta-tecnica-v1',offer,offerRevision);
  planRevision=0;planDirty=false;activePlanId=null;activeSpace=null;
  activeArea='Ciencias Sociales';spaceYear=0;spaceArea='';
  setLabels(true);buildHeader();renderTab('oferta');
  message((prepared.needsReview?
    'Anexo II del 17/11/2026: borrador anterior adaptado SOLO en memoria, sin borrar espacios ni planes. '+
    'Revisá Prácticas Profesionalizantes antes de guardar. ':
    'PCI Técnico abierto con el mismo flujo V2. ')+
    bank.length+' referencias documentales consultables; pendiente de validación curricular.',
    prepared.needsReview?'warn':'');
  return true;
 }
 function close(){
  if(!pci)return;
  ++loading;pci=null;offer=null;source=null;bank=[];plan=null;historicalForDisplay=null;
  offerDirty=false;planDirty=false;setLabels(false);
 }
 function isDirty(){return !!(offerDirty||planDirty);}
 return {
  open,close,renderTab,saveOffer,isDirty,phaseGate,openDevelopmentSpace:openPlan,
  get active(){return !!pci;},
  get offer(){return offer?copy(offer):null;},
  get source(){return source;}
 };
}
