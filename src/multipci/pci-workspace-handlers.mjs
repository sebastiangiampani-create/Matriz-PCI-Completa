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
const MODELS=new Set(['comun','tecnica']);
const SHIFTS=new Set(['manana','tarde','vespertino','noche']);
// Catálogo de nombres propios explicitados en Pautas PCI 05/10/2026, pp.16-17.
// Solo controla el ALTA; no reescribe documentos previos ni borra otros PCI.
const SPECIALTY_NAMES=new Set(["Automotores","Computación","Construcciones","Diseño y Comunicación Publicitaria","Diseño y Producción Gráfica","Electricidad","Electromecánica","Electrónica","Administración de Empresas","Industria de los Alimentos","Industria de la Indumentaria","Industrialización de la Madera y el Mueble","Industria de la Orfebrería","Jardinería, Paisajismo y Producción Vegetal","Mecánica","Óptica","Procesos Productivos Inteligentes","Producción Multimedial","Química","Tecnologías de la Información y la Comunicación (TIC)","Refrigeración, Ventilación, Calefacción y Aire Acondicionado","Metalurgia","Órtesis y Prótesis","Diseño de Interiores","Diseño de Artesanías Aplicadas a la Industria","Geógrafo Matemático"]);
const TECH_OFFICIAL_SOURCES=new Map([["Computación",{"id":"computacion","sha256":"85b890f7ff1ffbbfba0a7321bd592663255e644b31045321688dc55ee12e2f52"}],["Automotores",{"id":"automotores","sha256":"e77e54fb05569f278f364c19df39e0cb17ae9c9c78205eb993f78c7b8ba4878a"}],["Administración de Empresas",{"id":"administracion_empresas","sha256":"6156191c59cd348f454991081bd99ec8eca3f425435b659521eb1750ed3d59c6"}],["Mecánica",{"id":"mecanica","sha256":"66fb5468922faea6f725369d45d3befb80c3abd6bbb2c41432c75361c98a1737"}],["Electrónica",{"id":"electronica","sha256":"fa1c1132a5424b9ef311fe161a6dd6437bcf38ff8188dd606e7bbfb79ebf5498"}],["Electromecánica",{"id":"electromecanica","sha256":"b100e9a8d7b7c3d1e044b0d5c18fa9960a4df8adb089c1d828b2ecb12a63710c"}],["Electricidad",{"id":"electricidad","sha256":"aed37f7155a2893a8d973fe64b350d4779dd89c80dddcd0b6381ae0363d70136"}],["Diseño de Artesanías Aplicadas a la Industria",{"id":"diseno_artesanias","sha256":"dbc1ccedb3056ded78cfd66cd400c1e0c5268b3b519c14002ea74e8438fb020e"}],["Construcciones",{"id":"construcciones","sha256":"fb0ee3a6efb8ecd635fc314ff82b281aa48813e83afa3f046cfe317baf6f5832"}],["Diseño y Comunicación Publicitaria",{"id":"diseno_comunicacion_publicitaria","sha256":"826fb929f6ea75e5add3635f5be9351a222a12da1ce17210554e371c5b8851eb"}],["Diseño de Interiores",{"id":"diseno_interiores","sha256":"1decba76e9d3b41a9b04dee0d7610c6d6fba15595195625bb377c056c6774656"}],["Diseño y Producción Gráfica",{"id":"diseno_produccion_grafica","sha256":"17a6420c5e73a87c7c460836b4166f4ebf9293a9d09f817ec91550922b57f4d9"}],["Geógrafo Matemático",{"id":"geografo_matematico","sha256":"bcaaea4a8c7386c281d15704924038e08205b83eb131cc149b04b25fee887d67"}],["Industria de los Alimentos",{"id":"industria_alimentos","sha256":"e96f7e6fe719fe3cfe66b0ed4801a69f566383641faa01368a801b31b7f6d296"}],["Industria de la Indumentaria",{"id":"industria_indumentaria","sha256":"8a9dab9d444d14f9436185be48bdefc32e6f46e2d2bb9fa3e9f4d419ac62bde4"}],["Industrialización de la Madera y el Mueble",{"id":"industria_madera_mueble","sha256":"192e8a6fbe7f7c26493574a3359a227837b133c646f062d02e472d4aae201c62"}],["Jardinería, Paisajismo y Producción Vegetal",{"id":"jardineria_paisajismo_produccion_vegetal","sha256":"be0247ecb1fdb28cb5a2afbc4edfbeb0cea6dee2c2ac03c08b9334ede06d93dc"}],["Metalurgia",{"id":"metalurgia","sha256":"944230353398ce335e61952417d7d1ab6c58280febe745be916b74a085b60468"}],["Óptica",{"id":"optica","sha256":"28eb01a2caa837eaeac50d7c9586f73330273ee1c075105656a1951bad0f1c25"}],["Industria de la Orfebrería",{"id":"industria_orfebreria","sha256":"bed1aa1b124de4cbc0caa0b4c7b98f963ee7f3d6b1bda55230f0b0d2b2053816"}],["Órtesis y Prótesis",{"id":"ortesis_protesis","sha256":"25dfea19d495a4461a8f07f4e1a9e6ddb58745d86d1d44a7ac2d32a090f62fef"}],["Procesos Productivos Inteligentes",{"id":"procesos_productivos_inteligentes","sha256":"b05d16a6d258f02321af06f7b6ea3a34ce4394cd1126fdb9442ea3a56cd21e8e"}],["Producción Multimedial",{"id":"produccion_multimedial","sha256":"438faaa9b99985f88e31493630a4e59820317f910c6850ebe25b9f88f6ff760b"}],["Química",{"id":"quimica","sha256":"9f53ad906f899c0a1eef0a3b5c2b8fa48998df8aa535a130aa7f16837d1cca67"}],["Refrigeración, Ventilación, Calefacción y Aire Acondicionado",{"id":"refrigeracion_ventilacion_calefaccion_aire","sha256":"bf1b9b671edc8aa05f87ecd92a1d6db6e8679988cbfaed71a81df56d9b419c83"}],["Tecnologías de la Información y la Comunicación (TIC)",{"id":"tic","sha256":"ab37f365f3b8df6c8dc39d7b8d1066eac2c9ec2a4e64a2b003481e8b675870e8"}]]);
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
  if(component==='fo'&&!['fo-sec-aprende-v2/1','fo-tecnica-v1'].includes(version))return null;
  if(component==='articulacion'&&version!=='pci-articulacion-fg-fo/1')return null;
  if(component==='oferta'&&!['oferta-pci-orientacion-v1','oferta-tecnica-v1'].includes(version))return null;
  return {component,kind,unitId,version};
}
function checkTechnicalDocument({doc,unit,registered,original,sid,pciId}){
  const base=doc&&doc.model==='tecnica'&&doc.status==='borrador_no_homologado'&&
    Number(doc.school_id)===sid&&doc.pci_id===pciId&&
    doc.orientation_id===registered.orientation_id&&
    doc.process_id===registered.process_id&&
    doc.original_sha256===original.legacy_sha256&&
    doc.specialty_name===registered.specialty_name&&
    /^[0-9a-f]{64}$/i.test(String(doc.source_sha256||''))&&
    TECH_OFFICIAL_SOURCES.get(registered.specialty_name)?.id===doc.specialty_id&&
    TECH_OFFICIAL_SOURCES.get(registered.specialty_name)?.sha256===doc.source_sha256;
  if(!base)return false;
  if(unit.component==='oferta'&&unit.kind==='map'&&unit.version==='oferta-tecnica-v1'){
    if(doc.schema!=='pci-oferta-tecnica-v1/1'||!Array.isArray(doc.spaces)||
      doc.spaces.length<30||doc.spaces.length>160)return false;
    const ids=new Set();
    for(const space of doc.spaces){
      if(!space||typeof space.id!=='string'||ids.has(space.id)||space.id.length>240||
        !Number.isInteger(space.year)||space.year<1||space.year>6||
        !Number.isInteger(space.term)||space.term<1||space.term>12||
        Math.ceil(space.term/2)!==space.year||
        !['anual','cuatrimestral'].includes(space.duration)||
        space.endTerm!==(space.duration==='anual'?space.term+1:space.term)||
        !Array.isArray(space.subjectIds)||!Array.isArray(space.contentIds)||
        space.contentIds.length>400||space.subjectIds.length>400||
        typeof space.name!=='string'||space.name.length>240)return false;
      ids.add(space.id);
    }
    return true;
  }
  if(unit.component==='fo'&&unit.kind==='space'&&unit.version==='fo-tecnica-v1'){
    return doc.schema==='pci-fo-tecnica-v1/1'&&doc.space_id===unit.unitId&&
      Number.isInteger(doc.year)&&doc.year>=1&&doc.year<=6&&
      typeof doc.format==='string'&&doc.format.length<80&&
      Array.isArray(doc.plansBimestrales)&&doc.plansBimestrales.length===4&&
      doc.plansBimestrales.every((plan,index)=>plan&&Number(plan.number)===index+1&&
        plan.stages&&typeof plan.stages==='object'&&
        ['punto_partida','indagacion','produccion','evaluacion'].every(stage=>
          plan.stages[stage]&&typeof plan.stages[stage]==='object'));
  }
  return false;
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
      const model=text(body.model||'comun',12);
      const shift=text(body.shift_id||'manana',16);
      const orientation=text(body.orientation_id,80);
      const specialty=text(body.specialty_name,150);
      const title=text(body.title,150);
      if(!MODELS.has(model)||!SHIFTS.has(shift)||title.length<3 ||
        (model==='comun' && (!ALLOWED_ORIENTATIONS.has(orientation)||specialty.length>0)) ||
        (model==='tecnica' && (!SPECIALTY_NAMES.has(specialty) || orientation.length>0)))
        return reply({error:'Rama, orientación, especialidad o turno inválidos'},400);
      // Técnica: se registra ficha e historia, SIN habilitar editor de Media.
      // No inventamos la composición de especialidades pendiente de normativa.
      const result=await rpc('pci_workspace_create_pci_v2',{
        p_school_id:sid,p_orientation_id:model==='comun'?orientation:null,
        p_title:title,p_actor:actorName,p_model:model,p_shift_id:shift,
        p_specialty_name:model==='tecnica'?specialty:null
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
    const technical=registered.model==='tecnica';
    // Técnica usa su propio contrato y sus propios IDs de PCI/Proceso. Nunca
    // habilitar formatos de Media en una especialidad ni viceversa.
    const permitted=technical?
      (unit.component==='oferta'&&unit.kind==='map'&&unit.version==='oferta-tecnica-v1')||
      (unit.component==='fo'&&unit.kind==='space'&&unit.version==='fo-tecnica-v1'):
      (registered.curriculum_status!=='pending_rules'&&
        !['oferta-tecnica-v1','fo-tecnica-v1'].includes(unit.version));
    if(!permitted)return reply({error:technical?
      'Este PCI Técnico admite exclusivamente mapa y planes técnicos; no admite contenidos de Media.':
      'La unidad no corresponde a este modelo curricular.'},423);
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
    if(technical){
      if(!checkTechnicalDocument({doc,unit,registered,original,sid,pciId}))
        return reply({error:'Borrador técnico inválido, no homologado o perteneciente a otra especialidad.'},400);
      if(unit.component==='fo'){
        const parent=await rpc('pci_collab_get_unit_v1',{
          ...scope,p_component:'oferta',p_unit_kind:'map',p_unit_id:'mapa-oferta-tecnica-v1'
        });
        const parentSpace=parent?.exists&&parent.document?.model==='tecnica'&&
          parent.document?.specialty_id===doc.specialty_id&&
          parent.document?.source_sha256===doc.source_sha256&&
          parent.document?.spaces?.find?.(s=>s.id===doc.space_id);
        if(!parentSpace||parentSpace.year!==doc.year||parentSpace.format!==doc.format)
          return reply({error:'Primero guardá el mapa técnico vigente; el espacio o su año no coincide.'},409);
      }
    }else if((unit.component==='fg' && (
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
