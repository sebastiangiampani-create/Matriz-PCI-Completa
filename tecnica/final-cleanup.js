function cleanText() {
  const status = document.getElementById('structureStatus');
  if (status) {
    const verified = status.textContent.includes('Estructura Técnica verificada');
    status.hidden = verified;
    if (!verified && status.textContent.trim()) status.hidden = false;
  }

  const coverageHint = document.getElementById('coverageHint');
  if (coverageHint) coverageHint.textContent = 'Un mismo contenido puede formar parte de más de un espacio.';

  const controlLead = document.querySelector('#control .lead');
  if (controlLead) controlLead.textContent = 'Cada fila corresponde a un contenido priorizado y muestra los espacios donde fue ubicado.';

  document.querySelectorAll('[data-custom-section] .custom-heading small').forEach((node) => node.remove());
  document.querySelectorAll('.custom-content-item small').forEach((node) => {
    node.textContent = 'Contenido adicional';
  });
  document.querySelectorAll('[data-custom-detail].matrix-detail-meta').forEach((node) => {
    const count = node.querySelector('strong')?.textContent || '';
    const numeric = Number.parseInt(count, 10) || 0;
    node.innerHTML = `<strong>${numeric}</strong> contenido${numeric === 1 ? '' : 's'} adicional${numeric === 1 ? '' : 'es'}`;
  });
}

let queued = false;
function queueClean() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    cleanText();
  });
}

const observer = new MutationObserver(queueClean);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener('pci-state-change', queueClean);
window.addEventListener('DOMContentLoaded', queueClean);
setTimeout(queueClean, 0);
