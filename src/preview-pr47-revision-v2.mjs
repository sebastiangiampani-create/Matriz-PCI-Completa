/**
 * Muestra del paso 3 y de los perfiles originales V2. Solo se carga en la
 * revisión aislada; no lee históricos escolares ni conecta persistencia real.
 */
import { loadV2Fg } from './integracion-curricular/catalogos.js';

const VERSION='revision-publica-pr47/1';
const TEACHER='preview-docente-sociales';
const COORDINATOR='preview-coordinador-sociales';
const norm=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const socialSubjects=['Historia','Economía','Geografía','Formación Ética y Ciudadana'];

/** Datos completamente ficticios, con referencias del catálogo oficial local. */
export function crearMuestraRevisionV2(catalog){
  const math=catalog.find(row=>row.id==='fgv103:128b15a3f8d5c644');
  const social=socialSubjects.map(subject=>catalog.find(row=>row.year===3&&row.subject===subject&&
    catalog.filter(other=>other.year===3&&other.subject===subject&&norm(other.text)===norm(row.text)).length===1));
  if(!math||social.some(row=>!row))throw Error('El catálogo local no permite preparar la muestra de revisión.');
  const matrixRows=[math,...social].map((row,i)=>({id:`revision-pr47-${i}`,
    area:row.area,subject:row.subject,axis:row.axis,text:row.text}));
  matrixRows.push({id:'revision-pr47-pendiente',area:'Matemática',subject:'Matemática',
    axis:'Muestra sin equivalencia',text:'Contenido ficticio para revisar una equivalencia pendiente.'});
  const plan=(number,name,ids)=>({number,name:`Plan bimestral ${number} · ${name} (muestra)`,autoName:false,
    synopsis:'Secuencia ficticia para recorrer el editor y revisar sus campos.',
    objectives:'Comparar fuentes, fundamentar interpretaciones y comunicar conclusiones.',
    contentIds:[...ids],stages:Object.fromEntries([
      ['punto_partida','Recuperar ideas iniciales y formular preguntas.'],
      ['indagacion','Consultar fuentes y contrastar la información.'],
      ['produccion','Elaborar una explicación con evidencias.'],
      ['evaluacion','Revisar la producción y reconocer los aprendizajes.']
    ].map(([key,description])=>[key,{description,duration:'Dos clases',
      resources:'Materiales de muestra',activities:description}]))});
  const group=(id,level,startTerm,items,name,plans)=>({id,level,startTerm,items,name,
    objective:'Propósito del agrupamiento ficticio.',synopsis:'Trabajo anterior simulado para esta revisión.',
    plansBimestrales:Array.from({length:plans},(_,i)=>plan(i+1,name,items.filter(id=>id!=='revision-pr47-pendiente')))});
  const legacyState={areas:{
    'Matemática':{groups:[group('revision-matematica',1,1,
      ['revision-pr47-0','revision-pr47-pendiente'],'Matemática histórica de muestra',4),
      {id:'revision-vacio',level:2,startTerm:3,items:[],plansBimestrales:[]}]},
    'Ciencias Sociales':{groups:['socialA-c5','socialB-c5','socialA-c6','socialB-c6'].map((slot,i)=>
      group(`revision-${slot}`,3,Number(slot.at(-1)),i%2?['revision-pr47-3','revision-pr47-4']:['revision-pr47-1','revision-pr47-2'],
        `Sociales ${slot.startsWith('socialB')?'B':'A'} · C${slot.at(-1)}`,2))}
  }};
  return {legacyState,matrixRows};
}

function mapaInicialDeMuestra(){
  return {alt:'A',mode:'one',placements:{'matematica-n1':['fg-1-matematica']},custom:[],
    valid:false,prearmVersion:1,socialOption:'A',phase2V28:{customContents:[],groups:{
      'matematica-n1':{name:'Matemática · trabajo de muestra existente',
        objectives:'Este trabajo ficticio debe conservarse al incorporar el histórico.',
        contents:[],plansBimestrales:[]}
    }}};
}

