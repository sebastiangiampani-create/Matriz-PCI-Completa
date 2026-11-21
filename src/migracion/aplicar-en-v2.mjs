/**
 * Aplica una propuesta de migración a una COPIA del estado global del motor V2.
 * No usa DOM, almacenamiento, red ni reloj; tampoco modifica el migrador.
 *
 * Contrato comprobado en v47-desarrollo-modalidad / v47-phase2-matrix:
 * cur() = state.maps[state.active]. El objeto guardado en phase2V28.groups[slot]
 * es el dato plano del grupo; `data` pertenece solo al descriptor que crea V2.
 * v38-phase2-workspace lee plansBimestrales en ese mismo objeto persistido.
 */

const VERSION = 'legado-fg-v2/1';
const SOCIALES_TERCERO = new Set(['socialA-c5', 'socialA-c6', 'socialB-c5', 'socialB-c6']);
const objeto = valor => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const propia = (obj, clave) => Object.hasOwn(obj, clave);

function tieneValor(valor) {
  if (valor === null || valor === undefined || valor === false) return false;
  if (typeof valor === 'string') return !!valor.trim();
  if (Array.isArray(valor)) return valor.some(tieneValor);
  if (objeto(valor)) return Object.values(valor).some(tieneValor);
  return true;
}

function planConTrabajo(plan) {
  if (!objeto(plan)) return tieneValor(plan);
  const { number, name, autoName, autoNameSource, updatedAt, ...desarrollo } = plan;
  // v38 completa number y etapas vacías. El motor también genera nombres
  // automáticos: solo se ignoran si están identificados expresamente como tales.
  if (autoName !== true && (tieneValor(name) || tieneValor(autoNameSource))) return true;
  return tieneValor(updatedAt) || tieneValor(desarrollo);
}

function grupoConTrabajo(grupo) {
  if (grupo === null || grupo === undefined) return false;
  if (!objeto(grupo)) return true; // Forma desconocida: nunca sustituirla.
  const { plansBimestrales, ...datos } = grupo;
  if (tieneValor(datos)) return true;
  if (plansBimestrales === null || plansBimestrales === undefined) return false;
  if (!Array.isArray(plansBimestrales)) return true;
  return plansBimestrales.some(planConTrabajo);
}

function slotConTrabajo(mapa, slot) {
  const materias = propia(mapa.placements, slot) ? mapa.placements[slot] : null;
  if (materias !== null && materias !== undefined &&
    (!Array.isArray(materias) || materias.length > 0)) return true;
  const grupos = mapa.phase2V28.groups;
  if (propia(grupos, slot) && grupoConTrabajo(grupos[slot])) return true;
  // También resguardar desarrollo guardado por el formulario anterior de V2.
  if (objeto(mapa.phase2) && propia(mapa.phase2, slot) && grupoConTrabajo(mapa.phase2[slot])) return true;
  return (mapa.phase2V28.customContents || []).some(contenido => contenido?.groupId === slot);
}

function validarEstado(estado) {
  if (!objeto(estado) || typeof estado.active !== 'string' || !estado.active.trim() ||
    !objeto(estado.maps)) {
    throw new TypeError('Se requiere el estado global V2 con active y maps.');
  }
  if (propia(estado.maps, estado.active) && !objeto(estado.maps[estado.active])) {
    throw new TypeError('El mapa activo de V2 debe ser un objeto.');
  }
}

function validarResultado(resultado) {
  if (!objeto(resultado) || !objeto(resultado.placements) || !objeto(resultado.groups) ||
    !objeto(resultado.resumen)) {
    throw new TypeError('Se requiere el resultado de migración con placements, groups y resumen.');
  }
  const fecha = resultado.fecha;
  if (typeof fecha !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(fecha) ||
    !Number.isFinite(Date.parse(fecha))) {
    throw new TypeError('resultadoMigracion.fecha debe ser una fecha ISO 8601 con zona horaria.');
  }
  if (resultado.socialOption !== null && resultado.socialOption !== undefined &&
    !['A', 'B'].includes(resultado.socialOption)) {
    throw new TypeError('La opción social de la migración debe ser A, B o null.');
  }
  const slots = Object.keys(resultado.groups);
  if (slots.length !== Object.keys(resultado.placements).length) {
    throw new TypeError('Cada grupo migrado debe tener su correspondiente placement.');
  }
  for (const slot of slots) {
    const grupo = resultado.groups[slot];
    if (!slot.trim() || ['__proto__', 'constructor', 'prototype'].includes(slot) ||
      !propia(resultado.placements, slot) || !Array.isArray(resultado.placements[slot]) ||
      !objeto(grupo) || !Array.isArray(grupo.contents) || !Array.isArray(grupo.plansBimestrales)) {
      throw new TypeError(`Grupo o placement de migración inválido: ${slot}.`);
    }
  }
}

function prepararMapa(estado) {
  if (!propia(estado.maps, estado.active)) {
    // Misma estructura inicial que ensure() en ambos app-core del motor.
    Object.defineProperty(estado.maps, estado.active, {
      value: { alt: 'A', mode: 'one', placements: {}, custom: [], valid: false },
      enumerable: true, configurable: true, writable: true
    });
  }
  const mapa = estado.maps[estado.active];
  mapa.placements ??= {};
  mapa.phase2V28 ??= { groups: {} };
  if (!objeto(mapa.placements) || !objeto(mapa.phase2V28)) {
    throw new TypeError('La composición o el desarrollo del mapa activo tiene una estructura inválida.');
  }
  mapa.phase2V28.groups ??= {};
  mapa.phase2V28.customContents ??= [];
  mapa.conflictos ??= [];
  if (!objeto(mapa.phase2V28.groups) || !Array.isArray(mapa.phase2V28.customContents) ||
    !Array.isArray(mapa.conflictos)) {
    throw new TypeError('Los grupos, contenidos propios o conflictos de V2 tienen una estructura inválida.');
  }
  return mapa;
}

