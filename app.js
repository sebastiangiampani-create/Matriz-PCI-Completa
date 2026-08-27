import {
  AREA_CONFIG,
  AREA_ORDER,
  LEVELS,
  OTHER_FORMAT_TYPES,
  TERM_LABELS,
  addOtherFormat,
  allGroups,
  deleteOtherFormat,
  findGroup,
  levelForTerm,
  locationsForContent,
  migrateState,
  moveContents,
  moveGroupToTerm,
  removeContent,
  setOtherDuration,
  sourceAreaFor,
  validateStructure,
} from './pci-model.js';

const DATA_FILES = [
  'data/db1.txt',
  'data/db2.txt',
  'data/db3.txt',
  'data/db4.txt',
  'data/rest1.txt',
  'data/rest2.txt',
  'data/rest3.txt',
  'data/rest4.txt',
  'data/rest5.txt',
];

const AREA_COLORS = {
  'Lengua y Literatura': '#ef9f8f',
  Matemática: '#8ec5ef',
  'Lenguas Adicionales': '#b6a2df',
  'Ciencias Sociales': '#f3c969',
  'Ciencias Naturales': '#7fd0a4',
  Artes: '#e9a9d1',
  Tecnologías: '#83ded3',
  'Educación Física': '#f0a672',
  'Otros formatos pedagógicos': '#b6d37c',
};

const AREA_DESCRIPTIONS = {
  trunk: 'Cinco niveles anuales. Cada nivel ocupa dos cuatrimestres consecutivos y no puede cruzar de año.',
  laboratory: 'Editá cada laboratorio y mové contenidos desde la bolsa. La ubicación temporal se controla sobre C1–C10.',
  workshop: 'Definí la práctica, producto o eje de cada taller y ubicá sus contenidos en C1–C10.',
  other: 'Creá seminarios, proyectos o ateneos con contenidos de Tecnologías. Pueden ser cuatrimestrales o anuales.',
};

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);

let DATA = [];
let app = migrateState(readStoredState());
let currentArea = app.current && AREA_CONFIG[app.current] ? app.current : null;
let selectedGroupId = null;
let selectedContentIds = new Set();
let selectedMatrixGroupId = null;
let draggedMatrixGroupId = null;
let matrixJustDragged = false;
let toastTimer = null;

function readStoredState() {
  try {
    return JSON.parse(localStorage.getItem('pciAppV2') || '{}');
  } catch {
    return {};
  }
}

async function loadCurriculum() {
  const parts = await Promise.all(
    DATA_FILES.map(async (path) => {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`No se pudo cargar ${path}.`);
      return response.text();
    }),
  );
  if (!('DecompressionStream' in window)) {
    throw new Error('Este navegador necesita una versión más reciente para abrir la base curricular.');
  }
  const compressed = Uint8Array.from(atob(parts.join('')), (character) => character.charCodeAt(0));
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const decoded = await new Response(stream).text();
  return JSON.parse(decoded).map(([id, area, subject, axis, text]) => ({
    id: String(id),
    area,
    subject,
    axis,
    text,
  }));
}

function persist({ announce = false } = {}) {
  app.schemaVersion = 10;
  localStorage.setItem('pciAppV2', JSON.stringify(app));
  window.app = app;
  window.dispatchEvent(new CustomEvent('pci-state-change', { detail: { schemaVersion: 10 } }));
  if (announce) toast('Cambios guardados');
}

function toast(message) {
  const element = $('toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 1900);
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.toggle('active', screen.id === name);
  });
  if (name === 'overview') renderOverview();
  if (name === 'control') renderControl();
  if (name === 'matrix') renderMatrix();
  closeContentBag();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function sourceContents(area) {
  const source = sourceAreaFor(area);
  return DATA.filter((content) => content.area === source);
}

function groupsForSource(sourceArea) {
  return allGroups(app).filter(({ area }) => sourceAreaFor(area) === sourceArea);
}

function assignmentMap() {
  const map = new Map();
  for (const { area, group } of allGroups(app)) {
    for (const contentId of group.items) {
      const locations = map.get(String(contentId)) ?? [];
      locations.push({ area, groupId: group.id, groupName: group.name });
      map.set(String(contentId), locations);
    }
  }
  return map;
}

function coverageFor(area) {
  const contents = sourceContents(area);
  const ids = new Set(contents.map((content) => content.id));
  const assigned = new Set(
    groupsForSource(sourceAreaFor(area)).flatMap(({ group }) => group.items.filter((id) => ids.has(id))),
  );
  return { assigned: assigned.size, total: contents.length };
}

