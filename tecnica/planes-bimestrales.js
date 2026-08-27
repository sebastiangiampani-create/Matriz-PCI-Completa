const STAGES = [
  ['punto_partida', 'Punto de partida'],
  ['indagacion', 'Indagación'],
  ['produccion', 'Producción'],
  ['evaluacion', 'Evaluación'],
];

const STORAGE_KEY = 'pciTecnicaV2';
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

let activeGroupId = null;
let previousBodyOverflow = '';

function state() {
  return window.PCIApp?.getState?.() ?? null;
}

function data() {
  return window.PCIApp?.getData?.() ?? [];
}

function findGroup(groupId) {
  const current = state();
  if (!current) return null;
  for (const [area, areaState] of Object.entries(current.areas ?? {})) {
    const group = (areaState.groups ?? []).find((item) => item.id === groupId);
    if (group) return { area, group };
  }
  return null;
}

function planCount(group) {
  if (group.kind === 'trunk' || group.kind === 'technical-workshop') return 4;
  return 2;
}

function kindLabel(group) {
  return ({
    trunk: 'Espacio troncal anual',
    integration: 'Espacio de Integración',
    formative: 'Espacio Formativo',
    'technical-workshop': 'Taller anual',
  })[group.kind] ?? 'Espacio curricular';
}

function blankStage() {
  return { description: '', duration: '', resources: '', activities: '' };
}

function defaultPlanName(group, number) {
  return group.kind === 'trunk' ? '' : `${group.name} ${number}`;
}

function blankPlan(group, number) {
  return {
    number,
    name: defaultPlanName(group, number),
    autoName: group.kind !== 'trunk',
    synopsis: '',
    contentIds: [],
    objectives: '',
    stages: Object.fromEntries(STAGES.map(([id]) => [id, blankStage()])),
    updatedAt: null,
  };
}

function ensurePlans(group) {
  const count = planCount(group);
  const existing = Array.isArray(group.plansBimestrales) ? group.plansBimestrales : [];
  group.plansBimestrales = Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const current = existing[index] ?? {};
    const stages = current.stages ?? {};
    const merged = {
      ...blankPlan(group, number),
      ...current,
      number,
      contentIds: Array.isArray(current.contentIds) ? current.contentIds.map(String) : [],
      stages: Object.fromEntries(STAGES.map(([id]) => [id, { ...blankStage(), ...(stages[id] ?? {}) }])),
    };
    if (group.kind !== 'trunk' && merged.autoName !== false) merged.name = defaultPlanName(group, number);
    return merged;
  });
  return group.plansBimestrales;
}

function persist() {
  const current = state();
  if (!current) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  window.app = current;
  window.dispatchEvent(new CustomEvent('pci-state-change', { detail: { source: 'planes-bimestrales-tecnica' } }));
}

function planStatus(plan) {
  const hasText = Boolean(plan.name || plan.synopsis || plan.objectives || plan.contentIds?.length);
  const stages = STAGES.map(([id]) => plan.stages?.[id] ?? {});
  const hasStageWork = stages.some((stage) => stage.description || stage.duration || stage.resources || stage.activities);
  const allActivities = stages.every((stage) => String(stage.activities ?? '').trim());
  if (!hasText && !hasStageWork) return 'Sin iniciar';
  if (allActivities && String(plan.objectives ?? '').trim() && (plan.contentIds?.length ?? 0) > 0) return 'Completo';
  return 'En elaboración';
}

