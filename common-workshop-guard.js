(() => {
  const STORAGE_KEY = 'pciAppV2';
  const AREAS = ['Artes', 'Tecnologías', 'Educación Física'];
  let normalizing = false;

  function capacity(area) {
    return area === 'Artes' ? 2 : 1;
  }

  function state() {
    if (window.PCIApp?.getState) return window.PCIApp.getState();
    if (window.app) return window.app;
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return null;
    }
  }

  function locate(groupId) {
    const current = state();
    if (!current) return null;
    for (const area of AREAS) {
      const groups = current.areas?.[area]?.groups ?? [];
      const group = groups.find((item) => String(item.id) === String(groupId));
      if (group) return { current, area, group, groups };
    }
    return null;
  }

  function termOf(group) {
    const term = Number(group?.startTerm);
    return Number.isInteger(term) && term >= 1 && term <= 10 ? term : null;
  }

  function assign(group, term) {
    group.startTerm = term;
    group.endTerm = term;
    group.level = Math.ceil(term / 2);
  }

  // Se ejecuta en fase de captura. El listener principal de app.js después mueve
  // el taller seleccionado; acá reubicamos antes al taller que ocupaba el destino.
  function prepareWorkshopSwap(event) {
    const field = event.target?.closest?.('.group-card[data-group-id] [data-field="term"]');
    if (!field) return;
    const card = field.closest('.group-card[data-group-id]');
    const found = locate(card?.dataset.groupId);
    if (!found || found.group.kind !== 'workshop') return;

    const target = Number(field.value);
    const origin = termOf(found.group);
    if (!origin || !Number.isInteger(target) || target < 1 || target > 10 || target === origin) return;

    const occupied = found.groups.filter((candidate) =>
      candidate.id !== found.group.id
      && candidate.kind === 'workshop'
      && termOf(candidate) === target,
    );

    if (occupied.length >= capacity(found.area)) {
      assign(occupied[0], origin);
    }
  }

  function normalizeArea(current, area) {
    const groups = (current.areas?.[area]?.groups ?? []).filter((group) => group.kind === 'workshop');
    const limit = capacity(area);
    const used = new Map();
    let changed = false;

    for (const group of groups) {
      let term = termOf(group);
      if (!term || (used.get(term) ?? 0) >= limit) {
        const available = Array.from({ length: 10 }, (_, index) => index + 1)
          .find((candidate) => (used.get(candidate) ?? 0) < limit);
        if (available) {
          term = available;
          assign(group, term);
          changed = true;
        }
      }
      if (term) used.set(term, (used.get(term) ?? 0) + 1);
    }
    return changed;
  }

  function normalizeStoredWorkshops() {
    if (normalizing) return;
    const current = state();
    if (!current?.areas) return;
    normalizing = true;
    try {
      const changed = AREAS.some((area) => normalizeArea(current, area));
      if (!changed) return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      window.app = current;
      const active = current.current;
      if (active && AREAS.includes(active)) {
        queueMicrotask(() => window.PCIApp?.openArea?.(active));
      }
    } finally {
      normalizing = false;
    }
  }

  document.addEventListener('change', prepareWorkshopSwap, true);
  window.addEventListener('pci-state-change', () => setTimeout(normalizeStoredWorkshops, 0));
  window.addEventListener('DOMContentLoaded', () => setTimeout(normalizeStoredWorkshops, 0));
  setTimeout(normalizeStoredWorkshops, 250);
})();
