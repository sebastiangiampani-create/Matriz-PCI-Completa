/** Adaptador aislado: recibe snapshots y nunca escribe datos escolares. */
import {loadV2Fg,loadV2Fo,selectFoByOrientation} from './src/integracion-curricular/catalogos.js';
import {ORIENTATIONS} from './src/integracion-curricular/bridge.js';
let referenceFG=[],referenceFO=[],groups=[],contentById=new Map(),orientation='',activeArea='';
let prepared=null,sequence=0;
const loadReferences=()=>prepared||(prepared=Promise.all([loadV2Fg(),loadV2Fo()])
  .then(([fg,fo])=>{
    if(fg.length!==1126||fo.length!==860)throw new Error('No coincide el catálogo curricular original.');
    referenceFG=fg;referenceFO=fo;return true;
  }).catch(error=>{prepared=null;throw error;}));
const v2Group=group=>({
  id:String(group?.id||''),area:String(group?.area||''),year:Number(group?.year)||0,
  type:String(group?.type||''),term:group?.term??null,
  members:Array.isArray(group?.members)?group.members:[],
  data:{name:String(group?.data?.name||'Espacio curricular'),
    contents:[...new Set((group?.data?.contents||[]).map(String))],
    plansBimestrales:(group?.data?.plansBimestrales||[]).map(p=>({
      number:Number(p.number),name:String(p.name||''),
      contentIds:[...new Set((p.contentIds||[]).map(String))]
    }))
  }
});
function termText(g){
  if(g.type==='troncal'||g.type==='proyecto'||g.term===null)
    return 'C'+(g.year*2-1)+'–C'+(g.year*2)+' · anual';
  return String(g.term).includes('-')?
    'C'+String(g.term).split('-').join('–C')+' · anual':'C'+g.term;
}
const phase={
  loadCurriculum:loadReferences,getFGCatalog:()=>referenceFG,
  getAreaPool:area=>{
    if(area!=='Formación Orientada'||!orientation)return [];
    const current=ORIENTATIONS.find(o=>o.name===orientation);
    return current?selectFoByOrientation(referenceFO,current.id,ORIENTATIONS):[];
  },
  members:group=>(group.members||[]).map(member=>
    member&&typeof member==='object'?
      {origin:member.origin||'FG',name:String(member.name||'')}:
      {origin:'FG',name:String(member)}),
  findContent:id=>contentById.get(String(id))||referenceFG.find(row=>String(row.id)===String(id))||null,
  groups:()=>groups,gb:id=>groups.find(g=>g.id===String(id))||null,
  getActiveArea:()=>activeArea,termText,
  getAccessScope:()=>({role:'admin',allowedAreasByOrientation:{}})
};
window.PCIPhase2V28=phase;
function createGroups(payload){
  const fo=Array.isArray(payload.fo?.groups)?payload.fo.groups.map(v2Group):[];
  const fg=Array.isArray(payload.fg?.groups)?payload.fg.groups.map(v2Group):[];
  const seen=new Set();
  return [...fg,...fo].filter(g=>{
    const key=g.area+'\u241f'+g.id;
    if(!g.area||!g.id||seen.has(key))return false;
    seen.add(key);return true;
  });
}
function readContents(rows){
  contentById=new Map();
  for(const row of Array.isArray(rows)?rows:[]){
    if(row?.id==null)continue;
    contentById.set(String(row.id),{id:String(row.id),component:'FG',
      area:String(row.area||''),subject:String(row.subject||''),axis:String(row.axis||''),
      text:String(row.text||''),year:row.year==null?null:Number(row.year)});
  }
}
/** Reemplaza únicamente el contexto efímero del iframe. */
export async function applyCoverageSnapshot(payload,area=''){
  if(!payload||typeof payload!=='object')throw new Error('No se recibió una lectura curricular válida.');
  const name=String(payload.orientation||'');
  if(!ORIENTATIONS.some(x=>x.name===name))throw new Error('Debe seleccionarse una orientación válida.');
  orientation=name;activeArea=String(area);
  window.state.school=String(payload.school||'Escuela');window.state.active=name;
  groups=createGroups(payload);readContents(payload.fg?.rows);
  if(!window.PCICoverageV91?.ready)throw new Error('No se cargó el motor de cobertura original.');
  await window.PCICoverageV91.ready();
  return {groups,orientation,activeArea};
}
function reportParent(type,message){
  window.parent.postMessage({type,detail:String(message||'')},window.location.origin);
}
document.addEventListener('click',event=>{
  if(event.target.closest('[data-v93d-close]'))reportParent('pci-native-v2-close','');
},true);
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
    window.PCICoverageDashboardV93?.close?.();reportParent('pci-native-v2-close','');
  }
});
window.addEventListener('message',async event=>{
  if(event.source!==window.parent||event.origin!==window.location.origin)return;
  const message=event.data;
  if(!message||message.type!=='pci-native-v2-open')return;
  const requested=++sequence,loading=document.getElementById('pci-v2-loading');
  try{
    loading.textContent='Calculando la cobertura curricular con el motor original…';
    document.body.dataset.v2Ready='false';
    await applyCoverageSnapshot(message.payload);
    if(requested!==sequence)return;
    const panel=window.PCICoverageDashboardV93;
    if(!panel?.open)throw new Error('No se cargó el panel original.');
    await panel.open();document.body.dataset.v2Ready='true';
    reportParent('pci-native-v2-ready',groups.length+' agrupamientos');
  }catch(error){
    loading.textContent='No se pudo abrir el panel de cobertura curricular: '+error.message;
    document.body.dataset.v2Ready='false';reportParent('pci-native-v2-error',error.message);
  }
});
reportParent('pci-native-v2-loaded','listo');