function adaptarContenidosDePlanes(grupo) {
  const idsV2 = new Set(grupo.contents.map(String));
  const equivalencias = new Map();
  for (const [idV2, idsLegado] of Object.entries(grupo.origenesContenido || {})) {
    if (!idsV2.has(idV2) || !Array.isArray(idsLegado)) continue;
    for (const idLegado of idsLegado) {
      const clave = String(idLegado);
      if (!equivalencias.has(clave)) equivalencias.set(clave, new Set());
      equivalencias.get(clave).add(idV2);
    }
  }
  return { ...grupo, plansBimestrales: grupo.plansBimestrales.map(plan => {
    if (!objeto(plan) || !Array.isArray(plan.contentIds)) return plan;
    const seleccionados = new Set();
    const contentIds = plan.contentIds.flatMap(id => {
      const destinos = idsV2.has(String(id)) ? [id] : [...(equivalencias.get(String(id)) || [])];
      // Sin equivalencia explícita se conserva la referencia original.
      if (!destinos.length) return [id];
      return destinos.filter(destino => {
        const clave = String(destino);
        if (seleccionados.has(clave)) return false;
        seleccionados.add(clave);
        return true;
      });
    });
    return { ...plan, contentIds };
  }) };
}

/**
 * @param {object} estadoV2 Estado global serializable { active, maps, ... }.
 * @param {object} resultadoMigracion Resultado íntegro de migrarLegadoFgAV2,
 *   acompañado de `fecha` ISO 8601 con zona horaria. La persona que llama agrega
 *   este metadato sin modificar el resultado original ni la función migradora.
 * @returns {object} Copia independiente del estado global V2.
 *
 * Los conflictos quedan en maps[active].conflictos, con el grupo y sus materias
 * propuestos íntegros. Un slot con trabajo de Fase 1 o Fase 2 no se sobrescribe.
 * Los placeholders y planes automáticos vacíos sí pueden recibir la propuesta.
 * En los planes aplicados, las selecciones históricas con equivalencia explícita
 * usan los IDs V2 del grupo. grupoOriginal conserva íntegro el plan histórico.
 *
 * Un cambio de opción social con trabajo en 3.º queda en conflicto, tal como
 * protege v19-map al cambiar A/B. También se retienen los grupos que dependen de
 * ese cambio, para no crear laboratorios ocultos o incompatibles.
 * Incorporar materias o cambiar efectivamente A/B invalida la aprobación de
 * Fase 1, como las asignaciones del motor; agregar solo desarrollo no la altera.
 *
 * migracionLegado.resumen conserva el resumen de la propuesta; los conflictos
 * indican qué parte no se aplicó. La existencia del marcador impide repetir la
 * aplicación, incluso si quedaron conflictos para resolver en una etapa futura.
 */
export function aplicarMigracionEnEstadoV2(estadoV2, resultadoMigracion) {
  validarEstado(estadoV2);
  const nuevoEstado = structuredClone(estadoV2);
  const mapaExistente = propia(nuevoEstado.maps, nuevoEstado.active)
    ? nuevoEstado.maps[nuevoEstado.active] : null;
  if (mapaExistente && propia(mapaExistente, 'migracionLegado')) return nuevoEstado;

  validarResultado(resultadoMigracion);
  const resultado = structuredClone(resultadoMigracion);
  const mapa = prepararMapa(nuevoEstado);
  const opcionActual = ['A', 'B'].includes(mapa.socialOption) ? mapa.socialOption : 'A';
  const opcionPropuesta = resultado.socialOption;
  let cambioComposicion = false;
  const cambioSocialBloqueado = opcionPropuesta != null && opcionPropuesta !== opcionActual &&
    [...SOCIALES_TERCERO].some(slot => slotConTrabajo(mapa, slot));

  if (cambioSocialBloqueado) {
    mapa.conflictos.push({
      tipo: 'opcion-social', actual: opcionActual, propuesta: opcionPropuesta,
      motivo: 'El cambio de opción social afectaría trabajo existente en los laboratorios de 3.º.'
    });
  } else if (opcionPropuesta != null) {
    mapa.socialOption = opcionPropuesta;
    cambioComposicion = opcionPropuesta !== opcionActual;
  }

  for (const [slot, grupo] of Object.entries(resultado.groups)) {
    const dependeDelCambio = cambioSocialBloqueado && SOCIALES_TERCERO.has(slot);
    if (dependeDelCambio || slotConTrabajo(mapa, slot)) {
      mapa.conflictos.push({
        tipo: 'agrupamiento', slot,
        motivo: dependeDelCambio
          ? 'La aplicación del agrupamiento requiere resolver el conflicto de opción social.'
          : 'El espacio ya tiene trabajo en V2; se conservó sin cambios.',
        grupo, placements: resultado.placements[slot]
      });
      continue;
    }
    mapa.placements[slot] = resultado.placements[slot];
    if (resultado.placements[slot].length) cambioComposicion = true;
    // No añadir { data: grupo }: V2 construye ese descriptor al leer el estado.
    mapa.phase2V28.groups[slot] = adaptarContenidosDePlanes(grupo);
  }

  if (cambioComposicion) mapa.valid = false;
  mapa.migracionLegado = { version: VERSION, fecha: resultado.fecha, resumen: resultado.resumen };
  return nuevoEstado;
}
