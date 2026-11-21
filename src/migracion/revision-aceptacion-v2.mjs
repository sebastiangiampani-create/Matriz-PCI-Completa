/**
 * Revisión y aceptación de la propuesta de migración FG a V2.
 * Funciones puras: no usan DOM, red, almacenamiento ni reloj.
 * Revisar nunca sustituye el estado ni instala su marcador de migración.
 */
import { aplicarMigracionEnEstadoV2 } from './aplicar-en-v2.mjs';

const VERSION = 'revision-legado-fg-v2/1';
// Solo satisface el contrato del adaptador en una simulación descartable.
// La fecha de aceptación siempre llega como argumento del controlador.
const FECHA_SIMULACION = '2000-01-01T00:00:00.000Z';
const objeto = valor => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const propia = (valor, clave) => Object.hasOwn(valor, clave);
const copiar = valor => structuredClone(valor);

function validarEstado(estado) {
  if (!objeto(estado) || typeof estado.active !== 'string' || !estado.active.trim() ||
    !objeto(estado.maps) || (propia(estado.maps, estado.active) && !objeto(estado.maps[estado.active]))) {
    throw new TypeError('Se requiere el estado global V2 con active y maps válidos.');
  }
}

function mapaActivo(estado) {
  return propia(estado.maps, estado.active) ? estado.maps[estado.active] : null;
}

function canonico(valor) {
  // Canonizar el documento serializable, sin depender del orden de sus claves.
  // El orden de las listas sí forma parte del estado que se revisó.
  const ordenar = dato => Array.isArray(dato) ? dato.map(ordenar)
    : objeto(dato) ? Object.fromEntries(Object.keys(dato).sort().map(clave => [clave, ordenar(dato[clave])]))
      : dato;
  return JSON.stringify(ordenar(JSON.parse(JSON.stringify(valor))));
}

function canonicoMapa(estado) {
  return canonico({ existe: propia(estado.maps, estado.active), mapa: mapaActivo(estado) });
}

function listaDe(resultado, campo) {
  const valor = resultado[campo];
  if (valor === undefined) return [];
  if (!Array.isArray(valor)) throw new TypeError(`La lista ${campo} de la propuesta es inválida.`);
  return valor;
}

const opcionSocial = mapa => ['A', 'B'].includes(mapa?.socialOption) ? mapa.socialOption : 'A';
const resumenVacio = () => ({
  agrupamientos: 0, agrupamientosPropuestos: 0, planesBimestrales: 0,
  contenidosUnicos: 0, asignacionesContenidos: 0, conflictosAgrupamientos: 0,
  pendientesContenidos: 0, pendientesMaterias: 0, pendientesAgrupamientos: 0,
  sinUbicar: 0, omitidosVacios: 0
});
const detallesVacios = () => ({
  gruposAplicables: [], conflictos: [], pendientes: [], sinUbicar: [], omitidosVacios: []
});

function snapshot(estado, propuesta) {
  return { orientacion: estado.active, mapaCanonico: canonicoMapa(estado), propuesta: copiar(propuesta) };
}

/**
 * @returns {object} Revisión serializable e independiente. `resumen` describe
 * lo aplicable, no los totales originales de la propuesta. Los conflictos que
 * ya estaban en V2 se preservan, pero no se cuentan como conflictos nuevos.
 * `_snapshot` es un dato interno del controlador; no se presenta en el aviso.
 */
