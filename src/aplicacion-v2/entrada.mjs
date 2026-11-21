import {parsePciRoute, pciRouteHref} from '../pci-router.mjs';
import {filteredHistoricForPci} from '../vinculos-historicos.mjs';
import {loadMatrixContents} from '../integracion-curricular/catalogos.js';
import {crearClienteEscuela, permisosSesion} from './datos-escuela.mjs';
import {identidadPci, leerBorrador, guardarBorrador} from './documentos.mjs';
import {montarEscuela} from './escuela.mjs';
import {cargarAplicacionV2} from './cargador.mjs';

const $ = id => document.getElementById(id);
const mostrar = (id, visible) => { if ($(id)) $(id).hidden = !visible; };
const estado = texto => { if ($('status')) $('status').textContent = texto; };

function solicitarIngreso(mensaje) {
  mostrar('app', false);
  mostrar('authRequired', true);
  mostrar('fatal', false);
  if ($('authHelp')) $('authHelp').textContent = mensaje;
  estado('Ingresá con la clave de tu escuela para continuar.');
}

function informarError(error) {
  mostrar('app', false);
  mostrar('authRequired', false);
  if (!$('fatal')) {
    const main = document.createElement('main');
    main.className = 'card';
    main.style.cssText = 'max-width:760px;margin:32px auto;padding:24px;font-family:system-ui';
    const title = document.createElement('h1');
    title.textContent = 'No se pudo abrir este PCI';
    const detail = document.createElement('p');
    detail.textContent = error.message || String(error);
    const back = document.createElement('a');
    back.href = pciRouteHref(location.href, {schoolId:parsePciRoute(location.href).schoolId});
    back.textContent = 'Volver a mi escuela';
    main.append(title, detail, back);
    document.body.replaceChildren(main);
    return;
  }
  $('fatal').textContent = error.message || String(error);
  mostrar('fatal', true);
  estado('No se pudo abrir el PCI. El trabajo conservado no se modificó.');
}

/** El contexto sólo se crea después de verificar la sesión y el alcance escolar. */
async function iniciar() {
  const cliente = crearClienteEscuela();
  estado('Verificando el ingreso a la escuela…');
  let session;
  try { session = await cliente.validarSesion(); }
  catch (error) {
    if (error.status === 401 || error.code === 'SIN_SESION' || error.code === 'SESION_REQUERIDA') {
      solicitarIngreso('Ingresá con el código institucional y tus datos habituales.');
      return;
    }
    throw error;
  }
  if (!session) { solicitarIngreso('Ingresá con el código institucional y tus datos habituales.'); return; }
  const route = parsePciRoute(location.href);
  const escuelas = await cliente.listarEscuelas();
  const elegida = route.schoolId
    ? escuelas.find(s => Number(s.school_id ?? s.id) === route.schoolId)
    : escuelas[0];
  if (!elegida) throw Error('La escuela solicitada no pertenece al alcance de esta sesión.');
  const school = {...elegida, id:Number(elegida.school_id ?? elegida.id)};
  const permissions = permisosSesion(session);
  const contexto = {school, session, permissions, remotoDisponible:false};
  if (!route.schoolId) history.replaceState(null, '', pciRouteHref(location.href, {schoolId:school.id}));

  estado('Cargando los PCI de la escuela…');
  const pcis = await cliente.listarPcis(school.id);
  let vinculos;
  try { vinculos = await cliente.obtenerVinculos(school.id); }
  catch (error) {
    // Sin la asignación verificada no se ofrece incorporar el histórico.
    // La lectura del PCI y los borradores propios siguen estando disponibles.
    if (error.status === 401 || error.status === 403) throw error;
    vinculos = {exists:false, document:null, rows:[], error:error.message};
  }
  if (!route.pciId) {
    montarEscuela({contexto, escuelas, pcis, vinculos, cliente});
    mostrar('authRequired', false);
    mostrar('fatal', false);
    mostrar('app', true);
    estado(vinculos.error
      ? 'Escuela abierta. No se pudo consultar la asignación del trabajo anterior.'
      : 'Seleccioná un PCI de tu escuela para continuar.');
    return;
  }
  if (!pcis.some(p => p.pci_id === route.pciId))
    throw Error('El PCI solicitado no pertenece a la escuela seleccionada.');
  const pci = await cliente.obtenerPci(school.id, route.pciId);
  if (Number(pci.school_id) !== school.id || pci.pci_id !== route.pciId)
    throw Error('La identidad del PCI recibido no coincide con la escuela solicitada.');
  contexto.pci = pci;
  identidadPci(contexto);
  contexto.permissions = {
    ...permissions,
    puedeEditar:permissions.puedeEditar && ['borrador','en_revision'].includes(pci.status),
  };

  let unidad = {exists:false, revision:0, document:null};
  try {
    unidad = await cliente.obtenerUnidad(contexto);
    contexto.remotoDisponible = true;
  } catch (error) {
    if (error.code !== 'CONTRATO_V2_NO_DISPONIBLE') throw error;
    contexto.avisoPersistencia = 'Borrador local. El servicio de la escuela todavía no admite el guardado de este formato V2.';
  }
  const borrador = leerBorrador(contexto);
  if (borrador && unidad.exists && Number(borrador.revisionRemota) !== Number(unidad.revision))
    throw Error('Hay un borrador local y una revisión del servidor diferente. Se conservaron ambos; es necesario conciliarlos antes de editar.');
  const estadoInicial = borrador?.v2 ?? unidad.document?.v2 ?? null;
  contexto.revisionRemota = Number(unidad.revision) || 0;

  let fuenteLegado = null;
  if (!vinculos.error && pci.legacy_state && pci.model !== 'ba15') {
    const linked = filteredHistoricForPci(pci.legacy_state, vinculos.document, pci);
    const origenCompatible = pci.model === 'tecnica' || pci.legacy_state.profile !== 'tecnica' || linked.legacyMode === 'seleccion-explicita';
    if (origenCompatible && Object.values(linked.state?.areas || {}).some(a => a.groups?.length))
      fuenteLegado = linked.state;
    if (linked.missing?.length)
      contexto.avisoHistorico = 'Algunos agrupamientos asignados no están en el resguardo histórico de este PCI. Revisá sus vínculos desde la escuela.';
  } else if (vinculos.error) {
    contexto.avisoHistorico = 'No se pudo comprobar la asignación del trabajo anterior. Su incorporación queda pendiente de esa consulta.';
  }
  const matrixRows = fuenteLegado
    ? await loadMatrixContents({base:new URL('data', location.href).href})
    : [];
  estado('Abriendo el constructor y el desarrollo curricular…');
  await cargarAplicacionV2({
    contexto, estadoInicial, vista:route.view, fuenteLegado, matrixRows,
    alGuardarBorrador:estadoV2 => guardarBorrador(contexto, estadoV2, {revisionRemota:contexto.revisionRemota}),
  });
}

void iniciar().catch(error => {
  if (error.status === 401) solicitarIngreso('La sesión venció. Ingresá nuevamente con los datos de tu escuela.');
  else informarError(error);
});
