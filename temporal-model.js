(()=>{
'use strict';

const SCHEMA_VERSION=3;
const COMPONENT_GENERAL='formacion_general';
const COMPONENT_ORIENTED='formacion_orientada';

function clampTerm(value,fallback=1){
  const n=Number(value);
  return Number.isFinite(n)?Math.min(10,Math.max(1,Math.round(n))):fallback;
}

function isLevelArea(area){
  return CFG?.[area]?.l==='Nivel';
}

function temporalDefaults(area,index,group){
  if(isLevelArea(area)){
    const level=Math.min(5,index+1);
    return {level,termStart:(level*2)-1,termEnd:level*2};
  }
  const existing=clampTerm(group.term,index+1);
  return {level:Math.ceil(existing/2),termStart:existing,termEnd:existing};
}

function normalizeTemporalGroup(area,index,group){
  const defaults=temporalDefaults(area,index,group);
  if(!group.component)group.component=COMPONENT_GENERAL;
  if(group.level==null)group.level=defaults.level;
  if(group.termStart==null)group.termStart=defaults.termStart;
  if(group.termEnd==null)group.termEnd=defaults.termEnd;
  if(group.weeklyHours==null)group.weeklyHours=Number(group.hours||0);
  group.level=Math.min(5,Math.max(1,Number(group.level)||defaults.level));
  group.termStart=clampTerm(group.termStart,defaults.termStart);
  group.termEnd=clampTerm(group.termEnd,defaults.termEnd);
  group.weeklyHours=Math.max(0,Number(group.weeklyHours)||0);
  group.hours=group.weeklyHours;
  if(isLevelArea(area)){
    group.termStart=(group.level*2)-1;
    group.termEnd=group.level*2;
  }else if(group.termEnd<group.termStart){
    group.termEnd=group.termStart;
  }
  group.term=String(group.termStart);
}

function migrateApp(){
  if(!app||typeof app!=='object')return;
  if(!app.areas||typeof app.areas!=='object')app.areas={};
  app.schemaVersion=SCHEMA_VERSION;
  app.curricularScope=app.curricularScope||'formacion_general';
  Object.entries(app.areas).forEach(([area,data])=>{
    if(!Array.isArray(data?.groups))return;
    data.groups.forEach((group,index)=>normalizeTemporalGroup(area,index,group));
  });
  localStorage.setItem('pciAppV2',JSON.stringify(app));
}

function options(max,current,prefix){
  return Array.from({length:max},(_,i)=>i+1).map(n=>`<option value="${n}" ${Number(current)===n?'selected':''}>${prefix}${n}</option>`).join('');
}

function temporalEditor(area,index,group){
  const fixed=isLevelArea(area);
  const componentLabel=group.component===COMPONENT_ORIENTED?'Formación Orientada':'Formación General';
  return `<div class="pci-temporal" data-temporal="${index}">
    <div class="pci-temporal-title">Estructura temporal y carga horaria</div>
    <div class="pci-temporal-grid">
      <label>Componente
        <select data-pci-component="${index}">
          <option value="${COMPONENT_GENERAL}" ${group.component===COMPONENT_GENERAL?'selected':''}>Formación General</option>
          <option value="${COMPONENT_ORIENTED}" ${group.component===COMPONENT_ORIENTED?'selected':''}>Formación Orientada</option>
        </select>
      </label>
      <label>Nivel
        <select data-pci-level="${index}">${options(5,group.level,'Nivel ')}</select>
      </label>
      <label>Cuatrimestre inicial
        <select data-pci-start="${index}" ${fixed?'disabled':''}>${options(10,group.termStart,'C')}</select>
      </label>
      <label>Cuatrimestre final
        <select data-pci-end="${index}" ${fixed?'disabled':''}>${options(10,group.termEnd,'C')}</select>
      </label>
      <label>Horas semanales
        <input data-pci-hours="${index}" type="number" min="0" step="0.5" value="${group.weeklyHours}">
      </label>
    </div>
    <div class="pci-temporal-note">${fixed?`El ${group.name||`Nivel ${group.level}`} es anual y ocupa C${group.termStart} y C${group.termEnd}.`:`${componentLabel} · C${group.termStart}${group.termEnd!==group.termStart?` a C${group.termEnd}`:''}`}</div>
  </div>`;
}

function bindTemporalEditors(){
  const area=app.current;
  const groups=app.areas?.[area]?.groups||[];
  document.querySelectorAll('.group[data-i]').forEach(card=>{
    const index=Number(card.dataset.i);
    const group=groups[index];
    const editor=card.querySelector('.editor');
    if(!group||!editor||editor.querySelector('[data-temporal]'))return;
    editor.insertAdjacentHTML('beforeend',temporalEditor(area,index,group));
  });

  document.querySelectorAll('[data-pci-component]').forEach(el=>el.onchange=()=>updateGroup(el,'component',el.value));
  document.querySelectorAll('[data-pci-level]').forEach(el=>el.onchange=()=>updateGroup(el,'level',Number(el.value)));
  document.querySelectorAll('[data-pci-start]').forEach(el=>el.onchange=()=>updateGroup(el,'termStart',Number(el.value)));
  document.querySelectorAll('[data-pci-end]').forEach(el=>el.onchange=()=>updateGroup(el,'termEnd',Number(el.value)));
  document.querySelectorAll('[data-pci-hours]').forEach(el=>el.onchange=()=>updateGroup(el,'weeklyHours',Number(el.value||0)));
}

function updateGroup(element,field,value){
  const index=Number(element.dataset.pciComponent??element.dataset.pciLevel??element.dataset.pciStart??element.dataset.pciEnd??element.dataset.pciHours);
  const area=app.current;
  const group=app.areas?.[area]?.groups?.[index];
  if(!group)return;
  group[field]=value;
  normalizeTemporalGroup(area,index,group);
  save(0);
  renderGroups();
}

function injectStyles(){
  if(document.getElementById('pci-step1-styles'))return;
  const style=document.createElement('style');
  style.id='pci-step1-styles';
  style.textContent=`
    .pci-temporal{margin-top:14px;padding:12px;border:1px solid var(--line);border-radius:14px;background:#fff}
    .pci-temporal-title{font-weight:900;margin-bottom:9px}
    .pci-temporal-grid{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:8px}
    .pci-temporal-grid label{display:grid;gap:5px;font-size:.76rem;font-weight:850}
    .pci-temporal-grid select,.pci-temporal-grid input{width:100%;border:1px solid var(--line);border-radius:9px;padding:8px;background:#fbfcfc}
    .pci-temporal-note{margin-top:8px;color:var(--muted);font-size:.76rem;font-weight:750}
    .pci-schema-badge{display:inline-flex;margin-left:8px;padding:4px 8px;border-radius:999px;background:var(--okbg);color:var(--ok);font-size:.68rem;font-weight:900}
    @media(max-width:900px){.pci-temporal-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:520px){.pci-temporal-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
  const brand=document.querySelector('.brand');
  if(brand&&!brand.querySelector('.pci-schema-badge'))brand.insertAdjacentHTML('beforeend','<span class="pci-schema-badge">Modelo temporal v1</span>');
}

const originalNormalizeGroups=normalizeGroups;
normalizeGroups=function(area){
  originalNormalizeGroups(area);
  const groups=app.areas?.[area]?.groups||[];
  groups.forEach((group,index)=>normalizeTemporalGroup(area,index,group));
};

const originalRenderGroups=renderGroups;
renderGroups=function(){
  originalRenderGroups();
  bindTemporalEditors();
};

const originalInit=init;
init=function(area){
  originalInit(area);
  normalizeGroups(area);
  save(0);
};

injectStyles();
migrateApp();
})();
