import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.117.3';

// API multi-PCI independiente de pci-access. Solamente crea registros nuevos y
// guarda unidades curriculares aisladas; NUNCA actualiza pci_proposals.data.
// Reutiliza la misma firma de sesion institucional ya verificada en pci-access.
const cors={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type',
 'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Content-Type':'application/json',
 'Cache-Control':'no-store',
};
const endpoint=Deno.env.get('SUPABASE_URL');
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!endpoint||!secret)throw Error('Faltan credenciales de servicio del proyecto.');
const db=createClient(endpoint,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const encoder=new TextEncoder(),decoder=new TextDecoder();
const ALLOWED_MODELS=['comun','tecnica','ba15'];
const ALLOWED_SHIFTS=['manana','tarde','vespertino','noche'];
const validSchool=id=>Number.isSafeInteger(Number(id))&&Number(id)>=1001;
const validUuid=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:cors});
const err=(message,status=400)=>json({error:message},status);
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const clean=(v,max=180)=>String(v??'').trim().slice(0,max);
const fromUrlBase64=part=>{
 const normalized=part.replace(/-/g,'+').replace(/_/g,'/');
 const binary=atob(normalized+'='.repeat((4-normalized.length%4)%4));
 return Uint8Array.from(binary,c=>c.charCodeAt(0));
};
let verificationKey;
async function verifySessionToken(token){
 if(typeof token!=='string'||token.length>10000)return null;
 const [body,signature,...rest]=token.split('.');
 if(!body||!signature||rest.length)return null;
 try{
  if(!verificationKey)verificationKey=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const good=await crypto.subtle.verify('HMAC',verificationKey,fromUrlBase64(signature),encoder.encode(body));
  if(!good)return null;
  const session=JSON.parse(decoder.decode(fromUrlBase64(body)));
  if(!object(session)||!Number.isSafeInteger(session.exp)||session.exp<Date.now()
     ||!['admin','user','editor','school_admin'].includes(session.role))return null;
  // Tokens de usuarios internos deben contrastarse con permisos y adscripciones actuales.
  if(session.role==='user'){
   if(!session.user_id)return null;
   const {data,error}=await db.from('pci_users').select('is_active,permissions,all_schools,profile_key,username,first_name,last_name,email').eq('id',session.user_id).maybeSingle();
   if(error||!data||!data.is_active)return null;
   const links=await db.from('pci_user_schools').select('school_id').eq('user_id',session.user_id);
   if(links.error)return null;
   return {...session,permissions:Array.isArray(data.permissions)?data.permissions:[],
      all_schools:!!data.all_schools,school_ids:(links.data||[]).map(x=>Number(x.school_id)),
      profile_key:data.profile_key,username:data.username,
      identity:{first_name:data.first_name,last_name:data.last_name,email:data.email}};
  }
  return session;
 }catch{return null}
}
function isScoped(s,sid){
 if(s.role==='admin')return true;
 if(s.role==='user')return !!s.all_schools||(s.school_ids||[]).map(Number).includes(sid);
 return Number(s.school_id)===sid;
}
function canRead(s){
 return s.role==='admin'||s.role==='editor'||s.role==='school_admin'
   ||(s.role==='user'&&(s.permissions||[]).some(x=>x==='pci.view'||x==='pci.edit'));
}
function canEdit(s){
 return s.role==='admin'||s.role==='editor'
   ||(s.role==='user'&&(s.permissions||[]).includes('pci.edit'));
}
function canDeclareOrientations(s){
 // El referente institucional puede declarar la oferta (modelo, orientación
 // y turno) de su escuela. NO puede escribir documentos ni planes FG/FO.
 return canEdit(s)||s.role==='school_admin';
}
function actor(s){
 const id=s.identity||{};
 return clean([id.first_name,id.last_name].filter(Boolean).join(' ')||id.email||s.username||s.user||s.role,160);
}
async function rpc(name,args){
 const {data,error}=await db.rpc(name,args);
 if(error)throw Error('Error de base de datos ('+(error.code||'RPC')+'): '+clean(error.message,220));
 return data;
}
async function authorizedPci(s,body,requireEdit=false){
 const sid=Number(body.school_id),pci_id=body.pci_id;
 if(!validSchool(sid)||!validUuid(pci_id)||!isScoped(s,sid)||!(requireEdit?canEdit(s):canRead(s)))
  throw Error('Sin permiso de acceso a este PCI.');
 const p=await rpc('pci_workspace_get_pci_v1',{p_school_id:sid,p_pci_id:pci_id});
 if(!p||Number(p.school_id)!==sid||p.pci_id!==pci_id)
  throw Error('No se encontró el PCI en la escuela autorizada.');
 return p;
}
function allowedUnit(p,body){
 const component=body.component,kind=body.unit_kind,base=body.base_version;
 const existing={
  comun:[['fg','area','fg-sec-aprende-v2/1'],['oferta','map','oferta-pci-orientacion-v1'],['fo','space','fo-sec-aprende-v2/1']],
  tecnica:[['oferta','map','oferta-tecnica-v1'],['fo','space','fo-tecnica-v1']],
  ba15:[['oferta','map','oferta-ba15-constructor-v1']]
 };
 const v2={
  comun:['mapa-original-v2-v1','v2-original-embedded-v1'],
  tecnica:['mapa-v2-familia-tecnica-v1','v2-familia-tecnica-20261120/1'],
  ba15:['mapa-v2-familia-ba15-v1','v2-familia-ba15-20261120/1']
 }[p.model];
 const validId=typeof body.unit_id==='string'&&body.unit_id.length>0&&body.unit_id.length<=240;
 return validId&&(
  (existing[p.model]||[]).some(x=>x[0]===component&&x[1]===kind&&x[2]===base)||
  (component==='oferta'&&kind==='map'&&v2&&body.unit_id===v2[0]&&base===v2[1])
 );
}
function documentIsScoped(p,body){
 const d=body.document;
 if(!object(d))return false;
 // Sobre completo del motor V2 por PCI. No se admite un documento
 // ajeno, ni mezclas de orientaciones/turnos, ni modificación de la identidad.
 const v2Versions={
  comun:'v2-original-embedded-v1',
  tecnica:'v2-familia-tecnica-20261120/1',
  ba15:'v2-familia-ba15-20261120/1'
 };
 if(body.component==='oferta'&&body.unit_kind==='map'&&
    body.base_version===v2Versions[p.model]){
  const v=d.v2;
  return d.schema===body.base_version&&d.model===p.model
   &&Number(d.schoolId)===Number(p.school_id)
   &&d.pciId===p.pci_id&&d.orientationId===p.orientation_id
   &&d.shiftId===p.shift_id&&d.processId===p.process_id
   &&d.legacySha256===p.legacy_sha256
   &&object(v)&&typeof v.active==='string'&&v.active.length>0&&v.active.length<=150
   &&Array.isArray(v.selected)&&v.selected.length===1&&v.selected[0]===v.active
   &&object(v.maps)&&Object.keys(v.maps).length===1&&object(v.maps[v.active])
   &&(!v.maps[v.active].placements||object(v.maps[v.active].placements))
   &&(!v.institutional||object(v.institutional));
 }
 // Mantener compatibilidad 1:1 con los documentos anteriores.
 if(p.model==='ba15'){
  return body.component==='oferta'&&d.schema==='ba15-constructor-v1'
   &&Number(d.schoolId)===Number(p.school_id)&&d.pciId===p.pci_id
   &&d.orientationId===p.orientation_id&&d.shiftId===p.shift_id
   &&Array.isArray(d.niveles)&&d.niveles.length===4
   &&d.niveles.every((level,i)=>level?.nivel===i+1&&Array.isArray(level.espacios));
 }
 return Number(d.school_id)===Number(p.school_id)&&d.pci_id===p.pci_id
   &&d.orientation_id===p.orientation_id&&d.original_sha256===p.legacy_sha256
   &&(p.model!=='tecnica'||(d.model==='tecnica'&&d.process_id===p.process_id));
}

