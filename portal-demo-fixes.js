(() => {
  const codeOverrides = new Map();

  function hashString(value) {
    const text = String(value ?? '');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0);
  }

  window.fakeCode = function fakeCode(id) {
    const key = String(id ?? '');
    if (codeOverrides.has(key)) return codeOverrides.get(key);
    const n = hashString(key) % 10000;
    return `PCI-${String(n).padStart(4, '0')}`;
  };

  function renderAdminAll(list) {
    const rows = document.getElementById('adminRows');
    if (!rows) return;
    rows.innerHTML = list.map((s) => `
      <tr data-school-id="${esc(s.id)}">
        <td>${esc(s.name)}</td>
        <td>${esc(s.cue || '—')}</td>
        <td class="code" data-code>${fakeCode(s.id)}</td>
        <td><span class="pill">Activa</span></td>
        <td>
          <button class="button" type="button" data-demo-open>Abrir</button>
          <button class="button" type="button" data-demo-copy>Copiar</button>
          <button class="button" type="button" data-demo-reset>Resetear</button>
        </td>
      </tr>`).join('');
    document.getElementById('countAdmin').textContent = `${list.length} escuelas`;
  }

  function renderSupAll(list) {
    const rows = document.getElementById('supRows');
    if (!rows) return;
    rows.innerHTML = list.map((s) => `
      <tr data-school-id="${esc(s.id)}">
        <td>${esc(s.name)}</td>
        <td>${esc(s.cue || '—')}</td>
        <td>${esc(s.entryYear || '—')}</td>
        <td><span class="pill">Activa</span></td>
        <td><button class="button" type="button" data-demo-view>Ver PCI</button></td>
      </tr>`).join('');
    document.getElementById('countSup').textContent = `${list.length} escuelas`;
  }

  window.renderAdmin = renderAdminAll;
  window.renderSup = renderSupAll;

  function findSchoolFromRow(row) {
    const id = row?.dataset.schoolId;
    return (window.schools || schools || []).find((s) => String(s.id) === String(id));
  }

  function openSchool(school, mode) {
    if (!school) return;
    const params = new URLSearchParams({ school: school.id, name: school.name, mode });
    window.open(`escuela-importada-preview.html?${params.toString()}`, '_blank', 'noopener');
  }

  document.addEventListener('click', async (event) => {
    const row = event.target.closest('tr[data-school-id]');
    if (!row) return;
    const school = findSchoolFromRow(row);
    if (event.target.closest('[data-demo-open]')) {
      openSchool(school, 'edit');
      return;
    }
    if (event.target.closest('[data-demo-view]')) {
      openSchool(school, 'view');
      return;
    }
    if (event.target.closest('[data-demo-copy]')) {
      const code = row.querySelector('[data-code]')?.textContent?.trim() || '';
      try { await navigator.clipboard.writeText(code); } catch {}
      const button = event.target.closest('[data-demo-copy]');
      const old = button.textContent;
      button.textContent = 'Copiado';
      setTimeout(() => { button.textContent = old; }, 1000);
      return;
    }
    if (event.target.closest('[data-demo-reset]')) {
      const id = String(school?.id ?? '');
      const newCode = `PCI-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
      codeOverrides.set(id, newCode);
      const codeCell = row.querySelector('[data-code]');
      if (codeCell) codeCell.textContent = newCode;
    }
  });

  function rerender() {
    if (!Array.isArray(window.schools || schools) || !(window.schools || schools).length) {
      setTimeout(rerender, 150);
      return;
    }
    const list = window.schools || schools;
    renderAdminAll(list);
    renderSupAll(list);
  }

  window.addEventListener('load', () => setTimeout(rerender, 0));
})();
