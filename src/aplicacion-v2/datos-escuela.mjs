/** Cliente institucional. El token permanece privado; ningún método se ejecuta al importar. */
import {identidadPci,contratoV2,validarDocumentoV2,crearDocumentoV2} from './documentos.mjs';
import {HISTORIC_LINK_SCHEMA} from '../vinculos-historicos.mjs';

const API='https://agmebsotbuurbnldxewf.supabase.co/functions/v1/pci-multipci';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const copy=value=>JSON.parse(JSON.stringify(value));
const error=(code,message,status=400)=>Object.assign(new Error(message),{code,status});

export function permisosSesion(session){
  const permissions=Array.isArray(session?.permissions)?session.permissions:[];
  const puedeEditar=['admin','editor'].includes(session?.role)||
    session?.role==='user'&&permissions.includes('pci.edit');
  return {puedeEditar,puedeDeclarar:puedeEditar||session?.role==='school_admin'};
}

function schoolIdOf(value){
  const id=Number(value);
  if(!Number.isSafeInteger(id)||id<1001)
    throw error('ESCUELA_INVALIDA','Identificador de escuela inválido.');
  return id;
}
function revisionOf(value,exists=false){
  const revision=Number(value);
  if(!Number.isSafeInteger(revision)||revision<(exists?1:0))
    throw error('RESPUESTA_INVALIDA','El servidor devolvió una revisión inválida.',502);
  return revision;
}
function checkLinks(document,schoolId){
  if(!object(document)||document.schema!==HISTORIC_LINK_SCHEMA||
    Number(document.school_id)!==schoolId||typeof document.source_updated_at!=='string'||
    !document.source_updated_at.trim()||!Array.isArray(document.assignments))
    throw error('VINCULOS_AJENOS','Los vínculos históricos no corresponden a esta escuela.');
  for(const assignment of document.assignments){
    if(!object(assignment)||typeof assignment.area!=='string'||!assignment.area.trim()||
      typeof assignment.id!=='string'||!assignment.id.trim()||
      !['general','orientada','tecnica'].includes(assignment.kind)||
      !['all','selected'].includes(assignment.mode)||!Array.isArray(assignment.pci_ids)||
      assignment.pci_ids.some(id=>typeof id!=='string'||!UUID.test(id))||
      (assignment.mode==='all'&&(assignment.kind!=='general'||assignment.pci_ids.length)))
      throw error('VINCULOS_INVALIDOS','Hay asignaciones históricas incompatibles.');
  }
  return copy(document);
}

