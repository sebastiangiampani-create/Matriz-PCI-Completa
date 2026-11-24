/**
 * Inicio institucional: escuelas autorizadas, sus PCI y trabajo anterior.
 * Conserva el recorrido existente; cada PCI se abre como documento principal.
 * La creación y la asignación histórica requieren una acción explícita.
 */
import {ORIENTATIONS} from '../integracion-curricular/bridge.js';
import {SPECIALTIES,findSpecialty} from '../tecnica/pautas-pci-20261005.mjs';
import {agruparPcis,TURNOS} from '../pci-turnos-organizacion.mjs';
import {pciRouteHref,parsePciRoute} from '../pci-router.mjs';
import {historicCountsForPci} from '../vinculos-historicos.mjs';
import {createHistoricAssignmentUI} from '../vinculos-historicos-ui.mjs';

const $=id=>document.getElementById(id);
const elem=(tag,text,className)=>{
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=String(text);
  if(className)node.className=className;
  return node;
};
const add=(parent,tag,text,className)=>{
  const node=elem(tag,text,className);parent.append(node);return node;
};
const schoolIdOf=school=>Number(school?.id??school?.school_id);
const modelLabel=pci=>pci.model==='tecnica'?'Técnica':pci.model==='ba15'?'BA +15':'Media';
const orientationLabel=pci=>pci.model==='tecnica'?pci.specialty_name:
  ORIENTATIONS.find(item=>item.id===pci.orientation_id)?.name||pci.title||pci.orientation_id;

