(()=>{
'use strict';

const SCHEMA_VERSION=5;
const COMPONENT_GENERAL='formacion_general';
const COMPONENT_ORIENTED='formacion_orientada';

function clampTerm(value,fallback=1){
  const n=Number(value);
  return Number.isFinite(n)?Math.min(10,Math.max(1,Math.round(n))):fallback;
}
function numericHours(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,n):0}
function isLevelArea(area){return CFG?.[area]?.l==='Nivel'}
function studyPlan(){if(Array.isArray(window.PCI_STUDY_PLAN))return window.PCI_STUDY_PLAN;try{return JSON.parse(localStorage.getItem('pciStudyPlanV1')||'[]')}catch{return []}}

function temporalDefaults(area,index,group){
  if(isLevelArea(area)){const level=Math.min(5,index+1);return {level,termStart:(level*2)-1,termEnd:level*2}}
  const existing=clampTerm(group.term,index+1);return {level:Math.ceil(existing/2),termStart:existing,termEnd:existing};
}
function activeTerms(group){const start=clampTerm(group.termStart,1),end=Math.max(start,clampTerm(group.termEnd,start));return Array.from({length:(end-start)+1},(_,i)=>start+i)}
function normalizeHoursByTerm(group){
  if(!group.hoursByTerm||typeof group.hoursByTerm!=='object'||Array.isArray(group.hoursByTerm))group.hoursByTerm={};
  if(group.hoursMode!=='per_term')group.hoursMode='uniform';
  const base=numericHours(group.weeklyHours??group.hours??0),terms=activeTerms(group);
  if(group.hoursMode==='uniform')terms.forEach(term=>{group.hoursByTerm[term]=base});
  else terms.forEach(term=>{if(group.hoursByTerm[term]==null)group.hoursByTerm[term]=base;group.hoursByTerm[term]=numericHours(group.hoursByTerm[term])});
  group.weeklyHours=base;group.hours=base;
}
function normalizeTemporalGroup(area,index,group){
  const defaults=temporalDefaults(area,index,group);
  if(!group.component)group.component=COMPONENT_GENERAL;if(group.level==null)group.level=defaults.level;if(group.termStart==null)group.termStart=defaults.termStart;if(group.termEnd==null)group.termEnd=defaults.termEnd;if(group.weeklyHours==null)group.weeklyHours=Number(group.hours||0);if(!Array.isArray(group.subjects))group.subjects=[];
  group.level=Math.min(5,Math.max(1,Number(group.level)||defaults.level));group.termStart=clampTerm(group.termStart,defaults.termStart);group.termEnd=clampTerm(group.termEnd,defaults.termEnd);group.weeklyHours=numericHours(group.weeklyHours);
  if(isLevelArea(area)){group.termStart=(group.level*2)-1;group.termEnd=group.level*2}else if(group.termEnd<group.termStart)group.termEnd=group.termStart;
  group.term=String(group.termStart);normalizeHoursByTerm(group);
}
function migrateApp(){
  if(!app||typeof app!=='object')return;if(!app.areas||typeof app.areas!=='object')app.areas={};app.schemaVersion=SCHEMA_VERSION;app.curricularScope=app.curricularScope||'formacion_general';
  Object.entries(app.areas).forEach(([area,data])=>{if(Array.isArray(data?.groups))data.groups.forEach((group,index)=>normalizeTemporalGroup(area,index,group))});
  localStorage.setItem('pciAppV2',JSON.stringify(app));
}
function options(max,current,prefix){return Array.from({length:max},(_,i)=>i+1).map(n=>`<option value="${n}" ${Number(current)===n?'selected':''}>${prefix}${n}</option>`).join('')}
function termHoursEditor(index,group){return activeTerms(group).map(term=>`<label>C${term} · HC semanales<input data-pci-term-hours="${index}" data-pci-term="${term}" type="number" min="0" step="0.5" value="${numericHours(group.hoursByTerm?.[term]??group.weeklyHours)}"></label>`).join('')}
function subjectsFor(area,level){
  const rows=studyPlan().filter(row=>String(row.area)===String(area)&&Number(row.year)===Number(level));
  const seen=new Set();return rows.filter(row=>{const key=String(row.id||row.subject);if(seen.has(key))return false;seen.add(key);return true});
}
function subjectSelector(area,index,group){
  const rows=subjectsFor(area,group.level);
  if(!rows.length)return `<div class="pci-subject-empty">No hay materias del Plan de Estudios para ${area} · Nivel ${group.level}.</div>`;
  return `<div class="pci-subject-list">${rows.map(row=>{const key=String(row.id||row.subject),checked=group.subjects.includes(key)||group.subjects.includes(String(row.subject));return `<label class="pci-subject-option"><input type="checkbox" data-pci-subject="${index}" value="${key}" ${checked?'checked':''}><span>${row.subject}</span><b>${numericHours(row.hours)} HC</b></label>`}).join('')}</div>`;
}
function normativeSum(area,group){
  const rows=subjectsFor(area,group.level),selected=new Set(group.subjects.map(String));
  const relevant=selected.size?rows.filter(row=>selected.has(String(row.id||row.subject))||selected.has(String(row.subject))):rows;
  return relevant.reduce((sum,row)=>sum+numericHours(row.hours),0);
}
function temporalEditor(area,index,group){
  const fixed=isLevelArea(area),componentLabel=group.component===COMPONENT_ORIENTED?'Formación Orientada':'Formación General',target=normativeSum(area,group);
  return `<div class="pci-temporal" data-temporal="${index}"><div class="pci-temporal-title">Estructura temporal y carga horaria</div><div class="pci-temporal-grid"><label>Componente<select data-pci-component="${index}"><option value="${COMPONENT_GENERAL}" ${group.component===COMPONENT_GENERAL?'selected':''}>Formación General</option><option value="${COMPONENT_ORIENTED}" ${group.component===COMPONENT_ORIENTED?'selected':''}>Formación Orientada</option></select></label><label>Nivel<select data-pci-level="${index}">${options(5,group.level,'Nivel ')}</select></label><label>Cuatrimestre inicial<select data-pci-start="${index}" ${fixed?'disabled':''}>${options(10,group.termStart,'C')}</select></label><label>Cuatrimestre final<select data-pci-end="${index}" ${fixed?'disabled':''}>${options(10,group.termEnd,'C')}</select></label><label>HC predeterminadas<input data-pci-hours="${index}" type="number" min="0" step="0.5" value="${group.weeklyHours}"></label></div><div class="pci-term-hours-title">Materias NES que integran el agrupamiento</div>${subjectSelector(area,index,group)}<div class="pci-normative-total">Carga normativa calculada: <strong>${target} HC</strong> para Nivel ${group.level}</div><div class="pci-term-hours-title">Carga efectiva por cuatrimestre</div><div class="pci-term-hours-grid">${termHoursEditor(index,group)}</div><div class="pci-temporal-note">${fixed?`El ${group.name||`Nivel ${group.level}`} es anual y ocupa C${group.termStart} y C${group.termEnd}.`:`${componentLabel} · C${group.termStart}${group.termEnd!==group.termStart?` a C${group.termEnd}`:''}`} · ${group.hoursMode==='per_term'?'Carga diferenciada por cuatrimestre.':'Carga uniforme en todos los cuatrimestres activos.'}</div></div>`;
}
function bindTemporalEditors(){
  const area=app.current,groups=app.areas?.[area]?.groups||[];
  document.querySelectorAll('.group[data-i]').forEach(card=>{const index=Number(card.dataset.i),group=groups[index],editor=card.querySelector('.editor');if(!group||!editor||editor.querySelector('[data-temporal]'))return;editor.insertAdjacentHTML('beforeend',temporalEditor(area,index,group))});
  document.querySelectorAll('[data-pci-component]').forEach(el=>el.onchange=()=>updateGroup(el,'component',el.value));document.querySelectorAll('[data-pci-level]').forEach(el=>el.onchange=()=>updateGroup(el,'level',Number(el.value)));document.querySelectorAll('[data-pci-start]').forEach(el=>el.onchange=()=>updateGroup(el,'termStart',Number(el.value)));document.querySelectorAll('[data-pci-end]').forEach(el=>el.onchange=()=>updateGroup(el,'termEnd',Number(el.value)));document.querySelectorAll('[data-pci-hours]').forEach(el=>el.onchange=()=>updateUniformHours(el,Number(el.value||0)));document.querySelectorAll('[data-pci-term-hours]').forEach(el=>el.onchange=()=>updateTermHours(el,Number(el.value||0)));document.querySelectorAll('[data-pci-subject]').forEach(el=>el.onchange=()=>updateSubjects(el));
}
function groupFromElement(element){const raw=element.dataset.pciComponent??element.dataset.pciLevel??element.dataset.pciStart??element.dataset.pciEnd??element.dataset.pciHours??element.dataset.pciTermHours??element.dataset.pciSubject,index=Number(raw),area=app.current;return {area,index,group:app.areas?.[area]?.groups?.[index]}}
function updateGroup(element,field,value){const {area,index,group}=groupFromElement(element);if(!group)return;group[field]=value;normalizeTemporalGroup(area,index,group);save(0);renderGroups()}
function updateUniformHours(element,value){const {area,index,group}=groupFromElement(element);if(!group)return;group.hoursMode='uniform';group.weeklyHours=numericHours(value);normalizeTemporalGroup(area,index,group);save(0);renderGroups()}
function updateTermHours(element,value){const {area,index,group}=groupFromElement(element);if(!group)return;const term=clampTerm(element.dataset.pciTerm,group.termStart);group.hoursMode='per_term';if(!group.hoursByTerm||typeof group.hoursByTerm!=='object')group.hoursByTerm={};group.hoursByTerm[term]=numericHours(value);normalizeTemporalGroup(area,index,group);save(0);renderGroups()}
function updateSubjects(element){
  const {area,index,group}=groupFromElement(element);if(!group)return;
  group.subjects=[...document.querySelectorAll(`[data-pci-subject="${index}"]:checked`)].map(el=>String(el.value));normalizeTemporalGroup(area,index,group);save(0);renderGroups();
}
function injectStyles(){
  if(document.getElementById('pci-step1-styles'))return;const style=document.createElement('style');style.id='pci-step1-styles';style.textContent=`.pci-temporal{margin-top:14px;padding:12px;border:1px solid var(--line);border-radius:14px;background:#fff}.pci-temporal-title{font-weight:900;margin-bottom:9px}.pci-temporal-grid{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:8px}.pci-temporal-grid label,.pci-term-hours-grid label{display:grid;gap:5px;font-size:.76rem;font-weight:850}.pci-temporal-grid select,.pci-temporal-grid input,.pci-term-hours-grid input{width:100%;border:1px solid var(--line);border-radius:9px;padding:8px;background:#fbfcfc}.pci-term-hours-title{font-weight:900;font-size:.82rem;margin:12px 0 7px}.pci-term-hours-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}.pci-subject-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:7px}.pci-subject-option{display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:center;padding:8px;border:1px solid var(--line);border-radius:10px;background:#fbfcfc;font-size:.78rem}.pci-subject-option input{width:auto}.pci-subject-option b{font-size:.72rem}.pci-subject-empty{padding:9px;border-radius:10px;background:var(--warnbg);color:var(--warn);font-size:.78rem}.pci-normative-total{margin-top:8px;padding:9px;border-radius:10px;background:var(--okbg);color:var(--ok);font-size:.8rem}.pci-temporal-note{margin-top:8px;color:var(--muted);font-size:.76rem;font-weight:750}.pci-schema-badge{display:inline-flex;margin-left:8px;padding:4px 8px;border-radius:999px;background:var(--okbg);color:var(--ok);font-size:.68rem;font-weight:900}@media(max-width:900px){.pci-temporal-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.pci-temporal-grid{grid-template-columns:1fr}}`;document.head.appendChild(style);const brand=document.querySelector('.brand');if(brand&&!brand.querySelector('.pci-schema-badge'))brand.insertAdjacentHTML('beforeend','<span class="pci-schema-badge">Modelo temporal v3</span>')
}
const originalNormalizeGroups=normalizeGroups;normalizeGroups=function(area){originalNormalizeGroups(area);const groups=app.areas?.[area]?.groups||[];groups.forEach((group,index)=>normalizeTemporalGroup(area,index,group))};
const originalRenderGroups=renderGroups;renderGroups=function(){originalRenderGroups();bindTemporalEditors()};
const originalInit=init;init=function(area){originalInit(area);normalizeGroups(area);save(0)};
injectStyles();migrateApp();
})();