export function prepararRevisionMigracionV2(estadoV2, resultadoMigracion) {
  validarEstado(estadoV2);
  const mapa = mapaActivo(estadoV2);
  const actual = opcionSocial(mapa);
  if (mapa && propia(mapa, 'migracionLegado')) {
    return { version: VERSION, estado: 'ya-aplicada', puedeAceptar: false,
      orientacion: estadoV2.active, resumen: resumenVacio(), detalles: detallesVacios(),
      social: { actual, propuesta: null, efectiva: actual, conflicto: false },
      migracionLegado: copiar(mapa.migracionLegado ?? null),
      _snapshot: snapshot(estadoV2, resultadoMigracion ?? null) };
  }

  if (!objeto(resultadoMigracion)) throw new TypeError('Se requiere una propuesta de migración para revisar.');
  const propuesta = copiar(resultadoMigracion);
  const pendientes = listaDe(propuesta, 'pendientes');
  const sinUbicar = listaDe(propuesta, 'sinUbicar');
  const omitidosVacios = listaDe(propuesta, 'omitidosVacios');
  const simulado = aplicarMigracionEnEstadoV2(estadoV2, { ...propuesta, fecha: FECHA_SIMULACION });
  const mapaSimulado = mapaActivo(simulado);
  const conflictos = mapaSimulado.conflictos.slice(mapa?.conflictos?.length ?? 0);
  const slotsBloqueados = new Set(conflictos.filter(c => c.tipo === 'agrupamiento').map(c => c.slot));
  const slots = Object.keys(propuesta.groups);
  const aplicables = slots.filter(slot => !slotsBloqueados.has(slot));
  const grupos = aplicables.map(slot => mapaSimulado.phase2V28.groups[slot]);
  const contenidos = grupos.flatMap(grupo => grupo.contents);
  const resumen = {
    agrupamientos: aplicables.length,
    agrupamientosPropuestos: slots.length,
    planesBimestrales: grupos.reduce((total, grupo) => total + grupo.plansBimestrales.length, 0),
    contenidosUnicos: new Set(contenidos.map(String)).size,
    asignacionesContenidos: contenidos.length,
    conflictosAgrupamientos: slotsBloqueados.size,
    pendientesContenidos: pendientes.filter(p => p.tipo === 'contenido').length,
    pendientesMaterias: pendientes.filter(p => p.tipo === 'materia').length,
    pendientesAgrupamientos: pendientes.filter(p => p.tipo === 'agrupamiento').length,
    sinUbicar: sinUbicar.length,
    omitidosVacios: omitidosVacios.length
  };
  return { version: VERSION, estado: aplicables.length ? 'lista' : 'sin-aplicables',
    puedeAceptar: aplicables.length > 0, orientacion: estadoV2.active, resumen,
    detalles: {
      gruposAplicables: aplicables.map((slot, i) => ({ slot, nombre: String(grupos[i].name ?? ''),
        planesBimestrales: grupos[i].plansBimestrales.length,
        asignacionesContenidos: grupos[i].contents.length })),
      conflictos: copiar(conflictos), pendientes: copiar(pendientes),
      sinUbicar: copiar(sinUbicar), omitidosVacios: copiar(omitidosVacios)
    },
    social: { actual, propuesta: propuesta.socialOption ?? null,
      efectiva: opcionSocial(mapaSimulado), conflicto: conflictos.some(c => c.tipo === 'opcion-social') },
    migracionLegado: null, _snapshot: snapshot(estadoV2, propuesta) };
}

function validarRevision(revision) {
  if (!objeto(revision) || revision.version !== VERSION ||
    !['lista', 'ya-aplicada', 'sin-aplicables'].includes(revision.estado) ||
    !objeto(revision._snapshot) || typeof revision._snapshot.mapaCanonico !== 'string' ||
    typeof revision._snapshot.orientacion !== 'string' ||
    revision.orientacion !== revision._snapshot.orientacion ||
    !propia(revision._snapshot, 'propuesta')) {
    throw new TypeError('La revisión de migración es inválida; debe prepararse nuevamente.');
  }
}

/**
 * La aceptación vuelve a aplicar la propuesta sobre el estado actual para
 * conservar cambios en otros mapas. Si cambió el mapa revisado, devuelve una
 * revisión actualizada SIN aplicar: el controlador debe exigir otro clic.
 * Un cambio de orientación invalida el contexto y requiere preparar el aviso
 * con la propuesta correspondiente; nunca se traslada la misma a otro mapa.
 *
 * La revisión devuelta después de aceptar conserva los recuentos efectivos
 * de esa aplicación, con puedeAceptar:false y el marcador fechado en el clic.
 */
export function aceptarRevisionMigracionV2(estadoActual, revision, fechaISO) {
  validarEstado(estadoActual);
  validarRevision(revision);
  if (estadoActual.active !== revision._snapshot.orientacion) {
    throw new TypeError('Cambió la orientación del PCI; vuelva a preparar la revisión correspondiente.');
  }
  const propuesta = revision._snapshot.propuesta;
  const actualizada = prepararRevisionMigracionV2(estadoActual, propuesta);
  if (actualizada.estado === 'ya-aplicada') {
    return { estado: 'ya-aplicada', estadoV2: copiar(estadoActual), revision: actualizada };
  }
  if (canonicoMapa(estadoActual) !== revision._snapshot.mapaCanonico) {
    return { estado: 'actualizada', estadoV2: copiar(estadoActual), revision: actualizada };
  }
  if (!actualizada.puedeAceptar) {
    return { estado: 'sin-aplicables', estadoV2: copiar(estadoActual), revision: actualizada };
  }
  const estadoV2 = aplicarMigracionEnEstadoV2(estadoActual, { ...propuesta, fecha: fechaISO });
  const aceptada = { ...actualizada, estado: 'ya-aplicada', puedeAceptar: false,
    migracionLegado: copiar(mapaActivo(estadoV2).migracionLegado),
    _snapshot: snapshot(estadoV2, propuesta) };
  return { estado: 'aceptada', estadoV2, revision: aceptada };
}
