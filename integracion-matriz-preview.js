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

  let projection = null;
  let subjectCatalog = null;
  const slug = (value) => String(value ?? '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const singular = (area) => ['Ciencias Sociales', 'Ciencias Naturales'].includes(area)
    ? 'laboratorio'
    : ['Artes', 'Tecnologías', 'Educación Física'].includes(area) ? 'taller' : 'espacio';

  function subjectName(id, map) {
    if (typeof id !== 'string') return '';
    const custom = Array.isArray(map?.custom) ? map.custom.find((item) => item?.id === id) : null;
    if (custom?.name) return String(custom.name);
    const fg = id.match(/^fg-([1-5])-(.+)$/);
    if (fg) {
      for (const name of subjectCatalog?.formacion_general?.[fg[1]] || []) {
        if (id === 'fg-' + fg[1] + '-' + slug(name)) return String(name);
      }
    }
    const fo = id.match(/^fo-(.+)-([345])-(\d+)$/);
    if (fo && fo[1] === slug(active)) {
      const data = subjectCatalog?.formacion_orientada?.[active] || {};
      const year = fo[2];
      const alternatives = map?.alt === 'B' ? 'B' : 'A';
      const list = year === '3' ? data['3'] : data[alternatives]?.[year];
      if (Array.isArray(list) && list[Number(fo[3])]) return String(list[Number(fo[3])]);
    }
    return id;
  }

  function projectMosaics(map) {
    if (!projection || !document.getElementById('areaGrid')) return;
    const tiles = [...$('areaGrid').querySelectorAll('button[data-area]')];
    for (const tile of tiles) {
      const area = tile.dataset.area;
      const offer = projection.deriveAreaProjection(area, map);
      if (!offer) continue;
      const pill = tile.querySelector('.pill');
      const noun = singular(area);
      if (pill) {
        pill.textContent = area === 'Otros formatos pedagógicos'
          ? offer.count + ' formatos'
          : offer.count + ' ' + (noun === 'espacio' ? 'niveles' : noun + (offer.count === 1 ? '' : 's'));
      }
      const footerInfo = tile.querySelector('footer > div');
      const legacy = footerInfo?.querySelector(':scope > strong');
      let summary = footerInfo?.querySelector('.pci-map-count');
      if (!summary && footerInfo) {
        summary = document.createElement('small');
        summary.className = 'pci-map-count';
        footerInfo.insertBefore(summary, legacy || footerInfo.firstChild);
      }
      if (summary) {
        summary.textContent = offer.count ? offer.occupied + '/' + offer.count + ' con materias' : 'Sin espacios definidos';
        summary.title = offer.occupied + ' de ' + offer.count + ' espacios con materias ubicadas en el Mapa de la Oferta. No representa cobertura de contenidos.';
      }
      if (legacy) {
        if (!legacy.dataset.pciLegacyLabel) legacy.dataset.pciLegacyLabel = legacy.textContent.trim();
        const previous = legacy.dataset.pciLegacyLabel.match(/^(\d+)\s*\/\s*(\d+)/);
        legacy.textContent = previous
          ? 'Contenidos anteriores: ' + previous[1] + '/' + previous[2]
          : 'Contenidos anteriores: ' + legacy.dataset.pciLegacyLabel;
      }
    }
  }

  function describeGroup(group, offer, map) {
    const year = group.year;
    const part = group.key === 'socialA' && offer.socialOption === 'B'
      ? ' · Laboratorio A' : group.key === 'socialB' ? ' · Laboratorio B' : '';
    const location = group.term ? 'C' + group.term : 'C' + (year * 2 - 1) + ' + C' + (year * 2);
    return '<div class="pci-offer-group"><strong>' +
      esc(group.format === 'anual' ? 'Espacio anual · ' + location : 'Espacio ' + group.number + ' · ' + location + part) +
      '</strong><p>' + (group.subjectIds.length
        ? esc(group.subjectIds.map(id => subjectName(id, map)).join(' + '))
        : 'Sin materias ubicadas todavía') + '</p></div>';
  }

  function showAreaDetail(area) {
    // No duplicar el editor original: tras el OK, la misma bolsa curricular
    // y los agrupamientos se editan en una copia independiente por orientación.
    if (window.PCIApp?.isOrientationReady?.(active)) {
      window.PCIApp.openArea(area);
      return;
    }
    $('pciImportOpen')?.click();
  }

  function updateOfferSummary() {
    const title = $('pciDemoActiveHeading');
    const status = $('pciDemoOfferState');
    const label = $('pciDemoOrientationContext');
    const container = $('pciDemoFoCards');
    if (title) title.textContent = active;
    if (label) label.textContent = active;
    const map = orientationMap();
    projectMosaics(map);
    if (status) status.textContent = map?.valid
      ? 'Mapa de la Oferta validado en la prueba'
      : 'Mapa de la Oferta pendiente de validar';
    if (!container) return;
    // Una sola sección de orientación: tres formatos, no una tarjeta por año.
    const categories = projection?.deriveFoFormatSummary(map) || [];
    container.innerHTML = categories.map(item => {
      const available = item.pendingDefinitions > 0
        ? item.pendingDefinitions + ' formatos por definir'
        : '';
      const placed = item.occupied + '/' + item.count + ' con materias';
      const lines = item.id === 'proyecto'
        ? 'Espacio anual de 5.º año · C9 y C10'
        : '3.º, 4.º y 5.º año · según el mapa de esta orientación';
      const tint = item.id === 'laboratorios' ? '#b6a2df'
        : item.id === 'talleres' ? '#a9c9f1' : '#8dd2be';
      const badge = item.id === 'proyecto' ? 'Anual · 5.º' : item.count + ' espacios definidos';
      return '<button type="button" class="area-card pci-fo-card pci-fo-' + esc(item.id) +
        '" data-pci-fo-format="' + esc(item.id) + '" style="--area-color:' + tint + '">' +
        '<div><span class="pill">' + esc(badge) + '</span>' +
        '<h3>' + esc(item.label) + '</h3><p>' + esc(lines) + '</p></div>' +
        '<footer><div><strong>' + esc(placed) + '</strong>' +
        '<small class="pci-fo-pending"' + (available ? '' : ' hidden') + '>' + esc(available) + '</small>' +
        '</div><strong aria-hidden="true">→</strong></footer></button>';
    }).join('');
    container.querySelectorAll('[data-pci-fo-format]').forEach(button =>
      button.addEventListener('click', () => {
        if(window.PCIFoDesarrollo) window.PCIFoDesarrollo.open(button.dataset.pciFoFormat,button.dataset.pciFoFormat === 'proyecto'?5:null);
        else showFoDetail(button.dataset.pciFoFormat);
      }));
    window.dispatchEvent(new Event('pci-matriz-offer-update'));
  }

  function showFoDetail(formatId) {
    if (!projection) return;
    const category = projection.deriveFoFormatSummary(orientationMap())
      .find(item => item.id === formatId);
    if (!category) return;
    const modal = $('pci-area-detail');
    if (!modal) return;
    modal.dataset.area = '';
    modal.dataset.year = String(category.year);
    $('pciAreaDetailTitle').textContent = category.label;
    $('pciAreaDetailOrientation').textContent = 'Orientación: ' + active;
    $('pciAreaDetailStatus').textContent =
      category.count + ' espacios de la oferta, ' + category.occupied + ' con materias ubicadas.' +
      (category.pendingDefinitions
        ? ' Restan definir ' + category.pendingDefinitions + ' formatos de 3.º y 4.º año.'
        : '') + ' Los porcentajes se habilitarán cuando concluya la homologación.';
    $('pciAreaDetailGroups').innerHTML = category.years.map(entry =>
      '<section class="pci-offer-year-card"><h3>' + entry.year + '.º año · C' +
      (entry.year * 2 - 1) + ' y C' + (entry.year * 2) + '</h3>' +
      entry.groups.map(group => {
        const term = group.term ? 'C' + group.term : 'C9 + C10 (anual)';
        const subjects = group.subjectIds.length
          ? group.subjectIds.map(id => subjectName(id, orientationMap())).join(' + ')
          : 'Sin materias ubicadas todavía';
        return '<div class="pci-offer-group"><strong>' + esc(term) + '</strong>' +
          '<p>' + esc(subjects) + '</p></div>';
      }).join('') + '</section>'
    ).join('') || '<p>La distribución de este formato todavía no está definida.</p>';
    const legacy = modal.querySelector('.pci-area-detail-legacy');
    if (legacy) legacy.hidden = true;
    $('pciAreaDetailMap').textContent = 'Abrir Mapa de la Oferta para configurar';
    if (!modal.open) modal.showModal();
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
    const tabs = $('pciDemoOrientationTabs');
    if (tabs) {
      tabs.innerHTML = enabled.map(name =>
        '<button type="button" aria-pressed="' + String(name === active) +
        '" data-orientation="' + esc(name) + '">' + esc(name) + '</button>'
      ).join('');
      tabs.querySelectorAll('button[data-orientation]').forEach(button =>
        button.addEventListener('click', () => setActive(button.dataset.orientation)));
    }
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
    // Cada orientación mantiene su copia editable independiente.
    window.PCIApp?.switchOrientationDraft?.(active);
    remember();
    renderSelections();
    if (!overlay.hidden) sendToMap('matriz-preview:set-context', Number(yearSelect.value));
  }


  const originalGrid = $('areaGrid');
  if (originalGrid) {
    // Captura antes del listener histórico del botón: no abrir 12 laboratorios
    // antiguos como si fueran los 10/12 del mapa de la orientación.
    originalGrid.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-area]');
      if (!button || !projection) return;
      event.preventDefault();
      event.stopPropagation();
      showAreaDetail(button.dataset.area);
    }, true);
  }
  $('pciAreaDetailClose')?.addEventListener('click', () => $('pci-area-detail').close());
  $('pciAreaDetailMap')?.addEventListener('click', () => {
    $('pci-area-detail').close();
    openMap(Number($('pci-area-detail').dataset.year || yearSelect.value) || 1);
  });

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
    if (data.type === 'matriz-preview:changed' || data.type === 'matriz-preview:validated') {
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
  import('./src/integracion-curricular/proyeccion-oferta-matriz.js')
    .then((helpers) => {
      projection = helpers;
      // Matriz reconstruye los mosaicos al volver de una pantalla. Mantener
      // la proyección en las tarjetas SIN tocar app.areas ni pciAppV2.
      const grid = $('areaGrid');
      if (grid) new MutationObserver((changes) => {
        if (changes.some((change) => change.target === grid)) projectMosaics(orientationMap());
      }).observe(grid, {childList: true});
      updateOfferSummary();
    })
    .catch((error) => {
      console.error('No se pudo leer la composición de la oferta:', error);
      const hint = $('pciDemoCatalogStatus');
      if (hint) hint.textContent = 'No se pudo leer la composición del mapa en esta prueba.';
    });
  fetch('preview-v2-real/data/materias-v2.json', {cache: 'no-store'})
    .then(r => { if (!r.ok) throw new Error('Bolsa curricular no disponible'); return r.json(); })
    .then(data => { subjectCatalog = data; })
    .catch(() => { subjectCatalog = null; });
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