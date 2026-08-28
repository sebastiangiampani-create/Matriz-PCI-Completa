(() => {
  const CHUNKS = Array.from({ length: 9 }, (_, index) => `./data/ingles-${index + 1}.json`);
  const RESOLUTION_TEXT = 'En el caso de Inglés, se adopta el Diseño Curricular de Lenguas Extranjeras (Inglés), Resolución N° 260- SED/2001, vigente en la Ciudad Autónoma de Buenos Aires para el nivel secundario; y sus modificatorias.';
  const originalFetch = window.fetch.bind(window);
  const metadata = new Map();
  let englishPromise = null;
  let queued = false;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);

  function normalizeAxis(value) {
    return String(value ?? '').replace('Comprensión y production', 'Comprensión y producción');
  }

  async function loadEnglish() {
    if (englishPromise) return englishPromise;
    englishPromise = Promise.all(CHUNKS.map(async (url) => {
      const response = await originalFetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`No se pudo cargar ${url}`);
      const rows = await response.json();
      return Array.isArray(rows) ? rows : [];
    })).then((parts) => {
      let index = 0;
      return parts.flat().map((row) => {
        index += 1;
        const years = String(row?.[0] ?? '');
        const level = String(row?.[1] ?? '');
        const axis = normalizeAxis(row?.[2]);
        const text = String(row?.[3] ?? '');
        const id = `tecnica-ingles-${String(index).padStart(4, '0')}`;
        metadata.set(id, { years, level, axis, text });
        return {
          id,
          area: 'Lenguas Adicionales',
          subject: 'Inglés',
          axis,
          text,
        };
      }).filter((item) => item.text);
    });
    return englishPromise;
  }

  window.fetch = async function patchedFetch(input, init) {
    const url = typeof input === 'string' ? input : String(input?.url ?? '');
    if (!/(^|\/)data\/contents\.json(?:\?|$)/.test(url)) return originalFetch(input, init);

    const [baseResponse, english] = await Promise.all([
      originalFetch(input, init),
      loadEnglish(),
    ]);
    let base = [];
    if (baseResponse.ok) {
      try {
        const parsed = await baseResponse.clone().json();
        if (Array.isArray(parsed)) base = parsed;
      } catch {}
    }
    return new Response(JSON.stringify([...base, ...english]), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  };

  function currentArea() {
    return window.PCIApp?.getState?.()?.current ?? null;
  }

  function unique(field) {
    return [...new Set([...metadata.values()].map((item) => item[field]).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  }

  function option(value, label = value) {
    return `<option value="${esc(value)}">${esc(label)}</option>`;
  }

  function ensureStyles() {
    if (document.getElementById('technicalEnglishStyles')) return;
    const style = document.createElement('style');
    style.id = 'technicalEnglishStyles';
    style.textContent = `
      .english-resolution-note{margin:10px 0 0;padding:10px 12px;border:1px solid #c9d6da;border-radius:12px;background:#f4f8f9;color:var(--ink-soft);font-size:.78rem;line-height:1.42}
      .english-filter-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .english-filter-grid label>span{display:block;margin:0 0 5px;color:var(--ink-soft);font-size:.78rem;font-weight:850}
      .english-filter-grid select{min-width:0}
      @media(max-width:520px){.english-filter-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureFilters() {
    const filters = document.querySelector('#contentBag .filters');
    if (!filters) return null;
    let block = filters.querySelector('[data-english-filters]');
    if (!block) {
      block = document.createElement('div');
      block.dataset.englishFilters = '1';
      block.className = 'english-filter-grid';
      block.innerHTML = `
        <label><span>Años</span><select data-english-years><option value="">Todos</option></select></label>
        <label><span>Nivel</span><select data-english-level><option value="">Todos</option></select></label>
        <label><span>Eje</span><select data-english-axis><option value="">Todos</option></select></label>
        <label><span>Contenido</span><select data-english-content><option value="">Todos</option></select></label>`;
      const pending = filters.querySelector('.check-row');
      filters.insertBefore(block, pending ?? null);
      block.addEventListener('change', applyFilters);
    }

    const years = block.querySelector('[data-english-years]');
    const level = block.querySelector('[data-english-level]');
    const axis = block.querySelector('[data-english-axis]');
    const content = block.querySelector('[data-english-content]');
    if (!block.dataset.ready && metadata.size) {
      years.innerHTML = '<option value="">Todos</option>' + unique('years').map((value) => option(value)).join('');
      level.innerHTML = '<option value="">Todos</option>' + unique('level').map((value) => option(value)).join('');
      axis.innerHTML = '<option value="">Todos</option>' + unique('axis').map((value) => option(value)).join('');
      content.innerHTML = '<option value="">Todos</option>' + [...metadata.entries()]
        .map(([id, item]) => option(id, item.text.length > 95 ? `${item.text.slice(0, 92)}…` : item.text))
        .join('');
      block.dataset.ready = '1';
    }
    return block;
  }

  function syncResolutionNote(active) {
    const description = document.getElementById('boardDescription');
    if (!description) return;
    let note = document.querySelector('[data-english-resolution]');
    if (active && !note) {
      note = document.createElement('div');
      note.dataset.englishResolution = '1';
      note.className = 'english-resolution-note';
      note.textContent = RESOLUTION_TEXT;
      description.insertAdjacentElement('afterend', note);
    }
    if (note) note.hidden = !active;
  }

  function applyFilters() {
    if (currentArea() !== 'Lenguas Adicionales') return;
    const block = document.querySelector('[data-english-filters]');
    if (!block) return;
    const years = block.querySelector('[data-english-years]')?.value ?? '';
    const level = block.querySelector('[data-english-level]')?.value ?? '';
    const axis = block.querySelector('[data-english-axis]')?.value ?? '';
    const content = block.querySelector('[data-english-content]')?.value ?? '';
    let visible = 0;
    document.querySelectorAll('#contentList .content-item[data-content-id]').forEach((node) => {
      const id = String(node.dataset.contentId ?? '');
      const item = metadata.get(id);
      const match = item
        && (!years || item.years === years)
        && (!level || item.level === level)
        && (!axis || item.axis === axis)
        && (!content || id === content);
      node.hidden = !match;
      if (match) visible += 1;
    });
    const meta = document.getElementById('bagMeta');
    if (meta && (years || level || axis || content)) meta.textContent = `${visible} contenidos visibles con estos filtros`;
  }

  function syncUI() {
    ensureStyles();
    const active = currentArea() === 'Lenguas Adicionales';
    const block = ensureFilters();
    if (block) block.hidden = !active;
    const defaultPair = document.querySelector('#contentBag .filters .filter-pair');
    if (defaultPair) defaultPair.hidden = active;
    syncResolutionNote(active);
    if (active) applyFilters();
  }

  function queueSync() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      syncUI();
    });
  }

  loadEnglish().then(queueSync).catch(console.error);
  const observer = new MutationObserver(queueSync);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('DOMContentLoaded', queueSync);
  window.addEventListener('pci-state-change', queueSync);
  setTimeout(queueSync, 0);
})();
