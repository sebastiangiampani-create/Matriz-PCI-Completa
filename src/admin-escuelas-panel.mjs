/**
 * Gestión de altas de escuelas desde Panel general. Interfaz exclusiva del
 * superadministrador: pci-multipci verifica nuevamente firma y role=admin.
 *
 * No se conecta directo a Postgres, no expone service_role y no modifica
 * escuelas existentes ni los PCI ya construidos.
 */
const API='https://agmebsotbuurbnldxewf.supabase.co/functions/v1/pci-multipci';
const $=id=>document.getElementById(id);
export const normalizeCue=value=>String(value??'').trim().toUpperCase();
export function validateSchoolDraft(data,existing=[]){
 const name=String(data.name||'').replace(/\s+/g,' ').trim();
 const cue=normalizeCue(data.cue);
 const email=String(data.email||'').trim().toLowerCase();
 const year=Number(data.year);
 if(name.length<3||name.length>150)throw Error('Ingresá el nombre oficial de la institución (3 a 150 caracteres).');
 if(!/^[A-Z0-9./_-]{3,35}$/.test(cue))throw Error('Ingresá un CUE o código institucional válido, sin espacios.');
 if(email&&(email.length>180||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw Error('El correo institucional no tiene un formato válido.');
 if(!Number.isSafeInteger(year)||year<2020||year>2100)throw Error('El año debe estar entre 2020 y 2100.');
 const duplicate=existing.find(s=>normalizeCue(s.cue)===cue);
 if(duplicate)throw Error('El CUE '+cue+' ya pertenece a '+duplicate.name+'. Abrí esa escuela en lugar de crearla nuevamente.');
 return {name,cue,email,year};
}
async function post(body){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'Supabase no pudo completar la operación.');
  return data;
 }catch(error){
  if(error.name==='AbortError')throw Error('Supabase tardó demasiado. Comprobá la conexión y volvé a consultar antes de intentar crear de nuevo.');
  throw error;
 }finally{clearTimeout(timer)}
}
function adminToken(){
 let stored=null;
 try{stored=JSON.parse(sessionStorage.getItem('pci_admin_monitor_session')||'null')}catch{}
 if(!stored?.token)throw Error('Iniciá sesión desde Panel de administración.');
 return stored.token;
}
async function verifiedAdmin(){
 const token=adminToken();
 const session=await post({action:'session-info',token});
 if(session.role!=='admin')throw Error('La creación de instituciones es exclusiva de administración general.');
 return token;
}
function status(text,tone='error'){
 const area=$('schoolCreateStatus');area.textContent=text;area.dataset.tone=tone;
}
let catalog=[];
async function refresh(){
 const node=$('schoolDbStatus');
 node.textContent='Consultando instituciones…';
 const token=await verifiedAdmin();
 const result=await post({action:'list-schools',token});
 if(!Array.isArray(result.schools))throw Error('Supabase no devolvió el catálogo de escuelas.');
 catalog=result.schools;
 const missingCue=catalog.filter(s=>!normalizeCue(s.cue)).length;
 node.textContent='Supabase conectado · '+catalog.length+' escuelas · '+missingCue+' sin CUE registrado';
 return catalog;
}
function showCreated(result,data){
 const target=$('schoolDbCreated');
 $('schoolDbCreatedInfo').textContent=data.name+' · CUE '+data.cue+' · ID '+result.school_id;
 $('schoolDbEditCode').textContent=result.edit_code||'No informado';
 $('schoolDbPrimaryCode').textContent=result.primary_code||'No informado';
 $('schoolDbOpenPci').href='pci-orientaciones.html?school='+encodeURIComponent(result.school_id)+'&from=panel-general';
 $('schoolDbOpenPanel').href='panel-escuela.html?school='+encodeURIComponent(result.school_id)+'&admin=1';
 target.classList.remove('hidden');
}
async function createSchool(event){
 event.preventDefault();
 const btn=$('newSchoolSubmit'),dialog=$('manageSchoolsDialog');
 if(btn.disabled)return;
 btn.disabled=true;
 status('Validando los datos con Supabase…','success');
 try{
  const token=await verifiedAdmin();
  // Consultar catálogo otra vez ANTES de alta; la función SQL verifica
  // también en transacción para impedir CUE repetidos por concurrencia.
  await refresh();
  const info=validateSchoolDraft({
    name:$('newSchoolName').value,cue:$('newSchoolCue').value,
    email:$('newSchoolEmail').value,year:$('newSchoolYear').value
  },catalog);
  if(!window.confirm('¿Crear '+info.name+' (CUE '+info.cue+') en Supabase? Se generarán claves nuevas sin modificar escuelas existentes.')) {
    status('Alta cancelada. No se modificó Supabase.','success');return;
  }
  status('Creando la institución…','success');
  const result=await post({action:'create-school-v2',token,...info});
  if(result.ok!==true||!Number.isSafeInteger(Number(result.school_id))||Number(result.school_id)<1001)
    throw Error('Supabase no confirmó el alta: comprobá el catálogo antes de volver a intentar.');
  // Lectura posterior: la institución debe estar en el catálogo compartido.
  await refresh();
  const created=catalog.find(s=>Number(s.school_id)===Number(result.school_id)&&normalizeCue(s.cue)===info.cue);
  if(!created)throw Error('Se recibió respuesta de alta, pero aún no aparece en el catálogo. NO vuelvas a crearla: actualizá y verificá el CUE.');
  showCreated(result,info);
  status('Alta verificada. Ahora podés abrir Organización curricular y agregar los PCI de esta escuela.','success');
  dialog.querySelector('#schoolDbForm').reset();
  window.dispatchEvent(new CustomEvent('pci:schools-updated'));
 }catch(error){
  status(error?.message||String(error));
 }finally{btn.disabled=false}
}
export function mount(){
 const open=$('manageSchoolsBtn'),dialog=$('manageSchoolsDialog');
 if(!open||!dialog||open.dataset.mounted==='1')return;
 open.dataset.mounted='1';
 open.onclick=async()=>{
  dialog.showModal();
  $('schoolDbCreated').classList.add('hidden');
  status('');
  try{await refresh()}catch(error){$('schoolDbStatus').textContent='No disponible';status(error.message)}
 };
 $('manageSchoolsClose').onclick=()=>dialog.close();
 $('newSchoolCancel').onclick=()=>dialog.close();
 $('schoolDbRefresh').onclick=async()=>{
  try{await refresh();status('Listado actualizado desde Supabase.','success')}
  catch(error){status(error.message)}
 };
 $('schoolDbForm').addEventListener('submit',createSchool);
 dialog.addEventListener('click',async event=>{
  const btn=event.target.closest('[data-copy-school-key]');
  if(!btn)return;
  const value=$(btn.dataset.copySchoolKey==='edit'?'schoolDbEditCode':'schoolDbPrimaryCode').textContent;
  try{await navigator.clipboard.writeText(value);btn.textContent='Copiado';setTimeout(()=>btn.textContent='Copiar',900)}
  catch{status('No se pudo copiar automáticamente. Seleccioná el texto y copialo manualmente.')}
 });
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
}
