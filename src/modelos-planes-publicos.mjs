// Biblioteca pública de PDF modélicos; independiente de los modelos curriculares V2.
const API='https://agmebsotbuurbnldxewf.supabase.co/functions/v1/pci-modelos-publicos';
const container=document.getElementById('publicModelDocuments');
const status=document.getElementById('publicPlanStatus');
const search=document.getElementById('publicPlanSearch');
let planes=[];
const node=(tag,text,klass)=>{
 const el=document.createElement(tag);
 if(text!==undefined)el.textContent=String(text);
 if(klass)el.className=klass;
 return el;
};
const urlSeguro=input=>{
 try{
  const u=new URL(String(input||''));
  return u.protocol==='https:'&&u.hostname==='agmebsotbuurbnldxewf.supabase.co'&&u.pathname.includes('/storage/v1/object/sign/')?u.href:'';
 }catch{return''}
};
export function showPublicPlanModels(){
 if(!container)return;
 const q=(search?.value||'').trim().toLocaleLowerCase('es');
 const visibles=planes.filter(p=>(p.titulo+' '+(p.descripcion||'')).toLocaleLowerCase('es').includes(q));
 container.replaceChildren();
 if(!visibles.length){
  container.append(node('p',planes.length?'No hay planes que coincidan con la búsqueda.':'Todavía no hay PDF de planes modélicos publicados.','empty-plans'));
  return;
 }
 for(const p of visibles){
  const card=node('article',undefined,'public-plan');
  card.append(node('span','PDF · Plan modélico','pdf-type'));
  card.append(node('h3',p.titulo));
  if(p.descripcion)card.append(node('p',p.descripcion,'public-plan-desc'));
  const url=urlSeguro(p.url);
  if(url){
   const name=node('small',p.archivo_nombre||'Documento PDF');
   card.append(name);
   const link=node('a','Ver o descargar PDF','public-plan-link');
   link.href=url;link.target='_blank';link.rel='noopener noreferrer';
   card.append(link);
  }
  container.append(card);
 }
}
export async function initPublicPlanModels(){
 if(!container)return;
 search?.addEventListener('input',showPublicPlanModels);
 status.textContent='Consultando los planes modélicos publicados…';
 try{
  const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action:'listar-publicos'}),cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!Array.isArray(data.modelos))throw Error('La biblioteca no está disponible.');
  planes=data.modelos.filter(p=>p.publicado===true&&p.archivado===false&&p.tipo_archivo==='application/pdf');
  status.textContent=planes.length?planes.length+' planes modélicos en PDF disponibles.':'Todavía no se publicaron planes modélicos.';
 }catch(e){
  planes=[];status.textContent='No se pudo consultar la biblioteca. Podés volver a intentar al actualizar la página.';
 }
 showPublicPlanModels();
}
