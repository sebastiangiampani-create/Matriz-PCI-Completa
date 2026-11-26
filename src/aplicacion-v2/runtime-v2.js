/** Adaptador clásico: comparte el entorno global del motor; no consulta servicios. */
(() => {
  'use strict';
  const config = window.__PCI_APLICACION_CONFIG;
  if (!config || window.PCIAplicacionV2) throw Error('La aplicación V2 no puede iniciarse dos veces.');
  const copy = value => JSON.parse(JSON.stringify(value));
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const track = config.track;
  const editable = config.contexto.permissions.puedeEditar === true;
  const protectedMaps = new WeakSet();
  let hydrating = true, ready = false, notice = null, migrationSequence = 0;
  let reported = '', draftFailure = false, draftSequence = 0, leaving = false;
  let restoredSerial = '';
  let activeView = 'oferta';
  const baseSave = save;
  const baseScreen = screen;
  const emptyMap = () => ({ alt: 'A', mode: 'one', placements: {}, custom: [], valid: false });

  const deepFreeze = value => {
    if (object(value) || Array.isArray(value)) {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  };
  const publicContext = deepFreeze(copy(config.contexto));

  function normalized(document) {
    if (!object(document) || !object(document.maps) ||
      !object(document.maps[track]) || document.active && document.active !== track)
      throw Error('El estado no pertenece a la orientación de este PCI.');
    const next = copy(document);
    next.school = publicContext.school.name;
    next.active = track;
    next.selected = [track];
    return next;
  }

  function preserveMaps() {
    for (const map of Object.values(state.maps || {}))
      if (object(map)) protectedMaps.add(map);
  }

  function restoreInitial() {
    const provided = config.estadoInicial;
    state = provided ? normalized(provided) : {
      school: publicContext.school.name, selected: [track], active: track,
      maps: { [track]: emptyMap() }
    };
    // Referencia del estado recibido, antes del prearmado y de la prescripción
    // PVF. Un estado nuevo en memoria todavía no es un borrador conservado.
    if (config.modelo === 'media' && editable) restoredSerial = JSON.stringify(state);
    // Con histórico, el mapa vacío es una decisión explícita hasta la aceptación.
    if (provided || config.fuenteLegado) preserveMaps();
  }

  window.__pciPreserveImportedMap = map => protectedMaps.has(map);
  // La copia recibida del controlador es autoritativa; no se mezcla otra clave.
  load = restoreInitial;
  restoreInitial();

  function identity() {
    state.school = publicContext.school.name;
    state.active = track;
    state.selected = [track];
    const input = document.getElementById('schoolName');
    if (input) { input.value = state.school; input.readOnly = true; }
  }

  function snapshot() {
    identity();
    window.PCIPVFMedia?.reconcile();
    return copy(state);
  }

  function status(message, failed = false) {
    const target = document.getElementById('pciV2DraftStatus');
    if (!target) return;
    target.textContent = message;
    target.dataset.error = failed ? 'true' : 'false';
    const retry=document.getElementById('pciV2RetrySave');
    if(retry)retry.hidden=!failed;
  }

  function reportDraft(document, force = false) {
    const serial = JSON.stringify(document);
    if (!force && serial === reported) return Promise.resolve(!draftFailure);
    const seq = ++draftSequence;
    status(publicContext.remotoDisponible ? 'Guardando borrador en Supabase…' : 'Conservando borrador local…');
    let result;
    try { result = config.alGuardarBorrador(copy(document)); }
    catch (error) { result = Promise.reject(error); }
    return Promise.resolve(result).then(() => {
      if (seq !== draftSequence) return !draftFailure;
      reported = serial;
      draftFailure = false;
      status(publicContext.remotoDisponible ? 'Guardado en Supabase · versión confirmada' : 'Borrador guardado en este navegador');
      window.dispatchEvent(new CustomEvent('pci-borrador-local', { detail: {
        pciId: publicContext.pci.pci_id, guardado: true
      } }));
      return true;
    }, error => {
      if (seq !== draftSequence) return false;
      draftFailure = true;
      status((publicContext.remotoDisponible ? 'Borrador local conservado; guardado remoto falló: ' : 'No se pudo conservar el borrador: ') + String(error.message || error), true);
      window.dispatchEvent(new CustomEvent('pci-borrador-local', { detail: {
        pciId: publicContext.pci.pci_id, guardado: false
      } }));
      return false;
    });
  }

  save = function (...args) {
    identity();
    if (!editable && !hydrating) return Promise.resolve(true);
    let saved = true;
    try { baseSave(...args); }
    catch (error) {
      saved = false;
      draftFailure = true;
      status('No se pudo conservar el borrador en este navegador.', true);
    }
    if (!hydrating && editable) return reportDraft(snapshot(), !saved);
    return Promise.resolve(saved);
  };

  function writeView(view, replace = false) {
    if (!['oferta', 'desarrollo', 'gestion', 'panel'].includes(view)) return;
    activeView = view;
    updateBackControl();
    if (!ready) return;
    const url = new URL(location.href);
    url.searchParams.set('school', String(publicContext.school.id));
    url.searchParams.set('pci', publicContext.pci.pci_id);
    url.searchParams.set('view', view);
    if (url.href === location.href) return;
    history[replace ? 'replaceState' : 'pushState']({ pciV2: true, view }, '', url.href);
  }

  async function returnToSchool() {
    if (leaving) return;
    leaving = true;
    const conserved = editable ? await save() : true;
    if (!conserved || draftFailure) {
      leaving = false;
      status('No se confirmó el guardado remoto. El borrador local se mantiene cuando el navegador lo permite. Reintentá antes de salir.', true);
      return false;
    }
    location.assign(config.volver);
    return true;
  }

  // «Volver» recorre PCI > organización; nunca abandona el mapa de golpe.
  function backTarget() {
    if (activeView === 'panel') return config.volver;
    const url = new URL(location.href);
    url.searchParams.set('school', String(publicContext.school.id));
    url.searchParams.set('pci', publicContext.pci.pci_id);
    url.searchParams.set('view', 'panel');
    return url.href;
  }
  function updateBackControl() {
    const back = document.getElementById('pciV2BackSchool');
    if (!back) return;
    back.href = backTarget();
    back.textContent = activeView === 'panel'
      ? '← Volver a la organización curricular'
      : '← Volver al panel de este PCI';
  }
  function goBack() {
    return activeView === 'panel' ? returnToSchool() : navigate('panel');
  }

  // Todas las capas posteriores continúan llamando a esta base de navegación.
  screen = function (id) {
    if (id === 'home' && ready) return goBack();
    const out = baseScreen(id);
    const view = { offer: 'oferta', proposal: 'desarrollo', institutional: 'gestion', panel: 'panel' }[id];
    if (view) writeView(view);
    return out;
  };

  function navigate(view, { replace = false } = {}) {
    if (['home', 'inicio'].includes(view)) return goBack();
    if (view === 'escuela') return returnToSchool();
    const id = { oferta: 'offer', desarrollo: 'proposal', fg: 'proposal', fo: 'proposal', gestion: 'institutional', panel: 'panel',
      offer: 'offer', proposal: 'proposal', institutional: 'institutional' }[view];
    if (!id) throw Error('La pantalla solicitada no existe en el PCI.');
    if (id === 'institutional' && !editable) {
      status('La sesión escolar está en modo consulta.');
      return false;
    }
    const targetView = { offer: 'oferta', proposal: 'desarrollo', institutional: 'gestion', panel: 'panel' }[id];
    if (replace) writeView(targetView, true);
    window.screen(id);
    return true;
  }

  function applyState(next, { invalidate = true } = {}) {
    if (!editable) throw Error('La sesión de esta escuela no permite editar el PCI.');
    const normalizedState = normalized(next);
    if (invalidate) { migrationSequence++; notice?.invalidar(); }
    hydrating = true;
    try {
      state = normalizedState;
      preserveMaps();
      identity();
      window.PCIPVFMedia?.reconcile();
      renderHome();
      window.screen({ oferta: 'offer', desarrollo: 'proposal', gestion: 'institutional', panel: 'panel' }[activeView] || 'offer');
    } finally { hydrating = false; }
    save();
    return snapshot();
  }

  async function prepareMigration(input = {}) {
    if (!editable || !notice) return null;
    const source = input.fuenteLegado || input.legacyState || config.fuenteLegado;
    const rows = input.matrixRows || config.matrixRows;
    if (!source) return null;
    const seq = ++migrationSequence;
    try {
      await window.PCIPhase2V28.loadCurriculum();
      if (seq !== migrationSequence || state.active !== track) return null;
      const subjects = config.modelo === 'media'
        ? config.migracion.materiasMotorMedia(DATA) : window.__V2_MODAL.subjects;
      const proposal = config.migracion.migrarLegadoFgAV2({
        legacyState: source, matrixRows: rows,
        approvedMappings: input.approvedMappings || {},
        v2FgRows: window.PCIPhase2V28.getFGCatalog(),
        model: { model: config.modelo, subjects }, orientationId: track
      });
      notice.preparar(proposal);
      return copy(proposal);
    } catch (error) {
      if (seq === migrationSequence) notice.error(String(error.message || error));
      return null;
    }
  }

  function addIdentity() {
    const header = document.querySelector('header.top');
    if (!header) throw Error('Falta el encabezado de la aplicación V2.');
    const block = document.createElement('div');
    block.id = 'pciV2Identity';
    const school = document.createElement('strong');
    school.textContent = publicContext.school.name;
    const pci = document.createElement('span');
    const shifts = { manana: 'Mañana', tarde: 'Tarde', vespertino: 'Vespertino', noche: 'Noche' };
    pci.textContent = (publicContext.pci.title || track) + ' · Turno ' +
      (shifts[publicContext.pci.shift_id] || publicContext.pci.shift_id || 'sin informar');
    const draft = document.createElement('small');
    draft.id = 'pciV2DraftStatus';
    draft.setAttribute('role', 'status');
    draft.textContent = !editable ? 'Consulta del PCI de la escuela' : publicContext.remotoDisponible ? 'Conectado · los cambios se guardan en línea' : 'Solo en este navegador · sin guardado en línea';
    block.append(school, pci, draft);
    if(editable){
      const retry=document.createElement('button');
      retry.type='button';retry.id='pciV2RetrySave';retry.className='btn soft';
      retry.textContent='Reintentar guardado';retry.hidden=true;
      retry.onclick=async()=>{retry.disabled=true;try{
        const ok=await save();
        if(ok&&!draftFailure)retry.hidden=true;
      }finally{retry.disabled=false}};
      block.append(retry);
    }
    header.querySelector('.brand')?.appendChild(block);
    const back = document.createElement('a');
    back.href = config.volver;
    back.className = 'btn soft';
    back.id = 'pciV2BackSchool';
    back.textContent = '← Volver al panel de este PCI';
    back.onclick = event => { event.preventDefault(); goBack(); };
    header.querySelector('.row')?.prepend(back);
    updateBackControl();
    const css = document.createElement('style');
    css.textContent = `
      #pciV2Identity{display:grid;gap:3px;min-width:0;color:var(--ink);font-size:.64rem;line-height:1.35}
      #pciV2Identity strong{font-size:.76rem}#pciV2Identity span{color:var(--muted)}
      #pciV2DraftStatus{font-size:.62rem;color:#126e65;line-height:1.45}
      #pciV2DraftStatus[data-error="true"]{color:var(--danger);font-weight:800}
      #pciV2RetrySave{justify-self:start;font-size:.64rem;padding:5px 10px;min-height:30px}
      #pciV2RetrySave[hidden]{display:none!important}
      /* V42 agrega .site-top con altura fija: la identidad escolar requiere
         que ambas filas participen de la altura real del encabezado. */
      header.top,header.top.site-top{height:auto;min-height:68px;gap:16px;padding-block:10px}
      header.top.site-top .brand{min-width:0;gap:14px;flex:1 1 380px}header.top.site-top .row{flex-wrap:wrap}
      #pciV2BackSchool{text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
      #pciV2ContextNotice{font-size:.68rem;line-height:1.5;overflow-wrap:anywhere}
      /* El título sigue al aviso o al regreso: no debe compensar hacia arriba
         el padding de la página ni cubrir esos elementos anteriores. */
      .screen>.hero,#proposal .v28-hero{margin-top:0}
      #institutional .v71m-add,#institutional .v71m-teachers,#institutional .v71o-course-label,
      #institutional .v71o-subject-row,#institutional .v95-coord-form,
      #institutional .v110-coord-editor-grid,#institutional .v71m-teacher-main{min-width:0}
      #institutional input,#institutional select,#institutional textarea{min-width:0;max-width:100%;box-sizing:border-box}
      #institutional .v71o-course-label select{width:100%}
      /* Los contenidos técnicos pueden conservar renglones extensos del PDF.
         El texto debe partirse dentro de su columna, sin agrandar el diálogo. */
      #v38modal .v38-form,#v38modal .v38-stage-body,#v38modal .v38-pick-group{grid-template-columns:minmax(0,1fr)}
      #v38modal .v38-form>*,#v38modal .v38-stage-body>*,#v38modal .v38-pick>span{min-width:0}
      #v38modal .v38-pick{grid-template-columns:auto minmax(0,1fr)}
      #v38modal .v38-pick p,#v38modal .v38-pick small,#v38modal .v38-top-actions>div{overflow-wrap:anywhere}
      #v38modal .v38-field input,#v38modal .v38-field textarea{min-width:0;max-width:100%}
      .screen>.back,#v2MigrationNotice button,#v2MigrationNotice summary{scroll-margin-top:calc(var(--pci-v2-header-height,68px) + 80px)!important}
      /* En escritorio, la navegación conserva su espacio y no flota encima
         de los títulos cuando Gestión desplaza la página hasta un módulo. */
      @media(min-width:761px){#pciGlobalDock{position:static;top:auto}}
      @media(max-width:780px){#institutional .v71m-add,#institutional .v71m-teachers,
        #institutional .v71o-subject-row,#institutional .v95-coord-forms,#institutional .v95-coord-form,
        #institutional .v95-coord-list,#institutional .v110-coord-editor-grid{grid-template-columns:minmax(0,1fr)}
        #institutional .v71m-teacher{min-width:0;overflow-wrap:anywhere}
        #institutional .v71m-hours{grid-template-columns:repeat(2,minmax(0,1fr))}
        #institutional .v71o-course-label{max-width:100%}}
      @media(max-width:760px){header.top.site-top{align-items:flex-start;flex-wrap:wrap}header.top.site-top .brand{flex-wrap:wrap;gap:8px;flex-basis:100%}
        header.top.site-top .row{justify-content:flex-start;width:100%}
        #pciV2Identity{width:100%}#pciV2Identity span{max-width:calc(100vw - 40px)}
        #pciV2BackSchool{font-size:.62rem;padding:8px 10px}}
    `;
    document.head.appendChild(css);
    const measure = () => {
      const height = Math.ceil(header.getBoundingClientRect().height) + 'px';
      if (document.documentElement.style.getPropertyValue('--pci-v2-header-height') !== height)
        document.documentElement.style.setProperty('--pci-v2-header-height', height);
    };
    if (typeof ResizeObserver === 'function') new ResizeObserver(measure).observe(header);
    measure();
    const explanation = [publicContext.avisoPersistencia, publicContext.avisoHistorico].filter(Boolean);
    if (explanation.length) {
      const panel = document.createElement('div');
      panel.id = 'pciV2ContextNotice';
      panel.className = 'card panel';
      for (const text of explanation) {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        panel.appendChild(paragraph);
      }
      document.querySelector('main.wrap')?.prepend(panel);
    }
  }

  window.PCIAplicacionV2 = Object.freeze({ snapshot, applyDraft: next => applyState(next),
    navigate, prepareMigration, contexto: publicContext });

  // «admin» es el permiso interno de edición V2; lo determina exclusivamente
  // puedeEditar de la sesión escolar verificada, nunca una selección de perfil.
  window.PCI_ACCESS_SESSION = editable ? { role: 'admin' } : {
    role: 'coordinator', teacherId: '', coordinatorOrientation: track, coordinatorAreas: []
  };

  window.__PCI_INICIAR_APLICACION = async () => {
    await window.__pciBaseInit();
    identity();
    addIdentity();
    window.PCIAppAccessV80?.setSession(window.PCI_ACCESS_SESSION);
    const host = document.createElement('section');
    document.querySelector('#offer > .hero').after(host);
    notice = config.migracion.montarAvisoAceptacionV2({
      host, getState: snapshot, canEdit: () => editable,
      applyState: next => applyState(next, { invalidate: false }),
      onEvent: detail => {
        if (detail.estado === 'cancelada' || detail.estado === 'aceptada') migrationSequence++;
        window.dispatchEvent(new CustomEvent('pci-migracion-local', { detail: copy(detail) }));
      }
    });
    window.dispatchEvent(new Event('pci-app-ready'));
    // Abrir ya dentro del motor antes de permitir que «Inicio» vuelva a escuela.
    const initial = ['oferta', 'desarrollo', 'fg', 'fo', 'gestion', 'panel'].includes(config.vista) ? config.vista : 'oferta';
    if (navigate(initial) === false) navigate('oferta');
    ready = true;
    hydrating = false;
    const initialSnapshot = snapshot();
    const initialSerial = JSON.stringify(initialSnapshot);
    // Abrir un PCI no escribe: la normalización inicial de Media se conserva
    // en memoria y viaja con el primer cambio real de la persona usuaria.
    reported = config.modelo === 'media' && editable ? restoredSerial : initialSerial;
    void initialSerial;
    writeView(activeView, true);
    if (config.fuenteLegado) await prepareMigration();
    window.addEventListener('popstate', () => {
      const query = new URL(location.href).searchParams;
      if (query.get('pci') !== publicContext.pci.pci_id) return;
      navigate(query.get('view') || 'oferta', { replace: true });
    });
    window.addEventListener('beforeunload', event => {
      if (draftFailure && editable) { event.preventDefault(); event.returnValue = ''; }
    });
    document.title = publicContext.school.name + ' · ' + (publicContext.pci.title || track) + ' · PCI';
    document.body.dataset.pciV2Ready = 'true';
    return window.PCIAplicacionV2;
  };
})();
