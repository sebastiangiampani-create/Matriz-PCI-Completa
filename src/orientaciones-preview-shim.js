/* Vista de orientaciones en GitHub: motor de API SIMULADA.
 * Esta rama nunca usa credenciales ni escribe en Supabase de producción.
 * Se carga antes de src/orientaciones-online.mjs: mantiene el HTML, CSS y
 * módulos curriculares reales, reemplaza SOLAMENTE la API de datos.
 */
(() => {
  'use strict';
  const LIVE_HOST='https://agmebsotbuurbnldxewf.supabase.co/';
  const STORE='pci-orientaciones-vista-simulada-20261111-v1';
  const copy = x => JSON.parse(JSON.stringify(x));
  const validUuid = x => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(x));
  const seed = {
    schools: [
      {school_id:1001,name:'Escuela Modelo · Sede Central (ficticia)',cue:'DEMO-001'},
      {school_id:1002,name:'Instituto Modelo · Turno Tarde (ficticio)',cue:'DEMO-002'}
    ],
    pcis: [
      {pci_id:'11111111-1111-4111-8111-111111111111',school_id:1001,
       orientation_id:'economia_administracion',process_id:'pci-economia-manana',
       title:'PCI Economía y Administración · Mañana',status:'borrador'},
      {pci_id:'22222222-2222-4222-8222-222222222222',school_id:1001,
       orientation_id:'ciencias_sociales_humanidades',process_id:'pci-sociales-tarde',
       title:'PCI Ciencias Sociales · Tarde',status:'borrador'},
      {pci_id:'33333333-3333-4333-8333-333333333333',school_id:1002,
       orientation_id:'ciencias_naturales',process_id:'pci-naturales',
       title:'PCI Ciencias Naturales · Ejemplo',status:'borrador'}
    ],
    units:{},events:[]
  };
  let state;
  try { state=JSON.parse(sessionStorage.getItem(STORE) || 'null'); } catch {}
  if(!state || !Array.isArray(state.schools)||!Array.isArray(state.pcis)||!state.units)
    state=copy(seed);
  const persist=()=>sessionStorage.setItem(STORE,JSON.stringify(state));
  persist();
  // Se utiliza un token FICTICIO exclusivamente dentro de este visor.
  sessionStorage.setItem('pci_access_session',JSON.stringify({
    token:'DEMO-UNICAMENTE-LOCAL-SIN-VALIDEZ',
    role:'admin',user:'demo',name:'Administrador de prueba',
    all_schools:true,permissions:['pci.view','pci.edit']
  }));
  const savedOriginalFetch=window.fetch.bind(window);
  function getProject(b) {
    const school=Number(b.school_id);
    const found=state.pcis.find(p=>p.school_id===school&&p.pci_id===b.pci_id);
    return found||null;
  }
  function getKey(b,pci){
    return [pci.school_id,pci.pci_id,pci.orientation_id,pci.process_id,
      b.component,b.unit_kind,b.unit_id].join('|');
  }
  function json(data,status=200) {
    return new Response(JSON.stringify(data),{
      status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
    });
  }
  function handle(input,init={}) {
    if(init.method && init.method!=='POST')
      return json({error:'Método no disponible en vista de prueba'},405);
    let b;
    try {b=JSON.parse(String(init.body||'{}')); }
    catch {return json({error:'Solicitud de prueba inválida'},400);}
    if(b.token!=='DEMO-UNICAMENTE-LOCAL-SIN-VALIDEZ')return json({error:'Sesión ficticia no válida'},401);
    const school=Number(b.school_id);
    switch(b.action){
      case 'session-info':
        return json({role:'admin',user:'demo',name:'Administrador de prueba',
          permissions:['pci.view','pci.edit'],all_schools:true,superadmin:true});
      case 'list-schools':
        return json({schools:copy(state.schools)});
      case 'list-school-pcis':
        return json({school_id:school,pcis:copy(state.pcis.filter(p=>p.school_id===school))});
      case 'create-school-v2': {
        const name=String(b.name||'').trim(),cue=String(b.cue||'').trim().toUpperCase();
        if(name.length<3||cue.length<3)return json({error:'Completá nombre y código'},400);
        if(state.schools.some(s=>s.cue===cue))return json({error:'Código duplicado en esta demo'},409);
        const id=Math.max(1000,...state.schools.map(s=>s.school_id))+1;
        state.schools.push({school_id:id,name,cue});
        persist();
        return json({ok:true,school_id:id,name,edit_code:'PCI-0000',primary_code:'DIR-DEMO000'},201);
      }
      case 'create-school-pci':{
        if(!state.schools.some(s=>s.school_id===school))
          return json({error:'Escuela de prueba inexistente'},404);
        const orientation=String(b.orientation_id||'');
        const title=String(b.title||'').trim();
        if(!orientation||title.length<3)return json({error:'Completar orientación y nombre'},400);
        const id=crypto.randomUUID();
        state.pcis.push({pci_id:id,school_id:school,orientation_id:orientation,
          process_id:'demo-'+crypto.randomUUID(),title,status:'borrador'});
        persist();
        return json({ok:true,pci_id:id},201);
      }
      case 'get-school-pci':{
        const p=getProject(b);
        if(!p)return json({error:'PCI ajeno a esta escuela de prueba'},404);
        const schoolRecord=state.schools.find(s=>s.school_id===school);
        return json({pci:{
          ...copy(p),
          legacy_sha256:'d'.repeat(64),
          legacy_state:{
            schemaVersion:10,schoolName:schoolRecord.name,areas:{},
            current:null, _meta:{cue:schoolRecord.cue}
          }
        }});
      }
      case 'get-school-pci-unit':{
        const p=getProject(b);
        if(!p)return json({error:'PCI desconocido'},404);
        const record=state.units[getKey(b,p)];
        return json(record?
          {exists:true,revision:record.revision,document:copy(record.document),
           base_version:b.base_version}:
          {exists:false,revision:0});
      }
      case 'save-school-pci-unit':{
        const p=getProject(b);
        if(!p)return json({error:'PCI desconocido'},404);
        if(p.status==='publicado'||p.status==='archivado')
          return json({error:'PCI de solo lectura'},403);
        const doc=b.document||{};
        if(Number(doc.school_id)!==school||doc.pci_id!==p.pci_id||
           doc.orientation_id!==p.orientation_id||doc.original_sha256!=='d'.repeat(64))
          return json({error:'Documento o identidad del PCI incompatibles'},409);
        const key=getKey(b,p);
        const current=state.units[key]?.revision||0;
        if(b.expected_revision!==current)
          return json({error:'Conflicto entre revisiones: hay otro guardado'},409);
        const revision=current+1;
        state.units[key]={revision,document:copy(doc)};
        state.events.push({action:b.action,pci_id:p.pci_id,key,revision,time:new Date().toISOString()});
        persist();
        return json({ok:true,revision,updated_at:new Date().toISOString()});
      }
      default: return json({error:'La acción '+String(b.action)+' no está disponible en la demo'},400);
    }
  }
  // Firewall explícito: TODAS las URL del proyecto real se interceptan antes
  // de red. No existe fallback al backend productivo.
  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input?.url||String(input));
    if(url.startsWith(LIVE_HOST))
      return handle(input,init||{});
    return savedOriginalFetch(input,init);
  };
  window.__PCI_VISTA_PREVIA__={
    version:'20261111', ficticia:true, getState:()=>copy(state),
    reset:()=>{sessionStorage.removeItem(STORE);location.reload();}
  };
})();
