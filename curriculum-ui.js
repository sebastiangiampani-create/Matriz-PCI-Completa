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
