const STAGES = [
  ['punto_partida', 'Punto de partida'],
  ['indagacion', 'Indagación'],
  ['produccion', 'Producción'],
  ['evaluacion', 'Evaluación'],
];

const PLAN_HEADER_URL = new URL('./plan-sa-header.svg', import.meta.url).href;
const PLAN_FOOTER_URL = new URL('./plan-sa-footer.svg', import.meta.url).href;

let activeGroupId = null;
let activePlanNumber = null;

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const br = (value) => esc(value).replace(/\r?\n/g, '<br>');

function state() {
  return window.PCIApp?.getState?.() ?? null;
}

function data() {
  return window.PCIApp?.getData?.() ?? [];
}

function findGroup(groupId) {
  const current = state();
  if (!current || !groupId) return null;
  for (const [area, areaState] of Object.entries(current.areas ?? {})) {
    const group = (areaState.groups ?? []).find((item) => String(item.id) === String(groupId));
    if (group) return { area, group };
  }
  return null;
}

function findGroupFromEditor() {
  const current = state();
  const form = document.getElementById('pciPlanForm');
  const kicker = document.querySelector('#pciPlansShell .pci-plan-kicker');
  if (!current || !form || !kicker) return null;
  const parts = String(kicker.textContent ?? '').split('·').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const area = parts.shift();
  const groupName = parts.join(' · ');
  const groups = current.areas?.[area]?.groups ?? [];
  const group = groups.find((item) => String(item.name ?? '').trim() === groupName);
  return group ? { area, group } : null;
}

function currentContext(number = activePlanNumber) {
  const found = findGroup(activeGroupId) ?? findGroupFromEditor();
  if (!found) return null;
  const planNumber = Number(number);
  const plan = found.group.plansBimestrales?.[planNumber - 1];
  return plan ? { ...found, plan, planNumber } : null;
}

function kindLabel(group) {
  return ({
    trunk: 'Espacio troncal',
    laboratory: 'Laboratorio / espacio de integración',
    workshop: 'Taller / espacio formativo',
    other: 'Otro formato pedagógico',
    integration: 'Espacio de Integración',
    formative: 'Espacio Formativo',
    'technical-workshop': 'Taller anual',
  })[group.kind] ?? 'Espacio curricular';
}

function snapshotPlan(plan) {
  const copy = typeof structuredClone === 'function'
    ? structuredClone(plan)
    : JSON.parse(JSON.stringify(plan ?? {}));
  const form = document.getElementById('pciPlanForm');
  if (!form) return copy;

  form.querySelectorAll('[data-plan-field]').forEach((field) => {
    copy[field.dataset.planField] = field.value;
  });
  copy.contentIds = [...form.querySelectorAll('[data-plan-content]:checked')]
    .map((input) => String(input.dataset.planContent));
  copy.stages ??= {};
  form.querySelectorAll('[data-stage][data-stage-field]').forEach((field) => {
    const stageId = field.dataset.stage;
    copy.stages[stageId] ??= {};
    copy.stages[stageId][field.dataset.stageField] = field.value;
  });
  return copy;
}

function stageHtml(id, label, stage = {}) {
  const description = String(stage.description ?? '').trim();
  const duration = String(stage.duration ?? '').trim();
  const resources = String(stage.resources ?? '').trim();
  const activities = String(stage.activities ?? '').trim();
  return `<section class="stage">
    <h2>${esc(label)}</h2>
    ${description ? `<div class="box"><span class="label">Presentación de la etapa</span><p>${br(description)}</p></div>` : ''}
    <div class="meta">
      <div class="box"><span class="label">Duración estimada</span><p>${duration ? br(duration) : '—'}</p></div>
      <div class="box"><span class="label">Recursos</span><p>${resources ? br(resources) : '—'}</p></div>
    </div>
    <div class="activities"><span class="label">Actividades dirigidas al estudiante</span><div>${activities ? br(activities) : '<i>Sin actividades cargadas.</i>'}</div></div>
  </section>`;
}

