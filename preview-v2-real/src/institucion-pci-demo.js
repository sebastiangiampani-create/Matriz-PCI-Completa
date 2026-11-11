/* Configuración de colegio y varios PCI por orientación/turno.
 * SOLO DEMO: localStorage separado por PCI, sin red ni Supabase.
 * No modifica el motor original del Mapa V2.
 */
(() => {
  'use strict';
  const KEY='pci-v2-institucional-demo-20261111-v1';
  const MAP_PREFIX='pci-matriz-fg-v2-original-preview-20261009:pci:';
  const ORIENTATIONS=[
    'Ciencias Naturales','Matemática y Física','Energía y Sustentabilidad',
    'Economía y Administración','Educación Física','Comunicación','Literatura',
    'Turismo','Lenguas','Informática','Educación','Ciencias Sociales y Humanidades',
    'Arte - Artes Visuales','Arte - Música','Arte - Teatro','Agro y Ambiente'
  ];
  const SHIFTS=['Mañana','Tarde','Vespertino','Noche'];
  const $=id=>document.getElementById(id);
  const copy=x=>JSON.parse(JSON.stringify(x));
  const createId=()=>crypto.randomUUID();
  const pair=(o,t)=>o+'|'+t;
  const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e;};
  const defaultState=()=>({
    version:1,school:'Escuela Muestra (ficticia)',
    orientations:['Economía y Administración'],shifts:['Mañana'],
    combos:[{orientation:'Economía y Administración',shift:'Mañana',quantity:1}],
    pcis:[{id:createId(),orientation:'Economía y Administración',shift:'Mañana',
      number:1,createdAt:new Date().toISOString()}]
  });
  let state;
  try {state=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}
  if(!state||!Array.isArray(state.orientations)||!Array.isArray(state.shifts)||
     !Array.isArray(state.combos)||!Array.isArray(state.pcis))state=defaultState();
  function persist(){
    try{localStorage.setItem(KEY,JSON.stringify(state));}
    catch(error){feedback('No se guardó la configuración local. Revisá el espacio del navegador.',true);throw error;}
  }
  persist();
  let draft={
    orientations:copy(state.orientations),
    shifts:copy(state.shifts),
    combos:Object.fromEntries(state.combos.map(c=>[pair(c.orientation,c.shift),{enabled:true,quantity:c.quantity}]))
  };
  function feedback(text,bad=false){
    $('feedback').textContent=text;
    $('feedback').style.color=bad?'#a93048':'#116a65';
  }
  function countOptions(select,max,current){
    select.replaceChildren();
    for(let n=1;n<=max;n++){const o=node('option',n);o.value=String(n);select.appendChild(o);}
    select.value=String(current);
  }
  function grow(values,n,catalog){
    const a=values.slice(0,n);
    for(const name of catalog){
      if(a.length>=n)break;
      if(!a.includes(name))a.push(name);
    }
    return a;
  }
  function createSelector(container,values,catalog,fn){
    container.replaceChildren();
    values.forEach((value,i)=>{
      const row=node('div');row.className='field-row';
      row.append(node('span',String(i+1)+'.'));
      const select=node('select');select.setAttribute('aria-label','Opción '+(i+1));
      catalog.forEach(name=>{
        const opt=node('option',name);opt.value=name;select.appendChild(opt);
      });
      select.value=value;
      select.onchange=()=>fn(i,select.value);
      row.append(select);container.append(row);
    });
  }
  function renderCombinations(){
    const host=$('combos');host.replaceChildren();
    const table=node('table');
    const thead=node('thead'),header=node('tr');
    header.append(node('th','Orientación / Turnos'));
    draft.shifts.forEach(shift=>header.append(node('th',shift)));
    thead.append(header);table.append(thead);
    const tbody=node('tbody');
    draft.orientations.forEach(o=>{
      const tr=node('tr');tr.append(node('th',o));
      draft.shifts.forEach(t=>{
        const key=pair(o,t);
        const config=draft.combos[key]||{enabled:true,quantity:1};
        draft.combos[key]=config;
        const td=node('td'),wrap=node('label');wrap.className='comboCell';
        wrap.style.margin='0';
        const check=node('input');check.type='checkbox';check.checked=!!config.enabled;
        check.setAttribute('aria-label',o+' · '+t+' habilitado');
        const number=node('input');number.type='number';number.min='1';number.max='5';number.value=String(config.quantity);
        number.disabled=!check.checked;number.setAttribute('aria-label','Cantidad de PCI '+o+' · '+t);
        number.oninput=()=>{config.quantity=Math.max(1,Math.min(5,Number(number.value)||1));renderSummary()};
        check.onchange=()=>{config.enabled=check.checked;number.disabled=!check.checked;renderSummary()};
        wrap.append(check,node('span','PCI'),number);td.append(wrap);tr.append(td);
      });
      tbody.append(tr);
    });
    table.append(tbody);host.append(table);
    renderSummary();
  }
  function renderSummary(){
    const rows=draft.orientations.flatMap(o=>draft.shifts.map(t=>draft.combos[pair(o,t)]||{enabled:true,quantity:1}));
    const count=rows.filter(x=>x.enabled).reduce((n,x)=>n+Math.max(1,Number(x.quantity)||1),0);
    $('summary').textContent=count+' PCI previstos en '+rows.filter(x=>x.enabled).length+' combinaciones activas.';
  }
  function renderFields(){
    $('orientationCount').value=String(draft.orientations.length);
    $('shiftCount').value=String(draft.shifts.length);
    createSelector($('orientationFields'),draft.orientations,ORIENTATIONS,(i,value)=>{
      draft.orientations[i]=value;renderFields();
    });
    createSelector($('shiftFields'),draft.shifts,SHIFTS,(i,value)=>{
      draft.shifts[i]=value;renderFields();
    });
    renderCombinations();
  }
  function isActive(p){
    return state.combos.some(c=>c.orientation===p.orientation&&c.shift===p.shift);
  }
  function renderPcis(){
    const host=$('pciList');host.replaceChildren();
    const ordered=state.pcis.slice().sort((a,b)=>{
      const active=Number(isActive(b))-Number(isActive(a));
      return active||a.orientation.localeCompare(b.orientation,'es')||a.shift.localeCompare(b.shift,'es')||a.number-b.number;
    });
    ordered.forEach(p=>{
      const card=node('article');card.className='pci-card'+(isActive(p)?'':' inactive');
      const badge=node('span',isActive(p)?'PCI habilitado':'PCI conservado · Fuera de configuración actual');
      badge.className='badge'+(isActive(p)?'':' off');
      const heading=node('h3',p.orientation);
      const title=node('p','Turno '+p.shift+' · PCI '+p.number);
      const desc=node('p','Mapa de la Oferta, secuencias y planes independientes');
      const button=node('button','Abrir PCI y mapa C1–C10 →');
      button.type='button';button.className='btn primary small';
      button.onclick=()=>openPci(p);
      card.append(badge,heading,title,desc,button);
      host.append(card);
    });
    $('totalPcis').textContent=state.pcis.length+' PCI creados';
  }
  function apply(){
    const school=$('school').value.trim();
    if(school.length<3){feedback('Escribí el nombre de la escuela.',true);return;}
    if(new Set(draft.orientations).size!==draft.orientations.length){
      feedback('Una orientación está seleccionada más de una vez.',true);return;
    }
    if(new Set(draft.shifts).size!==draft.shifts.length){
      feedback('Un turno está seleccionado más de una vez.',true);return;
    }
    const enabled=[];
    for(const o of draft.orientations){
      for(const t of draft.shifts){
        const c=draft.combos[pair(o,t)]||{enabled:true,quantity:1};
        if(c.enabled)enabled.push({orientation:o,shift:t,quantity:Math.max(1,Math.min(5,Number(c.quantity)||1))});
      }
    }
    if(!enabled.length){feedback('Habilitá por lo menos una combinación de orientación y turno.',true);return;}
    // Eliminar una combinación de la configuración NO elimina nunca sus PCI.
    const next=copy(state);
    next.school=school;
    next.orientations=copy(draft.orientations);
    next.shifts=copy(draft.shifts);
    next.combos=enabled;
    let created=0;
    for(const c of enabled){
      const previous=next.pcis.filter(p=>p.orientation===c.orientation&&p.shift===c.shift);
      for(let n=previous.length+1;n<=c.quantity;n++){
        next.pcis.push({id:createId(),orientation:c.orientation,shift:c.shift,
          number:n,createdAt:new Date().toISOString()});
        created++;
      }
    }
    state=next;persist();renderPcis();
    feedback('Configuración guardada. '+created+' PCI nuevo(s). Los PCI anteriores permanecen intactos.');
  }
  function openPci(p){
    const f=$('frame');
    const url=new URL('app.html',location.href);
    url.searchParams.set('pci',p.id);
    url.searchParams.set('orientation',p.orientation);
    url.searchParams.set('turno',p.shift);
    url.searchParams.set('school',state.school);
    // El mapa auténtico utiliza un STORAGE distinto para cada PCI.
    f.src=url.toString();
    $('workingTitle').textContent=p.orientation+' · Turno '+p.shift+' · PCI '+p.number;
    $('workingMeta').textContent=state.school+' · Proyecto independiente';
    $('configScreen').hidden=true;$('workspaceScreen').hidden=false;
    window.scrollTo(0,0);
  }
  function back(){
    $('workspaceScreen').hidden=true;
    $('configScreen').hidden=false;
    // Al volver se destruye la vista anterior; el estado del mapa ya fue
    // guardado por la aplicación curricular original bajo su clave propia.
    $('frame').src='about:blank';
    window.scrollTo(0,0);renderPcis();
  }
  function reset(){
    if(!confirm('¿Restablecer esta DEMO? Se perderán únicamente los datos ficticios de este navegador, no los PCI reales.'))return;
    state.pcis.forEach(p=>localStorage.removeItem(MAP_PREFIX+p.id));
    localStorage.removeItem(KEY);
    location.reload();
  }
  countOptions($('orientationCount'),ORIENTATIONS.length,draft.orientations.length);
  countOptions($('shiftCount'),SHIFTS.length,draft.shifts.length);
  $('school').value=state.school;
  $('orientationCount').onchange=()=>{
    draft.orientations=grow(draft.orientations,Number($('orientationCount').value),ORIENTATIONS);
    renderFields();
  };
  $('shiftCount').onchange=()=>{
    draft.shifts=grow(draft.shifts,Number($('shiftCount').value),SHIFTS);
    renderFields();
  };
  $('saveConfig').onclick=apply;
  $('back').onclick=back;
  $('reset').onclick=reset;
  renderFields();
  renderPcis();
  window.__PCIDEMO__={getState:()=>copy(state),getMapKey:id=>MAP_PREFIX+id};
})();