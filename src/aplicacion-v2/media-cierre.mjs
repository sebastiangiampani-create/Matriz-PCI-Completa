/**
 * Cierre normativo exclusivo de Media (Anexo II, 17/11/2026).
 * No toca vendor, V91 ni datos históricos. Funciones puras.
 * Articulación = planes, evaluaciones y calificaciones independientes;
 * no mueve materias, no suma horas del PVF a los laboratorios/talleres.
 */
import {grupoPvfConTrabajo} from './pvf-media.mjs';

export const MEDIA_NATURALES_ORIENTACION = 'ciencias_naturales';
export const MEDIA_NATURALES_QUINTO = Object.freeze(['naturales-c9','naturales-c10']);
export const MEDIA_FO_QUINTO = Object.freeze([
  'foLab5-c9','foTaller5-c9','foLab5-c10','foTaller5-c10'
]);
export const MEDIA_ARTICULACION_VERSION = 'pvf-media-articulacion/1';
const objeto = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const copia = x => structuredClone(x);
const normal = x => String(x ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/\s+/g,' ').trim();
const falta = (codigo,mensaje,slot) => ({codigo,mensaje,slot});
const sujeto = (materias,id) => materias.find(x => x?.id === id);

function horasDe(dic,nombre) {
  if (!objeto(dic)) return null;
  const key = normal(nombre);
  const rows = Object.entries(dic).filter(([k]) => normal(k) === key);
  if (rows.length === 1) {
    const n = Number(rows[0][1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const parciales = Object.entries(dic).filter(([k]) => {
    const n=normal(k);
    return key.length > 8 && n.length > 8 && (n.startsWith(key) || key.startsWith(n));
  });
  if (parciales.length !== 1) return null;
  const n=Number(parciales[0][1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function tieneNaturales5(mapa) {
  const ubicaciones = MEDIA_NATURALES_QUINTO.filter(slot => (mapa.placements?.[slot] || []).length > 0);
  const grupos = MEDIA_NATURALES_QUINTO.filter(slot => (
    grupoPvfConTrabajo(mapa.phase2V28?.groups?.[slot]) ||
    grupoPvfConTrabajo(mapa.phase2?.[slot])
  ));
  const propios = (mapa.phase2V28?.customContents || [])
    .filter(x => MEDIA_NATURALES_QUINTO.includes(x?.groupId));
  return {ubicaciones,grupos,propios:propios.length};
}

export function auditarCierreMedia(mapa,{orientacionId,orientacion,materias=[],catalogoHoras=null}={}) {
  if (!objeto(mapa) || !Array.isArray(materias)) throw new TypeError('Se requiere un mapa y las materias del motor.');
  const errores=[],pendientes=[],detalle=[];
  const esNaturales = orientacionId === MEDIA_NATURALES_ORIENTACION;
  const heredado = esNaturales ? tieneNaturales5(mapa) : {ubicaciones:[],grupos:[],propios:0};
  if (heredado.ubicaciones.length || heredado.grupos.length || heredado.propios) {
    errores.push(falta('MEDIA_NATURALES_5_HISTORICO',
      'Ciencias Naturales no tiene laboratorios FG en 5.º. Hay asignaciones o desarrollo anterior que debe resguardarse antes de validar.',
      'naturales-c9/c10'));
  }
  const alternativa = ['A','B'].includes(mapa.alt) ? mapa.alt : 'A';
  const horasPorOrientacion = catalogoHoras?.formacion_orientada?.[orientacion];
  const horasPorMateria = horasPorOrientacion?.[alternativa]?.['5'] ||
    (horasPorOrientacion?.sinAlternativas ? horasPorOrientacion?.A?.['5'] : null);
  const idsProyecto = mapa.placements?.['proyecto-n5'] || [];
  const idProyecto = mapa.pvfMedia?.subjectId;
  const porTerm = new Map([[9,new Set()],[10,new Set()]]);
  for (const slot of MEDIA_FO_QUINTO) {
    const ids = mapa.placements?.[slot] || [];
    if (!Array.isArray(ids)) {
      errores.push(falta('MEDIA_FO_ESTRUCTURA','Las materias del espacio no tienen una estructura válida.',slot));
      continue;
    }
    if (ids.length < 2) errores.push(falta('MEDIA_FO_MINIMO',
      'Cada laboratorio y taller de Formación Orientada de 5.º requiere al menos dos materias del mismo año.',slot));
    let hc = 0,desconocidas = 0;
    const term = Number(slot.match(/-c(\d+)$/)?.[1]);
    for (const id of ids) {
      const s = sujeto(materias,id);
      if (!s || s.origin !== 'FO' || Number(s.year) !== 5) {
        errores.push(falta('MEDIA_FO_MATERIA','La materia debe pertenecer a la Formación Orientada de 5.º del catálogo activo.',slot));
        continue;
      }
      if (porTerm.get(term).has(id)) errores.push(falta('MEDIA_FO_DUPLICADA',
        'La misma materia no puede ocupar dos espacios de FO en el mismo cuatrimestre.',slot));
      porTerm.get(term).add(id);
      if (id === idProyecto || idsProyecto.includes(id)) errores.push(falta('MEDIA_PVF_DUPLICADO',
        'La materia prescripta del PVF no se duplica en otro espacio; los demás espacios pueden articular pedagógicamente con ella.',slot));
      const n = horasDe(horasPorMateria,s.name);
      if (n === null) {
        desconocidas++;
        pendientes.push(falta('MEDIA_FO_HORAS_PENDIENTES',
          'No se pudo contrastar la carga horaria oficial de ' + s.name + '. No se dará por validada.',slot));
      } else hc += n;
    }
    if (!esNaturales && hc > 9) errores.push(falta('MEDIA_FO_MAX_9',
      'Este espacio suma ' + hc + ' HC. El máximo es 9 HC; la excepción de 5.º corresponde únicamente a Ciencias Naturales.',slot));
    detalle.push({slot,cantidad:ids.length,hcConocidas:hc,horasPendientes:desconocidas,
      excepcionMasDe9:esNaturales});
  }
  // La articulación es una consecuencia de la composición validada,
  // no una decisión adicional que la escuela deba marcar en casilleros.
  // Los metadatos manuales históricos se conservan sin aplicarlos ni
  // sobrescribirlos: la validación usa exclusivamente las ubicaciones reales.
  const articulaciones = MEDIA_FO_QUINTO.filter(slot => {
    const ids = mapa.placements?.[slot];
    if (!Array.isArray(ids) || ids.length < 2 || new Set(ids).size !== ids.length) return false;
    return ids.every(id => {
      const s = sujeto(materias,id);
      return s?.origin === 'FO' && Number(s.year) === 5 &&
        id !== idProyecto && !idsProyecto.includes(id);
    });
  });
  return {valido:errores.length===0 && pendientes.length===0,errores,pendientes,detalle,
    naturalesQuinto:heredado,articulaciones:errores.length||pendientes.length?[]:articulaciones};

}

export function cambiarArticulacionPvf(mapa,slot,activada) {
  if (!objeto(mapa) || !MEDIA_FO_QUINTO.includes(slot)) throw new TypeError('Espacio de articulación inválido.');
  const salida=copia(mapa);
  const previo=salida.pvfArticulaciones?.espacios || [];
  if (!Array.isArray(previo)) throw new TypeError('La articulación previa requiere revisión.');
  const set=new Set(previo.filter(s=>MEDIA_FO_QUINTO.includes(s)));
  if (activada) set.add(slot); else set.delete(slot);
  salida.pvfArticulaciones={version:MEDIA_ARTICULACION_VERSION,
    espacios:MEDIA_FO_QUINTO.filter(s=>set.has(s))};
  salida.valid=false;
  return salida;
}

/**
 * Reparación SOLO a pedido del usuario. Archiva los datos de 5.º Naturales
 * íntegros dentro del MISMO mapa (se pueden exportar), nunca en legacy_state.
 */
export function resguardarNaturalesQuinto(mapa,{orientacionId,fecha}={}) {
  if (orientacionId !== MEDIA_NATURALES_ORIENTACION) throw new TypeError('Solo corresponde a Ciencias Naturales de Media.');
  if (!objeto(mapa) || !Number.isFinite(Date.parse(fecha))) throw new TypeError('Mapa o fecha inválidos.');
  const salida=copia(mapa),estado=tieneNaturales5(salida);
  if (!estado.ubicaciones.length && !estado.grupos.length && !estado.propios)
    return {mapa:salida,cambio:false,resguardo:null};
  const resguardo={fecha,ubicaciones:{},grupos:{},fase2:{},contenidosPropios:[]};
  for (const slot of MEDIA_NATURALES_QUINTO) {
    if (Object.hasOwn(salida.placements || {},slot)) {
      resguardo.ubicaciones[slot]=copia(salida.placements[slot]);
      delete salida.placements[slot];
    }
    if (Object.hasOwn(salida.phase2V28?.groups || {},slot)) {
      resguardo.grupos[slot]=copia(salida.phase2V28.groups[slot]);
      delete salida.phase2V28.groups[slot];
    }
    if (Object.hasOwn(salida.phase2 || {},slot)) {
      resguardo.fase2[slot]=copia(salida.phase2[slot]);
      delete salida.phase2[slot];
    }
  }
  if (Array.isArray(salida.phase2V28?.customContents)) {
    resguardo.contenidosPropios=salida.phase2V28.customContents
      .filter(x=>MEDIA_NATURALES_QUINTO.includes(x?.groupId));
    salida.phase2V28.customContents=salida.phase2V28.customContents
      .filter(x=>!MEDIA_NATURALES_QUINTO.includes(x?.groupId));
  }
  salida.resguardosNormativos ||= {};
  salida.resguardosNormativos.naturales5 ||= [];
  salida.resguardosNormativos.naturales5.push(resguardo);
  salida.valid=false;
  return {mapa:salida,cambio:true,resguardo};
}
