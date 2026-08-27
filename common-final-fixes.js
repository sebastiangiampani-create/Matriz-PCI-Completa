const STORAGE_KEY = 'pciAppV2';

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
  window.dispatchEvent(new CustomEvent('pci-state-change', { detail: { schemaVersion: 10 } }));
  const current = state.current;
  if (current) window.PCIApp?.openArea?.(current);
}

function makeCustomId() {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function renderCustomItems(group) {
  const items = customItems(group);
  if (!items.length) return '<div class="custom-empty">Todavía no agregaste otros contenidos.</div>';
  return items.map((item) => `
    <article class="custom-content-item">
      <div><small>Contenido adicional</small><p>${escapeHtml(item.text)}</p></div>
      <button class="remove-content" type="button" data-remove-custom="${escapeHtml(item.id)}" aria-label="Quitar contenido adicional">×</button>
    </article>`).join('');
}

function injectCustomSections() {
  document.querySelectorAll('.group-card[data-group-id]').forEach((card) => {
    if (card.querySelector('[data-custom-section]')) return;
    const found = findGroup(card.dataset.groupId);
    if (!found) return;
    const items = customItems(found.group);
    const section = document.createElement('section');
    section.className = 'custom-content-section';
    section.dataset.customSection = '1';
    section.innerHTML = `
      <div class="assigned-heading custom-heading">
        <div><h3>Otros contenidos</h3></div>
        <span class="pill">${items.length}</span>
      </div>
      <div class="custom-content-list">${renderCustomItems(found.group)}</div>
      <div class="custom-add-row">
        <textarea data-custom-input rows="2" placeholder="Agregar otro contenido para este espacio"></textarea>
        <button class="button secondary" type="button" data-add-custom>Agregar contenido</button>
      </div>`;
    const assignedList = card.querySelector('.assigned-list');
    if (assignedList) assignedList.insertAdjacentElement('afterend', section);
    else card.appendChild(section);
  });
}

function addCustomContent(card) {
  const found = findGroup(card.dataset.groupId);
  const input = card.querySelector('[data-custom-input]');
  if (!found || !input) return;
  const text = input.value.trim();
  if (!text) return input.focus();
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

function updateMatrixCustomCounts() {
  document.querySelectorAll('[data-matrix-group]').forEach((button) => {
    const found = findGroup(button.dataset.matrixGroup);
    const small = button.querySelector('small');
    if (!found || !small) return;
    const count = customItems(found.group).length;
    const base = small.textContent.replace(/ · \d+ otros?$/, '');
    small.textContent = count ? `${base} · ${count} ${count === 1 ? 'otro' : 'otros'}` : base;
  });
}

function injectMatrixDetailCustomContents() {
  const panel = document.getElementById('matrixDetailsPanel');
  if (!panel || panel.hidden || !panel.dataset.groupId) return;
  const found = findGroup(panel.dataset.groupId);
  if (!found) return;
  const items = customItems(found.group);
  panel.querySelectorAll('[data-custom-detail]').forEach((node) => node.remove());
  if (!items.length) return;
  const anchor = panel.querySelector('.matrix-content-list');
  if (!anchor) return;
  const meta = document.createElement('div');
  meta.className = 'matrix-detail-meta custom-detail-meta';
  meta.dataset.customDetail = '1';
  meta.innerHTML = `<strong>${items.length}</strong> contenido${items.length === 1 ? '' : 's'} adicional${items.length === 1 ? '' : 'es'}`;
  const list = document.createElement('div');
  list.className = 'matrix-content-list';
  list.dataset.customDetail = '1';
  list.innerHTML = items.map((item) => `<article class="matrix-content-row custom-detail-row"><small>Contenido adicional</small><p>${escapeHtml(item.text)}</p></article>`).join('');
  anchor.insertAdjacentElement('afterend', meta);
  meta.insertAdjacentElement('afterend', list);
}

function hideVerifiedStructureNotice() {
  const status = document.getElementById('structureStatus');
  if (!status) return;
  const verified = status.textContent.includes('Estructura base verificada');
  status.hidden = verified;
  if (!verified && status.textContent.trim()) status.hidden = false;
}

function workshopCapacity(area) {
  return area === 'Artes' ? 2 : 1;
}

function assignTerm(group, term) {
  group.startTerm = term;
  group.endTerm = term;
  group.level = Math.ceil(term / 2);
}

function handleWorkshopTermChange(event) {
  const field = event.target.closest?.('[data-field="term"]');
  if (!field) return;
  const card = field.closest('.group-card[data-group-id]');
  if (!card) return;
  const found = findGroup(card.dataset.groupId);
  if (!found || found.group.kind !== 'workshop') return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const state = getState();
  const { area, group } = found;
  const term = Number(field.value);
  const origin = Number(group.startTerm);
  if (!Number.isInteger(term) || term < 1 || term > 10 || term === origin) return;

  const capacity = workshopCapacity(area);
  const peers = state.areas?.[area]?.groups ?? [];
  const occupied = peers.filter((candidate) =>
    candidate.id !== group.id && candidate.kind === 'workshop' && Number(candidate.startTerm) === term,
  );
  if (occupied.length >= capacity) assignTerm(occupied[0], origin);
  assignTerm(group, term);
  persistAndRefresh();
}

document.addEventListener('change', handleWorkshopTermChange, true);

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

const style = document.createElement('style');
style.textContent = `
  .custom-content-section{margin-top:16px;padding-top:14px;border-top:1px dashed var(--line,#d6e2e5)}
  .custom-heading{align-items:flex-start;margin-top:0}.custom-heading h3{margin-bottom:2px}
  .custom-content-list{display:grid;gap:7px}.custom-content-item{display:grid;grid-template-columns:minmax(0,1fr) 34px;gap:8px;padding:10px;border:1px solid #d9d2a6;border-radius:11px;background:#fffbee}
  .custom-content-item small{display:block;margin-bottom:4px;color:#806b20;font-size:.72rem;font-weight:850}.custom-content-item p{margin:0;line-height:1.4}
  .custom-empty{padding:12px;border:1px dashed #d9d2a6;border-radius:11px;color:var(--muted,#6a7b84);background:#fffdf7;font-size:.82rem}
  .custom-add-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;margin-top:9px}.custom-add-row textarea{min-height:68px}.custom-detail-meta{margin-top:16px}.custom-detail-row{background:#fffbee!important;border-color:#d9d2a6!important}
  @media(max-width:820px){.custom-add-row{grid-template-columns:1fr}}
`;
document.head.appendChild(style);

let queued = false;
function refresh() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    injectCustomSections();
    updateMatrixCustomCounts();
    injectMatrixDetailCustomContents();
    hideVerifiedStructureNotice();
  });
}

const observer = new MutationObserver(refresh);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener('pci-state-change', refresh);
window.addEventListener('DOMContentLoaded', refresh);
setTimeout(refresh, 0);
