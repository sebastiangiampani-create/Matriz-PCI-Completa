/**
 * Entrada nativa al motor V2 dentro del documento de la aplicación escolar.
 * Una carga por documento: no crea marcos ni reutiliza un motor de otro PCI.
 */
import { ORIENTATIONS } from '../integracion-curricular/bridge.js';
import { findSpecialty } from '../tecnica/pautas-pci-20261005.mjs';
import { loadV2ModalProfile } from '../v2-familia/catalogos-modalidad.mjs';
import { montarAvisoAceptacionV2 } from '../migracion/aviso-aceptacion-v2.mjs';
import { migrarLegadoFgAV2, materiasMotorMedia } from '../migracion/legado-fg-a-v2.mjs';
import { localizarRecursos } from './recursos.mjs';

const RAIZ = new URL('../../', import.meta.url);
const BASE_V2 = new URL('vendor/pci-sec-aprende-v2/', RAIZ);
const objeto = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const copiar = value => structuredClone(value);
let cargaIniciada = false;

async function texto(ruta) {
  const respuesta = await fetch(new URL(ruta, RAIZ), { cache: 'no-store' });
  if (!respuesta.ok) throw Error('No se pudo cargar un recurso de la aplicación: ' + ruta);
  return respuesta.text();
}

function contextoPublico(contexto) {
  if (!objeto(contexto?.school) || !objeto(contexto?.pci) || !objeto(contexto?.session))
    throw Error('Falta la sesión escolar verificada para abrir el PCI.');
  const schoolId = Number(contexto.school.id);
  const pci = contexto.pci;
  if (!Number.isSafeInteger(schoolId) || schoolId < 1001 ||
      Number(pci.school_id) !== schoolId ||
      !/^[a-zA-Z0-9_-]{3,90}$/.test(String(pci.pci_id || '')) ||
      !['comun', 'tecnica', 'ba15'].includes(pci.model))
    throw Error('La identidad del PCI no corresponde a la escuela seleccionada.');
  // Lista explícita: el contexto público nunca contiene token, claves ni histórico.
  const publicPci = {};
  for (const key of ['pci_id', 'school_id', 'model', 'orientation_id', 'specialty_name',
    'specialty_id', 'shift_id', 'title', 'status', 'process_id']) {
    if (pci[key] !== undefined) publicPci[key] = copiar(pci[key]);
  }
  return {
    school: { id: schoolId, name: String(contexto.school.name || 'Escuela ' + schoolId) },
    pci: publicPci,
    session: { role: String(contexto.session.role || '') },
    permissions: {
      puedeEditar: contexto.permissions?.puedeEditar === true,
      puedeDeclarar: contexto.permissions?.puedeDeclarar === true
    },
    remotoDisponible: false,
    avisoPersistencia: String(contexto.avisoPersistencia || ''),
    avisoHistorico: String(contexto.avisoHistorico || '')
  };
}

function reemplazarUnaVez(source, original, replacement, label) {
  if (source.split(original).length !== 2)
    throw Error('La base V2 cambió: no se pudo preparar ' + label + '.');
  return source.replace(original, replacement);
}

function ejecutar(source, ruta) {
  let failure;
  const capturar = event => { failure = event.error || Error(event.message || ruta); };
  window.addEventListener('error', capturar);
  const script = document.createElement('script');
  const marker = String(ruta);
  window.__PCI_SCRIPT_COMPLETO = null;
  script.textContent = source + '\n;window.__PCI_SCRIPT_COMPLETO=' + JSON.stringify(marker) +
    ';\n//# sourceURL=' + new URL(ruta, RAIZ).href;
  try {
    document.body.appendChild(script);
    if (failure || window.__PCI_SCRIPT_COMPLETO !== marker)
      throw failure || Error('No se pudo iniciar el módulo V2: ' + ruta);
  } finally {
    script.remove();
    window.removeEventListener('error', capturar);
  }
}

function instalarDocumento(html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const scripts = [...parsed.querySelectorAll('script')];
  if (scripts.length !== 1 || scripts[0].src || parsed.querySelector('iframe'))
    throw Error('La plantilla V2 no tiene la estructura nativa esperada.');
  const core = scripts[0].textContent;
  scripts[0].remove();
  parsed.querySelectorAll('base').forEach(node => node.remove());
  const base = parsed.createElement('base');
  base.href = BASE_V2.href;
  parsed.head.prepend(base);
  for (const attribute of [...document.documentElement.attributes])
    document.documentElement.removeAttribute(attribute.name);
  for (const attribute of [...parsed.documentElement.attributes])
    document.documentElement.setAttribute(attribute.name, attribute.value);
  for (const attribute of [...document.body.attributes]) document.body.removeAttribute(attribute.name);
  for (const attribute of [...parsed.body.attributes]) document.body.setAttribute(attribute.name, attribute.value);
  // Reemplazar el DOM mantiene vivos los módulos y el callback del controlador.
  document.head.replaceChildren(...[...parsed.head.childNodes].map(node => document.importNode(node, true)));
  document.body.replaceChildren(...[...parsed.body.childNodes].map(node => document.importNode(node, true)));
  return core;
}

