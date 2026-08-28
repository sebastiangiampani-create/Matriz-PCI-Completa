const COMMON_DESCRIPTIONS = {
  trunk: 'Cada nivel ocupa un año. Elegí y arrastrá contenidos desde la bolsa curricular.',
  laboratory: 'Dura un cuatrimestre. Definí el contexto problematizador y la ubicación temporal. Elegí y arrastrá contenidos desde la bolsa.',
  workshop: 'Dura un cuatrimestre. Definí la práctica / producto / eje y la ubicación temporal. Elegí y arrastrá contenidos desde la bolsa.',
  other: 'Definí el formato pedagógico, la duración y la ubicación temporal. Elegí y arrastrá contenidos desde la bolsa.',
};

const TECHNICAL_DESCRIPTIONS = {
  trunk: 'Cada nivel ocupa un año. Elegí y arrastrá contenidos desde la bolsa curricular.',
  integration: 'Dura un período. Definí el contexto problematizador y la ubicación temporal. Elegí y arrastrá contenidos desde la bolsa.',
  formative: 'Dura un período. Definí la práctica / producto / eje y la ubicación temporal. Elegí y arrastrá contenidos desde la bolsa.',
  'technical-workshop': 'Ocupa un año. Definí la práctica / producto / eje. Elegí y arrastrá contenidos desde la bolsa.',
};

const COMMON_KIND_BY_AREA = {
  'Lengua y Literatura': 'trunk',
  'Matemática': 'trunk',
  'Lenguas Adicionales': 'trunk',
  'Ciencias Sociales': 'laboratory',
  'Ciencias Naturales': 'laboratory',
  'Artes': 'workshop',
  'Tecnologías': 'workshop',
  'Educación Física': 'workshop',
  'Otros formatos pedagógicos': 'other',
};

const TECHNICAL_KIND_BY_AREA = {
  'Lengua y Literatura': 'trunk',
  'Matemática': 'trunk',
  'Lenguas Adicionales': 'trunk',
  'Ciencias Sociales': 'integration',
  'Ciencias Naturales': 'integration',
  'Educación Artística': 'formative',
  'Tecnología de la Representación': 'formative',
  'Educación Física': 'formative',
  'Talleres': 'technical-workshop',
};

let queued = false;

function state() {
  return window.PCIApp?.getState?.() ?? null;
}

function isTechnical() {
  return state()?.profile === 'tecnica' || /\/tecnica\//.test(window.location.pathname);
}

function descriptionFor(area) {
  const technical = isTechnical();
  const kindMap = technical ? TECHNICAL_KIND_BY_AREA : COMMON_KIND_BY_AREA;
  const descriptions = technical ? TECHNICAL_DESCRIPTIONS : COMMON_DESCRIPTIONS;
  return descriptions[kindMap[area]] ?? '';
}

function applyDescriptions() {
  document.querySelectorAll('.area-card[data-area]').forEach((card) => {
    const text = descriptionFor(card.dataset.area);
    const paragraph = card.querySelector('p');
    if (paragraph && text && paragraph.textContent !== text) paragraph.textContent = text;
  });

  const current = state()?.current;
  const boardDescription = document.getElementById('boardDescription');
  const text = current ? descriptionFor(current) : '';
  if (boardDescription && text && boardDescription.textContent !== text) boardDescription.textContent = text;
}

function queueApply() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    applyDescriptions();
  });
}

const observer = new MutationObserver(queueApply);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', queueApply);
window.addEventListener('pci-state-change', queueApply);
setTimeout(queueApply, 0);