/**
 * Asignación de trabajo histórico por escuela, usando la unidad de articulación
 * V1 ya soportada por Supabase. Una sola revisión transaccional relaciona
 * TODOS los PCI de la escuela. No modifica el documento FG histórico.
 */
const LEGACY_LINK_UNIT={
 p_orientation_id:'_general',p_process_id:'vinculos-historicos-v1',
 p_component:'articulacion',p_unit_kind:'link',p_unit_id:'asignacion-trabajo-anterior'
};
const LEGACY_LINK_SCHEMA='pci-vinculos-historicos-v1';
function historicalGroupRows(original){
 const out=[],seen=new Set();
 const areas=original?.areas;
 if(!object(areas))return out;
 for(const [area,section] of Object.entries(areas)){
  for(const group of Array.isArray(section?.groups)?section.groups:[]){
   const id=String(group?.id??'').trim();
   if(!area||!id||id.length>160||area.length>160)continue;
   const key=JSON.stringify([area,id]);
   if(seen.has(key))continue;
   seen.add(key);
   const items=Array.isArray(group.items)?group.items:[];
   const plans=Array.isArray(group.plansBimestrales)?group.plansBimestrales:[];
   const hasText=['synopsis','summary','objective','objectives','context','practiceAxis']
     .some(k=>String(group?.[k]||'').trim().length>0)||
     plans.some(p=>String(p?.synopsis||p?.objectives||'').trim().length>0||
       Array.isArray(p?.contentIds)&&p.contentIds.length>0||
       Object.values(p?.stages||{}).some(st=>String(typeof st==='string'?st:st?.description||'').trim()));
   out.push({area,id,name:clean(group.name||group.label||id,160),
    contents:items.length,plans:plans.length,hasWork:items.length>0||hasText});
  }
 }
 return out;
}
async function schoolLegacySource(sid){
 const {data,error}=await db.from('pci_proposals')
  .select('data,updated_at').eq('school_id',sid).maybeSingle();
 if(error)throw error;
 if(!data||!object(data.data))throw Error('La fuente histórica de esta escuela no está disponible.');
 return data;
}
async function fetchLegacyLinks(sid){
 return rpc('pci_collab_get_unit_v1',{p_school_id:sid,...LEGACY_LINK_UNIT});
}
async function listPcisForLinks(sid){
 const result=await rpc('pci_workspace_list_pcis_v1',{p_school_id:sid});
 return Array.isArray(result)?result:[];
}
function validateLegacyAssignment(input,sourceRows,pcis,sid,updated){
 if(!object(input)||input.schema!==LEGACY_LINK_SCHEMA||
    Number(input.school_id)!==sid||String(input.source_updated_at||'')!==String(updated)||
    !Array.isArray(input.assignments)||input.assignments.length>4000)
   throw Error('Versión o origen de asignación histórica incompatibles. Actualizá antes de guardar.');
 const valid=new Set(sourceRows.map(r=>JSON.stringify([r.area,r.id])));
 const pciMap=new Map(pcis.map(p=>[p.pci_id,p]));
 const seen=new Set(),entries=[];
 for(const item of input.assignments){
  if(!object(item))throw Error('Vínculo inválido.');
  const area=clean(item.area,161),id=clean(item.id,161);
  if(!area||!id||area.length>160||id.length>160)throw Error('Área o agrupamiento inválido.');
  const key=JSON.stringify([area,id]);
  if(seen.has(key)||!valid.has(key))throw Error('Agrupamiento duplicado o inexistente en el documento original.');
  seen.add(key);
  const kind=String(item.kind||''),mode=String(item.mode||'');
  if(!['general','orientada','tecnica'].includes(kind)||!['all','selected'].includes(mode))
    throw Error('Tipo de vínculo histórico inválido.');
  const ids=item.pci_ids;
  if(!Array.isArray(ids)||ids.length>pcis.length||
     ids.some(id=>typeof id!=='string'||!validUuid(id))||
     new Set(ids).size!==ids.length||ids.some(id=>!pciMap.has(id)))
    throw Error('Existe un PCI ajeno a la escuela o repetido.');
  if(mode==='all'&&(kind!=='general'||ids.length))
    throw Error('Solo la FG compartida puede asignarse a todos los PCI.');
  const targets=ids.map(id=>pciMap.get(id));
  if(kind==='orientada'){
   if(targets.some(p=>!['comun','ba15'].includes(p.model))||
      new Set(targets.map(p=>p.model+':'+p.orientation_id)).size>1)
     throw Error('El trabajo orientado debe pertenecer a una misma orientación y modelo, aunque tenga varios turnos.');
  }
  if(kind==='tecnica'){
   if(targets.some(p=>p.model!=='tecnica')||
      new Set(targets.map(p=>p.orientation_id)).size>1)
     throw Error('El trabajo técnico debe pertenecer a una misma especialidad, aunque tenga varios turnos.');
  }
  entries.push({area,id,kind,mode,pci_ids:ids});
 }
 return {schema:LEGACY_LINK_SCHEMA,school_id:sid,source_updated_at:String(updated),assignments:entries};
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return err('Solo POST.',405);
 try{
  if(Number(req.headers.get('content-length')||0)>1400000)return err('Solicitud demasiado grande.',413);
  let body;
  try{body=await req.json()}catch{return err('JSON inválido.')}
  if(!object(body))return err('Solicitud inválida.');
  const action=String(body.action||'');
  if(action==='health')return json({ok:true,service:'pci-multipci',mode:'additive',legacy_writes:false});
  const s=await verifySessionToken(body.token);
  if(!s)return err('Sesión inválida o vencida.',401);
  if(action==='session-info'){
   return json({role:s.role,username:s.username||s.user||'',
      profile_key:s.profile_key||'',permissions:s.role==='admin'?['pci.view','pci.edit','institutional.view']:(s.permissions||[]),
      all_schools:s.role==='admin'?true:!!s.all_schools,school_ids:s.school_ids||[],identity:s.identity||null,superadmin:s.role==='admin'});
  }
  if(action==='list-schools'){
   if(!canRead(s)||!['admin','user'].includes(s.role))return err('Sin permiso.',403);
   const response=await db.from('pci_proposals').select('school_id,data').gte('school_id',1001).order('school_id');
   if(response.error)throw response.error;
   return json({schools:(response.data||[]).filter(row=>isScoped(s,Number(row.school_id)))
    .map(row=>({school_id:row.school_id,name:row.data?.schoolName||'Escuela '+row.school_id,cue:row.data?._meta?.cue||'',model:row.data?.profile==='tecnica'?'tecnica':'comun'}))});
  }
  if(action==='create-school-v2'){
   if(s.role!=='admin')return err('Solo administración.',403);
   const name=clean(body.name,150),cue=clean(body.cue,35).toUpperCase(),email=clean(body.email,180),year=Number(body.year);
   if(name.length<3||!/^[A-Z0-9./_-]{3,35}$/.test(cue)||!Number.isSafeInteger(year)||year<2020||year>2100)return err('Datos de escuela incompletos.');
   for(let attempt=0;attempt<4;attempt++){
    const code='PCI-'+String(crypto.getRandomValues(new Uint32Array(1))[0]%10000).padStart(4,'0');
    const primary='DIR-'+crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase();
    const {data,error}=await db.rpc('pci_workspace_create_school_v1',{
     p_name:name,p_cue:cue,p_email:email,p_year:year,p_edit_code:code,p_primary_code:primary,p_actor:actor(s)});
    if(!error)return json({...data,edit_code:code,primary_code:primary});
    if(error.code!=='23505')throw error;
   }
   return err('No se pudo asignar una clave única. No se creó ninguna escuela.',409);
  }
  const sid=Number(body.school_id);
  if(!validSchool(sid)||!isScoped(s,sid)||!canRead(s))return err('Escuela fuera del alcance autorizado.',403);
  if(action==='get-school-legacy-links'){
   const [source,saved]=await Promise.all([schoolLegacySource(sid),fetchLegacyLinks(sid)]);
   if(saved?.exists&&
      (saved?.document?.schema!==LEGACY_LINK_SCHEMA||Number(saved.document.school_id)!==sid))
     return err('Existe una asignación histórica incompatible; revisión manual necesaria.',409);
   return json({source_updated_at:source.updated_at,
     source_model:source.data?.profile==='tecnica'?'tecnica':'comun',
     rows:historicalGroupRows(source.data),
     revision:Number(saved?.revision)||0,
     document:saved?.exists?saved.document:null,
     exists:!!saved?.exists
   });
  }
  if(action==='save-school-legacy-links'){
   if(!canDeclareOrientations(s))return err('Sin permiso para asignar trabajo anterior a los PCI.',403);
   const source=await schoolLegacySource(sid);
   if(String(body.document?.source_updated_at||'')!==String(source.updated_at))
     return err('El documento histórico fue actualizado mientras asignabas. No se guardó nada: actualizá la escuela y conciliá los cambios.',409);
   const pcis=await listPcisForLinks(sid);
   const document=validateLegacyAssignment(body.document,historicalGroupRows(source.data),pcis,sid,source.updated_at);
   if(encoder.encode(JSON.stringify(document)).byteLength>300000)return err('Asignación demasiado extensa.',413);
   const expected=Number(body.expected_revision);
   if(!Number.isSafeInteger(expected)||expected<0)return err('Revisión esperada inválida.');
   const result=await rpc('pci_collab_save_unit_v1',{
     p_school_id:sid,...LEGACY_LINK_UNIT,
     p_base_version:'pci-articulacion-fg-fo/1',
     p_expected_revision:expected,p_document:document,p_actor:actor(s)
   });
   if(result?.code==='stale_revision'||result?.status===409)return json(result,409);
   if(result?.ok!==true)return err('Supabase no confirmó el vínculo histórico.',409);
   return json({...result,linked_groups:document.assignments.length});
  }
  if(action==='list-school-pcis'){
   const list=await rpc('pci_workspace_list_pcis_v1',{p_school_id:sid});
   return json({pcis:Array.isArray(list)?list:[]});
  }
  if(action==='create-school-pci'){
   if(!canDeclareOrientations(s))return err('Sin permiso para declarar orientaciones.',403);
   const model=String(body.model||''),shift=String(body.shift_id||''),title=clean(body.title,150);
   if(!ALLOWED_MODELS.includes(model)||!ALLOWED_SHIFTS.includes(shift)||title.length<3)return err('Modelo, turno o título inválido.');
   const orientation=model==='tecnica'?'':String(body.orientation_id||'');
   const specialty=model==='tecnica'?clean(body.specialty_name,150):null;
   if(model==='tecnica'&&(!specialty||specialty.length<3))return err('Seleccioná una especialidad.');
   if(model!=='tecnica'&&!/^[a-z][a-z0-9_]{2,79}$/.test(orientation))return err('Orientación inválida.');
   const newPci=await rpc('pci_workspace_create_pci_v2',{
    p_school_id:sid,p_orientation_id:orientation,p_title:title,p_actor:actor(s),
    p_model:model,p_shift_id:shift,p_specialty_name:specialty});
   return json(newPci,201);
  }
  if(action==='get-school-pci'){
   const p=await authorizedPci(s,body);
   return json({pci:p});
  }
  if(action==='get-school-pci-unit'||action==='save-school-pci-unit'){
   const saving=action==='save-school-pci-unit';
   const p=await authorizedPci(s,body,saving);
   if(!allowedUnit(p,body))return err('Unidad y modalidad incompatibles.',400);
   const base={
    p_school_id:sid,p_orientation_id:p.orientation_id,p_process_id:p.process_id,
    p_component:body.component,p_unit_kind:body.unit_kind,p_unit_id:body.unit_id
   };
   if(!saving){
    const data=await rpc('pci_collab_get_unit_v1',base);
    if(data?.exists&&data?.base_version!==body.base_version)return err('Versión curricular diferente: no se cargó el documento.',409);
    return json(data);
   }
   if(!['borrador','en_revision'].includes(p.status))return err('PCI cerrado para edición.',403);
   if(!documentIsScoped(p,body))return err('Documento ajeno o estructura incompatible.',400);
   const document=body.document;
   if(encoder.encode(JSON.stringify(document)).byteLength>950000)return err('Documento curricular demasiado grande.',413);
   const expected=Number(body.expected_revision);
   if(!Number.isSafeInteger(expected)||expected<0)return err('Revisión esperada inválida.');
   const result=await rpc('pci_collab_save_unit_v1',{
      ...base,p_base_version:body.base_version,p_expected_revision:expected,
      p_document:document,p_actor:actor(s)
   });
   if(result?.status===409||result?.code==='stale_revision')return json(result,409);
   if(result?.ok!==true)return err('El servidor no confirmó el guardado.',409);
   return json(result);
  }
  return err('Acción no disponible en este servicio.',404);
 }catch(error){
  console.error('pci-multipci error',error?.message||error);
  const message=String(error?.message||'No se pudo completar la operación.');
  const permission=message.includes('permiso')||message.includes('autorizado')||message.includes('ajeno');
  return err(permission?'Sin permiso para esta operación.':'La operación no se completó. Revisá los datos y reintentá.',permission?403:500);
 }
});
