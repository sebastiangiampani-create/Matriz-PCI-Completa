const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

let ignoreClickUntil = 0;

function ensureStyles() {
  if (document.getElementById('matrixDetailsStyles')) return;
  const style = document.createElement('style');
  style.id = 'matrixDetailsStyles';
  style.textContent = `
    .matrix-detail-panel{margin:14px 0 18px;padding:16px;border:1px solid var(--line,#d6e2e5);border-radius:16px;background:#fff;box-shadow:0 12px 30px #15374a12}
    .matrix-detail-panel[hidden]{display:none}.matrix-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:12px}
    .matrix-detail-head h3{margin:2px 0 0;font-size:1.05rem}.matrix-detail-meta{color:var(--muted,#6a7b84);font-size:.8rem;font-weight:800}
    .matrix-detail-actions{display:flex;gap:8px;flex-wrap:wrap}.matrix-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:10px 0}
    .matrix-detail-box{padding:11px;border-radius:12px;background:#f5f9f9}.matrix-detail-box strong{display:block;margin-bottom:4px;font-size:.76rem;text-transform:uppercase;letter-spacing:.04em}
    .matrix-detail-box p{margin:0;color:var(--ink-soft,#425c68);line-height:1.45}.matrix-content-list{display:grid;gap:8px;margin-top:12px}
    .matrix-content-row{padding:10px 11px;border:1px solid var(--line,#d6e2e5);border-radius:11px;background:#fff}.matrix-content-row small{display:block;margin-bottom:4px;color:var(--muted,#6a7b84);font-weight:800}.matrix-content-row p{margin:0;line-height:1.42}
    .site-credit{width:min(1180px,calc(100% - 32px));margin:30px auto 18px;padding-top:16px;border-top:1px solid var(--line,#d6e2e5);text-align:center;color:var(--muted,#6a7b84);font-size:.78rem;font-weight:750}
    .site-credit strong{color:var(--ink,#15374a)}
    @media(max-width:720px){.matrix-detail-grid{grid-template-columns:1fr}.matrix-detail-head{display:block}.matrix-detail-actions{margin-top:10px}}
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

function ensurePanel() {
  let panel = document.getElementById('matrixDetailsPanel');
  if (panel) return panel;
  const grid = document.getElementById('matrixGrid');
  if (!grid) return null;
  panel = document.createElement('section');
  panel.id = 'matrixDetailsPanel';
  panel.className = 'matrix-detail-panel no-print';
  panel.hidden = true;
  grid.parentElement?.insertBefore(panel, grid.parentElement.firstChild);
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

function openDetails(groupId) {
  ensureStyles();
  const panel = ensurePanel();
  const details = groupDetails(groupId);
  if (!panel || !details) return;
  const { area, group, contents } = details;
  const temporal = group.startTerm === group.endTerm ? `C${group.startTerm}` : `C${group.startTerm}–C${group.endTerm}`;
  const contextual = group.kind === 'laboratory'
    ? fieldBox('Contexto problematizador', group.context)
    : group.kind === 'workshop'
      ? fieldBox('Práctica / producto / eje', group.practiceAxis)
      : '';
  panel.hidden = false;
  panel.dataset.groupId = group.id;
  panel.innerHTML = `
    <div class="matrix-detail-head">
      <div><div class="matrix-detail-meta">${escapeHtml(area)} · ${escapeHtml(temporal)} · ${escapeHtml(group.type || '')}</div><h3>${escapeHtml(group.name)}</h3></div>
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
  panel.querySelector('[data-matrix-detail-close]')?.addEventListener('click', () => { panel.hidden = true; });
  panel.querySelector('[data-matrix-detail-edit]')?.addEventListener('click', () => window.PCIApp?.openArea?.(area, group.id));
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function tuneRepeatableContentUi() {
  const hint = document.getElementById('coverageHint');
  if (hint && hint.textContent !== 'Un mismo contenido puede formar parte de más de un espacio.') {
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

document.addEventListener('dragend', (event) => {
  if (event.target?.closest?.('[data-matrix-group]')) ignoreClickUntil = Date.now() + 160;
}, true);

document.addEventListener('click', (event) => {
  const button = event.target?.closest?.('[data-matrix-group]');
  if (!button || Date.now() < ignoreClickUntil) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openDetails(button.dataset.matrixGroup);
}, true);

const observer = new MutationObserver(() => {
  const panel = document.getElementById('matrixDetailsPanel');
  if (panel && panel.parentElement && !document.getElementById('matrixGrid')) panel.remove();
  ensureCreatorCredit();
  tuneRepeatableContentUi();
  tuneStructureStatus();
});
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener('DOMContentLoaded', () => {
  ensureCreatorCredit();
  tuneRepeatableContentUi();
  tuneStructureStatus();
});
setTimeout(() => {
  ensureCreatorCredit();
  tuneRepeatableContentUi();
  tuneStructureStatus();
}, 0);