function instalarRevision(){
  const preview=window.__pciPreviewPr47;
  if(!preview?.isolated||preview.entryPage!=='revision-v2-portal-real.html')return;
  const frame=document.getElementById('v2OriginalFrame');
  if(!frame)return;
  const states={};
  let current=null,generation=0;
  const catalogPromise=loadV2Fg({base:new URL('../vendor/pci-sec-aprende-v2/data/curriculum_v103',import.meta.url).href})
    .then(crearMuestraRevisionV2);
  // La promesa se consume en la preparación; evita un rechazo sin observador.
  catalogPromise.catch(()=>{});
  window.__pciPreviewPr47Revision={version:VERSION,get estados(){return structuredClone(states);}};
  const active=context=>current===context&&frame.contentWindow===context.source&&
    frame.contentDocument===context.document;
  function status(context,estado,error){
    if(!active(context))return;
    states[context.pci]={estado,...(error?{error}: {})};
    frame.dataset.previewRevision=estado;
    if(error){
      const line=document.getElementById('v2OriginalStatus');
      if(line)line.textContent='La muestra no pudo prepararse: '+error;
    }
  }
  function send(context,type,extra={}){
    if(active(context))context.source.postMessage({type,pci:context.pci,...extra},location.origin);
  }
  function exportState(context){
    return new Promise((resolve,reject)=>{
      const pending={};
      const timeout=setTimeout(()=>{
        if(context.exporting===pending)context.exporting=null;
        reject(Error('El constructor no devolvió su borrador de revisión.'));
      },10000);
      pending.resolve=document=>{clearTimeout(timeout);resolve(document);};
      context.exporting=pending;
      send(context,'V2_EXPORT');
    });
  }
  function preparePeople(context,snapshot){
    const api=context.source.PCIInstitutionalV48;
    if(!api?.institutional)throw Error('El módulo institucional V2 no está disponible.');
    const root=api.institutional(),review=preview.readReview(context.pci);
    const saved=preview.savedV2(context.pci);
    // Recuperar la copia de revisión únicamente cuando no hay personal local.
    const remembered=review?.institutional||saved?.institutional;
    if(!Object.keys(root.teachers||{}).length&&remembered&&typeof remembered==='object')
      Object.assign(root,structuredClone(remembered));
    if(!review?.profilesPrepared){
      root.teachers??={};root.assignments??={};root.coordinations??=[];
      root.teachers[TEACHER]??={id:TEACHER,name:'Docente de muestra · Ciencias Sociales',
        email:'docente@revision.example.invalid',cargos:[{id:'cargo-docente-muestra',type:'TP4',manualHours:0}],meetingHours:3};
      root.teachers[COORDINATOR]??={id:COORDINATOR,name:'Coordinación de muestra · Ciencias Sociales',
        email:'coordinacion@revision.example.invalid',cargos:[{id:'cargo-coordinador-muestra',type:'TP3',manualHours:0}],meetingHours:3};
      if(!root.coordinations.some(row=>row.id==='coordinacion-sociales-muestra'))
        root.coordinations.push({id:'coordinacion-sociales-muestra',teacherId:COORDINATOR,
          kind:'area',scope:'Ciencias Sociales',shift:'Mañana'});
      for(const row of api.implementationRows(snapshot.active)){
        if(row.year===3&&socialSubjects.includes(row.name)&&!root.assignments[row.instanceId])
          root.assignments[row.instanceId]=TEACHER;
      }
      preview.rememberReview(context.pci,{profilesPrepared:true,institutional:structuredClone(root)});
    }
    context.source.PCIAppAccessV80?.apply();
  }
  async function prepare(context,token){
    try{
      // V80 termina su arranque a los 1400 ms desde ready y a los 2200 ms
      // desde la carga. Una entrega posterior invalida esta espera acotada.
      const [fixture]=await Promise.all([catalogPromise,new Promise(resolve=>setTimeout(resolve,2400))]);
      if(!active(context)||token!==generation)return;
      const snapshot=await exportState(context);
      if(!active(context)||token!==generation)return;
      preparePeople(context,snapshot);
      const review=preview.readReview(context.pci);
      const saved=preview.savedV2(context.pci);
      if(!review?.initialized&&!saved&&!preview.hadLocalDraft(context.pci)&&!context.userInteracted){
        const document={...snapshot,maps:{...snapshot.maps,[snapshot.active]:mapaInicialDeMuestra()}};
        send(context,'V2_IMPORT',{document});
      }
      preview.rememberReview(context.pci,{initialized:true,version:VERSION});
      context.abort.abort();
      send(context,'V2_MIGRATION_PREPARE',{orientation:snapshot.active,...structuredClone(fixture)});
    }catch(error){if(token===generation)status(context,'error',error.message);}
  }
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
    const message=event.data;
    if(!message?.pci||!preview.getPci(message.pci))return;
    if(message.type==='V2_ORIGINAL_READY'){
      const pci=preview.getPci(message.pci);
      if(pci.model!=='comun')return;
      const document=frame.contentDocument;
      if(current?.document!==document||current?.pci!==message.pci){
        current?.abort.abort();
        current={pci:message.pci,source:event.source,document,userInteracted:false,abort:new AbortController()};
        const context=current;
        const mark=()=>{context.userInteracted=true;};
        for(const type of ['pointerdown','keydown','input','change','dragstart','drop'])
          document.addEventListener(type,mark,{capture:true,signal:context.abort.signal});
        frame.ownerDocument.getElementById('v2OriginalSave')?.addEventListener('pointerdown',mark,
          {capture:true,signal:context.abort.signal});
      }
      status(current,'preparando');
      void prepare(current,++generation);
      return;
    }
    const context=current;
    if(!context||message.pci!==context.pci||!active(context))return;
    if(message.type==='V2_ORIGINAL_EXPORTED'&&context.exporting){
      const pending=context.exporting;context.exporting=null;pending.resolve(message.document);
    }
    if(['V2_ORIGINAL_SAVED','V2_ORIGINAL_EXPORTED'].includes(message.type)&&
      message.document?.institutional&&preview.readReview(context.pci)?.profilesPrepared)
      preview.rememberReview(context.pci,{institutional:message.document.institutional});
    if(message.type==='V2_MIGRATION_STATUS')status(context,message.estado);
  });
}

if(typeof window!=='undefined'&&typeof document!=='undefined')instalarRevision();
