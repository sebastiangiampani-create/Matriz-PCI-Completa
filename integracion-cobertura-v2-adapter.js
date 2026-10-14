/**
 * Adaptador AISLADO para el motor de cobertura original del repositorio
 * pci-sec-aprendeV2. Los dos scripts originales V91/V93 se cargan sin
 * modificar en integracion-cobertura-v2-original.html.
 *
 * PROHIBIDO escribir en localStorage, Supabase, state de Matriz o el mapa.
 * El único ingreso de datos es postMessage del documento padre mismo origen.
 */
import {loadV2Fg,loadV2Fo,selectFoByOrientation}
  from './src/integracion-curricular/catalogos.js';
import {ORIENTATIONS} from './src/integracion-curricular/bridge.js';

let referenceFG=[],referenceFO=[],groups=[],contentById=new Map(),orientation='';
let prepared=null,sequence=0;

const loadReferences=()=>prepared||(prepared=Promise.all([loadV2Fg(),loadV2Fo()])
  .then(([fg,fo])=>{
    if(fg.length!==1126||fo.length!==860)
      throw Error('No coincide el catálogo curricular original.');
    referenceFG=fg;
    referenceFO=fo;
    return true;
  }).catch(e=>{prepared=null;throw e;}));

const v2Group=group=>{
  const year=Number(group?.year)||0;
  const area=String(group?.area||'');
  const type=String(group?.type||'');
  const contents=[...new Set((group?.data?.contents||[]).map(String))];
  const plans=(group?.data?.plansBimestrales||[]).map(p=>({
    number:Number(p.number),name:String(p.name||''),
    contentIds:[...new Set((p.contentIds||[]).map(String))]
  }));
  return {
    id:String(group?.id||''),area,year,type,
    term:group?.term??null,
    members:Array.isArray(group?.members)?group.members:[],
    data:{
      name:String(group?.data?.name||'Espacio curricular'),
      contents,plansBimestrales:plans
    }
  };
};

const phase={
  loadCurriculum:loadReferences,
  getFGCatalog:()=>referenceFG,
  getAreaPool:area=>{
    if(area!=='Formación Orientada'||!orientation)return [];
    const active=ORIENTATIONS.find(o=>o.name===orientation);
    if(!active)return [];
    return selectFoByOrientation(referenceFO,active.id,ORIENTATIONS);
  },
  members:group=>(group.members||[]).map(member=>{
    if(member&&typeof member==='object')
      return {origin:member.origin||'FG',name:String(member.name||'')};
    return {origin:'FG',name:String(member)};
  }),
  findContent:id=>contentById.get(String(id))||
    referenceFG.find(row=>String(row.id)===String(id))||null,
  groups:()=>groups,
  getAccessScope:()=>({role:'admin',allowedAreasByOrientation:{}})
};
window.PCIPhase2V28=phase;

function createGroups(payload){
  const fo=Array.isArray(payload.fo?.groups)?payload.fo.groups.map(v2Group):[];
  const fg=Array.isArray(payload.fg?.groups)?payload.fg.groups.map(v2Group):[];
  // El tablero V2 original opera con una sola orientación a la vez.
  // Los datos originales sólo se consultan: los grupos con IDs repetidos
  // en un borrador antiguo no modifican ningún registro.
  const keys=new Set();
  return [...fg,...fo].filter(group=>{
    const key=group.area+'\u241f'+group.id;
    if(!group.area||!group.id||keys.has(key))return false;
    keys.add(key);
    return true;
  });
}

function readContents(rows){
  contentById=new Map();
  for(const row of Array.isArray(rows)?rows:[]){
    if(row==null||row.id==null)continue;
    contentById.set(String(row.id),{
      id:String(row.id),component:'FG',
      area:String(row.area||''),subject:String(row.subject||''),
      axis:String(row.axis||''),text:String(row.text||''),
      year:row.year==null?null:Number(row.year)
    });
  }
}

function reportParent(type,message){
  window.parent.postMessage({type,detail:String(message||'')},window.location.origin);
}

document.addEventListener('click',event=>{
  if(event.target.closest('[data-v93d-close]'))
    reportParent('pci-native-v2-close','');
},true);
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
    window.PCICoverageDashboardV93?.close?.();
    reportParent('pci-native-v2-close','');
  }
});

window.addEventListener('message',async event=>{
  if(event.source!==window.parent||event.origin!==window.location.origin)
    return;
  const message=event.data;
  if(!message||message.type!=='pci-native-v2-open')return;
  const requested=++sequence;
  const loading=document.getElementById('pci-v2-loading');
  try{
    loading.textContent='Calculando la cobertura curricular con el motor original…';
    document.body.dataset.v2Ready='false';
    const payload=message.payload;
    if(!payload||typeof payload!=='object')throw Error('No se recibió una lectura curricular válida.');
    orientation=String(payload.orientation||'');
    if(!ORIENTATIONS.some(x=>x.name===orientation))
      throw Error('Debe seleccionarse una orientación válida.');
    window.state.school=String(payload.school||'Escuela');
    window.state.active=orientation;
    groups=createGroups(payload);
    readContents(payload.fg?.rows);
    await window.PCICoverageV91?.ready();
    if(requested!==sequence)return;
    const panel=window.PCICoverageDashboardV93;
    if(!panel?.open)throw Error('No se cargó el panel V93 original.');
    await panel.open();
    document.body.dataset.v2Ready='true';
    reportParent('pci-native-v2-ready',groups.length+' agrupamientos');
  }catch(error){
    loading.textContent='No se pudo abrir el panel de cobertura curricular: '+error.message;
    document.body.dataset.v2Ready='false';
    reportParent('pci-native-v2-error',error.message);
  }
});

reportParent('pci-native-v2-loaded','listo');