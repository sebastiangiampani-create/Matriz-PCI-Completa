/**
 * Abre los archivos V91/V93 originales de pci-sec-aprendeV2 en un iframe
 * aislado. NINGUNA escritura: snapshot de datos → motor V2 → solo lectura.
 * La escuela continúa editando en Matriz y sus borradores independientes.
 */
const $=id=>document.getElementById(id);
const overlay=$('pciNativeV2Coverage');
const frame=$('pciNativeV2CoverageFrame');
let loaded=false,sequence=0,pending=null,previousFocus=null;

function orientationName(){
  return window.PCIApp?.getActiveOrientation?.()||
    $('pciDemoOrientationContext')?.textContent?.trim()||'';
}
const copy=value=>JSON.parse(JSON.stringify(value));
function historicFG(){
  const app=window.PCIApp;
  const source=app?.getState?.();
  const orientation=orientationName();
  if(!source||!app?.isOrientationReady?.(orientation))
    return {groups:[],rows:[]};
  const groups=[];
  for(const [area,entry] of Object.entries(source.areas||{})){
    for(const group of entry?.groups||[]){
      const term=Number(group.startTerm)||0;
      const year=Number(group.level)||(term?Math.ceil(term/2):0);
      if(!year||year<1||year>5)continue;
      const type={trunk:'troncal',laboratory:'laboratorio',workshop:'taller',
        other:String(group.formatType||'').toLowerCase().includes('proyecto')?
          'proyecto':'seminario'}[group.kind]||'asignatura';
      const members=Array.isArray(group.members)?group.members:[];
      groups.push({
        id:group.id,area,year,term:term||null,type,
        members:members.map(v=>typeof v==='object'?{
          origin:'FG',name:String(v.name||'')}:String(v)),
        data:{
          name:group.name,contents:group.items||[],
          plansBimestrales:group.plansBimestrales||[]
        }
      });
    }
  }
  return {groups,rows:app.getData?.()||[]};
}
function payload(){
  const orientation=orientationName();
  const fo=window.PCIFoDesarrollo?.coverageDataFor?.(orientation);
  if(!orientation||!fo)
    throw Error('Seleccioná una orientación antes de consultar cobertura.');
  const app=window.PCIApp;
  return {
    orientation,
    school:String(app?.getState?.()?.schoolName||'Escuela'),
    fg:copy(historicFG()),fo:copy(fo)
  };
}
function sendPending(){
  if(!loaded||!pending||!frame?.contentWindow)return;
  const request=pending;pending=null;
  frame.contentWindow.postMessage({
    type:'pci-native-v2-open',payload:request.data,sequence:request.id
  },location.origin);
}
function close(){
  if(!overlay)return;
  overlay.hidden=true;
  document.body.classList.remove('pci-native-v2-open');
  previousFocus?.focus?.();
  previousFocus=null;
}
function open(){
  if(!overlay||!frame)return;
  let data;
  try{data=payload();}catch(error){
    const notice=$('pciNativeV2Notice');
    if(notice){notice.textContent=error.message;notice.hidden=false;}
    return;
  }
  previousFocus=document.activeElement;
  const note=$('pciNativeV2Notice');
  if(note)note.hidden=true;
  overlay.hidden=false;
  document.body.classList.add('pci-native-v2-open');
  pending={id:++sequence,data};
  if(!frame.getAttribute('src')){
    frame.setAttribute('src','integracion-cobertura-v2-original.html');
  }else{
    sendPending();
  }
}

if(overlay&&frame){
  const load=message=>{
    if(message.source!==frame.contentWindow||message.origin!==location.origin)return;
    const type=message.data?.type;
    if(type==='pci-native-v2-loaded'){
      loaded=true;sendPending();
    }else if(type==='pci-native-v2-close'){
      close();
    }else if(type==='pci-native-v2-error'){
      const notice=$('pciNativeV2Notice');
      if(notice){notice.textContent=message.data.detail;notice.hidden=false;}
    }else if(type==='pci-native-v2-ready'){
      if($('pciNativeV2Notice'))$('pciNativeV2Notice').hidden=true;
    }
  };
  window.addEventListener('message',load);
  $('pciNativeV2CoverageOverview')?.addEventListener('click',open);
  $('pciNativeV2CoverageFG')?.addEventListener('click',open);
  $('pciNativeV2CoverageFO')?.addEventListener('click',open);
  $('pciNativeV2CoverageClose')?.addEventListener('click',close);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!overlay.hidden)close();
  });
  // Cuando la vista deja de estar activa, nunca queda un panel abierto
  // sobre otra orientación. El original sigue disponible en cada acceso.
  window.addEventListener('pci-orientation-changed',close);
  window.PCIV2OriginalCoverage={open,close,payload};
}