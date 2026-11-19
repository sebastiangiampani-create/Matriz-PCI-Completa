import {BA15_NIVELES,BA15_CCC} from './reglas-curriculares.mjs';
import {loadV2Fg} from '../integracion-curricular/catalogos.js';
import {BA15_TERMS,crearBorradorBa15,crearEspacioBa15,asignarMateriaBa15,quitarMateriaBa15,actualizarEspacioBa15,eliminarEspacioBa15,validarBorradorBa15} from './constructor.mjs';
const element=(tag,value,klass)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=value;if(klass)x.className=klass;return x;};
const button=(label,callback,klass='btn')=>{const x=element('button',label,klass);x.type='button';x.addEventListener('click',callback);return x;};
const field=(label,value,callback,textarea=false)=>{const l=element('label');l.append(element('span',label));const x=element(textarea?'textarea':'input');x.value=value||'';x.addEventListener('change',()=>callback(x.value));l.append(x);return l;};
const select=(label,options,change)=>{const l=element('label');l.append(element('span',label));const s=element('select');for(const [v,n] of options){const op=element('option',n);op.value=v;s.append(op)}s.addEventListener('change',()=>change(s.value));l.append(s);return {wrap:l,select:s};};
const download=(draft)=>{const blob=new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='PCI-BA15-'+draft.schoolId+'-'+draft.pciId+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
export function montarConstructorBa15(host,identity){
 const key=['pci-ba15-borrador-local-v1',identity.schoolId,identity.pciId].join(':');
 let draft=crearBorradorBa15(identity),term=1,selected=null,planIndex=0,view='mapa';
 let nesContents=[],nesLoading=true,nesError='';
 try{
  const saved=JSON.parse(sessionStorage.getItem(key)||'null');
  if(saved?.schema===draft.schema&&saved?.schoolId===draft.schoolId&&saved?.pciId===draft.pciId&&saved?.orientationId===draft.orientationId&&saved?.shiftId===draft.shiftId){draft=saved;}
 }catch{}
 const status=element('p','Borrador local: no conectado al guardado de producción. Exportá una copia JSON para conservar el trabajo.','muted');
 const save=()=>{try{sessionStorage.setItem(key,JSON.stringify(draft));status.textContent='Borrador guardado en esta pestaña. Exportá el JSON para resguardo.';}catch{status.textContent='No se pudo guardar localmente. Exportá el JSON.';}};
 function change(fn){try{draft=fn();save();render();}catch(e){status.textContent='No se modificó: '+e.message;}}
 function render(){
  host.replaceChildren();
  const tools=element('div','','actions');
  const validation=validarBorradorBa15(draft);
  tools.append(button('Mapa C1–C8',()=>{view='mapa';render()},view==='mapa'?'btn primary':'btn'),
               button('Desarrollo curricular',()=>{view='planes';render()},view==='planes'?'btn primary':'btn'),
               button('Panel de control',()=>{view='control';render()},view==='control'?'btn primary':'btn'),
               button('Exportar borrador JSON',()=>download(draft)));
  host.append(tools,status);
  if(view==='planes'&&term<=2){host.append(element('p',nesLoading?'Cargando contenidos FG oficiales NES de 1.º y 2.º…':nesError?'No se pudo cargar la base NES: '+nesError:'Base NES 1.º + 2.º disponible para Nivel I: '+nesContents.length+' contenidos con año de origen identificado.','muted'));}
  if(view==='control'){
   const total=draft.niveles.reduce((n,l)=>n+l.espacios.length,0);
   const panel=element('div','','workCard');panel.append(element('h3','Control de construcción curricular'),element('p',total+' espacios creados · '+draft.niveles.length+' niveles · 8 cuatrimestres.'));
   const issues=[...validation.errores.map(x=>'ERROR: '+x),...validation.advertencias.map(x=>'REVISAR: '+x)];
   panel.append(element('p',validation.valido?'Cobertura y articulaciones documentadas en la propuesta de prueba.':'Pendientes de revisión: '+issues.length));
   const ul=element('ul');for(const m of issues){ul.append(element('li',m));}panel.append(ul);host.append(panel);return;
  }
  if(view==='mapa'){
   const matrix=element('div','','mapScroll'),tbl=element('table','','mapTable');
   const head=element('thead'),top=element('tr');top.append(element('th','Formato'));
   for(const t of BA15_TERMS)top.append(element('th','C'+t.numero+' · Nivel '+['I','II','III','IV'][t.nivel-1]));
   head.append(top);tbl.append(head);
   const body=element('tbody');
   for(const [format,label] of [['troncal','Troncales'],['laboratorio','Laboratorios'],['taller','Talleres'],['orientado','Formación Orientada'],['otro','Otros formatos']]){
    const row=element('tr');row.append(element('th',label));
    for(const t of BA15_TERMS){
     const td=element('td'),spaces=draft.niveles[t.nivel-1].espacios.filter(e=>e.term===t.numero&&e.formato===format);
     for(const e of spaces){
      td.append(button(e.nombre,()=>{term=t.numero;selected=e.id;render()},'slot'));
     }
     if(!spaces.length)td.append(button('＋',()=>{term=t.numero;selected=null;render()},'ba15EmptySlot'));
     row.append(td);
    }
    body.append(row);
   }
   tbl.append(body);matrix.append(tbl);host.append(matrix);
  }
  const nav=element('div','','demoTermNav');
  for(const t of BA15_TERMS)nav.append(button('C'+t.numero+' · Nivel '+['I','II','III','IV'][t.nivel-1],()=>{term=t.numero;selected=null;planIndex=0;render()},'tab'+(t.numero===term?' active':'')));
  host.append(nav);
  const levelNum=Math.floor((term-1)/2)+1,level=draft.niveles[levelNum-1];
  const summary=element('p','Nivel '+['I','II','III','IV'][levelNum-1]+' · C'+term+' · '+level.asignaturas.reduce((a,s)=>a+s.horas,0)+' horas semanales oficiales del nivel · '+level.espacios.filter(e=>e.term===term).length+' espacios del cuatrimestre','muted');host.append(summary);
  const layout=element('div','','ba15BuilderGrid');
  const aside=element('section','','workCard'),main=element('section','','workCard');
  aside.append(element('h3','Bolsa curricular · Nivel '+['I','II','III','IV'][levelNum-1]));
  aside.append(element('p','Asigná materias a uno o más formatos, sin duplicarlas dentro del mismo cuatrimestre.','muted'));
  const assigned=new Set(level.espacios.filter(e=>e.term===term).flatMap(e=>e.miembros));
  for(const s of level.asignaturas){
   const row=element('div','','ba15Subject');
   const name=element('strong',s.nombre),small=element('small',s.area+' · '+s.horas+' h · '+(assigned.has(s.id)?'Asignada':'Pendiente'));
   row.append(name,small);
   if(selected&&!assigned.has(s.id))row.append(button('Asignar',()=>change(()=>asignarMateriaBa15(draft,{nivel:levelNum,espacioId:selected,materiaId:s.id})),'btn'));
   aside.append(row);
  }
  const form=element('div','','formCard');
  form.append(element('h3','Crear agrupamiento en C'+term));
  const name=field('Nombre del espacio','',()=>{});const format=select('Formato',[['laboratorio','Laboratorio'],['taller','Taller'],['troncal','Troncal'],['orientado','Formación Orientada'],['otro','Otro formato']],()=>{});
  form.append(name,format.wrap);
  form.append(button('Crear espacio',()=>change(()=>{
   const title=name.querySelector('input').value;
   const updated=crearEspacioBa15(draft,{nivel:levelNum,term,nombre:title,formato:format.select.value});
   selected=updated.niveles[levelNum-1].espacios.at(-1).id;return updated;
  }),'btn primary'));main.append(form);
  for(const e of level.espacios.filter(e=>e.term===term)){
   const card=element('article','','ba15Space');
   card.append(button((selected===e.id?'▼ ':'▶ ')+e.nombre+' · '+e.formato,()=>{selected=selected===e.id?null:e.id;render()},'pciItem'+(selected===e.id?' active':'')));
   if(selected===e.id){
    const members=element('div','','ba15Members');
    for(const member of e.miembros){
     const subject=level.asignaturas.find(s=>s.id===member);
     const wrap=element('div','','ba15Member');
     wrap.append(element('span',subject?.nombre||member),button('Quitar',()=>change(()=>quitarMateriaBa15(draft,{nivel:levelNum,espacioId:e.id,materiaId:member})),'btn'));
     members.append(wrap);
    }
    if(!members.childNodes.length)members.append(element('p','Sin materias asignadas. Elegí alguna en la bolsa.','muted'));
    card.append(members);
    card.append(field('Articulación pedagógica y espacios vinculados',e.articulacion,value=>change(()=>actualizarEspacioBa15(draft,{nivel:levelNum,espacioId:e.id,changes:{articulacion:value}})),true));
    if(view==='planes'){
     const tabs=element('div','','actions');
     for(let i=0;i<4;i++)tabs.append(button('Plan '+(i+1),()=>{planIndex=i;render()},'tab'+(i===planIndex?' active':'')));
     card.append(tabs);
     const p=e.planes[planIndex];
     const update=(fn)=>change(()=>{
      const fresh=structuredClone(draft),target=fresh.niveles[levelNum-1].espacios.find(x=>x.id===e.id).planes[planIndex];
      fn(target);return fresh;
     });
     card.append(field('Nombre del plan',p.nombre,v=>update(t=>{t.nombre=v;})));
     card.append(field('Objetivos',p.objetivos,v=>update(t=>{t.objetivos=v;}),true));
     if(levelNum===1&&!nesLoading&&!nesError){
      const contentBox=element('section','','formCard');
      contentBox.append(element('h4','Contenidos NES · 1.º y 2.º año'));
      contentBox.append(element('p','Elegí los contenidos para este plan. El año NES es la procedencia del contenido, no un nuevo nivel BA +15.','muted'));
      const chosen=Array.isArray(p.contenidos)?p.contenidos:[];
      for(const id of chosen){
       const item=nesContents.find(x=>x.id===id);
       const line=element('div','','ba15Member');
       line.append(element('span',item?'NES '+item.year+'.º · '+item.subject+' · '+item.text:'Contenido '+id+' (revisar correspondencia)'));
       line.append(button('Quitar',()=>update(t=>{t.contenidos=(t.contenidos||[]).filter(x=>x!==id);}),'btn'));
       contentBox.append(line);
      }
      const query=element('input');query.type='search';query.placeholder='Buscar por materia, eje o contenido NES…';query.setAttribute('aria-label','Buscar contenidos NES 1.º y 2.º');
      const results=element('div','','ba15ContentResults');
      const showMatches=()=>{
       results.replaceChildren();
       const search=query.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
       if(search.length<2){results.append(element('p','Escribí al menos dos caracteres para buscar.','muted'));return;}
       const matches=nesContents.filter(x=>!chosen.includes(x.id)&&[x.subject,x.area,x.axis,x.subaxis,x.text].some(v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(search))).slice(0,35);
       for(const item of matches){
        const line=element('div','','ba15Subject');
        line.append(element('small','NES '+item.year+'.º · '+item.subject+' · '+item.axis));
        line.append(element('span',item.text));
        line.append(button('Agregar al plan',()=>update(t=>{t.contenidos=Array.isArray(t.contenidos)?t.contenidos:[];if(!t.contenidos.includes(item.id))t.contenidos.push(item.id);}),'btn'));
        results.append(line);
       }
       if(!matches.length)results.append(element('p','Sin coincidencias. Revisá la búsqueda.','muted'));
      };
      query.addEventListener('input',showMatches);contentBox.append(query,results);showMatches();card.append(contentBox);
     }
     for(const [key,label] of [['punto_partida','Punto de partida'],['indagacion','Indagación'],['produccion','Producción'],['evaluacion','Evaluación']])
      card.append(field(label,p.etapas[key],v=>update(t=>{t.etapas[key]=v;}),true));
    }
    card.append(button('Eliminar agrupamiento',()=>{if(confirm('¿Eliminar este espacio del borrador local?'))change(()=>{selected=null;return eliminarEspacioBa15(draft,{nivel:levelNum,espacioId:e.id});});},'btn'));
   }
   main.append(card);
  }
  layout.append(aside,main);host.append(layout);
 }
 render();
 loadV2Fg().then(rows=>{nesContents=rows.filter(x=>x.year===1||x.year===2);nesLoading=false;render();}).catch(err=>{nesLoading=false;nesError=err.message||String(err);render();});
 return {destroy(){host.replaceChildren();},getDraft(){return structuredClone(draft);}};
}
