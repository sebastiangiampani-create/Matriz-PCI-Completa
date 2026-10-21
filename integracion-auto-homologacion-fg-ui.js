/**
 * FG histórica -> FG V2: migración y validación automáticas por orientación.
 * La escuela NO necesita aprobar contenidos uno a uno.
 * Las correcciones son opcionales y prevalecen sobre la migración.
 * Guardado en esta rama: metadata LOCAL, sin escrituras en Supabase.
 */
import {loadV2Fg} from './src/integracion-curricular/catalogos.js';
import {
  automaticallyValidateImportedFg,exportValidatedFgV2,AUTO_VALIDATION_VERSION,
  AUTO_VALIDATION_LABEL
} from './src/integracion-curricular/auto-validacion-importacion.js';

const $=id=>document.getElementById(id);
const button=$('pciFgAutoRun'),status=$('pciFgAutoStatus');
const details=$('pciFgAutoResults'),examples=$('pciFgAutoExamples');
const download=$('pciFgAutoDownload');
const prefix='pci-matriz-fg-v2-validacion-automatica-20261021:';
const clone=x=>JSON.parse(JSON.stringify(x));
let latest=null,sourceText='',activeOrientation='',pending=0;
let referencePromise=null,referenceRows=[];
const hash=s=>{
  let h=2166136261;
  for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);
  return (h>>>0).toString(16).padStart(8,'0')+':'+s.length;
};
function currentScope(api,orientation){
  const school=api.getOriginalState?.()?.schoolName||api.getState?.()?.schoolName||'Matriz';
  return prefix+encodeURIComponent(school)+'/'+encodeURIComponent(orientation);
}
function getOverrides(api,orientation){
  try{
    const data=JSON.parse(localStorage.getItem(currentScope(api,orientation))||'{}');
    if(data.version===AUTO_VALIDATION_VERSION&&data.orientation===orientation &&
       data.overrides&&typeof data.overrides==='object'&&!Array.isArray(data.overrides))
      return data.overrides;
  }catch(_){}
  return {};
}
function saveOverrides(api,orientation,overrides){
  const key=currentScope(api,orientation),payload={
    version:AUTO_VALIDATION_VERSION,orientation,overrides
  };
  localStorage.setItem(key,JSON.stringify(payload));
  if(localStorage.getItem(key)!==JSON.stringify(payload))
    throw new Error('No se pudo verificar el guardado local de las correcciones.');
}
function statusMessage(message,tone='neutral'){
  if(!status)return;
  status.textContent=message;
  status.dataset.tone=tone;
}
function el(tag,value,className){
  const n=document.createElement(tag);
  if(value!==undefined)n.textContent=String(value);
  if(className)n.className=className;
  return n;
}
function updateBadges(validated){
  // Solo marca visualmente los agrupamientos. La copia histórica no se toca.
  for(const card of document.querySelectorAll('#groups .group-card[data-group-id]')){
    const old=card.querySelector('[data-pci-auto-legacy-badge]');
    if(old)old.remove();
  }
  if(!validated)return;
  const items=validated.currentFg.areas;
  const source=window.PCIApp?.getState?.();
  const area=source?.current;
  for(const [container,part] of Object.entries(items)){
    if(container!==area)continue;
    for(const g of part.groups||[]){
      const card=[...document.querySelectorAll('#groups .group-card[data-group-id]')]
        .find(x=>x.dataset.groupId===String(g.id));
      if(!card)continue;
      const count=(g.items||[]).length;
      const badge=el('span',count+' V2 · '+AUTO_VALIDATION_LABEL,'pci-fg-auto-badge');
      badge.dataset.pciAutoLegacyBadge='true';
      badge.title='Homologación automática, con cobertura calculada sobre los contenidos oficiales V2.';
      (card.querySelector('.group-meta')||card).append(badge);
    }
  }
}
function showCases(validated,orientation){
  examples.replaceChildren();
  const options=validated.decisions.filter(d=>d.selectedV2Ids.length>0)
    .sort((a,b)=>b.selectedV2Ids.length-a.selectedV2Ids.length||a.year-b.year||
      a.area.localeCompare(b.area,'es'));
  const unmatched=validated.unresolved;
  for(const item of options.slice(0,9)){
    const card=el('article',undefined,'pci-fg-auto-example');
    card.append(el('strong',item.year+'.º · '+item.area+' · '+item.subject));
    const legacy=validated.originalArchive.originalCatalog.find(r=>String(r.id)===item.legacyId);
    card.append(el('p',legacy?.text||item.legacyId));
    card.append(el('small',item.selectedV2Ids.length+
      ' contenidos V2 importados y validados automáticamente · Conviene revisar'));
    const ul=el('ul');
    const refs=new Map();
    for(const area of Object.values(validated.currentFg.areas||{})){
      for(const g of area.groups||[]){
        for(const p of g.items||[])refs.set(p,p);
      }
    }
    const storedOver=getOverrides(window.PCIApp,orientation)[item.key];
    const pre=storedOver?storedOver.referenceIds:item.selectedV2Ids;
    const refCatalog=window.PCIAutoFgMigration?.getReferenceCatalog?.()||[];
    for(const id of new Set([...(item.selectedV2Ids||[]),...(pre||[])])){
      const original=refCatalog.find(r=>String(r.id)===id);
      const li=el('li');
      const label=el('label');
      const check=document.createElement('input');
      check.type='checkbox';check.checked=pre.includes(id);
      check.setAttribute('aria-label','Conservar equivalencia '+(original?.text||id));
      check.addEventListener('change',()=>{
        const api=window.PCIApp;
        const next=getOverrides(api,orientation);
        const current=next[item.key]?.referenceIds||item.selectedV2Ids;
        next[item.key]={referenceIds:check.checked?
          [...new Set([...current,id])]:current.filter(x=>x!==id)};
        try{saveOverrides(api,orientation,next);void scan();}catch(error){
          statusMessage('No se pudo registrar la corrección: '+error.message,'warning');
        }
      });
      label.append(check,el('span',original?.text||id));li.append(label);ul.append(li);
    }
    card.append(ul);examples.append(card);
  }
  if(unmatched.length){
    const note=el('article',undefined,'pci-fg-auto-example');
    note.append(el('strong',unmatched.length+' contenidos antiguos sin equivalencia V2'));
    note.append(el('p','No se pierden: se guardan completos con sus planes y secuencias en el resguardo histórico de la exportación. Podés corregirlos luego.'));
    examples.append(note);
  }
  if(options.length>9)examples.append(el('p','Hay más contenidos homologados. Todos están incluidos en el archivo de exportación, con sus relaciones y trazabilidad.','pci-fg-auto-status'));
  if(!options.length&&!unmatched.length)examples.append(el('p','Todavía no hay contenidos ubicados para homologar.','pci-fg-auto-status'));
}
function apply(validated,orientation,areaFingerprint,v2Rows){
  latest=validated;sourceText=areaFingerprint;activeOrientation=orientation;
  const x=validated.summary;
  const area=window.PCIApp?.getState?.()?.current;
  const yearCover=validated.coverageOnV2.filter(r=>r.area===area);
  const covered=yearCover.reduce((n,r)=>n+r.used,0);
  const total=yearCover.reduce((n,r)=>n+r.total,0);
  statusMessage('Importado y validado automáticamente desde Matriz anterior: '+
    (x.autoValidated+x.existingValidated+x.manuallyCorrected)+
    ' contenidos históricos homologados; '+
    x.curriculumV2Unique+' contenidos V2 distintos cubiertos sobre '+
    x.curriculumV2Prescribed+' prescriptos en FG. '+
    (area&&total?'En '+area+': '+covered+'/'+total+' ('+
      Math.round(covered/total*100)+'%). ':'')+
    'Se conservaron '+x.plansPreserved+' planes y todas las secuencias. '+
    (x.withoutV2Match?'Los '+x.withoutV2Match+' sin correspondencia también quedan respaldados. ':'')+
    AUTO_VALIDATION_LABEL+'.');
  showCases(validated,orientation);
  details.hidden=false;download.disabled=false;
  if(button){button.textContent='Actualizar equivalencias';button.disabled=false;}
  updateBadges(validated);
  window.dispatchEvent(new Event('pci-auto-fg-ready'));
}
function clear(){
  pending++;
  latest=null;sourceText='';activeOrientation='';
  if(details){details.open=false;details.hidden=true;}
  if(examples)examples.replaceChildren();
  if(download)download.disabled=true;
  if(button){button.disabled=false;button.textContent='Actualizar equivalencias';}
  updateBadges(null);
  statusMessage('Al importar una Matriz anterior, sus contenidos se homologan automáticamente con FG V2. Las correcciones posteriores son opcionales.');
}
async function scan(){
  const api=window.PCIApp;
  const orientation=api?.getActiveOrientation?.();
  if(!orientation||!api?.isOrientationReady?.(orientation))return clear();
  const state=api.getState?.(),matrixRows=api.getData?.();
  if(!state?.areas||!Array.isArray(matrixRows))return;
  const source=JSON.stringify(state.areas);
  const ticket=++pending;
  if(button){button.disabled=true;button.textContent='Validando…';}
  statusMessage('Importando y validando automáticamente los contenidos anteriores con los años y materias de FG V2…');
  try{
    const v2Rows=await (referencePromise||(referencePromise=loadV2Fg().catch(e=>{referencePromise=null;throw e;})));
    referenceRows=v2Rows;
    if(ticket!==pending||api.getActiveOrientation()!==orientation||
      JSON.stringify(api.getState()?.areas)!==source)return;
    const validated=automaticallyValidateImportedFg({
      legacyState:clone(state),preImportSnapshot:api.getOriginalState?.()||state,
      orientationId:orientation,matrixRows,v2FgRows:v2Rows,
      manualOverrides:getOverrides(api,orientation)
    });
    if(ticket!==pending||JSON.stringify(api.getState()?.areas)!==source)return;
    apply(validated,orientation,source,v2Rows);
  }catch(e){
    latest=null;sourceText='';
    if(details)details.hidden=true;
    if(button){button.disabled=false;button.textContent='Reintentar';}
    statusMessage('No se pudo validar automáticamente la FG importada: '+(e?.message||String(e)),'warning');
  }
}
function exportAll(){
  if(!latest||!window.PCIApp?.getActiveOrientation?.()||
     activeOrientation!==window.PCIApp.getActiveOrientation()||
     JSON.stringify(window.PCIApp?.getState?.()?.areas)!==sourceText){
    statusMessage('La copia cambió: volvé a actualizar las equivalencias antes de exportar.','warning');
    return;
  }
  const data=exportValidatedFgV2(latest);
  data.exportOrigin='Rama aislada PR 28; no se publicó ni actualizó Supabase';
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
  const link=document.createElement('a');
  const url=URL.createObjectURL(blob);
  link.href=url;
  link.download='PCI_FG_V2_VALIDADO_CON_RESGUARDO_ANTERIOR.json';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2500);
}
window.PCIAutoFgMigration={
  getCurrent:()=>{
    const api=window.PCIApp;
    const o=api?.getActiveOrientation?.();
    return latest&&o===activeOrientation&&
      JSON.stringify(api.getState()?.areas)===sourceText?clone(latest):null;
  },
  getReferenceCatalog:()=>referenceRows,
  scan
};
if(button&&status&&details&&examples&&download){
  button.addEventListener('click',()=>void scan());
  download.addEventListener('click',exportAll);
  clear();
  window.addEventListener('pci-orientation-changed',()=>{void scan();});
  window.addEventListener('pci-app-ready',()=>{void scan();});
  window.addEventListener('pci-state-change',()=>{void scan();});
}
