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

function enhanceOverview() {
  const current = state();
  if (!current) return;
  document.querySelectorAll('.area-card[data-area]').forEach((card) => {
    const area = card.dataset.area;
    if (!OPTIONAL_AREAS.has(area)) return;
    const groups = current.areas?.[area]?.groups ?? [];
    const description = card.querySelector('p');
    if (description) {
      description.textContent = groups.length === 6
        ? '6 niveles anuales. El 6.º nivel fue incorporado según la especialidad; la cobertura curricular requerida es la misma.'
        : '5 niveles anuales. Puede agregarse un 6.º nivel cuando la especialidad lo requiera, sin modificar la cobertura curricular exigida.';
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
      ? 'Este agrupamiento tiene 6 niveles anuales por requerimiento de la especialidad. La cobertura curricular es la misma que en la estructura de 5 niveles.'
      : 'Este agrupamiento tiene 5 niveles anuales. Si la especialidad lo requiere, puede incorporarse un 6.º nivel sin aumentar ni modificar la cobertura curricular exigida.';
  }

  if (groupsHost.querySelector('[data-optional-sixth-control]')) return;
  const control = document.createElement('div');
  control.dataset.optionalSixthControl = '1';
  control.className = 'tech-rule-note';
  control.style.display = 'flex';
  control.style.alignItems = 'center';
  control.style.justifyContent = 'space-between';
  control.style.gap = '12px';
  control.style.flexWrap = 'wrap';

  if (groups.length >= 6) {
    control.innerHTML = '<div><strong>6.º nivel incorporado</strong><br><span>Se utiliza cuando la especialidad lo requiere. La cobertura curricular total no cambia.</span></div>';
  } else {
    control.innerHTML = '<div><strong>6.º nivel opcional según especialidad</strong><br><span>Al agregarlo, la cobertura curricular exigida sigue siendo exactamente la misma.</span></div><button class="button accent" type="button" data-add-sixth-level>＋ Agregar 6.º nivel</button>';
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
