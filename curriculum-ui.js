import { ART_AXES, artAxisForContent } from './curriculum-rules.js';
import { AREA_CONFIG, levelForTerm } from './pci-model.js';
import {
  ART_LANGUAGES,
  EF_NUCLEI,
  artLanguageForContent,
  evaluateArts,
  evaluatePhysicalEducation,
  isTutoriaContent,
} from './curriculum-rules.js';

const OTHER_AREA = 'Otros formatos pedagógicos';
const TUTORIA_LEVELS = new Set([1, 2]);
let tutorData = [];
let observer = null;
let refreshTimer = null;
let applying = false;

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

function state() {
  return window.PCIApp?.getState?.() ?? null;
}

function data() {
  return window.PCIApp?.getData?.() ?? [];
}

function ensureRules() {
  const current = state();
  if (!current) return;
  current.curriculumRules ??= {};
  const valid = [...new Set(
    (Array.isArray(current.curriculumRules.artLanguages) ? current.curriculumRules.artLanguages : [])
      .filter((language) => ART_LANGUAGES.includes(language)),
  )].slice(0, 2);
  current.curriculumRules.artLanguages = valid;
}

function persistState() {
  const current = state();
  if (!current) return;
  localStorage.setItem('pciAppV2', JSON.stringify(current));
  window.app = current;
  window.dispatchEvent(new CustomEvent('pci-state-change', { detail: { schemaVersion: current.schemaVersion ?? 10 } }));
}

