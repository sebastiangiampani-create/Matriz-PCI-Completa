/** Prescripción PVF de Media sobre el motor nativo, después de sus capas. */
(() => {
  'use strict';
  const config = window.__PCI_APLICACION_CONFIG;
  if (config?.modelo !== 'media') return;
  const rules = config.pvfMedia;
  if (!rules?.resolvePvf || !rules?.aplicarPvfEnMapa || !rules?.grupoPvfConTrabajo)
    throw Error('Falta la prescripción de PVF para Media.');

  const SLOT = 'proyecto-n5';
  const orientationId = config.contexto.pci.orientation_id;
  const editable = config.contexto.permissions.puedeEditar === true;
  const copy = value => JSON.parse(JSON.stringify(value));
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const current = () => ensure(config.track);
  const available = () => !!DATA?.formacion_orientada?.[config.track] && state.active === config.track;
  let latest = null, lastMap = null, attemptedConflict = null, reconciling = false;

  function resolve(alternative = current().alt || 'A') {
    const map = current(), previous = map.alt;
    // fo()/subjects() son el catálogo efectivo del motor. Sus IDs no se fabrican.
    // La consulta de otra alternativa es sin render, guardado ni cambios de planes.
    try {
      map.alt = alternative;
      return rules.resolvePvf({ orientationId, alternative, subjects: subjects() });
    } finally { map.alt = previous; }
  }

  function accept(result, map) {
    // Mantener la referencia del mapa protege el histórico del prearmado FG.
    // No reemplazar los objetos de Fase 2 mientras un editor los está utilizando.
    if (result.cambio) {
      for (const key of ['placements', 'pvfMedia', 'valid'])
        if (Object.hasOwn(result.mapa, key)) map[key] = result.mapa[key];
    }
    if (result.estado === 'conflicto') map.valid = false;
  }

  function reconcile() {
    if (!available() || reconciling) return latest;
    reconciling = true;
    try {
      const map = current();
      if (lastMap !== map) { lastMap = map; attemptedConflict = null; }
      // En la orientación sin alternativas, el catálogo siempre utiliza A.
      if (!map.alt || DATA.formacion_orientada[config.track].sinAlternativas) map.alt = 'A';
      const prescripcion = resolve();
      const result = rules.aplicarPvfEnMapa(map, { prescripcion });
      const teacherConflict = result.conflicto ? null : assignedTeacherConflict(map, prescripcion);
      if (teacherConflict) {
        map.valid = false;
        latest = { prescripcion, estado: 'conflicto', conflicto: teacherConflict };
      } else {
        accept(result, map);
        latest = { prescripcion, estado: result.estado, conflicto: result.conflicto };
      }
    } catch (error) {
      current().valid = false;
      latest = { prescripcion: null, estado: 'conflicto', conflicto: {
        code: 'PVF_CATALOGO', message: 'No se pudo verificar la materia prescripta de PVF: ' +
          String(error.message || error)
      } };
    } finally { reconciling = false; }
    if (!latest?.conflicto) releaseValidationGuard();
    decorateConflict();
    return latest;
  }

  function status() {
    reconcile();
    return copy({ orientationId, alternative: current().alt || 'A',
      prescripcion: latest?.prescripcion || null, estado: latest?.estado || 'pendiente',
      conflicto: latest?.conflicto || null, bloqueo: attemptedConflict });
  }

  function fixedMessage() {
    const name = latest?.prescripcion?.name;
    return (name ? name + ' es la materia prescripta de PVF' : 'La materia de PVF está prescripta') +
      ' y permanece fija en el espacio anual de 5.º, C9–C10.';
  }

  function blocked(message) {
    const box = document.getElementById('validation');
    if (box) {
      box.className = 'validation rule-block';
      box.dataset.pvfBlocked = 'true';
      const title = document.createElement('strong');
      title.textContent = 'Acción no permitida';
      box.replaceChildren(title, document.createTextNode(message));
    }
    toast(message, true);
    return false;
  }

  function decorateConflict() {
    const conflict = latest?.conflicto || attemptedConflict;
    let node = document.getElementById('pciPvfConflict');
    if (!conflict) { node?.remove(); return; }
    if (!node) {
      node = document.createElement('div');
      node.id = 'pciPvfConflict';
      node.className = 'validation rule-block';
      node.setAttribute('role', 'alert');
      document.querySelector('main.wrap')?.prepend(node);
    }
    const stateConflict = !!latest?.conflicto;
    const prescription = latest?.prescripcion;
    const canResolve = canResolveConflict();
    const title = stateConflict ? 'PVF requiere revisión. ' : 'Se conserva la alternativa actual. ';
    let text = title + conflict.message;
    if (stateConflict && prescription) text += ' Materia prescripta: ' + prescription.name +
      ' · ' + prescription.hours + ' HC · 5.º anual, C9–C10.';
    const otherSlots = stateConflict ? [...new Set([...prescriptionElsewhere(),
      ...(latest.conflicto.actual?.otrosSlots || [])])] : [];
    if (otherSlots.length) text += ' Quitá primero sus asignaciones en: ' + otherSlots.map(slotLabel).join('; ') + '.';
    if (canResolve) text += ' Si aplicás la prescripción, los contenidos y planes se conservarán para revisarlos con esa materia.';
    const signature = JSON.stringify([text, canResolve, stateConflict]);
    if (node.dataset.pvfMessage !== signature) {
      node.dataset.pvfMessage = signature;
      node.replaceChildren(document.createTextNode(text));
      if (canResolve) {
        const actions = document.createElement('div');
        actions.className = 'row';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn small';
        button.dataset.pvfResolver = 'true';
        button.textContent = 'Aplicar materia prescripta y conservar el desarrollo';
        button.onclick = resolveConflict;
        actions.appendChild(button);
        node.appendChild(actions);
      }
    }
    node.dataset.pvfConflict = latest?.conflicto ? 'estado' : 'alternativa';
  }

  function sourceIsFixed(id, slot) {
    // Una composición incompatible debe poder corregirse con los controles
    // habituales. La prohibición fuerte corresponde al PVF ya prescripto.
    if (latest?.conflicto) return false;
    return slot === SLOT || !!id && id === latest?.prescripcion?.subjectId;
  }

  function forbidAssignment(slot, id) {
    return slot === SLOT || !!id && id === latest?.prescripcion?.subjectId;
  }

  function prescriptionElsewhere() {
    const id = latest?.prescripcion?.subjectId;
    if (!id) return [];
    return Object.entries(current().placements || {}).filter(([slot, ids]) =>
      slot !== SLOT && (Array.isArray(ids) ? ids.includes(id) : ids === id)).map(([slot]) => slot);
  }

  function slotLabel(slot) {
    const match = slot.match(/^(.*)-([cn])(\d+)$/);
    const row = match && rowDefs().find(item => item.k === match[1]);
    return row ? row.l + (match[2] === 'n' ? ' · Nivel ' + match[3] + ' anual' : ' · C' + match[3]) : slot;
  }

  function canResolveConflict() {
    if (!editable || !latest?.conflicto || !latest.prescripcion || prescriptionElsewhere().length) return false;
    const recognized = new Set(['PVF_COMPOSICION_NO_PRESCRIPTA', 'PVF_IDENTIDAD_PREVIA_INCOMPATIBLE',
      'PVF_TRABAJO_INCOMPATIBLE', 'PVF_DOCENTE_ASIGNADO']);
    if (!recognized.has(latest.conflicto.code)) return false;
    const map = current(), ids = map.placements?.[SLOT] || [];
    if (!object(map.placements) || !Array.isArray(ids) ||
      !ids.every(id => typeof id === 'string' && !!byId(id))) return false;
    if (map.pvfMediaHistorial !== undefined && !Array.isArray(map.pvfMediaHistorial)) return false;
    if (map.teachers !== undefined && !object(map.teachers)) return false;
    for (const phase of [map.phase2V28, map.phase2]) if (phase !== undefined && phase !== null && !object(phase)) return false;
    const phase = map.phase2V28;
    if (phase?.groups !== undefined && !object(phase.groups)) return false;
    if (phase?.customContents !== undefined && !Array.isArray(phase.customContents)) return false;
    for (const group of [phase?.groups?.[SLOT], map.phase2?.[SLOT]]) {
      if (group === undefined || group === null) continue;
      if (!object(group) || group.contents !== undefined && !Array.isArray(group.contents) ||
        group.plansBimestrales !== undefined && !Array.isArray(group.plansBimestrales)) return false;
    }
    return true;
  }

  function resolveConflict() {
    reconcile();
    if (!canResolveConflict()) return blocked('Revisá primero las ubicaciones o la estructura del PVF. Se conserva el trabajo existente.');
    const map = current(), prescription = copy(latest.prescripcion);
    const candidate = { ...map, placements: { ...map.placements, [SLOT]: [prescription.subjectId] }, pvfMedia: prescription };
    const checked = rules.aplicarPvfEnMapa(candidate, { prescripcion: prescription });
    if (checked.conflicto) return blocked(checked.conflicto.message);
    // Respaldo limitado a la composición e identidad de PVF, sin estado completo
    // ni eliminación de entradas anteriores. Los grupos y docentes no se tocan.
    const history = { fecha: new Date().toISOString(), slot: SLOT,
      composicionAnterior: copy(map.placements[SLOT] || []), prescripcionAnterior: copy(map.pvfMedia || null) };
    map.pvfMediaHistorial = [...(map.pvfMediaHistorial || []), history];
    map.placements[SLOT] = [prescription.subjectId];
    map.pvfMedia = prescription;
    map.valid = false;
    attemptedConflict = null;
    reconcile();
    save();
    renderOffer();
    window.PCIPhase2V28?.renderGroups?.();
    toast('Materia prescripta aplicada. Los contenidos, planes y asignaciones docentes se conservaron para su revisión.');
    return true;
  }

  function makeNote(host, text) {
    let note = host.querySelector('[data-pvf-fixed]');
    if (!note) {
      note = document.createElement('small');
      note.dataset.pvfFixed = 'true';
      note.className = 'pci-pvf-fixed';
      host.appendChild(note);
    }
    if (note.textContent !== text) note.textContent = text;
  }

  function releaseValidationGuard() {
    const button = document.getElementById('validateBtn');
    if (button?.dataset.pvfDisabled !== 'true') return;
    button.disabled = button.dataset.pvfPreviousDisabled === 'true' || !editable ||
      button.dataset.v80AccessDisabled === '1';
    button.title = button.dataset.pvfPreviousTitle || '';
    delete button.dataset.pvfDisabled;
    delete button.dataset.pvfPreviousDisabled;
    delete button.dataset.pvfPreviousTitle;
  }

  function decorateMap(guardValidation = false) {
    const matrix = document.getElementById('matrix');
    const cell = matrix?.querySelector('[data-slot="' + SLOT + '"]');
    if (!cell) return;
    cell.dataset.pvfPrescripto = 'true';
    for (const chip of cell.querySelectorAll('[data-map-id]')) {
      if (!latest?.conflicto) {
        chip.draggable = false;
        chip.querySelector('.map-grip')?.remove();
        chip.querySelectorAll('[data-rm]').forEach(node => node.remove());
      }
      chip.title = latest?.conflicto ? 'Se conserva el trabajo existente mientras se revisa PVF.' : fixedMessage();
    }
    const prescription = latest?.prescripcion;
    const text = latest?.conflicto ? 'Prescripción pendiente de revisión' :
      'Materia prescripta · Fija' + (prescription ? ' · ' + prescription.hours + ' HC' : '');
    makeNote(cell, text);
    if (guardValidation && latest?.conflicto) {
      const button = document.getElementById('validateBtn');
      if (button) {
        if (button.dataset.pvfDisabled !== 'true') {
          button.dataset.pvfPreviousDisabled = String(button.disabled);
          button.dataset.pvfPreviousTitle = button.title;
          button.dataset.pvfDisabled = 'true';
        }
        button.disabled = true;
        button.title = latest.conflicto.message;
      }
    }
    decorateConflict();
  }

  function decorateBag() {
    const bag = document.getElementById('bagContent');
    if (!bag) return;
    bag.querySelectorAll('[data-alt]').forEach(button => {
      button.onclick = event => { event.preventDefault(); setAlternative(button.dataset.alt); };
    });
    for (const item of bag.querySelectorAll('[data-sub]')) {
      if (item.dataset.sub !== latest?.prescripcion?.subjectId) continue;
      // Ya está asignada por prescripción; no se ofrece como materia disponible.
      item.remove();
    }
  }

  function decoratePhase2() {
    const group = document.querySelector('#v28groups [data-g="' + SLOT + '"]');
    const host = group?.querySelector('.v28-subjects');
    if (!host) return;
    const text = latest?.conflicto ? 'Prescripción pendiente de revisión; se conserva el desarrollo existente.' :
      'Materia prescripta · Fija · ' + latest?.prescripcion?.hours + ' HC · Anual C9–C10';
    makeNote(host, text);
  }

  function otherDevelopedGroupsChange(map, alternative) {
    const before = new Map(subjects().map(subject => [subject.id, subject]));
    let after;
    const previous = map.alt;
    try { map.alt = alternative; after = new Map(subjects().map(subject => [subject.id, subject])); }
    finally { map.alt = previous; }
    for (const [slot, ids] of Object.entries(map.placements || {})) {
      if (slot === SLOT || !Array.isArray(ids)) continue;
      const different = ids.some(id => before.get(id)?.origin === 'FO' &&
        (!after.has(id) || before.get(id).name !== after.get(id).name));
      if (!different) continue;
      const group = map.phase2V28?.groups?.[slot];
      const custom = map.phase2V28?.customContents?.some(row => row.groupId === slot);
      if (!rules.grupoPvfConTrabajo(group) && !custom) continue;
      return { code: 'ALTERNATIVA_CON_DESARROLLO', message:
        'La alternativa ' + alternative + ' cambiaría la materia de un espacio con contenidos o planes (' +
        (group?.name || slot) + '). El trabajo y la alternativa actual se conservan.' };
    }
    return null;
  }

  function assignedTeacherConflict(map, prescription) {
    const previous = map.pvfMedia;
    if (!previous || ['subjectId', 'name', 'hours'].every(key => previous[key] === prescription[key])) return null;
    // V22 guarda nombres por subjectId. V48 guarda el docente por
    // «slug(orientación)|cursoDivisión|subjectId». Se consulta sólo el PVF previo.
    const id = previous.subjectId;
    const mapTeacher = String(map.teachers?.[id] || '').trim();
    const institutionalTeacher = Object.entries(state.institutional?.assignments || {}).some(([instanceId, teacher]) => {
      const parts = instanceId.split('|');
      return !!teacher && parts.length === 3 && parts[0] === slug(config.track) && parts[2] === id;
    });
    if (!mapTeacher && !institutionalTeacher) return null;
    return { code: 'PVF_DOCENTE_ASIGNADO', message:
      'El PVF tiene una asignación docente. Revisala antes de cambiar su materia o carga horaria; se conserva la prescripción actual.' };
  }

  function setAlternative(alternative) {
    if (!editable) return blocked('La sesión escolar está en modo consulta.');
    if (!['A', 'B'].includes(alternative) || !available()) return false;
    reconcile();
    const map = current();
    if (alternative === (map.alt || 'A')) return true;
    let prescripcion, result;
    try {
      prescripcion = resolve(alternative);
      result = rules.aplicarPvfEnMapa(map, { prescripcion });
    } catch (error) { return blocked(String(error.message || error)); }
    const conflict = result.conflicto || assignedTeacherConflict(map, prescripcion) ||
      otherDevelopedGroupsChange(map, alternative);
    if (conflict) {
      attemptedConflict = { ...copy(conflict), alternative };
      decorateConflict();
      return blocked(conflict.message);
    }
    accept(result, map);
    map.alt = prescripcion.alternative;
    map.valid = false;
    attemptedConflict = null;
    latest = { prescripcion, estado: result.estado, conflicto: null };
    const validation = document.getElementById('validation');
    if (validation) delete validation.dataset.pvfBlocked;
    save();
    renderOffer();
    return true;
  }

  const previousLoad = load;
  load = function (...args) { const out = previousLoad(...args); reconcile(); return out; };
  const previousPanel = renderPanel;
  renderPanel = function (...args) { reconcile(); return previousPanel(...args); };
  const previousOffer = renderOffer;
  renderOffer = function (...args) {
    // Devolver la decisión a V30/permisos antes de que recalculen sus bloqueos.
    releaseValidationGuard();
    reconcile();
    const out = previousOffer(...args);
    decorateMap(true); decorateBag();
    return out;
  };
  const previousMatrix = renderMatrix;
  renderMatrix = function (...args) { const out = previousMatrix(...args); decorateMap(); return out; };
  const previousBag = renderBag;
  renderBag = function (...args) { const out = previousBag(...args); decorateBag(); return out; };

  // Estas guardas quedan fuera de V23/V25/V31/V33, que amplían otros destinos.
  const previousValidTarget = validTarget;
  validTarget = function (slot, subject) {
    if (slot === SLOT || !latest?.conflicto && forbidAssignment(slot, subject?.id)) return [false, fixedMessage()];
    return previousValidTarget(slot, subject);
  };
  const previousAssign = assign;
  assign = function (slot, id) {
    if (forbidAssignment(slot, id)) return blocked(fixedMessage());
    return previousAssign(slot, id);
  };
  const previousRemove = removeOne;
  removeOne = function (slot, id) {
    if (sourceIsFixed(id, slot)) return blocked(fixedMessage());
    return previousRemove(slot, id);
  };
  const previousValidate = validateOffer;
  validateOffer = function (...args) {
    reconcile();
    if (latest?.conflicto) {
      current().valid = false;
      save();
      return blocked(latest.conflicto.message);
    }
    return previousValidate(...args);
  };

  function stop(event) { event.preventDefault(); event.stopImmediatePropagation(); }
  function sourceElement(event) {
    return event.target?.closest?.('#matrix [data-map-id],#bagContent [data-sub]');
  }
  function decode(raw) {
    try {
      if (raw.startsWith('move:')) {
        const rest = raw.slice(5), split = rest.indexOf(':');
        if (split < 0) return null;
        return { kind: 'move', from: decodeURIComponent(rest.slice(0, split)), id: decodeURIComponent(rest.slice(split + 1)) };
      }
      return { kind: 'subject', id: raw.startsWith('subject:') ? decodeURIComponent(raw.slice(8)) : raw };
    } catch { return null; }
  }
  // Captura en documento: precede los handlers privados de movimiento y los
  // de materias propias. La protección no depende de ocultar un botón/grip.
  document.addEventListener('click', event => {
    const alternative = event.target.closest?.('#bagContent [data-alt]');
    if (alternative) { stop(event); setAlternative(alternative.dataset.alt); return; }
    const remove = event.target.closest?.('#matrix [data-rm][data-slot]');
    if (editable && latest?.conflicto && remove && (remove.dataset.slot === SLOT ||
      remove.dataset.rm === latest.prescripcion?.subjectId ||
      latest.conflicto.actual?.otrosSlots?.includes(remove.dataset.slot) &&
        remove.dataset.rm === current().pvfMedia?.subjectId)) {
      // La corrección explícita precede al bloqueo de mínimos V30: quitar una
      // PVF mal ubicada deja el mapa pendiente y conserva todo su desarrollo.
      stop(event); removeOne(remove.dataset.slot, remove.dataset.rm); return;
    }
    if (remove && sourceIsFixed(remove.dataset.rm, remove.dataset.slot)) {
      stop(event); blocked(fixedMessage());
    }
  }, true);
  for (const type of ['dragstart', 'pointerdown']) document.addEventListener(type, event => {
    const source = sourceElement(event);
    // Los controles docentes de la tarjeta siguen utilizándose normalmente.
    if (type === 'pointerdown' && event.target.closest?.('button,input,select,textarea')) return;
    if (source && sourceIsFixed(source.dataset.mapId || source.dataset.sub, source.dataset.from)) {
      stop(event);
      if (type === 'dragstart') blocked(fixedMessage());
    }
  }, true);
  document.addEventListener('drop', event => {
    const target = event.target.closest?.('#matrix [data-slot]');
    if (!target) return;
    const payload = decode(event.dataTransfer?.getData('text/plain') || '');
    if (target.dataset.slot === SLOT || payload && (sourceIsFixed(payload.id, payload.from) ||
      payload.kind === 'subject' && forbidAssignment(target.dataset.slot, payload.id))) {
      stop(event); target.classList.remove('ready'); blocked(fixedMessage());
    }
  }, true);
  document.addEventListener('pointerup', event => {
    if (!['touch', 'pen'].includes(event.pointerType)) return;
    if (event.target.closest?.('button,input,select,textarea')) return;
    const source = sourceElement(event);
    if (!source) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('#matrix [data-slot]');
    if (target?.dataset.slot !== SLOT && !sourceIsFixed(source.dataset.mapId || source.dataset.sub, source.dataset.from)) return;
    // Permitir que la cancelación quite el fantasma y sus listeners, sin drop.
    stop(event);
    event.target.dispatchEvent(new PointerEvent('pointercancel', {
      bubbles: true, pointerId: event.pointerId, pointerType: event.pointerType
    }));
    blocked(fixedMessage());
  }, true);

  const style = document.createElement('style');
  style.textContent = '.pci-pvf-fixed{display:block;flex-basis:100%;margin-top:5px;font-size:.65rem;line-height:1.35;color:var(--muted);font-weight:700}' +
    '#pciPvfConflict{margin:12px 0}#pciPvfConflict .row{margin-top:10px}' +
    '#pciPvfConflict button{white-space:normal;text-align:left}#matrix [data-pvf-prescripto] .placed[draggable="false"]{cursor:default}';
  document.head.appendChild(style);
  window.addEventListener('pci-phase2-groups-rendered', decoratePhase2);
  window.addEventListener('pci-app-ready', () => { reconcile(); decorateMap(); decorateBag(); decoratePhase2(); });
  window.PCIPVFMedia = Object.freeze({ status, reconcile, setAlternative });
})();
