// Documentos PUBLICADOS por Administración. No lee PCI de escuelas.
const API='https://agmebsotbuurbnldxewf.supabase.co/functions/v1/pci-modelos-publicos';
const container=document.getElementById('publicModelDocuments');
const status=document.getElementById('publicPlanStatus');
let models=[],active=()=> 'comun';
function node(tag,text,klass){
 const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);
 if(klass)el.className=klass;return el;
}
function safeUrl(input){
 try{const u=new URL(input);return u.protocol==='https:'&&u.hostname==='agmebsotbuurbnldxewf.supabase.co'?u.href:''}
 catch{return''}
}
export function showPublicPlanModels(){
 if(!container)return;
 const current=active(),list=models.filter(m=>m.modalidad===current);
 container.replaceChildren();
 if(!list.length){
  container.append(node('p','Todavía no hay documentos de modelos publicados en esta modalidad. Podés utilizar el constructor V2 de consulta que aparece arriba.','empty-plans'));
  return;
 }
 for(const item of list){
  const card=node('article',undefined,'public-plan');
  card.append(node('h3',item.titulo));
  if(item.descripcion)card.append(node('p',item.descripcion,'public-plan-desc'));
  card.append(node('small','Archivo: '+item.archivo_nombre));
  const url=safeUrl(item.url);
  if(url){
   const link=node('a','Consultar documento publicado','public-plan-link');
   link.href=url;link.target='_blank';link.rel='noopener noreferrer';
   card.append(link);
  }
  container.append(card);
 }
}
export async function initPublicPlanModels(activeGetter){
 active=activeGetter;
 if(!container)return;
 status.textContent='Consultando los materiales publicados…';
 try{
  const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'listar-publicos'}),cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!Array.isArray(data.modelos))throw Error('La biblioteca pública no está disponible.');
  models=data.modelos.filter(m=>m.publicado&&!m.archivado&&['comun','tecnica','ba15'].includes(m.modalidad));
  status.textContent=models.length?models.length+' documentos de consulta publicados.':'Aún no se cargaron documentos de planes.';
 }catch(e){
  status.textContent='No se pudieron consultar los documentos publicados. El constructor V2 sigue disponible.';
 }
 showPublicPlanModels();
}
