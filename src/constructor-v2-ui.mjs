import {
  ROWS,fgSubjectsByYear,historicGroups,compositionFor,createGrouping,
  placeSubject,removeSubject,removeGrouping,arrangementWarnings,quarterYear,
  mapRow,subjectArea
} from './integracion-curricular/constructor-mapa-unificado.mjs';
import {foSubjectBank} from './integracion-curricular/mapa-oferta.js';

/**
 * Vista de composición FG + FO por orientación.
 * Reutiliza los IDs del mapa y las clases visuales del editor institucional.
 * La capa de agrupamientos es un borrador aislado (fo.composicionFgV2).
 */
const array=x=>Array.isArray(x)?x:[];
const $=id=>document.getElementById(id);
const el=(tag,text,className)=>{
  const n=document.createElement(tag);
  if(className)n.className=className;
  if(text!==undefined&&text!==null)n.textContent=String(text);
  return n;
};
let currentPciId=null,year=1,type='FG',query='',selectedId='',dragId='';
function subjectBank(refs,pci,currentYear){
  const fg=fgSubjectsByYear(refs,currentYear);
  let fo=[];
  if(Number(currentYear)>=3){
    try{
      const alt=currentAlternative(refs,pci);
      fo=foSubjectBank({
        orientationId:pci.orientation_id,refs,alternative:alt
      }).subjects.filter(x=>Number(x.year)===Number(currentYear)).map(x=>({
        ...x,component:'FO',area:'Formación Orientada'
      }));
    }catch{return fg}
  }
  return [...fg,...fo];
}
function currentAlternative(refs,pci){
  return $('foAlternative')?.value||'A';
}
const detailedLabel=s=>s.component+' · '+s.name+(Number.isFinite(s.hours)?' · '+s.hours+' h':'');
const areaOptions=['Matemática','Lengua y Literatura','Lenguas Adicionales','Ciencias Naturales',
  'Ciencias Sociales','Artes','Tecnologías','Educación Física','Otros formatos'];
