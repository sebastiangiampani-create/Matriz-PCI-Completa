/**
 * Botón mínimo "Encontrar equivalencias" dentro de FG.
 * Una sola operación cruza toda la COPIA de orientación ya importada.
 * No aprueba propuestas, no toca planes, no guarda en Supabase.
 */
import {loadV2Fg} from './src/integracion-curricular/catalogos.js';
import {analyzeAutomaticFgMatches} from './src/integracion-curricular/auto-homologacion-fg.js';

const $=id=>document.getElementById(id);
const button=$('pciFgAutoRun');
const status=$('pciFgAutoStatus');
const details=$('pciFgAutoResults');
const examples=$('pciFgAutoExamples');
const download=$('pciFgAutoDownload');
let latest=null;

function updateStatus(value,tone='neutral'){
  if(!status)return;
  status.textContent=value;
  status.dataset.tone=tone;
}
function reset(){
  latest=null;
  if(details){details.open=false;details.hidden=true;}
  if(examples)examples.replaceChildren();
  if(download)download.disabled=true;
  if(button){button.disabled=false;button.textContent='Encontrar equivalencias';}
  updateStatus('Cruza los contenidos de la FG ya ubicada, respetando su año de agrupamiento, sin reemplazar trabajos previos.');
}
function node(tag,value){
  const n=document.createElement(tag);
  if(value!==undefined)n.textContent=String(value);
  return n;
}
function addExample(row){
  const box=node('article');
  box.className='pci-fg-auto-example';
  const title=node('strong',row.year+'.º · '+row.area+' · '+(row.source?.subject||'Contenido histórico'));
  box.append(title);
  box.append(node('p',row.source?.text||'Contenido de Matriz sin identificador vigente'));
  const choices=Array.isArray(row.references)?row.references:[];
  if(choices.length){
    const intro=node('small',choices.length>1
      ? 'Posibles desagregaciones V2 (revisión pendiente):'
      : 'Posible correspondencia V2 (revisión pendiente):');
    box.append(intro);
    const ul=node('ul');
    for(const ref of choices){
      if(!ref?.text)continue;
      ul.append(node('li',ref.text));
    }
    if(ul.childElementCount)box.append(ul);
  }else{
    box.append(node('small',row.reason||'Sin equivalencia segura.'));
  }
  examples.append(box);
}
function paint(report){
  latest=report;
  const x=report.summary;
  const pending=x.proposedMultiple+x.proposedSingle;
  const unresolved=x.ambiguous+x.reviewInvalid+x.unmatched;
  updateStatus(
    'Cruce completado sobre '+x.placedOriginals+' contenidos históricos ubicados: '+
    (x.confirmed+x.exact)+' coincidencias confirmadas o exactas; '+
    pending+' posibles equivalencias para revisar ('+x.proposedMultiple+
    ' casos de 1 a varios); '+unresolved+' sin equivalencia clara. '+
    'Ninguna sugerencia modifica planes ni acredita cobertura.'
  );
  examples.replaceChildren();
  const candidates=report.rows.filter(r=>
    ['proposed-multiple','proposed-single','multiple-exact','review-invalid','unmatched'].includes(r.status)
  ).sort((a,b)=>{
    const order={'proposed-multiple':0,'multiple-exact':1,'proposed-single':2,
      'review-invalid':3,'unmatched':4};
    return order[a.status]-order[b.status]||a.year-b.year||a.area.localeCompare(b.area,'es');
  });
  for(const row of candidates.slice(0,12))addExample(row);
  if(candidates.length>12){
    const note=node('p','Mostrando 12 de '+candidates.length+' casos pendientes. Descargá el informe para revisar el resto.');
    note.className='pci-fg-auto-status';
    examples.append(note);
  }
  if(!candidates.length)examples.append(node('p','No quedan correspondencias pendientes en esta copia.'));
  details.hidden=false;
  download.disabled=false;
}
async function run(){
  const api=window.PCIApp;
  const orientation=api?.getActiveOrientation?.();
  if(!orientation||!api?.isOrientationReady?.(orientation)){
    updateStatus('Primero elegí una orientación y aprobá la copia de revisión de la Matriz original. Nada se importará automáticamente.','warning');
    return;
  }
  const app=api.getState?.(),matrixRows=api.getData?.();
  if(!app?.areas||!Array.isArray(matrixRows)){
    updateStatus('Todavía no terminó de cargar el trabajo original de la escuela.','warning');
    return;
  }
  // Se trabaja sobre una copia inmutable y se compara el estado al finalizar.
  const snapshot=JSON.stringify(app.areas);
  button.disabled=true;
  button.textContent='Analizando…';
  updateStatus('Buscando coincidencias exactas y posibles desagregaciones dentro de cada año…');
  try{
    const v2FgRows=await loadV2Fg();
    if(api.getActiveOrientation()!==orientation ||
       JSON.stringify(api.getState()?.areas)!==snapshot){
      reset();
      updateStatus('Cambió la orientación o los agrupamientos. Ejecutá nuevamente el análisis.','warning');
      return;
    }
    const report=analyzeAutomaticFgMatches({
      areas:JSON.parse(snapshot),matrixRows,v2FgRows,orientationId:orientation,
      maxReferences:4
    });
    paint(report);
  }catch(e){
    latest=null;
    details.hidden=true;
    updateStatus('No se pudo completar el cruce: '+(e?.message||String(e)),'warning');
  }finally{
    button.disabled=false;
    button.textContent='Volver a analizar';
  }
}
function exportReport(){
  if(!latest)return;
  const report={
    ...latest,
    stage:'propuestas-locales-no-aprobadas',
    schoolId:null,
    savedToSupabase:false,
    coveragesModified:false
  };
  const content=JSON.stringify(report,null,2);
  const blob=new Blob([content],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='Cruce_FG_Matriz_V2_PENDIENTE_REVISION.json';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
if(button&&status&&details&&examples&&download){
  button.addEventListener('click',()=>void run());
  download.addEventListener('click',exportReport);
  reset();
  window.addEventListener('pci-orientation-changed',reset);
  window.addEventListener('pci-state-change',reset);
}
