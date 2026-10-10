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
          ? offer.count + ' formatos en el mapa'
          : offer.count + ' ' + noun + (offer.count === 1 ? '' : 's') + ' · Mapa V2';
      }
      let summary = tile.querySelector('.pci-map-count');
      if (!summary) {
        summary = document.createElement('small');
        summary.className = 'pci-map-count';
        tile.querySelector('div')?.appendChild(summary);
      }
      summary.textContent = offer.occupied + '/' + offer.count + ' espacios con materias en el mapa · sin % homologado';
      const legacy = tile.querySelector('footer strong');
      if (legacy) {
        if (!legacy.dataset.pciLegacyLabel) legacy.dataset.pciLegacyLabel = legacy.textContent.trim();
        legacy.textContent = 'FG anterior: ' + legacy.dataset.pciLegacyLabel;
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
    if (!projection) return;
    const offer = projection.deriveAreaProjection(area, orientationMap());
    if (!offer) return;
    const map = orientationMap();
    const modal = $('pci-area-detail');
    if (!modal) return;
    modal.dataset.area = area;
    $('pciAreaDetailTitle').textContent = area;
    $('pciAreaDetailOrientation').textContent = 'Orientación: ' + active;
    const source = map ? 'Mapa de la Oferta de la orientación' : 'Estructura inicial V2 pendiente de conformación';
    const type = area === 'Ciencias Sociales'
      ? (offer.socialOption === 'B'
        ? ' · opción de 12 laboratorios (2 + 2 en 3.º)'
        : ' · opción de 10 laboratorios (4 materias juntas en 3.º)')
      : '';
    $('pciAreaDetailStatus').textContent = source + type + '. ' +
      offer.count + ' espacios previstos, ' + offer.occupied + ' con materias ubicadas. ' +
      'La homologación de contenidos y sus porcentajes todavía está pendiente.';
    $('pciAreaDetailGroups').innerHTML = offer.years
      .filter(year => year.count > 0)
      .map(year =>
        '<section class="pci-offer-year-card"><h3>' + year.year + '.º año · ' +
        year.count + ' espacio' + (year.count === 1 ? '' : 's') +
        ' · C' + (year.year * 2 - 1) + ' y C' + (year.year * 2) +
        '</h3><p class="pci-year-note">' + year.occupied + ' con materias en el mapa de esta orientación</p>' +
        year.groups.map(group => describeGroup(group, offer, map)).join('') + '</section>'
      ).join('') || '<p>No se definieron ubicaciones en el mapa de esta orientación.</p>';

    const saved = window.PCIApp?.getState?.()?.areas?.[area]?.groups;
    const historic = Array.isArray(saved) ? saved.length : 0;
    $('pciAreaDetailLegacyInfo').textContent = historic + ' agrupamientos históricos conservados en Matriz. ' +
      'Sus contenidos, objetivos, planes y secuencias no se modifican por elegir la opción de ' + offer.count +
      ' espacios del Mapa V2. Abrirlos muestra la FG anterior, no una migración automática.';
    $('pciAreaDetailLegacy').disabled = !Array.isArray(saved);
    if (!modal.open) modal.showModal();
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
  $('pciAreaDetailLegacy')?.addEventListener('click', () => {
    const area = $('pci-area-detail').dataset.area;
    $('pci-area-detail').close();
    window.PCIApp?.openArea?.(area);
  });
  $('pciAreaDetailMap')?.addEventListener('click', () => {
    $('pci-area-detail').close();
    openMap(Number(yearSelect.value) || 1);
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
      console.error('No se pudo leer la proyección del Mapa V2:', error);
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