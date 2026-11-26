import {parsePciRoute, pciRouteHref} from '../pci-router.mjs';
import {filteredHistoricForPci} from '../vinculos-historicos.mjs';
import {loadMatrixContents} from '../integracion-curricular/catalogos.js';
import {crearClienteEscuela, permisosSesion} from './datos-escuela.mjs';
import {identidadPci, leerBorrador, guardarBorrador, borradorSincronizadoCon, resguardarBorrador, claveBorrador} from './documentos.mjs';
import {montarEscuela} from './escuela.mjs';
import {cargarAplicacionV2} from './cargador.mjs';
import {crearColaGuardadoV2} from './persistencia-cola.mjs';

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

function descargarJson(nombre, contenido) {
  const url = URL.createObjectURL(new Blob([contenido], {type:'application/json'}));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Recuperación explícita tras un conflicto. Nada se descarta: el borrador
 * local queda en su resguardo y la versión del servidor sigue en el historial
 * de Supabase (pci_collaboration.unit_history). La persona puede descargar
 * ambas y, si tiene permiso de edición, volver a aplicar sus cambios como una
 * revisión nueva sobre la vigente.
 */
function ofrecerRecuperacion({clave, contexto, copiaServidor}) {
  const destino = document.getElementById('pciV2ContextNotice');
  const contenido = localStorage.getItem(clave);
  if (!destino || contenido === null) return;
  const sello = Date.now();
  const crear = (texto, accion, clase = '') => {
    const boton = document.createElement('button');
    boton.type = 'button';
    // Clases existentes del motor V2 (las mismas de «Reintentar guardado»): sin estilos nuevos.
    boton.className = ('btn soft small pci-v2-resguardo ' + clase).trim();
    boton.textContent = texto;
    boton.onclick = accion;
    return boton;
  };
  const acciones = document.createElement('p');
  acciones.className = 'pci-v2-resguardo-acciones';
  acciones.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
  acciones.append(crear('Descargar mis cambios no confirmados', () =>
    descargarJson('pci-' + contexto.pci.pci_id + '-mis-cambios-' + sello + '.json', contenido)));
  if (copiaServidor) acciones.append(crear('Descargar lo guardado en línea', () =>
    descargarJson('pci-' + contexto.pci.pci_id + '-servidor-' + sello + '.json', JSON.stringify(copiaServidor))));
  if (contexto.permissions?.puedeEditar && typeof window.PCIAplicacionV2?.applyDraft === 'function') {
    acciones.append(crear('Recuperar mis cambios en este PCI', async () => {
      if (!window.confirm('Se aplicarán tus cambios no confirmados como una versión nueva. ' +
        'La versión actual del servidor queda en el historial y podés descargarla antes de continuar. ¿Continuar?')) return;
      try {
        const registro = JSON.parse(contenido);
        await window.PCIAplicacionV2.applyDraft(registro.v2);
        acciones.replaceChildren('Tus cambios se guardaron sobre lo vigente. El resguardo local se conserva.');
      } catch (error) {
        acciones.append(document.createElement('br'), 'No se pudieron aplicar: ' + (error.message || error) +
          '. Tus cambios siguen resguardados.');
      }
    }, 'pci-v2-resguardo-recuperar'));
  }
  destino.append(acciones);
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
  let borrador = leerBorrador(contexto);
  const copiaServidor = unidad.exists && unidad.document ? unidad.document : null;
  if (borrador && unidad.exists && Number(borrador.revisionRemota) !== Number(unidad.revision)) {
    // Nunca bloquear el PCI: el servidor es la versión vigente. Si el borrador
    // ya estaba confirmado no aporta nada; si tenía cambios sin subir, se
    // resguarda completo (sin borrarse) y se avisa para descargarlo o compararlo.
    const conCambiosPropios = !borradorSincronizadoCon(borrador, unidad);
    let clave;
    // Si el navegador no permite copiar (almacenamiento lleno), el borrador
    // queda donde estaba, intacto, y se ofrece igual su descarga.
    try { clave = resguardarBorrador(contexto); }
    catch { clave = claveBorrador(contexto); }
    if (conCambiosPropios) {
      contexto.avisoPersistencia = 'Otra persona guardó cambios más recientes. Se abrió lo guardado en línea y ' +
        'tus cambios no confirmados quedaron resguardados en este navegador. Podés descargarlos para compararlos.';
      contexto.resguardoPendiente = clave;
    }
    borrador = null;
  }
  // Mismo punto de partida que el servidor pero con cambios sin subir
  // (corte de red, cierre del navegador): se abren y se suben al terminar de cargar.
  const cambiosPendientes = Boolean(borrador && contexto.remotoDisponible &&
    borrador.sincronizado !== true && !borradorSincronizadoCon(borrador, unidad));
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
  // Prioridad: preservar siempre el trabajo local y consolidar escrituras
  // remotas sin perder revisiones. Un corte de red no bloquea futuros reintentos;
  // un conflicto 409 sí exige conciliación explícita.
  const cola=crearColaGuardadoV2({
    revisionInicial:contexto.revisionRemota,
    remotoDisponible:contexto.remotoDisponible,
    guardarLocal:(snapshot,revision,sincronizado)=>guardarBorrador(contexto,snapshot,{
      revisionRemota:revision,sincronizado
    }),
    guardarRemoto:(snapshot,revision)=>cliente.guardarUnidad(contexto,snapshot,{
      expected_revision:revision
    }),
    onRevision:revision=>{contexto.revisionRemota=revision}
  });
  const alGuardarBorrador=cola.guardar;
  await cargarAplicacionV2({
    contexto, estadoInicial, vista:route.view, fuenteLegado, matrixRows,
    alGuardarBorrador,
  });
  if (contexto.resguardoPendiente)
    ofrecerRecuperacion({clave:contexto.resguardoPendiente, contexto, copiaServidor});
  if (cambiosPendientes && contexto.permissions.puedeEditar && window.PCIAplicacionV2?.snapshot) {
    const aviso = document.getElementById('pciV2DraftStatus');
    if (aviso) aviso.textContent = 'Subiendo cambios pendientes de una sesión anterior…';
    try {
      await alGuardarBorrador(window.PCIAplicacionV2.snapshot());
      if (aviso) aviso.textContent = 'Cambios pendientes guardados en Supabase · versión confirmada';
    } catch (error) {
      // El borrador local se conserva intacto; el próximo cambio reintenta.
      if (aviso) {
        aviso.textContent = 'Tus cambios pendientes siguen solo en este navegador: ' + (error.message || error);
        aviso.dataset.error = 'true';
      }
    }
  }
}

void iniciar().catch(error => {
  if (error.status === 401) solicitarIngreso('La sesión venció. Ingresá nuevamente con los datos de tu escuela.');
  else informarError(error);
});
