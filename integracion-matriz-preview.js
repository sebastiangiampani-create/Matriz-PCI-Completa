(() => {
  'use strict';
  // Solo vista aislada. Nunca consulta ni modifica Supabase, sesiones o escuelas.
  const CONFIG_KEY = 'pci-matriz-integration-preview-orientations-20261010';
  const V2_KEY = 'pci-matriz-fg-v2-original-preview-20261009';
  const CATALOG_URL = 'data/integracion-curricular/referencia-v2/catalogo-orientaciones.json';
  const DEFAULTS = ['Economía y Administración', 'Matemática y Física'];
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  const orientationSelect = $('pciDemoOrientationSelect');
  const list = $('pciDemoOrientations');
  const count = $('pciDemoCount');
  const overlay = $('pci-map-overlay');
  const iframe = $('pci-map-iframe');
  const yearSelect = $('pciMapYear');
  if (!orientationSelect || !list || !overlay || !iframe || !yearSelect) return;

  let available = [];
  let enabled = DEFAULTS.slice();
  let active = DEFAULTS[0];
  let frameReady = false;
  let previousFocus = null;

  try {
    const stored = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null');
    if (stored && Array.isArray(stored.enabled)) {
      enabled = stored.enabled.filter((x) => typeof x === 'string');
      if (typeof stored.active === 'string') active = stored.active;
    }
  } catch (_) { /* Un estado de prueba ilegible no afecta la Matriz. */ }

  function remember() {
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify({ enabled, active })); }
    catch (_) { /* Navegación disponible sin almacenamiento. */ }
  }
  function readOffer() {
    try { return JSON.parse(localStorage.getItem(V2_KEY) || 'null'); }
    catch (_) { return null; }
  }
  function orientationMap() {
    const data = readOffer();
    return data && data.maps && typeof data.maps === 'object' ? data.maps[active] : null;
  }
  function updateOfferSummary() {
    const title = $('pciDemoActiveHeading');
    const status = $('pciDemoOfferState');
    const label = $('pciDemoOrientationContext');
    const container = $('pciDemoFoCards');
    if (title) title.textContent = active;
    if (label) label.textContent = active;
    const map = orientationMap();
    if (status) status.textContent = map?.valid
      ? 'Mapa de la Oferta validado en la prueba'
      : 'Mapa de la Oferta pendiente de validar';
    if (!container) return;
    const placements = map?.placements && typeof map.placements === 'object' ? map.placements : {};
    const years = [3, 4, 5];
    container.innerHTML = years.map((year) => {
      const terms = new Set([year * 2 - 1, year * 2]);
      const foIds = new Set();
      const activeSlots = new Set();
      for (const [slot, ids] of Object.entries(placements)) {
        if (!Array.isArray(ids)) continue;
        const term = slot.match(/-c(\d+)$/);
        const annual = slot.match(/-n(\d+)$/);
        if (!((term && terms.has(Number(term[1]))) || (annual && Number(annual[1]) === year))) continue;
        const selected = ids.filter((id) => typeof id === 'string' && id.startsWith('fo-'));
        if (!selected.length) continue;
        activeSlots.add(slot);
        selected.forEach((id) => foIds.add(id));
      }
      return '<button type="button" class="area-card pci-fo-card" data-pci-map-year="' + year +
        '" style="--area-color:#b6a2df">' +
        '<div><span class="pill">Formación Orientada</span>' +
        '<h3>' + year + '.º año</h3>' +
        '<p>Materias de la orientación ' + esc(active) + '</p></div>' +
        '<footer><div><strong>' + foIds.size + ' materias FO ubicadas</strong>' +
        '<small>' + activeSlots.size + ' espacios con materias · sin % hasta homologar</small></div>' +
        '<strong aria-hidden="true">→</strong></footer></button>';
    }).join('');
    container.querySelectorAll('[data-pci-map-year]').forEach((button) => {
      button.addEventListener('click', () => openMap(Number(button.dataset.pciMapYear)));
    });
  }

  function renderSelections() {
    if (!available.length) return;
    enabled = [...new Set(enabled.filter((x) => available.includes(x)))];
    if (!enabled.length) enabled = [available[0]];
    if (!enabled.includes(active)) active = enabled[0];
    orientationSelect.innerHTML = enabled.map((name) =>
      '<option value="' + esc(name) + '"' + (name === active ? ' selected' : '') + '>' + esc(name) + '</option>'
    ).join('');
    list.innerHTML = available.map((name) =>
      '<label><input type="checkbox" value="' + esc(name) + '"' +
      (enabled.includes(name) ? ' checked' : '') + '><span>' + esc(name) + '</span></label>'
    ).join('');
    if (count) count.textContent = enabled.length === 1 ? '1 habilitada' : enabled.length + ' habilitadas';
    remember();
    updateOfferSummary();
  }

  function sendToMap(type, year) {
    if (!frameReady || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage({
      type, orientation: active, year: Number(year) || 1
    }, location.origin);
  }
  function setActive(name) {
    if (!enabled.includes(name)) return;
    active = name;
    remember();
    renderSelections();
    if (!overlay.hidden) sendToMap('matriz-preview:set-context', Number(yearSelect.value));
  }

  orientationSelect.addEventListener('change', () => setActive(orientationSelect.value));
  list.addEventListener('change', (event) => {
    if (event.target.tagName !== 'INPUT') return;
    const name = event.target.value;
    if (!available.includes(name)) return;
    if (event.target.checked) {
      if (!enabled.includes(name)) enabled.push(name);
    } else {
      if (enabled.length === 1) {
        event.target.checked = true;
        return;
      }
      enabled = enabled.filter((x) => x !== name);
    }
    if (!enabled.includes(active)) active = enabled[0];
    renderSelections();
    if (!overlay.hidden) sendToMap('matriz-preview:set-context', Number(yearSelect.value));
  });

  function openMap(year = 1) {
    year = Math.min(5, Math.max(1, Number(year) || 1));
    yearSelect.value = String(year);
    previousFocus = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add('pci-map-expanded');
    $('pciMapActive').textContent = active;
    frameReady = false;
    const url = new URL('preview-v2-real/app.html', document.baseURI);
    url.searchParams.set('matriz-preview', '1');
    url.searchParams.set('orientation', active);
    url.searchParams.set('year', String(year));
    iframe.src = url.href;
    $('pciMapClose').focus();
  }

  function closeMap() {
    overlay.hidden = true;
    document.body.classList.remove('pci-map-expanded');
    frameReady = false;
    iframe.removeAttribute('src');
    updateOfferSummary();
    if (previousFocus?.isConnected) previousFocus.focus();
  }

  $('pciMapOpen').addEventListener('click', () => openMap(Number(yearSelect.value) || 1));
  $('pciMapClose').addEventListener('click', closeMap);
  yearSelect.addEventListener('change', () => sendToMap('matriz-preview:set-context', Number(yearSelect.value)));
  $('pciMapPrint').addEventListener('click', () => {
    if (!frameReady) return;
    sendToMap('matriz-preview:print-year', Number(yearSelect.value));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !overlay.hidden) closeMap();
  });

  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.source !== iframe.contentWindow) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'matriz-preview:ready') {
      frameReady = true;
      $('pciMapPrint').disabled = false;
      $('pciMapActive').textContent = active;
      sendToMap('matriz-preview:set-context', Number(yearSelect.value));
      updateOfferSummary();
    }
    if (data.type === 'matriz-preview:changed') {
      const v2state = readOffer();
      const m = v2state?.maps?.[active];
      if (m?.bagYear >= 1 && m.bagYear <= 5) yearSelect.value = String(m.bagYear);
      updateOfferSummary();
    }
    if (data.type === 'matriz-preview:close') closeMap();
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== V2_KEY) return;
    const y = Number(orientationMap()?.bagYear);
    if (y >= 1 && y <= 5 && !overlay.hidden) yearSelect.value = String(y);
    updateOfferSummary();
  });

  $('pciMapPrint').disabled = true;
  fetch(CATALOG_URL, { cache: 'no-store' })
    .then((r) => { if (!r.ok) throw new Error('Catálogo no disponible'); return r.json(); })
    .then((catalog) => {
      available = (catalog.orientaciones || []).flatMap((entry) =>
        entry.variantes?.length ? entry.variantes.map((item) => item.nombre) : [entry.nombre]
      ).filter((name) => typeof name === 'string' && name.trim());
      renderSelections();
    })
    .catch(() => {
      available = DEFAULTS.slice();
      renderSelections();
      const hint = $('pciDemoCatalogStatus');
      if (hint) hint.textContent = 'No se pudo cargar el catálogo completo de orientaciones de la prueba.';
    });
})();