function renderOverview() {
  $('schoolName').value = app.schoolName;
  $('headerSchoolName').textContent = app.schoolName;
  $('overviewTitle').textContent = app.schoolName;
  document.querySelectorAll('#backOverview, .text-button[data-screen-link="overview"]').forEach((btn) => {
    btn.textContent = `← ${app.schoolName}`;
  });

  const errors = validateStructure(app);
  const status = $('structureStatus');
  status.className = `notice ${errors.length ? 'warning' : 'success'}`;
  status.innerHTML = errors.length
    ? `<strong>La estructura todavía necesita revisión.</strong><br>${errors.map(escapeHtml).join('<br>')}`
    : '<strong>Estructura base verificada:</strong> cinco niveles C1–C10, 10 laboratorios de Naturales y 12 de Sociales con simultaneidad en C6 y C7.';

  $('areaGrid').innerHTML = AREA_ORDER.map((area) => {
    const config = AREA_CONFIG[area];
    const groups = app.areas[area].groups;
    const coverage = coverageFor(area);
    const percent = coverage.total ? Math.round((coverage.assigned / coverage.total) * 100) : 0;
    const groupLabel = config.kind === 'trunk'
      ? `${groups.length} niveles anuales`
      : config.kind === 'laboratory'
        ? `${groups.length} laboratorios`
        : config.kind === 'workshop'
          ? `${groups.length} talleres`
          : `${groups.length} formato${groups.length === 1 ? '' : 's'} creado${groups.length === 1 ? '' : 's'}`;
    return `
      <button class="area-card" type="button" data-area="${escapeHtml(area)}" style="--area-color:${AREA_COLORS[area]}">
        <div>
          <span class="pill">${escapeHtml(groupLabel)}</span>
          <h3>${escapeHtml(area)}</h3>
          <p>${escapeHtml(AREA_DESCRIPTIONS[config.kind])}</p>
        </div>
        <footer>
          <div>
            <strong>${coverage.assigned} / ${coverage.total} contenidos ubicados</strong>
            <div class="mini-progress"><span style="width:${percent}%"></span></div>
          </div>
          <strong aria-hidden="true">→</strong>
        </footer>
      </button>`;
  }).join('');

  document.querySelectorAll('[data-area]').forEach((button) => {
    button.addEventListener('click', () => openArea(button.dataset.area));
  });
}

function openArea(area, groupId = null) {
  if (!AREA_CONFIG[area]) return;
  currentArea = area;
  app.current = area;
  const groups = app.areas[area].groups;
  selectedGroupId = groupId && groups.some((group) => group.id === groupId)
    ? groupId
    : groups[0]?.id ?? null;
  selectedContentIds.clear();
  resetBagFilters();
  persist();
  renderBoard();
  showScreen('board');
}

function resetBagFilters() {
  $('contentSearch').value = '';
  $('subjectFilter').value = '';
  $('axisFilter').value = '';
  $('pendingFilter').checked = false;
}

function temporalLabel(group) {
  if (!group.startTerm) return 'Sin ubicación';
  if (group.startTerm === group.endTerm) return `C${group.startTerm}`;
  return `C${group.startTerm}–C${group.endTerm}`;
}

function renderBoard() {
  if (!currentArea) return;
  const config = AREA_CONFIG[currentArea];
  const groups = app.areas[currentArea].groups;
  if (selectedGroupId && !groups.some((group) => group.id === selectedGroupId)) {
    selectedGroupId = groups[0]?.id ?? null;
  }
  $('boardTitle').textContent = currentArea;
  $('boardDescription').textContent = AREA_DESCRIPTIONS[config.kind];
  $('addOther').hidden = config.kind !== 'other';
  populateBagFilters();
  renderCoverage();
  renderGroups();
  renderContents();
  renderBoardWarning();
}

function renderBoardWarning() {
  const errors = validateStructure(app).filter((error) => error.startsWith(currentArea));
  const alert = $('boardAlert');
  alert.hidden = !errors.length;
  alert.innerHTML = errors.length ? `<strong>Revisá la ubicación temporal:</strong> ${errors.map(escapeHtml).join(' ')}` : '';
}

