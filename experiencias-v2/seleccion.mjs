import {ORIENTATIONS} from '../src/integracion-curricular/bridge.js';
import {SPECIALTIES,findSpecialty} from '../src/tecnica/pautas-pci-20261005.mjs';

const kind=document.body.dataset.model;
if(!['media','tecnica','ba15'].includes(kind))throw Error('Modalidad desconocida');
const $=id=>document.getElementById(id);
const select=$('catalogo');
const message=$('mensaje');
const slug=value=>String(value||'').normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').toLowerCase()
 .replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,25);
let choices=[];
if(kind==='tecnica'){
 const result=await fetch('../data/tecnica/catalogo-priorizados-2026.json',{cache:'no-store'});
 if(!result.ok)throw Error('No se pudo consultar el catálogo de especialidades.');
 const document=await result.json();
 const available=new Set((document.documentos||[]).map(x=>x.id));
 choices=SPECIALTIES.filter(x=>available.has(x.id)).map(x=>({id:x.id,name:x.name}));
 if(!choices.length)throw Error('No hay bases técnicas disponibles para revisar.');
}else{
 choices=ORIENTATIONS.map(x=>({id:x.id,name:x.name}));
}
for(const choice of choices){
 const option=document.createElement('option');
 option.value=choice.id;option.textContent=choice.name;
 select.append(option);
}
select.value=kind==='tecnica'?'computacion':kind==='ba15'?'economia_administracion':'comunicacion';
if(!select.value)select.selectedIndex=0;
$('selector').addEventListener('submit',event=>{
 event.preventDefault();
 if(!$('selector').reportValidity())return;
 const choice=choices.find(x=>x.id===select.value);
 if(!choice){message.textContent='Seleccioná una orientación o especialidad válida.';return}
 const shift=$('turno').value;
 const school=$('escuela').value.trim();
 if(!school||school.length>70){message.textContent='Indicá la escuela de prueba.';return}
 const ref=slug($('pci-id').value);
 const pci=[ref,kind,slug(choice.id),shift,slug(school)].filter(Boolean).join('-').slice(0,90);
 if(!/^[a-z0-9_-]{3,90}$/.test(pci)){message.textContent='El identificador del PCI no es válido.';return}
 const params=new URLSearchParams({pci,school,turno:shift});
 let target='';
 if(kind==='media'){
   params.set('orientation',choice.name);
   target='../revision-v2-embed.html';
 }else{
   params.set('model',kind);
   if(kind==='tecnica'){
     if(!findSpecialty(choice.id)){message.textContent='Especialidad no reconocida.';return}
     params.set('specialty',choice.id);
   }else params.set('orientation',choice.id);
   target='../revision-v2-modalidad.html';
 }
 window.location.assign(target+'?'+params.toString());
});
