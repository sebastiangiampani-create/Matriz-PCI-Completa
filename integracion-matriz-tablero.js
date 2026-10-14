/**
 * Matriz integrada de lectura: FG y FO realmente ubicadas en el Mapa
 * de la Oferta de la orientación activa, nunca en la matriz histórica.
 *
 * Editar cualquier espacio abre el motor curricular existente a pantalla
 * completa, en el año correspondiente. No toca pciAppV2 ni Supabase.
 */
import { OFFER_FG_AREAS, deriveAreaProjection, deriveFoProjection }
  from './src/integracion-curricular/proyeccion-oferta-matriz.js';

const $ = id => document.getElementById(id);
const board = $('pci-integrated-matrix');
const tableBody = $('pciIntegratedBody');
const head = $('pciIntegratedHead');
const yearPicker = $('pciIntegratedYear');
const V2_KEY = 'pci-matriz-fg-v2-original-preview-20261009';
const foLabels = {
  laboratorio: 'Laboratorios de la orientación',
  taller: 'Talleres de la orientación',
  'proyecto de vinculación': 'Proyecto de Vinculación con el Futuro',
  'por definir': 'Formatos pendientes de definir'
};
const slug = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const loadedData = {catalog:null};

if(board && tableBody && head && yearPicker){
  let activeFilter = 'todos';
  let previousFocus = null;
  let oldOrientation = '';
  const orientation = () => $('pciDemoOrientationContext')?.textContent?.trim() || '';
  function currentMap(){
    try {
      const obj = JSON.parse(localStorage.getItem(V2_KEY) || '{}');
      return obj && obj.maps && typeof obj.maps === 'object' ? obj.maps[orientation()] || null : null;
    }catch(_){return null;}
  }
  function namedSubject(id,map) {
    if(typeof id !== 'string')return String(id || '');
    const custom = Array.isArray(map?.custom) ? map.custom.find(x => x?.id === id) : null;
    if(custom?.name)return String(custom.name);
    const fg=id.match(/^fg-([1-5])-(.+)$/);
    if(fg){
      const subject=loadedData.catalog?.formacion_general?.[fg[1]]?.find(s=>slug(s)===fg[2]);
      if(subject)return String(subject);
    }
    const fo=id.match(/^fo-(.+)-([345])-(\d+)$/);
    if(fo && fo[1]===slug(orientation())){
      const oriented=loadedData.catalog?.formacion_orientada?.[orientation()] || {};
      const subjects=fo[2]==='3'?oriented['3']:oriented[map?.alt === 'B'?'B':'A']?.[fo[2]];
      if(Array.isArray(subjects) && subjects[Number(fo[3])])return String(subjects[Number(fo[3])]);
    }
    return id;
  }
  const make=(tag,className,text)=>{
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(text!==undefined)el.textContent=String(text);
    return el;
  };

  function matrixRows(map){
    const fg=OFFER_FG_AREAS.map(area=>{
      const p=deriveAreaProjection(area,map);
      return {type:'fg',key:area,label:area,groups:p?.years.flatMap(y=>y.groups) || []};
    });
    const fo=deriveFoProjection(map).flatMap(row=>row.groups);
    const formatOrder=['laboratorio','taller','proyecto de vinculación','por definir'];
    const oriented=formatOrder.map(format=>({
      type:'fo',key:format,label:foLabels[format],
      groups:fo.filter(group=>group.format===format)
    }));
    return {fg,oriented};
  }
  function shownRows(map){
    const {fg,oriented}=matrixRows(map);
    if(activeFilter==='todos')return [...fg,...oriented.filter(row=>row.groups.length)];
    if(activeFilter==='laboratorios')return oriented.filter(row=>row.key==='laboratorio'||row.key==='por definir');
    if(activeFilter==='talleres')return oriented.filter(row=>row.key==='taller'||row.key==='por definir');
    if(activeFilter==='proyecto')return oriented.filter(row=>row.key==='proyecto de vinculación');
    return [...fg,...oriented];
  }
  function termGroups(row,term){
    return row.groups.filter(group=>{
      if(group.term===term)return true;
      return group.term===null && Number(group.year)===Math.ceil(term/2);
    });
  }
  function statusFor(row,term){
    const groups=termGroups(row,term);
    return {
      groups,
      available:groups.length>0,
      occupied:groups.filter(group=>group.subjectIds?.length).length
    };
  }
  function goToOffer(year){
    // El botón original es el único punto de edición. El tablero no modifica
    // ubicaciones y por ello tampoco compromete secuencias históricas.
    if(!$('pciMapYear') || !$('pciMapOpen'))return;
    $('pciMapYear').value=String(year);
    $('pciMapOpen').click();
  }
  function render(){
    if(board.hidden)return;
    const name=orientation();
    const map=currentMap();
    const year=Number(yearPicker.value)||0;
    $('pciIntegratedOrientation').textContent='Orientación: '+name;
    const filterName=activeFilter==='todos'?'Matriz curricular completa':
      activeFilter==='laboratorios'?foLabels.laboratorio:
      activeFilter==='talleres'?foLabels.taller:foLabels['proyecto de vinculación'];
    $('pciIntegratedTitle').textContent=filterName;
    oldOrientation=name;

    const visibleTerms=year ? [year*2-1,year*2]:[1,2,3,4,5,6,7,8,9,10];
    head.replaceChildren();
    const hr=make('tr');
    hr.appendChild(make('th','pci-matrix-label','Espacios curriculares'));
    for(const term of visibleTerms)hr.appendChild(make('th','pci-matrix-term','C'+term));
    head.appendChild(hr);
    tableBody.replaceChildren();
    const rows=shownRows(map),yearGroups=new Set();
    for(const row of rows){
      const tr=make('tr',row.type==='fo'?'pci-matrix-fo-row':'pci-matrix-fg-row');
      tr.dataset.format=row.key;
      const label=make('th','pci-matrix-row-label',row.label);
      label.scope='row';
      if(row.type==='fo')label.appendChild(make('small','pci-matrix-row-context','Formación Orientada'));
      else label.appendChild(make('small','pci-matrix-row-context','Formación General'));
      tr.appendChild(label);
      for(const term of visibleTerms){
        const status=statusFor(row,term);
        const td=make('td',status.available?'pci-matrix-occupied':'pci-matrix-empty');
        if(status.available){
          yearGroups.add(Math.ceil(term/2));
          for(const group of status.groups){
            const action=make('button','pci-matrix-space');
            action.type='button';
            action.dataset.year=String(group.year);
            action.dataset.slot=group.slot;
            const names=(group.subjectIds || []).map(id=>namedSubject(id,map));
            const label=group.part?('Laboratorio '+group.part):'Espacio';
            action.appendChild(make('strong','',group.term===null?'Anual':label));
            action.appendChild(make('span','',names.length?names.join(' · '):'Sin materias ubicadas'));
            action.title='Abrir en el Mapa de la Oferta · '+group.year+'.º año';
            action.addEventListener('click',()=>goToOffer(group.year));
            td.appendChild(action);
          }
        }else{
          td.appendChild(make('span','pci-matrix-dash','—'));
        }
        tr.appendChild(td);
      }
      tableBody.appendChild(tr);
    }
    if(!rows.length){
      const blank=make('tr'),cell=make('td','pci-matrix-no-data','Todavía no hay espacios correspondientes a esta selección.');
      cell.colSpan=visibleTerms.length+1;blank.appendChild(cell);tableBody.appendChild(blank);
    }
    const pending=rows.some(row=>row.type==='fo'&&row.key==='por definir'&&row.groups.length);
    $('pciIntegratedStatus').textContent=(map?.valid?'Mapa validado. ':'Mapa pendiente de validar. ')+
      'Seleccioná un espacio para editar las materias en su año.'+
      (pending?' Hay formatos de 3.º o 4.º que todavía requieren una definición.':'');
  }
  function openMatrix(filter='todos',year=null){
    if(!board.hidden){
      activeFilter=filter;
      if(year!==null)yearPicker.value=String(year);
      render();
      return;
    }
    activeFilter=filter;
    previousFocus=document.activeElement;
    const small=window.innerWidth<=780;
    if(year!==null)yearPicker.value=String(year);
    else yearPicker.value=filter==='proyecto'?'5':small?(filter==='todos'?'1':'3'):'0';
    board.hidden=false;
    document.body.classList.add('pci-integrated-expanded');
    render();
    $('pciIntegratedClose')?.focus();
  }
  function closeMatrix(){
    board.hidden=true;
    document.body.classList.remove('pci-integrated-expanded');
    if(previousFocus?.isConnected)previousFocus.focus();
  }

  // Captura para anular el click heredado, que abría sólo FG (matriz antigua).
  $('overviewMatrix')?.addEventListener('click',event=>{
    // En "Ver Matriz original" conservar la navegación histórica y su editor.
    if(document.querySelector('#overview .pci-integrated-workspace.pci-classic-view'))return;
    event.preventDefault();event.stopImmediatePropagation();
    openMatrix('todos');
  },true);
  // Las tarjetas FO no abren un simple resumen, sino su matriz real por
  // cuatrimestre. Se captura antes de los handlers anteriores.
  $('pciDemoFoCards')?.addEventListener('click',event=>{
    const card=event.target.closest('button[data-pci-fo-format]');
    if(!card)return;
    event.preventDefault();event.stopImmediatePropagation();
    const format=card.dataset.pciFoFormat;
    openMatrix(format,format==='proyecto'?5:null);
  },true);

  yearPicker.addEventListener('change',render);
  $('pciIntegratedClose')?.addEventListener('click',closeMatrix);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!board.hidden&&!document.querySelector('#pci-map-overlay:not([hidden])')){
      closeMatrix();
    }
  });
  window.addEventListener('pci-matriz-offer-update',render);
  window.addEventListener('storage',event=>{
    if(event.key===V2_KEY)render();
  });
  fetch('preview-v2-real/data/materias-v2.json')
    .then(response=>{if(!response.ok)throw Error('Catálogo no disponible');return response.json();})
    .then(data=>{loadedData.catalog=data;render();})
    .catch(()=>{loadedData.catalog=null;});
  window.PCIMatrizTablero={open:openMatrix,close:closeMatrix,refresh:render};
}