function instalarCatalogoLocal(modal, materiasMedia) {
  const originalFetch = window.fetch.bind(window);
  const resource = value => value.origin + value.pathname;
  const mediaUrl = resource(new URL('data/materias-v2.json', BASE_V2));
  const horasUrl = resource(new URL('data/horas-v2.json', BASE_V2));
  const horas = () => {
    const fg = {}, fo = { '3': {}, A: {} };
    for (const subject of modal.subjects || []) {
      const hours = Number(subject.weeklyHours);
      if (!(hours > 0)) continue;
      const year = String(subject.year);
      if (subject.origin === 'FG') (fg[year] ||= {})[subject.name] = hours;
      else {
        if (year === '3') fo['3'][subject.name] = hours;
        (fo.A[year] ||= {})[subject.name] = hours;
      }
    }
    return { version: 2, source: 'Catálogo de la modalidad ' + modal.model,
      semantics: 'Horas declaradas en el catálogo de la modalidad. Sin dato: Carga horaria pendiente.',
      formacion_general: fg, formacion_orientada: { [modal.track]: fo } };
  };
  window.fetch = function (input, init) {
    const raw = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    // V48/V31 incluyen ?v= en horas-v2.json; sigue siendo el mismo catálogo.
    const url = raw ? resource(new URL(raw, document.baseURI)) : '';
    const data = materiasMedia && url === mediaUrl ? materiasMedia : modal && url === horasUrl ? horas() : null;
    if (data) return Promise.resolve(new Response(JSON.stringify(data), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    }));
    return originalFetch(input, init);
  };
}

