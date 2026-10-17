/** Coberturas internas de Matriz. Solo modifica nodos de presentación propios.
 * El cálculo y el HTML provienen de V91/V94 originales en un iframe aislado.
 * No guarda, importa, normaliza ni modifica datos curriculares.
 */
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let timer=null,running=false,dirty=false,lastKey='',lastResult=null,fgPlanGroup='';
const rendered=new WeakMap();
let frameReady=null;
function activeContext(){
  if(!$('pciNativeV2Coverage')?.hidden)return null;
  if($('pci-fo-development')&&!$('pci-fo-development').hidden)
    return {area:'Formación Orientada',fo:true};
  if($('board')?.classList.contains('active'))
    return {area:$('boardTitle')?.textContent.trim(),fo:false};
  return null;
}
function frameApi(){
  if(frameReady)return frameReady;
  frameReady=new Promise((resolve,reject)=>{
    const frame=$('pciNativeV2CoverageFrame');
    if(!frame){reject(new Error('No existe el motor curricular aislado.'));return;}
    if(!frame.getAttribute('src'))frame.src='integracion-cobertura-v2-original.html';
    const started=Date.now();
    function check(){
      try{if(frame.contentWindow?.PCIInlineV2){resolve(frame.contentWindow.PCIInlineV2);return;}}catch(_){}
      if(Date.now()-started>45000){reject(new Error('No se cargó la cobertura curricular.'));return;}
      setTimeout(check,80);
    }
    check();
  }).catch(error=>{frameReady=null;throw error;});
  return frameReady;
}
function own(parent,key,tag='div'){
  let el=parent.querySelector(':scope > [data-pci-inline="'+key+'"]');
  if(!el){el=document.createElement(tag);el.dataset.pciInline=key;el.className='pci-inline-root';parent.appendChild(el);}
  return el;
}
function paint(el,html){
  if(rendered.get(el)===html)return;
  const open=el.querySelector('.v100-level-breakdown')?.open;
  el.innerHTML=html;rendered.set(el,html);
  if(open!==undefined&&el.querySelector('.v100-level-breakdown'))el.querySelector('.v100-level-breakdown').open=open;
}
function styles(result){
  if($('pciInlineOriginalStyles'))return;
  const s=document.createElement('style');s.id='pciInlineOriginalStyles';
  s.textContent=result.styles.join('\n');document.head.appendChild(s);
  const link=document.createElement('link');link.rel='stylesheet';link.href='integracion-cobertura-inline.css';document.head.appendChild(link);
}
function areaCoverage(ctx,result){
  const parent=ctx.fo?$('pci-fo-development'): $('board');
  const target=ctx.fo?parent.querySelector('.pci-fo-dev-content'):parent.querySelector('.workspace');
  if(!target)return;
  const block=own(parent,'area');block.classList.add('pci-inline-area');
  // FO: franja de nivel antes de la bolsa y los agrupamientos, como las fotos.
  // FG: junto a la cobertura histórica, que se oculta solo tras cálculo válido.
  if(block.nextElementSibling!==target)target.before(block);
  const t=result.trajectory;
  const count=Number(t.used)||0,total=Number(t.total)||0,pct=total?Math.round(count/total*100):0;
  const component=ctx.fo?'Formación Orientada':'Formación General';
  paint(block,'<div class="pci-inline-total"><div><strong>'+count+' de '+total+' contenidos de '+component+' cubiertos · '+pct+'%</strong><small>Un mismo contenido puede utilizarse en varios espacios y, para la cobertura, cuenta una sola vez.</small></div><div class="pci-inline-total-bar"><span style="width:'+Math.min(100,pct)+'%"></span></div></div>'+result.areaHtml);
  parent.classList.add('pci-inline-ready');
}
function groupingCoverage(ctx,result){
  const cards=ctx.fo?document.querySelectorAll('#pciFoGroupCards [data-fo-group]'):
    document.querySelectorAll('#groups .group-card[data-group-id]');
  cards.forEach(card=>{
    const id=ctx.fo?card.dataset.foGroup:card.dataset.groupId;
    const g=result.groups.find(x=>x.id===id&&x.area===ctx.area);
    if(!g)return;
    const assigned=card.querySelector(ctx.fo?'.pci-fo-group-assigned':'.assigned-list');
    if(!assigned)return;
    const block=own(card,'group');
    if(assigned.nextElementSibling!==block)assigned.after(block);
    paint(block,g.html);card.classList.add('pci-inline-ready');
  });
}
function fgPlans(result){
  const shell=$('pciPlansShell');
  if(!shell||$('pciPlansBackdrop')?.hidden)return;
  const g=result.groups.find(x=>x.id===fgPlanGroup&&x.area!=='Formación Orientada');
  if(!g)return;
  shell.querySelectorAll('.pci-plan-card').forEach(card=>{
    const number=Number(card.querySelector('[data-open-plan]')?.dataset.openPlan);
    const p=g.plans.find(plan=>plan.number===number);
    if(!p)return;
    const block=own(card,'plan');const button=card.querySelector('[data-open-plan]');
    if(block.nextElementSibling!==button)button.before(block);
    paint(block,p.html);
  });
  const form=$('pciPlanForm');
  if(form){
    const number=Number($('pciPlansTitle')?.textContent.match(/bimestral\s+(\d+)/i)?.[1]);
    const p=g.plans.find(plan=>plan.number===number);
    if(p){
      const block=own(form,'plan-current');
      if(form.firstElementChild!==block)form.prepend(block);
      paint(block,p.html);
    }
  }
}
function foPlans(result){
  const slot=$('pciFoSpace')?.value,g=result.groups.find(x=>x.area==='Formación Orientada'&&x.id===slot);
  const details=$('pciFoDetails');
  if(!g||!details)return;
  const list=own(details,'plans');list.classList.add('pci-inline-plan-grid');
  const fields=$('pciFoFields');if(list.nextElementSibling!==fields)fields.before(list);
  paint(list,g.plans.map(p=>'<article class="v38-card v94-plan-card"><div class="v94-plan-title"><h3>Plan '+p.displayNumber+'</h3><p>'+esc(p.name)+'</p></div>'+p.html+'<button class="button secondary" type="button" data-inline-select-plan="'+p.index+'">Abrir plan</button></article>').join(''));
  const index=Number($('pciFoPlan')?.value)||0,p=g.plans.find(plan=>plan.index===index);
  const target=$('pciFoPlanContents')?.closest('fieldset');
  if(p&&target){
    const block=own(fields,'plan-current');
    if(target.nextElementSibling!==block)target.after(block);
    paint(block,p.html);
  }
}
function apply(ctx,result){
  styles(result);areaCoverage(ctx,result);groupingCoverage(ctx,result);
  if(ctx.fo)foPlans(result);else fgPlans(result);
}
async function refresh(){
  if(running){dirty=true;return;}
  const ctx=activeContext();
  if(!ctx?.area||!window.PCIV2OriginalCoverage)return;
  running=true;
  try{
    const payload=window.PCIV2OriginalCoverage.payload();
    const key=JSON.stringify([ctx.area,payload]);
    if(key!==lastKey){
      const api=await frameApi();
      const result=await api.render(payload,ctx.area);
      // No aplicar una respuesta de otra orientación o área que dejó de estar abierta.
      if(activeContext()?.area!==ctx.area||window.PCIV2OriginalCoverage.payload().orientation!==payload.orientation)return;
      lastKey=key;lastResult=result;
    }
    if(lastResult)apply(ctx,lastResult);
  }catch(error){
    console.error('Cobertura interna:',error);
    const parent=ctx.fo?$('pci-fo-development'):$('board');
    if(parent){
      parent.classList.remove('pci-inline-ready');
      const notice=own(parent,'error');notice.setAttribute('role','status');
      notice.textContent='No se pudo actualizar la cobertura: '+error.message;
    }
  }finally{
    running=false;
    if(dirty){dirty=false;schedule();}
  }
}
function schedule(){clearTimeout(timer);timer=setTimeout(refresh,120);}
function isOwned(node){return node instanceof Element&&!!node.closest('[data-pci-inline]');}
const observer=new MutationObserver(records=>{
  if(records.every(r=>isOwned(r.target)||[...r.addedNodes,...r.removedNodes].every(n=>n instanceof Element&&n.matches('[data-pci-inline]'))))return;
  if(records.some(r=>{
    const el=r.target instanceof Element?r.target:r.target.parentElement;
    return el?.closest('#board,#pci-fo-development,#pciPlansShell,#pciPlansBackdrop')||
      [...r.addedNodes].some(n=>n instanceof Element&&n.id==='pciPlansBackdrop');
  }))schedule();
});
observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class','open']});
document.addEventListener('click',event=>{
  const target=event.target;
  if(!(target instanceof Element))return;
  const entry=target.closest('.pci-plan-entry button,[data-open-bimestral-plans]');
  if(entry)fgPlanGroup=entry.closest('[data-group-id]')?.dataset.groupId||fgPlanGroup;
  const select=target.closest('[data-inline-select-plan]');
  if(select){
    const picker=$('pciFoPlan');picker.value=select.dataset.inlineSelectPlan;
    picker.dispatchEvent(new Event('change',{bubbles:true}));
    $('pciFoPlanName')?.scrollIntoView({block:'center',behavior:'smooth'});
  }
  if(target.closest('#pciNativeV2CoverageClose')||target.closest('#board,#pci-fo-development,#pciPlansShell'))schedule();
},true);
document.addEventListener('input',event=>{if(event.target.closest?.('#board,#pci-fo-development,#pciPlansShell'))schedule();},true);
document.addEventListener('change',event=>{if(event.target.closest?.('#board,#pci-fo-development,#pciPlansShell'))schedule();},true);
for(const name of ['pci-state-change','pci-orientation-changed','pci-app-ready'])window.addEventListener(name,schedule);
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===$('pciNativeV2CoverageFrame')?.contentWindow&&e.data?.type==='pci-native-v2-close')schedule();});
window.PCIInlineCoverage={refresh:schedule,getLastResult:()=>lastResult};
schedule();
