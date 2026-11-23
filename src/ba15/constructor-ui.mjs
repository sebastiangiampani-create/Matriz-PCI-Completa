import {BA15_NIVELES,BA15_CCC} from './reglas-curriculares.mjs';
import {loadV2Fo,selectFoByOrientation} from '../integracion-curricular/catalogos.js';
import {loadBa15FgBase,BA15_FG_LEVELS,BA15_FG_BASE_VERSION,BA15_FG_SOURCE_VERSION,BA15_FG_LEVEL_MAP} from './priorizados-base.mjs';
import {ORIENTATIONS} from '../integracion-curricular/bridge.js';
import {phaseGate,phaseText} from '../pci-flujo-fases.mjs';
import {BA15_TERMS,crearBorradorBa15,crearEspacioBa15,asignarMateriaBa15,quitarMateriaBa15,actualizarEspacioBa15,eliminarEspacioBa15,validarBorradorBa15} from './constructor.mjs';
const element=(tag,value,klass)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=value;if(klass)x.className=klass;return x;};
const button=(label,callback,klass='btn')=>{const x=element('button',label,klass);x.type='button';x.addEventListener('click',callback);return x;};
const field=(label,value,callback,textarea=false)=>{const l=element('label');l.append(element('span',label));const x=element(textarea?'textarea':'input');x.value=value||'';x.addEventListener('change',()=>callback(x.value));l.append(x);return l;};
const select=(label,options,change)=>{const l=element('label');l.append(element('span',label));const s=element('select');for(const [v,n] of options){const op=element('option',n);op.value=v;s.append(op)}s.addEventListener('change',()=>change(s.value));l.append(s);return {wrap:l,select:s};};
const download=(draft)=>{const blob=new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='PCI-BA15-'+draft.schoolId+'-'+draft.pciId+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
export function montarConstructorBa15(host,identity,{initialDraft=null,readOnlyDemo=false,saveRemote=null,canEditRemote=false,savedRevision=0,developmentHost=null,onPhaseChange=null}={}){
 const key=['pci-ba15-borrador-local-v1',identity.schoolId,identity.pciId].join(':');
 let draft=initialDraft?structuredClone(initialDraft):crearBorradorBa15(identity),term=1,selected=null,planIndex=0,view='mapa';
 let ba15FgContents=[],foContents=[],fgBaseLoading=true,foLoading=true,fgBaseError='',foError='',dirty=false,remoteBusy=false,recoveryDraft=null;
 let remoteRevision=Number(savedRevision)||0,developmentUnlocked=false,structureDirty=false;
 let pickedSubject=null,dragSubject=null;
 const matchesIdentity=saved=>saved?.schema===draft.schema&&
  Number(saved?.schoolId)===Number(draft.schoolId)&&saved?.pciId===draft.pciId&&
  saved?.orientationId===draft.orientationId&&saved?.shiftId===draft.shiftId;
 try{
  const previous=JSON.parse(sessionStorage.getItem(key+'.recovery')||'null');
  if(matchesIdentity(previous))recoveryDraft=previous;
  const saved=readOnlyDemo?null:JSON.parse(sessionStorage.getItem(key)||'null');
  if(matchesIdentity(saved)){
   if(initialDraft&&JSON.stringify(saved)!==JSON.stringify(initialDraft)){
    if(confirm('Hay un borrador BA +15 local distinto del servidor. ¿Recuperarlo para revisar y guardar sin perder lo trabajado?')){
     draft=saved;dirty=true;structureDirty=true;
    }else{
     recoveryDraft=saved;
     try{sessionStorage.setItem(key+'.recovery',JSON.stringify(saved));}catch{}
    }
   }else if(!initialDraft){
    draft=saved;dirty=true;structureDirty=true;
   }
  }
 }catch{}
 // Los PCI BA +15 existentes también consultan la base reindexada.
 // Se actualiza solo la copia en memoria; abrir un PCI no escribe en Supabase.
 draft.priorizadosFGBase={
  version:BA15_FG_BASE_VERSION,source:BA15_FG_SOURCE_VERSION,
  yearToBa15Level:{...BA15_FG_LEVEL_MAP},
  levels:BA15_FG_LEVELS.map(x=>({level:x.level,sourceYears:[...x.sourceYears]}))
 };
 const status=element('p',readOnlyDemo?'Escuela ficticia de demostración · los cambios permanecen únicamente en esta pestaña.':
  recoveryDraft?'Hay un borrador anterior reservado. Descargalo antes de reemplazarlo.':
  dirty?'Borrador local recuperado. Verificá y guardá online sin reemplazar otro PCI.':
  'Borrador BA +15 independiente. Exportá una copia JSON como resguardo.','muted');
 const save=()=>{if(readOnlyDemo){status.textContent='Demostración: cambios solo en memoria, sin conexión con datos institucionales.';return;}dirty=true;try{sessionStorage.setItem(key,JSON.stringify(draft));status.textContent='Cambios solo en esta pestaña. Usá «Guardar BA +15 online» para confirmarlos en el servidor.';}catch{status.textContent='No se pudo guardar localmente. Exportá el JSON antes de salir.';}};
 const persistRemote=async()=>{if(!saveRemote||!canEditRemote||!dirty||remoteBusy||readOnlyDemo)return;remoteBusy=true;status.textContent='Verificando revisión y guardando BA +15…';const payload=structuredClone(draft);try{const revision=await saveRemote(payload);remoteRevision=Number(revision)||remoteRevision;const unchanged=JSON.stringify(payload)===JSON.stringify(draft);dirty=!unchanged;if(unchanged){structureDirty=false;try{sessionStorage.removeItem(key);}catch{}status.textContent='BA +15 guardado online: revisión confirmada por lectura posterior.';}else{status.textContent='Se guardó una revisión anterior. Hay cambios posteriores sin guardar: conservá el borrador y volvé a guardar.';}}catch(error){status.textContent='NO se guardó online: '+(error?.message||error)+'. Conservá el JSON de resguardo.';}finally{remoteBusy=false;render();}};
 function change(fn,phase='constructor'){
  try{
    draft=fn();
    if(phase==='constructor'){structureDirty=true;developmentUnlocked=false;view='mapa';}
    save();render();
  }catch(e){status.textContent='No se modificó: '+e.message;}
 }

 const canCompose=()=>readOnlyDemo||canEditRemote;
 function subjectLevel(id){
  const result=String(id||'').match(/^n([1-4])s\d+$/);
  return result?Number(result[1]):null;
 }
 function dropSubject(id,targetLevel,targetSpaceId){
  if(!canCompose()){status.textContent='El PCI está en modo lectura.';return;}
  if(subjectLevel(id)!==targetLevel){
   status.textContent='Acción no permitida: las materias BA +15 no se mueven entre niveles.';return;
  }
  change(()=>asignarMateriaBa15(draft,{nivel:targetLevel,espacioId:targetSpaceId,materiaId:id}));
  pickedSubject=null;dragSubject=null;
 }
 function createFromDrop(id,targetTerm,format,rowSpec=null){
  if(!canCompose()){status.textContent='El PCI está en modo lectura.';return;}
  const levelNum=Math.floor((Number(targetTerm)-1)/2)+1;
  if(subjectLevel(id)!==levelNum){
   status.textContent='Acción no permitida: la materia debe permanecer en su nivel.';return;
  }
  const subject=draft.niveles[levelNum-1].asignaturas.find(x=>x.id===id);
  if(!subject)return;
  if(rowSpec?.name&&subject.nombre!==rowSpec.name){
   status.textContent='Esta fila anual corresponde a '+rowSpec.name+'.';
   return;
  }
  if(rowSpec?.area&&subject.area!==rowSpec.area){
   status.textContent='Esta materia corresponde a '+subject.area+', no a '+rowSpec.label+'.';
   return;
  }
  change(()=>{
   const created=crearEspacioBa15(draft,{nivel:levelNum,term:Number(targetTerm),
    nombre:subject.nombre,formato:format});
   const space=created.niveles[levelNum-1].espacios.at(-1);
   const assigned=asignarMateriaBa15(created,{nivel:levelNum,espacioId:space.id,materiaId:id});
   term=Number(targetTerm);selected=space.id;return assigned;
  });
  pickedSubject=null;dragSubject=null;
 }
 function makeDropTarget(node,assign){
  if(!canCompose())return;
  node.classList.add('drop-zone');
  node.addEventListener('dragover',event=>{
   const id=event.dataTransfer?.types?.includes('text/plain')?dragSubject||pickedSubject:null;
   if(!id)return;
   event.preventDefault();
   if(event.dataTransfer)event.dataTransfer.dropEffect='move';
   node.classList.add('drop-over');
  });
  node.addEventListener('dragleave',()=>node.classList.remove('drop-over'));
  node.addEventListener('drop',event=>{
   event.preventDefault();event.stopPropagation();
   node.classList.remove('drop-over');
   const id=event.dataTransfer?.getData('text/plain')||dragSubject||pickedSubject;
   if(id)assign(id);
  });
 }
 function setPhase(next,{silent=false}={}){
  if(next!=='oferta'&&next!=='desarrollo'&&next!=='fo')return false;
  if(next!=='oferta'&&!getPhaseStatus().ready)return false;
  view=next==='oferta'?'mapa':'planes';selected=null;planIndex=0;render();
  if(!silent&&typeof onPhaseChange==='function')
   onPhaseChange(next==='oferta'?'oferta':'desarrollo');
  return true;
 }
 function getPhaseStatus(){
  const check=validarBorradorBa15(draft);
  return phaseGate({revision:remoteRevision,dirty:structureDirty,
    issues:[...check.errores,...check.advertencias],label:'BA +15 C1–C8'});
 }
 function render(){
  host.replaceChildren();
  if(developmentHost)developmentHost.replaceChildren();
  const showingDevelopment=view==='planes'&&!!developmentHost;
  host.hidden=showingDevelopment;
  if(developmentHost)developmentHost.hidden=!showingDevelopment;
  const surface=showingDevelopment?developmentHost:host;
  const tools=element('div','','actions');
  const validation=validarBorradorBa15(draft),gate=getPhaseStatus();
  const builder=button('1 · Constructor C1–C8',()=>setPhase('oferta'),view==='mapa'?'btn primary':'btn');
  const develop=button('2 · Desarrollo curricular',()=>{
    const check=getPhaseStatus();
    if(!check.ready){status.textContent='Primero completá y guardá el mapa BA +15. '+check.detail;view='mapa';render();return;}
    developmentUnlocked=true;setPhase('desarrollo');
  },view==='planes'?'btn primary':'btn');
  develop.disabled=!gate.ready;
  develop.title=gate.ready?'Abrir planes heredados de este PCI':'Completá todas las materias de C1–C8 y guardá el mapa antes de desarrollar.';
  tools.append(builder,develop,
    button('Validación de Fase 1',()=>{view='control';render()},view==='control'?'btn primary':'btn'),
    button('Exportar borrador JSON',()=>download(draft)));
  if(saveRemote&&canEditRemote&&!readOnlyDemo){const online=button(remoteBusy?'Guardando…':'Guardar BA +15 online',persistRemote,'btn primary');online.disabled=!dirty||remoteBusy;tools.append(online);}
  if(recoveryDraft&&!readOnlyDemo)tools.append(button('Descargar borrador anterior protegido',()=>download(recoveryDraft)));
  surface.append(tools,status,element('p',phaseText(gate),'pci-phase-state'+(gate.ready?' ready':'')));
  if(view==='planes'){
    const levelNo=Math.floor((term-1)/2)+1;
    const sourceLevel=BA15_FG_LEVELS[levelNo-1];
    const levelContentCount=ba15FgContents.filter(x=>Number(x.ba15Level)===levelNo).length;
    surface.append(element('p','Nivel '+['I','II','III','IV'][levelNo-1]+
     ' · base FG propia BA +15 · priorizados de '+sourceLevel.sourceLabel+
     (fgBaseLoading?' · cargando contenidos…':' · '+levelContentCount+' contenidos priorizados')+
     ' · Formación Orientada según orientación. Se conservan los IDs y contenidos de origen.',
     'muted'));
  }
  if(view==='control'){
   const total=draft.niveles.reduce((n,l)=>n+l.espacios.length,0);
   const panel=element('div','','workCard');panel.append(element('h3','Control de construcción curricular'),element('p',total+' espacios creados · '+draft.niveles.length+' niveles · 8 cuatrimestres.'));
   const issues=[...validation.errores.map(x=>'ERROR: '+x),...validation.advertencias.map(x=>'REVISAR: '+x)];
   panel.append(element('p',validation.valido?'Cobertura y articulaciones documentadas en la propuesta de prueba.':'Pendientes de revisión: '+issues.length));
   const ul=element('ul');for(const m of issues){ul.append(element('li',m));}panel.append(ul);surface.append(panel);return;
  }
  if(view==='mapa'){
   // Mismo criterio estructural del mapa V2: áreas reconocibles, niveles
   // agrupados por pares de cuatrimestres y una sola celda por troncal anual.
   const matrix=element('div','','mapScroll'),tbl=element('table','','mapTable');
   const head=element('thead'),levels=element('tr'),quarters=element('tr');
   const corner=element('th','Área / formato');corner.rowSpan=2;levels.append(corner);
   for(let n=1;n<=4;n++){
    const h=element('th','Nivel '+n);h.colSpan=2;levels.append(h);
   }
   for(const t of BA15_TERMS)quarters.append(element('th','C'+t.numero));
   head.append(levels,quarters);tbl.append(head);
   const body=element('tbody');
   const mapRows=[
    {label:'Matemática',format:'troncal',name:'Matemática',annual:true},
    {label:'Lengua y Literatura',format:'troncal',name:'Lengua y Literatura',annual:true},
    {label:'Lengua Adicional',format:'troncal',name:'Lengua Adicional (Inglés)',annual:true},
    {label:'Laboratorios FG · Naturales',format:'laboratorio',area:'Ciencias Naturales'},
    {label:'Laboratorios FG · Sociales',format:'laboratorio',area:'Ciencias Sociales'},
    {label:'Talleres FG · articulados',format:'taller'},
    {label:'Formación Orientada',format:'orientado'},
    {label:'Otros formatos / acompañamiento',format:'otro'}
   ];
   const subjectAreaFor=(level,e)=>{
    const member=level.asignaturas.find(s=>e.miembros?.includes(s.id));
    if(member)return member.area;
    const name=String(e.nombre||'').toLocaleLowerCase('es');
    if(/biolog|físic|químic|natural/.test(name))return 'Ciencias Naturales';
    if(/historia|geograf|econom|filosof|social|ciudadan/.test(name))return 'Ciencias Sociales';
    return '';
   };
   for(const rowSpec of mapRows){
    const row=element('tr');row.append(element('th',rowSpec.label));
    for(const t of BA15_TERMS){
     if(rowSpec.annual&&t.numero%2===0)continue;
     const td=element('td');
     const level=draft.niveles[t.nivel-1];
     const spaces=level.espacios.filter(e=>{
      if(e.formato!==rowSpec.format)return false;
      if(rowSpec.name){
       const subject=level.asignaturas.find(s=>e.miembros?.includes(s.id));
       return (subject?.nombre||e.nombre)===rowSpec.name;
      }
      return !rowSpec.area||subjectAreaFor(level,e)===rowSpec.area;
     }).filter(e=>rowSpec.annual?
       (e.term===t.numero||e.term===t.numero+1):
       e.term===t.numero);
     if(rowSpec.annual){
      td.colSpan=2;
      td.dataset.pciAnnual='true';
      td.setAttribute('aria-label',rowSpec.label+' · Nivel '+t.nivel+' · C'+t.numero+'–C'+(t.numero+1));
     }
     for(const e of spaces){
      const destination=button(e.nombre,()=>{
       if(pickedSubject)dropSubject(pickedSubject,t.nivel,e.id);
       else {term=t.numero;selected=e.id;render();}
      },'slot');
      destination.title='Materia del nivel '+t.nivel+' · '+(rowSpec.annual?'anual':'cuatrimestral');
      makeDropTarget(destination,id=>dropSubject(id,t.nivel,e.id));
      td.append(destination);
     }
     if(!spaces.length){
      const destination=button('＋',()=>{
       if(pickedSubject)createFromDrop(pickedSubject,t.numero,rowSpec.format,rowSpec);
       else {term=t.numero;selected=null;render();}
      },'ba15EmptySlot');
      destination.title='Arrastrá una materia del nivel '+t.nivel+' a '+rowSpec.label;
      makeDropTarget(destination,id=>createFromDrop(id,t.numero,rowSpec.format,rowSpec));
      td.append(destination);
     }
     row.append(td);
    }
    body.append(row);
   }
   tbl.append(body);matrix.append(tbl);surface.append(matrix);
  }
  const nav=element('div','','demoTermNav');
  for(const t of BA15_TERMS)nav.append(button('C'+t.numero+' · Nivel '+['I','II','III','IV'][t.nivel-1],()=>{term=t.numero;selected=null;planIndex=0;render()},'tab'+(t.numero===term?' active':'')));
  surface.append(nav);
  const levelNum=Math.floor((term-1)/2)+1,level=draft.niveles[levelNum-1];
  const summary=element('p','Nivel '+['I','II','III','IV'][levelNum-1]+' · C'+term+' · '+level.asignaturas.reduce((a,s)=>a+s.horas,0)+' horas semanales oficiales del nivel · '+level.espacios.filter(e=>e.term===term).length+' espacios del cuatrimestre','muted');surface.append(summary);
  const layout=element('div','','ba15BuilderGrid');
  const aside=element('section','','workCard'),main=element('section','','workCard');
  if(view==='mapa'){
   aside.append(element('h3','Bolsa de materias · Nivel '+['I','II','III','IV'][levelNum-1]));
   aside.append(element('p','Arrastrá una materia al mapa de la oferta, o seleccionala para ubicarla tocando una celda.','muted'));
   const assigned=new Set(level.espacios.filter(e=>e.term===term).flatMap(e=>e.miembros));
   for(const s of level.asignaturas){
    const row=element('div','','ba15Subject'+(pickedSubject===s.id?' active':''));
    row.draggable=canCompose();row.tabIndex=0;row.setAttribute('role','button');
    row.setAttribute('aria-label','Seleccionar materia '+s.nombre);
    row.addEventListener('click',()=>{pickedSubject=s.id;render()});
    row.addEventListener('keydown',event=>{
     if(event.key==='Enter'||event.key===' '){event.preventDefault();pickedSubject=s.id;render();}
    });
    row.addEventListener('dragstart',event=>{
     dragSubject=s.id;
     event.dataTransfer?.setData('text/plain',s.id);
     if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
    });
    row.addEventListener('dragend',()=>{dragSubject=null});
    row.append(element('strong',s.nombre),
     element('small',s.area+' · '+s.horas+' h · '+(assigned.has(s.id)?'Asignada en C'+term:'Pendiente en C'+term)));
    if(selected&&!assigned.has(s.id)&&canCompose()){
     const assign=button('Asignar al espacio seleccionado',event=>{
      event.stopPropagation();dropSubject(s.id,levelNum,selected);
     },'btn');
     row.append(assign);
    }
    aside.append(row);
   }
  }else{
   aside.append(element('h3','Espacios del mapa · Nivel '+['I','II','III','IV'][levelNum-1]));
   aside.append(element('p','Desarrollá los planes de los espacios ya construidos. La composición se modifica solamente en Fase 1.','muted'));
   for(const e of level.espacios.filter(x=>x.term===term))
    aside.append(button(e.nombre,()=>{selected=e.id;planIndex=0;render()},
     'areaItem'+(selected===e.id?' active':'')));
  }
  if(view==='mapa'){
  const form=element('div','','formCard');
  form.append(element('h3','Crear agrupamiento en C'+term));
  const name=field('Nombre del espacio','',()=>{});const format=select('Formato',[['laboratorio','Laboratorio'],['taller','Taller'],['troncal','Troncal'],['orientado','Formación Orientada'],['otro','Otro formato']],()=>{});
  form.append(name,format.wrap);
  form.append(button('Crear espacio',()=>change(()=>{
   const title=name.querySelector('input').value;
   const updated=crearEspacioBa15(draft,{nivel:levelNum,term,nombre:title,formato:format.select.value});
   selected=updated.niveles[levelNum-1].espacios.at(-1).id;return updated;
  }),'btn primary'));main.append(form);
  }
  for(const e of level.espacios.filter(e=>e.term===term)){
   const card=element('article','','ba15Space');
   card.append(button((selected===e.id?'▼ ':'▶ ')+e.nombre+' · '+e.formato,()=>{selected=selected===e.id?null:e.id;render()},'pciItem'+(selected===e.id?' active':'')));
   if(selected===e.id){
    const members=element('div','','ba15Members');
    for(const member of e.miembros){
     const subject=level.asignaturas.find(s=>s.id===member);
     const wrap=element('div','','ba15Member');
     wrap.append(element('span',subject?.nombre||member));
     if(view==='mapa'&&canCompose())wrap.append(button('Quitar',()=>change(()=>quitarMateriaBa15(draft,{nivel:levelNum,espacioId:e.id,materiaId:member})),'btn'));
     members.append(wrap);
    }
    if(!members.childNodes.length)members.append(element('p','Sin materias asignadas. Elegí alguna en la bolsa.','muted'));
    card.append(members);
    if(view==='mapa')card.append(field('Articulación pedagógica y espacios vinculados',e.articulacion,value=>change(()=>actualizarEspacioBa15(draft,{nivel:levelNum,espacioId:e.id,changes:{articulacion:value}})),true));
    if(view==='planes'){
     const tabs=element('div','','actions');
     for(let i=0;i<4;i++)tabs.append(button('Plan '+(i+1),()=>{planIndex=i;render()},'tab'+(i===planIndex?' active':'')));
     card.append(tabs);
     const p=e.planes[planIndex];
     const update=(fn)=>change(()=>{
      const fresh=structuredClone(draft),target=fresh.niveles[levelNum-1].espacios.find(x=>x.id===e.id).planes[planIndex];
      fn(target);return fresh;
     },'desarrollo');
     card.append(field('Nombre del plan',p.nombre,v=>update(t=>{t.nombre=v;})));
     card.append(field('Sinopsis / descripción del plan',p.sinopsis||'',
       v=>update(t=>{t.sinopsis=v;}),true));
     card.append(field('Objetivos',p.objetivos,v=>update(t=>{t.objetivos=v;}),true));
     card.append(field('Contexto problematizador',p.contexto||'',
       v=>update(t=>{t.contexto=v;}),true));
     card.append(field('Producto / práctica de aprendizaje',p.producto||'',
       v=>update(t=>{t.producto=v;}),true));
     const isFo=e.formato==='orientado';
     const available=isFo?foContents:ba15FgContents.filter(x=>Number(x.ba15Level)===levelNum);
     const loading=isFo?foLoading:fgBaseLoading,problem=isFo?foError:fgBaseError;
     if(!loading&&!problem){
      const contentBox=element('section','','formCard');
      contentBox.append(element('h4',isFo?'Contenidos de Formación Orientada':'Contenidos FG · Nivel '+levelNum));
      contentBox.append(element('p','Elegí contenidos vinculados al espacio y su nivel. La procedencia curricular no modifica los cuatrimestres BA +15.','muted'));
      const chosen=Array.isArray(p.contenidos)?p.contenidos:[];
      for(const id of chosen){
       const item=available.find(x=>x.id===id);
       const line=element('div','','ba15Member');
       line.append(element('span',item?(isFo?'FO · ':'NES '+item.sourceYear+'.º · ')+(item.subject||item.block||'')+' · '+item.text:'Contenido '+id+' (revisar correspondencia)'));
       line.append(button('Quitar',()=>update(t=>{t.contenidos=(t.contenidos||[]).filter(x=>x!==id);}),'btn'));
       contentBox.append(line);
      }
      const query=element('input');query.type='search';query.placeholder='Buscar por materia, bloque, eje o contenido…';query.setAttribute('aria-label','Buscar contenidos curriculares BA +15');
      const results=element('div','','ba15ContentResults');
      const showMatches=()=>{
       results.replaceChildren();
       const search=query.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
       if(search.length<2){results.append(element('p','Escribí al menos dos caracteres para buscar.','muted'));return;}
       const matches=available.filter(x=>!chosen.includes(x.id)&&[x.subject,x.area,x.block,x.axis,x.subaxis,x.text].some(v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(search))).slice(0,35);
       for(const item of matches){
        const line=element('div','','ba15Subject');
        line.append(element('small',isFo?'FO · '+(item.block||''): 'NES '+item.sourceYear+'.º · '+item.subject+' · '+item.axis));
        line.append(element('span',item.text));
        line.append(button('Agregar al plan',()=>update(t=>{t.contenidos=Array.isArray(t.contenidos)?t.contenidos:[];if(!t.contenidos.includes(item.id))t.contenidos.push(item.id);}),'btn'));
        results.append(line);
       }
       if(!matches.length)results.append(element('p','Sin coincidencias. Revisá la búsqueda.','muted'));
      };
      query.addEventListener('input',showMatches);contentBox.append(query,results);showMatches();card.append(contentBox);
     }
     if(loading||problem)card.append(element('p',problem?
       'Catálogo pendiente de revisión: '+problem:
       'Cargando contenidos curriculares oficiales…','muted'));
     card.append(field('Contenidos propios / adecuaciones',p.contenidosPropios||'',
       v=>update(t=>{t.contenidosPropios=v;}),true));
     card.append(element('p',e.planes.length+' planes · '+
        new Set(e.planes.flatMap(plan=>Array.isArray(plan.contenidos)?plan.contenidos:[])).size+
        ' contenidos únicos vinculados · cobertura oficial por verificar','pci-development-plan-count'));
      for(const [key,label] of [['punto_partida','Punto de partida'],['indagacion','Indagación'],['produccion','Producción'],['evaluacion','Evaluación']]){
       const previous=p.etapas?.[key],value=typeof previous==='string'?previous:previous?.description||'';
       card.append(field(label,value,v=>update(t=>{
        t.etapas=t.etapas||{};
        const old=t.etapas[key];
        t.etapas[key]=old&&typeof old==='object'?{...old,description:v}:v;
       }),true));
      }
    }
    if(view==='mapa'&&canCompose())card.append(button('Eliminar agrupamiento',()=>{if(confirm('¿Eliminar este espacio del borrador local?'))change(()=>{selected=null;return eliminarEspacioBa15(draft,{nivel:levelNum,espacioId:e.id});});},'btn'));
   }
   main.append(card);
  }
  layout.append(aside,main);surface.append(layout);
 }
 render();
 loadBa15FgBase().then(rows=>{ba15FgContents=rows;fgBaseLoading=false;render();})
  .catch(err=>{fgBaseLoading=false;fgBaseError=err.message||String(err);render();});
 loadV2Fo().then(rows=>{
   foContents=selectFoByOrientation(rows,identity.orientationId,ORIENTATIONS);
   foLoading=false;render();
 }).catch(err=>{foLoading=false;foError=err.message||String(err);render();});
 return {
  destroy(){host.replaceChildren();host.hidden=false;
   if(developmentHost){developmentHost.replaceChildren();developmentHost.hidden=true;}},
  getDraft(){return structuredClone(draft);},isDirty(){return dirty;},
  setPhase,phaseStatus:getPhaseStatus
 };
}
