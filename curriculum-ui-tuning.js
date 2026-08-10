const OTHER_AREA = 'Otros formatos pedagógicos';
const TECH_AREA = 'Tecnologías';
const TUTOR_AREA = 'Tutoría';

let observer = null;
let refreshTimer = null;

const $ = (id) => document.getElementById(id);

function state() {
  return window.PCIApp?.getState?.() ?? null;
}

function data() {
  return window.PCIApp?.getData?.() ?? [];
}

function ensureStyles() {
  if (document.getElementById('curriculumUiTuningStyles')) return;
  const style = document.createElement('style');
  style.id = 'curriculumUiTuningStyles';
  style.textContent = `
    .pci-tutoria-item {
      grid-template-columns: minmax(0, 1fr) !important;
      cursor: default;
    }
    .pci-tutoria-item > div {
      min-width: 0;
      width: 100%;
    }
    .pci-tutoria-item p {
      overflow-wrap: break-word;
      word-break: normal;
    }

    .coverage-card[data-pci-other-coverage="1"] #coverageLabel,
    .coverage-card[data-pci-other-coverage="1"] #coverageHint,
    .coverage-card[data-pci-other-coverage="1"] .progress-track {
      display: none;
    }
    .coverage-card[data-pci-other-coverage="1"] > div:first-child {
      display: grid;
      gap: 4px;
      width: 100%;
    }
    .coverage-card[data-pci-other-coverage="1"] > div:first-child::before {
      content: attr(data-pci-tech-label);
      color: var(--ink, #15374a);
      font-weight: 900;
    }
    .coverage-card[data-pci-other-coverage="1"] > div:first-child::after {
      content: attr(data-pci-tutor-label);
      color: var(--ink-soft, #425c68);
      font-size: .82rem;
      font-weight: 750;
    }

    #bagMeta[data-pci-other-bag="1"] {
      font-size: 0;
    }
    #bagMeta[data-pci-other-bag="1"]::before,
    #bagMeta[data-pci-other-bag="1"]::after {
      display: block;
      font-size: .76rem;
      line-height: 1.35;
    }
    #bagMeta[data-pci-other-bag="1"]::before {
      content: attr(data-pci-tech-bag);
    }
    #bagMeta[data-pci-other-bag="1"]::after {
      content: attr(data-pci-tutor-bag);
      margin-top: 2px;
    }

    .area-card[data-pci-other-card="1"] footer > div > strong,
    .area-card[data-pci-other-card="1"] .mini-progress {
      display: none;
    }
    .area-card[data-pci-other-card="1"] footer > div::before {
      content: attr(data-pci-other-summary);
      display: block;
      color: var(--ink, #15374a);
      font-size: .82rem;
      font-weight: 850;
      line-height: 1.35;
    }

    #boardAlert[data-pci-compact-rule] {
      padding: 9px 12px;
      border-radius: 12px;
      background: #f8fbfb;
      box-shadow: none;
      font-size: .8rem;
      line-height: 1.35;
    }
    #boardAlert[data-pci-compact-rule] > strong {
      font-size: .82rem;
    }
    #boardAlert[data-pci-compact-rule] > p:first-of-type {
      display: none;
    }
    #boardAlert[data-pci-compact-rule="ef"] > p:last-of-type {
      display: none;
    }
    #boardAlert[data-pci-compact-rule] .check-row {
      font-size: .78rem;
    }
    #boardAlert[data-pci-compact-rule] .pill {
      padding: 3px 7px;
      font-size: .68rem;
    }
    #boardAlert[data-pci-compact-rule] p {
      margin: .25rem 0 !important;
    }
    #boardAlert[data-pci-compact-rule="ef"].success {
      display: none;
    }
  `;
  document.head.appendChild(style);
}

function assignmentMap(current) {
  const map = new Map();
  for (const areaState of Object.values(current?.areas ?? {})) {
    for (const group of areaState.groups ?? []) {
      for (const id of group.items ?? []) {
        const key = String(id);
        const locations = map.get(key) ?? [];
        locations.push(group.id);
        map.set(key, locations);
      }
    }
  }
  return map;
}

function countAssigned(ids, current, allowedAreas) {
  const assigned = new Set();
  for (const area of allowedAreas) {
    for (const group of current?.areas?.[area]?.groups ?? []) {
      for (const id of group.items ?? []) {
        const key = String(id);
        if (ids.has(key)) assigned.add(key);
      }
    }
  }
  return assigned.size;
}

