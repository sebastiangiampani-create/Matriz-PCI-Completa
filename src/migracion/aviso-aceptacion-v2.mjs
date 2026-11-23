import {
  prepararRevisionMigracionV2, aceptarRevisionMigracionV2
} from './revision-aceptacion-v2.mjs';

/** Aviso dentro del constructor existente. No consulta red ni guarda documentos. */
export function montarAvisoAceptacionV2({ host, getState, applyState,
  canEdit = () => true, onEvent = () => {} }) {
  const doc = host.ownerDocument;
  let propuesta, revision, estado = 'inactivo', busy = false;
  const element = (tag, text, className) => {
    const el = doc.createElement(tag);
    if (text !== undefined) el.textContent = String(text);
    if (className) el.className = className;
    // Los controles deben quedar accesibles entre el encabezado y el dock móvil.
    if (tag === 'button' || tag === 'summary') el.style.scrollMarginBlock = '100px';
    return el;
  };
  host.id = 'v2MigrationNotice';
  host.className = 'card panel';
  host.hidden = true;
  host.style.marginBottom = '20px';
  host.style.scrollMarginTop = '88px';
  // El histórico puede contener palabras o referencias sin espacios.
  host.style.overflowWrap = 'anywhere';
  host.setAttribute('aria-labelledby', 'v2MigrationTitle');

  function notify() {
    onEvent({ estado, resumen: revision ? structuredClone(revision.resumen) : null });
  }
  function error(message) {
    estado = 'error';
    render(message);
    notify();
  }
  function preparar(resultado) {
    if (busy) return;
    propuesta = structuredClone(resultado);
    try {
      revision = prepararRevisionMigracionV2(getState(), propuesta);
      estado = revision.estado;
      render();
      notify();
    } catch (e) { error(e.message); }
  }
  function cancelar() {
    if (busy || estado === 'aceptada' || estado === 'ya-aplicada') return;
    estado = 'cancelada';
    render();
    notify();
  }
  function invalidar() {
    // Una importación o cambio de contexto exige recibir otra propuesta explícita.
    propuesta = undefined;
    revision = undefined;
    estado = 'inactivo';
    host.hidden = true;
    host.replaceChildren();
  }
  async function aceptar() {
    if (busy || !revision?.puedeAceptar) return;
    if (!canEdit()) {
      error('La sesión actual no permite incorporar el trabajo anterior. No se aplicó la propuesta.');
      return;
    }
    busy = true;
    host.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try {
      const result = aceptarRevisionMigracionV2(getState(), revision, new Date().toISOString());
      if (result.estado === 'aceptada') await applyState(result.estadoV2);
      revision = result.revision;
      estado = result.estado;
      render();
      notify();
    } catch (e) { error(e.message); }
    finally { busy = false; }
  }
  function metric(parent, key, title) {
    const block = element('div');
    const value = element('strong', revision.resumen[key] ?? 0);
    value.dataset.migrationCount = key;
    block.append(value, element('div', title, 'help'));
    parent.append(block);
  }
  function detailList(parent, title, items, describe) {
    if (!items.length) return;
    parent.append(element('h3', title));
    const list = element('ul');
    for (const item of items) {
      const line = element('li');
      const { name, reason } = describe(item);
      line.append(element('strong', name));
      if (reason) line.append(element('p', reason, 'help'));
      list.append(line);
    }
    parent.append(list);
  }
  function render(customMessage) {
    host.hidden = false;
    host.dataset.estado = estado;
    host.replaceChildren();
    const title = element('h2', estado === 'aceptada'
      ? 'Trabajo anterior incorporado al borrador' : 'Incorporar el trabajo anterior a este PCI');
    title.id = 'v2MigrationTitle';
    host.append(title);
    const messages = {
      lista: 'Revisá la propuesta antes de incorporarla. El trabajo anterior se conserva y los espacios que ya tienen trabajo no se reemplazan.',
      actualizada: 'El mapa cambió mientras revisabas la propuesta. Se actualizaron los resultados; revisalos antes de volver a aceptar. Todavía no se incorporó nada.',
      aceptada: 'La copia se incorporó al borrador local. No se guardó en línea. Los conflictos y pendientes continúan disponibles para revisión.',
      cancelada: 'La incorporación fue cancelada. El mapa, los contenidos y los planes permanecen sin cambios.',
      'ya-aplicada': 'Este PCI ya tiene registrada la incorporación del trabajo anterior. No se volverá a aplicar ni se duplicarán sus agrupamientos.',
      'sin-aplicables': 'No hay agrupamientos disponibles para incorporar. Revisá los conflictos y pendientes; no se registró ninguna aceptación.'
    };
    const status = element('p', customMessage || messages[estado] || '', 'help');
    status.id = 'v2MigrationStatus';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    host.append(status);
    if (estado === 'cancelada') {
      const reopen = element('button', 'Volver a revisar', 'btn soft');
      reopen.id = 'v2MigrationReview';
      reopen.type = 'button';
      reopen.onclick = () => preparar(propuesta);
      host.append(reopen);
      return;
    }
    if (!revision || estado === 'error') return;
    const metrics = element('div');
    metrics.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px;margin:18px 0';
    const applied = estado === 'aceptada';
    for (const [key, label] of [
      ['agrupamientos', applied ? 'Agrupamientos incorporados' : 'Agrupamientos por incorporar'],
      ['planesBimestrales', applied ? 'Planes bimestrales conservados' : 'Planes bimestrales por conservar'],
      ['contenidosUnicos', 'Contenidos diferentes'],
      ['conflictosAgrupamientos', 'Agrupamientos con conflicto'],
      ['pendientesContenidos', 'Contenidos pendientes de equivalencia'],
      ['pendientesMaterias', 'Materias pendientes de correspondencia'],
      ['pendientesAgrupamientos', 'Agrupamientos pendientes'],
      ['sinUbicar', 'Elementos sin ubicación'],
      ['omitidosVacios', 'Agrupamientos vacíos omitidos']
    ]) metric(metrics, key, label);
    host.append(metrics);
    if (revision.social?.propuesta) {
      const labs = option => option === 'B' ? 12 : 10;
      host.append(element('p', revision.social.conflicto
        ? `Se mantiene la opción de ${labs(revision.social.actual)} laboratorios de Sociales. La propuesta de ${labs(revision.social.propuesta)} requiere resolver los conflictos.`
        : `Ciencias Sociales: opción de ${labs(revision.social.efectiva)} laboratorios.`, 'help'));
    }
    const details = element('details');
    details.id = 'v2MigrationDetails';
    details.append(element('summary', 'Ver agrupamientos, conflictos y pendientes'));
    const data = revision.detalles;
    detailList(details, applied ? 'Agrupamientos incorporados' : 'Agrupamientos por incorporar',
      data.gruposAplicables, item => ({ name: item.nombre || 'Agrupamiento anterior',
        reason: `${item.planesBimestrales} planes bimestrales; ${item.asignacionesContenidos} asignaciones de contenidos.` }));
    detailList(details, 'Conflictos que requieren revisión', data.conflictos,
      item => ({ name: item.tipo === 'opcion-social' ? 'Opción de Ciencias Sociales'
        : item.grupo?.name || 'Espacio con trabajo previo', reason: item.motivo }));
    const describe = item => ({ name: item.grupoOriginal?.name || item.textoOriginal ||
      item.materia || item.area || 'Elemento anterior', reason: item.motivo });
    detailList(details, 'Pendientes de revisión', data.pendientes, describe);
    detailList(details, 'Sin ubicación en el mapa', data.sinUbicar, describe);
    detailList(details, 'Agrupamientos vacíos omitidos', data.omitidosVacios,
      item => ({ name: `${item.area} · nivel ${item.nivel ?? 'sin indicar'}`,
        reason: `${item.planesPlantilla || 0} plantillas de planes bimestrales sin desarrollo.` }));
    host.append(details);
    host.append(element('p', 'Un plan por bimestre: dos en cada espacio cuatrimestral y cuatro en cada espacio anual.', 'help'));
    host.append(element('p', 'La incorporación no valida el mapa ni aprueba las equivalencias pendientes. El guardado en línea es un paso separado.', 'help'));
    if (estado === 'aceptada' || estado === 'ya-aplicada') {
      const completed = element('button', 'Incorporación ya registrada', 'btn mint');
      completed.id = 'v2MigrationAccept';
      completed.type = 'button';
      completed.disabled = true;
      host.append(completed);
      return;
    }
    const actions = element('div', undefined, 'row');
    actions.style.flexWrap = 'wrap';
    const accept = element('button', 'Incorporar al borrador', 'btn mint');
    accept.type = 'button';
    accept.id = 'v2MigrationAccept';
    accept.disabled = !revision.puedeAceptar || !canEdit();
    accept.onclick = aceptar;
    const cancel = element('button', 'Cancelar', 'btn soft');
    cancel.type = 'button';
    cancel.id = 'v2MigrationCancel';
    cancel.onclick = cancelar;
    actions.append(accept, cancel);
    host.append(actions);
  }
  host.addEventListener('keydown', event => {
    if (event.key === 'Escape' && ['lista', 'actualizada', 'sin-aplicables'].includes(estado)) {
      event.preventDefault();
      cancelar();
    }
  });
  return { preparar, invalidar, error };
}
