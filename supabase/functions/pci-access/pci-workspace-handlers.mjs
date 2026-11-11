/**
 * Enrutador preparado para Edge Function pci-access.
 * NO se importa ni se despliega en producción desde esta rama.
 * Supone sesión verificada por el pci-access EXISTENTE: jamás confía en body.role,
 * body.actor, body.school_ids o metadatos de permisos enviados por el navegador.
 * La base histórica public.pci_proposals solo recibe INSERT de escuela nueva
 * a través del RPC controlado. Todas las ediciones de PCI usan unidades separadas.
 */
const ACTIONS=new Set([
  'create-school-v2','list-school-pcis','create-school-pci','get-school-pci',
  'get-school-pci-unit','save-school-pci-unit'
]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_KINDS={
  fg:new Set(['area','group','plan']),
  fo:new Set(['space','group','plan']),
  articulacion:new Set(['link']),
  oferta:new Set(['map'])
};
const FG_BASES=new Set(['fg-matriz-historica/1','fg-sec-aprende-v2/1']);
const ALLOWED_ORIENTATIONS=new Set(["ciencias_naturales","matematica_fisica","energia_sustentabilidad","economia_administracion","educacion_fisica","comunicacion","literatura","turismo","lenguas","informatica","educacion","ciencias_sociales_humanidades","arte_artes_visuales","arte_musica","arte_teatro","agro_ambiente"]);
function text(value,max=180){return String(value??'').replace(/\s+/g,' ').trim().slice(0,max);}
function createCode(){
  const n=crypto.getRandomValues(new Uint16Array(1))[0]%10000;
  return 'PCI-'+String(n).padStart(4,'0');
}
function createPrimary(){
  const b=crypto.getRandomValues(new Uint8Array(4));
  return 'DIR-'+[...b].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
}
function canRead(session,schoolId,inScope,hasPerm){
  if(!inScope(session,schoolId))return false;
  return ['admin','editor','school_admin'].includes(session.role) ||
    (session.role==='user'&&(hasPerm(session,'pci.view')||hasPerm(session,'pci.edit')));
}
function canWrite(session,schoolId,inScope,hasPerm){
  if(!inScope(session,schoolId))return false;
  return ['admin','editor'].includes(session.role) ||
    (session.role==='user'&&hasPerm(session,'pci.edit'));
}
function schoolIdOf(body){
  const sid=Number(body.school_id);
  return Number.isSafeInteger(sid)&&sid>=1001?sid:null;
}
function contentUnit(body){
  const component=text(body.component,40),kind=text(body.unit_kind,32);
  const unitId=text(body.unit_id,240),version=text(body.base_version,160);
  if(!ALLOWED_KINDS[component]?.has(kind)||!unitId)return null;
  if(component==='fg'&&!FG_BASES.has(version))return null;
  if(component==='fo'&&version!=='fo-sec-aprende-v2/1')return null;
  if(component==='articulacion'&&version!=='pci-articulacion-fg-fo/1')return null;
  if(component==='oferta'&&version!=='oferta-pci-orientacion-v1')return null;
  return {component,kind,unitId,version};
}
export async function handleMultiPci({action,body,session,db,cors,inScope,hasPerm,actorFromSession}){
  if(!ACTIONS.has(action))return null;
  const headers={...cors,'Cache-Control':'no-store'};
  const reply=(x,status=200)=>new Response(JSON.stringify(x),{status,headers});
  if(!session||typeof session!=='object')return reply({error:'Sesión inválida'},401);
  const actor=actorFromSession(session);
  const actorName=text(actor?.name||session.username||session.user||'Editor',180);
  async function rpc(fn,args){
    const {data,error}=await db.rpc(fn,args);
    if(error)throw error;
    return data;
  }
  try{
    if(action==='create-school-v2'){
      // La alta institucional es privilegio administrativo, nunca de un editor escolar.
      if(session.role!=='admin')return reply({error:'Sin permiso para agregar escuelas'},403);
      const name=text(body.name,150),cue=text(body.cue,35).toUpperCase();
      const email=text(body.email,180),year=Number(body.year);
      if(name.length<3||!/^[A-Z0-9./_-]{3,35}$/.test(cue)||
         (email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||
         !Number.isInteger(year)||year<2020||year>2100)
        return reply({error:'Nombre, CUE, correo o año inválidos'},400);
      for(let attempt=0;attempt<12;attempt++){
        const edit=createCode(),primary=createPrimary();
        try{
          const result=await rpc('pci_workspace_create_school_v1',{
            p_name:name,p_cue:cue,p_email:email,p_year:year,
            p_edit_code:edit,p_primary_code:primary,p_actor:actorName
          });
          if(!result?.ok)return reply({error:'No se confirmó el alta'},502);
          // Claves solo para la persona autorizada, nunca en catálogos públicos.
          return reply({...result,edit_code:edit,primary_code:primary},201);
        }catch(error){
          if(String(error.message||'').includes('CUE'))return reply({error:'El CUE ya está registrado'},409);
          if(error.code==='23505')continue; // colisión de clave; generar otra
          throw error;
        }
      }
      return reply({error:'No fue posible generar una clave única'},409);
    }
    const sid=schoolIdOf(body);
    if(sid===null)return reply({error:'Escuela inválida'},400);
    const read=canRead(session,sid,inScope,hasPerm);
    const write=canWrite(session,sid,inScope,hasPerm);
    if(action==='list-school-pcis'){
      if(!read)return reply({error:'Sin permiso'},403);
      const pcis=await rpc('pci_workspace_list_pcis_v1',{p_school_id:sid});
      return reply({school_id:sid,pcis:Array.isArray(pcis)?pcis:[]});
    }
    if(action==='create-school-pci'){
      if(!write)return reply({error:'Sin permiso para crear PCI'},403);
      const orientation=text(body.orientation_id,80),title=text(body.title,150);
      if(!ALLOWED_ORIENTATIONS.has(orientation)||title.length<3)
        return reply({error:'Orientación o nombre de PCI inválido'},400);
      const result=await rpc('pci_workspace_create_pci_v1',{
        p_school_id:sid,p_orientation_id:orientation,p_title:title,p_actor:actorName
      });
      return reply(result,201);
    }
    if(!read)return reply({error:'Sin permiso'},403);
    const pciId=String(body.pci_id||'');
    if(!UUID.test(pciId))return reply({error:'Identificador PCI inválido'},400);
    // El servidor deriva orientación y proceso del registro, no del body del cliente.
    const records=await rpc('pci_workspace_list_pcis_v1',{p_school_id:sid});
    const registered=Array.isArray(records)?records.find(p=>String(p.pci_id)===pciId):null;
    if(!registered)return reply({error:'PCI inexistente en esta escuela'},404);
    if(action==='get-school-pci'){
      const found=await rpc('pci_workspace_get_pci_v1',{p_school_id:sid,p_pci_id:pciId});
      return found?reply({pci:found}):reply({error:'PCI no encontrado'},404);
    }
    const unit=contentUnit(body);
    if(!unit)return reply({error:'Componente curricular o versión inválida'},400);
    const scope={
      p_school_id:sid,p_orientation_id:registered.orientation_id,
      p_process_id:registered.process_id,p_component:unit.component,
      p_unit_kind:unit.kind,p_unit_id:unit.unitId
    };
    if(action==='get-school-pci-unit'){
      const found=await rpc('pci_collab_get_unit_v1',scope);
      return reply({pci_id:pciId,...found});
    }
    if(!write||!['borrador','en_revision'].includes(registered.status))
      return reply({error:'El PCI está en consulta o no permite cambios'},403);
    const revision=Number(body.expected_revision);
    if(!Number.isSafeInteger(revision)||revision<0||
       !body.document||typeof body.document!=='object'||Array.isArray(body.document))
      return reply({error:'Documento o revisión inválida'},400);
    const original=await rpc('pci_workspace_get_pci_v1',{p_school_id:sid,p_pci_id:pciId});
    if(!original?.legacy_sha256 || !original?.legacy_state)
      return reply({error:'No se encontró el resguardo de origen'},409);
    const doc=body.document;
    // Documento y alcance validados contra el PCI real, no contra parámetros del cliente.
    if(Number(doc.school_id)!==sid ||
       doc.pci_id!==pciId ||
       doc.orientation_id!==registered.orientation_id ||
       doc.original_sha256!==original.legacy_sha256)
      return reply({error:'Documento asociado a otra institución, PCI o versión de origen'},409);
    if((unit.component==='fg' && (
         unit.kind!=='area' || doc.schema!=='pci-fg-area-v2/1' ||
         doc.area!==unit.unitId || !Array.isArray(doc.groups))) ||
       (unit.component==='fo' && (
         unit.kind!=='space' || doc.schema!=='pci-fo-desarrollo-v2/1' ||
         doc.space_id!==unit.unitId || doc.orientation!==registered.orientation_id ||
         !Array.isArray(doc.plansBimestrales) || doc.plansBimestrales.length!==4)) ||
       (unit.component==='oferta' && (
         unit.kind!=='map' || doc.schema!=='pci-oferta-fo-v2/1' ||
         !doc.fo || !Array.isArray(doc.fo.spaces))) ||
       unit.component==='articulacion')
      return reply({error:'Estructura curricular o componente no habilitado'},400);
    const serialized=JSON.stringify(body.document);
    if(serialized.length>1000000)return reply({error:'Unidad curricular demasiado extensa'},413);
    const saved=await rpc('pci_collab_save_unit_v1',{
      ...scope,p_base_version:unit.version,p_expected_revision:revision,
      p_document:body.document,p_actor:actorName
    });
    return reply({pci_id:pciId,...saved},saved?.ok===false?409:200);
  }catch(error){
    // Evitar filtrar SQL, nombres de claves y secretos en respuestas externas.
    console.error('[PCI multipci]',action,error?.code||'error');
    return reply({error:'No se pudo completar la operación en el servidor'},503);
  }
}