function populateBagFilters() {
  const rows = sourceContents(currentArea);
  const currentSubject = $('subjectFilter').value;
  const currentAxis = $('axisFilter').value;
  const subjects = [...new Set(rows.map((row) => row.subject))].sort((a, b) => a.localeCompare(b, 'es'));
  const axes = [...new Set(rows.map((row) => row.axis).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  $('subjectFilter').innerHTML = '<option value="">Todas</option>' + subjects.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
  $('axisFilter').innerHTML = '<option value="">Todos</option>' + axes.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
  if (subjects.includes(currentSubject)) $('subjectFilter').value = currentSubject;
  if (axes.includes(currentAxis)) $('axisFilter').value = currentAxis;
}

function renderCoverage() {
  const coverage = coverageFor(currentArea);
  const percent = coverage.total ? Math.round((coverage.assigned / coverage.total) * 100) : 0;
  $('coverageLabel').textContent = `${coverage.assigned} de ${coverage.total} contenidos ubicados`;
  $('coverageBar').style.width = `${percent}%`;
  $('coverageHint').textContent = currentArea === 'Otros formatos pedagógicos'
    ? 'Comparte la bolsa de Tecnologías: mover un contenido lo reasigna sin duplicarlo.'
    : 'Mover un contenido lo reasigna: nunca se duplica ni se elimina de la base.';
}

function kindLabel(kind) {
  return ({ trunk: 'Troncal anual', laboratory: 'Laboratorio', workshop: 'Taller', other: 'Otro formato' })[kind] ?? kind;
}

function termOptions(selected) {
  return TERM_LABELS.map((label, index) => `<option value="${index + 1}" ${Number(selected) === index + 1 ? 'selected' : ''}>${label}</option>`).join('');
}

function levelOptions(selected) {
  return LEVELS.map((level) => `<option value="${level.number}" ${Number(selected) === level.number ? 'selected' : ''}>Nivel ${level.number} · C${level.startTerm}–C${level.endTerm}</option>`).join('');
}

function typeOptions(selected) {
  return ['Obligatorio', 'Electivo'].map((type) => `<option ${selected === type ? 'selected' : ''}>${type}</option>`).join('');
}

function groupFields(group) {
  const common = `
    <label class="field-label full">
      <span>Objetivos de aprendizaje</span>
      <textarea data-field="objective" placeholder="¿Qué aprendizajes se espera alcanzar?">${escapeHtml(group.objective)}</textarea>
    </label>`;
  const synopsis = `
    <label class="field-label full">
      <span>Sinopsis (opcional)</span>
      <textarea data-field="synopsis" placeholder="Describí brevemente qué va a suceder en este espacio">${escapeHtml(group.synopsis)}</textarea>
    </label>`;

  if (group.kind === 'trunk') return common + synopsis;
  if (group.kind === 'laboratory') {
    return `
      <label class="field-label"><span>Carácter del agrupamiento</span><select data-field="type">${typeOptions(group.type)}</select></label>
      <label class="field-label"><span>Ubicación temporal</span><select data-field="term">${termOptions(group.startTerm)}</select></label>
      <label class="field-label full"><span>Contexto problematizador</span><textarea data-field="context" placeholder="¿Qué problema organiza el laboratorio?">${escapeHtml(group.context)}</textarea></label>
      ${common}${synopsis}`;
  }
  if (group.kind === 'workshop') {
    return `
      <label class="field-label"><span>Carácter del agrupamiento</span><select data-field="type">${typeOptions(group.type)}</select></label>
      <label class="field-label"><span>Ubicación temporal</span><select data-field="term">${termOptions(group.startTerm)}</select></label>
      <label class="field-label full"><span>Práctica / producto / eje</span><textarea data-field="practiceAxis" placeholder="Definí la práctica, el producto o el eje del taller">${escapeHtml(group.practiceAxis)}</textarea></label>
      ${common}${synopsis}`;
  }

  const placement = group.duration === 'annual'
    ? `<label class="field-label"><span>Nivel anual</span><select data-field="placement">${levelOptions(group.level)}</select></label>`
    : `<label class="field-label"><span>Cuatrimestre</span><select data-field="placement">${termOptions(group.startTerm)}</select></label>`;
  return `
    <label class="field-label"><span>Formato pedagógico</span><select data-field="formatType">${OTHER_FORMAT_TYPES.map((type) => `<option ${group.formatType === type ? 'selected' : ''}>${type}</option>`).join('')}</select></label>
    <label class="field-label"><span>Carácter del agrupamiento</span><select data-field="type">${typeOptions(group.type)}</select></label>
    <label class="field-label"><span>Duración</span><select data-field="duration"><option value="quarterly" ${group.duration === 'quarterly' ? 'selected' : ''}>Cuatrimestral</option><option value="annual" ${group.duration === 'annual' ? 'selected' : ''}>Anual</option></select></label>
    ${placement}
    ${common}${synopsis}`;
}

function assignedItems(group) {
  if (!group.items.length) return '<div class="empty-state">Todavía no hay contenidos asignados.</div>';
  return group.items.map((id) => {
    const content = DATA.find((item) => item.id === id);
    if (!content) return '';
    return `
      <article class="assigned-item" draggable="true" data-content-id="${escapeHtml(id)}">
        <div><small>${escapeHtml(content.subject)} · ${escapeHtml(content.axis || 'Sin eje / bloque')}</small><p>${escapeHtml(content.text)}</p></div>
        <button class="remove-content" type="button" data-remove-content="${escapeHtml(id)}" aria-label="Quitar contenido">×</button>
      </article>`;
  }).join('');
}

function renderGroups() {
  const groups = app.areas[currentArea].groups;
  if (!groups.length) {
    $('groups').innerHTML = `
      <div class="card empty-state">
        <h2>Todavía no hay otros formatos</h2>
        <p>Creá un seminario, proyecto o ateneo y después mové contenidos de Tecnologías.</p>
        <button class="button accent" type="button" data-empty-add>＋ Crear el primero</button>
      </div>`;
    document.querySelector('[data-empty-add]')?.addEventListener('click', createOtherFormat);
    renderMobileGroupNav();
    updateSelectionBar();
    return;
  }

  $('groups').innerHTML = groups.map((group) => `
    <article class="group-card card ${group.id === selectedGroupId ? 'selected' : ''}" data-group-id="${escapeHtml(group.id)}">
      <div class="group-title-row">
        <input data-field="name" maxlength="140" value="${escapeHtml(group.name)}" aria-label="Nombre del espacio">
      </div>
      <div class="group-meta">
        <span class="pill">${escapeHtml(kindLabel(group.kind))}</span>
        <span class="pill">${escapeHtml(temporalLabel(group))}</span>
        <span class="pill ${group.type === 'Electivo' ? 'elective' : ''}">${escapeHtml(group.type)}</span>
        ${group.kind === 'other' ? `<span class="pill">${escapeHtml(group.formatType)}</span>` : ''}
      </div>
      <div class="form-grid">${groupFields(group)}</div>
      <div class="assigned-heading"><h3>Contenidos asignados</h3><span class="pill">${group.items.length}</span></div>
      <div class="assigned-list">${assignedItems(group)}</div>
      ${group.kind === 'other' ? '<div class="group-footer"><button class="button danger" type="button" data-delete-other>Eliminar formato</button></div>' : ''}
    </article>`).join('');

  bindGroupEvents();
  renderMobileGroupNav();
  updateSelectionBar();
}

function selectGroup(groupId) {
  if (!findGroup(app, groupId)) return;
  selectedGroupId = groupId;
  document.querySelectorAll('.group-card').forEach((card) => card.classList.toggle('selected', card.dataset.groupId === groupId));
  renderMobileGroupNav();
  updateSelectionBar();
}

function bindGroupEvents() {
  document.querySelectorAll('.group-card').forEach((card) => {
    const groupId = card.dataset.groupId;
    card.addEventListener('pointerdown', () => selectGroup(groupId));
    card.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      card.classList.add('drop-target');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
    card.addEventListener('drop', (event) => {
      event.preventDefault();
      card.classList.remove('drop-target');
      const id = readDraggedContent(event);
      if (id) assignContents(groupId, [id]);
    });

    card.querySelectorAll('[data-field]').forEach((field) => {
      const eventName = field.tagName === 'TEXTAREA' || field.tagName === 'INPUT' ? 'input' : 'change';
      field.addEventListener(eventName, () => updateGroupField(groupId, field.dataset.field, field.value));
    });
    card.querySelectorAll('[data-remove-content]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        removeContent(app, groupId, button.dataset.removeContent);
        persist();
        renderBoard();
        toast('Contenido devuelto a la bolsa');
      });
    });
    card.querySelector('[data-delete-other]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      removeOtherFormat(groupId);
    });
  });

  document.querySelectorAll('.assigned-item').forEach((item) => {
    item.addEventListener('dragstart', (event) => writeDraggedContent(event, item.dataset.contentId));
  });
}

