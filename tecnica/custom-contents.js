const STORAGE_KEY = 'pciTecnicaV2';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

function getState() {
  return window.PCIApp?.getState?.() ?? null;
}

function findGroup(groupId) {
  const state = getState();
  if (!state) return null;
  for (const [area, areaState] of Object.entries(state.areas ?? {})) {
    const group = (areaState.groups ?? []).find((item) => item.id === groupId);
    if (group) return { area, group };
  }
  return null;
}

function customItems(group) {
  if (!Array.isArray(group.customItems)) group.customItems = [];
  return group.customItems;
}

function persistAndRefresh() {
  const state = getState();
  if (!state) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.app = state;
  window.dispatchEvent(new CustomEvent('pci-state-change', { detail: { schemaVersion: 2, profile: 'tecnica' } }));
  window.PCIApp?.refresh?.();
}

function makeCustomId() {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function renderCustomItems(group) {
  const items = customItems(group);
  if (!items.length) return '<div class="custom-empty">Todavía no agregaste contenidos propios.</div>';
  return items.map((item) => `
    <article class="custom-content-item">
      <div>
        <small>Contenido adicional · no computa en cobertura</small>
        <p>${escapeHtml(item.text)}</p>
      </div>
      <button class="remove-content" type="button" data-remove-custom="${escapeHtml(item.id)}" aria-label="Quitar contenido adicional">×</button>
    </article>`).join('');
}

function injectCustomSections() {
  document.querySelectorAll('.group-card[data-group-id]').forEach((card) => {
    if (card.querySelector('[data-custom-section]')) return;
    const found = findGroup(card.dataset.groupId);
    if (!found) return;
    const { group } = found;
    const items = customItems(group);
    const section = document.createElement('section');
    section.className = 'custom-content-section';
    section.dataset.customSection = '1';
    section.innerHTML = `
      <div class="assigned-heading custom-heading">
        <div>
          <h3>Otros contenidos</h3>
          <small>No forman parte de la base priorizada y no modifican la cobertura.</small>
        </div>
        <span class="pill">${items.length}</span>
      </div>
      <div class="custom-content-list">${renderCustomItems(group)}</div>
      <div class="custom-add-row">
        <textarea data-custom-input rows="2" placeholder="Agregar otro contenido para este espacio"></textarea>
        <button class="button secondary" type="button" data-add-custom>Agregar contenido</button>
      </div>`;
    const assignedList = card.querySelector('.assigned-list');
    if (assignedList) assignedList.insertAdjacentElement('afterend', section);
    else card.appendChild(section);
  });
  updateCoverageHint();
}

function addCustomContent(card) {
  const found = findGroup(card.dataset.groupId);
  const input = card.querySelector('[data-custom-input]');
  if (!found || !input) return;
  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }
  customItems(found.group).push({ id: makeCustomId(), text });
  input.value = '';
  persistAndRefresh();
}

function removeCustomContent(card, customId) {
  const found = findGroup(card.dataset.groupId);
  if (!found) return;
  found.group.customItems = customItems(found.group).filter((item) => String(item.id) !== String(customId));
  persistAndRefresh();
}

function updateCoverageHint() {
  const hint = document.getElementById('coverageHint');
  if (!hint) return;
  hint.textContent = 'Cada contenido priorizado cuenta una sola vez, aunque se use en varios espacios. Los contenidos adicionales no computan en cobertura.';
}

function updateMatrixCustomCounts() {
  document.querySelectorAll('[data-matrix-group]').forEach((button) => {
    const found = findGroup(button.dataset.matrixGroup);
    const small = button.querySelector('small');
    if (!found || !small) return;
    const count = customItems(found.group).length;
    small.querySelector?.('[data-custom-count]')?.remove?.();
    const existing = small.textContent.replace(/ · \d+ otros?$/, '');
    small.textContent = count ? `${existing} · ${count} ${count === 1 ? 'otro' : 'otros'}` : existing;
  });
}

function injectMatrixDetailCustomContents() {
  const panel = document.getElementById('matrixDetailsPanel');
  if (!panel || panel.hidden || !panel.dataset.groupId) return;
  panel.querySelectorAll('[data-custom-detail]').forEach((node) => node.remove());
  const found = findGroup(panel.dataset.groupId);
  if (!found) return;
  const items = customItems(found.group);
  if (!items.length) return;
  const anchor = panel.querySelector('.matrix-content-list');
  if (!anchor) return;
  const meta = document.createElement('div');
  meta.className = 'matrix-detail-meta custom-detail-meta';
  meta.dataset.customDetail = '1';
  meta.innerHTML = `<strong>${items.length}</strong> contenido${items.length === 1 ? '' : 's'} adicional${items.length === 1 ? '' : 'es'} · no computa${items.length === 1 ? '' : 'n'} en cobertura`;
  const list = document.createElement('div');
  list.className = 'matrix-content-list';
  list.dataset.customDetail = '1';
  list.innerHTML = items.map((item) => `<article class="matrix-content-row custom-detail-row"><small>Contenido adicional</small><p>${escapeHtml(item.text)}</p></article>`).join('');
  anchor.insertAdjacentElement('afterend', meta);
  meta.insertAdjacentElement('afterend', list);
}

function refreshEnhancements() {
  injectCustomSections();
  updateMatrixCustomCounts();
  injectMatrixDetailCustomContents();
}

document.addEventListener('click', (event) => {
  const addButton = event.target.closest?.('[data-add-custom]');
  if (addButton) {
    event.preventDefault();
    event.stopPropagation();
    const card = addButton.closest('.group-card[data-group-id]');
    if (card) addCustomContent(card);
    return;
  }
  const removeButton = event.target.closest?.('[data-remove-custom]');
  if (removeButton) {
    event.preventDefault();
    event.stopPropagation();
    const card = removeButton.closest('.group-card[data-group-id]');
    if (card) removeCustomContent(card, removeButton.dataset.removeCustom);
  }
}, true);

document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key !== 'Enter') return;
  const input = event.target.closest?.('[data-custom-input]');
  if (!input) return;
  const card = input.closest('.group-card[data-group-id]');
  if (card) addCustomContent(card);
});

const observer = new MutationObserver(() => requestAnimationFrame(refreshEnhancements));
observer.observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener('pci-state-change', () => requestAnimationFrame(refreshEnhancements));
window.addEventListener('DOMContentLoaded', () => requestAnimationFrame(refreshEnhancements));
setTimeout(refreshEnhancements, 0);
