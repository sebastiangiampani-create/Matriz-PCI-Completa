/** Render de solo lectura en el iframe: reutiliza los renderizadores originales.
 * No importa el editor completo ni llama a save, migrate, ensurePlans o Supabase.
 */
import { applyCoverageSnapshot } from './integracion-cobertura-v2-adapter.js';

function scaffold(groups) {
  let stage=document.getElementById('pciInlineRenderStage');
  if(!stage){
    stage=document.createElement('div');stage.id='pciInlineRenderStage';stage.hidden=true;
    stage.innerHTML='<div id="v28board"><div class="v28-coverage"></div><div id="v28groups"></div></div>';
    document.body.appendChild(stage);
  }
  const list=stage.querySelector('#v28groups');list.replaceChildren();
  for(const group of groups){
    const card=document.createElement('article');card.dataset.g=group.id;
    const assigned=document.createElement('div');assigned.className='v28-assigned-wrap';
    card.appendChild(assigned);list.appendChild(card);
  }
  return stage;
}

function visiblePlans(group) {
  const plans=group.data.plansBimestrales||[];
  // Los borradores FO de esta rama guardan cuatro posiciones, incluso en
  // espacios cuatrimestrales. Mostrar las dos activas SIN borrar las otras.
  const term=Number(group.term);
  const annual=group.type==='troncal'||group.type==='proyecto'||String(group.term||'').includes('-');
  const indices=group.area==='Formación Orientada'&&!annual&&plans.length>=4&&term?
    (term%2?[0,1]:[2,3]):plans.map((_,i)=>i);
  return indices.filter(i=>plans[i]).map((index,displayIndex)=>({
    index,number:plans[index].number,displayNumber:displayIndex+1,
    name:plans[index].name||'Bimestre '+(displayIndex+1),
    html:window.PCIPlanCoverageV94.planCoverageSummary(group,plans[index],true)
  }));
}

let queue=Promise.resolve();
async function renderSnapshot(payload,area){
  const state=await applyCoverageSnapshot(payload,area);
  if(!window.PCIPlansCoverageV91?.decorate||!window.PCIPlanCoverageV94?.planCoverageSummary)
    throw new Error('No se cargaron los renderizadores originales de cobertura.');
  const stage=scaffold(state.groups);
  await window.PCIPlansCoverageV91.decorate();
  const cards=[...stage.querySelectorAll('#v28groups [data-g]')];
  const result={area,orientation:payload.orientation,
    areaHtml:stage.querySelector('.v100-level-breakdown')?.outerHTML||'',
    trajectory:window.PCICoverageV91.trajectoryCoverage(area,state.groups),
    groups:state.groups.map((group,index)=>({
      id:group.id,area:group.area,year:group.year,term:group.term,
      name:group.data.name,
      html:cards[index]?.querySelector('.v97-group-coverage')?.outerHTML||'',
      plans:visiblePlans(group)
    })),
    styles:[...document.querySelectorAll('style')].filter(el=>
      el.textContent.includes('.v97-group-coverage{')||el.id==='v38styles'
    ).map(el=>el.textContent)
  };
  // Facilita la comprobación de paridad sin exponer ni alterar registros.
  return result;
}
window.PCIInlineV2={
  render(payload,area){
    const run=queue.then(()=>renderSnapshot(payload,area));
    queue=run.catch(()=>{});return run;
  }
};