function updateGroupField(groupId, field, value) {
  const found = findGroup(app, groupId);
  if (!found) return;
  const group = found.group;
  if (field === 'term') {
    const term = Number(value);
    Object.assign(group, { startTerm: term, endTerm: term, level: levelForTerm(term) });
    persist();
    renderBoard();
    return;
  }
  if (field === 'duration') {
    const placement = value === 'annual' ? group.level || levelForTerm(group.startTerm) || 1 : group.startTerm || 1;
    setOtherDuration(group, value, placement);
    persist();
    renderBoard();
    return;
  }
  if (field === 'placement') {
    setOtherDuration(group, group.duration, Number(value));
    persist();
    renderBoard();
    return;
  }
  group[field] = value;
  if (field === 'type') group.elective = value === 'Electivo';
  persist();
  if (field === 'name') {
    renderMobileGroupNav();
    updateSelectionBar();
  }
}

function createOtherFormat() {
  const group = addOtherFormat(app);
  selectedGroupId = group.id;
  persist();
  renderBoard();
  requestAnimationFrame(() => document.querySelector(`[data-group-id="${CSS.escape(group.id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  toast('Nuevo formato pedagógico creado');
}

function removeOtherFormat(groupId) {
  const found = findGroup(app, groupId);
  if (!found || found.group.kind !== 'other') return;
  if (!confirm(`¿Eliminar “${found.group.name}”? Sus contenidos volverán a quedar pendientes.`)) return;
  deleteOtherFormat(app, groupId);
  selectedGroupId = app.areas[currentArea].groups[0]?.id ?? null;
  persist();
  renderBoard();
  toast('Formato eliminado; sus contenidos siguen disponibles');
}

function renderMobileGroupNav() {
  const groups = app.areas[currentArea].groups;
  const index = groups.findIndex((group) => group.id === selectedGroupId);
  const current = groups[index];
  $('mobileGroupNav').innerHTML = current
    ? `<button type="button" data-mobile-step="-1" aria-label="Espacio anterior">‹</button><span>${escapeHtml(current.name)} · ${index + 1} de ${groups.length}</span><button type="button" data-mobile-step="1" aria-label="Espacio siguiente">›</button>`
    : '<span></span><span>Creá un espacio para comenzar</span><span></span>';
  document.querySelectorAll('[data-mobile-step]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextIndex = (index + Number(button.dataset.mobileStep) + groups.length) % groups.length;
      selectedGroupId = groups[nextIndex].id;
      renderGroups();
      window.scrollTo({ top: $('mobileGroupNav').offsetTop - 90, behavior: 'smooth' });
    });
  });
}

function renderContents() {
  const query = $('contentSearch').value.trim().toLocaleLowerCase('es');
  const subject = $('subjectFilter').value;
  const axis = $('axisFilter').value;
  const pendingOnly = $('pendingFilter').checked;
  const source = sourceContents(currentArea);
  const assignments = assignmentMap();
  const visible = source.filter((content) => {
    const location = assignments.get(content.id) ?? [];
    const haystack = `${content.subject} ${content.axis} ${content.text}`.toLocaleLowerCase('es');
    return (!query || haystack.includes(query))
      && (!subject || content.subject === subject)
      && (!axis || content.axis === axis)
      && (!pendingOnly || !location.length);
  });
  const pending = source.filter((content) => !(assignments.get(content.id)?.length)).length;
  $('bagMeta').textContent = `${visible.length} visibles · ${pending} pendientes`;
  $('contentList').innerHTML = visible.length
    ? visible.map((content) => {
        const locations = assignments.get(content.id) ?? [];
        const selected = selectedContentIds.has(content.id);
        return `
          <article class="content-item ${selected ? 'selected' : ''} ${locations.length ? 'assigned' : ''}" draggable="true" data-content-id="${escapeHtml(content.id)}">
            <input type="checkbox" tabindex="-1" ${selected ? 'checked' : ''} aria-hidden="true">
            <div>
              <small>${escapeHtml(content.subject)} · ${escapeHtml(content.axis || 'Sin eje / bloque')}</small>
              <p>${escapeHtml(content.text)}</p>
              ${locations.length ? `<span class="content-location">En ${escapeHtml(locations.map((location) => location.groupName).join(' · '))}</span>` : '<span class="content-location pending-text">Pendiente</span>'}
            </div>
          </article>`;
      }).join('')
    : '<div class="empty-state">No hay contenidos que coincidan con estos filtros.</div>';

  document.querySelectorAll('.content-item').forEach((item) => {
    item.addEventListener('click', () => toggleContentSelection(item.dataset.contentId));
    item.addEventListener('dragstart', (event) => writeDraggedContent(event, item.dataset.contentId));
  });
  updateSelectionBar();
}

function toggleContentSelection(contentId) {
  if (selectedContentIds.has(contentId)) selectedContentIds.delete(contentId);
  else selectedContentIds.add(contentId);
  renderContents();
}

function updateSelectionBar() {
  const found = selectedGroupId ? findGroup(app, selectedGroupId) : null;
  const count = selectedContentIds.size;
  $('selectionCount').textContent = `${count} seleccionado${count === 1 ? '' : 's'}`;
  $('selectionTarget').textContent = found ? `Destino: ${found.group.name}` : 'Creá o elegí un espacio de destino';
  $('moveSelected').disabled = !count || !found;
  $('moveSelected').textContent = count ? `Mover ${count}` : 'Mover seleccionados';
}

function writeDraggedContent(event, contentId) {
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(contentId));
  event.dataTransfer.setData('application/x-pci-content', String(contentId));
}

function readDraggedContent(event) {
  return event.dataTransfer.getData('application/x-pci-content') || event.dataTransfer.getData('text/plain');
}

function assignContents(groupId, contentIds) {
  try {
    moveContents(app, groupId, contentIds);
    selectedGroupId = groupId;
    selectedContentIds.clear();
    persist();
    renderBoard();
    closeContentBag();
    toast(contentIds.length === 1 ? 'Contenido ubicado' : `${contentIds.length} contenidos ubicados`);
  } catch (error) {
    toast(error.message);
  }
}

function openContentBag() {
  $('contentBag').classList.add('open');
  $('bagBackdrop').classList.add('open');
}

function closeContentBag() {
  $('contentBag').classList.remove('open');
  $('bagBackdrop').classList.remove('open');
}

function controlRows() {
  const assignments = assignmentMap();
  return DATA.map((content) => ({
    ...content,
    locations: assignments.get(content.id) ?? [],
  }));
}

function filteredControlRows() {
  const query = $('controlSearch').value.trim().toLocaleLowerCase('es');
  const area = $('controlArea').value;
  const status = $('controlStatus').value;
  return controlRows().filter((row) => {
    const locationText = row.locations.map((location) => `${location.groupName} ${location.area}`).join(' ');
    const haystack = `${row.area} ${row.subject} ${row.axis} ${row.text} ${locationText}`.toLocaleLowerCase('es');
    return (!query || haystack.includes(query))
      && (!area || row.area === area)
      && (!status || (status === 'pending' ? !row.locations.length : row.locations.length));
  });
}

function locationLabel(locations) {
  if (!locations.length) return 'Pendiente';
  return locations.map((location) => location.area === sourceAreaFor(location.area)
    ? location.groupName
    : `${location.groupName} · ${location.area}`).join(' | ');
}

function renderControl() {
  const all = controlRows();
  const assigned = all.filter((row) => row.locations.length).length;
  const pending = all.length - assigned;
  $('controlStats').innerHTML = `
    <div class="stat"><strong>${all.length}</strong><span>contenidos totales</span></div>
    <div class="stat"><strong>${assigned}</strong><span>asignados</span></div>
    <div class="stat"><strong>${pending}</strong><span>pendientes</span></div>`;
  if (!$('controlArea').dataset.ready) {
    $('controlArea').innerHTML = '<option value="">Todas las áreas</option>' + [...new Set(DATA.map((row) => row.area))].map((area) => `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`).join('');
    $('controlArea').dataset.ready = '1';
  }
  renderControlTable();
}

function renderControlTable() {
  const rows = filteredControlRows();
  $('controlCount').textContent = `${rows.length} fila${rows.length === 1 ? '' : 's'} visible${rows.length === 1 ? '' : 's'}`;
  $('controlRows').innerHTML = rows.length
    ? rows.map((row) => `
      <tr>
        <td>${escapeHtml(row.area)}</td>
        <td>${escapeHtml(row.subject)}</td>
        <td>${escapeHtml(row.axis || '')}</td>
        <td>${escapeHtml(row.text)}</td>
        <td class="${row.locations.length ? 'assigned-text' : 'pending-text'}">${escapeHtml(locationLabel(row.locations))}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="empty-state">No hay filas para estos filtros.</td></tr>';
}

function downloadControlCsv() {
  const rows = filteredControlRows();
  const values = [
    ['Área', 'Materia', 'Eje / Bloque', 'Contenido priorizado', 'Espacio asignado'],
    ...rows.map((row) => [row.area, row.subject, row.axis, row.text, locationLabel(row.locations)]),
  ];
  const csv = values.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `Tabla_control_${app.schoolName.replace(/[^a-z0-9]+/gi, '_')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast(`${rows.length} filas exportadas`);
}

function groupLanes(groups) {
  const laneEnds = [];
  return [...groups]
    .filter((group) => group.startTerm && group.endTerm)
    .sort((a, b) => a.startTerm - b.startTerm || a.endTerm - b.endTerm || a.name.localeCompare(b.name, 'es'))
    .map((group) => {
      let lane = laneEnds.findIndex((end) => end < group.startTerm);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = group.endTerm;
      return { group, lane: lane + 1 };
    });
}

function movableMatrixGroups() {
  return AREA_ORDER.flatMap((area) => app.areas[area].groups
    .filter((group) => group.kind !== 'trunk')
    .map((group) => ({ area, group })));
}

function renderMatrixMoveTools() {
  const movable = movableMatrixGroups();
  if (!movable.some(({ group }) => group.id === selectedMatrixGroupId)) {
    selectedMatrixGroupId = movable[0]?.group.id ?? null;
  }
  $('matrixSpaceSelect').innerHTML = AREA_ORDER.map((area) => {
    const groups = movable.filter((item) => item.area === area);
    if (!groups.length) return '';
    return `<optgroup label="${escapeHtml(area)}">${groups.map(({ group }) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)} · ${escapeHtml(temporalLabel(group))}</option>`).join('')}</optgroup>`;
  }).join('');
  $('matrixTermSelect').innerHTML = TERM_LABELS.map((label, index) => `<option value="${index + 1}">${label}</option>`).join('');
  if (selectedMatrixGroupId) $('matrixSpaceSelect').value = selectedMatrixGroupId;
  syncMatrixDestination();
}

