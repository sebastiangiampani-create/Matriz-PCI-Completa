import {
  AREA_CONFIG,
  AREA_ORDER,
  PERIODS,
  allGroups,
  assignContents,
  createInitialState,
  findGroup,
  locationsForContent,
  matrixSlots,
  migrateState,
  moveGroupToPeriod,
  removeContent,
} from './pci-model.js';

const STORAGE_KEY = 'pciTecnicaV1';
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const norm = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

let state = loadState();
let contents = [];
let selected = new Set();
let targetGroupId = null;
let currentScreen = 'overview';

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return saved ? migrateState(saved) : createInitialState();
  } catch {
    return createInitialState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function loadContents() {
  try {
    const response = await fetch('./data/contents.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo cargar la base curricular tecnica.');
    const data = await response.json();
    contents = Array.isArray(data) ? data.map((item, index) => ({
      id: String(item.id ?? `tecnica-${index + 1}`),
      area: String(item.area ?? ''),
      subject: String(item.subject ?? item.materia ?? ''),
      axis: String(item.axis ?? item.eje ?? ''),
      content: String(item.content ?? item.contenido ?? ''),
    })).filter((item) => item.content) : [];
  } catch (error) {
    contents = [];
    console.warn(error);
  }
  renderAll();
}

function areaDescription(area) {
  const config = AREA_CONFIG[area];
  if (config.kind === 'annual') return '6 niveles anuales, cada uno ocupa dos periodos.';
  if (config.kind === 'integration') return `${config.count} Espacios de Integracion, con cualidad Obligatorio/Electivo y ubicacion C1-C12.`;
  if (config.kind === 'formative') return `${config.count} Espacios Formativos con ubicacion C1-C12.`;
  return 'Taller especial pendiente de confirmar modalidad y duracion.';
}

function showScreen(id) {
  currentScreen = id;
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.toggle('active', screen.id === id));
  if (id === 'overview') renderOverview();
  if (id === 'board') renderBoard();
  if (id === 'control') renderControl();
  if (id === 'matrix') renderMatrix();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderOverview() {
  $('overviewTitle').textContent = state.schoolName;
  $('schoolName').value = state.schoolName;
  $('areaGrid').innerHTML = AREA_ORDER.map((area) => {
    const config = AREA_CONFIG[area];
    const groups = state.areas[area].groups;
    const placed = groups.filter((group) => group.startPeriod).length;
    return `<button class="area-card" type="button" data-area="${esc(area)}">
      <strong>${esc(area)}</strong>
      <p class="muted">${esc(areaDescription(area))}</p>
      <span class="pill">${groups.length} espacios</span>
      ${config.kind !== 'annual' && !config.pendingDefinition ? `<span class="pill">${placed}/${groups.length} ubicados</span>` : ''}
      ${config.pendingDefinition ? '<span class="pill">Definicion pendiente</span>' : ''}
    </button>`;
  }).join('');
}

function currentGroups() {
  return state.currentArea ? state.areas[state.currentArea]?.groups ?? [] : [];
}

function contentById(id) {
  return contents.find((item) => item.id === String(id));
}

function assignedIds() {
  return new Set(allGroups(state).flatMap(({ group }) => group.items));
}

function filteredContents() {
  const query = norm($('contentSearch')?.value);
  const area = $('contentArea')?.value || '';
  const subject = $('contentSubject')?.value || '';
  const axis = $('contentAxis')?.value || '';
  return contents.filter((item) => {
    if (area && item.area !== area) return false;
    if (subject && item.subject !== subject) return false;
    if (axis && item.axis !== axis) return false;
    if (query && !norm(`${item.area} ${item.subject} ${item.axis} ${item.content}`).includes(query)) return false;
    return true;
  });
}

function fillContentFilters() {
  const values = (key) => [...new Set(contents.map((item) => item[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const preserve = (id, firstLabel, list) => {
    const select = $(id);
    if (!select) return;
    const old = select.value;
    select.innerHTML = `<option value="">${firstLabel}</option>` + list.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
    if (list.includes(old)) select.value = old;
  };
  preserve('contentArea', 'Todas las areas', values('area'));
  preserve('contentSubject', 'Todas las materias', values('subject'));
  preserve('contentAxis', 'Todos los ejes', values('axis'));
}

function renderContentBag() {
  fillContentFilters();
  const list = filteredContents();
  const assigned = assignedIds();
  $('bagMeta').textContent = contents.length
    ? `${contents.length} contenidos priorizados cargados.`
    : 'Base de contenidos priorizados Tecnica pendiente de incorporar.';
  $('contentList').innerHTML = list.length ? list.map((item) => `<label class="content-row">
    <input type="checkbox" data-content-id="${esc(item.id)}" ${selected.has(item.id) ? 'checked' : ''}>
    <span><strong>${esc(item.content)}</strong><small>${esc([item.area, item.subject, item.axis].filter(Boolean).join(' · '))}${assigned.has(item.id) ? ' · asignado' : ''}</small></span>
  </label>`).join('') : '<div class="empty">Todavia no hay contenidos para mostrar. La interfaz ya queda preparada para cargar la base Tecnica.</div>';
  $('selectionCount').textContent = `${selected.size} seleccionados`;
  const target = targetGroupId ? findGroup(state, targetGroupId)?.group : null;
  $('selectionTarget').textContent = target ? `Destino: ${target.name}` : 'Elegi un espacio de destino.';
  $('assignSelected').disabled = !target || selected.size === 0;
}

function groupFields(group) {
  const isIntegration = group.kind === 'integration';
  const isFormative = group.kind === 'formative';
  const movable = group.kind !== 'annual' && !group.pendingDefinition;
  const periodOptions = PERIODS.map((period) => `<option value="${period}" ${group.startPeriod === period ? 'selected' : ''}>C${period}</option>`).join('');
  return `<div class="editor-grid">
    <label class="full">Nombre<input data-field="name" value="${esc(group.name)}"></label>
    ${group.kind !== 'annual' ? `<label>Cualidad<select data-field="type"><option ${group.type === 'Obligatorio' ? 'selected' : ''}>Obligatorio</option><option ${group.type === 'Electivo' ? 'selected' : ''}>Electivo</option></select></label>` : ''}
    ${movable ? `<label>Ubicacion<select data-field="period"><option value="">Sin ubicar</option>${periodOptions}</select></label>` : ''}
    ${group.kind === 'annual' ? `<label>Trayecto<input value="Nivel ${group.level} · C${group.startPeriod}-C${group.endPeriod}" disabled></label>` : ''}
    ${isIntegration ? '<label class="full">Contexto problematizador<textarea data-field="context"></textarea></label>' : ''}
    ${isFormative ? '<label class="full">Practica / producto / eje<textarea data-field="practiceAxis"></textarea></label>' : ''}
    <label class="full">Objetivos de aprendizaje<textarea data-field="objective">${esc(group.objective)}</textarea></label>
    <label class="full">Sinopsis<textarea data-field="synopsis">${esc(group.synopsis)}</textarea></label>
  </div>`;
}

function renderGroup(group) {
  const items = group.items.map((id) => contentById(id)).filter(Boolean);
  return `<article class="group-card ${targetGroupId === group.id ? 'selected' : ''}" data-group-id="${esc(group.id)}">
    <div class="group-header">
      <div><h3>${esc(group.name)}</h3><span class="pill">${group.kind === 'annual' ? 'Anual' : group.kind === 'integration' ? 'Espacio de Integracion' : group.kind === 'formative' ? 'Espacio Formativo' : 'Taller especial'}</span>${group.pendingDefinition ? '<span class="pill">Pendiente</span>' : ''}</div>
      <button class="btn" type="button" data-target-group="${esc(group.id)}">Elegir como destino</button>
    </div>
    ${group.pendingDefinition ? '<div class="notice">La modalidad temporal de este taller se definira cuando confirmemos si es anual o periodica.</div>' : ''}
    ${groupFields(group)}
    <div class="assigned"><strong>Contenidos asignados (${items.length})</strong><div class="assigned-list">${items.length ? items.map((item) => `<div class="assigned-item"><span>${esc(item.content)}<small>${esc([item.subject, item.axis].filter(Boolean).join(' · '))}</small></span><button class="btn" type="button" data-remove-content="${esc(item.id)}">Quitar</button></div>`).join('') : '<div class="empty">Sin contenidos asignados.</div>'}</div></div>
  </article>`;
}

function renderBoard() {
  const area = state.currentArea;
  if (!area) return showScreen('overview');
  $('boardTitle').textContent = area;
  $('boardDescription').textContent = areaDescription(area);
  $('groups').innerHTML = currentGroups().map(renderGroup).join('');
  document.querySelectorAll('[data-group-id]').forEach((card) => {
    const group = findGroup(state, card.dataset.groupId)?.group;
    if (!group) return;
    const context = card.querySelector('[data-field="context"]');
    const practice = card.querySelector('[data-field="practiceAxis"]');
    if (context) context.value = group.context || '';
    if (practice) practice.value = group.practiceAxis || '';
  });
  const total = contents.length;
  const used = assignedIds().size;
  $('coverageLabel').textContent = `${used} de ${total} contenidos ubicados`;
  $('coverageBar').style.width = total ? `${Math.round((used / total) * 100)}%` : '0%';
  renderContentBag();
}

function renderControl() {
  const query = norm($('controlSearch')?.value);
  const areaFilter = $('controlArea')?.value || '';
  const status = $('controlStatus')?.value || '';
  const areaOptions = [...new Set(contents.map((item) => item.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const areaSelect = $('controlArea');
  const oldArea = areaSelect.value;
  areaSelect.innerHTML = '<option value="">Todas las areas</option>' + areaOptions.map((area) => `<option value="${esc(area)}">${esc(area)}</option>`).join('');
  if (areaOptions.includes(oldArea)) areaSelect.value = oldArea;

  const rows = contents.map((item) => ({ item, locations: locationsForContent(state, item.id) })).filter(({ item, locations }) => {
    if (areaFilter && item.area !== areaFilter) return false;
    if (status === 'pending' && locations.length) return false;
    if (status === 'assigned' && !locations.length) return false;
    if (query && !norm(`${item.area} ${item.subject} ${item.axis} ${item.content} ${locations.map((x) => x.groupName).join(' ')}`).includes(query)) return false;
    return true;
  });

  $('controlCount').textContent = `${rows.length} contenidos`;
  $('controlRows').innerHTML = rows.length ? rows.map(({ item, locations }) => `<tr><td>${esc(item.area)}</td><td>${esc(item.subject)}</td><td>${esc(item.axis)}</td><td>${esc(item.content)}</td><td>${locations.length ? locations.map((location) => esc(`${location.area} · ${location.groupName}`)).join('<br>') : '<span class="muted">Pendiente</span>'}</td></tr>`).join('') : '<tr><td colspan="5" class="muted">La base de contenidos Tecnica aun no fue cargada.</td></tr>';
}

function renderMatrix() {
  const slots = matrixSlots(state);
  const header = '<tr><th>Area / espacio</th>' + PERIODS.map((period) => `<th>C${period}</th>`).join('') + '</tr>';
  const body = AREA_ORDER.map((area) => {
    const cells = PERIODS.map((period) => {
      const here = slots.filter((slot) => slot.area === area && slot.period === period);
      return `<td>${here.map((slot) => `<span class="matrix-space">${esc(slot.group.name)}${slot.group.type ? ` · ${esc(slot.group.type)}` : ''}</span>`).join('')}</td>`;
    }).join('');
    return `<tr><th>${esc(area)}</th>${cells}</tr>`;
  }).join('');
  $('matrixTable').innerHTML = `<thead>${header}</thead><tbody>${body}</tbody>`;

  const movable = allGroups(state).filter(({ group }) => group.kind !== 'annual' && !group.pendingDefinition);
  const groupSelect = $('matrixGroup');
  const previous = groupSelect.value;
  groupSelect.innerHTML = movable.map(({ area, group }) => `<option value="${esc(group.id)}">${esc(area)} · ${esc(group.name)}</option>`).join('');
  if (movable.some(({ group }) => group.id === previous)) groupSelect.value = previous;
  $('matrixPeriod').innerHTML = PERIODS.map((period) => `<option value="${period}">C${period}</option>`).join('');

  const pending = allGroups(state).filter(({ group }) => group.pendingDefinition).map(({ area, group }) => `${area}: ${group.name}`);
  $('pendingWorkshops').textContent = pending.length ? `Talleres pendientes de definicion temporal: ${pending.join(' · ')}` : '';
}

function renderAll() {
  renderOverview();
  if (currentScreen === 'board') renderBoard();
  if (currentScreen === 'control') renderControl();
  if (currentScreen === 'matrix') renderMatrix();
}

function exportCsv() {
  const lines = [['Area', 'Materia', 'Eje', 'Contenido', 'Espacio asignado']];
  contents.forEach((item) => {
    const locations = locationsForContent(state, item.id);
    lines.push([item.area, item.subject, item.axis, item.content, locations.map((location) => `${location.area} - ${location.groupName}`).join(' | ')]);
  });
  const csv = lines.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'pci-tecnica-control.csv';
  link.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('click', (event) => {
  const screenButton = event.target.closest('[data-screen]');
  if (screenButton) return showScreen(screenButton.dataset.screen);

  const areaButton = event.target.closest('[data-area]');
  if (areaButton) {
    state.currentArea = areaButton.dataset.area;
    targetGroupId = null;
    selected.clear();
    saveState();
    return showScreen('board');
  }

  const targetButton = event.target.closest('[data-target-group]');
  if (targetButton) {
    targetGroupId = targetButton.dataset.targetGroup;
    return renderBoard();
  }

  const removeButton = event.target.closest('[data-remove-content]');
  if (removeButton) {
    const card = removeButton.closest('[data-group-id]');
    removeContent(state, card.dataset.groupId, removeButton.dataset.removeContent);
    saveState();
    return renderBoard();
  }
});

document.addEventListener('change', (event) => {
  const contentCheck = event.target.closest('[data-content-id]');
  if (contentCheck) {
    if (contentCheck.checked) selected.add(contentCheck.dataset.contentId);
    else selected.delete(contentCheck.dataset.contentId);
    return renderContentBag();
  }

  const field = event.target.closest('[data-field]');
  if (field) {
    const card = field.closest('[data-group-id]');
    const group = findGroup(state, card.dataset.groupId)?.group;
    if (!group) return;
    if (field.dataset.field === 'period') {
      if (field.value) moveGroupToPeriod(state, group.id, Number(field.value));
      else Object.assign(group, { startPeriod: null, endPeriod: null, level: null });
    } else {
      group[field.dataset.field] = field.value;
    }
    saveState();
    return renderBoard();
  }

  if (['contentArea', 'contentSubject', 'contentAxis'].includes(event.target.id)) renderContentBag();
  if (['controlArea', 'controlStatus'].includes(event.target.id)) renderControl();
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'contentSearch') renderContentBag();
  if (event.target.id === 'controlSearch') renderControl();
  const field = event.target.closest('[data-field="name"],[data-field="context"],[data-field="practiceAxis"],[data-field="objective"],[data-field="synopsis"]');
  if (field) {
    const card = field.closest('[data-group-id]');
    const group = findGroup(state, card.dataset.groupId)?.group;
    if (!group) return;
    group[field.dataset.field] = field.value;
    saveState();
  }
});

$('schoolName').addEventListener('input', (event) => {
  state.schoolName = event.target.value || 'Escuela Tecnica';
  $('overviewTitle').textContent = state.schoolName;
  saveState();
});

$('assignSelected').addEventListener('click', () => {
  if (!targetGroupId || !selected.size) return;
  assignContents(state, targetGroupId, [...selected]);
  selected.clear();
  saveState();
  renderBoard();
});

$('contentSearch').addEventListener('input', renderContentBag);
$('controlSearch').addEventListener('input', renderControl);
$('moveMatrix').addEventListener('click', () => {
  const groupId = $('matrixGroup').value;
  if (!groupId) return;
  try {
    moveGroupToPeriod(state, groupId, Number($('matrixPeriod').value));
    saveState();
    renderMatrix();
  } catch (error) {
    alert(error.message);
  }
});
$('exportCsv').addEventListener('click', exportCsv);
$('printControl').addEventListener('click', () => window.print());
$('printMatrix').addEventListener('click', () => window.print());

renderAll();
loadContents();
