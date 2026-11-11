/**
 * Homologación FG 1→N, DEMOSTRACIÓN simplificada.
 * Lee solo catálogos estáticos Matriz y V2. Sin fetch de cuentas,
 * Supabase, almacenamiento local, migraciones ni escrituras remotas.
 */
import {loadMatrixContents,loadV2Fg} from './catalogos.js';
import {suggestHomologations,approveHomologation,mappingKey} from './homologaciones.js';

const $=id=>document.getElementById(id);
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const subjectAliases={
 'lengua adicional':'lenguas adicionales',
 'formacion etica ciudadana':'formacion etica y ciudadana',
 'tecnologia de la informacion':'tecnologias de la informacion',
 'educacion artistica artes visuales':'artes visuales'
};
const subjectKey=x=>subjectAliases[norm(x)]||norm(x);
const state={
  matrix:[],v2:[],area:'',year:3,sourceId:null,
  selected:new Set(),extraOpen:false,sourceOpen:false,
  packs:new Map(),sourceLimit:7,extraLimit:9
};
const text=(parent,tag,value,className)=>{
  const el=document.createElement(tag);
  if(value !== undefined)el.textContent=value;
  if(className)el.className=className;
  parent.append(el);
  return el;
};
const current=()=>state.matrix.find(r=>r.id===state.sourceId && r.area===state.area) || null;
const context=()=>JSON.stringify([state.area,state.year]);
function getPack(){
  const key=context();
  if(!state.packs.has(key)){
    const items=state.matrix.filter(x=>x.area===state.area).map(x=>x.id);
    state.packs.set(key,{orientations:{demo:{fg:{
      areas:{[state.area]:{groups:[{
        id:'grupo-de-muestra',level:state.year,name:'Agrupamiento de demostración',
        items,plansBimestrales:[]
      }]}},
      homologations:{},homologationHistory:[]
    }}}});
  }
  return state.packs.get(key);
}
function recordFor(id=state.sourceId){
  if(!id)return null;
  return getPack().orientations.demo.fg.homologations[mappingKey(state.area,state.year,id)]||null;
}
function restoreSaved(){
  const record=recordFor();
  state.selected=new Set(record?.referenceIds || (record?.referenceId?[record.referenceId]:[]));
  $('reason').value=record?.reason||'';
  $('reviewPanel').hidden=true;
  $('reviewMessage').textContent='';
}
function originals(){
  const q=norm($('matrixSearch').value);
  return state.matrix.filter(r=>r.area===state.area &&
    (!q||norm([r.subject,r.axis,r.text].join(' ')).includes(q)));
}
function poolFor(row){
  return state.v2.filter(r=>r.year===state.year &&
    norm(r.area)===norm(state.area) &&
    subjectKey(r.subject)===subjectKey(row.subject));
}
function scoredFor(row){
  const result=suggestHomologations({
    matrixRows:state.matrix,v2FgRows:state.v2,
    area:state.area,year:state.year,matrixId:row.id,limit:18
  });
  return result.candidates.filter(c=>c.exact||c.similarity>=0.15);
}
function chooseExample(){
  const rows=state.matrix.filter(r=>r.area===state.area);
  const fallback=rows.find(r=>poolFor(r).length>0)||rows[0];
  let atLeastTwo=null;
  // La muestra abre un caso 1→varios cuando el catálogo lo permite.
  for(const row of rows){
    const s=scoredFor(row);
    if(s.length>=3)return row.id;
    if(s.length>=2 && atLeastTwo===null)atLeastTwo=row.id;
  }
  return atLeastTwo||fallback?.id||null;
}
function selectOriginal(id){
  if(state.sourceId===id)return;
  state.sourceId=id;
  state.selected=new Set();
  state.sourceOpen=false;
  state.extraOpen=false;
  state.extraLimit=9;
  $('v2Search').value='';
  restoreSaved();
  render();
}
function renderOriginal(){
  const row=current();
  $('originalSubject').textContent=row
    ? 'Matriz original · '+row.subject+(row.axis?' · '+row.axis:'')
    : 'No hay contenido histórico disponible';
  $('originalText').textContent=row?.text||'Buscá otro contenido de la Matriz.';
  $('changePanel').hidden=!state.sourceOpen;
  $('changeContent').setAttribute('aria-expanded',String(state.sourceOpen));
  if(!state.sourceOpen)return;
  const results=originals(),list=$('matrixList');
  list.replaceChildren();
  for(const item of results.slice(0,state.sourceLimit)){
    const btn=text(list,'button',undefined,'source-option');
    btn.type='button';
    btn.setAttribute('aria-pressed',String(item.id===state.sourceId));
    text(btn,'span',item.subject+(item.axis?' · '+item.axis:''));
    text(btn,'p',item.text);
    btn.addEventListener('click',()=>selectOriginal(item.id));
  }
  if(!results.length)text(list,'p','Sin coincidencias. Probá otra búsqueda.','meta');
  $('moreMatrix').hidden=results.length<=state.sourceLimit;
}
function newCandidate(row){
  const label=document.createElement('label');
  label.className='candidate';
  const check=document.createElement('input');
  check.type='checkbox';
  check.value=row.id;
  check.checked=state.selected.has(row.id);
  check.setAttribute('aria-label','Seleccionar contenido V2: '+row.text);
  check.addEventListener('change',()=>{
    if(check.checked)state.selected.add(row.id);
    else state.selected.delete(row.id);
    updateChosen();
  });
  const copy=document.createElement('span');
  copy.className='candidate-copy';
  text(copy,'span',[row.axis,row.subaxis,state.year+'.º año'].filter(Boolean).join(' · '),'candidate-axis');
  text(copy,'span',row.text,'candidate-text');
  label.append(check,copy);
  return label;
}
function renderCandidates(){
  const row=current(),out=$('candidateList'),extra=$('extraList');
  out.replaceChildren();extra.replaceChildren();
  if(!row){
    $('candidateNotice').textContent='Elegí un contenido original.';
    $('moreCandidates').hidden=true;
    updateChosen();
    return;
  }
  const candidates=scoredFor(row).slice(0,4);
  const ids=new Set(candidates.map(r=>r.id));
  for(const suggestion of candidates)out.append(newCandidate(suggestion));
  if(!candidates.length){
    text(out,'p','No encontramos coincidencias textuales claras. Podés buscar otras referencias del mismo año y materia.','meta');
  }
  $('candidateNotice').textContent='Son propuestas para revisar, no equivalencias aprobadas.';
  const others=poolFor(row).filter(r=>!ids.has(r.id));
  $('moreCandidates').hidden=!others.length;
  $('extraPanel').hidden=!state.extraOpen;
  $('moreCandidates').setAttribute('aria-expanded',String(state.extraOpen));
  $('moreCandidates').textContent=state.extraOpen?'Ocultar otras equivalencias':'Buscar otras equivalencias';
  if(state.extraOpen){
    const q=norm($('v2Search').value);
    const found=others.filter(r=>!q||norm([r.axis,r.subaxis,r.text].join(' ')).includes(q));
    for(const candidate of found.slice(0,state.extraLimit))extra.append(newCandidate(candidate));
    if(!found.length)text(extra,'p','No hay referencias con esa búsqueda.','meta');
    $('moreV2').hidden=found.length<=state.extraLimit;
  }
  updateChosen();
}
function updateChosen(){
  const count=state.selected.size;
  $('selectedCount').textContent=count+' seleccionado'+(count===1?'':'s');
  const source=current();
  const validIds=new Set(source?poolFor(source).map(r=>r.id):[]);
  $('startReview').disabled=!count||!source||[...state.selected].some(id=>!validIds.has(id));
}
function renderHistory(){
  const records=Object.values(getPack().orientations.demo.fg.homologations);
  $('historyDetails').hidden=!records.length;
  $('historySummary').textContent='Correspondencias revisadas en esta muestra ('+records.length+')';
  const out=$('historyList');out.replaceChildren();
  for(const record of records){
    const row=state.matrix.find(x=>x.id===record.matrixId);
    const item=document.createElement('div');item.className='history-entry';
    text(item,'strong',(row?.subject||record.area)+' · '+record.year+'.º');
    text(item,'div',(row?.text||'Contenido original')+' → '+(record.referenceIds||[]).length+' contenidos V2');
    out.append(item);
  }
}
function render(){
  if(!state.sourceId||!current()){
    state.sourceId=chooseExample();
    restoreSaved();
  }
  renderOriginal();
  renderCandidates();
  renderHistory();
}
function changedContext(){
  state.area=$('areaSelect').value;
  state.year=Number($('yearSelect').value);
  state.sourceId=null;
  state.sourceOpen=false;
  state.extraOpen=false;
  state.sourceLimit=7;
  state.extraLimit=9;
  $('matrixSearch').value='';
  $('v2Search').value='';
  $('reason').value='';
  $('reviewPanel').hidden=true;
  $('reviewMessage').textContent='';
  render();
}
function confirm(){
  const src=current();
  if(!src)return;
  const reason=$('reason').value.trim();
  if(reason.length<10){
    $('reviewMessage').dataset.error='true';
    $('reviewMessage').textContent='Agregá una justificación pedagógica breve.';
    return;
  }
  try{
    const selected=[...state.selected];
    const updated=approveHomologation(getPack(),{
      orientationId:'demo',area:state.area,year:state.year,matrixId:src.id,
      referenceIds:selected,reason,reviewer:'Revisor de muestra',
      matrixRows:state.matrix,v2FgRows:state.v2
    });
    state.packs.set(context(),updated);
    $('reviewPanel').hidden=true;
    $('reviewMessage').dataset.error='false';
    $('reviewMessage').textContent='En esta muestra se vincularon '+selected.length+
      ' contenidos V2 con 1 contenido de Matriz. No se guardaron datos escolares ni se acreditó cobertura.';
    renderHistory();
  }catch(e){
    $('reviewMessage').dataset.error='true';
    $('reviewMessage').textContent='No se pudo completar la revisión: '+(e?.message||String(e));
  }
}
async function boot(){
  try{
    const [matrix,fg]=await Promise.all([loadMatrixContents(),loadV2Fg()]);
    state.matrix=matrix;state.v2=fg;
    const names=[...new Set(matrix.map(x=>x.area))].sort((a,b)=>a.localeCompare(b,'es'));
    const control=$('areaSelect');
    for(const name of names){const op=document.createElement('option');op.value=name;op.textContent=name;control.append(op);}
    state.area=names.includes('Ciencias Sociales')?'Ciencias Sociales':names[0];
    control.value=state.area;
    $('areaSelect').addEventListener('change',changedContext);
    $('yearSelect').addEventListener('change',changedContext);
    $('changeContent').addEventListener('click',()=>{
      state.sourceOpen=!state.sourceOpen;
      state.sourceLimit=7;
      renderOriginal();
      if(state.sourceOpen)$('matrixSearch').focus();
    });
    $('matrixSearch').addEventListener('input',()=>{state.sourceLimit=7;renderOriginal();});
    $('moreMatrix').addEventListener('click',()=>{state.sourceLimit+=7;renderOriginal();});
    $('moreCandidates').addEventListener('click',()=>{
      state.extraOpen=!state.extraOpen;
      state.extraLimit=9;
      renderCandidates();
    });
    $('v2Search').addEventListener('input',()=>{state.extraLimit=9;renderCandidates();});
    $('moreV2').addEventListener('click',()=>{state.extraLimit+=9;renderCandidates();});
    $('startReview').addEventListener('click',()=>{
      $('reviewPanel').hidden=false;
      $('reviewMessage').textContent='';
      $('reason').focus();
    });
    $('cancelReview').addEventListener('click',()=>{$('reviewPanel').hidden=true;});
    $('confirmDemo').addEventListener('click',confirm);
    render();
    $('loading').hidden=true;
    $('workspace').hidden=false;
  }catch(err){
    $('loading').textContent='No se pudo cargar la muestra: '+(err?.message||String(err));
  }
}
boot();
