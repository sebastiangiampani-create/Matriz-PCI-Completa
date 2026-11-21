/* PR #47: transporte simulado para revisar la aplicación real sin tocar Supabase.
   Esta capa solo se incorpora a las páginas de revisión, nunca al portal institucional. */
(() => {
  'use strict';
  const endpoint = 'https://agmebsotbuurbnldxewf.supabase.co/functions/v1/pci-multipci';
  const storageKey = 'pci-pr47-preview-state-v1';
  const entryPage = location.pathname.endsWith('/revision-v2-portal-real.html')
    ? 'revision-v2-portal-real.html' : 'revision-pr47.html';
  // La sesión ficticia no sustituye una sesión institucional del mismo origen.
  const rawGet=Storage.prototype.getItem,rawSet=Storage.prototype.setItem,rawRemove=Storage.prototype.removeItem;
  const scopedKey=(storage,key)=>storage===sessionStorage&&String(key)==='pci_access_session'
    ? 'pci-pr47-access-session' : key;
  Storage.prototype.getItem=function(key){return rawGet.call(this,scopedKey(this,key));};
  Storage.prototype.setItem=function(key,value){return rawSet.call(this,scopedKey(this,key),value);};
  Storage.prototype.removeItem=function(key){return rawRemove.call(this,scopedKey(this,key));};
  const schoolId = 1001;
  const school = {school_id:schoolId,name:'Escuela de muestra ficticia · Revisión PR #47',cue:'PREVIEW-47'};
  const base = {
    schema:1, seq:20,
    pcis:[
      {pci_id:'00000000-0000-4000-8000-000000000001',school_id:schoolId,orientation_id:'comunicacion',
       process_id:'preview-media-1',title:'Comunicación · Turno mañana',model:'comun',
       shift_id:'manana',status:'borrador',specialty_name:null,legacy_sha256:'a'.repeat(64),
       legacy_state:{schemaVersion:10,areas:{},schoolName:school.name}},
      {pci_id:'00000000-0000-4000-8000-000000000002',school_id:schoolId,orientation_id:'computacion',
       process_id:'preview-tecnica-2',title:'Computación · Turno tarde',model:'tecnica',
       shift_id:'tarde',status:'borrador',specialty_name:'Computación',legacy_sha256:'b'.repeat(64),
       legacy_state:{schemaVersion:10,areas:{},schoolName:school.name}},
      {pci_id:'00000000-0000-4000-8000-000000000003',school_id:schoolId,orientation_id:'economia_administracion',
       process_id:'preview-ba15-3',title:'Economía y Administración · Turno noche',model:'ba15',
       shift_id:'noche',status:'borrador',specialty_name:null,legacy_sha256:'c'.repeat(64),
       legacy_state:{schemaVersion:10,areas:{},schoolName:school.name}}
    ],units:{}
  };
  function load(){
    try{
      const state=JSON.parse(sessionStorage.getItem(storageKey)||'null');
      if(state?.schema===1 && Array.isArray(state.pcis)&&state.units&&typeof state.units==='object')return state;
    }catch{}
    return structuredClone(base);
  }
  let state=load();
  state.review=state.review&&typeof state.review==='object'?state.review:{};
  // Registrar los borradores anteriores antes de que se abra cualquier iframe.
  const priorDrafts=new Set(state.pcis.filter(p=>{
    const prefix=p.model==='comun'?'pci-original-v2::':'pci-v2-modalidad::'+p.model+'::';
    return localStorage.getItem(prefix+p.pci_id+'::pci-sa-v2-app-20260910-21')!==null;
  }).map(p=>p.pci_id));
  const persist=()=>sessionStorage.setItem(storageKey,JSON.stringify(state));
  persist();
  // Sesión de prueba sin credenciales reales. No solicita ni usa usuario/clave.
  sessionStorage.setItem('pci_access_session',JSON.stringify({token:'pr47-fake-token',role:'admin',school_id:schoolId}));
  const nativeFetch=window.fetch.bind(window);
  const response=(obj,status=200)=>new Response(JSON.stringify(obj),{
    status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
  });
  const getKey=body=>[body.pci_id,body.component,body.unit_kind,body.unit_id].map(String).join(':');
  const validPci=body=>state.pcis.find(p=>p.pci_id===body.pci_id&&p.school_id===schoolId);
  function handle(body){
    if(body.action!=='session-info'&&body.action!=='list-schools'&&Number(body.school_id)!==schoolId)
      return response({error:'Escuela fuera del entorno de prueba.'},403);
    switch(body.action){
      case 'session-info':return response({role:'admin',permissions:['pci.view','pci.edit'],
        all_schools:true,school_ids:[],identity:{name:'Revisor PR 47'}});
      case 'list-schools':return response({schools:[school]});
      case 'list-school-pcis':return response({pcis:structuredClone(state.pcis)});
      case 'get-school-legacy-links':return response({school_id:schoolId,rows:[],revision:0,document:null});
      case 'get-school-pci':{
        const pci=validPci(body);
        return pci?response({pci:structuredClone(pci)}):response({error:'PCI de prueba inexistente.'},404);
      }
      case 'create-school-pci':{
        const next=++state.seq;
        const pci={pci_id:'00000000-0000-4000-8000-'+String(next).padStart(12,'0'),
          school_id:schoolId,orientation_id:String(body.orientation_id||''),
          process_id:'preview-process-'+next,title:String(body.title||'PCI de prueba'),
          model:body.model,shift_id:body.shift_id,status:'borrador',
          specialty_name:body.specialty_name||null,legacy_sha256:'d'.repeat(64),
          legacy_state:{schemaVersion:10,areas:{},schoolName:school.name}};
        state.pcis.push(pci);persist();return response({ok:true,pci_id:pci.pci_id});
      }
      case 'get-school-pci-unit':{
        if(!validPci(body))return response({error:'PCI incorrecto'},403);
        return response(structuredClone(state.units[getKey(body)]||{exists:false,revision:0}));
      }
      case 'save-school-pci-unit':{
        if(!validPci(body))return response({error:'PCI incorrecto'},403);
        const key=getKey(body),previous=state.units[key];
        if(Number(body.expected_revision)!==(previous?.revision||0))
          return response({error:'Conflicto de revisión del borrador',code:'stale_revision'},409);
        const revision=(previous?.revision||0)+1;
        state.units[key]={exists:true,revision,base_version:body.base_version,
          document:structuredClone(body.document)};
        persist();return response({ok:true,revision});
      }
      default:return response({error:'Acción no habilitada en la revisión aislada: '+String(body.action)},403);
    }
  }
  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:input?.url||String(input);
    const parsed=new URL(url,location.href);
    // Nunca transmitir datos ni tokens a ningún endpoint Supabase real.
    if(parsed.hostname.endsWith('supabase.co')){
      if(parsed.href.startsWith(endpoint)){
        let body={};try{body=JSON.parse(init.body||'{}')}catch{}
        return handle(body);
      }
      return response({error:'Backend externo bloqueado en esta revisión.'},403);
    }
    return nativeFetch(input,init);
  };
  window.addEventListener('DOMContentLoaded',()=>{
    const label=document.createElement('div');
    label.textContent='REVISIÓN AISLADA PR #47 · Datos simulados · Sin conexión a Supabase';
    label.setAttribute('role','status');
    label.style.cssText='position:relative;text-align:center;background:#edf3f8;color:#12395c;border-bottom:1px solid #d8e1e8;padding:7px 12px;font:600 12px Archivo,system-ui,sans-serif';
    document.body.prepend(label);
    // El encabezado exterior no debe tapar controles dentro del iframe al desplazarse.
    const portalHeader=document.querySelector('.site-top');
    if(portalHeader)portalHeader.style.position='relative';
    const protectLinks=()=>{
      for(const id of ['platformHomeLink','adminPanelLink','schoolPanelLink','historicalPciLink','homeHistoricalPciLink']){
        const a=document.getElementById(id);
        if(a){if(a.hasAttribute('href'))a.removeAttribute('href');if(!a.hidden)a.hidden=true;a.style.display='none';}
      }
      for(const id of ['schoolHomeLink','brandHomeLink','authLoginLink']){
        const a=document.getElementById(id),href=entryPage+'?school=1001';
        if(a&&a.getAttribute('href')!==href)a.setAttribute('href',href);
      }
    };
    protectLinks();
    // El portal vuelve a componer sus enlaces al cambiar de PCI.
    new MutationObserver(protectLinks).observe(document.body,{subtree:true,attributes:true,attributeFilter:['href','hidden']});
  },{once:true});
  window.__pciPreviewPr47={isolated:true,schoolId,entryPage,
    getPci(id){return structuredClone(state.pcis.find(p=>p.pci_id===id)||null);},
    hadLocalDraft(id){return priorDrafts.has(id);},
    savedV2(id){
      const row=Object.values(state.units).find(x=>x?.document?.pciId===id&&x.document.v2?.maps);
      return row?structuredClone(row.document.v2):null;
    },
    readReview(id){return structuredClone(state.review[id]||null);},
    rememberReview(id,patch){
      if(!state.pcis.some(p=>p.pci_id===id))return;
      state.review[id]={...(state.review[id]||{}),...structuredClone(patch)};persist();
    },
    reset(){
    state=structuredClone(base);state.review={};persist();location.href=entryPage+'?school=1001';
  }};
})();