function syncMatrixDestination() {
  const found = selectedMatrixGroupId ? findGroup(app, selectedMatrixGroupId) : null;
  $('matrixTermSelect').disabled = !found;
  $('matrixMove').disabled = !found;
  $('matrixEdit').disabled = !found;
  if (found?.group.startTerm) $('matrixTermSelect').value = String(found.group.startTerm);
}

function relocateMatrixGroup(groupId, term) {
  const found = findGroup(app, groupId);
  if (!found) return;
  try {
    const { group, swapped } = moveGroupToTerm(app, groupId, term);
    selectedMatrixGroupId = group.id;
    persist();
    renderMatrix();
    toast(swapped
      ? `${group.name} pasó a C${group.startTerm}; ${swapped.name} ocupó su lugar anterior`
      : `${group.name} se movió a ${temporalLabel(group)}`);
  } catch (error) {
    toast(error.message);
  }
}

function matrixTermAtPointer(row, clientX) {
  const cells = [...row.querySelectorAll('[data-matrix-term]')];
  const exact = cells.find((cell) => {
    const rect = cell.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right;
  });
  if (exact) return Number(exact.dataset.matrixTerm);
  const first = cells[0]?.getBoundingClientRect();
  const last = cells.at(-1)?.getBoundingClientRect();
  if (!first || !last) return 1;
  const width = Math.max(1, last.right - first.left);
  return Math.min(10, Math.max(1, Math.floor(((clientX - first.left) / width) * 10) + 1));
}

