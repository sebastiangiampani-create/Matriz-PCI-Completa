// Nueva función Supabase aislada. NO reemplaza pci-access.
// Se activa únicamente con PCI_COLLAB_ENABLED=true configurada en secretos del proyecto.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const url=Deno.env.get('SUPABASE_URL') || '';
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const enabled=Deno.env.get('PCI_COLLAB_ENABLED')==='true';
const db=createClient(url,secret,{auth:{persistSession:false}});
const cors={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'content-type,authorization,apikey',
 'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Content-Type':'application/json; charset=utf-8'
};
const encoder=new TextEncoder();
const json=(payload:unknown,status=200)=>new Response(JSON.stringify(payload),{status,headers:cors});
const decode=(x:string)=>{x=x.replace(/-/g,'+').replace(/_/g,'/');return atob(x.padEnd(Math.ceil(x.length/4)*4,'='));};
const b64u=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function hmac(raw:string) {
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),'HMAC',false,['sign']);
 return b64u(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(raw))));
}
async function sessionOf(token:unknown) {
 if(typeof token!=='string'||token.length>12000)return null;
 const [body,sig,...extra]=token.split('.');
 if(!body||!sig||extra.length)return null;
 try{
  const expected=await hmac(body);
  const a=encoder.encode(expected),b=encoder.encode(sig);
  if(a.length!==b.length)return null;
  let n=0;for(let i=0;i<a.length;i++)n|=a[i]^b[i];
  if(n!==0)return null;
  const session=JSON.parse(decode(body));
  if(!Number.isFinite(session.exp)||session.exp<=Date.now())return null;
  if(session.role==='user'&&session.user_id){
   const {data,error}=await db.from('pci_users')
    .select('is_active,permissions,all_schools,first_name,last_name,email')
    .eq('id',session.user_id).maybeSingle();
   if(error||!data?.is_active)return null;
   const {data:links,error:le}=await db.from('pci_user_schools').select('school_id').eq('user_id',session.user_id);
   if(le)return null;
   return {...session,permissions:data.permissions||[],all_schools:!!data.all_schools,
    school_ids:(links||[]).map(x=>Number(x.school_id)),
    identity:{first_name:data.first_name,last_name:data.last_name,email:data.email}};
  }
  return session;
 }catch{return null;}
}
function permitted(s:any,id:number,write:boolean){
 if(!Number.isSafeInteger(id)||id<1001)return false;
 if(s.role==='admin')return true;
 if(s.role==='editor')return Number(s.school_id)===id;
 if(s.role!=='user')return false;
 const allowed=s.all_schools||(s.school_ids||[]).map(Number).includes(id);
 return allowed&&(s.permissions||[]).includes(write?'pci.edit':'pci.view');
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('',{headers:cors});
 if(req.method!=='POST')return json({error:'Método no permitido'},405);
 if(!enabled)return json({error:'Concurrencia no habilitada'},503);
 let body:any;
 try{body=await req.json()}catch{return json({error:'JSON inválido'},400)}
 const session=await sessionOf(body.token);
 if(!session)return json({error:'Sesión inválida'},401);
 const schoolId=Number(body.school_id),action=String(body.action||'');
 if(!['get-area','save-area'].includes(action))return json({error:'Acción inválida'},400);
 if(!permitted(session,schoolId,action==='save-area'))return json({error:'Sin permiso'},403);
 const area=String(body.area||'');
 if(!area||area.length>140||/[\u0000-\u001f]/.test(area)||['__proto__','constructor','prototype'].includes(area))
   return json({error:'Área inválida'},400);
 try{
  if(action==='get-area'){
   const {data,error}=await db.from('pci_proposals').select('data,updated_at').eq('school_id',schoolId).maybeSingle();
   if(error)throw error;
   if(!data)return json({error:'Escuela inexistente'},404);
   return json({ok:true,area,document:data.data?.areas?.[area]??null,updated_at:data.updated_at});
  }
  const next=body.document,expected=body.expected_document??null;
  if(!next||typeof next!=='object'||Array.isArray(next)||
     (expected!==null&&(typeof expected!=='object'||Array.isArray(expected))))
   return json({error:'Documento inválido'},400);
  const actor=session.identity||{};
  const {data,error}=await db.rpc('pci_collab_patch_area_v1',{
   p_school_id:schoolId,p_area_name:area,p_expected_area:expected,p_next_area:next,
   p_actor_role:session.role,
   p_actor_name:[actor.first_name,actor.last_name].filter(Boolean).join(' ')||session.username||session.user||'Editor',
   p_actor_email:actor.email||''
  });
  if(error)throw error;
  return json(data,data?.ok?200:(data?.status===409?409:404));
 }catch(err){
  console.error('pci-collab error',err);
  return json({error:'No se pudo completar la operación'},500);
 }
});
