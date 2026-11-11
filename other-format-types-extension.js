const OTHER_AREA = 'Otros formatos pedagógicos';
const EXTRA_TYPES = ['Trabajo de Campo', 'Práctica Docente / Profesional'];

function state() {
  return window.PCIApp?.getState?.() ?? window.app ?? null;
}

function otherGroups() {
  return state()?.areas?.[OTHER_AREA]?.groups ?? [];
}

function findGroup(groupId) {
  return otherGroups().find((group) => group.id === groupId) ?? null;
}

function persistState() {
  const app = state();
  if (!app) return;
  app.schemaVersion = 10;
  localStorage.setItem('pciAppV2', JSON.stringify(app));
  window.app = app;
  window.dispatchEvent(new CustomEvent('pci-state-change', { detail: { schemaVersion: 10 } }));
}

function restoreExtendedTypes() {
  let changed = false;
  for (const group of otherGroups()) {
    if (EXTRA_TYPES.includes(group.formatTypeExtension) && group.formatType !== group.formatTypeExtension) {
      group.formatType = group.formatTypeExtension;
      changed = true;
    }
  }
  if (changed) persistState();
}

function enhanceSelects() {
  restoreExtendedTypes();
  document.querySelectorAll('.group-card select[data-field="formatType"]').forEach((select) => {
    for (const type of EXTRA_TYPES) {
      if (![...select.options].some((option) => option.value === type)) {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        select.appendChild(option);
      }
    }
    const groupId = select.closest('.group-card')?.dataset.groupId;
    const group = groupId ? findGroup(groupId) : null;
    if (group && EXTRA_TYPES.includes(group.formatTypeExtension)) {
      select.value = group.formatTypeExtension;
    }
  });
}

document.addEventListener('change', (event) => {
  const select = event.target?.closest?.('.group-card select[data-field="formatType"]');
  if (!select) return;
  const groupId = select.closest('.group-card')?.dataset.groupId;
  const group = groupId ? findGroup(groupId) : null;
  if (!group) return;
  const value = select.value;
  group.formatType = value;
  if (EXTRA_TYPES.includes(value)) group.formatTypeExtension = value;
  else delete group.formatTypeExtension;
  persistState();
}, true);

const observer = new MutationObserver(() => enhanceSelects());
observer.observe(document.documentElement, { subtree: true, childList: true });
window.addEventListener('pci-state-change', () => setTimeout(enhanceSelects, 0));
setTimeout(enhanceSelects, 0);
setTimeout(enhanceSelects, 500);
