/**
 * Rutas de demostración de los TRES motores curriculares V2 actuales.
 * No usa escuelas reales, credenciales ni el contrato de guardado remoto.
 * Las páginas de revisión conservan sus propios borradores en este navegador.
 */
import {ORIENTATIONS} from './integracion-curricular/bridge.js';
import {SPECIALTIES} from './tecnica/pautas-pci-20261005.mjs';

export const MODELOS_PUBLICOS_V2=Object.freeze([
  Object.freeze({id:'comun',nombre:'Secundaria Común (Media)',niveles:5,cuatrimestres:10,
    tipoOpcion:'Orientación',opcionInicial:'comunicacion'}),
  Object.freeze({id:'tecnica',nombre:'Secundaria Técnica',niveles:6,cuatrimestres:12,
    tipoOpcion:'Especialidad',opcionInicial:'computacion'}),
  Object.freeze({id:'ba15',nombre:'BA+15',
    niveles:4,cuatrimestres:8,tipoOpcion:'Orientación',opcionInicial:'economia_administracion'})
]);

export function opcionesConsultaV2(modelo){
  if(modelo==='comun'||modelo==='ba15')
    return ORIENTATIONS.map(({id,name})=>({id,nombre:name}));
  if(modelo==='tecnica')
    return SPECIALTIES.map(({id,name})=>({id,nombre:name}));
  throw Error('Modalidad curricular no reconocida.');
}

export function rutaConsultaV2(modelo,opcion){
  const config=MODELOS_PUBLICOS_V2.find(m=>m.id===modelo);
  if(!config)throw Error('Modelo curricular no disponible.');
  const id=String(opcion||config.opcionInicial);
  const selected=opcionesConsultaV2(modelo).find(o=>o.id===id);
  if(!selected)throw Error('La orientación o especialidad no está en el catálogo V2.');
  const params=new URLSearchParams();
  params.set('pci','modelo-v2-'+modelo+'-'+id);
  params.set('school','Modelo de consulta · '+config.nombre);
  if(modelo==='comun'){
    params.set('orientation',selected.nombre);
    return 'revision-v2-embed.html?'+params.toString();
  }
  params.set('model',modelo);
  if(modelo==='tecnica')params.set('specialty',id);
  else params.set('orientation',id);
  return 'revision-v2-modalidad.html?'+params.toString();
}
