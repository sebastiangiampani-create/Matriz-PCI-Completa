import { ART_AXES, artAxisForContent } from './curriculum-rules.js';
import { AREA_CONFIG, levelForTerm } from './pci-model.js';

const OTHER_AREA = 'Otros formatos pedagógicos';
const TECH_AREA = 'Tecnologías';
const TUTOR_AREA = 'Tutoría';

let observer = null;
let refreshTimer = null;
let structureApplied = false;

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
    .matrix-header { position: static !important; top: auto !important; }

    .pci-tutoria-item { grid-template-columns: minmax(0, 1fr) !important; cursor: default; }
    .pci-tutoria-item > div { min-width: 0; width: 100%; }
    .pci-tutoria-item p { overflow-wrap: break-word; word-break: normal; }

    [data-pci-override-text] { font-size: 0 !important; }
    [data-pci-override-text]::after {
      content: attr(data-pci-override-text);
      font-size: .82rem;
      line-height: 1.4;
    }

    .area-card[data-pci-tech-eight="1"] .pill { font-size: 0 !important; }
    .area-card[data-pci-tech-eight="1"] .pill::after {
      content: '8 talleres';
      font-size: .68rem;
    }

    #boardAlert[data-pci-arts-rule="1"] > * { display: none !important; }
    #boardAlert[data-pci-arts-rule="1"]::before {
      content: 'Regla curricular de Artes';
      display: block;
      font-weight: 900;
      font-size: .84rem;
      margin-bottom: 4px;
    }
    #boardAlert[data-pci-arts-rule="1"]::after {
      content: attr(data-pci-arts-summary);
      display: block;
      font-size: .8rem;
      line-height: 1.4;
      white-space: normal;
    }

    #boardAlert[data-pci-compact-rule="ef"] {
      padding: 9px 12px;
      border-radius: 12px;
      background: #f8fbfb;
      box-shadow: none;
      font-size: .8rem;
      line-height: 1.35;
    }
    #boardAlert[data-pci-compact-rule="ef"] > p:first-of-type,
    #boardAlert[data-pci-compact-rule="ef"] > p:last-of-type { display: none; }
    #boardAlert[data-pci-compact-rule="ef"] .pill { padding: 3px 7px; font-size: .68rem; }
    #boardAlert[data-pci-compact-rule="ef"] p { margin: .25rem 0 !important; }
    #boardAlert[data-pci-compact-rule="ef"].success { display: none; }
  `;
  document.head.appendChild(style);
}

function persistCurrent(current) {
  localStorage.setItem('pciAppV2', JSON.stringify(current));
  window.app = current;
  window.dispatchEvent(new CustomEvent('pci-state-change', { detail: { schemaVersion: current.schemaVersion ?? 10 } }));
}

function ensureStructuralRules() {
  const current = state();
  const rows = data();
  if (!current || !rows.length) return;

  AREA_CONFIG[TECH_AREA].count = 8;
  AREA_CONFIG[OTHER_AREA].sourceArea = OTHER_AREA;

  let changed = false;
  const techGroups = current.areas?.[TECH_AREA]?.groups ?? [];
  while (techGroups.length < 8) {
    const index = techGroups.length;
    const term = index + 1;
    techGroups.push({
      id: `tecnologias-workshop-${index + 1}`,
      kind: 'workshop',
      name: `Taller ${index + 1}`,
      objective: '',
      synopsis: '',
      context: '',
      practiceAxis: '',
      formatType: '',
      duration: 'quarterly',
      level: levelForTerm(term),
      startTerm: term,
      endTerm: term,
      type: 'Obligatorio',
      custom: false,
      elective: false,
      items: [],
    });
    changed = true;
  }

  current.curriculumRules ??= {};
  if ((current.curriculumRules.artLanguages ?? []).length) {
    current.curriculumRules.artLanguages = [];
    changed = true;
  }

  const techIds = new Set(rows.filter((content) => content.area === TECH_AREA).map((content) => String(content.id)));
  for (const group of current.areas?.[OTHER_AREA]?.groups ?? []) {
    const before = (group.items ?? []).length;
    group.items = (group.items ?? []).filter((id) => !techIds.has(String(id)));
    if (group.items.length !== before) changed = true;
  }

  if (changed) persistCurrent(current);
  structureApplied = true;
}

function overrideText(element, text) {
  if (!element) return;
  element.dataset.pciOverrideText = text;
}

function clearOverride(element) {
  if (element) delete element.dataset.pciOverrideText;
}

function artsResult() {
  const current = state();
  const rows = data();
  if (!current) return null;
  const byId = new Map(rows.map((content) => [String(content.id), content]));
  const groups = current.areas?.Artes?.groups ?? [];
  const workshops = groups.map((group) => {
    const axes = new Set(
      (group.items ?? [])
        .map((id) => byId.get(String(id)))
        .filter(Boolean)
        .map(artAxisForContent)
        .filter(Boolean),
    );
    const missingAxes = ART_AXES.filter((axis) => !axes.has(axis));
    return { group, missingAxes, complete: missingAxes.length === 0 };
  });
  return {
    workshops,
    completeWorkshops: workshops.filter((item) => item.complete).length,
    totalWorkshops: workshops.length,
  };
}

function updateArts() {
  const current = state();
  const result = artsResult();
  if (!current || !result) return;

  const card = document.querySelector('.area-card[data-area="Artes"]');
  const footer = card?.querySelector('footer > div > strong');
  const percent = result.totalWorkshops ? Math.round((result.completeWorkshops / result.totalWorkshops) * 100) : 0;
  overrideText(footer, `Cumplimiento: ${result.completeWorkshops}/${result.totalWorkshops} talleres con los 3 ejes`);
  const miniBar = card?.querySelector('.mini-progress span');
  if (miniBar) miniBar.style.width = `${percent}%`;

  if (current.current !== 'Artes') {
    const alert = $('boardAlert');
    if (alert) {
      delete alert.dataset.pciArtsRule;
      delete alert.dataset.pciArtsSummary;
    }
    return;
  }

  document.querySelectorAll('#contentList .content-item').forEach((item) => { item.hidden = false; });
  $('subjectFilter')?.querySelectorAll('option').forEach((option) => { option.disabled = false; });

  const missing = result.workshops.filter((item) => !item.complete);
  const missingText = missing.length
    ? ` Revisar: ${missing.map((item) => `${item.group.name}: falta ${item.missingAxes.join(', ')}`).join(' · ')}.`
    : '';
  const alert = $('boardAlert');
  if (alert) {
    alert.hidden = false;
    alert.dataset.pciArtsRule = '1';
    alert.dataset.pciArtsSummary = `Cada taller debe incluir Producción, Apreciación y Contextualización. No se seleccionan lenguajes. Cumplimiento: ${result.completeWorkshops}/${result.totalWorkshops} talleres.${missingText}`;
  }

  overrideText($('coverageLabel'), `Cumplimiento: ${result.completeWorkshops}/${result.totalWorkshops} talleres con los 3 ejes`);
  overrideText($('coverageHint'), 'La cobertura de Artes se valida únicamente por los tres ejes en cada taller: Producción, Apreciación y Contextualización.');
  const bar = $('coverageBar');
  if (bar) bar.style.width = `${percent}%`;
}

function tutorStats() {
  const current = state();
  if (!current) return { total: 0, assigned: 0, pending: 0 };
  const tutorRows = data().filter((content) => content.area === TUTOR_AREA);
  const tutorIds = new Set(tutorRows.map((content) => String(content.id)));
  const assigned = new Set();
  for (const group of current.areas?.[OTHER_AREA]?.groups ?? []) {
    for (const id of group.items ?? []) if (tutorIds.has(String(id))) assigned.add(String(id));
  }
  return { total: tutorRows.length, assigned: assigned.size, pending: tutorRows.length - assigned.size };
}

function updateTechnologyAndOther() {
  const current = state();
  if (!current) return;

  const techCard = document.querySelector('.area-card[data-area="Tecnologías"]');
  if (techCard) techCard.dataset.pciTechEight = '1';

  const otherCard = document.querySelector(`.area-card[data-area="${CSS.escape(OTHER_AREA)}"]`);
  const stats = tutorStats();
  if (otherCard) {
    const description = otherCard.querySelector('p');
    overrideText(description, 'Creá seminarios, proyectos o ateneos y vinculalos con contenidos de Tutoría. Pueden ser cuatrimestrales o anuales.');
    const footer = otherCard.querySelector('footer > div > strong');
    overrideText(footer, `Tutoría ${stats.assigned}/${stats.total} contenidos ubicados`);
    const miniBar = otherCard.querySelector('.mini-progress span');
    if (miniBar) miniBar.style.width = `${stats.total ? Math.round((stats.assigned / stats.total) * 100) : 0}%`;
  }

  if (current.current !== OTHER_AREA) return;

  overrideText($('boardDescription'), 'Creá seminarios, proyectos o ateneos con contenidos de Tutoría. Pueden ser cuatrimestrales o anuales.');
  overrideText($('coverageLabel'), `Tutoría: ${stats.assigned}/${stats.total} contenidos ubicados`);
  overrideText($('coverageHint'), 'En Otros formatos pedagógicos ya no se muestran contenidos de Tecnologías. Tutoría puede ubicarse únicamente en Nivel 1 y Nivel 2 (C1–C4).');
  overrideText($('bagMeta'), `Tutoría: ${stats.pending} contenidos pendientes de ubicar`);
  const bar = $('coverageBar');
  if (bar) bar.style.width = `${stats.total ? Math.round((stats.assigned / stats.total) * 100) : 0}%`;

  $('subjectFilter')?.querySelectorAll('option').forEach((option) => {
    if (option.value === TECH_AREA) option.hidden = true;
  });
}

function compactEfRule() {
  const current = state();
  const alert = $('boardAlert');
  if (!current || !alert) return;
  if (current.current === 'Educación Física') alert.dataset.pciCompactRule = 'ef';
  else delete alert.dataset.pciCompactRule;
}

function refresh() {
  if (!window.PCIApp?.getState || !data().length) return;
  ensureStyles();
  ensureStructuralRules();
  updateArts();
  updateTechnologyAndOther();
  compactEfRule();
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
  ensureStructuralRules();
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