function matchesFilters(content, map) {
  const query = $('contentSearch')?.value.trim().toLocaleLowerCase('es') ?? '';
  const subject = $('subjectFilter')?.value ?? '';
  const axis = $('axisFilter')?.value ?? '';
  const pendingOnly = Boolean($('pendingFilter')?.checked);
  const haystack = `${content.subject ?? ''} ${content.axis ?? ''} ${content.text ?? ''}`.toLocaleLowerCase('es');
  const locations = map.get(String(content.id)) ?? [];
  return (!query || haystack.includes(query))
    && (!subject || content.subject === subject)
    && (!axis || content.axis === axis)
    && (!pendingOnly || !locations.length);
}

function removeOtherMarkers() {
  const card = document.querySelector('.coverage-card');
  if (card) {
    delete card.dataset.pciOtherCoverage;
    const labels = card.querySelector(':scope > div:first-child');
    if (labels) {
      delete labels.dataset.pciTechLabel;
      delete labels.dataset.pciTutorLabel;
    }
  }
  const meta = $('bagMeta');
  if (meta) {
    delete meta.dataset.pciOtherBag;
    delete meta.dataset.pciTechBag;
    delete meta.dataset.pciTutorBag;
  }
}

function updateOtherCoverage() {
  const current = state();
  if (!current) return;

  const rows = data();
  const techRows = rows.filter((content) => content.area === TECH_AREA);
  const tutorRows = rows.filter((content) => content.area === TUTOR_AREA);
  const techIds = new Set(techRows.map((content) => String(content.id)));
  const tutorIds = new Set(tutorRows.map((content) => String(content.id)));

  const techAssigned = countAssigned(techIds, current, [TECH_AREA, OTHER_AREA]);
  const tutorAssigned = countAssigned(tutorIds, current, [OTHER_AREA]);

  const overviewCard = document.querySelector(`.area-card[data-area="${CSS.escape(OTHER_AREA)}"]`);
  if (overviewCard) {
    overviewCard.dataset.pciOtherCard = '1';
    const summary = overviewCard.querySelector('footer > div');
    if (summary) summary.dataset.pciOtherSummary = `Tecnologías ${techAssigned}/${techRows.length} · Tutoría ${tutorAssigned}/${tutorRows.length}`;
  }

  if (current.current !== OTHER_AREA) {
    removeOtherMarkers();
    return;
  }

  const coverage = document.querySelector('.coverage-card');
  if (coverage) {
    coverage.dataset.pciOtherCoverage = '1';
    const labels = coverage.querySelector(':scope > div:first-child');
    if (labels) {
      labels.dataset.pciTechLabel = `Tecnologías · ${techAssigned}/${techRows.length} contenidos utilizados · bolsa compartida con Talleres de Tecnologías`;
      labels.dataset.pciTutorLabel = `Tutoría · ${tutorAssigned}/${tutorRows.length} contenidos ubicados · solo Nivel 1 y Nivel 2 (C1–C4)`;
    }
  }

  const map = assignmentMap(current);
  const techVisible = techRows.filter((content) => matchesFilters(content, map)).length;
  const tutorVisible = tutorRows.filter((content) => matchesFilters(content, map)).length;
  const techPending = techRows.filter((content) => !(map.get(String(content.id))?.length)).length;
  const tutorPending = tutorRows.filter((content) => !(map.get(String(content.id))?.length)).length;
  const meta = $('bagMeta');
  if (meta) {
    meta.dataset.pciOtherBag = '1';
    meta.dataset.pciTechBag = `Tecnologías: ${techVisible} visibles · ${techPending} sin ubicar en Talleres/Otros`;
    meta.dataset.pciTutorBag = `Tutoría: ${tutorVisible} visibles · ${tutorPending} sin ubicar`;
  }
}

function compactRuleAlert() {
  const current = state();
  const alert = $('boardAlert');
  if (!current || !alert) return;
  if (current.current === 'Artes') alert.dataset.pciCompactRule = 'arts';
  else if (current.current === 'Educación Física') alert.dataset.pciCompactRule = 'ef';
  else delete alert.dataset.pciCompactRule;
}

function refresh() {
  if (!window.PCIApp?.getState || !data().length) return;
  ensureStyles();
  updateOtherCoverage();
  compactRuleAlert();
}

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, 45);
}

async function start() {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (window.PCIApp?.getData?.().length && !$('loading')) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  ensureStyles();
  observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('pci-state-change', scheduleRefresh);
  ['input', 'change'].forEach((eventName) => {
    ['contentSearch', 'subjectFilter', 'axisFilter', 'pendingFilter'].forEach((id) => {
      $(id)?.addEventListener(eventName, scheduleRefresh);
    });
  });
  scheduleRefresh();
}

start();
