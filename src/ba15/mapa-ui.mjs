import {BA15_NIVELES,BA15_CCC,BA15_NORMATIVA,validarBa15} from './reglas-curriculares.mjs';
const text=(tag,label,cls)=>{const e=document.createElement(tag);e.textContent=label;if(cls)e.className=cls;return e;};
export function mostrarMapaBa15({metrics,navigation,map,validation}){
 let active=0;
 const checks=validarBa15();
 const count=BA15_NIVELES.map(n=>n.reduce((a,e)=>a+e.horas,0));
 metrics.replaceChildren();
 for(const [value,label] of [['4','Niveles'],['38','Horas cátedra por nivel'],['8','Cuatrimestres C1–C8']]){
  const box=text('div','','metric');box.append(text('strong',value),text('small',label));metrics.append(box);
 }
 function render(){
  navigation.replaceChildren();
  for(let i=0;i<4;i++){
   const b=text('button','Nivel '+['I','II','III','IV'][i],'tab'+(active===i?' active':''));
   b.type='button';b.setAttribute('aria-pressed',String(active===i));b.onclick=()=>{active=i;render();};navigation.append(b);
  }
  map.replaceChildren();
  const tbl=text('table','','mapTable'),head=text('thead'),tr=text('tr');
  for(const label of ['Área / Formato','Espacio curricular','Horas semanales']){
   tr.append(text('th',label));
  }
  head.append(tr);tbl.append(head);
  const tbody=text('tbody');
  for(const e of BA15_NIVELES[active]){
   const r=text('tr');r.append(text('th',e.area+' · '+e.formato),text('td',e.nombre),text('td',String(e.horas)));tbody.append(r);
  }
  const total=text('tr');total.append(text('th','Total del nivel'),text('td','Carga semanal del plan'),text('td',String(count[active])+' / '+BA15_NORMATIVA.horasSemanales));tbody.append(total);
  tbl.append(tbody);map.append(tbl);
  const summary=text('strong','Nivel '+['I','II','III','IV'][active]+': '+count[active]+' / 38 horas cátedra');
  const detail=text('p','EDI, Artes, Educación Física y Tecnologías de la Información (cuando corresponda) deben documentar su articulación con un área o espacio troncal.');
  validation.replaceChildren(summary,detail,text('p',checks.valido?'Estructura base y cargas oficiales verificadas.':'La estructura base tiene errores: '+checks.errores.join('; ')));
  if(!checks.valido)validation.classList.add('warning');else validation.classList.remove('warning');
 }
 render();
}