export function crearClienteEscuela({fetchImpl=globalThis.fetch,storage=globalThis.sessionStorage}={}){
  if(typeof fetchImpl!=='function'||typeof storage?.getItem!=='function')
    throw error('CLIENTE_INVALIDO','No se puede iniciar la conexión institucional.');
  let token=null,session=null;

  async function request(action,data={}){
    if(!token)throw error('SESION_REQUERIDA','Ingresá con el acceso de tu escuela.',401);
    const response=await fetchImpl(API,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action,token,...data}),cache:'no-store'});
    let result;
    try{result=await response.json();}
    catch{throw error('RESPUESTA_INVALIDA','El servidor no devolvió una respuesta válida.',response.status||502);}
    if(!response.ok){
      const message=typeof result?.error==='string'?result.error:
        response.status===409?'Otra persona modificó el documento. Conservá tu borrador.':'No se pudo completar la operación.';
      const unavailable=action==='get-school-pci-unit'&&
        (response.status===400&&/Unidad y modalidad incompatibles/i.test(message)||
         response.status===404&&/Acción no disponible/i.test(message));
      throw error(unavailable?'CONTRATO_V2_NO_DISPONIBLE':'API_ESCUELA',message,response.status);
    }
    if(!object(result))throw error('RESPUESTA_INVALIDA','La respuesta institucional es inválida.',502);
    return result;
  }
  function requireSession(){
    if(!session)throw error('SESION_REQUERIDA','Primero debe validarse la sesión institucional.',401);
    return session;
  }
  function scope(schoolId){
    const id=schoolIdOf(schoolId),s=requireSession();
    const canRead=['admin','editor','school_admin'].includes(s.role)||
      s.role==='user'&&s.permissions.some(permission=>['pci.view','pci.edit'].includes(permission));
    const permitted=s.role==='admin'||s.role==='user'&&(s.all_schools||s.school_ids.includes(id))||
      ['editor','school_admin'].includes(s.role)&&Number(s.school_id)===id;
    if(!canRead||!permitted)throw error('ESCUELA_NO_AUTORIZADA','La escuela está fuera del alcance de esta sesión.',403);
    return id;
  }
  function checkPci(pci,schoolId,pciId){
    if(!object(pci)||Number(pci.school_id)!==schoolId||typeof pci.pci_id!=='string'||
      !UUID.test(pci.pci_id)||(pciId!==undefined&&pci.pci_id!==pciId))
      throw error('PCI_AJENO','El PCI recibido no pertenece a la escuela seleccionada.',409);
    return copy(pci);
  }

  async function validarSesion(){
    token=null;session=null;
    const from=new URLSearchParams(globalThis.location?.search||'').get('from');
    const keys=from==='panel-general'?['pci_admin_monitor_session','pci_access_session','pci_school_admin_session']:
      from==='panel-escuela'?['pci_school_admin_session','pci_access_session','pci_admin_monitor_session']:
        ['pci_access_session','pci_admin_monitor_session','pci_school_admin_session'];
    let saved;
    for(const key of keys){
      try{const candidate=JSON.parse(storage.getItem(key)||'null');
        if(object(candidate)&&typeof candidate.token==='string'&&candidate.token.trim()){saved=candidate;break;}}
      catch{/* Una clave de sesión inválida no impide leer los otros accesos existentes. */}
    }
    if(!saved)throw error('SESION_REQUERIDA','Ingresá con el acceso de tu escuela.',401);
    token=saved.token;
    try{
      const verified=await request('session-info');
      if(!['admin','user','editor','school_admin'].includes(verified.role))
        throw error('SESION_INVALIDA','El servidor no confirmó una sesión institucional.',401);
      // session-info no devuelve school_id/name en la versión vigente. Se
      // conservan los metadatos del login; cada lectura se autoriza otra vez en Edge.
      session={...saved,...verified,
        permissions:Array.isArray(verified.permissions)?copy(verified.permissions):[],
        school_ids:Array.isArray(verified.school_ids)?verified.school_ids.map(Number):[],
        all_schools:verified.all_schools===true};
      delete session.token;
      return copy(session);
    }catch(err){token=null;session=null;throw err;}
  }
  async function listarEscuelas(){
    const s=requireSession();
    if(['editor','school_admin'].includes(s.role)){
      const id=scope(s.school_id);
      return [{school_id:id,name:s.name||'Escuela '+id,cue:s.cue||'',model:s.model}];
    }
    const result=await request('list-schools');
    if(!Array.isArray(result.schools))throw error('RESPUESTA_INVALIDA','No se recibió el listado de escuelas.',502);
    for(const school of result.schools)scope(school.school_id);
    return copy(result.schools);
  }
  async function listarPcis(schoolId){
    const id=scope(schoolId),result=await request('list-school-pcis',{school_id:id});
    if(!Array.isArray(result.pcis))throw error('RESPUESTA_INVALIDA','No se recibió el listado de PCI.',502);
    return result.pcis.map(pci=>checkPci(pci,id));
  }
  async function obtenerPci(schoolId,pciId){
    const id=scope(schoolId);
    if(typeof pciId!=='string'||!UUID.test(pciId))throw error('PCI_INVALIDO','Identificador de PCI inválido.');
    const result=await request('get-school-pci',{school_id:id,pci_id:pciId});
    const pci=checkPci(result.pci,id,pciId);
    identidadPci({school:{id},pci});
    if(!object(pci.legacy_state)||
      Object.hasOwn(pci.legacy_state,'areas')&&!object(pci.legacy_state.areas))
      throw error('PCI_INVALIDO','El PCI no contiene un resguardo histórico válido.',502);
    return pci;
  }
  async function obtenerVinculos(schoolId){
    const id=scope(schoolId),result=await request('get-school-legacy-links',{school_id:id});
    if(!Array.isArray(result.rows)||typeof result.exists!=='boolean')
      throw error('RESPUESTA_INVALIDA','No se recibió la asignación histórica de esta escuela.',502);
    const revision=revisionOf(result.revision,result.exists);
    if(!result.exists&&revision!==0)throw error('RESPUESTA_INVALIDA','La revisión histórica es inconsistente.',502);
    const document=result.exists?checkLinks(result.document,id):null;
    if(!result.exists&&result.document!=null)
      throw error('RESPUESTA_INVALIDA','La respuesta histórica contiene un documento sin revisión.',502);
    return {...copy(result),revision,document};
  }
  async function obtenerUnidad(contexto){
    const identity=identidadPci(contexto),id=scope(identity.schoolId),contract=contratoV2(identity.model);
    const result=await request('get-school-pci-unit',{school_id:id,pci_id:identity.pciId,
      component:contract.component,unit_kind:contract.unitKind,unit_id:contract.unitId,base_version:contract.baseVersion});
    if(typeof result.exists!=='boolean')throw error('RESPUESTA_INVALIDA','No se recibió el estado de la unidad V2.',502);
    const revision=revisionOf(result.revision,result.exists);
    if(!result.exists){
      if(revision!==0||result.document!=null)throw error('RESPUESTA_INVALIDA','La unidad V2 tiene una revisión inconsistente.',502);
      return {...copy(result),exists:false,revision:0,document:null};
    }
    if(result.base_version!==contract.baseVersion)
      throw error('DOCUMENTO_V2_INCOMPATIBLE','La unidad remota utiliza otra versión curricular.',409);
    return {...copy(result),revision,document:validarDocumentoV2(result.document,contexto)};
  }
  /** Guarda el documento V2 completo en la unidad aislada de SU PCI.
   * La revisión es obligatoria: una modificación concurrente devuelve 409.
   * La UI conserva el borrador local y exige conciliar antes de reintentar.
   */
  async function guardarUnidad(contexto,estado,{expected_revision}={}){
    const identity=identidadPci(contexto),id=scope(identity.schoolId);
    if(!permisosSesion(session).puedeEditar)
      throw error('SIN_PERMISO','La sesión institucional no permite modificar el PCI.',403);
    if(!Number.isSafeInteger(expected_revision)||expected_revision<0)
      throw error('REVISION_INVALIDA','Falta la revisión remota previa para guardar.');
    const contract=contratoV2(identity.model),documento=crearDocumentoV2(estado,contexto);
    const result=await request('save-school-pci-unit',{
      school_id:id,pci_id:identity.pciId,component:contract.component,
      unit_kind:contract.unitKind,unit_id:contract.unitId,
      base_version:contract.baseVersion,expected_revision,document:documento
    });
    if(result.ok!==true||revisionOf(result.revision,true)!==expected_revision+1)
      throw error('GUARDADO_NO_CONFIRMADO','El servidor no confirmó una nueva revisión de este PCI.',409);
    return {...copy(result),revision:Number(result.revision)};
  }
  /** Alta explícita del formulario existente; no guarda documentos V2 ni legado. */
  async function crearPci(schoolId,fields){
    const id=scope(schoolId);
    if(!permisosSesion(session).puedeDeclarar)
      throw error('SIN_PERMISO','La sesión no permite declarar orientaciones.',403);
    const {model,orientation_id,specialty_name,shift_id,title}=fields||{};
    if(!['comun','tecnica','ba15'].includes(model)||
      !['manana','tarde','vespertino','noche'].includes(shift_id)||typeof title!=='string'||title.trim().length<3||
      (model==='tecnica'?(typeof specialty_name!=='string'||specialty_name.trim().length<3):
        (typeof orientation_id!=='string'||!/^[a-z][a-z0-9_]{2,79}$/.test(orientation_id))))
      throw error('PCI_INVALIDO','Completá modalidad, orientación o especialidad, turno y título.');
    const result=await request('create-school-pci',{school_id:id,model,orientation_id:orientation_id||'',
      specialty_name:model==='tecnica'?specialty_name.trim():null,shift_id,title:title.trim()});
    return checkPci(result,id);
  }
  /** Sólo la acción humana de asignación institucional utiliza esta escritura. */
  async function guardarVinculos(schoolId,{document,expected_revision}={}){
    const id=scope(schoolId);
    if(!permisosSesion(session).puedeDeclarar)
      throw error('SIN_PERMISO','La sesión no permite asignar trabajo anterior.',403);
    if(!Number.isSafeInteger(expected_revision)||expected_revision<0)
      throw error('REVISION_INVALIDA','La revisión esperada de la asignación es inválida.');
    const validated=checkLinks(document,id);
    const result=await request('save-school-legacy-links',{school_id:id,document:validated,expected_revision});
    if(result.ok!==true||revisionOf(result.revision,true)!==expected_revision+1)
      throw error('GUARDADO_NO_CONFIRMADO','El servidor no confirmó una nueva revisión de los vínculos.',409);
    return copy(result);
  }
  return Object.freeze({validarSesion,listarEscuelas,listarPcis,obtenerPci,obtenerVinculos,
    obtenerUnidad,guardarUnidad,crearPci,guardarVinculos});
}
