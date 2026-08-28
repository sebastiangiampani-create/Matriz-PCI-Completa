import { addOptionalSixthLevel, OPTIONAL_SIXTH_LEVEL_AREAS } from './pci-model.js';

const STORAGE_KEY = 'pciTecnicaV2';
const OPTIONAL_AREAS = new Set(OPTIONAL_SIXTH_LEVEL_AREAS);
let queued = false;

function state() {
  return window.PCIApp?.getState?.() ?? null;
}

function persist(current) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  window.app = current;
  window.dispatchEvent(new CustomEvent('pci-state-change', {
    detail: { schemaVersion: 2, profile: 'tecnica', source: 'optional-sixth-level' },
  }));
}

function currentArea() {
  return state()?.current ?? null;
}

function areaCoverageNote(area) {
  if (area === 'Lenguas Adicionales') {
    return 'La base de contenidos priorizados de Lenguas Adicionales es la misma con 5 o 6 niveles: el 6.º nivel no suma ni duplica contenidos, sólo permite redistribuirlos.';
  }
  return 'La cobertura curricular requerida es la misma con 5 o 6 niveles: el 6.º nivel no suma ni duplica contenidos.';
}

function enhanceOverview() {
  const current = state();
  if (!current) return;
  document.querySelectorAll('.area-card[data-area]').forEach((card) => {
    const area = card.dataset.area;
    if (!OPTIONAL_AREAS.has(area)) return;
    const badge = card.querySelector('.pill');
    if (badge) badge.textContent = '5/6 niveles anuales';
  });
}

function enhanceBoard() {
  const current = state();
  const area = currentArea();
  const groupsHost = document.getElementById('groups');
  if (!current || !groupsHost || !OPTIONAL_AREAS.has(area)) return;

  const groups = current.areas?.[area]?.groups ?? [];
  if (groupsHost.querySelector('[data-optional-sixth-control]')) return;

  const control = document.createElement('div');
  control.dataset.optionalSixthControl = '1';
  control.className = 'tech-rule-note optional-sixth-control';

  if (groups.length >= 6) {
    control.innerHTML = `<div class="optional-sixth-topline"><strong>6.º nivel activo</strong><span class="optional-sixth-status">C11–C12</span></div><div class="optional-sixth-detail">${areaCoverageNote(area)}</div>`;
  } else {
    control.innerHTML = `<div class="optional-sixth-topline"><strong>Si la escuela tiene especialidad</strong><button class="button accent optional-sixth-button" type="button" data-add-sixth-level>＋ 6.º nivel</button></div><div class="optional-sixth-detail">C11–C12 están libres y se habilitan sólo cuando corresponda.</div>`;
    control.querySelector('[data-add-sixth-level]')?.addEventListener('click', () => {
      const latest = state();
      if (!latest || !OPTIONAL_AREAS.has(area)) return;
      addOptionalSixthLevel(latest, area);
      persist(latest);
      window.PCIApp?.refresh?.();
    });
  }

  groupsHost.prepend(control);
}

function enhance() {
  enhanceOverview();
  enhanceBoard();
}

function queueEnhance() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    enhance();
  });
}

const observer = new MutationObserver(queueEnhance);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener('DOMContentLoaded', queueEnhance);
window.addEventListener('pci-state-change', queueEnhance);
setTimeout(queueEnhance, 0);
