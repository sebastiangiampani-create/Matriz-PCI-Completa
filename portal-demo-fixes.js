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

  function showDemoSchool(school, mode) {
    if (!school) return;
    const existing = document.getElementById('demoSchoolModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'demoSchoolModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:20px;background:rgba(21,55,74,.45)';
    modal.innerHTML = `
      <div style="width:min(620px,100%);padding:24px;border-radius:22px;background:#fff;box-shadow:0 24px 70px #15374a40">
        <div style="font-size:.75rem;font-weight:900;color:#126e65;text-transform:uppercase;letter-spacing:.08em">Vista de demostración</div>
        <h2 style="margin:8px 0 4px">${esc(school.name)}</h2>
        <p style="margin:0 0 14px;color:#6a7b84">CUE: ${esc(school.cue || '—')}</p>
        <p style="line-height:1.5">En producción, este botón abrirá el PCI propio de esta escuela en modo <strong>${mode === 'edit' ? 'edición' : 'consulta'}</strong>. En esta rama no se crea todavía un PCI real para las escuelas importadas, para no tocar las escuelas muestra ni publicar credenciales.</p>
        <div style="display:flex;gap:8px;justify-content:flex-end"><button class="button primary" type="button" data-close-demo>Cerrar</button></div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-close-demo]').onclick = () => modal.remove();
    modal.onclick = (event) => { if (event.target === modal) modal.remove(); };
  }

  document.addEventListener('click', async (event) => {
    const row = event.target.closest('tr[data-school-id]');
    if (!row) return;
    const school = findSchoolFromRow(row);
    if (event.target.closest('[data-demo-open]')) {
      showDemoSchool(school, 'edit');
      return;
    }
    if (event.target.closest('[data-demo-view]')) {
      showDemoSchool(school, 'view');
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