/** El controlador escolar verifica identidad y revisiones antes de invocar. */
export async function cargarAplicacionV2({ contexto, estadoInicial = null, vista = 'oferta',
  fuenteLegado = null, matrixRows = [], alGuardarBorrador = () => {} }) {
  if (cargaIniciada || window.PCIAplicacionV2)
    throw Error('Ya hay un PCI abierto en este documento. Regresá a la escuela para cambiarlo.');
  const publico = contextoPublico(contexto);
  if (typeof alGuardarBorrador !== 'function') throw TypeError('El guardado de borrador no es válido.');
  if (estadoInicial !== null && (!objeto(estadoInicial) || !objeto(estadoInicial.maps)))
    throw TypeError('El borrador V2 no contiene un estado completo válido.');
  if (fuenteLegado !== null && (!objeto(fuenteLegado.areas) || !Array.isArray(matrixRows)))
    throw TypeError('La fuente histórica filtrada del PCI no es válida.');
  cargaIniciada = true;
  let instalado = false;
  try {
    const { pci } = publico;
    const media = pci.model === 'comun';
    const especialidad = pci.model === 'tecnica' ? findSpecialty(pci.specialty_name || pci.specialty_id) : null;
    if (pci.model === 'tecnica' && !especialidad) throw Error('La especialidad del PCI no tiene catálogo.');
    const modal = media ? null : await loadV2ModalProfile({
      model: pci.model, orientation: pci.orientation_id, specialty: especialidad?.id
    });
    if (modal && especialidad) modal.specialtyId = especialidad.id;
    const track = media ? ORIENTATIONS.find(item => item.id === pci.orientation_id)?.name : modal.track;
    if (!track) throw Error('La orientación registrada no existe en el catálogo del motor.');
    if (estadoInicial && (!Object.hasOwn(estadoInicial.maps, track) || !objeto(estadoInicial.maps[track])))
      throw Error('El borrador no contiene el mapa del PCI seleccionado.');
    const manifest = JSON.parse(await texto('src/v2-familia/manifiesto-paridad-v2.json'));
    if (modal && (manifest.perfiles?.[pci.model]?.niveles !== modal.levels ||
      manifest.perfiles?.[pci.model]?.cuatrimestres !== modal.terms))
      throw Error('El perfil curricular no coincide con el manifiesto V2.');
    const modules = manifest.modulos.flatMap(entry => {
      const path = media ? entry.media?.archivo || entry.original : entry.archivos?.[pci.model];
      return path ? [{ modulo: entry.modulo, estado: entry.estado, archivo: path }] : [];
    });
    const phase2 = modules.find(entry => entry.modulo === manifest.fase2);
    if (!phase2) throw Error('Falta el Desarrollo Curricular del motor V2.');
    // V28 y V38 comparten DOM en las tres modalidades. Sus mínimos de grilla,
    // encabezados flexibles y scroll del editor requieren el mismo ajuste que
    // Media ya verificó; no se modifica ninguna regla curricular de la modalidad.
    modules.push({ modulo: 'ajustes-vista-media', archivo: 'src/v2-familia/ajustes-vista-media.js' });
    const corePath = media ? 'vendor/pci-sec-aprende-v2/app-core.html' : 'src/v2-familia/app-core-modalidad.html';
    const [html, runtime, materiasText, ...sources] = await Promise.all([
      texto(corePath), texto('src/aplicacion-v2/runtime-v2.js'),
      media ? texto('vendor/pci-sec-aprende-v2/data/materias-v2.json') : Promise.resolve(null),
      ...modules.map(entry => texto(entry.archivo))
    ]);
    const phase2Source = sources[modules.indexOf(phase2)];
    if (!phase2Source.includes('function areaPool') || !phase2Source.includes('window.PCIPhase2V28='))
      throw Error('La Fase 2 cargada no corresponde a la versión curricular aprobada.');
    const storageKey = ['pci-aplicacion-v2', publico.school.id, pci.pci_id, pci.model, 'estado-v1'].join('::');
    const volver = new URL('pci-orientaciones.html', RAIZ);
    volver.searchParams.set('school', String(publico.school.id));
    if (modal) window.__V2_MODAL = modal;
    if (pci.model === 'tecnica') window.__PCI_NORMA = await import('../normativa/composicion-pci-20261117.mjs');
    window.__V2_PARIDAD = { model: media ? 'media' : pci.model, cargados: copiar(modules),
      pendientes: manifest.modulos.filter(entry => entry.estado === 'pendiente-normativa').map(entry => entry.modulo) };
    window.__PCI_ESCUELA_VERIFICADA__ = true;
    window.__PCI_APLICACION_CONFIG = {
      contexto: publico, track, modelo: media ? 'media' : pci.model, storageKey,
      estadoInicial: estadoInicial === null ? null : copiar(estadoInicial),
      fuenteLegado: fuenteLegado === null ? null : copiar(fuenteLegado),
      matrixRows: copiar(matrixRows), vista, volver: volver.href, alGuardarBorrador,
      migracion: { montarAvisoAceptacionV2, migrarLegadoFgAV2, materiasMotorMedia }
    };
    let core = instalarDocumento(localizarRecursos(html, RAIZ.href));
    instalado = true;
    core = reemplazarUnaVez(core, "const STORAGE='pci-sa-v2-app-20260910-21';",
      'const STORAGE=' + JSON.stringify(storageKey) + ';', 'el almacenamiento escolar');
    core = reemplazarUnaVez(core, '\ninit();\n', '\nwindow.__pciBaseInit=init;\n', 'el inicio del motor');
    instalarCatalogoLocal(modal, materiasText ? JSON.parse(materiasText) : null);
    ejecutar(core, corePath);
    // Antes de los módulos: fija identidad, restauración completa, prearmado y save.
    ejecutar(runtime, 'src/aplicacion-v2/runtime-v2.js');
    for (let index = 0; index < modules.length; index++)
      ejecutar(localizarRecursos(sources[index], RAIZ.href), modules[index].archivo);
    if (modal) {
      const style = document.createElement('style');
      style.textContent = '.v48-course-grid,.v57-label-grid,.v72-course-years{grid-template-columns:repeat(' +
        Number(modal.levels) + ',minmax(54px,1fr))!important}';
      document.head.appendChild(style);
    }
    await window.__PCI_INICIAR_APLICACION();
    delete window.__PCI_APLICACION_CONFIG;
    delete window.__PCI_INICIAR_APLICACION;
    delete window.__PCI_SCRIPT_COMPLETO;
    return window.PCIAplicacionV2;
  } catch (error) {
    if (!instalado) cargaIniciada = false;
    if (instalado) {
      const aviso = document.createElement('p');
      aviso.className = 'card panel';
      aviso.setAttribute('role', 'alert');
      aviso.textContent = 'No se pudo abrir el PCI. ' + String(error.message || error);
      document.querySelector('main')?.prepend(aviso);
    }
    throw error;
  }
}
