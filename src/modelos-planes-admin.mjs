// Administración GENERAL de la biblioteca de modelos (no accede a PCI escolares).
const API='https://agmebsotbuurbnldxewf.supabase.co/functions/v1/pci-modelos-publicos';
const $=id=>document.getElementById(id);
const PDF_MIME='application/pdf';
let initialized=false,records=[],editingId='',editingCategory='general',getSession=()=>({});
function status(message,isError=false){
 const target=$('publicModelStatus');
 target.textContent=message;
 target.style.color=isError?'#a72d46':'';
}
async function request(action,extra={}){
 const token=getSession()?.token;
 if(!token)throw Error('La sesión de Administración general no está disponible.');
 const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action,token,...extra})});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(body.error||'No fue posible administrar los planes modélicos.');
 return body;
}
function element(tag,text,className){
 const node=document.createElement(tag);
 if(text!==undefined)node.textContent=String(text);
 if(className)node.className=className;
 return node;
}
function addButton(host,label,callback,kind=''){
 const button=element('button',label,'btn small '+kind);
 button.type='button';button.addEventListener('click',callback);host.append(button);return button;
}
function render(){
 const list=$('publicModelList');
 list.replaceChildren();
 $('plansTotal').textContent=records.filter(r=>!r.archivado).length+' cargados';
 const shown=records;
 if(!shown.length){
  list.append(element('p','Todavía no hay planes modélicos cargados. Subí el primer PDF.','plans-empty'));
  return;
 }
 for(const record of shown){
  const card=element('article',undefined,'plan-entry');
  if(record.archivado)card.style.opacity='.72';
  card.append(element('span','PDF · Plan modélico','offer-tag'));
  card.append(element('h4',record.titulo));
  if(record.descripcion)card.append(element('p',record.descripcion,'note'));
  card.append(element('p',record.archivado?'Archivado':record.publicado?'Publicado · acceso libre':'Borrador · oculto al público','note'));
  card.append(element('p','Archivo: '+record.archivo_nombre+' · Actualizado: '+new Date(record.updated_at).toLocaleString('es-AR'),'note'));
  const actions=element('div',undefined,'actions');
  if(record.url){
   const view=element('a','Ver archivo','btn small');
   view.href=record.url;view.target='_blank';view.rel='noopener noreferrer';
   actions.append(view);
  }
  if(!record.archivado){
   addButton(actions,'Editar / reemplazar',()=>beginEdit(record));
   addButton(actions,record.publicado?'Ocultar':'Publicar',()=>setPublished(record,!record.publicado));
   addButton(actions,'Archivar',()=>archive(record));
  }else addButton(actions,'Restaurar',()=>restore(record),'primary');
  card.append(actions);list.append(card);
 }
}
async function reload(){
 status('Consultando los planes modélicos…');
 try{
  const result=await request('listar-modelos');
  records=Array.isArray(result.modelos)?result.modelos:[];
  render();
  status('Biblioteca de planes modélicos actualizada.');
 }catch(error){status(error.message,true)}
}
function beginEdit(record){
 editingId=record.id;
 editingCategory=record.modalidad||'general';
 $('publicModelTitle').value=record.titulo;
 $('publicModelDescription').value=record.descripcion||'';
 $('publicModelPublished').checked=!!record.publicado;
 $('publicModelFile').value='';
 $('publicModelFile').required=false;
 $('publicModelSubmit').textContent='Guardar cambios';
 $('publicModelCancel').hidden=false;
 status('Editando «'+record.titulo+'». Si elegís un PDF nuevo, sustituye el visible; la copia anterior se conserva.');
 $('publicModelForm').scrollIntoView({behavior:'smooth',block:'start'});
}
function resetForm(){
 editingId='';editingCategory='general';
 $('publicModelForm').reset();
 $('publicModelPublished').checked=true;
 $('publicModelFile').required=true;
 $('publicModelSubmit').textContent='Cargar PDF';
 $('publicModelCancel').hidden=true;
}
async function submit(event){
 event.preventDefault();
 const button=$('publicModelSubmit');
 const file=$('publicModelFile').files?.[0];
 const payload={
  modalidad:editingCategory,
  titulo:$('publicModelTitle').value.trim(),
  descripcion:$('publicModelDescription').value.trim(),
  publicado:$('publicModelPublished').checked
 };
 if(payload.titulo.length<3)return status('Ingresá un título de al menos 3 caracteres.',true);
 if(!file&&!editingId)return status('Seleccioná el PDF del plan modélico.',true);
 if(file && (!file.name.toLowerCase().endsWith('.pdf') || (file.type&&file.type!==PDF_MIME)))return status('Solo se admiten archivos PDF.',true);
 if(file && file.size>8*1024*1024)return status('El archivo no puede superar 8 MB.',true);
 button.disabled=true;status('Guardando el plan modélico…');
 try{
  if(file){
   const form=new FormData();
   form.append('action','cargar-modelo');
   form.append('token',getSession().token);
   if(editingId)form.append('id',editingId);
   for(const [key,value] of Object.entries(payload))form.append(key,String(value));
   form.append('archivo',file,file.name);
   const response=await fetch(API,{method:'POST',body:form,cache:'no-store'});
   const body=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(body.error||'La carga falló.');
  }else await request('guardar-modelo',{id:editingId,...payload});
  resetForm();await reload();
  status('Plan modélico guardado. '+(payload.publicado?'El PDF está disponible para consulta libre.':'Quedó oculto como borrador.'));
 }catch(error){status(error.message,true)}
 finally{button.disabled=false}
}
async function setPublished(record,published){
 try{await request('guardar-modelo',{id:record.id,modalidad:record.modalidad,titulo:record.titulo,descripcion:record.descripcion,publicado:published});await reload();status(published?'PDF publicado.':'PDF oculto del acceso público.')}
 catch(e){status(e.message,true)}
}
async function archive(record){
 if(!confirm('¿Archivar «'+record.titulo+'»? Dejará de estar publicado y podrás restaurarlo.'))return;
 try{await request('archivar-modelo',{id:record.id});resetForm();await reload();status('PDF archivado sin borrar el documento.')}
 catch(e){status(e.message,true)}
}
async function restore(record){
 try{await request('restaurar-modelo',{id:record.id});await reload();status('PDF restaurado como borrador, todavía no publicado.')}
 catch(e){status(e.message,true)}
}
export async function initPublicPlanAdmin(sessionGetter){
 getSession=sessionGetter;
 if(!initialized){
  initialized=true;
  $('publicModelForm').addEventListener('submit',submit);
  $('publicModelCancel').addEventListener('click',resetForm);
  $('publicModelReload').addEventListener('click',reload);
  resetForm();
 }
 await reload();
}
