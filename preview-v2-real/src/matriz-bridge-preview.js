(() => {
  'use strict';
  // Puente exclusivamente visual: no reemplaza las reglas V2 ni su guardado local aislado.
  const params = new URLSearchParams(location.search);
  if (params.get('matriz-preview') !== '1') return;
  const origin = location.origin;
  let booted = false;

  function yearFrom(value) {
    const y = Number(value);
    return Number.isInteger(y) && y >= 1 && y <= 5 ? y : 1;
  }

  function tellHost(type) {
    if (window.parent === window) return;
    window.parent.postMessage({ type }, origin);
  }

  function prepareEmbeddedStyle() {
    document.body.classList.add('matriz-embedded-preview');
    const style = document.createElement('style');
    style.id = 'matrizEmbeddedMapStyle';
    style.textContent = [
      'body.matriz-embedded-preview #pciGlobalDock,',
      'body.matriz-embedded-preview #institutionalFooter,',
      'body.matriz-embedded-preview #offer > button.back {display:none!important}',
      'body.matriz-embedded-preview .wrap{padding:14px clamp(8px,1.3vw,22px) 40px;max-width:none}',
      'body.matriz-embedded-preview #offer .hero{padding:12px 18px;margin:-14px -22px 13px;border-radius:0}',
      'body.matriz-embedded-preview #offer .hero h1{font-size:clamp(1.35rem,2.3vw,2.2rem)}',
      'body.matriz-embedded-preview .workspace{align-items:start}',
      '@media(max-width:800px){',
      'body.matriz-embedded-preview .wrap{padding:10px 7px 25px}',
      'body.matriz-embedded-preview #offer .hero{margin:-10px -7px 10px;padding:10px 12px}',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function applyContext(orientation, value) {
    if (!booted) return;
    const next = String(orientation || '');
    if (Array.isArray(ORIENTATIONS) && ORIENTATIONS.includes(next)) {
      if (!state.selected.includes(next)) state.selected.push(next);
      state.active = next;
    }
    const m = ensure(state.active);
    m.bagYear = yearFrom(value);
    save();                 // Solo la clave local de demostración de V2.
    renderHome();
    screen('offer');        // Ir directamente al mapa; no presentar otra portada.
    tellHost('matriz-preview:changed');
  }

  function prepareYearPrint(value) {
    if (!booted || typeof printPCI !== 'function') return;
    const year = yearFrom(value);
    printPCI();             // Impresor de la copia auténtica de V2.
    const sheet = document.querySelector('#printModal .pci-print-sheet');
    if (!sheet) {
      tellHost('matriz-preview:changed');
      return;
    }
    const sections = [...sheet.querySelectorAll('.pci-print-level')];
    if (sections.length !== 5) {
      console.warn('La impresión por año requiere verificar las cinco secciones originales V2.');
      return;
    }
    sections.forEach((section, index) => {
      section.style.display = index + 1 === year ? '' : 'none';
    });
    const title = sheet.querySelector('h1');
    if (title) title.textContent = 'Mapa de la Oferta · ' + year + '.º año';
    const meta = sheet.querySelector('.pci-print-meta');
    if (meta) {
      const node = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = 'Año / nivel';
      node.append(name, document.createTextNode(' ' + year + '.º · C' + (year * 2 - 1) + ' y C' + (year * 2)));
      meta.appendChild(node);
    }
    // La copia curricular no importa módulos de docentes ni de calificaciones.
    sheet.querySelectorAll('.pci-print-teacher').forEach((node) => node.remove());
    sheet.querySelectorAll('.pci-print-badge').forEach((node) => {
      if (node.textContent.trim().startsWith('Docentes:')) node.remove();
    });
    const footer = sheet.querySelector('.pci-print-footer');
    if (footer) {
      const line = footer.querySelector('br');
      if (line) {
        while (line.nextSibling) line.nextSibling.remove();
        line.remove();
      }
    }
    const modal = document.getElementById('printModal');
    if (modal) modal.classList.add('open');
    tellHost('matriz-preview:changed');
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.origin !== origin || !booted) return;
    const data = event.data;
    if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
    if (data.type === 'matriz-preview:set-context') applyContext(data.orientation, data.year);
    if (data.type === 'matriz-preview:print-year') {
      applyContext(data.orientation, data.year);
      prepareYearPrint(data.year);
    }
  });

  window.addEventListener('pci-app-ready', () => {
    booted = true;
    prepareEmbeddedStyle();
    applyContext(params.get('orientation'), params.get('year'));
    tellHost('matriz-preview:ready');
  }, { once: true });
})();