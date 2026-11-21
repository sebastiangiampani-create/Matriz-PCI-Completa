import {
  ROWS,fgSubjectsByYear,historicGroups,compositionFor,createGrouping,
  placeSubject,promoteHistoricGroup,removeSubject,removeGrouping,arrangementWarnings,quarterYear,
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
    }catch(error){throw Error('No se pudo cargar la bolsa de Formación Orientada: '+error.message)}
  }
  return [...fg,...fo];
}
function currentAlternative(refs,pci){
  return $('foAlternative')?.value||'A';
}
const detailedLabel=s=>s.component+' · '+s.name;
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
  pci,workspace,refs,canEdit,onCompositionChange,onFoAssign,onFoMove,
  onOpenHistoricalArea,onOpenFoSpace,onError,onNotice
}){
  if(!pci||pci.model!=='comun'||!workspace?.orientations?.[pci.orientation_id])return;
  ensureIdentity(pci);
  let composition;
  try{composition=compositionFor(workspace,pci);}catch(error){onError(error.message);return}
  const edit=Boolean(canEdit)&&['borrador','en_revision'].includes(pci.status);
  const bank=$('constructorSubjectBank'),mapHead=$('mapHead'),mapBody=$('mapBody');
  const warningBox=$('constructorWarnings');
  const termSelect=$('constructorTerm'),levelSelect=$('constructorLevel'),typeSelect=$('constructorBankType');
  const search=$('constructorSearch'),areaSelect=$('constructorArea'),kindSelect=$('constructorKind');
  const nameInput=$('constructorName'),mirror=$('constructorMirror');
  let allSubjects=[];
  try{allSubjects=subjectBank(refs,pci,year);}
  catch(error){onError(error.message);allSubjects=fgSubjectsByYear(refs,year);}
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
      bank.append(el('p','No hay materias disponibles en este nivel y formación. Revisá la orientación o el catálogo curricular.','muted'));return;
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
      btn.append(smallNote(s.component+' · Nivel '+s.year));
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
  function assignToHistorical(group,evt){
    if(!edit)return;
    try{
      const s=selectedSubject(evt);
      const promoted=promoteHistoricGroup(composition,group);
      const next=placeSubject(promoted,{groupId:group.id,subject:s});
      onChange(next);
      onNotice('Composición del espacio histórico revisada en una copia del PCI. Los contenidos y planes originales siguen intactos.');
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
  // PCI V2: la bolsa se arrastra directamente sobre el mapa.
  // Las celdas sin formato reciben una materia y crean SOLO un borrador
  // de composición del PCI, nunca alteran la FG original de la escuela.
  const formatByRow={
    'Matemática':['Matemática','troncal'],
    'Lengua y Literatura':['Lengua y Literatura','troncal'],
    'Lenguas Adicionales':['Lenguas Adicionales','troncal'],
    'Laboratorios FG · Naturales':['Ciencias Naturales','laboratorio'],
    'Laboratorios FG · Sociales':['Ciencias Sociales','laboratorio'],
    'Talleres FG · Artes':['Artes','taller'],
    'Talleres FG · Tecnologías':['Tecnologías','taller'],
    'Talleres FG · Educación Física':['Educación Física','taller'],
    'Otros espacios FG':['Otros formatos','otro'],
    'Otros formatos':['Otros formatos','otro']
  };
  function addOnEmpty(rowName,term,event){
    if(!edit)return;
    try{
      const subject=selectedSubject(event),config=formatByRow[rowName];
      if(!config)throw Error('Este destino pertenece a Formación Orientada o a un proyecto específico. Arrastrá la materia al formato FO existente.');
      if(subject.component!=='FG')
        throw Error('La bolsa FG y la FO tienen destinos distintos. Usá el laboratorio o taller FO del nivel.');
      const [area,kind]=config;
      if(kind==='troncal'&&subjectArea(subject.name)!==area)
        throw Error('Acción no permitida: cada materia troncal se ubica en su propia fila anual.');
      if(kind!=='otro'&&area!==subjectArea(subject.name))
        throw Error('Acción no permitida: esta materia corresponde a '+subjectArea(subject.name)+'.');
      const level=quarterYear(term);
      if(Number(subject.year)!==level)
        throw Error('Acción no permitida: no se trasladan materias entre niveles.');
      const name=kind==='troncal'?area:
       (kind==='laboratorio'?'Laboratorio ':kind==='taller'?'Taller ':'Espacio ')+
       subject.name+' · '+level+'º';
      const updated=createGrouping(composition,{year:level,term,area,kind,name,replicate:true});
      const created=updated.groups[updated.groups.length-(kind==='troncal'?1:2)]||null;
      if(!created)throw Error('No se pudo ubicar el agrupamiento en el cuatrimestre.');
      const assigned=placeSubject(updated,{groupId:created.id,subject});
      onChange(assigned);
      onNotice(subject.name+' ubicada en C'+term+' (y su cuatrimestre par cuando corresponde). Revisá y guardá el mapa.');
    }catch(error){onError(error.message)}
  }
  // PCI V2: niveles en pares de cuatrimestres y troncales anuales indivisibles.
  const levels=el('tr');
  const areaHeader=el('th','Área y formato');areaHeader.rowSpan=2;levels.append(areaHeader);
  for(let level=1;level<=5;level++){
    const header=el('th','Nivel '+level);header.colSpan=2;levels.append(header);
  }
  const quarters=el('tr');
  for(let t=1;t<=10;t++)quarters.append(el('th','C'+t));
  mapHead.replaceChildren(levels,quarters);mapBody.replaceChildren();
  const sourceColors={
    legacy:'historia',propuesta:'propuesta',fo:'orientada'
  };
  for(const rowName of ROWS){
    const row=el('tr');const title=el('th',rowName);row.append(title);
    for(let term=1;term<=10;term++){
      const cell=el('td',undefined,'constructor-cell');const items=[];
      const annualTrunk=['Matemática','Lengua y Literatura','Lenguas Adicionales'].includes(rowName);
      if(annualTrunk && term%2===1){
        cell.colSpan=2;
        cell.dataset.pciAnnual='true';
        cell.setAttribute('aria-label',rowName+' · Nivel '+quarterYear(term)+' · C'+term+'–C'+(term+1)+' · anual');
      }
      for(const g of groups.filter(x=>x.row===rowName&&x.startTerm<=term&&x.endTerm>=term&&
        !proposed.some(p=>p.legacyGroupId===x.id&&p.area===x.area))){
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
        const b=el('div',undefined,'constructor-group '+sourceColors[item.source]);
        const activate=()=>{
          if(item.source==='legacy'){
            if(selectedId)assignToHistorical(item.model);
            else onOpenHistoricalArea(item.model.area);
          }
          else if(item.source==='fo'){
            if(selectedId)assignToFo(item.model);
            else onNotice('Elegí una materia FO de la bolsa o arrastrá el formato a otro cuatrimestre del mismo nivel.');
          }
          else assignToProposal(item.model);
        };
        b.setAttribute('role','button');b.tabIndex=0;
        b.addEventListener('click',activate);
        b.addEventListener('keydown',event=>{
          if(event.target!==b)return;
          if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();}
        });
        b.append(el('strong',item.name,'constructor-group-title'));
        const description=item.source==='legacy'
          ?'FG conservada · '+item.model.contents+' contenidos · '+item.model.plans+' planes'+
            (item.model.hasWork?' · trabajo protegido':' · plantilla revisable')
          :item.source==='fo'
            ?(item.model.members?.length||0)+' materias FO · '+item.model.kind
            :(item.model.members?.length||0)+' materias propuestas';
        b.append(smallNote(description));b.title=item.source==='legacy'
          ?item.model.hasWork?'FG con contenidos o planes: conservada y protegida. Revisar equivalencias antes de cambiar materias.':
            'Podés asignar materias a una copia de esta plantilla FG. El original se conserva.'
          :'Seleccioná una materia de la bolsa o arrastrala aquí';
        if(item.source==='fo'&&item.model.kind!=='proyecto'&&edit){
          b.draggable=true;
          b.title='Arrastrá este formato FO a otro cuatrimestre del mismo nivel.';
          b.addEventListener('dragstart',event=>{
            dragId='';
            event.dataTransfer?.setData('application/x-pci-fo-format',item.model.id);
            if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
          });
        }
        if(item.source==='legacy'&&!item.model.hasWork)
          droppable(b,event=>assignToHistorical(item.model,event));
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
      if(!cell.children.length){
        // Regla diferencial de Naturales orientada: FG ofrece 8 laboratorios,
        // C1-C8. Los espacios de FO mantienen talleres en su propia fila.
        // Si existe un grupo histórico en C9/C10, se muestra arriba y no se borra.
        if(rowName==='Laboratorios FG · Naturales' &&
           pci.orientation_id==='ciencias_naturales' && term>=9){
          const notice=el('span','Sin laboratorio FG en este nivel','muted');
          notice.title='En la orientación Ciencias Naturales corresponden 8 laboratorios FG de C1 a C8. Los talleres orientados están en Talleres FO.';
          cell.append(notice);row.append(cell);continue;
        }
        const foRow=['Laboratorios FO','Talleres FO'].includes(rowName);
        if(foRow&&quarterYear(term)>=3){
          const zone=createAction('↔',()=>{
            onNotice('Arrastrá aquí un formato FO del mismo nivel para reubicarlo.');
          },'constructor-empty constructor-empty-drop');
          zone.setAttribute('aria-label','Reubicar formato de '+rowName+' en C'+term);
          if(edit){
            zone.classList.add('drop-zone');
            zone.addEventListener('dragover',event=>{
              if(!event.dataTransfer?.types?.includes('application/x-pci-fo-format'))return;
              event.preventDefault();zone.classList.add('drop-over');
            });
            zone.addEventListener('dragleave',()=>zone.classList.remove('drop-over'));
            zone.addEventListener('drop',event=>{
              event.preventDefault();zone.classList.remove('drop-over');
              const id=event.dataTransfer?.getData('application/x-pci-fo-format');
              const current=foSpaces.find(x=>x.id===id);
              if(!current||contextRow(current)!==rowName||
                Number(current.year)!==quarterYear(term)){
                onError('Acción no permitida: el formato FO debe permanecer en su tipo y nivel.');return;
              }
              if(typeof onFoMove==='function')onFoMove(id,term);
            });
          }else zone.disabled=true;
          cell.append(zone);row.append(cell);continue;
        }
        const plus=createAction('+',()=>addOnEmpty(rowName,term,null),'constructor-empty constructor-empty-drop');
        plus.title='Seleccioná una materia de la bolsa y soltala aquí para construir el agrupamiento de este cuatrimestre.';
        plus.setAttribute('aria-label','Ubicar materia en '+rowName+' · C'+term);
        plus.disabled=!edit||!formatByRow[rowName];
        if(formatByRow[rowName])droppable(plus,event=>addOnEmpty(rowName,term,event));
        cell.append(plus);
      }
      row.append(cell);
      if(annualTrunk && term%2===1)term++;
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
      pci,workspace,refs,canEdit,onCompositionChange,onFoAssign,onFoMove,
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
