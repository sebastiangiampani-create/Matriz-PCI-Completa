(() => {
  const headerUrl = new URL('plan-sa-header.svg', window.location.href).href;
  const footerUrl = new URL('plan-sa-footer.svg', window.location.href).href;

  function ensureEditorBranding() {
    const shell = document.getElementById('pciPlansShell');
    const form = document.getElementById('pciPlanForm');
    if (!shell || !form || shell.querySelector('[data-plan-model-branding]')) return;
    const top = shell.querySelector('.pci-plan-top');
    const brand = document.createElement('div');
    brand.dataset.planModelBranding = '1';
    brand.style.cssText = 'padding:12px 18px 0;background:#fff';
    brand.innerHTML = `<img src="${headerUrl}" alt="Escuela de Maestros · Secundaria aprende" style="display:block;width:100%;max-height:76px;object-fit:contain">`;
    if (top?.nextSibling) shell.insertBefore(brand, top.nextSibling);
    else shell.prepend(brand);
  }

  function applyBranding(html) {
    if (!html || !html.includes('print-sheet') || html.includes('plan-model-header')) return html;
    const extraCss = `
      .plan-model-header,.plan-model-footer{max-width:185mm;margin-left:auto;margin-right:auto}
      .plan-model-header{margin-bottom:8mm}.plan-model-footer{margin-top:10mm}
      .plan-model-header img,.plan-model-footer img{display:block;width:100%;height:auto}
      @media print{
        @page{size:A4;margin:24mm 14mm 25mm}
        .plan-model-header{position:fixed;top:-20mm;left:0;right:0;width:100%;max-width:none;margin:0;z-index:20}
        .plan-model-header img{width:100%;height:13.5mm;object-fit:contain}
        .plan-model-footer{position:fixed;bottom:-21mm;left:0;right:0;width:100%;max-width:none;margin:0;z-index:20}
        .plan-model-footer img{width:100%;height:16mm;object-fit:cover}
      }
    `;
    html = html.replace('</style>', `${extraCss}</style>`);
    html = html.replace('<main class="print-sheet">', `<div class="plan-model-header"><img src="${headerUrl}" alt="Escuela de Maestros · Secundaria aprende"></div><main class="print-sheet">`);
    html = html.replace('</main>', `</main><div class="plan-model-footer"><img src="${footerUrl}" alt="Ministerio de Educación · Buenos Aires Ciudad"></div>`);
    return html;
  }

  const originalOpen = window.open.bind(window);
  window.open = function (...args) {
    const popup = originalOpen(...args);
    if (!popup) return popup;
    try {
      const originalWrite = popup.document.write.bind(popup.document);
      popup.document.write = (...parts) => originalWrite(applyBranding(parts.join('')));
    } catch (error) {
      console.warn('No se pudo aplicar identidad institucional a la vista previa.', error);
    }
    return popup;
  };

  const observer = new MutationObserver(ensureEditorBranding);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('DOMContentLoaded', ensureEditorBranding);
  setTimeout(ensureEditorBranding, 0);
})();