function toast(message) {
  const element = $('toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 2200);
}

function assignments() {
  const map = new Map();
  const current = state();
  if (!current) return map;
  for (const [area, areaState] of Object.entries(current.areas ?? {})) {
    for (const group of areaState.groups ?? []) {
      for (const id of group.items ?? []) {
        const list = map.get(String(id)) ?? [];
        list.push({ area, groupId: group.id, groupName: group.name });
        map.set(String(id), list);
      }
    }
  }
  return map;
}

function tutorIdsInGroup(group) {
  const ids = new Set(tutorData.map((content) => content.id));
  return (group?.items ?? []).filter((id) => ids.has(String(id)));
}

function updateOverviewCard(area, label, percent) {
  const card = document.querySelector(`.area-card[data-area="${CSS.escape(area)}"]`);
  if (!card) return;
  const text = card.querySelector('footer > div > strong');
  const bar = card.querySelector('.mini-progress span');
  if (text) text.textContent = label;
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function artsPercent(result) {
  const languageRatio = result.selectedLanguages.length / 2;
  const workshopRatio = result.totalWorkshops ? result.completeWorkshops / result.totalWorkshops : 0;
  return Math.round(Math.min(languageRatio, workshopRatio) * 100);
}

function efPercent(result) {
  const nucleiRatio = result.coveredNuclei.length / EF_NUCLEI.length;
  const workshopRatio = result.totalWorkshops ? result.completeWorkshops / result.totalWorkshops : 0;
  return Math.round(Math.min(nucleiRatio, workshopRatio) * 100);
}

function updateOverviewCoverage() {
  const current = state();
  const rows = data();
  if (!current || !rows.length) return;
  const arts = evaluateArts(current, rows);
  const ef = evaluatePhysicalEducation(current, rows);
  updateOverviewCard(
    'Artes',
    `Cumplimiento: ${arts.completeWorkshops}/${arts.totalWorkshops} talleres · ${arts.selectedLanguages.length}/2 lenguajes`,
    artsPercent(arts),
  );
  updateOverviewCard(
    'Educación Física',
    `Cumplimiento: ${ef.coveredNuclei.length}/5 núcleos · ${ef.completeWorkshops}/${ef.totalWorkshops} talleres`,
    efPercent(ef),
  );
}

function setPendingLabel(text) {
  const input = $('pendingFilter');
  const label = input?.closest('label');
  if (!input || !label) return;
  if (label.dataset.pciLabel === text) return;
  label.replaceChildren(input, document.createTextNode(` ${text}`));
  label.dataset.pciLabel = text;
}

function renderArtsRule() {
  const current = state();
  const rows = data();
  const alert = $('boardAlert');
  if (!current || !alert) return;
  const result = evaluateArts(current, rows);
  const selected = result.selectedLanguages;
  const missingWorkshops = result.workshops.filter((workshop) => !workshop.complete);
  const uncheckedDisabled = selected.length >= 2;

  alert.hidden = false;
  alert.className = `notice ${result.complete ? 'success' : 'warning'}`;
  alert.innerHTML = `
    <strong>Regla curricular de Artes</strong>
    <p style="margin:.45rem 0 .7rem">Elegí exactamente dos lenguajes. La cobertura se calcula solo sobre esos dos y cada taller debe incluir, como mínimo, contenidos de Producción, Apreciación y Contextualización.</p>
    <div style="display:flex;flex-wrap:wrap;gap:.6rem 1rem;margin:.4rem 0 .7rem">
      ${ART_LANGUAGES.map((language) => {
        const checked = selected.includes(language);
        return `<label class="check-row"><input type="checkbox" data-pci-art-language="${escapeHtml(language)}" ${checked ? 'checked' : ''} ${!checked && uncheckedDisabled ? 'disabled' : ''}> ${escapeHtml(language)}</label>`;
      }).join('')}
    </div>
    <p style="margin:.35rem 0"><strong>${result.completeWorkshops}/${result.totalWorkshops} talleres</strong> cumplen los tres ejes.</p>
    ${result.unselectedAssignments.length ? `<p style="margin:.35rem 0">⚠ Hay ${result.unselectedAssignments.length} contenido${result.unselectedAssignments.length === 1 ? '' : 's'} de un lenguaje no seleccionado; no cuentan para la cobertura.</p>` : ''}
    ${missingWorkshops.length ? `<p style="margin:.35rem 0">Revisar: ${missingWorkshops.map((workshop) => `${escapeHtml(workshop.groupName)} (${workshop.missingAxes.length ? `falta ${workshop.missingAxes.map(escapeHtml).join(', ')}` : 'contiene un lenguaje no seleccionado'})`).join(' · ')}</p>` : ''}
  `;

  alert.querySelectorAll('[data-pci-art-language]').forEach((input) => {
    input.addEventListener('change', () => {
      const language = input.dataset.pciArtLanguage;
      const currentRules = state().curriculumRules;
      const next = new Set(currentRules.artLanguages ?? []);
      if (input.checked) {
        if (next.size >= 2) {
          input.checked = false;
          toast('Artes permite elegir exactamente dos lenguajes.');
          return;
        }
        next.add(language);
      } else {
        next.delete(language);
      }
      currentRules.artLanguages = [...next];
      persistState();
      scheduleRefresh();
    });
  });

  const label = $('coverageLabel');
  const hint = $('coverageHint');
  const bar = $('coverageBar');
  if (label) label.textContent = `Cumplimiento: ${result.completeWorkshops}/${result.totalWorkshops} talleres · ${selected.length}/2 lenguajes`;
  if (hint) hint.textContent = 'No se exige ubicar todos los contenidos: se validan los dos lenguajes elegidos y los tres ejes dentro de cada taller.';
  if (bar) bar.style.width = `${artsPercent(result)}%`;
  setPendingLabel('Mostrar solo disponibles sin ubicar');
}

function renderEfRule() {
  const current = state();
  const rows = data();
  const alert = $('boardAlert');
  if (!current || !alert) return;
  const result = evaluatePhysicalEducation(current, rows);
  const missingWorkshops = result.workshops.filter((workshop) => !workshop.complete);

  alert.hidden = false;
  alert.className = `notice ${result.complete ? 'success' : 'warning'}`;
  alert.innerHTML = `
    <strong>Regla curricular de Educación Física</strong>
    <p style="margin:.45rem 0 .7rem">Cada taller debe abordar al menos uno de los cinco núcleos obligatorios y, entre todos los talleres, los cinco deben aparecer por lo menos una vez.</p>
    <div style="display:flex;flex-wrap:wrap;gap:.45rem;margin:.4rem 0 .7rem">
      ${EF_NUCLEI.map((nucleus) => `<span class="pill">${result.coveredNuclei.some((item) => item.id === nucleus.id) ? '✓' : '⚠'} ${escapeHtml(nucleus.label)}</span>`).join('')}
    </div>
    <p style="margin:.35rem 0"><strong>${result.completeWorkshops}/${result.totalWorkshops} talleres</strong> tienen al menos un núcleo obligatorio.</p>
    ${result.missingNuclei.length ? `<p style="margin:.35rem 0">Faltan núcleos: ${result.missingNuclei.map((nucleus) => escapeHtml(nucleus.label)).join(' · ')}</p>` : ''}
    ${missingWorkshops.length ? `<p style="margin:.35rem 0">Talleres sin núcleo obligatorio: ${missingWorkshops.map((workshop) => escapeHtml(workshop.groupName)).join(' · ')}</p>` : ''}
    <p style="margin:.35rem 0">Las experiencias en el ambiente natural son optativas para este cálculo y no reemplazan ninguno de los cinco núcleos.</p>
  `;

  const label = $('coverageLabel');
  const hint = $('coverageHint');
  const bar = $('coverageBar');
  if (label) label.textContent = `Cumplimiento: ${result.coveredNuclei.length}/5 núcleos · ${result.completeWorkshops}/${result.totalWorkshops} talleres`;
  if (hint) hint.textContent = 'No se exige realizar todos los deportes o contenidos disponibles; la validación se hace por núcleos.';
  if (bar) bar.style.width = `${efPercent(result)}%`;
  setPendingLabel('Mostrar solo disponibles sin ubicar');
}

function resetBoardSpecials() {
  setPendingLabel('Mostrar solo pendientes');
}

function markOptionalContentItems() {
  const current = state();
  if (!current || !['Artes', 'Educación Física'].includes(current.current)) return;
  document.querySelectorAll('#contentList .content-location.pending-text').forEach((element) => {
    element.textContent = 'Disponible';
  });
}

function filterArtsBag() {
  const current = state();
  if (!current || current.current !== 'Artes') return;
  const selected = current.curriculumRules?.artLanguages ?? [];
  if (selected.length !== 2) return;
  const byId = new Map(data().map((content) => [String(content.id), content]));
  document.querySelectorAll('#contentList .content-item').forEach((item) => {
    const content = byId.get(String(item.dataset.contentId));
    const language = artLanguageForContent(content);
    item.hidden = Boolean(language && !selected.includes(language));
  });
  const subjectFilter = $('subjectFilter');
  subjectFilter?.querySelectorAll('option').forEach((option) => {
    if (!option.value) return;
    const language = artLanguageForContent({ subject: option.value, axis: '' });
    if (language) option.disabled = !selected.includes(language);
  });
}

function ensureTutorFilterOptions() {
  const subjectFilter = $('subjectFilter');
  const axisFilter = $('axisFilter');
  if (!subjectFilter || !axisFilter) return;
  if (!subjectFilter.querySelector('option[value="Tutoría"]')) {
    subjectFilter.insertAdjacentHTML('beforeend', '<option value="Tutoría">Tutoría</option>');
  }
  const existing = new Set([...axisFilter.options].map((option) => option.value));
  [...new Set(tutorData.map((content) => content.axis).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'))
    .forEach((axis) => {
      if (existing.has(axis)) return;
      const option = document.createElement('option');
      option.value = axis;
      option.textContent = axis;
      axisFilter.append(option);
    });
}

function tutorVisibleRows() {
  const query = $('contentSearch')?.value.trim().toLocaleLowerCase('es') ?? '';
  const subject = $('subjectFilter')?.value ?? '';
  const axis = $('axisFilter')?.value ?? '';
  const pendingOnly = Boolean($('pendingFilter')?.checked);
  const map = assignments();
  return tutorData.filter((content) => {
    const haystack = `${content.subject} ${content.axis} ${content.text}`.toLocaleLowerCase('es');
    const locations = map.get(content.id) ?? [];
    return (!query || haystack.includes(query))
      && (!subject || subject === 'Tutoría')
      && (!axis || content.axis === axis)
      && (!pendingOnly || !locations.length);
  });
}

function selectedOtherGroup() {
  const groupId = document.querySelector('.group-card.selected')?.dataset.groupId;
  const current = state();
  if (!groupId || !current) return null;
  const group = current.areas?.[OTHER_AREA]?.groups?.find((candidate) => candidate.id === groupId);
  return group ? { groupId, group } : null;
}

function assignTutorContent(contentId) {
  const selected = selectedOtherGroup();
  if (!selected) {
    toast('Elegí primero un formato pedagógico de destino.');
    return;
  }
  if (!TUTORIA_LEVELS.has(Number(selected.group.level))) {
    toast('Tutoría solo puede ubicarse en Nivel 1 o Nivel 2 (C1–C4).');
    return;
  }
  if (selected.group.items.includes(contentId)) {
    toast('Ese contenido ya está en el espacio seleccionado.');
    return;
  }
  selected.group.items.push(contentId);
  persistState();
  window.PCIApp.openArea(OTHER_AREA, selected.groupId);
  toast('Contenido de Tutoría ubicado.');
}

function renderTutorBag() {
  const current = state();
  if (!current || current.current !== OTHER_AREA) return;
  ensureTutorFilterOptions();
  const list = $('contentList');
  if (!list) return;
  list.querySelectorAll('.pci-tutoria-item').forEach((item) => item.remove());
  const visible = tutorVisibleRows();
  const map = assignments();
  if (visible.length && list.querySelector('.empty-state')) list.querySelector('.empty-state').remove();

  const html = visible.map((content) => {
    const locations = map.get(content.id) ?? [];
    const selected = selectedOtherGroup();
    const alreadyHere = Boolean(selected?.group.items.includes(content.id));
    return `
      <article class="content-item pci-tutoria-item ${locations.length ? 'assigned' : ''}" data-content-id="${escapeHtml(content.id)}">
        <div style="width:100%">
          <small>Tutoría · ${escapeHtml(content.axis || 'Sin eje / bloque')}</small>
          <p>${escapeHtml(content.text)}</p>
          <span class="content-location ${locations.length ? '' : 'pending-text'}">${locations.length ? `En ${escapeHtml(locations.map((location) => location.groupName).join(' · '))}` : 'Disponible'}</span>
          <div style="margin-top:.55rem"><button class="button secondary" type="button" data-pci-assign-tutor="${escapeHtml(content.id)}" ${alreadyHere ? 'disabled' : ''}>${alreadyHere ? 'Ya está en este espacio' : 'Asignar a este espacio'}</button></div>
        </div>
      </article>`;
  }).join('');
  list.insertAdjacentHTML('beforeend', html);

  list.querySelectorAll('[data-pci-assign-tutor]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      assignTutorContent(button.dataset.pciAssignTutor);
    });
  });

  const source = [...data().filter((content) => content.area === 'Tecnologías'), ...tutorData];
  const query = $('contentSearch')?.value.trim().toLocaleLowerCase('es') ?? '';
  const subject = $('subjectFilter')?.value ?? '';
  const axis = $('axisFilter')?.value ?? '';
  const pendingOnly = Boolean($('pendingFilter')?.checked);
  const visibleCombined = source.filter((content) => {
    const haystack = `${content.subject} ${content.axis} ${content.text}`.toLocaleLowerCase('es');
    const locations = map.get(String(content.id)) ?? [];
    return (!query || haystack.includes(query))
      && (!subject || content.subject === subject)
      && (!axis || content.axis === axis)
      && (!pendingOnly || !locations.length);
  }).length;
  const pending = source.filter((content) => !(map.get(String(content.id))?.length)).length;
  if ($('bagMeta')) $('bagMeta').textContent = `${visibleCombined} visibles · ${pending} pendientes`;
  if ($('coverageHint')) $('coverageHint').textContent = 'Otros formatos incorpora también Tutoría. Sus contenidos pueden ubicarse únicamente en Nivel 1 y Nivel 2 (C1–C4).';
}

function renderTutorPlacementWarning() {
  const current = state();
  const alert = $('boardAlert');
  if (!current || current.current !== OTHER_AREA || !alert) return;
  const invalid = (current.areas?.[OTHER_AREA]?.groups ?? []).filter(
    (group) => tutorIdsInGroup(group).length && !TUTORIA_LEVELS.has(Number(group.level)),
  );
  if (!invalid.length) return;
  alert.hidden = false;
  alert.className = 'notice warning';
  alert.innerHTML = `<strong>Revisá Tutoría:</strong> ${invalid.map((group) => `${escapeHtml(group.name)} tiene contenidos de Tutoría fuera de Nivel 1/2.`).join(' ')}`;
}

function applyCurrentAreaRules() {
  const current = state();
  if (!current) return;
  if (current.current === 'Artes') {
    renderArtsRule();
    filterArtsBag();
    markOptionalContentItems();
    return;
  }
  if (current.current === 'Educación Física') {
    renderEfRule();
    markOptionalContentItems();
    return;
  }
  resetBoardSpecials();
  if (current.current === OTHER_AREA) {
    renderTutorBag();
    renderTutorPlacementWarning();
  }
}

function refresh() {
  if (applying || !window.PCIApp?.getState || !data().length) return;
  applying = true;
  observer?.disconnect();
  try {
    ensureRules();
    updateOverviewCoverage();
    applyCurrentAreaRules();
  } finally {
    applying = false;
    observer?.observe(document.body, { childList: true, subtree: true });
  }
}

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, 30);
}

