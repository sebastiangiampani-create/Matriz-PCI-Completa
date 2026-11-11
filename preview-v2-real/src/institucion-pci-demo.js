/* Configuración de colegio y varios PCI por orientación/turno.
 * SOLO DEMO: localStorage separado por PCI, sin red ni Supabase.
 * No modifica el motor original del Mapa V2.
 */
(() => {
  'use strict';
  const BASE_KEY='pci-v2-institucional-demo-20261111-v1';
  const ADMIN_KEY='pci-v2-escuelas-alta-demo-20261111-v1';
  const DEFAULT_ID='demo-school-original';
  const demoInitial={id:DEFAULT_ID,name:'Escuela Muestra (ficticia)',cue:'DEMO-001',year:2026,email:''};
  let adminSchools;
  try {adminSchools=JSON.parse(localStorage.getItem(ADMIN_KEY)||'null')}catch{}
  if(!Array.isArray(adminSchools)||!adminSchools.some(s=>s.id===DEFAULT_ID))
    adminSchools=[demoInitial];
  const requestedId=new URLSearchParams(location.search).get('escuelaDemo');
  const selectedSchool=adminSchools.find(s=>s.id===requestedId)||adminSchools[0];
  const KEY=selectedSchool.id===DEFAULT_ID?BASE_KEY:BASE_KEY+':school:'+selectedSchool.id;
  const MAP_PREFIX='pci-matriz-fg-v2-original-preview-20261009:pci:';
  const ORIENTATIONS=[
    'Ciencias Naturales','Matemática y Física','Energía y Sustentabilidad',
    'Economía y Administración','Educación Física','Comunicación','Literatura',
    'Turismo','Lenguas','Informática','Educación','Ciencias Sociales y Humanidades',
    'Arte - Artes Visuales','Arte - Música','Arte - Teatro','Agro y Ambiente'
  ];
  const SHIFTS=['Mañana','Tarde','Vespertino','Noche'];
  // Denominaciones de las 26 especialidades citadas en el documento PCI 05/10/2026.
  const TECH_SPECIALTIES=new Set(["Automotores","Computación","Construcciones","Diseño y Comunicación Publicitaria","Diseño y Producción Gráfica","Electricidad","Electromecánica","Electrónica","Administración de Empresas","Industria de los Alimentos","Industria de la Indumentaria","Industrialización de la Madera y el Mueble","Industria de la Orfebrería","Jardinería, Paisajismo y Producción Vegetal","Mecánica","Óptica","Procesos Productivos Inteligentes","Producción Multimedial","Química","Tecnologías de la Información y la Comunicación (TIC)","Refrigeración, Ventilación, Calefacción y Aire Acondicionado","Metalurgia","Órtesis y Prótesis","Diseño de Interiores","Diseño de Artesanías Aplicadas a la Industria","Geógrafo Matemático"]);
  const $=id=>document.getElementById(id);
  const copy=x=>JSON.parse(JSON.stringify(x));
  const createId=()=>crypto.randomUUID();
  const pair=(o,t)=>o+'|'+t;
  const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e;};
  const defaultState=()=>({
    version:1,school:selectedSchool.name,
    orientations:['Economía y Administración'],shifts:['Mañana'],
    combos:[{orientation:'Economía y Administración',shift:'Mañana',quantity:1}],
    pcis:[{id:createId(),orientation:'Economía y Administración',shift:'Mañana',
      number:1,createdAt:new Date().toISOString()}]
  });
  let state;
  try {state=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}
  if(!state||!Array.isArray(state.orientations)||!Array.isArray(state.shifts)||
     !Array.isArray(state.combos)||!Array.isArray(state.pcis))state=defaultState();
  // Compatibilidad: las estructuras ya guardadas de Media no se modifican.
  if(!Array.isArray(state.technicalTracks))state.technicalTracks=[];
  function persist(){
    try{localStorage.setItem(KEY,JSON.stringify(state));}
    catch(error){feedback('No se guardó la configuración local. Revisá el espacio del navegador.',true);throw error;}
  }
  persist();
  function saveAdminSchools(){
    try{localStorage.setItem(ADMIN_KEY,JSON.stringify(adminSchools))}
    catch{alert('No se pudo guardar la lista de escuelas de esta prueba en el navegador.')}
  }
  saveAdminSchools();
  function adminMessage(text,bad=false){
    const el=$('adminFeedback');
    el.textContent=text;
    el.style.color=bad?'#a93048':'#116a65';
  }
  function renderAdminSchools(){
    const host=$('demoSchools');host.replaceChildren();
    adminSchools.forEach(school=>{
      const row=node('div');row.className='adminRow';
      const details=node('div');
      const name=node('strong',school.name);
      const meta=node('small',(school.cue||'Sin código')+' · '+school.year+' · '+(school.email||'Sin correo'));
      details.append(name,meta);
      const open=node('button','Configurar sus orientaciones y PCI →');
      open.className='btn small';open.type='button';
      open.onclick=()=>{
        const link=new URL(location.href);
        link.searchParams.delete('panel');
        link.searchParams.set('escuelaDemo',school.id);
        location.assign(link.toString());
      };
      row.append(details,open);host.append(row);
    });
  }
  function showSchoolAdmin(open=true){
    $('schoolAdmin').hidden=!open;
    $('institutionSetup').hidden=open;
    if(open){
      renderAdminSchools();
      window.scrollTo(0,0);
    }
  }
  $('openAdmin').onclick=()=>showSchoolAdmin(true);
  $('closeSchoolAdmin').onclick=()=>showSchoolAdmin(false);
  $('newSchoolBtn').onclick=()=>{
    $('newSchoolForm').hidden=false;
    $('adminSchoolName').focus();
  };
  $('cancelNewSchool').onclick=()=>{$('newSchoolForm').hidden=true;};
  $('newSchoolForm').onsubmit=e=>{
    e.preventDefault();
    const name=$('adminSchoolName').value.trim();
    const cue=$('adminSchoolCue').value.trim().toUpperCase();
    const email=$('adminSchoolEmail').value.trim();
    const year=Number($('adminSchoolYear').value);
    if(name.length<3||cue.length<3||year<2020||year>2100||!Number.isInteger(year)){
      adminMessage('Completá nombre, código institucional y año.',true);
      return;
    }
    if(adminSchools.some(s=>s.cue.toUpperCase()===cue)){
      adminMessage('Ese código ya figura en la lista de esta prueba.',true);
      return;
    }
    const entry={id:'demo-'+crypto.randomUUID(),name,cue,email,year};
    adminSchools.push(entry);
    saveAdminSchools();
    renderAdminSchools();
    $('newSchoolForm').reset();
    $('adminSchoolYear').value='2026';
    $('newSchoolForm').hidden=true;
    adminMessage('Escuela de prueba agregada. Elegí «Configurar sus orientaciones y PCI» para ingresar. Ningún registro real fue modificado.');
  };
  if(new URLSearchParams(location.search).get('panel')==='alta'){
    showSchoolAdmin(true);
    $('newSchoolForm').hidden=false;
  }
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
    if(p.model==='tecnica')return state.technicalTracks.some(t=>
      t.specialtyName===p.specialtyName&&t.shift===p.shift&&p.number<=t.quantity);
    return state.combos.some(c=>c.orientation===p.orientation&&c.shift===p.shift&&p.number<=c.quantity);
  }
  function renderPcis(){
    const host=$('pciList');host.replaceChildren();
    const current=state.pcis.filter(isActive);
    const conserved=state.pcis.filter(p=>!isActive(p));
    const byName=(a,b)=>a.orientation.localeCompare(b.orientation,'es')
      ||a.shift.localeCompare(b.shift,'es')||a.number-b.number;
    function cardFor(p,enabled){
      const card=node('article');card.className='pci-card'+(enabled?'':' inactive');
      const badge=node('span',p.model==='tecnica'?
        (enabled?'Técnica · Reglas pendientes':'Técnica conservada · Inactiva'):
        (enabled?'Media · PCI habilitado':'Media · PCI conservado'));
      badge.className='badge'+(enabled?'':' off');
      const heading=node('h3',p.model==='tecnica'?('Especialidad Técnica · '+p.specialtyName):p.orientation);
      const title=node('p','Turno '+p.shift+' · PCI '+p.number);
      const desc=node('p',p.model==='tecnica'?
        'Proyecto técnico independiente. No aplica composición de Media hasta recibir las nuevas reglas.':
        enabled?'Mapa de la Oferta, secuencias y planes independientes'
        :'Conservado sin borrar sus contenidos, mapa o planes');
      const button=node('button',p.model==='tecnica'?
        'Ver ficha técnica · Reglas pendientes →':'Abrir PCI y mapa C1–C10 →');
      button.type='button';button.className='btn primary small';
      button.onclick=()=>openPci(p);
      card.append(badge,heading,title,desc,button);
      return card;
    }
    current.sort(byName).forEach(p=>host.append(cardFor(p,true)));
    if(!current.length){
      const empty=node('p','No hay PCI habilitados con esta estructura. Guardá una combinación arriba.');
      empty.className='muted';host.append(empty);
    }
    if(conserved.length){
      // Los PCI anteriores no se eliminan. Se ocultan en una sección que se
      // puede desplegar, para no confundir los activos con los conservados.
      const archive=node('details');archive.className='pci-conservados';
      const summary=node('summary',
        'Ver PCI conservados fuera de la configuración actual ('+conserved.length+')');
      const help=node('p',
        'Estos proyectos son anteriores. No se borraron, aunque cambies orientaciones o turnos.');
      help.className='muted';
      const grid=node('div');grid.className='pci-grid';
      conserved.sort(byName).forEach(p=>grid.append(cardFor(p,false)));
      archive.append(summary,help,grid);
      host.append(archive);
    }
    $('totalPcis').textContent=current.length+' PCI habilitados'
      +(conserved.length?' · '+conserved.length+' conservado'+(conserved.length===1?'':'s'):'');
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
    if(p.model==='tecnica'){
      $('pvfPanel').hidden=true;
      $('pvfJump').hidden=true;
      $('pvfFrame').src='about:blank';
      f.src='about:blank';
      f.hidden=true;
      $('technicalPendingDemo').hidden=false;
      const technicalUrl=new URL('../pci-tecnica-pautas.html',location.href);
      technicalUrl.searchParams.set('especialidad',p.specialtyName);
      $('technicalRulesPreview').src=technicalUrl.toString();
      $('techRulesDirect').href=technicalUrl.toString();
      $('technicalPendingName').textContent='Especialidad Técnica · '+p.specialtyName;
      $('technicalPendingMeta').textContent=state.school+
        ' · Turno '+p.shift+' · PCI '+p.number+
        ' · Los contenidos históricos y las claves de la escuela permanecen independientes.';
      $('workingTitle').textContent='Técnica · '+p.specialtyName;
      $('workingMeta').textContent=state.school+' · Sin aplicar reglas de Media';
      $('configScreen').hidden=true;
      $('workspaceScreen').hidden=false;
      window.scrollTo(0,0);
      return;
    }
    $('technicalPendingDemo').hidden=true;
    $('pvfPanel').hidden=false;
    $('pvfJump').hidden=false;
    f.hidden=false;
    const source=new URL('pvf-bachillerato.html',location.href);
    source.searchParams.set('orientacion',p.orientation);
    source.searchParams.set('pci',p.id);
    $('pvfFrame').src=source.toString();
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
    $('technicalPendingDemo').hidden=true;
    $('pvfPanel').hidden=true;
    $('pvfJump').hidden=true;
    $('pvfFrame').src='about:blank';
    $('frame').hidden=false;
    // Al volver se destruye la vista anterior; el estado del mapa ya fue
    // guardado por la aplicación curricular original bajo su clave propia.
    $('frame').src='about:blank';
    window.scrollTo(0,0);renderPcis();
  }
  function reset(){
    if(!confirm('¿Restablecer esta DEMO? Se perderán únicamente los datos ficticios de este navegador, no los PCI reales.'))return;
    state.pcis.filter(p=>p.model!=='tecnica').forEach(p=>localStorage.removeItem(MAP_PREFIX+p.id));
    localStorage.removeItem(KEY);
    location.reload();
  }
  function renderTechnicalTracks(){
    const host=$('technicalTracks');host.replaceChildren();
    if(!state.technicalTracks.length){
      const empty=node('p','Todavía no hay especialidades técnicas registradas en esta escuela de prueba.');
      empty.className='muted';host.append(empty);return;
    }
    for(const t of state.technicalTracks){
      const row=node('div');row.className='adminRow';
      const info=node('div');
      info.append(node('strong','Técnica · '+t.specialtyName),
        node('small','Turno '+t.shift+' · '+t.quantity+' PCI activo(s) · reglas de composición pendientes'));
      const change=node('button','Editar cantidad');change.className='btn small';change.type='button';
      change.onclick=()=>{
        if(!TECH_SPECIALTIES.has(t.specialtyName)){
          $('technicalFeedback').textContent='La especialidad de esta prueba es anterior al catálogo; se conserva, pero requiere revisión de su denominación.';
          return;
        }
        $('technicalSpecialty').value=t.specialtyName;
        $('technicalShift').value=t.shift;
        $('technicalQuantity').value=String(t.quantity);
        $('technicalSpecialty').focus();
      };
      row.append(info,change);host.append(row);
    }
  }
  function addTechnicalTrack(e){
    e.preventDefault();
    const specialtyName=$('technicalSpecialty').value.trim();
    const shift=$('technicalShift').value;
    const quantity=Number($('technicalQuantity').value);
    const note=$('technicalFeedback');
    if(!TECH_SPECIALTIES.has(specialtyName)||!SHIFTS.includes(shift)||
       !Number.isSafeInteger(quantity)||quantity<1||quantity>5){
      note.textContent='Elegí una especialidad por su nombre del catálogo, un turno y una cantidad de PCI entre 1 y 5.';
      note.style.color='#a93048';return;
    }
    const stateNext=copy(state);
    let track=stateNext.technicalTracks.find(x=>x.specialtyName.toLowerCase()===specialtyName.toLowerCase()&&x.shift===shift);
    if(track)track.quantity=quantity;
    else {
      track={specialtyName,shift,quantity,id:createId(),model:'tecnica',rules:'pending'};
      stateNext.technicalTracks.push(track);
    }
    const former=stateNext.pcis.filter(p=>p.model==='tecnica'&&
      p.specialtyName.toLowerCase()===specialtyName.toLowerCase()&&p.shift===shift);
    for(let n=former.length+1;n<=quantity;n++){
      stateNext.pcis.push({id:createId(),model:'tecnica',orientation:'Técnica',specialtyName,
        shift,number:n,createdAt:new Date().toISOString(),curriculumStatus:'pending_rules'});
    }
    state=stateNext;persist();
    renderTechnicalTracks();renderPcis();
    note.textContent='Especialidad técnica registrada sin aplicar reglas de Media. Los PCI anteriores no se borraron.';
    note.style.color='#116a65';
    $('technicalForm').reset();
  }
  $('technicalForm').onsubmit=addTechnicalTrack;
  renderTechnicalTracks();
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