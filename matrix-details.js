const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

let ignoreClickUntil = 0;
let lastMatrixTrigger = null;
let previousBodyOverflow = '';

function ensureStyles() {
  if (document.getElementById('matrixDetailsStyles')) return;
  const style = document.createElement('style');
  style.id = 'matrixDetailsStyles';
  style.textContent = `
    .matrix-detail-backdrop{
      position:fixed;
      inset:0;
      z-index:1400;
      display:grid;
      place-items:center;
      padding:20px;
      background:rgba(15,45,61,.42);
      backdrop-filter:blur(2px);
    }
    .matrix-detail-backdrop[hidden]{display:none}
    .matrix-detail-panel{
      width:min(820px,100%);
      max-height:calc(100vh - 40px);
      overflow:auto;
      margin:0;
      padding:18px;
      border:1px solid var(--line,#d6e2e5);
      border-radius:18px;
      background:#fff;
      box-shadow:0 24px 70px rgba(21,55,74,.28);
      overscroll-behavior:contain;
    }
    .matrix-detail-panel[hidden]{display:none}
    .matrix-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:12px}
    .matrix-detail-head h3{margin:2px 0 0;font-size:1.08rem}.matrix-detail-meta{color:var(--muted,#6a7b84);font-size:.8rem;font-weight:800}
    .matrix-detail-actions{display:flex;gap:8px;flex-wrap:wrap}.matrix-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:10px 0}
    .matrix-detail-box{padding:11px;border-radius:12px;background:#f5f9f9}.matrix-detail-box strong{display:block;margin-bottom:4px;font-size:.76rem;text-transform:uppercase;letter-spacing:.04em}
    .matrix-detail-box p{margin:0;color:var(--ink-soft,#425c68);line-height:1.45}.matrix-content-list{display:grid;gap:8px;margin-top:12px}
    .matrix-content-row{padding:10px 11px;border:1px solid var(--line,#d6e2e5);border-radius:11px;background:#fff}.matrix-content-row small{display:block;margin-bottom:4px;color:var(--muted,#6a7b84);font-weight:800}.matrix-content-row p{margin:0;line-height:1.42}
    .site-credit{width:min(1180px,calc(100% - 32px));margin:30px auto 18px;padding-top:16px;border-top:1px solid var(--line,#d6e2e5);text-align:center;color:var(--muted,#6a7b84);font-size:.78rem;font-weight:750}
    .site-credit strong{color:var(--ink,#15374a)}
    @media(max-width:820px){
      .matrix-header{position:static!important;top:auto!important}
    }
    @media(max-width:720px){
      .matrix-detail-backdrop{padding:10px;align-items:end}
      .matrix-detail-panel{width:100%;max-height:88vh;border-radius:18px 18px 10px 10px;padding:15px}
      .matrix-detail-grid{grid-template-columns:1fr}
      .matrix-detail-head{display:block}
      .matrix-detail-actions{margin-top:10px}
    }
  `;
  document.head.appendChild(style);
}

function ensureCreatorCredit() {
  if (document.getElementById('creatorCredit')) return;
  ensureStyles();
  const credit = document.createElement('footer');
  credit.id = 'creatorCredit';
  credit.className = 'site-credit no-print';
  credit.setAttribute('aria-label', 'Créditos');
  credit.innerHTML = '© 2026 · Creado por <strong>Sebastián Giampani</strong>';
  document.body.appendChild(credit);
}

function closeDetails({ restoreFocus = true } = {}) {
  const backdrop = document.getElementById('matrixDetailsBackdrop');
  const panel = document.getElementById('matrixDetailsPanel');
  if (panel) panel.hidden = true;
  if (backdrop) backdrop.hidden = true;
  document.body.style.overflow = previousBodyOverflow;
  if (restoreFocus) lastMatrixTrigger?.focus?.({ preventScroll: true });
}

function ensurePanel() {
  let panel = document.getElementById('matrixDetailsPanel');
  if (panel) return panel;

  ensureStyles();
  const backdrop = document.createElement('div');
  backdrop.id = 'matrixDetailsBackdrop';
  backdrop.className = 'matrix-detail-backdrop no-print';
  backdrop.hidden = true;

  panel = document.createElement('section');
  panel.id = 'matrixDetailsPanel';
  panel.className = 'matrix-detail-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'matrixDetailsTitle');

  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeDetails();
  });
  return panel;
}

function groupDetails(groupId) {
  const api = window.PCIApp;
  const state = api?.getState?.();
  const data = api?.getData?.() ?? [];
  if (!state) return null;
  for (const [area, areaState] of Object.entries(state.areas ?? {})) {
    const group = (areaState.groups ?? []).find((item) => item.id === groupId);
    if (!group) continue;
    const contents = (group.items ?? []).map((id) => data.find((item) => String(item.id) === String(id))).filter(Boolean);
    return { area, group, contents };
  }
  return null;
}

function fieldBox(label, value) {
  const clean = String(value ?? '').trim();
  if (!clean) return '';
  return `<div class="matrix-detail-box"><strong>${escapeHtml(label)}</strong><p>${escapeHtml(clean)}</p></div>`;
}

