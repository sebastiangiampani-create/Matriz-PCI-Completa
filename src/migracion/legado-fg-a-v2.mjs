/**
 * Propuesta de traspaso de FG histórica al estado V2. No persiste ni modifica datos.
 * Los IDs de materias son distintos de los IDs de contenidos curriculares.
 */
import { analyzeAutomaticFgMatches } from '../integracion-curricular/auto-homologacion-fg.js';

const copiar = valor => valor === undefined ? null : JSON.parse(JSON.stringify(valor));
const lista = valor => Array.isArray(valor) ? valor : [];
const objeto = valor => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const normalizar = valor => String(valor ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = valor => normalizar(valor).replace(/ /g, '-');
const materiaClave = valor => ({
  'lengua adicional': 'lenguas adicionales',
  'lenguas adicional': 'lenguas adicionales',
  'tecnologia de la informacion': 'tecnologias de la informacion',
  'educacion artistica artes visuales': 'artes visuales',
  'formacion etica ciudadana': 'formacion etica y ciudadana'
}[normalizar(valor)] || normalizar(valor));

const FILAS = Object.freeze({
  'lengua y literatura': 'lengua',
  'matematica': 'matematica',
  'lenguas adicionales': 'adicional',
  'lengua adicional': 'adicional',
  'ciencias naturales': 'naturales',
  'ciencias sociales': 'socialA',
  'artes': 'artes',
  'educacion artistica': 'artes',
  'tecnologias': 'tecnologias',
  'educacion fisica': 'ef',
  'otros formatos pedagogicos': 'otros'
});
const ANUALES = new Set(['lengua', 'matematica', 'adicional']);
const ESTADOS_DIRECTOS = new Set(['confirmed', 'exact']);

function permitido(tipo, fila, anio, cuatrimestre) {
  if (tipo === 'ba15') return false; // No equiparar automáticamente los cinco años históricos con cuatro niveles.
  if (tipo === 'media') {
    if (anio < 1 || anio > 5) return false;
    if (ANUALES.has(fila)) return true;
    if (fila === 'artes') return [1, 2, 3, 4, 7, 8].includes(cuatrimestre);
    if (fila === 'tecnologias') return cuatrimestre <= 8;
    return ['naturales', 'socialA', 'ef', 'otros'].includes(fila);
  }
  if (tipo === 'tecnica') {
    if (anio < 1 || anio > 6) return false;
    if (fila === 'lengua' || fila === 'adicional') return anio <= 5;
    if (fila === 'matematica') return true;
    if (fila === 'naturales') return cuatrimestre <= 6;
    if (fila === 'artes') return cuatrimestre <= 2;
    return ['socialA', 'ef', 'otros'].includes(fila);
  }
  return false;
}

function materiasExactas({ grupo, anio, area, modelo, catalogoHistorico, catalogoV2 }) {
  const origenes = [...new Set(lista(grupo.items).map(String))]
    .map(id => catalogoHistorico.get(id)).filter(Boolean);
  const disponibles = lista(modelo.subjects);
  const ids = new Set();
  const faltantes = [];
  for (const materia of new Set(origenes.map(x => String(x.subject ?? '')).filter(Boolean))) {
    const referencias = catalogoV2.filter(x => Number(x.year) === anio &&
      materiaClave(x.subject) === materiaClave(materia) &&
      normalizar(x.area) === normalizar(area));
    const nombres = [...new Set(referencias.map(x => x.subject))];
    if (nombres.length !== 1) {
      faltantes.push({ materia, motivo: 'Sin materia oficial única para esa área y año' });
      continue;
    }
    if (disponibles.length) {
      const candidatas = disponibles.filter(x => Number(x.year) === anio &&
        materiaClave(x.name) === materiaClave(nombres[0]) &&
        (x.origin === undefined || x.origin === 'FG'));
      if (candidatas.length !== 1 || !candidatas[0].id) {
        faltantes.push({ materia, motivo: 'La materia no tiene un ID único en la bolsa V2' });
        continue;
      }
      ids.add(String(candidatas[0].id));
    } else if (modelo.tipo === 'media') {
      // ID real de fgSubjects() en vendor/pci-sec-aprende-v2/app-v2.js.
      ids.add(`fg-${anio}-${slug(nombres[0])}`);
    } else {
      faltantes.push({ materia, motivo: 'Falta el catálogo de IDs de materias de la modalidad V2' });
    }
  }
  return { ids: [...ids], faltantes };
}

/**
 * @param {object} args Copia exportada de FG, catálogos de referencia y modelo V2.
 * @returns {{placements:object,groups:object,pendientes:Array,sinUbicar:Array,resumen:object}}
 */
export function migrarLegadoFgAV2({
  legacyState, matrixRows, v2FgRows, approvedMappings = {}, model, orientationId
}) {
  if (!objeto(legacyState?.areas) || !Array.isArray(matrixRows) || !Array.isArray(v2FgRows)) {
    throw new TypeError('Se requieren áreas históricas y ambos catálogos completos.');
  }
  if (!objeto(approvedMappings)) throw new TypeError('Homologaciones inválidas.');
  if (!String(orientationId ?? '').trim()) throw new TypeError('Falta la orientación del PCI.');
  const tipo = typeof model === 'string' ? model : (model?.model ?? model?.type);
  if (!['media', 'tecnica', 'ba15'].includes(tipo)) throw new TypeError('Modelo V2 no reconocido.');
  const modelo = { tipo, subjects: lista(objeto(model) ? model.subjects : null) };
  const origen = copiar(legacyState);
  const matriz = copiar(matrixRows);
  const v2 = copiar(v2FgRows);
  const aprobadas = copiar(approvedMappings);
  const placements = {}, groups = {}, pendientes = [], sinUbicar = [];
  const indiceMatriz = new Map(matriz.map(x => [String(x.id), x]));
  const areasAnalisis = {};
  for (const [area, bloque] of Object.entries(origen.areas)) {
    areasAnalisis[area] = { groups: lista(bloque?.groups).filter(objeto) };
  }
  const analisis = analyzeAutomaticFgMatches({
    areas: areasAnalisis, matrixRows: matriz, v2FgRows: v2,
    orientationId: String(orientationId), approvedMappings: aprobadas
  });
  const coincidencias = new Map();
  for (const fila of analisis.rows) {
    for (const referencia of fila.groups) {
      const clave = JSON.stringify([referencia.containerArea, referencia.id, fila.year, fila.matrixId]);
      coincidencias.set(clave, fila);
    }
  }

  const guardarSinUbicar = (area, grupo, motivo) => sinUbicar.push({
    tipo: 'agrupamiento', area, motivo, grupoOriginal: copiar(grupo)
  });
  const guardarPendiente = (area, grupo, motivo) => pendientes.push({
    tipo: 'agrupamiento', area, motivo, grupoOriginal: copiar(grupo)
  });

  for (const [area, bloque] of Object.entries(origen.areas)) {
    if (!objeto(bloque) || !Array.isArray(bloque.groups)) {
      sinUbicar.push({ tipo: 'area', area, motivo: 'Estructura de área no reconocida', datosOriginales: copiar(bloque) });
      continue;
    }
    const porAnio = new Map();
    for (const grupo of bloque.groups) {
      if (!objeto(grupo)) {
        guardarSinUbicar(area, grupo, 'Agrupamiento sin estructura válida');
        continue;
      }
      const anio = Number(grupo.level);
      if (!Number.isInteger(anio) || anio < 1 || anio > 5) {
        guardarSinUbicar(area, grupo, 'Año histórico inexistente o inválido');
        continue;
      }
      const listaAnio = porAnio.get(anio) || [];
      listaAnio.push(grupo);
      porAnio.set(anio, listaAnio);
    }
    const fila = FILAS[normalizar(area)];
    for (const [anio, gruposAnio] of porAnio) {
      if (!fila) {
        gruposAnio.forEach(grupo => guardarSinUbicar(area, grupo, 'Área sin fila equivalente en el mapa V2'));
        continue;
      }
      if (tipo === 'ba15') {
        gruposAnio.forEach(grupo => guardarSinUbicar(area, grupo,
          'BA +15 requiere equivalencia explícita entre los cinco años históricos y sus cuatro niveles'));
        continue;
      }
      if ((ANUALES.has(fila) && gruposAnio.length !== 1) ||
        (!ANUALES.has(fila) && gruposAnio.length > 2)) {
        gruposAnio.forEach(grupo => guardarPendiente(area, grupo,
          'Cantidad de agrupamientos del año incompatible con la regla de ubicación'));
        continue;
      }
      for (let posicion = 0; posicion < gruposAnio.length; posicion++) {
        const grupo = gruposAnio[posicion];
        const cuatrimestre = 2 * anio - 1 + posicion;
        const slot = ANUALES.has(fila) ? `${fila}-n${anio}` : `${fila}-c${cuatrimestre}`;
        if (!permitido(tipo, fila, anio, cuatrimestre)) {
          guardarSinUbicar(area, grupo, `El espacio ${slot} no está habilitado por el modelo V2`);
          continue;
        }
        if (Object.hasOwn(groups, slot)) {
          guardarPendiente(area, grupo, `El slot ${slot} ya pertenece a otro agrupamiento anterior`);
          continue;
        }
        if (!Array.isArray(grupo.items) ||
          (grupo.plansBimestrales !== undefined && !Array.isArray(grupo.plansBimestrales)) ||
          lista(grupo.plansBimestrales).some(plan => !objeto(plan))) {
          guardarSinUbicar(area, grupo, 'Contenidos o planes con una estructura que V2 no admite');
          continue;
        }
        const planes = lista(grupo.plansBimestrales);
        const capacidad = ANUALES.has(fila) ? 4 : 2;
        if (planes.length > capacidad) {
          guardarSinUbicar(area, grupo,
            `Contiene ${planes.length} planes; V2 solo conserva ${capacidad} en ${slot}`);
          continue;
        }
        const materias = materiasExactas({
          grupo, anio, area, modelo, catalogoHistorico: indiceMatriz, catalogoV2: v2
        });
        const contenidos = [], origenesContenido = {};
        for (const matrixId of [...new Set(lista(grupo.items).map(String))]) {
          const clave = JSON.stringify([area, String(grupo.id ?? ''), anio, matrixId]);
          const hallazgo = coincidencias.get(clave);
          const original = indiceMatriz.get(matrixId) || null;
          if (hallazgo && ESTADOS_DIRECTOS.has(hallazgo.status) && hallazgo.references.length) {
            for (const referencia of hallazgo.references) {
              const id = String(referencia.id);
              if (!contenidos.includes(id)) contenidos.push(id);
              (origenesContenido[id] ||= []).push(matrixId);
            }
          } else {
            pendientes.push({
              tipo: 'contenido', area, anio, slot, grupoId: String(grupo.id ?? ''),
              matrixId, textoOriginal: original?.text ?? null,
              contenidoOriginal: original ? copiar(original) : null,
              estado: hallazgo?.status ?? 'unmatched',
              motivo: hallazgo?.reason ?? 'Sin correspondencia acreditada',
              referenciasSugeridas: copiar(hallazgo?.references ?? [])
            });
          }
        }
        for (const falta of materias.faltantes) {
          pendientes.push({ tipo: 'materia', area, anio, slot,
            grupoId: String(grupo.id ?? ''), ...falta });
        }
        // Los planes se mantienen completos y en el campo que utiliza el editor V2.
        const planesConOrigen = copiar(planes).map(plan => ({
          ...plan, origen: 'pci-anterior', legacyGroupId: String(grupo.id ?? '')
        }));
        placements[slot] = materias.ids;
        groups[slot] = {
          name: String(grupo.name ?? ''),
          objectives: grupo.objectives ?? grupo.objective ?? '',
          synopsis: grupo.synopsis ?? grupo.summary ?? '',
          context: grupo.context ?? grupo.problemContext ?? '',
          practice: grupo.practice ?? grupo.practiceAxis ?? '',
          contents: contenidos,
          plansBimestrales: planesConOrigen,
          origen: 'pci-anterior',
          legacyGroupId: String(grupo.id ?? ''),
          materiasPropuestas: copiar(materias.ids),
          origenesContenido,
          grupoOriginal: copiar(grupo)
        };
      }
    }
  }
  const bloqueados = [...pendientes.filter(x => x.tipo === 'agrupamiento'),
    ...sinUbicar.filter(x => x.tipo === 'agrupamiento')];
  const planesPendientes = bloqueados.reduce((s, x) => s + lista(x.grupoOriginal?.plansBimestrales).length, 0);
  const contenidosPendientesDeGrupos = bloqueados.reduce((s, x) =>
    s + lista(x.grupoOriginal?.items).length, 0);
  const resumen = {
    agrupamientosMigrados: Object.keys(groups).length,
    agrupamientosPendientes: pendientes.filter(x => x.tipo === 'agrupamiento').length,
    agrupamientosSinUbicar: sinUbicar.filter(x => x.tipo === 'agrupamiento').length,
    contenidosDirectos: Object.values(groups).reduce((s, g) =>
      s + Object.values(g.origenesContenido).reduce((n, ids) => n + ids.length, 0), 0),
    contenidosV2: Object.values(groups).reduce((s, g) => s + g.contents.length, 0),
    contenidosPendientes: pendientes.filter(x => x.tipo === 'contenido').length + contenidosPendientesDeGrupos,
    materiasPendientes: pendientes.filter(x => x.tipo === 'materia').length,
    planesConservados: Object.values(groups).reduce((s, g) => s + g.plansBimestrales.length, 0),
    planesPendientes,
    sinUbicar: sinUbicar.length,
    aprobacionesAutomaticasNuevas: 0
  };
  return { placements, groups, pendientes, sinUbicar, resumen };
}
