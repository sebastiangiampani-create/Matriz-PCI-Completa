/**
 * Editor opcional de articulaciones en BORRADOR LOCAL. No modifica los
 * archivos curriculares, ni FG/FO, ni V2, ni Supabase, ni los planes.
 */
import {processFG,linkedFGContent,createArticulation,validateArticulation,
 LEGACY_FG,CURRENT_FG,CURRENT_FO} from './src/integracion-curricular/articulacion-versionada.js';
import {loadV2Fo,selectFoByOrientation} from './src/integracion-curricular/catalogos.js';
import {ORIENTATIONS} from './src/integracion-curricular/bridge.js';
const $=id=>document.getElementById(id);
const KEY='pci-articulacion-borradores-versionados/1';
const draftKey='pci-fo-development-drafts-preview-20261014';
const list=v=>Array.isArray(v)?v:[];
const read=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
const choice=(select,rows)=>{select.replaceChildren();for(const row of rows)
  select.appendChild(new Option(row.label,row.value));};
const message=text=>{if($('pciArtStatus'))$('pciArtStatus').textContent=text;};
let catalog=[];
let last=[];
function context(){
 const orientation=window.PCIApp?.getActiveOrientation?.();
 const selected=$('pciFoSpace')?.value;
 if(!orientation||!selected)return null;
 const fg=window.PCIApp?.getState?.();
 const fo=read(draftKey)?.orientations?.[orientation];
 return {orientation,selected,fg,fo};
}
function sourceRows(c){
 return Object.entries(c.fg?.areas||{}).flatMap(([area,scope])=>
   list(scope?.groups).flatMap(group=>list(group.items).map(id=>({
     label:area+' · '+(group.name||group.id)+' · contenido '+id,
     value:JSON.stringify([area,String(group.id),String(id)])
   })));
}
function foRows(c){
 const ids=list(c.fo?.spaces?.[c.selected]?.items);
 return ids.map(id=>({
   label:(catalog.find(row=>String(row.id)===String(id))?.text||id).slice(0,130),
   value:String(id)
 }));
}
function versionKey(c){
 return KEY+':'+encodeURIComponent(c.orientation);
}
function collect(c){return list(read(versionKey(c))?.links);}
function renderLinks(c){
 const target=$('pciArtList');if(!target)return;
 target.replaceChildren();
 for(const link of collect(c).filter(x=>x.fo.slot===c.selected)){
   const item=document.createElement('p');
   item.className='pci-art-link';
   item.textContent=link.fg.baseVersion+' · '+link.fg.area+' · '+link.fg.contentId+
     ' ⇄ FO '+link.fo.contentId+' · '+(link.note||'Articulación');
   target.appendChild(item);
 }
}
function render(){
 const c=context(),host=$('pciArticulationEditor');if(!host)return;
 if(!c){host.hidden=true;return;}
 host.hidden=false;
 const fg=sourceRows(c),fo=foRows(c);
 choice($('pciArtFgContent'),fg.length?fg:[{label:'No hay contenidos FG ubicados',value:''}]);
 choice($('pciArtFoContent'),fo.length?fo:[{label:'Ubicá primero contenidos FO en el espacio',value:''}]);
 renderLinks(c);
 $('pciArtSave').disabled=!fg.length||!fo.length;
}
async function save(){
 const c=context();if(!c)return;
 const version=$('pciArtFgVersion').value;
 if(![LEGACY_FG,CURRENT_FG].includes(version)){
   message('Identificá primero la versión real de FG del proceso. No se asigna automáticamente.');return;
 }
 if(!window.PCIApp?.isOrientationReady?.(c.orientation)){
   message('Primero importá y aprobá la copia del proceso FG.');return;
 }
 try {
   const [area,groupId,contentId]=JSON.parse($('pciArtFgContent').value||'null');
   const foId=$('pciArtFoContent').value;
   if(!foId)throw Error('Elegí un contenido FO ubicado en este espacio.');
   const entry=ORIENTATIONS.find(x=>x.name===c.orientation);
   const pool=selectFoByOrientation(catalog,entry.id,ORIENTATIONS);
   const process=processFG({
     id:'fg:'+encodeURIComponent(c.orientation)+':'+version,
     orientation:c.orientation,baseVersion:version,areas:c.fg.areas
   });
   const fg=linkedFGContent(process,area,groupId,contentId);
   const fo={orientation:c.orientation,slot:c.selected,
     contentId:foId,baseVersion:CURRENT_FO};
   const links=collect(c);
   const identity=JSON.stringify([version,area,groupId,contentId,c.selected,foId]);
   if(links.some(x=>x.fingerprint===identity)){
     message('Este vínculo ya existe; no se duplicó.');return;
   }
   const link=createArticulation({
     id:'art-'+Date.now().toString(36)+'-'+links.length,fg,fo,
     note:$('pciArtNote').value
   },process);
   const checked=validateArticulation(link,{
     process,foSpaces:c.fo.spaces,foCatalog:pool
   });
   if(!checked.valid)throw Error(checked.reason);
   const next={version:1,orientation:c.orientation,links:[
     ...links,{...link,fingerprint:identity}
   ]};
   // Nunca guardar dentro de pciAppV2, ni en la FG versionada,
   // ni en el borrador FO. Archivo lógico local independiente.
   localStorage.setItem(versionKey(c),JSON.stringify(next));
   if(localStorage.getItem(versionKey(c))!==JSON.stringify(next))
     throw Error('No se pudo verificar el borrador local.');
   message('Articulación guardada en borrador local. No cambia coberturas ni planes.');
   renderLinks(c);
 }catch(error){message('No se creó el vínculo: '+error.message);}
}
if($('pciArticulationEditor')){
 loadV2Fo().then(rows=>{catalog=rows;render()}).catch(e=>message('No se cargó la base FO: '+e.message));
 $('pciArtSave')?.addEventListener('click',save);
 $('pciFoSpace')?.addEventListener('change',render);
 $('pciFoYear')?.addEventListener('change',()=>setTimeout(render,0));
 $('pciArticulationEditor')?.addEventListener('toggle',e=>{
   if(e.target.open)render();
 });
 window.addEventListener('pci-orientation-changed',render);
 window.addEventListener('pci-state-change',render);
 window.PCIArticulacionVersionada={render,collect:()=>{const c=context();return c?collect(c):[]}};
}