function printDocument(ctx, plan, autoPrint = false) {
  const current = state();
  const schoolName = String(current?.schoolName ?? '').trim() || 'Escuela';
  const rows = data();
  const contents = (plan.contentIds ?? [])
    .map((id) => rows.find((item) => String(item.id) === String(id)))
    .filter(Boolean);
  const planTitle = String(plan.name ?? '').trim() || `Plan bimestral ${ctx.planNumber}`;
  const totalPlans = ctx.group.plansBimestrales?.length ?? '';

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(planTitle)} · ${esc(schoolName)}</title>
<style>
@page{size:A4;margin:31mm 14mm 34mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;padding:0;background:#fff;color:#20282d;font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;line-height:1.42}
.sheet{max-width:182mm;margin:auto}
.letterhead-header,.letterhead-footer{display:block;width:100%;height:auto}
.screen-tools{display:flex;gap:8px;position:sticky;top:0;z-index:20;padding:10px 14mm;background:#fff;border-bottom:1px solid #ccd6d9}
.screen-tools button{padding:9px 13px;border:0;border-radius:8px;background:#15374a;color:#fff;font:inherit;font-weight:700;cursor:pointer}
.screen-tools button.secondary{background:#e8eff1;color:#15374a}
.print-hint{margin:10px auto 14px;max-width:182mm;padding:10px 12px;border:1px solid #c9d6da;border-radius:8px;background:#f4f8f9;color:#36505b;font-size:9pt}
.document-title{padding-bottom:9px;border-bottom:2px solid #15374a}
.kicker{font-size:8.5pt;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#66777e}
h1{margin:5px 0 4px;color:#15374a;font-size:19pt;line-height:1.15}
.school{margin:0;color:#52646c;font-size:10pt;font-weight:700}
h2{margin:0 0 8px;padding:7px 9px;background:#eef4f4;border-left:4px solid #15374a;color:#15374a;font-size:12pt;text-transform:uppercase;break-after:avoid-page;page-break-after:avoid}
.grid{display:grid;grid-template-columns:1fr 1fr;margin-top:14px;border:1px solid #aebcc1;border-bottom:0}
.cell{padding:8px;border-bottom:1px solid #aebcc1}.cell:nth-child(odd){border-right:1px solid #aebcc1}.cell.full{grid-column:1/-1;border-right:0!important}
.label{display:block;margin-bottom:4px;color:#52646c;font-size:8.3pt;font-weight:800;text-transform:uppercase;letter-spacing:.03em}
.section,.stage{margin-top:16px}.box{padding:9px;border:1px solid #b9c6ca;break-inside:avoid-page;page-break-inside:avoid}.box p{margin:0;overflow-wrap:anywhere}
.contents{display:grid;gap:6px}.content{padding:7px 8px;border:1px solid #c7d1d4;break-inside:avoid-page;page-break-inside:avoid}.content small{display:block;margin-bottom:2px;color:#65757c;font-weight:700}.content div{overflow-wrap:anywhere}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;break-inside:avoid-page;page-break-inside:avoid}.activities{margin-top:9px;break-inside:avoid-page;page-break-inside:avoid}.activities>div{min-height:30mm;padding:10px;border:1px solid #9fadba;overflow-wrap:anywhere}
@media screen{
  body{padding-bottom:18px}
  .letterhead-header{margin-bottom:14px}
  .letterhead-footer{margin-top:22px}
  .sheet{padding:0 14mm}
}
@media print{
  html,body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  .screen-tools,.print-hint{display:none!important}
  .sheet{max-width:none;margin:0}
  .letterhead-header,.letterhead-footer{position:fixed;left:-14mm;width:210mm;z-index:10;object-fit:fill}
  .letterhead-header{top:-26mm;height:15.3mm}
  .letterhead-footer{bottom:-28mm;height:18.3mm}
  .document-title,.grid{break-inside:avoid-page;page-break-inside:avoid}
  .stage{break-inside:auto;page-break-inside:auto}
}
@media(max-width:700px){.grid,.meta{grid-template-columns:1fr}.cell:nth-child(odd){border-right:0}.screen-tools{position:static;padding:10px}.sheet{padding:0 10px}.print-hint{margin:10px}}
</style>
</head>
<body>
<div class="screen-tools"><button onclick="window.print()">Imprimir / Guardar PDF</button><button class="secondary" onclick="window.close()">Cerrar</button></div>
<div class="print-hint"><strong>Para un PDF limpio en Chrome:</strong> desactivá “Encabezado y pie de página”. El membrete institucional ya está incluido en cada hoja.</div>
<img class="letterhead-header" src="${esc(PLAN_HEADER_URL)}" alt="Escuela de Maestros · Secundaria aprende">
<main class="sheet">
  <header class="document-title"><div class="kicker">${esc(ctx.area)} · Proyecto Curricular Institucional</div><h1>${esc(planTitle)}</h1><p class="school">${esc(schoolName)}</p></header>
  <section class="grid">
    <div class="cell"><span class="label">Tipo de espacio</span><strong>${esc(kindLabel(ctx.group))}</strong></div>
    <div class="cell"><span class="label">Nombre del espacio</span><strong>${esc(ctx.group.name)}</strong></div>
    <div class="cell"><span class="label">Duración</span><strong>1 bimestre</strong></div>
    <div class="cell"><span class="label">Ubicación temporal</span><strong>Bimestre ${esc(ctx.planNumber)} de ${esc(totalPlans)}</strong></div>
    <div class="cell full"><span class="label">Sinopsis</span>${String(plan.synopsis ?? '').trim() ? br(plan.synopsis) : '—'}</div>
  </section>
  <section class="section"><h2>Contenidos</h2><div class="contents">${contents.length ? contents.map((content) => `<article class="content"><small>${esc(content.subject ?? '')}${content.axis ? ` · ${esc(content.axis)}` : ''}</small><div>${esc(content.text ?? '')}</div></article>`).join('') : '<div class="box">Sin contenidos seleccionados.</div>'}</div></section>
  <section class="section"><h2>Objetivos de aprendizaje</h2><div class="box"><p>${String(plan.objectives ?? '').trim() ? br(plan.objectives) : '—'}</p></div></section>
  ${STAGES.map(([id, label]) => stageHtml(id, label, plan.stages?.[id] ?? {})).join('')}
</main>
<img class="letterhead-footer" src="${esc(PLAN_FOOTER_URL)}" alt="Ministerio de Educación · Buenos Aires Ciudad">
${autoPrint ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),650));<\/script>' : ''}
</body>
</html>`;
}

function openPrint(autoPrint = false, number = activePlanNumber) {
  const ctx = currentContext(number);
  if (!ctx) {
    alert('No se pudo identificar el plan para imprimir. Cerrá y volvé a abrir el plan.');
    return;
  }
  const plan = Number(number) === Number(activePlanNumber) && document.getElementById('pciPlanForm')
    ? snapshotPlan(ctx.plan)
    : (typeof structuredClone === 'function' ? structuredClone(ctx.plan) : JSON.parse(JSON.stringify(ctx.plan)));
  const popup = window.open('', '_blank');
  if (!popup) {
    alert('El navegador bloqueó la vista de impresión. Habilitá las ventanas emergentes e intentá nuevamente.');
    return;
  }
  popup.document.open();
  popup.document.write(printDocument(ctx, plan, autoPrint));
  popup.document.close();
}

function ensureStyles() {
  if (document.getElementById('pciPlanPrintStyles')) return;
  const style = document.createElement('style');
  style.id = 'pciPlanPrintStyles';
  style.textContent = `
    .pci-plan-print-tools{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-left:auto}
    .pci-plan-card-print{margin-left:7px}
    @media(max-width:760px){.pci-plan-top{flex-wrap:wrap}.pci-plan-print-tools{width:100%;order:3;margin-left:0}.pci-plan-print-tools .button{flex:1}}
  `;
  document.head.appendChild(style);
}

function enhanceEditorHeader() {
  const form = document.getElementById('pciPlanForm');
  const top = document.querySelector('#pciPlansShell .pci-plan-top');
  if (!form || !top || top.querySelector('[data-plan-print-tools]')) return;
  const ctx = currentContext();
  if (!ctx) return;

  const tools = document.createElement('div');
  tools.className = 'pci-plan-print-tools';
  tools.dataset.planPrintTools = '1';
  tools.innerHTML = '<button class="button secondary" type="button" data-plan-preview>Vista previa</button><button class="button accent" type="button" data-plan-print>Imprimir / PDF</button>';
  const close = top.querySelector('[data-plans-close]');
  if (close) top.insertBefore(tools, close); else top.appendChild(tools);
  tools.querySelector('[data-plan-preview]')?.addEventListener('click', () => openPrint(false));
  tools.querySelector('[data-plan-print]')?.addEventListener('click', () => openPrint(true));
}

function enhancePlanCards() {
  const found = findGroup(activeGroupId);
  if (!found) return;
  document.querySelectorAll('#pciPlansShell [data-open-plan]').forEach((openButton) => {
    const card = openButton.closest('.pci-plan-card');
    if (!card || card.querySelector('[data-print-plan-card]')) return;
    const number = Number(openButton.dataset.openPlan);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button secondary pci-plan-card-print';
    button.dataset.printPlanCard = String(number);
    button.textContent = 'Imprimir';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      openPrint(true, number);
    });
    openButton.insertAdjacentElement('afterend', button);
  });
}

function enhance() {
  ensureStyles();
  enhanceEditorHeader();
  enhancePlanCards();
}

document.addEventListener('click', (event) => {
  const groupButton = event.target.closest('[data-pci-plan-entry] button');
  if (groupButton) activeGroupId = groupButton.closest('.group-card[data-group-id]')?.dataset.groupId ?? activeGroupId;

  const matrixButton = event.target.closest('[data-open-bimestral-plans]');
  if (matrixButton) activeGroupId = document.getElementById('matrixDetailsPanel')?.dataset.groupId ?? activeGroupId;

  const planButton = event.target.closest('[data-open-plan]');
  if (planButton) activePlanNumber = Number(planButton.dataset.openPlan) || null;

  if (event.target.closest('[data-back-plans], [data-plan-back]')) activePlanNumber = null;
  if (event.target.closest('[data-plans-close]')) {
    activePlanNumber = null;
    activeGroupId = null;
  }
}, true);

const observer = new MutationObserver(() => enhance());
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', enhance);
window.addEventListener('pci-state-change', enhance);
setTimeout(enhance, 0);
