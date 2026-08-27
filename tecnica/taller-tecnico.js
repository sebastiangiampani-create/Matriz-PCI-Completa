const STORAGE_KEY = 'pciTecnicaV2';

function technicalWorkshops() {
  const state = window.PCIApp?.getState?.();
  return state?.areas?.Talleres?.groups ?? [];
}

function isTallerArea() {
  return window.PCIApp?.getState?.()?.current === 'Talleres';
}

function normalizeWorkshopState() {
  const state = window.PCIApp?.getState?.();
  if (!state) return;
  let changed = false;
  technicalWorkshops().forEach((group, index) => {
    const level = index + 1;
    const startTerm = level * 2 - 1;
    const endTerm = level * 2;
    if (group.kind !== 'technical-workshop') { group.kind = 'technical-workshop'; changed = true; }
    if (group.level !== level) { group.level = level; changed = true; }
    if (group.startTerm !== startTerm) { group.startTerm = startTerm; changed = true; }
    if (group.endTerm !== endTerm) { group.endTerm = endTerm; changed = true; }
    if (group.duration !== 'annual') { group.duration = 'annual'; changed = true; }
    if (group.fixed !== true) { group.fixed = true; changed = true; }
    if (group.type) { group.type = ''; changed = true; }
    if (group.elective) { group.elective = false; changed = true; }
  });
  if (changed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.app = state;
  }
}

function patchWorkshopEditor() {
  if (!isTallerArea()) return;

  const bag = document.getElementById('contentBag');
  if (bag) {
    const eyebrow = bag.querySelector('.bag-heading .eyebrow');
    const title = bag.querySelector('.bag-heading h2');
    if (eyebrow) eyebrow.textContent = 'Bolsa curricular · Taller';
    if (title) title.textContent = 'Contenidos propios del Taller';
  }

  document.querySelectorAll('.group-card[data-group-id]').forEach((card) => {
    const group = technicalWorkshops().find((item) => item.id === card.dataset.groupId);
    if (!group) return;

    card.querySelectorAll('.field-label').forEach((label) => {
      const caption = label.querySelector(':scope > span')?.textContent?.trim();
      if (caption === 'Carácter del agrupamiento') label.remove();
      if (caption === 'Práctica / producto / eje') {
        label.querySelector(':scope > span').textContent = 'Descripción / eje del Taller';
        const textarea = label.querySelector('textarea');
        if (textarea) textarea.placeholder = 'Describí el eje, enfoque o propuesta del Taller';
      }
    });

    card.querySelectorAll('.group-meta .pill').forEach((pill) => {
      const text = pill.textContent.trim();
      if (text === 'Obligatorio' || text === 'Electivo') pill.remove();
    });
  });
}

function patchMatrixDetails() {
  const panel = document.getElementById('matrixDetailsPanel');
  if (!panel || panel.hidden || !panel.dataset.groupId) return;
  const group = technicalWorkshops().find((item) => item.id === panel.dataset.groupId);
  if (!group) return;
  panel.querySelectorAll('.matrix-detail-box strong').forEach((label) => {
    if (label.textContent.trim() === 'Práctica / producto / eje') {
      label.textContent = 'Descripción / eje del Taller';
    }
  });
}

function apply() {
  normalizeWorkshopState();
  patchWorkshopEditor();
  patchMatrixDetails();
}

const observer = new MutationObserver(apply);
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
window.addEventListener('DOMContentLoaded', apply);
window.addEventListener('pci-state-change', apply);
setTimeout(apply, 0);