async function waitForApp() {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (window.PCIApp?.getData?.().length && !$('loading')) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('La matriz no terminó de iniciar para cargar las reglas curriculares.');
}

async function start() {
  const response = await fetch('data/tutoria.json?v=20260810-1');
  if (!response.ok) throw new Error('No se pudieron cargar los contenidos de Tutoría.');
  tutorData = await response.json();
  await waitForApp();

  const existingIds = new Set(data().map((content) => String(content.id)));
  data().push(...tutorData.filter((content) => !existingIds.has(String(content.id))));
  ensureRules();
  persistState();

  observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('pci-state-change', scheduleRefresh);
  ['input', 'change'].forEach((eventName) => {
    ['contentSearch', 'subjectFilter', 'axisFilter', 'pendingFilter'].forEach((id) => {
      $(id)?.addEventListener(eventName, scheduleRefresh);
    });
  });

  if ($('overview')?.classList.contains('active')) window.PCIApp.openOverview();
  scheduleRefresh();
}

start().catch((error) => {
  console.error(error);
  toast(error.message);
});

// PCI_INTEGRATED_CURRICULUM_TUNING_V1: reglas visuales y pedagógicas heredadas.
(()=>{

const OTHER_AREA = 'Otros formatos pedagógicos';
const TECH_AREA = 'Tecnologías';
const TUTOR_AREA = 'Tutoría';
const ARTS_REQUIRED_TERMS = [1, 2, 3, 4, 7, 8];

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
      line-height: 1.45;
      white-space: pre-line;
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

function hasDifferentLanguagesAcrossWorkshops(workshops) {
  for (let left = 0; left < workshops.length; left += 1) {
    for (let right = left + 1; right < workshops.length; right += 1) {
      const leftLanguages = workshops[left].languages ?? [];
      const rightLanguages = workshops[right].languages ?? [];
      if (leftLanguages.some((first) => rightLanguages.some((second) => first !== second))) return true;
    }
  }
  return false;
}

function artsResult() {
  const current = state();
  const rows = data();
  if (!current) return null;
  const byId = new Map(rows.map((content) => [String(content.id), content]));
  const groups = current.areas?.Artes?.groups ?? [];
  const workshops = groups.map((group) => {
    const contents = (group.items ?? [])
      .map((id) => byId.get(String(id)))
      .filter(Boolean);
    const axes = new Set(contents.map(artAxisForContent).filter(Boolean));
    const languages = new Set(contents.map(artLanguageForContent).filter(Boolean));
    const missingAxes = ART_AXES.filter((axis) => !axes.has(axis));
    return {
      group,
      languages: [...languages],
      missingAxes,
      complete: missingAxes.length === 0,
    };
  });

  const termRules = ARTS_REQUIRED_TERMS.map((term) => {
    const termWorkshops = workshops.filter((item) => Number(item.group.startTerm) === term);
    const workshopsWithLanguage = termWorkshops.filter((item) => item.languages.length > 0);
    const languages = [...new Set(termWorkshops.flatMap((item) => item.languages))];
    const differentLanguages = hasDifferentLanguagesAcrossWorkshops(workshopsWithLanguage);
    return {
      term,
      workshops: termWorkshops,
      workshopCount: termWorkshops.length,
      workshopsWithLanguage: workshopsWithLanguage.length,
      languages,
      differentLanguages,
      complete: termWorkshops.length >= 2
        && workshopsWithLanguage.length >= 2
        && differentLanguages,
    };
  });

  const completeWorkshops = workshops.filter((item) => item.complete).length;
  const completeTerms = termRules.filter((item) => item.complete).length;
  return {
    workshops,
    completeWorkshops,
    totalWorkshops: workshops.length,
    termRules,
    completeTerms,
    totalRequiredTerms: ARTS_REQUIRED_TERMS.length,
    complete: workshops.length > 0
      && completeWorkshops === workshops.length
      && completeTerms === ARTS_REQUIRED_TERMS.length,
  };
}

function artsTermStatus(rule) {
  const languageText = rule.languages.length ? rule.languages.join(' + ') : 'sin lenguaje identificado';
  if (rule.complete) return `C${rule.term} ✓ ${rule.workshopCount} talleres · ${languageText}`;
  if (rule.workshopCount < 2) {
    return `C${rule.term} ⚠ ${rule.workshopCount}/2 talleres · ${languageText}`;
  }
  if (rule.workshopsWithLanguage < 2) {
    return `C${rule.term} ⚠ faltan contenidos para identificar el lenguaje en al menos 2 talleres`;
  }
  return `C${rule.term} ⚠ los talleres deben incluir contenidos de al menos 2 lenguajes diferentes · ${languageText}`;
}

function updateArts() {
  const current = state();
  const result = artsResult();
  if (!current || !result) return;

  const axesRatio = result.totalWorkshops ? result.completeWorkshops / result.totalWorkshops : 0;
  const termsRatio = result.totalRequiredTerms ? result.completeTerms / result.totalRequiredTerms : 0;
  const percent = Math.round(Math.min(axesRatio, termsRatio) * 100);

  const card = document.querySelector('.area-card[data-area="Artes"]');
  const footer = card?.querySelector('footer > div > strong');
  overrideText(
    footer,
    `Cumplimiento: ${result.completeTerms}/${result.totalRequiredTerms} cuatrimestres obligatorios · ${result.completeWorkshops}/${result.totalWorkshops} talleres con los 3 ejes`,
  );
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

  const missingAxes = result.workshops.filter((item) => !item.complete);
  const axesText = missingAxes.length
    ? `\nEjes a revisar: ${missingAxes.map((item) => `${item.group.name} (falta ${item.missingAxes.join(', ')})`).join(' · ')}`
    : '\nEjes: todos los talleres incluyen Producción, Apreciación y Contextualización.';
  const termText = result.termRules.map(artsTermStatus).join('\n');

  const alert = $('boardAlert');
  if (alert) {
    alert.hidden = false;
    alert.className = `notice ${result.complete ? 'success' : 'warning'}`;
    alert.dataset.pciArtsRule = '1';
    alert.dataset.pciArtsSummary = `En C1, C2, C3, C4, C7 y C8 debe haber al menos 2 talleres de Artes con contenidos de lenguajes artísticos diferentes. C5, C6, C9 y C10 no tienen esta exigencia. Cada taller debe incluir Producción, Apreciación y Contextualización.\n${termText}${axesText}`;
  }

  overrideText(
    $('coverageLabel'),
    `Cumplimiento: ${result.completeTerms}/${result.totalRequiredTerms} cuatrimestres obligatorios · ${result.completeWorkshops}/${result.totalWorkshops} talleres con los 3 ejes`,
  );
  overrideText(
    $('coverageHint'),
    'Artes exige 2 talleres con lenguajes diferentes en C1, C2, C3, C4, C7 y C8. Además, cada taller debe cubrir Producción, Apreciación y Contextualización.',
  );
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

})();