function ensureStyles() {
  if (document.getElementById('pciTechnicalPlansStyles')) return;
  const style = document.createElement('style');
  style.id = 'pciTechnicalPlansStyles';
  style.textContent = `
    .pci-plan-entry{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px;padding:12px 14px;border:1px solid var(--line,#d6e2e5);border-radius:14px;background:#f7fbfb}
    .pci-plan-entry strong{display:block;font-size:.86rem}.pci-plan-entry small{display:block;margin-top:3px;color:var(--muted,#6a7b84)}
    .pci-plan-backdrop{position:fixed;inset:0;z-index:1900;display:grid;place-items:center;padding:18px;background:rgba(15,45,61,.48);backdrop-filter:blur(2px)}
    .pci-plan-backdrop[hidden]{display:none}.pci-plan-shell{width:min(1120px,100%);max-height:calc(100vh - 36px);overflow:auto;border:1px solid var(--line,#d6e2e5);border-radius:22px;background:#fff;box-shadow:0 26px 80px rgba(21,55,74,.32)}
    .pci-plan-top{position:sticky;top:0;z-index:5;display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:18px 20px;border-bottom:1px solid var(--line,#d6e2e5);background:#fff}
    .pci-plan-top h2{margin:3px 0 0;font-size:1.25rem}.pci-plan-kicker{color:#126e65;font-size:.72rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
    .pci-plan-body{padding:20px}.pci-plan-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pci-plan-card{padding:16px;border:1px solid var(--line,#d6e2e5);border-radius:16px;background:#fff}.pci-plan-card h3{margin:0 0 6px}.pci-plan-status{display:inline-flex;padding:5px 9px;border-radius:999px;background:#edf4f4;color:#365864;font-size:.72rem;font-weight:900}.pci-plan-card .button{margin-top:14px}
    .pci-plan-form{display:grid;gap:16px}.pci-plan-section{padding:16px;border:1px solid var(--line,#d6e2e5);border-radius:16px;background:#fff}.pci-plan-section h3{margin:0 0 12px}.pci-plan-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pci-plan-field{display:grid;gap:5px}.pci-plan-field.full{grid-column:1/-1}.pci-plan-field span{font-size:.78rem;font-weight:900}.pci-plan-field small{color:var(--muted,#6a7b84);line-height:1.35}.pci-plan-field input,.pci-plan-field textarea{width:100%;padding:10px 11px;border:1px solid var(--line,#d6e2e5);border-radius:11px;color:var(--ink,#15374a);font:inherit}.pci-plan-field textarea{min-height:92px;resize:vertical}.pci-plan-field textarea.activities{min-height:210px}.pci-plan-readonly{padding:10px 11px;border-radius:11px;background:#f3f7f7;color:#365864;font-weight:800}
    .pci-plan-contents{display:grid;gap:8px}.pci-plan-content{display:grid;grid-template-columns:auto 1fr;gap:9px;align-items:flex-start;padding:10px;border:1px solid var(--line,#d6e2e5);border-radius:11px}.pci-plan-content small{display:block;margin-bottom:3px;color:var(--muted,#6a7b84);font-weight:800}.pci-plan-content p{margin:0;line-height:1.4}.pci-stage{border:1px solid var(--line,#d6e2e5);border-radius:15px;overflow:hidden}.pci-stage summary{cursor:pointer;padding:14px 16px;background:#e7f8f5;font-weight:950}.pci-stage-body{display:grid;gap:12px;padding:15px}.pci-plan-actions{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:16px}.pci-plan-note{padding:10px 12px;border-radius:11px;background:#f7fbfb;color:var(--muted,#6a7b84);font-size:.8rem;line-height:1.4}
    @media(max-width:760px){.pci-plan-backdrop{padding:8px;align-items:end}.pci-plan-shell{max-height:94vh;border-radius:18px 18px 8px 8px}.pci-plan-grid,.pci-plan-fields{grid-template-columns:1fr}.pci-plan-top{padding:14px}.pci-plan-body{padding:14px}.pci-plan-field.full{grid-column:auto}.pci-plan-entry{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(style);
}

function ensureModal() {
  let backdrop = document.getElementById('pciPlansBackdrop');
  if (backdrop) return backdrop;
  ensureStyles();
  backdrop = document.createElement('div');
  backdrop.id = 'pciPlansBackdrop';
  backdrop.className = 'pci-plan-backdrop no-print';
  backdrop.hidden = true;
  backdrop.innerHTML = '<section id="pciPlansShell" class="pci-plan-shell" role="dialog" aria-modal="true" aria-labelledby="pciPlansTitle"></section>';
  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closePlans();
  });
  return backdrop;
}

function closePlans() {
  const backdrop = document.getElementById('pciPlansBackdrop');
  if (backdrop) backdrop.hidden = true;
  document.body.style.overflow = previousBodyOverflow;
  activeGroupId = null;
}

function contentRows(group, plan) {
  const rows = data();
  const available = (group.items ?? []).map((id) => rows.find((item) => String(item.id) === String(id))).filter(Boolean);
  if (!available.length) return '<div class="pci-plan-note">Este espacio todavía no tiene contenidos asignados. Primero asigná contenidos al espacio y después vas a poder seleccionarlos para cada plan.</div>';
  return `<div class="pci-plan-contents">${available.map((content) => {
    const checked = (plan.contentIds ?? []).includes(String(content.id));
    return `<label class="pci-plan-content"><input type="checkbox" data-plan-content="${escapeHtml(content.id)}" ${checked ? 'checked' : ''}><span><small>${escapeHtml(content.subject)} · ${escapeHtml(content.axis || 'Sin eje / bloque')}</small><p>${escapeHtml(content.text)}</p></span></label>`;
  }).join('')}</div>`;
}

function stageEditor(stageId, label, stage) {
  return `<details class="pci-stage" open>
    <summary>${escapeHtml(label)}</summary>
    <div class="pci-stage-body">
      <label class="pci-plan-field full"><span>¿Qué va a pasar en esta etapa? (opcional)</span><textarea data-stage="${stageId}" data-stage-field="description">${escapeHtml(stage.description)}</textarea></label>
      <label class="pci-plan-field"><span>Duración estimada</span><input data-stage="${stageId}" data-stage-field="duration" value="${escapeHtml(stage.duration)}" placeholder="Ej.: 2 clases"></label>
      <label class="pci-plan-field full"><span>Recursos</span><textarea data-stage="${stageId}" data-stage-field="resources">${escapeHtml(stage.resources)}</textarea></label>
      <label class="pci-plan-field full"><span>Actividades dirigidas al estudiante</span><textarea class="activities" data-stage="${stageId}" data-stage-field="activities">${escapeHtml(stage.activities)}</textarea></label>
    </div>
  </details>`;
}

function renderPlanList(area, group) {
  const shell = document.getElementById('pciPlansShell');
  const plans = ensurePlans(group);
  const note = plans.length === 4 ? 'Este espacio anual tiene 4 planes bimestrales.' : 'Este espacio tiene 2 planes bimestrales.';
  shell.innerHTML = `
    <div class="pci-plan-top"><div><div class="pci-plan-kicker">${escapeHtml(area)} · ${escapeHtml(kindLabel(group))}</div><h2 id="pciPlansTitle">Planes bimestrales · ${escapeHtml(group.name)}</h2></div><button class="button ghost" type="button" data-plans-close>Cerrar</button></div>
    <div class="pci-plan-body">
      <div class="pci-plan-note">${note}</div>
      <div class="pci-plan-grid" style="margin-top:14px">${plans.map((plan) => `<article class="pci-plan-card"><span class="pci-plan-status">${escapeHtml(planStatus(plan))}</span><h3 style="margin-top:10px">Plan ${plan.number}</h3><p style="margin:0;color:var(--muted,#6a7b84)">${escapeHtml(plan.name || `Bimestre ${plan.number}`)}</p><button class="button primary" type="button" data-open-plan="${plan.number}">Abrir plan</button></article>`).join('')}</div>
    </div>`;
  shell.querySelector('[data-plans-close]')?.addEventListener('click', closePlans);
  shell.querySelectorAll('[data-open-plan]').forEach((button) => button.addEventListener('click', () => renderPlanEditor(area, group, Number(button.dataset.openPlan))));
}

function renderPlanEditor(area, group, number) {
  const plans = ensurePlans(group);
  const plan = plans[number - 1];
  const shell = document.getElementById('pciPlansShell');
  shell.innerHTML = `
    <div class="pci-plan-top"><div><div class="pci-plan-kicker">${escapeHtml(area)} · ${escapeHtml(group.name)}</div><h2 id="pciPlansTitle">Plan bimestral ${number} de ${plans.length}</h2></div><button class="button ghost" type="button" data-plans-close>Cerrar</button></div>
    <div class="pci-plan-body"><form id="pciPlanForm" class="pci-plan-form">
      <section class="pci-plan-section"><h3>Datos generales</h3><div class="pci-plan-fields">
        <label class="pci-plan-field"><span>Tipo de espacio</span><div class="pci-plan-readonly">${escapeHtml(kindLabel(group))}</div></label>
        <label class="pci-plan-field"><span>Nombre del espacio</span><div class="pci-plan-readonly">${escapeHtml(group.name)}</div></label>
        <label class="pci-plan-field full"><span>Nombre del plan</span><input data-plan-field="name" value="${escapeHtml(plan.name)}" placeholder="${escapeHtml(group.kind === 'trunk' ? `Nombre del plan · bimestre ${number}` : defaultPlanName(group, number))}"></label>
        <label class="pci-plan-field"><span>Duración</span><div class="pci-plan-readonly">1 bimestre</div></label>
        <label class="pci-plan-field"><span>Ubicación</span><div class="pci-plan-readonly">Bimestre ${number} de ${plans.length}</div></label>
        <label class="pci-plan-field full"><span>Sinopsis</span><textarea data-plan-field="synopsis">${escapeHtml(plan.synopsis)}</textarea></label>
        <label class="pci-plan-field full"><span>Objetivos de aprendizaje</span><textarea data-plan-field="objectives">${escapeHtml(plan.objectives)}</textarea></label>
      </div></section>
      <section class="pci-plan-section"><h3>Contenidos priorizados del plan</h3>${contentRows(group, plan)}</section>
      <section class="pci-plan-section"><h3>Secuencia de trabajo</h3><div style="display:grid;gap:12px">${STAGES.map(([id, label]) => stageEditor(id, label, plan.stages[id])).join('')}</div></section>
      <div class="pci-plan-actions"><button class="button secondary" type="button" data-plan-back>← Volver a los planes</button><button class="button primary" type="submit">Guardar plan</button></div>
    </form></div>`;

  shell.querySelector('[data-plans-close]')?.addEventListener('click', closePlans);
  shell.querySelector('[data-plan-back]')?.addEventListener('click', () => renderPlanList(area, group));
  shell.querySelector('#pciPlanForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const nameField = form.querySelector('[data-plan-field="name"]');
    plan.name = nameField?.value ?? '';
    plan.autoName = group.kind !== 'trunk' && plan.name === defaultPlanName(group, number);
    plan.synopsis = form.querySelector('[data-plan-field="synopsis"]')?.value ?? '';
    plan.objectives = form.querySelector('[data-plan-field="objectives"]')?.value ?? '';
    plan.contentIds = [...form.querySelectorAll('[data-plan-content]:checked')].map((input) => String(input.dataset.planContent));
    STAGES.forEach(([id]) => {
      plan.stages[id] = {
        description: form.querySelector(`[data-stage="${id}"][data-stage-field="description"]`)?.value ?? '',
        duration: form.querySelector(`[data-stage="${id}"][data-stage-field="duration"]`)?.value ?? '',
        resources: form.querySelector(`[data-stage="${id}"][data-stage-field="resources"]`)?.value ?? '',
        activities: form.querySelector(`[data-stage="${id}"][data-stage-field="activities"]`)?.value ?? '',
      };
    });
    plan.updatedAt = new Date().toISOString();
    persist();
    renderPlanList(area, group);
  });
}

function openPlans(groupId) {
  const found = findGroup(groupId);
  if (!found) return;
  const backdrop = ensureModal();
  activeGroupId = groupId;
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  backdrop.hidden = false;
  renderPlanList(found.area, found.group);
}

function addMatrixEntryPoint() {
  const panel = document.getElementById('matrixDetailsPanel');
  if (!panel || panel.hidden || !panel.dataset.groupId) return;
  const actions = panel.querySelector('.matrix-detail-actions');
  if (!actions || actions.querySelector('[data-open-bimestral-plans]')) return;
  const found = findGroup(panel.dataset.groupId);
  if (!found) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button accent';
  button.dataset.openBimestralPlans = '1';
  button.textContent = `Planes bimestrales (${planCount(found.group)})`;
  button.addEventListener('click', () => openPlans(panel.dataset.groupId));
  actions.prepend(button);
}

function addGroupEntryPoints() {
  document.querySelectorAll('.group-card[data-group-id]').forEach((card) => {
    if (card.querySelector('[data-pci-plan-entry]')) return;
    const found = findGroup(card.dataset.groupId);
    if (!found) return;
    const count = planCount(found.group);
    const plans = ensurePlans(found.group);
    const started = plans.filter((plan) => planStatus(plan) !== 'Sin iniciar').length;
    const entry = document.createElement('div');
    entry.className = 'pci-plan-entry';
    entry.dataset.pciPlanEntry = '1';
    entry.innerHTML = `<div><strong>Planes bimestrales</strong><small>${count} planes · ${started} iniciados</small></div><button class="button accent" type="button">Abrir planes</button>`;
    entry.querySelector('button').addEventListener('click', (event) => {
      event.stopPropagation();
      openPlans(card.dataset.groupId);
    });
    card.appendChild(entry);
  });
}

function refreshEntryPoints() {
  ensureStyles();
  addMatrixEntryPoint();
  addGroupEntryPoints();
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !document.getElementById('pciPlansBackdrop')?.hidden) closePlans();
});

const observer = new MutationObserver(() => refreshEntryPoints());
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
window.addEventListener('DOMContentLoaded', refreshEntryPoints);
window.addEventListener('pci-state-change', refreshEntryPoints);
setTimeout(refreshEntryPoints, 0);
