const OTHER_AREA = 'Otros formatos pedagógicos';
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const selected = new Set();
let applying = false;

function state() { return window.PCIApp?.getState?.() ?? window.app; }
function data() { return window.PCIApp?.getData?.() ?? window.DATA ?? []; }
function isOtherOpen() { return $('board')?.classList.contains('active') && $('boardTitle')?.textContent === OTHER_AREA; }
function otherGroups() { return state()?.areas?.[OTHER_AREA]?.groups ?? []; }
function selectedGroup() {
  const id = document.querySelector('.group-card.selected')?.dataset.groupId;
  return otherGroups().find((group) => group.id === id) ?? otherGroups()[0] ?? null;
}
function allLocations(contentId) {
  const out = [];
  const app = state();
  if (!app?.areas) return out;
  for (const [area, areaState] of Object.entries(app.areas)) {
    for (const group of areaState?.groups ?? []) {
      if ((group.items ?? []).includes(String(contentId))) out.push({ area, name: group.name });
    }
  }
  return out;
}
function otherAssignedIds() {
  return new Set(otherGroups().flatMap((group) => group.items ?? []).map(String));
}
function ensureAreaFilter() {
  if ($('otherAreaFilter')) return;
  const pair = document.querySelector('#contentBag .filter-pair');
  if (!pair) return;
  const label = document.createElement('label');
  label.id = 'otherAreaFilterWrap';
  label.innerHTML = '<span>Área curricular</span><select id="otherAreaFilter"><option value="">Todas las áreas</option></select>';
  pair.before(label);
  const areas = [...new Set(data().map((row) => row.area))].sort((a,b) => a.localeCompare(b,'es'));
  $('otherAreaFilter').innerHTML = '<option value="">Todas las áreas</option>' + areas.map((area) => `<option value="${esc(area)}">${esc(area)}</option>`).join('');
  $('otherAreaFilter').addEventListener('change', render);
}
function ensureBar() {
  let bar = $('otherSelectionBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'otherSelectionBar';
    bar.className = 'selection-bar';
    bar.innerHTML = '<div><strong id="otherSelectionCount">0 seleccionados</strong><small id="otherSelectionTarget">Elegí un espacio de destino</small></div><button id="otherAssign" class="button primary" type="button" disabled>Asignar seleccionados</button>';
    document.querySelector('#contentBag .selection-bar')?.after(bar);
    $('otherAssign').addEventListener('click', assign);
  }
  const original = document.querySelector('#contentBag .selection-bar:not(#otherSelectionBar)');
  if (original) original.style.display = 'none';
}
function restoreStandardBag() {
  $('otherAreaFilterWrap')?.remove();
  $('otherSelectionBar')?.remove();
  const original = document.querySelector('#contentBag .selection-bar');
  if (original) original.style.display = '';
}
function filteredRows() {
  const query = ($('contentSearch')?.value ?? '').trim().toLocaleLowerCase('es');
  const subject = $('subjectFilter')?.value ?? '';
  const axis = $('axisFilter')?.value ?? '';
  const area = $('otherAreaFilter')?.value ?? '';
  const pendingOnly = Boolean($('pendingFilter')?.checked);
  const assignedOther = otherAssignedIds();
  return data().filter((content) => {
    const haystack = `${content.area} ${content.subject} ${content.axis} ${content.text}`.toLocaleLowerCase('es');
    return (!query || haystack.includes(query)) && (!area || content.area === area) && (!subject || content.subject === subject) && (!axis || content.axis === axis) && (!pendingOnly || !assignedOther.has(String(content.id)));
  });
}
function syncFilters() {
  const rows = data().filter((row) => !$('otherAreaFilter')?.value || row.area === $('otherAreaFilter').value);
  const subject = $('subjectFilter')?.value ?? '';
  const axis = $('axisFilter')?.value ?? '';
  const subjects = [...new Set(rows.map((row) => row.subject))].sort((a,b) => a.localeCompare(b,'es'));
  const axes = [...new Set(rows.map((row) => row.axis).filter(Boolean))].sort((a,b) => a.localeCompare(b,'es'));
  if ($('subjectFilter')) {
    $('subjectFilter').innerHTML = '<option value="">Todas</option>' + subjects.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    if (subjects.includes(subject)) $('subjectFilter').value = subject;
  }
  if ($('axisFilter')) {
    $('axisFilter').innerHTML = '<option value="">Todos</option>' + axes.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    if (axes.includes(axis)) $('axisFilter').value = axis;
  }
}
function render() {
  if (!isOtherOpen() || applying) return;
  applying = true;
  try {
    ensureAreaFilter(); ensureBar(); syncFilters();
    const rows = filteredRows();
    const assignedOther = otherAssignedIds();
    const total = data().length;
    const assigned = assignedOther.size;
    if ($('coverageLabel')) $('coverageLabel').textContent = `${assigned} de ${total} contenidos utilizados en otros formatos`;
    if ($('coverageBar')) $('coverageBar').style.width = `${total ? Math.round(assigned / total * 100) : 0}%`;
    if ($('coverageHint')) $('coverageHint').textContent = 'Podés elegir contenidos de cualquier área. Un contenido puede usarse también en otros espacios; para la cobertura se cuenta una sola vez.';
    if ($('boardDescription')) $('boardDescription').textContent = 'Creá seminarios, proyectos o ateneos y elegí contenidos de todas las áreas curriculares. Pueden ser cuatrimestrales o anuales.';
    if ($('bagMeta')) $('bagMeta').textContent = `${rows.length} visibles · ${total - assigned} todavía no usados en otros formatos`;
    if ($('contentList')) $('contentList').innerHTML = rows.length ? rows.map((content) => {
      const locations = allLocations(content.id);
      const checked = selected.has(String(content.id));
      return `<article class="content-item ${checked ? 'selected' : ''} ${locations.length ? 'assigned' : ''}" data-other-content-id="${esc(content.id)}"><input type="checkbox" tabindex="-1" ${checked ? 'checked' : ''} aria-hidden="true"><div><small>${esc(content.area)} · ${esc(content.subject)} · ${esc(content.axis || 'Sin eje / bloque')}</small><p>${esc(content.text)}</p>${locations.length ? `<span class="content-location">En ${esc(locations.map((x) => x.name).join(' · '))}</span>` : '<span class="content-location pending-text">Todavía no asignado</span>'}</div></article>`;
    }).join('') : '<div class="empty-state">No hay contenidos que coincidan con estos filtros.</div>';
    document.querySelectorAll('[data-other-content-id]').forEach((item) => item.addEventListener('click', () => {
      const id = item.dataset.otherContentId;
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      render();
    }));
    const target = selectedGroup();
    if ($('otherSelectionCount')) $('otherSelectionCount').textContent = `${selected.size} seleccionado${selected.size === 1 ? '' : 's'}`;
    if ($('otherSelectionTarget')) $('otherSelectionTarget').textContent = target ? `Destino: ${target.name}` : 'Creá o elegí un formato de destino';
    if ($('otherAssign')) { $('otherAssign').disabled = !selected.size || !target; $('otherAssign').textContent = selected.size ? `Asignar ${selected.size}` : 'Asignar seleccionados'; }
  } finally { applying = false; }
}
function assign() {
  const target = selectedGroup();
  if (!target || !selected.size) return;
  target.items = [...new Set([...(target.items ?? []).map(String), ...selected])];
  selected.clear();
  const app = state();
  app.schemaVersion = 10;
  localStorage.setItem('pciAppV2', JSON.stringify(app));
  window.app = app;
  window.dispatchEvent(new CustomEvent('pci-state-change', { detail: { schemaVersion: 10 } }));
  window.PCIApp?.openArea?.(OTHER_AREA, target.id);
  setTimeout(render, 0);
}
['contentSearch','subjectFilter','axisFilter','pendingFilter'].forEach((id) => document.addEventListener(id === 'contentSearch' ? 'input' : 'change', (event) => {
  if (event.target?.id === id && isOtherOpen()) setTimeout(render, 0);
}, true));
document.addEventListener('click', (event) => {
  if (event.target?.closest?.('[data-area="Otros formatos pedagógicos"], [data-group-id], [data-mobile-step]')) setTimeout(render, 0);
});
const observer = new MutationObserver(() => {
  if (isOtherOpen()) setTimeout(render, 0); else restoreStandardBag();
});
observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
setTimeout(render, 0);
