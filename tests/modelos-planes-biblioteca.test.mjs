import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {PLAN_MODELS,BUCKET,FILE_LIMIT,fileMeta,verifyMagic,cleanText,validModel,validUuid,validAdminToken} from '../supabase/functions/pci-modelos-publicos/validaciones.mjs';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const base64url=buf=>Buffer.from(buf).toString('base64url');
async function tokenFor(payload,secret){
 const body=base64url(Buffer.from(JSON.stringify(payload),'utf8'));
 const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode(body));
 return body+'.'+base64url(signature);
}
test('solo hay tres modalidades V2 y no se mezclan con escuelas',()=>{
 assert.deepEqual([...PLAN_MODELS],['comun','tecnica','ba15']);
 assert.equal(BUCKET,'pci-modelos-planes-v2');
 for(const model of PLAN_MODELS)assert.equal(validModel(model),true);
 assert.equal(validModel('comun; drop table'),false);
 assert.equal(validUuid('123'),false);
});
test('archivo PDF/DOCX/XLSX limitado a 8 MB, con extensión, MIME y firma',()=>{
 assert.equal(FILE_LIMIT,8388608);
 for(const [name,type,magic] of [['modelo.pdf','application/pdf','pdf'],['modelo.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document','zip'],['modelo.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','zip']]){
  const meta=fileMeta({name,size:200,type});
  assert.equal(meta.magic,magic);
 }
 assert.throws(()=>fileMeta({name:'malicioso.html',size:55,type:'text/html'}),/Formato permitido/);
 assert.throws(()=>fileMeta({name:'modelo.pdf',size:8388609,type:'application/pdf'}),/8 MB/);
 assert.throws(()=>fileMeta({name:'modelo.pdf',size:200,type:'text/html'}),/tipo de archivo/);
 verifyMagic(new Uint8Array([37,80,68,70,45,20]),'pdf');
 verifyMagic(new Uint8Array([80,75,3,4,20]),'zip');
 assert.throws(()=>verifyMagic(new Uint8Array([60,104,116,109,108]),'pdf'));
 assert.equal(cleanText('  Modelo \n de planes  ',140),'Modelo   de planes');
});
test('solo el token HMAC válido del superadmin puede cargar modelos; una clave PCI no sirve',async()=>{
 const secret='solo-en-pruebas-este-secret-no-existe-en-supabase';
 const admin=await tokenFor({role:'admin',superadmin:true,exp:Date.now()+360000},secret);
 assert.equal(await validAdminToken(admin,secret),true);
 assert.equal(await validAdminToken(admin+'.corrupcion',secret),false);
 assert.equal(await validAdminToken(admin.slice(0,-4)+'abcd',secret),false);
 const editor=await tokenFor({role:'editor',superadmin:false,exp:Date.now()+360000},secret);
 assert.equal(await validAdminToken(editor,secret),false);
 const internal=await tokenFor({role:'user',profile_key:'admin_general',exp:Date.now()+360000},secret);
 assert.equal(await validAdminToken(internal,secret),false);
 const expired=await tokenFor({role:'admin',superadmin:true,exp:Date.now()-1000},secret);
 assert.equal(await validAdminToken(expired,secret),false);
 assert.equal(await validAdminToken('no-token',secret),false);
});
test('el esquema es aditivo, privado y solo el servicio autorizado accede a la tabla',async()=>{
 const sql=await read('supabase/sql/pci_modelos_planes_publicos_v1.sql');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.pci_modelos_planes_publicos/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON public\.pci_modelos_planes_publicos FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/GRANT SELECT,INSERT,UPDATE,DELETE ON public\.pci_modelos_planes_publicos TO service_role/);
 assert.match(sql,/storage\.buckets/);
 assert.match(sql,/false,8388608/);
 assert.doesNotMatch(sql,/ALTER TABLE public\.pci_proposals|UPDATE public\.pci_proposals|DELETE FROM public\.pci_proposals|UPDATE pci_workspace/i);
});
test('biblioteca pública solo obtiene registros publicados; cambios exclusivamente con admin firmado',async()=>{
 const edge=await read('supabase/functions/pci-modelos-publicos/index.ts');
 assert.match(edge,/if\(action==='listar-publicos'\)return response\(\{modelos:await listModels\(false\)\}\)/);
 assert.match(edge,/\.eq\('publicado',true\)\.eq\('archivado',false\)/);
 assert.match(edge,/validAdminToken\(body\?\.token,tokenSecret\)/);
 assert.match(edge,/validAdminToken\(form\.get\('token'\),tokenSecret\)/);
 assert.match(edge,/\.createSignedUrl\(row\.archivo_ruta,20\*60\)/);
 assert.match(edge,/if\(action==='listar-modelos'\)/);
 assert.match(edge,/form\.get\('action'\)!=='cargar-modelo'/);
 assert.doesNotMatch(edge,/from\(['"]pci_proposals|from\(['"]pci_workspace/);
 assert.doesNotMatch(edge,/school_id|primary_code|edit_code/);
});
test('el panel carga y publica documentos; no muestra el listado de planes escolares',async()=>{
 const admin=await read('panel-general.html'),module=await read('src/modelos-planes-admin.mjs'),publicPage=await read('modelos-v2.html'),publicModule=await read('src/modelos-planes-publicos.mjs');
 assert.match(admin,/Administrar modelos de planes/);
 assert.match(admin,/id="publicModelFile"/);
 assert.match(admin,/session\.role==='admin'/);
 assert.doesNotMatch(admin,/id="plansSchool"|data-plan-school|action:'list-school-pcis'/);
 for(const action of ['listar-modelos','guardar-modelo','archivar-modelo','restaurar-modelo','cargar-modelo'])assert.ok(module.includes(action));
 assert.match(module,/new FormData\(\)/);
 assert.match(module,/file\.size>8\*1024\*1024/);
 assert.match(publicPage,/Modelos de planes publicados/);
 assert.match(publicModule,/action:'listar-publicos'/);
 assert.doesNotMatch(publicModule,/token:|pci_proposals|list-school-pcis/);
 assert.match(publicModule,/new URL\(input\)/);
});