function openDetails(groupId, trigger = null) {
  ensureStyles();
  const panel = ensurePanel();
  const backdrop = document.getElementById('matrixDetailsBackdrop');
  const details = groupDetails(groupId);
  if (!panel || !backdrop || !details) return;

  lastMatrixTrigger = trigger || lastMatrixTrigger;
  const { area, group, contents } = details;
  const temporal = group.startTerm === group.endTerm ? `C${group.startTerm}` : `C${group.startTerm}–C${group.endTerm}`;
  const contextual = group.kind === 'laboratory'
    ? fieldBox('Contexto problematizador', group.context)
    : group.kind === 'workshop'
      ? fieldBox('Práctica / producto / eje', group.practiceAxis)
      : '';

  panel.dataset.groupId = group.id;
  panel.innerHTML = `
    <div class="matrix-detail-head">
      <div><div class="matrix-detail-meta">${escapeHtml(area)} · ${escapeHtml(temporal)} · ${escapeHtml(group.type || '')}</div><h3 id="matrixDetailsTitle">${escapeHtml(group.name)}</h3></div>
      <div class="matrix-detail-actions"><button class="button secondary" type="button" data-matrix-detail-edit>Editar espacio</button><button class="button ghost" type="button" data-matrix-detail-close>Cerrar</button></div>
    </div>
    <div class="matrix-detail-grid">
      ${contextual}
      ${fieldBox('Objetivos de aprendizaje', group.objective)}
      ${fieldBox('Sinopsis', group.synopsis)}
      ${group.kind === 'other' ? fieldBox('Formato pedagógico', group.formatType) : ''}
    </div>
    <div class="matrix-detail-meta"><strong>${contents.length}</strong> contenido${contents.length === 1 ? '' : 's'} asignado${contents.length === 1 ? '' : 's'}</div>
    <div class="matrix-content-list">${contents.length ? contents.map((content) => `<article class="matrix-content-row"><small>${escapeHtml(content.subject)} · ${escapeHtml(content.axis || 'Sin eje / bloque')}</small><p>${escapeHtml(content.text)}</p></article>`).join('') : '<div class="matrix-content-row"><p>Este espacio todavía no tiene contenidos asignados.</p></div>'}</div>`;

  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  backdrop.hidden = false;
  panel.hidden = false;

  panel.querySelector('[data-matrix-detail-close]')?.addEventListener('click', () => closeDetails());
  panel.querySelector('[data-matrix-detail-edit]')?.addEventListener('click', () => {
    closeDetails({ restoreFocus: false });
    window.PCIApp?.openArea?.(area, group.id);
  });
  panel.querySelector('[data-matrix-detail-close]')?.focus({ preventScroll: true });
}

function tuneRepeatableContentUi() {
  const specialAreas = new Set(['Artes', 'Educación Física', 'Otros formatos pedagógicos']);
  const currentArea = window.PCIApp?.getState?.()?.current;
  const hint = document.getElementById('coverageHint');
  if (!specialAreas.has(currentArea) && hint && hint.textContent !== 'Un mismo contenido puede formar parte de más de un espacio.') {
    hint.textContent = 'Un mismo contenido puede formar parte de más de un espacio.';
  }
  const moveButton = document.getElementById('moveSelected');
  const countLabel = document.getElementById('selectionCount')?.textContent ?? '';
  const count = Number.parseInt(countLabel, 10) || 0;
  const desiredLabel = count ? `Asignar ${count}` : 'Asignar seleccionados';
  if (moveButton && moveButton.textContent !== desiredLabel) moveButton.textContent = desiredLabel;
}

function tuneStructureStatus() {
  const status = document.getElementById('structureStatus');
  if (!status?.innerHTML.includes('simultaneidad en C6 y C7')) return;
  status.innerHTML = status.innerHTML.replace('simultaneidad en C6 y C7', 'simultaneidad en C5 y C6');
}

function protectEditorControls() {
  const selector = 'input, select, textarea, button, a, label';
  document.querySelectorAll('.group-card').forEach((card) => {
    card.querySelectorAll(selector).forEach((control) => {
      if (control.dataset.pciEditorProtected === '1') return;
      control.dataset.pciEditorProtected = '1';
      const stopCardSelection = (event) => event.stopPropagation();
      control.addEventListener('pointerdown', stopCardSelection);
      control.addEventListener('mousedown', stopCardSelection);
      control.addEventListener('touchstart', stopCardSelection, { passive: true });
    });
  });
}

document.addEventListener('dragend', (event) => {
  if (event.target?.closest?.('[data-matrix-group]')) ignoreClickUntil = Date.now() + 160;
}, true);

document.addEventListener('click', (event) => {
  const button = event.target?.closest?.('[data-matrix-group]');
  if (!button || Date.now() < ignoreClickUntil) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openDetails(button.dataset.matrixGroup, button);
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const panel = document.getElementById('matrixDetailsPanel');
  if (panel && !panel.hidden) closeDetails();
});

const observer = new MutationObserver(() => {
  ensureCreatorCredit();
  tuneRepeatableContentUi();
  tuneStructureStatus();
  protectEditorControls();
});
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener('DOMContentLoaded', () => {
  ensureCreatorCredit();
  tuneRepeatableContentUi();
  tuneStructureStatus();
  protectEditorControls();
});
setTimeout(() => {
  ensureCreatorCredit();
  tuneRepeatableContentUi();
  tuneStructureStatus();
  protectEditorControls();
}, 0);