function fillSelect(node,values,preferred){
  node.replaceChildren();
  for(const [value,label] of values){
    const option=el('option',label);option.value=value;node.append(option);
  }
  if(preferred&&values.some(row=>row[0]===preferred))node.value=preferred;
}
function contextRow(space){
  if(space.kind==='proyecto')return 'Proyecto de Vinculación con el Futuro';
  if(space.kind==='laboratorio')return 'Laboratorios FO';
  if(space.kind==='taller')return 'Talleres FO';
  return 'Otros formatos';
}
function createAction(text,fn,css=''){
  const btn=el('button',text,css);
  btn.type='button';btn.addEventListener('click',fn);return btn;
}
function smallNote(text){return el('small',text,'muted')}
function ensureIdentity(pci){
  if(currentPciId!==pci.pci_id){
    currentPciId=pci.pci_id;year=1;type='FG';query='';
    selectedId='';dragId='';
  }
}
export function renderUnifiedConstructor({
  pci,workspace,refs,canEdit,onCompositionChange,onFoAssign,
  onOpenHistoricalArea,onOpenFoSpace,onError,onNotice
}){
  if(!pci||pci.model!=='comun'||!workspace?.orientations?.[pci.orientation_id])return;
  ensureIdentity(pci);
  let composition;
  try{composition=compositionFor(workspace,pci);}catch(error){onError(error.message);return}
  const edit=Boolean(canEdit)&&['borrador','en_revision'].includes(pci.status);
  const bag=$('constructorSubjectBank'),mapHead=$('mapHead'),mapBody=$('mapBody');
  const warningBox=$('constructorWarnings');
  const termSelect=$('constructorTerm'),levelSelect=$('constructorLevel'),typeSelect=$('constructorBankType');
  const search=$('constructorSearch'),areaSelect=$('constructorArea'),kindSelect=$('constructorKind');
  const nameInput=$('constructorName'),mirror=$('constructorMirror');
  const allSubjects=subjectBank(refs,pci,year);
  const byId=new Map(allSubjects.map(x=>[x.id,x]));
  const groups=historicGroups(workspace,pci.orientation_id);
  const proposed=composition.groups||[];
  const foSpaces=array(workspace.orientations[pci.orientation_id].fo?.spaces);
  const selType=type==='FO'&&year<3?'FG':type;
  type=selType;
  levelSelect.value=String(year);typeSelect.value=type;
  typeSelect.querySelector('option[value="FO"]').disabled=year<3;
  search.value=query;
  fillSelect(termSelect,[[String(year*2-1),'C'+(year*2-1)],
                         [String(year*2),'C'+(year*2)]],termSelect.value);
  fillSelect(areaSelect,areaOptions.map(x=>[x,x]),areaSelect.value);
  const selected=byId.get(selectedId);
  if(!selected)selectedId='';
  const selectedText=$('constructorSelectedSubject');
  selectedText.textContent=selected?'Materia seleccionada: '+detailedLabel(selected)
    :'Seleccioná una materia de la bolsa y tocá un agrupamiento; también podés arrastrarla.';
  const bankCount=$('constructorBankCount');
  const renderBank=()=>{
    const matching=allSubjects.filter(s=>s.component===type&&
      (!query||[s.name,s.area].join(' ').toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))));
    bank.replaceChildren();
    bankCount.textContent=matching.length+' materias';
    if(!matching.length){
      bag.append(el('p','No hay materias para este filtro.','muted'));return;
    }
    for(const s of matching){
      const btn=createAction(s.name,()=>{
        selectedId=s.id;
        selectedText.textContent='Materia seleccionada: '+detailedLabel(s);
        renderBank();
      },'constructor-bank-subject'+(s.id===selectedId?' active':''));
      btn.draggable=edit;btn.dataset.subjectId=s.id;
      btn.disabled=!edit;
      btn.title='Materia de '+s.year+'º · '+s.component;
      btn.addEventListener('dragstart',event=>{
        dragId=s.id;event.dataTransfer?.setData('text/plain',s.id);
        if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
      });
      btn.addEventListener('dragend',()=>{dragId=''});
      btn.append(smallNote(s.component+' · '+s.year+'º'+
        (Number.isFinite(s.hours)?' · '+s.hours+' h':'')));
      bank.append(btn);
    }
  };
  renderBank();
  const onChange=data=>onCompositionChange(data);
  function selectedSubject(evt){
    const id=(evt?.dataTransfer?.getData('text/plain')||dragId||selectedId).trim();
    const current=byId.get(id);
    if(!current)throw Error('Elegí una materia de la bolsa del mismo nivel.');
    return current;
  }
  function assignToProposal(group,evt){
    if(!edit)return;
    try{
      const s=selectedSubject(evt);
      const next=placeSubject(composition,{groupId:group.id,subject:s});
      onChange(next);onNotice(s.name+' incorporada a la propuesta de C'+group.term+'. Falta guardar.');
    }catch(error){onError(error.message)}
  }
  function assignToFo(space,evt){
    if(!edit)return;
    try{
      const s=selectedSubject(evt);
      if(s.component!=='FO')throw Error(
        'Para integrar una materia FG con FO creá un Laboratorio integrado FG–FO de este año. El espacio FO conserva su composición específica.');
      onFoAssign(space,s.id);
    }catch(error){onError(error.message)}
  }
  function droppable(button,fn){
    if(!edit)return;
    button.classList.add('drop-zone');
    button.addEventListener('dragover',event=>{
      event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';
      button.classList.add('drop-over');
    });
    button.addEventListener('dragleave',()=>button.classList.remove('drop-over'));
    button.addEventListener('drop',event=>{
      event.preventDefault();button.classList.remove('drop-over');fn(event);
    });
  }
  const h=el('tr');h.append(el('th','Área y formato'));
  for(let t=1;t<=10;t++){
    const header=el('th','C'+t);header.append(smallNote('Nivel '+quarterYear(t)));
    h.append(header);
  }
  mapHead.replaceChildren(h);mapBody.replaceChildren();
  const sourceColors={
    legacy:'historia',propuesta:'propuesta',fo:'orientada'
  };
  for(const rowName of ROWS){
    const row=el('tr');const title=el('th',rowName);row.append(title);
    for(let term=1;term<=10;term++){
      const cell=el('td',undefined,'constructor-cell');const items=[];
      for(const g of groups.filter(x=>x.row===rowName&&x.startTerm<=term&&x.endTerm>=term)){
        items.push({source:'legacy',name:g.name,model:g});
      }
      for(const g of proposed.filter(x=>x.row===rowName&&x.term<=term&&x.endTerm>=term)){
        items.push({source:'propuesta',name:g.name,model:g});
      }
      for(const f of foSpaces.filter(x=>contextRow(x)===rowName&&
        Number(x.startTerm??x.term)<=term&&Number(x.endTerm??x.term)>=term)){
        items.push({source:'fo',name:f.name,model:f});
      }
      for(const item of items){
        const b=createAction(item.name,()=>{
          if(item.source==='legacy')onOpenHistoricalArea(item.model.area);
          else if(item.source==='fo')assignToFo(item.model);
          else assignToProposal(item.model);
        },'constructor-group '+sourceColors[item.source]);
        const description=item.source==='legacy'
          ?'FG conservada · '+item.model.contents+' contenidos · '+item.model.plans+' planes'
          :item.source==='fo'
            ?(item.model.members?.length||0)+' materias FO · '+item.model.kind
            :(item.model.members?.length||0)+' materias propuestas';
        b.append(smallNote(description));b.title=item.source==='legacy'
          ?'Abrir FG histórica copiada, sin modificar el origen'
          :'Seleccioná una materia de la bolsa o arrastrala aquí';
        if(item.source==='propuesta'){
          droppable(b,event=>assignToProposal(item.model,event));
          const memberList=el('div',undefined,'constructor-members');
          for(const member of array(item.model.members)){
            const chip=el('span',member.name,'constructor-member');
            if(edit)chip.append(createAction('×',event=>{
              event.stopPropagation();
              onChange(removeSubject(composition,{groupId:item.model.id,subjectId:member.id}));
            },'constructor-remove'));
            memberList.append(chip);
          }
          b.append(memberList);
          if(edit){
            const remove=createAction('Quitar propuesta',evt=>{
              evt.stopPropagation();
              if(confirm('¿Quitar este agrupamiento propuesto? Su contenido histórico permanecerá intacto.'))
                onChange(removeGrouping(composition,item.model.id));
            },'constructor-remove-group');
            b.append(remove);
          }
        }else if(item.source==='fo')droppable(b,event=>assignToFo(item.model,event));
        cell.append(b);
      }
      if(!cell.children.length)cell.append(el('span','+','constructor-empty'));
      row.append(cell);
    }
    mapBody.append(row);
  }
  const countHistoric=groups.length,countNew=proposed.length;
  const warnings=arrangementWarnings(composition);
  warningBox.replaceChildren(
    el('strong','FG conservada: '+countHistoric+' agrupamientos · Propuestas: '+
      countNew+' espacios · FO: '+foSpaces.length+' espacios.'),
    el('p',warnings.length?
      warnings.length+' aspectos por revisar: '+warnings.slice(0,5).join(' · '):
      'La composición nueva es un borrador. El mapa histórico no se modifica. La validación curricular definitiva se realiza antes de homologar.')
  );
  levelSelect.onchange=()=>{
    year=Number(levelSelect.value);if(year<3)type='FG';selectedId='';renderUnifiedConstructor({
      pci,workspace,refs,canEdit,onCompositionChange,onFoAssign,
      onOpenHistoricalArea,onOpenFoSpace,onError,onNotice
    });
  };
  typeSelect.onchange=()=>{
    type=typeSelect.value;selectedId='';
    renderUnifiedConstructor({
      pci,workspace,refs,canEdit,onCompositionChange,onFoAssign,
      onOpenHistoricalArea,onOpenFoSpace,onError,onNotice
    });
  };
  search.oninput=()=>{query=search.value.trim();renderBank()};
  kindSelect.onchange=()=>{
    const kind=kindSelect.value;
    if(kind==='integrado')areaSelect.value='Ciencias Sociales';
  };
  $('constructorCreate').disabled=!edit;
  $('constructorCreate').onclick=()=>{
    try{
      const updated=createGrouping(composition,{
        term:Number(termSelect.value),year,area:areaSelect.value,
        kind:kindSelect.value,name:nameInput.value,
        replicate:mirror.checked
      });
      nameInput.value='';
      onChange(updated);onNotice('Agrupamiento incorporado al borrador del PCI. Falta guardar.');
    }catch(error){onError(error.message)}
  };
  if(!edit){
    warningBox.append(el('p','Este PCI está en modo lectura o cerrado. Las materias no se pueden mover.','muted'));
  }
}