function highlightMatrixTerm(row, term) {
  document.querySelectorAll('.matrix-background.drop-target').forEach((cell) => cell.classList.remove('drop-target'));
  row.querySelector(`[data-matrix-term="${term}"]`)?.classList.add('drop-target');
}

function bindMatrixMovement() {
  document.querySelectorAll('[data-matrix-group]').forEach((button) => {
    const groupId = button.dataset.matrixGroup;
    const found = findGroup(app, groupId);
    button.addEventListener('pointerdown', () => {
      if (found?.group.kind === 'trunk') return;
      selectedMatrixGroupId = groupId;
      $('matrixSpaceSelect').value = groupId;
      syncMatrixDestination();
    });
    button.addEventListener('click', () => {
      if (matrixJustDragged) return;
      openArea(button.dataset.matrixArea, groupId);
    });
    if (found?.group.kind === 'trunk') return;
    button.addEventListener('dragstart', (event) => {
      draggedMatrixGroupId = groupId;
      selectedMatrixGroupId = groupId;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-pci-space', groupId);
      event.dataTransfer.setData('text/plain', groupId);
    });
    button.addEventListener('dragend', () => {
      draggedMatrixGroupId = null;
      document.querySelectorAll('.matrix-background.drop-target').forEach((cell) => cell.classList.remove('drop-target'));
      matrixJustDragged = true;
      setTimeout(() => { matrixJustDragged = false; }, 80);
    });
  });

  document.querySelectorAll('[data-matrix-row-area]').forEach((row) => {
    row.addEventListener('dragover', (event) => {
      const found = draggedMatrixGroupId ? findGroup(app, draggedMatrixGroupId) : null;
      if (!found || found.area !== row.dataset.matrixRowArea) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      highlightMatrixTerm(row, matrixTermAtPointer(row, event.clientX));
    });
    row.addEventListener('dragleave', (event) => {
      if (event.relatedTarget && row.contains(event.relatedTarget)) return;
      row.querySelectorAll('.matrix-background.drop-target').forEach((cell) => cell.classList.remove('drop-target'));
    });
    row.addEventListener('drop', (event) => {
      event.preventDefault();
      const groupId = draggedMatrixGroupId
        || event.dataTransfer.getData('application/x-pci-space')
        || event.dataTransfer.getData('text/plain');
      const found = findGroup(app, groupId);
      if (!found || found.area !== row.dataset.matrixRowArea) {
        toast('Los espacios se reubican dentro de su misma área.');
        return;
      }
      relocateMatrixGroup(groupId, matrixTermAtPointer(row, event.clientX));
    });
  });
}

