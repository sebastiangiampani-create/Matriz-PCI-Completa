const COMMON_DESCRIPTIONS = {
  trunk: 'Cada nivel ocupa un año. Elegí los contenidos de la bolsa curricular y arrastralos al nivel correspondiente.',
  laboratory: 'Cada laboratorio dura un cuatrimestre. Definí el contexto problematizador y su ubicación temporal. Elegí los contenidos de la bolsa curricular y arrastralos al laboratorio.',
  workshop: 'Cada taller dura un cuatrimestre. Definí la práctica / producto / eje y su ubicación temporal. Elegí los contenidos de la bolsa curricular y arrastralos al taller.',
  other: 'Definí el formato pedagógico, su duración y su ubicación temporal. Elegí los contenidos de la bolsa curricular y arrastralos al espacio.',
};

const TECHNICAL_DESCRIPTIONS = {
  trunk: 'Cada nivel ocupa un año. Elegí los contenidos de la bolsa curricular y arrastralos al nivel correspondiente.',
  integration: 'Cada Espacio de Integración dura un período. Definí el contexto problematizador y su ubicación temporal. Elegí los contenidos de la bolsa curricular y arrastralos al espacio.',
  formative: 'Cada Espacio Formativo dura un período. Definí la práctica / producto / eje y su ubicación temporal. Elegí los contenidos de la bolsa curricular y arrastralos al espacio.',
  'technical-workshop': 'Cada taller ocupa un año en su nivel. Definí la práctica / producto / eje. Elegí los contenidos de la bolsa curricular y arrastralos al taller.',
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
