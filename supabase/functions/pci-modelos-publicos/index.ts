import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.117.3';
import {PLAN_MODELS,BUCKET,fileMeta,verifyMagic,cleanText,validUuid,validModel,validAdminToken} from './validaciones.mjs';

// Biblioteca institucional de MODELOS PÚBLICOS: ninguna tabla ni clave PCI escolar.
const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const tokenSecret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TABLE='pci_modelos_planes_publicos';
const headers={
  'Content-Type':'application/json; charset=utf-8',
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization,apikey,content-type',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff'
};
const response=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});
const fail=(text:string,status=400)=>response({error:text},status);
const rowFields='id,modalidad,titulo,descripcion,archivo_nombre,archivo_ruta,tipo_archivo,publicado,archivado,created_at,updated_at';
const signed=async(row:any)=>{
  const {data,error}=await supabase.storage.from(BUCKET).createSignedUrl(row.archivo_ruta,20*60);
  if(error)throw Error('No se pudo crear el enlace de lectura.');
  return {...row,url:data.signedUrl};
};
async function listModels(admin:boolean){
  let q=supabase.from(TABLE).select(rowFields).order('updated_at',{ascending:false}).limit(300);
  if(!admin)q=q.eq('publicado',true).eq('archivado',false);
  const {data,error}=await q;
  if(error)throw error;
  return Promise.all((data||[]).map(signed));
}
function prepare(input:any){
  const modalidad=String(input.modalidad||'');
  const titulo=cleanText(input.titulo,140);
  const descripcion=cleanText(input.descripcion,2500);
  if(!validModel(modalidad))throw Error('Elegí Media, Técnica o BA+15.');
  if(titulo.length<3)throw Error('Ingresá un título de al menos 3 caracteres.');
  return {modalidad,titulo,descripcion,publicado:input.publicado===true||input.publicado==='true'||input.publicado==='1',updated_at:new Date().toISOString()};
}
async function upload(form:FormData){
  const file=form.get('archivo');
  if(!(file instanceof File))return fail('Seleccioná un documento para cargar.');
  const meta=fileMeta(file);
  const payload=prepare(Object.fromEntries(form.entries()));
  const bytes=new Uint8Array(await file.arrayBuffer());
  verifyMagic(bytes,meta.magic);
  const id=String(form.get('id')||'');
  if(id&&!validUuid(id))return fail('Identificador inválido.');
  let existing:any=null;
  if(id){
    const {data,error}=await supabase.from(TABLE).select('id,archivo_ruta').eq('id',id).maybeSingle();
    if(error)throw error;
    if(!data)return fail('No se encontró el modelo.',404);
    existing=data;
  }
  const filename=crypto.randomUUID()+'.'+meta.ext;
  const path=payload.modalidad+'/'+filename;
  const {error:storageError}=await supabase.storage.from(BUCKET).upload(path,bytes,{
    contentType:meta.mime,upsert:false,cacheControl:'3600'
  });
  if(storageError)throw storageError;
  const write={...payload,archivo_ruta:path,archivo_nombre:meta.filename,tipo_archivo:meta.mime,archivado:false};
  const query=existing
    ?supabase.from(TABLE).update(write).eq('id',id)
    :supabase.from(TABLE).insert(write);
  const {data,error}=await query.select(rowFields).single();
  if(error){
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
  // Se conserva en privado el fichero reemplazado para permitir recuperación.
  return response({ok:true,modelo:await signed(data)},existing?200:201);
}
async function modify(body:any,action:string){
  const id=String(body.id||'');
  if(!validUuid(id))return fail('Modelo inexistente.');
  let write:any;
  if(action==='guardar-modelo'){
    write=prepare(body);
  }else if(action==='archivar-modelo'){
    write={publicado:false,archivado:true,updated_at:new Date().toISOString()};
  }else if(action==='restaurar-modelo'){
    write={publicado:false,archivado:false,updated_at:new Date().toISOString()};
  }else return fail('Acción no válida.');
  const {data,error}=await supabase.from(TABLE).update(write).eq('id',id).select(rowFields).maybeSingle();
  if(error)throw error;
  if(!data)return fail('No se encontró el modelo.',404);
  return response({ok:true,modelo:await signed(data)});
}

Deno.serve(async(request:Request)=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return fail('Método no permitido.',405);
  try{
    const kind=request.headers.get('content-type')||'';
    if(kind.includes('multipart/form-data')){
      const length=Number(request.headers.get('content-length')||0);
      if(length>9*1024*1024)return fail('Archivo demasiado grande.',413);
      const form=await request.formData();
      if(form.get('action')!=='cargar-modelo')return fail('Acción no válida.');
      if(!await validAdminToken(form.get('token'),tokenSecret))return fail('Solo Administración general puede cargar modelos.',403);
      return await upload(form);
    }
    if(!kind.includes('application/json'))return fail('Formato de petición inválido.',415);
    const body=await request.json();
    const action=String(body?.action||'');
    if(action==='listar-publicos')return response({modelos:await listModels(false)});
    if(!await validAdminToken(body?.token,tokenSecret))return fail('Solo Administración general puede administrar modelos.',403);
    if(action==='listar-modelos')return response({modelos:await listModels(true)});
    if(['guardar-modelo','archivar-modelo','restaurar-modelo'].includes(action))return modify(body,action);
    return fail('Acción no válida.');
  }catch(e){
    const m=String(e instanceof Error?e.message:'Error inesperado');
    if(/Elegí|Ingresá|formato|archivo|Archivo|tipo de archivo|extensión|permitido/i.test(m))return fail(m);
    console.error('pci-modelos-publicos:',m);
    return fail('No se pudo completar la operación. No se modificaron los PCI escolares.',500);
  }
});