function renderMatrix() {
  $('matrixTitle').textContent = 'Matriz completa';
  $('matrixLegend').innerHTML = [
    ['Troncal anual', AREA_COLORS['Lengua y Literatura']],
    ['Laboratorio', AREA_COLORS['Ciencias Naturales']],
    ['Taller', AREA_COLORS.Tecnologías],
    ['Otro formato', AREA_COLORS['Otros formatos pedagógicos']],
  ].map(([label, color]) => `<span style="background:${color}42">${label}</span>`).join('');
  renderMatrixMoveTools();

  const header = `<div class="matrix-header"><div>Área</div>${TERM_LABELS.map((term) => `<div>${term}</div>`).join('')}</div>`;
  const rows = AREA_ORDER.map((area) => {
    const positioned = groupLanes(app.areas[area].groups);
    const lanes = Math.max(1, ...positioned.map((item) => item.lane));
    const background = TERM_LABELS.map((_, index) => `<div class="matrix-background" data-matrix-term="${index + 1}" style="grid-column:${index + 2};grid-row:1 / ${lanes + 1}"></div>`).join('');
    const spaces = positioned.map(({ group, lane }) => `
      <button class="matrix-space ${group.kind === 'trunk' ? 'locked' : 'movable'}" type="button" draggable="${group.kind !== 'trunk'}" data-matrix-area="${escapeHtml(area)}" data-matrix-group="${escapeHtml(group.id)}" title="${group.kind === 'trunk' ? 'Nivel anual fijo · clic para editar' : 'Arrastrar para mover · clic para editar'}" style="grid-column:${group.startTerm + 1} / ${group.endTerm + 2};grid-row:${lane};--space-color:${AREA_COLORS[area]}">
        <strong>${escapeHtml(group.name)}</strong>
        <small>${escapeHtml(temporalLabel(group))} · ${group.items.length} contenidos${group.kind === 'other' ? ` · ${escapeHtml(group.formatType)}` : ''}</small>
      </button>`).join('');
    return `
      <div class="matrix-area-row" data-matrix-row-area="${escapeHtml(area)}" style="grid-template-rows:repeat(${lanes}, minmax(84px, auto))">
        <div class="matrix-area-name" style="grid-column:1;grid-row:1 / ${lanes + 1}">${escapeHtml(area)}</div>
        ${background}${spaces}
      </div>`;
  }).join('');
  $('matrixGrid').innerHTML = header + rows;
  bindMatrixMovement();
}

