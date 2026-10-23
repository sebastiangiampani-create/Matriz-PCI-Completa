/**
 * Capa de lectura: reutiliza exactamente el seguimiento FG curricular
 * existente en la rama y la referencia anual V2 v103.
 * No homologa IDs automáticamente si el original no tiene coincidencia.
 * No modifica Matriz, borradores, mapa, ni ningún registro escolar.
 */
import {ORIENTATIONS} from './src/integracion-curricular/bridge.js';
import {loadV2Fg} from './src/integracion-curricular/catalogos.js';
import {curriculumTracking} from './src/integracion-curricular/seguimiento.js';
const $=id=>document.getElementById(id);
const pane=$('pciFgCoverageDashboard');
const node=(tag,cl,txt)=>{
  const el=document.createElement(tag);if(cl)el.className=cl;
  if(txt!==undefined)el.textContent=String(txt);return el;
};
let official=null,loadError='',pending=false;
function figure(row,kind='Anual'){
  const count=Number(row?.used||0);
  const denominator=Number(row?.total||0);
  const valid=row?.status==='verified'&&row?.confirmedPercent!==null;
  const text=count+'/'+denominator+
    (valid?' · '+row.confirmedPercent+'% '+kind:
     ' · pendiente de homologación');
  return text;
}
function metric(container,title,row){
  const line=node('div','pci-fg-cover-row');
  line.appendChild(node('strong','',title));
  line.appendChild(node('span','',figure(row)));
  if(row?.status!=='verified'){
    const detail=node('small','',row?.denominatorType==='area-nivel-provisional'?
      'Se requiere definir las materias del agrupamiento':
      (row?.pending?.length||0)+' contenidos sin homologación verificada');
    line.appendChild(detail);
  }
  container.appendChild(line);
}
function display(){
  if(!pane||!official)return;
  const app=window.PCIApp,orientation=app?.getActiveOrientation?.();
  const area=$('boardTitle')?.textContent?.trim();
  if(!orientation||!area||!app?.getState?.()?.areas?.[area]){
    pane.hidden=true;return;
  }
  const o=ORIENTATIONS.find(x=>x.name===orientation);
  if(!o){pane.hidden=true;return;}
  const state=app.getState();
  const matrixRows=app.getData?.()||[];
  try{
    const pack={orientations:{
      [o.id]:{fg:{areas:state.areas,homologations:{}},fo:{spaces:[]}}
    }};
    const report=curriculumTracking({
      pack,orientationId:o.id,
      matrixRows,v2FgRows:official,v2FoRows:[],orientations:ORIENTATIONS
    }).fg;
    pane.hidden=false;
    $('pciFgCoverageIntro').textContent=
      'Referencia FG anual por nivel: contenidos priorizados oficiales. Los contenidos '+
      'que todavía no estén homologados no se presentan como cobertura confirmada. '+
      'Los porcentajes solo se verifican cuando coinciden los identificadores y las materias.';
    const levels=$('pciFgCoverageLevels'),subjects=$('pciFgCoverageSubjects'),
      groups=$('pciFgCoverageGroups');
    levels.replaceChildren();subjects.replaceChildren();groups.replaceChildren();
    levels.appendChild(node('h3','','Cobertura por nivel y formato'));
    for(const lv of report.areasByLevel.filter(x=>x.area===area))
      metric(levels,lv.year+'.º año · '+lv.groups+' agrupamientos',lv);
    for(const f of report.formatsByLevel.filter(x=>x.area===area))
      metric(levels,f.year+'.º · '+f.format,f);
    subjects.appendChild(node('h3','','Cobertura por materia y nivel'));
    for(const sub of report.subjectsByLevel.filter(x=>x.area===area))
      metric(subjects,sub.year+'.º · '+sub.subject,sub);
    groups.appendChild(node('h3','','Cobertura por espacio y plan'));
    for(const g of report.groupings.filter(x=>x.area===area)){
      const item=node('details','pci-fg-cover-group');
      item.appendChild(node('summary','',g.year+'.º · '+g.name+' · '+
        (g.status==='verified'?figure(g):'pendiente de homologación')));
      const inside=node('div','pci-fg-cover-plan-list');
      metric(inside,'Cobertura oficial del espacio',g);
      for(const p of g.plans){
        const card=node('div','pci-fg-cover-plan');
        card.appendChild(node('strong','',
          'Plan '+p.number+' · '+(p.name||'Sin nombre')));
        metric(card,'Contra el nivel prescripto',p);
        card.appendChild(node('p','',
          'Dentro del agrupamiento: '+p.inGroup+'/'+p.groupContents+
          (p.localPercent===null?' · —':' · '+p.localPercent+'%')));
        if(p.outsideGroup?.length){
          card.appendChild(node('small','',
            'Revisar '+p.outsideGroup.length+' referencias de plan fuera del agrupamiento; no se modificó ningún dato.'));
        }
        inside.appendChild(card);
      }
      item.appendChild(inside);groups.appendChild(item);
    }
  }catch(error){
    pane.hidden=false;
    $('pciFgCoverageIntro').textContent='No se pudo calcular cobertura verificable: '+error.message;
  }
}
async function initialize(){
  if(pending||official)return;
  pending=true;
  try{official=await loadV2Fg();display();}
  catch(e){loadError=e.message;const x=$('pciFgCoverageIntro');if(x)x.textContent=loadError;}
  finally{pending=false;}
}
if(pane){
  initialize();
  // El editor dispara pci-state-change ANTES de actualizar boardTitle
  // y la interfaz de mosaicos detiene la propagación en captura.
  // Recalcular después del render evita dejar el tablero oculto.
  const afterRender=()=>setTimeout(display,0);
  window.addEventListener('pci-state-change',afterRender);
  window.addEventListener('pci-orientation-changed',afterRender);
  window.addEventListener('pci-app-ready',afterRender);
  $('areaGrid')?.addEventListener('click',afterRender,true);
  $('backOverview')?.addEventListener('click',()=>{
    pane.hidden=true;
  });
}