export function montarEscuela({contexto,escuelas=[],pcis=[],vinculos=null,cliente}){
  const school=contexto?.school,schoolId=schoolIdOf(school);
  if(!Number.isSafeInteger(schoolId)||schoolId<1001)
    throw Error('No se identificó la escuela autorizada.');
  if(!cliente||typeof cliente.crearPci!=='function')
    throw Error('No se pudo preparar el acceso a los PCI de esta escuela.');
  const puedeEditar=contexto.permissions?.puedeEditar===true;
  const puedeDeclarar=contexto.permissions?.puedeDeclarar===true;
  const session=contexto.session||{};
  const authorizedSchools=escuelas.length?escuelas:[school];
  if(!authorizedSchools.some(item=>schoolIdOf(item)===schoolId))
    throw Error('La escuela seleccionada no está disponible en esta sesión.');
  let lista=[],busy=false,downloading=false,lastSuggestedTitle='',leaving=false;
  const controller=new AbortController();
  const on=(node,event,handler)=>node.addEventListener(event,handler,{signal:controller.signal});
  const message=(text,kind='')=>{
    $('schoolMessage').textContent=text;
    $('schoolMessage').className='message '+kind;
    $('schoolMessage').hidden=!text;
  };
  const status=(text,kind='')=>{
    $('status').textContent=text;$('status').className='status '+kind;
  };
  const href=(pciId=null,view='oferta',id=schoolId)=>
    pciRouteHref(location.href,{schoolId:id,pciId,view});
  const historic=createHistoricAssignmentUI({
    canManage:()=>puedeDeclarar&&!busy,
    notify:message,
    onChanged:()=>renderPcis(),
    call:(action,data)=>{
      if(Number(data.school_id)!==schoolId)
        throw Error('Las asignaciones no corresponden a esta escuela.');
      if(action==='get-school-legacy-links')return cliente.obtenerVinculos(schoolId);
      if(action==='save-school-legacy-links'){
        if(!puedeDeclarar)throw Error('Este acceso no permite asignar trabajo anterior.');
        if(typeof cliente.guardarVinculos!=='function')
          throw Error('No está disponible el guardado de asignaciones. Conservá la selección y volvé a intentar.');
        return cliente.guardarVinculos(schoolId,{
          document:data.document,expected_revision:data.expected_revision
        });
      }
      throw Error('Operación de asignaciones desconocida.');
    }
  });

  function validarPcis(next){
    if(!Array.isArray(next))throw Error('No se recibió una lista de PCI válida.');
    for(const pci of next){
      if(pci.school_id!=null&&Number(pci.school_id)!==schoolId)
        throw Error('Se recibió un PCI que no pertenece a esta escuela.');
      if(parsePciRoute(href(pci.pci_id)).pciId!==pci.pci_id)
        throw Error('Se recibió un identificador de PCI inválido.');
    }
    agruparPcis(next);
    return next.slice();
  }

  function renderPcis(){
    const grouped=agruparPcis(lista),shift=$('turnFilter').value;
    const displayed=grouped.filter(item=>shift==='todos'||item.id===shift);
    const counts=[
      [lista.length,'PCI'],[grouped.length,'turnos'],
      [lista.filter(p=>p.model==='comun').length,'Media'],
      [lista.filter(p=>p.model==='tecnica').length,'Técnica'],
      [lista.filter(p=>p.model==='ba15').length,'BA +15']
    ];
    $('pciCounts').textContent=counts.map(([n,label])=>n+' '+label).join(' · ');
    $('schoolSummary').replaceChildren(...counts.map(([n,label])=>
      elem('span',n+' '+label,'school-count-chip')));
    const side=$('pciList'),cards=$('schoolPciCards');
    side.replaceChildren();cards.replaceChildren();
    for(const id of ['historicalPciLink','homeHistoricalPciLink'])
      $(id).disabled=!lista.length||downloading;
    $('historicalPciHelp').hidden=lista.length>0;
    if(!lista.length){
      add(side,'p','Todavía no hay PCI declarados para esta escuela.','muted');
      const first=add(cards,'div',undefined,'school-no-pcis school-start-card');
      add(first,'span','PRIMER INGRESO · CONSTRUCCIÓN CURRICULAR','eyebrow');
      add(first,'h3','Esta escuela todavía no tiene un PCI');
      add(first,'p','Seleccioná la modalidad, la orientación o especialidad y el turno. Después podrás construir el mapa y desarrollar sus contenidos y planes de aprendizaje.','muted');
      add(first,'p','1 · Elegir modalidad y turno   →   2 · Constructor curricular   →   3 · Desarrollo curricular','school-start-steps');
      if(puedeDeclarar){
        const start=add(first,'button','Crear primer PCI y comenzar','btn primary');
        start.type='button';start.id='startFirstPci';on(start,'click',openForm);
      }else add(first,'p','Este acceso permite consultar. La creación de un PCI requiere una clave autorizada de esta escuela.','muted');
      add(first,'p','Si la institución tiene una Formación General anterior, sus contenidos y planes se conservan.','muted');
      return;
    }
    if(!displayed.length){
      add(cards,'p','Este turno no tiene PCI. Seleccioná otro turno para continuar.','school-no-pcis');
      add(side,'p','No hay PCI en el turno seleccionado.','muted');
      return;
    }
    const grid=add(cards,'div',undefined,'school-offer-grid');
    for(const turno of displayed){
      const section=add(side,'section',undefined,'pciShiftSection');
      add(section,'h3','Turno '+turno.nombre+' · '+turno.cantidad+' PCI','pciShiftHeading');
      for(const modelo of turno.modelos){
        add(section,'h4',modelo.nombre+' · '+modelo.pcis.length,'pciModelHeading');
        for(const pci of modelo.pcis){
          const track=(pci.model==='tecnica'?'Especialidad: ':'Orientación: ')+orientationLabel(pci);
          const sideLink=add(section,'a',undefined,'pciItem');
          sideLink.href=href(pci.pci_id);
          sideLink.setAttribute('aria-label','Abrir '+track+' · Turno '+turno.nombre+' · '+pci.title);
          add(sideLink,'strong',pci.title);add(sideLink,'small',track+' · '+(pci.status||'PCI'));
          const card=add(grid,'article',undefined,'school-offer-card area-card');
          const top=add(card,'div',undefined,'school-offer-top');
          add(top,'span',modelLabel(pci)+' · Turno '+turno.nombre,'pill');
          add(top,'span',pci.status==='borrador'?'En desarrollo':pci.status==='en_revision'?'En revisión':pci.status||'PCI','school-state');
          const body=add(card,'div',undefined,'school-offer-body');
          add(body,'h3',orientationLabel(pci));add(body,'p',pci.title,'muted');
          if(historic.document){
            const count=historicCountsForPci(historic.rows,historic.document,pci);
            add(body,'small','Histórico vinculado: '+count.general+' FG · '+count.orientada+' orientación · '+count.tecnica+' Técnica · '+count.plans+' planes','muted');
          }else if(historic.rows.some(row=>row.hasWork)){
            add(body,'small','Trabajo histórico: asignación pendiente de definir','muted');
          }
          const actions=add(card,'div',undefined,'school-offer-actions');
          for(const [view,label,kind] of [
            ['oferta','1 · Constructor curricular','primary'],
            ['desarrollo','2 · Desarrollo curricular','secondary']
          ]){
            const link=add(actions,'a',label,'btn '+kind);link.href=href(pci.pci_id,view);
            link.setAttribute('aria-label',label+' · '+pci.title+' · Turno '+turno.nombre);
          }
        }
      }
    }
  }

  function suggestTitle(){
    const field=$('pciTitleInput');
    if(field.value.trim()&&field.value.trim()!==lastSuggestedTitle)return;
    const model=$('pciModel').value;
    const name=model==='tecnica'?$('specialtyName').value:
      ORIENTATIONS.find(item=>item.id===$('orientation').value)?.name;
    const shift=TURNOS.find(([id])=>id===$('pciShift').value)?.[1]||'';
    lastSuggestedTitle=name?modelLabel({model})+' · '+name+' · Turno '+shift:'';
    field.value=lastSuggestedTitle;
  }

  function updateModel(){
    const technical=$('pciModel').value==='tecnica';
    $('technicalSpecialtyGroup').hidden=!technical;
    $('mediaOrientationGroup').hidden=technical;
    $('orientation').disabled=technical||busy;$('orientation').required=!technical;
    $('specialtyName').disabled=!technical||busy;$('specialtyName').required=technical;
    suggestTitle();
  }

  function openForm(){
    if(!puedeDeclarar||busy)return;
    $('formCreatePci').hidden=false;suggestTitle();
    $('formCreatePci').scrollIntoView({behavior:'smooth',block:'nearest'});
    $('pciModel').focus({preventScroll:true});
  }

  function setBusy(value){
    busy=value;$('formCreatePci').setAttribute('aria-busy',String(value));
    for(const control of $('formCreatePci').querySelectorAll('input,select,button'))control.disabled=value;
    $('btnAddPci').disabled=value||!puedeDeclarar;
    $('school').disabled=value||authorizedSchools.length===1;
    $('editHistoricLinks').disabled=value||!puedeDeclarar;
    updateModel();
  }

  async function createPci(event){
    event.preventDefault();
    if(!puedeDeclarar||busy)return;
    if(historic.isDirty){
      message('Guardá o cancelá las asignaciones pendientes antes de crear otro PCI.','warn');return;
    }
    if(!$('formCreatePci').reportValidity())return;
    const model=$('pciModel').value,shiftId=$('pciShift').value;
    const orientationId=model==='tecnica'?'':$('orientation').value;
    const specialtyName=model==='tecnica'?findSpecialty($('specialtyName').value)?.name||'':'';
    const title=$('pciTitleInput').value.trim();
    try{
      if(!['comun','tecnica','ba15'].includes(model))throw Error('Seleccioná un modelo curricular válido.');
      if(!TURNOS.some(([id])=>id===shiftId))throw Error('Seleccioná un turno válido.');
      if(model==='tecnica'?!specialtyName:!ORIENTATIONS.some(item=>item.id===orientationId))
        throw Error('Seleccioná una orientación o especialidad del catálogo.');
      if(title.length<3||title.length>150)throw Error('Ingresá un nombre de entre 3 y 150 caracteres para identificar el PCI.');
      if(lista.some(p=>p.model===model&&p.shift_id===shiftId&&
        (model==='tecnica'?p.specialty_name===specialtyName:p.orientation_id===orientationId)))
        throw Error('Esta orientación o especialidad ya tiene un PCI en ese turno. Abrí el existente.');
      setBusy(true);message('');status('Creando PCI…');
      const created=await cliente.crearPci(schoolId,{
        model,orientation_id:orientationId,specialty_name:specialtyName,shift_id:shiftId,title
      });
      if(!created?.pci_id||parsePciRoute(href(created.pci_id)).pciId!==created.pci_id)
        throw Error('El servidor no confirmó la creación. Actualizá la escuela antes de volver a enviarla.');
      status('PCI creado');leaving=true;location.href=href(created.pci_id);
    }catch(error){
      status('No se completó la creación','error');message(error.message||String(error),'error');
    }finally{setBusy(false);}
  }

  async function downloadHistoric(){
    if(downloading||!lista.length)return;
    downloading=true;
    for(const id of ['historicalPciLink','homeHistoricalPciLink'])$(id).disabled=true;
    try{
      status('Preparando descarga de la FG anterior…');
      const original=await cliente.obtenerPci(schoolId,lista[0].pci_id);
      if(!original?.legacy_state||!original.legacy_sha256||Number(original.school_id)!==schoolId||
        original.pci_id!==lista[0].pci_id)
        throw Error('No se pudo verificar el documento histórico de esta escuela.');
      const file={source_sha256:original.legacy_sha256,school_id:schoolId,
        pci_id:original.pci_id,original_state:original.legacy_state};
      const url=URL.createObjectURL(new Blob([JSON.stringify(file,null,2)],{type:'application/json'}));
      const anchor=elem('a');anchor.href=url;
      anchor.download='pci-fg-original-escuela-'+schoolId+'-'+original.pci_id+'.json';
      document.body.append(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),2000);
      status('FG anterior descargada');
    }catch(error){status('No se pudo descargar','error');message(error.message||String(error),'error');}
    finally{
      downloading=false;
      for(const id of ['historicalPciLink','homeHistoricalPciLink'])$(id).disabled=!lista.length;
    }
  }

  const selector=$('school');selector.replaceChildren();
  for(const item of authorizedSchools){
    const option=add(selector,'option',item.name||'Escuela '+schoolIdOf(item));
    option.value=String(schoolIdOf(item));
  }
  selector.value=String(schoolId);selector.disabled=authorizedSchools.length===1;
  // Los accesos DIR y PCI tienen una única escuela autorizada. Ocultar
  // el selector evita sugerir que pueden consultar otras instituciones.
  // Administración mantiene la lista, limitada por la respuesta autorizada.
  const schoolChooser=selector.closest('.school-chooser');
  if(schoolChooser)schoolChooser.hidden=authorizedSchools.length===1;
  $('schoolLabel').textContent=school.cue?'CUE '+school.cue:'';
  $('schoolOverviewName').textContent=school.name||'Oferta curricular de la escuela';
  // El logo lleva al inicio de organización curricular. «Volver» conduce
  // al panel desde el que se abrió la escuela y nunca a la página actual.
  $('brandHomeLink').href=href();
  const from=new URLSearchParams(location.search).get('from');
  const back=$('schoolHomeLink');
  const adminSession=session.role==='admin'||session.role==='user';
  const institutionSession=session.role==='school_admin';
  if(from==='panel-general'||(!from&&adminSession)){
    back.hidden=false;
    back.href='panel-general.html';
    back.textContent='← Volver a Administración';
  }else if(from==='panel-escuela'||(!from&&institutionSession)){
    back.hidden=false;
    back.href='panel-escuela.html?school='+encodeURIComponent(schoolId)+(adminSession?'&admin=1':'');
    back.textContent='← Volver al panel institucional';
  }else{
    back.hidden=false;
    back.href='index.html';
    back.textContent='← Volver a la plataforma';
  }
  const permissions=Array.isArray(session.permissions)?session.permissions:[];
  const admin=session.role==='admin'||session.role==='user'&&
    (permissions.includes('dashboard.view')||permissions.includes('institutional.view'));
  $('adminPanelLink').hidden=!admin;
  $('schoolPanelLink').hidden=!(admin||session.role==='school_admin');
  $('schoolPanelLink').href='panel-escuela.html?school='+encodeURIComponent(schoolId)+(admin?'&admin=1':'');
  $('schoolPermissionMessage').hidden=puedeEditar;
  $('schoolPermissionMessage').textContent=puedeDeclarar?
    'Este acceso permite declarar orientaciones, turnos y asignaciones. La edición de contenidos y planes requiere una clave de edición de esta escuela.':
    'Este acceso permite consultar los PCI de la escuela. La creación y edición requieren una clave autorizada de esta escuela.';
  $('btnAddPci').disabled=!puedeDeclarar;
  $('turnFilter').replaceChildren();
  for(const [value,label] of [['todos','Todos los turnos'],...TURNOS.map(([id,name])=>[id,'Turno '+name])]){
    const option=add($('turnFilter'),'option',label);option.value=value;
  }
  $('orientation').replaceChildren();
  for(const item of ORIENTATIONS){const option=add($('orientation'),'option',item.name);option.value=item.id;}
  $('specialtyName').replaceChildren();
  const placeholder=add($('specialtyName'),'option','Seleccionar especialidad técnica');
  placeholder.value='';placeholder.disabled=true;placeholder.selected=true;
  for(const [state,label] of [
    ['defined_in_document','Especialidades con espacios anuales definidos'],
    ['not_defined_in_document','Especialidades pendientes de definición anual'],
    ['no_annual_space','Especialidad sin espacio anual (excepción)']
  ]){
    const group=add($('specialtyName'),'optgroup');group.label=label;
    for(const specialty of SPECIALTIES.filter(item=>item.status===state)){
      const option=add(group,'option',specialty.name);option.value=specialty.name;
    }
  }
  on(selector,'change',()=>{
    const next=Number(selector.value);
    if(next===schoolId)return;
    if(!authorizedSchools.some(item=>schoolIdOf(item)===next)){
      selector.value=String(schoolId);return;
    }
    if((historic.isDirty||busy)&&!confirm('Hay cambios sin guardar. ¿Querés salir de esta escuela?')){
      selector.value=String(schoolId);return;
    }
    leaving=true;location.href=href(null,'oferta',next);
  });
  on($('turnFilter'),'change',renderPcis);
  on($('btnAddPci'),'click',openForm);
  on($('cancelPci'),'click',()=>{$('formCreatePci').hidden=true;});
  on($('pciModel'),'change',updateModel);
  for(const id of ['orientation','specialtyName','pciShift'])on($(id),'change',suggestTitle);
  on($('formCreatePci'),'submit',createPci);
  for(const id of ['historicalPciLink','homeHistoricalPciLink'])on($(id),'click',downloadHistoric);
  on(window,'beforeunload',event=>{
    if(!leaving&&(historic.isDirty||busy)){event.preventDefault();event.returnValue='';}
  });
  lista=validarPcis(pcis);
  historic.load({rows:[],revision:0,document:null,...vinculos,school_id:schoolId},lista);
  updateModel();renderPcis();
  $('app').classList.add('school-home');$('app').hidden=false;
  if(!lista.length&&puedeDeclarar&&new URLSearchParams(location.search).get('nuevo')==='1')openForm();

  return {
    actualizarPcis(next){lista=validarPcis(next);historic.updateTargets(lista);renderPcis();},
    get isDirty(){return historic.isDirty||busy;},
    destroy(){
      controller.abort();
      for(const id of ['editHistoricLinks','cancelHistoricLinks','saveHistoricLinks'])
        if($(id))$(id).onclick=null;
      if($('historicShowEmpty'))$('historicShowEmpty').onchange=null;
    }
  };
}