function printScreen(screenId) {
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.toggle('printing', screen.id === screenId));
  const clean = () => document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('printing'));
  window.addEventListener('afterprint', clean, { once: true });
  window.print();
  setTimeout(clean, 1000);
}

function bindEvents() {
  $('brandHome').addEventListener('click', () => showScreen('overview'));
  document.querySelectorAll('[data-screen-link]').forEach((button) => button.addEventListener('click', () => showScreen(button.dataset.screenLink)));
  $('overviewControl').addEventListener('click', () => showScreen('control'));
  $('overviewMatrix').addEventListener('click', () => showScreen('matrix'));
  $('backOverview').addEventListener('click', () => showScreen('overview'));
  $('schoolName').addEventListener('input', (event) => {
    app.schoolName = event.target.value.trimStart() || 'Escuela Muestra';
    $('headerSchoolName').textContent = app.schoolName;
    $('overviewTitle').textContent = app.schoolName;
    document.querySelectorAll('#backOverview, .text-button[data-screen-link="overview"]').forEach((btn) => {
      btn.textContent = `← ${app.schoolName}`;
    });
    persist();
  });
  $('schoolName').addEventListener('change', () => toast('Nombre guardado'));
  $('addOther').addEventListener('click', createOtherFormat);
  $('contentSearch').addEventListener('input', renderContents);
  $('subjectFilter').addEventListener('change', renderContents);
  $('axisFilter').addEventListener('change', renderContents);
  $('pendingFilter').addEventListener('change', renderContents);
  $('moveSelected').addEventListener('click', () => assignContents(selectedGroupId, [...selectedContentIds]));
  $('openBagMobile').addEventListener('click', openContentBag);
  $('closeBagMobile').addEventListener('click', closeContentBag);
  $('bagBackdrop').addEventListener('click', closeContentBag);
  ['controlSearch', 'controlArea', 'controlStatus'].forEach((id) => {
    $(id).addEventListener(id === 'controlSearch' ? 'input' : 'change', renderControlTable);
  });
  $('exportCsv').addEventListener('click', downloadControlCsv);
  $('printControl').addEventListener('click', () => printScreen('control'));
  $('printMatrix').addEventListener('click', () => printScreen('matrix'));
  $('matrixSpaceSelect').addEventListener('change', (event) => {
    selectedMatrixGroupId = event.target.value;
    syncMatrixDestination();
  });
  $('matrixMove').addEventListener('click', () => relocateMatrixGroup(selectedMatrixGroupId, Number($('matrixTermSelect').value)));
  $('matrixEdit').addEventListener('click', () => {
    const found = selectedMatrixGroupId ? findGroup(app, selectedMatrixGroupId) : null;
    if (found) openArea(found.area, found.group.id);
  });
}

async function start() {
  bindEvents();
  try {
    DATA = await loadCurriculum();
    app = migrateState(readStoredState());
    currentArea = app.current && AREA_CONFIG[app.current] ? app.current : null;
    window.DATA = DATA;
    window.app = app;
    persist();
    renderOverview();
    $('loading').remove();
  } catch (error) {
    console.error(error);
    $('loading').innerHTML = `<div class="loading-card"><strong>No se pudo abrir la base curricular.</strong><span>${escapeHtml(error.message)}</span></div>`;
  }
}

window.PCIApp = {
  getData: () => DATA,
  getState: () => app,
  openOverview: () => showScreen('overview'),
  openControl: () => showScreen('control'),
  openMatrix: () => showScreen('matrix'),
  openArea,
};

start();
