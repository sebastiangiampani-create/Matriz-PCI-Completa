const STAGE_LABELS = {
  punto_partida: 'Punto de partida',
  indagacion: 'Indagación',
  produccion: 'Producción',
  evaluacion: 'Evaluación',
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

const nl2br = (value) => escapeHtml(value).replace(/\n/g, '<br>');
const sessionFiles = new Map();
let activeGroupId = null;
let activePlanNumber = null;

function appState() {
  return window.PCIApp?.getState?.() ?? null;
}

function curriculumData() {
  return window.PCIApp?.getData?.() ?? [];
}

function findGroup(groupId) {
  const current = appState();
  if (!current || !groupId) return null;
  for (const [area, areaState] of Object.entries(current.areas ?? {})) {
    const group = (areaState.groups ?? []).find((item) => item.id === groupId);
    if (group) return { area, group };
  }
  return null;
}

function currentPlanContext() {
  const found = findGroup(activeGroupId);
  if (!found || !activePlanNumber) return null;
  const plan = found.group.plansBimestrales?.[activePlanNumber - 1];
  if (!plan) return null;
  return { ...found, plan };
}

function ensureStageMaterials(stage) {
  if (!stage || typeof stage !== 'object') return [];
  if (!Array.isArray(stage.materials)) stage.materials = [];
  return stage.materials;
}

function persist() {
  const current = appState();
  if (!current) return;
  localStorage.setItem('pciAppV2', JSON.stringify(current));
  window.app = current;
  window.dispatchEvent(new CustomEvent('pci-state-change', { detail: { source: 'planes-media-print' } }));
}

function makeId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `material-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function fileSize(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

function youtubeId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.split('/').filter(Boolean)[0] || '';
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2] || '';
      if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2] || '';
      return parsed.searchParams.get('v') || '';
    }
  } catch {}
  return '';
}

function vimeoId(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('vimeo.com')) return '';
    return parsed.pathname.split('/').filter(Boolean).find((part) => /^\d+$/.test(part)) || '';
  } catch {}
  return '';
}

function extensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.includes('.') ? pathname.split('.').pop() : '';
  } catch {
    return '';
  }
}

function materialHref(material) {
  if (material.kind === 'link') return material.url || '';
  return sessionFiles.get(material.id)?.url || material.storageUrl || '';
}

function materialType(material) {
  const mime = String(material.mimeType || '').toLowerCase();
  const href = materialHref(material);
  const ext = extensionFromUrl(href);
  if (youtubeId(href)) return 'youtube';
  if (vimeoId(href)) return 'vimeo';
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v'].includes(ext)) return 'video';
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  return material.kind === 'link' ? 'link' : 'file';
}

function previewHtml(material) {
  if (!material.embed) return '';
  const href = materialHref(material);
  const type = materialType(material);
  if (!href) return '<div class="pci-material-session-note">Este archivo de prueba ya no está disponible en esta sesión. Volvé a adjuntarlo para previsualizarlo.</div>';
  if (type === 'youtube') {
    return `<div class="pci-material-embed"><iframe src="https://www.youtube.com/embed/${escapeHtml(youtubeId(href))}" title="${escapeHtml(material.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
  }
  if (type === 'vimeo') {
    return `<div class="pci-material-embed"><iframe src="https://player.vimeo.com/video/${escapeHtml(vimeoId(href))}" title="${escapeHtml(material.title)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
  }
  if (type === 'image') return `<div class="pci-material-embed"><img src="${escapeHtml(href)}" alt="${escapeHtml(material.title)}"></div>`;
  if (type === 'video') return `<div class="pci-material-embed"><video src="${escapeHtml(href)}" controls preload="metadata"></video></div>`;
  if (type === 'audio') return `<div class="pci-material-audio"><audio src="${escapeHtml(href)}" controls preload="metadata"></audio></div>`;
  if (type === 'pdf') return `<div class="pci-material-embed pdf"><iframe src="${escapeHtml(href)}" title="${escapeHtml(material.title)}" loading="lazy"></iframe></div>`;
  return '';
}

function ensureStyles() {
  if (document.getElementById('pciPlanMediaStyles')) return;
  const style = document.createElement('style');
  style.id = 'pciPlanMediaStyles';
  style.textContent = `
    .pci-plan-top-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
    .pci-stage-materials{padding:13px;border:1px dashed var(--line,#d6e2e5);border-radius:13px;background:#fbfdfd}
    .pci-material-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}
    .pci-material-heading strong{font-size:.82rem}.pci-material-buttons{display:flex;gap:7px;flex-wrap:wrap}
    .pci-material-list{display:grid;gap:10px}.pci-material-empty{color:var(--muted,#6a7b84);font-size:.8rem}
    .pci-material-card{padding:11px;border:1px solid var(--line,#d6e2e5);border-radius:12px;background:#fff}
    .pci-material-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.pci-material-title{min-width:0}
    .pci-material-title strong{display:block;overflow-wrap:anywhere}.pci-material-title small{display:block;margin-top:3px;color:var(--muted,#6a7b84)}
    .pci-material-actions{display:flex;gap:6px;flex-wrap:wrap}.pci-material-actions a,.pci-material-actions button{font-size:.75rem}
    .pci-material-options{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:9px;color:var(--muted,#6a7b84);font-size:.76rem;font-weight:800}
    .pci-material-embed{margin-top:10px;overflow:hidden;border-radius:11px;background:#edf3f4}.pci-material-embed iframe{display:block;width:100%;height:320px;border:0}.pci-material-embed img,.pci-material-embed video{display:block;width:100%;max-height:420px;object-fit:contain;background:#edf3f4}.pci-material-embed.pdf iframe{height:430px}.pci-material-audio{margin-top:10px}.pci-material-audio audio{width:100%}
    .pci-material-session-note{margin-top:9px;padding:9px;border-radius:9px;background:#fff7e8;color:#765b1f;font-size:.76rem;line-height:1.35}
    .pci-material-dialog{position:fixed;inset:0;z-index:2200;display:grid;place-items:center;padding:16px;background:rgba(15,45,61,.5)}.pci-material-dialog[hidden]{display:none}.pci-material-dialog-card{width:min(560px,100%);padding:18px;border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(21,55,74,.3)}.pci-material-dialog-card h3{margin:0 0 14px}.pci-material-dialog-fields{display:grid;gap:11px}.pci-material-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
    @media(max-width:760px){.pci-plan-top-tools{justify-content:flex-start}.pci-material-card-head{display:block}.pci-material-actions{margin-top:8px}.pci-material-embed iframe,.pci-material-embed.pdf iframe{height:250px}}
  `;
  document.head.appendChild(style);
}

function ensureDialog() {
  let dialog = document.getElementById('pciMaterialDialog');
  if (dialog) return dialog;
  dialog = document.createElement('div');
  dialog.id = 'pciMaterialDialog';
  dialog.className = 'pci-material-dialog';
  dialog.hidden = true;
  dialog.innerHTML = `
    <form class="pci-material-dialog-card" id="pciMaterialLinkForm">
      <h3>Agregar material por enlace</h3>
      <div class="pci-material-dialog-fields">
        <label class="pci-plan-field"><span>Título</span><input id="pciMaterialTitle" maxlength="180" placeholder="Ej.: Video introductorio" required></label>
        <label class="pci-plan-field"><span>Enlace</span><input id="pciMaterialUrl" type="url" placeholder="https://..." required></label>
        <label class="check-row"><input id="pciMaterialEmbed" type="checkbox" checked> Mostrar embebido dentro del plan cuando sea compatible</label>
      </div>
      <div class="pci-material-dialog-actions"><button class="button ghost" type="button" data-material-cancel>Cancelar</button><button class="button primary" type="submit">Agregar material</button></div>
    </form>`;
  document.body.appendChild(dialog);
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.hidden = true; });
  dialog.querySelector('[data-material-cancel]')?.addEventListener('click', () => { dialog.hidden = true; });
  dialog.querySelector('form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const stageId = dialog.dataset.stageId;
    const context = currentPlanContext();
    if (!context || !stageId) return;
    const stage = context.plan.stages?.[stageId];
    const url = normalizeUrl(dialog.querySelector('#pciMaterialUrl').value);
    if (!url) {
      alert('Ingresá un enlace http o https válido.');
      return;
    }
    ensureStageMaterials(stage).push({
      id: makeId(),
      kind: 'link',
      title: dialog.querySelector('#pciMaterialTitle').value.trim() || url,
      url,
      embed: dialog.querySelector('#pciMaterialEmbed').checked,
      createdAt: new Date().toISOString(),
    });
    persist();
    dialog.hidden = true;
    renderAllMaterialBlocks();
  });
  return dialog;
}

function openLinkDialog(stageId) {
  const dialog = ensureDialog();
  dialog.dataset.stageId = stageId;
  dialog.querySelector('#pciMaterialTitle').value = '';
  dialog.querySelector('#pciMaterialUrl').value = '';
  dialog.querySelector('#pciMaterialEmbed').checked = true;
  dialog.hidden = false;
  dialog.querySelector('#pciMaterialTitle')?.focus();
}

function addFiles(stageId, files) {
  const context = currentPlanContext();
  if (!context) return;
  const stage = context.plan.stages?.[stageId];
  const materials = ensureStageMaterials(stage);
  [...files].forEach((file) => {
    const id = makeId();
    const url = URL.createObjectURL(file);
    sessionFiles.set(id, { file, url });
    materials.push({
      id,
      kind: 'file',
      title: file.name,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      embed: true,
      sessionOnly: true,
      createdAt: new Date().toISOString(),
    });
  });
  persist();
  renderAllMaterialBlocks();
}

function materialCard(material, stageId) {
  const href = materialHref(material);
  const type = materialType(material);
  const meta = material.kind === 'file'
    ? `${material.mimeType || 'Archivo'}${material.size ? ` · ${fileSize(material.size)}` : ''}${material.sessionOnly ? ' · demo de sesión' : ''}`
    : `${type === 'youtube' ? 'YouTube' : type === 'vimeo' ? 'Vimeo' : type === 'pdf' ? 'PDF por enlace' : 'Enlace externo'}`;
  const open = href ? `<a class="button ghost" href="${escapeHtml(href)}" target="_blank" rel="noopener">Abrir</a>` : '';
  const download = href ? `<a class="button ghost" href="${escapeHtml(href)}" ${material.kind === 'file' ? `download="${escapeHtml(material.fileName || material.title)}"` : 'download'}>Descargar</a>` : '';
  return `<article class="pci-material-card" data-material-id="${escapeHtml(material.id)}">
    <div class="pci-material-card-head">
      <div class="pci-material-title"><strong>${escapeHtml(material.title || 'Material')}</strong><small>${escapeHtml(meta)}</small></div>
      <div class="pci-material-actions">${open}${download}<button class="button ghost" type="button" data-material-remove="${escapeHtml(material.id)}">Eliminar</button></div>
    </div>
    <div class="pci-material-options"><label><input type="checkbox" data-material-embed="${escapeHtml(material.id)}" ${material.embed ? 'checked' : ''}> Mostrar embebido</label></div>
    ${previewHtml(material)}
  </article>`;
}

function renderMaterialBlock(wrapper, stageId) {
  const context = currentPlanContext();
  if (!context) return;
  const stage = context.plan.stages?.[stageId];
  const materials = ensureStageMaterials(stage);
  wrapper.innerHTML = `
    <div class="pci-material-heading">
      <div><strong>Materiales y adjuntos</strong><div class="pci-material-empty">Podés embeber imágenes, audio, video, PDF y enlaces compatibles.</div></div>
      <div class="pci-material-buttons"><button class="button ghost" type="button" data-material-upload>📎 Subir archivo</button><button class="button ghost" type="button" data-material-link>🔗 Agregar enlace</button><input type="file" data-material-file hidden multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"></div>
    </div>
    <div class="pci-material-list">${materials.length ? materials.map((material) => materialCard(material, stageId)).join('') : '<div class="pci-material-empty">Todavía no hay materiales en esta etapa.</div>'}</div>`;

  wrapper.querySelector('[data-material-link]')?.addEventListener('click', () => openLinkDialog(stageId));
  const input = wrapper.querySelector('[data-material-file]');
  wrapper.querySelector('[data-material-upload]')?.addEventListener('click', () => input?.click());
  input?.addEventListener('change', () => { if (input.files?.length) addFiles(stageId, input.files); input.value = ''; });
  wrapper.querySelectorAll('[data-material-remove]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.materialRemove;
    const index = materials.findIndex((material) => material.id === id);
    if (index < 0) return;
    const session = sessionFiles.get(id);
    if (session?.url) URL.revokeObjectURL(session.url);
    sessionFiles.delete(id);
    materials.splice(index, 1);
    persist();
    renderAllMaterialBlocks();
  }));
  wrapper.querySelectorAll('[data-material-embed]').forEach((checkbox) => checkbox.addEventListener('change', () => {
    const material = materials.find((item) => item.id === checkbox.dataset.materialEmbed);
    if (!material) return;
    material.embed = checkbox.checked;
    persist();
    renderAllMaterialBlocks();
  }));
}

function enhanceStages() {
  const form = document.getElementById('pciPlanForm');
  if (!form || !currentPlanContext()) return;
  form.querySelectorAll('.pci-stage-body').forEach((body) => {
    const stageField = body.querySelector('[data-stage]');
    const stageId = stageField?.dataset.stage;
    if (!stageId) return;
    let wrapper = body.querySelector('.pci-stage-materials');
    if (!wrapper) {
      wrapper = document.createElement('section');
      wrapper.className = 'pci-stage-materials';
      wrapper.dataset.materialStage = stageId;
      const activities = body.querySelector('textarea.activities')?.closest('.pci-plan-field');
      if (activities) body.insertBefore(wrapper, activities);
      else body.appendChild(wrapper);
    }
    renderMaterialBlock(wrapper, stageId);
  });
}

function qrImage(url, title = 'QR') {
  if (!url || !/^https?:/i.test(url)) return '';
  const source = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(url)}`;
  return `<img class="print-qr" src="${escapeHtml(source)}" alt="${escapeHtml(title)}">`;
}

function printMaterial(material) {
  const href = materialHref(material);
  const type = materialType(material);
  let visual = '';
  if (material.embed && href && type === 'image') visual = `<img class="print-image" src="${escapeHtml(href)}" alt="${escapeHtml(material.title)}">`;
  if (material.embed && href && type === 'youtube') visual = `<img class="print-image video-thumb" src="https://img.youtube.com/vi/${escapeHtml(youtubeId(href))}/hqdefault.jpg" alt="Miniatura de ${escapeHtml(material.title)}">`;
  const qr = qrImage(href, `QR de ${material.title || 'material'}`);
  return `<div class="print-material">
    <div class="print-material-main"><strong>${escapeHtml(material.title || 'Material')}</strong><small>${escapeHtml(type === 'youtube' || type === 'vimeo' || type === 'video' ? 'Material audiovisual' : type === 'audio' ? 'Audio' : type === 'pdf' ? 'Documento PDF' : material.kind === 'file' ? 'Archivo adjunto' : 'Material en línea')}</small>${visual}</div>
    <div class="print-material-access">${qr}${href && /^https?:/i.test(href) ? `<a href="${escapeHtml(href)}">Abrir material</a>` : '<span>Disponible en la versión digital del plan</span>'}</div>
  </div>`;
}

function printStage(stageId, stage) {
  const materials = ensureStageMaterials(stage);
  const description = String(stage.description || '').trim();
  const duration = String(stage.duration || '').trim();
  const resources = String(stage.resources || '').trim();
  const activities = String(stage.activities || '').trim();
  return `<section class="print-stage">
    <h2>${escapeHtml(STAGE_LABELS[stageId] || stageId)}</h2>
    ${description ? `<div class="print-box"><div class="print-label">Presentación de la etapa</div><p>${nl2br(description)}</p></div>` : ''}
    <div class="print-meta-grid">
      <div class="print-box"><div class="print-label">Duración estimada de la etapa</div><p>${duration ? nl2br(duration) : '—'}</p></div>
      <div class="print-box"><div class="print-label">Recursos</div><p>${resources ? nl2br(resources) : '—'}</p></div>
    </div>
    ${materials.length ? `<div class="print-materials"><div class="print-label">Materiales y adjuntos</div>${materials.map(printMaterial).join('')}</div>` : ''}
    <div class="print-activities"><div class="print-label">Actividades</div><div class="print-activity-text">${activities ? nl2br(activities) : '<span class="print-empty">Sin actividades cargadas.</span>'}</div></div>
  </section>`;
}

function kindLabel(group) {
  return ({
    trunk: 'Espacio troncal',
    laboratory: 'Laboratorio / espacio de integración',
    workshop: 'Taller / espacio formativo',
    other: 'Otro formato pedagógico',
  })[group.kind] ?? 'Espacio curricular';
}

function buildPrintDocument({ area, group, plan }, autoPrint = false) {
  const contents = (plan.contentIds ?? []).map((id) => curriculumData().find((item) => String(item.id) === String(id))).filter(Boolean);
  const stages = Object.entries(STAGE_LABELS).map(([stageId]) => printStage(stageId, plan.stages?.[stageId] ?? {})).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(plan.name || `Plan bimestral ${plan.number}`)}</title><style>
    @page{size:A4;margin:15mm 14mm 18mm}*{box-sizing:border-box}body{margin:0;color:#20282d;font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;line-height:1.42}a{color:#15374a}h1,h2,h3,p{margin-top:0}.print-sheet{max-width:185mm;margin:0 auto}.print-kicker{font-size:8.5pt;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#5d6b72}.print-title{margin:5px 0 15px;font-size:19pt;line-height:1.12;color:#15374a}.print-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #aebcc1;border-bottom:0}.print-cell{padding:8px 9px;border-bottom:1px solid #aebcc1}.print-cell:nth-child(odd){border-right:1px solid #aebcc1}.print-cell.full{grid-column:1/-1;border-right:0}.print-label{margin-bottom:4px;font-size:8.3pt;font-weight:800;letter-spacing:.035em;text-transform:uppercase;color:#52646c}.print-box{padding:9px 10px;border:1px solid #b9c6ca;border-radius:2px;break-inside:avoid-page}.print-box p{margin:0}.print-section{margin-top:14px}.print-section>h2,.print-stage>h2{margin:0 0 8px;padding:7px 9px;background:#eef4f4;border-left:4px solid #15374a;font-size:12pt;text-transform:uppercase;break-after:avoid-page}.print-contents{display:grid;gap:6px}.print-content{padding:7px 8px;border:1px solid #c7d1d4;break-inside:avoid-page}.print-content small{display:block;margin-bottom:3px;color:#65757c;font-weight:700}.print-stage{margin-top:18px}.print-stage>.print-box{margin-bottom:8px}.print-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}.print-materials{margin:9px 0;padding:9px;border:1px solid #b9c6ca}.print-material{display:grid;grid-template-columns:minmax(0,1fr) 34mm;gap:10px;align-items:start;padding:8px 0;border-top:1px solid #d7dfe2;break-inside:avoid-page}.print-material:first-of-type{border-top:0}.print-material-main strong{display:block}.print-material-main small{display:block;margin-top:2px;color:#6b7a80}.print-material-access{text-align:center;font-size:8pt}.print-material-access a,.print-material-access span{display:block;margin-top:4px;overflow-wrap:anywhere}.print-qr{width:27mm;height:27mm;object-fit:contain}.print-image{display:block;max-width:100%;max-height:80mm;margin-top:7px;border:1px solid #d3dcdf;object-fit:contain}.video-thumb{max-height:55mm}.print-activities{margin-top:9px}.print-activity-text{padding:10px;border:1px solid #9fadba;min-height:35mm;white-space:normal;overflow-wrap:anywhere}.print-empty{color:#8a959a;font-style:italic}.print-footer-note{margin-top:18px;padding-top:8px;border-top:1px solid #cbd5d8;color:#7a878d;font-size:8pt}.screen-only{display:flex;gap:8px;position:sticky;top:0;z-index:5;padding:10px;margin:-15mm -14mm 12mm;background:#fff;border-bottom:1px solid #d6e2e5}.screen-only button{padding:8px 12px;border:0;border-radius:9px;background:#15374a;color:#fff;font-weight:700;cursor:pointer}.screen-only button.secondary{background:#e8eff1;color:#15374a}@media print{.screen-only{display:none}.print-sheet{max-width:none}.print-stage,.print-section{orphans:3;widows:3}}@media(max-width:700px){.print-grid,.print-meta-grid{grid-template-columns:1fr}.print-cell:nth-child(odd){border-right:0}.print-material{grid-template-columns:1fr}.print-material-access{text-align:left}}
  </style></head><body><div class="screen-only"><button onclick="window.print()">Imprimir / Guardar PDF</button><button class="secondary" onclick="window.close()">Cerrar vista previa</button></div><main class="print-sheet">
    <div class="print-kicker">${escapeHtml(area)} · Proyecto Curricular Institucional</div>
    <h1 class="print-title">${escapeHtml(plan.name || `Plan bimestral ${plan.number}`)}</h1>
    <section class="print-grid">
      <div class="print-cell"><div class="print-label">Tipo de espacio al que corresponde el plan</div><strong>${escapeHtml(kindLabel(group))}</strong></div>
      <div class="print-cell"><div class="print-label">Nombre del espacio</div><strong>${escapeHtml(group.name)}</strong></div>
      <div class="print-cell"><div class="print-label">Duración</div><strong>1 bimestre</strong></div>
      <div class="print-cell"><div class="print-label">Ubicación temporal del plan</div><strong>Bimestre ${escapeHtml(plan.number)} de ${escapeHtml(group.plansBimestrales?.length || '')}</strong></div>
      <div class="print-cell full"><div class="print-label">Sinopsis</div><div>${String(plan.synopsis || '').trim() ? nl2br(plan.synopsis) : '—'}</div></div>
    </section>
    <section class="print-section"><h2>Contenidos · A lo largo de este plan aprenderás</h2><div class="print-contents">${contents.length ? contents.map((content) => `<article class="print-content"><small>${escapeHtml(content.subject)} · ${escapeHtml(content.axis || 'Sin eje / bloque')}</small>${escapeHtml(content.text)}</article>`).join('') : '<div class="print-box">Sin contenidos seleccionados.</div>'}</div></section>
    <section class="print-section"><h2>Objetivos · Se espera que logres</h2><div class="print-box"><p>${String(plan.objectives || '').trim() ? nl2br(plan.objectives) : '—'}</p></div></section>
    ${stages}
    <div class="print-footer-note">Documento generado desde la Matriz PCI. La cantidad de páginas se adapta automáticamente a la extensión real del plan y de sus actividades.</div>
  </main>${autoPrint ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),250));<\/script>' : ''}</body></html>`;
}

function openPrintView(autoPrint = false) {
  const context = currentPlanContext();
  if (!context) return;
  const form = document.getElementById('pciPlanForm');
  if (form) {
    form.querySelectorAll('[data-plan-field]').forEach((field) => { context.plan[field.dataset.planField] = field.value; });
    context.plan.contentIds = [...form.querySelectorAll('[data-plan-content]:checked')].map((input) => String(input.dataset.planContent));
    form.querySelectorAll('[data-stage][data-stage-field]').forEach((field) => {
      const stage = context.plan.stages[field.dataset.stage] ??= {};
      stage[field.dataset.stageField] = field.value;
    });
    persist();
  }
  const popup = window.open('', '_blank');
  if (!popup) {
    alert('El navegador bloqueó la vista previa. Habilitá ventanas emergentes para esta página e intentá nuevamente.');
    return;
  }
  popup.document.open();
  popup.document.write(buildPrintDocument(context, autoPrint));
  popup.document.close();
}

function enhanceHeader() {
  const form = document.getElementById('pciPlanForm');
  const context = currentPlanContext();
  if (!form || !context) return;
  const top = document.querySelector('#pciPlansShell .pci-plan-top');
  if (!top || top.querySelector('[data-plan-print-tools]')) return;
  const close = top.querySelector('[data-plans-close]');
  const tools = document.createElement('div');
  tools.className = 'pci-plan-top-tools';
  tools.dataset.planPrintTools = '1';
  tools.innerHTML = '<button class="button secondary" type="button" data-plan-preview>Vista previa</button><button class="button accent" type="button" data-plan-print>Imprimir / Guardar PDF</button>';
  if (close) {
    const wrap = document.createElement('div');
    wrap.className = 'pci-plan-top-tools';
    wrap.appendChild(tools);
    wrap.appendChild(close);
    top.appendChild(wrap);
  } else top.appendChild(tools);
  top.querySelector('[data-plan-preview]')?.addEventListener('click', () => openPrintView(false));
  top.querySelector('[data-plan-print]')?.addEventListener('click', () => openPrintView(true));
}

function renderAllMaterialBlocks() {
  document.querySelectorAll('.pci-stage-materials[data-material-stage]').forEach((wrapper) => renderMaterialBlock(wrapper, wrapper.dataset.materialStage));
}

function enhancePlanEditor() {
  ensureStyles();
  ensureDialog();
  enhanceStages();
  enhanceHeader();
}

document.addEventListener('click', (event) => {
  const groupEntryButton = event.target.closest('[data-pci-plan-entry] button');
  if (groupEntryButton) activeGroupId = groupEntryButton.closest('.group-card[data-group-id]')?.dataset.groupId || activeGroupId;

  const matrixButton = event.target.closest('[data-open-bimestral-plans]');
  if (matrixButton) activeGroupId = document.getElementById('matrixDetailsPanel')?.dataset.groupId || activeGroupId;

  const openPlanButton = event.target.closest('[data-open-plan]');
  if (openPlanButton) activePlanNumber = Number(openPlanButton.dataset.openPlan) || null;

  if (event.target.closest('[data-back-plans]')) activePlanNumber = null;
  if (event.target.closest('[data-plans-close]')) {
    activePlanNumber = null;
    activeGroupId = null;
  }
}, true);

const observer = new MutationObserver(() => enhancePlanEditor());
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', enhancePlanEditor);
setTimeout(enhancePlanEditor, 0);
