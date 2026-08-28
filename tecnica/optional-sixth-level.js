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
    const groups = current.areas?.[area]?.groups ?? [];
    const badge = card.querySelector('.pill');
    const description = card.querySelector('p');

    if (badge) badge.textContent = '5/6 niveles anuales';
    if (description) {
      description.textContent = groups.length === 6
        ? `Nivel 6 activo en C11–C12. ${areaCoverageNote(area)}`
        : `La estructura base usa 5 niveles de C1 a C10; C11–C12 quedan libres para un 6.º nivel si la especialidad lo requiere. ${areaCoverageNote(area)}`;
    }
  });
}

function enhanceBoard() {
  const current = state();
  const area = currentArea();
  const groupsHost = document.getElementById('groups');
  if (!current || !groupsHost || !OPTIONAL_AREAS.has(area)) return;

  const groups = current.areas?.[area]?.groups ?? [];
  const boardDescription = document.getElementById('boardDescription');
  if (boardDescription) {
    boardDescription.textContent = groups.length === 6
      ? `Agrupamiento de 5/6 niveles: el Nivel 6 está activo en C11–C12. ${areaCoverageNote(area)}`
      : `Agrupamiento de 5/6 niveles: la estructura base llega hasta C10 y deja C11–C12 vacíos. ${areaCoverageNote(area)}`;
  }

  if (groupsHost.querySelector('[data-optional-sixth-control]')) return;
  const control = document.createElement('div');
  control.dataset.optionalSixthControl = '1';
  control.className = 'tech-rule-note optional-sixth-control';

  if (groups.length >= 6) {
    control.innerHTML = `<div><strong>6.º nivel activo · C11–C12</strong><br><span>${areaCoverageNote(area)}</span></div>`;
  } else {
    control.innerHTML = `<div><strong>6.º nivel opcional</strong><br><span>C11–C12 están libres. Se habilitan sólo si la especialidad lo requiere.</span></div><button class="button accent optional-sixth-button" type="button" data-add-sixth-level>＋ 6.º nivel</button>`;
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
