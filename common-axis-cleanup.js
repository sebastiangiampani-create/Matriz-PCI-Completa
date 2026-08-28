function cleanTrailingAxisPlaceholders(value) {
  const text = String(value ?? '');
  return text
    .replace(/\s+(?:[—–-]\s*)+$/u, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanNodeText(node) {
  if (!node) return;
  const current = node.textContent ?? '';
  const cleaned = cleanTrailingAxisPlaceholders(current);
  if (cleaned !== current) node.textContent = cleaned;
}

function cleanAxisPresentation() {
  document.querySelectorAll('#axisFilter option').forEach((option) => {
    if (!option.value) return;
    cleanNodeText(option);
  });

  document.querySelectorAll('.content-item small, .assigned-item small, .matrix-content-row small').forEach(cleanNodeText);
  document.querySelectorAll('#controlRows td:nth-child(3)').forEach(cleanNodeText);
}

let queued = false;
function queueClean() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    cleanAxisPresentation();
  });
}

const observer = new MutationObserver(queueClean);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', queueClean);
window.addEventListener('pci-state-change', queueClean);
setTimeout(queueClean, 0);
