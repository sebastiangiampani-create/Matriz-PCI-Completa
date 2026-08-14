const STAGES = {
  punto_partida: 'Punto de partida',
  indagacion: 'Indagación',
  produccion: 'Producción',
  evaluacion: 'Evaluación',
};
const sessionFiles = new Map();
let activeGroupId = null;
let activePlanNumber = null;

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const br = (value) => esc(value).replace(/\n/g, '<br>');

function state(){ return window.PCIApp?.getState?.() ?? null; }
function data(){ return window.PCIApp?.getData?.() ?? []; }
function findGroup(id){
  const current = state();
  if (!current || !id) return null;
  for (const [area, areaState] of Object.entries(current.areas ?? {})) {
    const group = (areaState.groups ?? []).find((g) => g.id === id);
    if (group) return {area, group};
  }
  return null;
}
function context(){
  const found = findGroup(activeGroupId);
  const plan = found?.group?.plansBimestrales?.[activePlanNumber - 1];
  return found && plan ? {...found, plan} : null;
}
function materials(stage){
  if (!Array.isArray(stage.materials)) stage.materials = [];
  return stage.materials;
}
function persist(){
  const current = state();
  if (!current) return;
  localStorage.setItem('pciAppV2', JSON.stringify(current));
  window.app = current;
  window.dispatchEvent(new CustomEvent('pci-state-change', {detail:{source:'planes-media-demo'}}));
}
function id(){ return crypto.randomUUID ? crypto.randomUUID() : `mat-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function validUrl(value){ try { const u = new URL(value); return ['http:','https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } }
function youtubeId(url){ try { const u=new URL(url); if(u.hostname.includes('youtu.be'))return u.pathname.split('/').filter(Boolean)[0]||''; if(u.hostname.includes('youtube.com'))return u.searchParams.get('v')||(u.pathname.startsWith('/shorts/')?u.pathname.split('/')[2]:'')||(u.pathname.startsWith('/embed/')?u.pathname.split('/')[2]:''); } catch{} return ''; }
function vimeoId(url){ try { const u=new URL(url); return u.hostname.includes('vimeo.com') ? (u.pathname.split('/').filter(Boolean).find((p)=>/^\d+$/.test(p))||'') : ''; } catch{} return ''; }
function href(material){ return material.kind === 'link' ? material.url : (sessionFiles.get(material.id)?.url || material.storageUrl || ''); }
function ext(url){ try { const p=new URL(url).pathname.toLowerCase(); return p.includes('.')?p.split('.').pop():''; }catch{return '';} }
function type(material){
  const url=href(material), mime=String(material.mimeType||'').toLowerCase(), e=ext(url);
  if(youtubeId(url))return 'youtube'; if(vimeoId(url))return 'vimeo';
  if(mime.startsWith('image/')||['png','jpg','jpeg','gif','webp','svg'].includes(e))return 'image';
  if(mime.startsWith('video/')||['mp4','webm','mov','m4v'].includes(e))return 'video';
  if(mime.startsWith('audio/')||['mp3','wav','ogg','m4a'].includes(e))return 'audio';
  if(mime==='application/pdf'||e==='pdf')return 'pdf';
  return material.kind==='link'?'link':'file';
}
function size(bytes){ const n=Number(bytes)||0; return n<1024?`${n} B`:n<1048576?`${Math.round(n/1024)} KB`:`${(n/1048576).toFixed(1)} MB`; }

function ensureCss(){
  if(document.getElementById('planMediaDemoCss'))return;
  const s=document.createElement('style'); s.id='planMediaDemoCss'; s.textContent=`
  .plan-media{padding:13px;border:1px dashed var(--line,#d6e2e5);border-radius:13px;background:#fbfdfd}.plan-media-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.plan-media-actions{display:flex;gap:7px;flex-wrap:wrap}.plan-media-list{display:grid;gap:9px;margin-top:10px}.plan-media-card{padding:10px;border:1px solid var(--line,#d6e2e5);border-radius:11px;background:#fff}.plan-media-row{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.plan-media-row small{display:block;color:var(--muted,#6a7b84);margin-top:2px}.plan-media-buttons{display:flex;gap:6px;flex-wrap:wrap}.plan-media-preview{margin-top:9px;overflow:hidden;border-radius:10px;background:#eef3f4}.plan-media-preview iframe{display:block;width:100%;height:320px;border:0}.plan-media-preview img,.plan-media-preview video{display:block;width:100%;max-height:420px;object-fit:contain}.plan-media-preview audio{width:100%;padding:10px}.plan-media-note{margin-top:8px;padding:8px;border-radius:9px;background:#fff7e8;color:#765b1f;font-size:.76rem}.plan-media-tools{display:flex;gap:7px;flex-wrap:wrap;align-items:center}.plan-link-dialog{position:fixed;inset:0;z-index:2300;display:grid;place-items:center;padding:16px;background:#15374a80}.plan-link-dialog[hidden]{display:none}.plan-link-card{width:min(560px,100%);padding:18px;border-radius:18px;background:#fff;box-shadow:0 24px 70px #15374a55}.plan-link-card h3{margin:0 0 14px}.plan-link-fields{display:grid;gap:11px}.plan-link-buttons{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}@media(max-width:760px){.plan-media-row{display:block}.plan-media-buttons{margin-top:8px}.plan-media-preview iframe{height:245px}}
  `; document.head.appendChild(s);
}
function preview(material){
  if(!material.embed)return '';
  const url=href(material), t=type(material);
  if(!url)return '<div class="plan-media-note">Archivo de demostración no disponible después de recargar. En producción se guardará en Supabase Storage.</div>';
  if(t==='youtube')return `<div class="plan-media-preview"><iframe src="https://www.youtube.com/embed/${esc(youtubeId(url))}" title="${esc(material.title)}" allowfullscreen></iframe></div>`;
  if(t==='vimeo')return `<div class="plan-media-preview"><iframe src="https://player.vimeo.com/video/${esc(vimeoId(url))}" title="${esc(material.title)}" allowfullscreen></iframe></div>`;
  if(t==='image')return `<div class="plan-media-preview"><img src="${esc(url)}" alt="${esc(material.title)}"></div>`;
  if(t==='video')return `<div class="plan-media-preview"><video src="${esc(url)}" controls></video></div>`;
  if(t==='audio')return `<div class="plan-media-preview"><audio src="${esc(url)}" controls></audio></div>`;
  if(t==='pdf')return `<div class="plan-media-preview"><iframe src="${esc(url)}" title="${esc(material.title)}"></iframe></div>`;
  return '';
}
function card(material){
  const url=href(material), t=type(material), meta=material.kind==='file'?`${material.mimeType||'Archivo'} · ${size(material.size)} · demo de sesión`:(t==='youtube'?'YouTube':t==='vimeo'?'Vimeo':t==='pdf'?'PDF por enlace':'Enlace externo');
  return `<article class="plan-media-card" data-material-id="${esc(material.id)}"><div class="plan-media-row"><div><strong>${esc(material.title||'Material')}</strong><small>${esc(meta)}</small></div><div class="plan-media-buttons">${url?`<a class="button ghost" href="${esc(url)}" target="_blank" rel="noopener">Abrir</a><a class="button ghost" href="${esc(url)}" ${material.kind==='file'?`download="${esc(material.fileName||material.title)}"`:'download'}>Descargar</a>`:''}<button class="button ghost" type="button" data-remove-material="${esc(material.id)}">Eliminar</button></div></div><label style="display:block;margin-top:8px;font-size:.76rem;font-weight:800;color:var(--muted,#6a7b84)"><input type="checkbox" data-embed-material="${esc(material.id)}" ${material.embed?'checked':''}> Mostrar embebido</label>${preview(material)}</article>`;
}
function renderBlock(block, stageId){
  const ctx=context(); if(!ctx)return;
  const stage=ctx.plan.stages?.[stageId]; if(!stage)return;
  const list=materials(stage);
  block.innerHTML=`<div class="plan-media-head"><div><strong>Materiales y adjuntos</strong><div style="font-size:.76rem;color:var(--muted,#6a7b84);margin-top:2px">Imágenes, PDF, audio, video, archivos y enlaces.</div></div><div class="plan-media-actions"><button class="button ghost" type="button" data-upload>📎 Subir archivo</button><button class="button ghost" type="button" data-link>🔗 Agregar enlace</button><input type="file" hidden multiple data-file accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"></div></div><div class="plan-media-list">${list.length?list.map(card).join(''):'<div style="font-size:.78rem;color:var(--muted,#6a7b84)">Todavía no hay materiales en esta etapa.</div>'}</div>`;
  const input=block.querySelector('[data-file]');
  block.querySelector('[data-upload]')?.addEventListener('click',()=>input?.click());
  input?.addEventListener('change',()=>{[...(input.files||[])].forEach((file)=>{const mid=id(),url=URL.createObjectURL(file);sessionFiles.set(mid,{file,url});list.push({id:mid,kind:'file',title:file.name,fileName:file.name,mimeType:file.type||'application/octet-stream',size:file.size,embed:true,sessionOnly:true,createdAt:new Date().toISOString()});});persist();renderAll();input.value='';});
  block.querySelector('[data-link]')?.addEventListener('click',()=>openDialog(stageId));
  block.querySelectorAll('[data-remove-material]').forEach((button)=>button.addEventListener('click',()=>{const index=list.findIndex((m)=>m.id===button.dataset.removeMaterial);if(index<0)return;const sf=sessionFiles.get(list[index].id);if(sf?.url)URL.revokeObjectURL(sf.url);sessionFiles.delete(list[index].id);list.splice(index,1);persist();renderAll();}));
  block.querySelectorAll('[data-embed-material]').forEach((check)=>check.addEventListener('change',()=>{const m=list.find((x)=>x.id===check.dataset.embedMaterial);if(!m)return;m.embed=check.checked;persist();renderAll();}));
}
function renderAll(){ document.querySelectorAll('.plan-media[data-stage-media]').forEach((b)=>renderBlock(b,b.dataset.stageMedia)); }
function enhanceStages(){
  const form=document.getElementById('pciPlanForm'); if(!form||!context())return;
  form.querySelectorAll('.pci-stage-body').forEach((body)=>{const stageId=body.querySelector('[data-stage]')?.dataset.stage;if(!stageId||body.querySelector('.plan-media'))return;const block=document.createElement('section');block.className='plan-media';block.dataset.stageMedia=stageId;const activities=body.querySelector('textarea.activities')?.closest('.pci-plan-field');if(activities)body.insertBefore(block,activities);else body.appendChild(block);renderBlock(block,stageId);});
}

function ensureDialog(){
  let d=document.getElementById('planLinkDialog'); if(d)return d;
  d=document.createElement('div');d.id='planLinkDialog';d.className='plan-link-dialog';d.hidden=true;d.innerHTML=`<form class="plan-link-card"><h3>Agregar material por enlace</h3><div class="plan-link-fields"><label class="pci-plan-field"><span>Título</span><input data-title required placeholder="Ej.: Video introductorio"></label><label class="pci-plan-field"><span>Enlace</span><input data-url type="url" required placeholder="https://..."></label><label><input data-embed type="checkbox" checked> Mostrar embebido cuando sea compatible</label></div><div class="plan-link-buttons"><button class="button ghost" type="button" data-cancel>Cancelar</button><button class="button primary" type="submit">Agregar</button></div></form>`;document.body.appendChild(d);
  d.addEventListener('click',(e)=>{if(e.target===d)d.hidden=true;});d.querySelector('[data-cancel]').addEventListener('click',()=>d.hidden=true);d.querySelector('form').addEventListener('submit',(e)=>{e.preventDefault();const ctx=context(),stageId=d.dataset.stageId,stage=ctx?.plan?.stages?.[stageId];if(!stage)return;const url=validUrl(d.querySelector('[data-url]').value);if(!url){alert('Ingresá un enlace válido.');return;}materials(stage).push({id:id(),kind:'link',title:d.querySelector('[data-title]').value.trim()||url,url,embed:d.querySelector('[data-embed]').checked,createdAt:new Date().toISOString()});persist();d.hidden=true;renderAll();});return d;
}
function openDialog(stageId){const d=ensureDialog();d.dataset.stageId=stageId;d.querySelector('[data-title]').value='';d.querySelector('[data-url]').value='';d.querySelector('[data-embed]').checked=true;d.hidden=false;d.querySelector('[data-title]').focus();}

function syncForm(){
  const ctx=context(),form=document.getElementById('pciPlanForm');if(!ctx||!form)return;
  form.querySelectorAll('[data-plan-field]').forEach((f)=>ctx.plan[f.dataset.planField]=f.value);
  ctx.plan.contentIds=[...form.querySelectorAll('[data-plan-content]:checked')].map((i)=>String(i.dataset.planContent));
  form.querySelectorAll('[data-stage][data-stage-field]').forEach((f)=>{const stage=ctx.plan.stages[f.dataset.stage]??={};stage[f.dataset.stageField]=f.value;});persist();
}
function qr(url){return url&&/^https?:/i.test(url)?`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(url)}`:'';}
function printMaterial(m){const url=href(m),t=type(m),q=qr(url);let visual='';if(m.embed&&url&&t==='image')visual=`<img class="media-img" src="${esc(url)}" alt="${esc(m.title)}">`;if(m.embed&&url&&t==='youtube')visual=`<img class="media-img" src="https://img.youtube.com/vi/${esc(youtubeId(url))}/hqdefault.jpg" alt="${esc(m.title)}">`;return `<div class="material"><div><strong>${esc(m.title||'Material')}</strong><small>${esc(t==='video'||t==='youtube'||t==='vimeo'?'Material audiovisual':t==='audio'?'Audio':t==='pdf'?'Documento PDF':m.kind==='file'?'Archivo adjunto':'Material en línea')}</small>${visual}</div><div class="access">${q?`<img src="${esc(q)}" alt="QR"><a href="${esc(url)}">Abrir material</a>`:'<span>Disponible en la versión digital del plan</span>'}</div></div>`;}
function printStage(id,stage){const mats=materials(stage),description=String(stage.description||'').trim(),duration=String(stage.duration||'').trim(),resources=String(stage.resources||'').trim(),activities=String(stage.activities||'').trim();return `<section class="stage"><h2>${esc(STAGES[id])}</h2>${description?`<div class="box"><b>Presentación de la etapa</b><p>${br(description)}</p></div>`:''}<div class="meta"><div class="box"><b>Duración estimada de la etapa</b><p>${duration?br(duration):'—'}</p></div><div class="box"><b>Recursos</b><p>${resources?br(resources):'—'}</p></div></div>${mats.length?`<div class="materials"><b>Materiales y adjuntos</b>${mats.map(printMaterial).join('')}</div>`:''}<div class="activities"><b>Actividades</b><div>${activities?br(activities):'<i>Sin actividades cargadas.</i>'}</div></div></section>`;}
function kind(group){return ({trunk:'Espacio troncal',laboratory:'Laboratorio / espacio de integración',workshop:'Taller / espacio formativo',other:'Otro formato pedagógico'})[group.kind]||'Espacio curricular';}
function printHtml(ctx,auto){const contents=(ctx.plan.contentIds||[]).map((id)=>data().find((x)=>String(x.id)===String(id))).filter(Boolean);return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(ctx.plan.name||`Plan bimestral ${ctx.plan.number}`)}</title><style>@page{size:A4;margin:15mm 14mm 18mm}*{box-sizing:border-box}body{margin:0;color:#20282d;font-family:Arial,sans-serif;font-size:10.5pt;line-height:1.42}.sheet{max-width:185mm;margin:auto}.screen{display:flex;gap:8px;position:sticky;top:0;z-index:2;margin:-15mm -14mm 12mm;padding:10px;background:#fff;border-bottom:1px solid #ccd6d9}.screen button{padding:8px 12px;border:0;border-radius:8px;background:#15374a;color:#fff;font-weight:700}.screen .secondary{background:#e8eff1;color:#15374a}.kicker{font-size:8.5pt;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#66777e}h1{margin:5px 0 14px;color:#15374a;font-size:19pt}h2{margin:0 0 8px;padding:7px 9px;background:#eef4f4;border-left:4px solid #15374a;font-size:12pt;text-transform:uppercase;break-after:avoid-page}.grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #aebcc1;border-bottom:0}.cell{padding:8px;border-bottom:1px solid #aebcc1}.cell:nth-child(odd){border-right:1px solid #aebcc1}.full{grid-column:1/-1;border-right:0!important}.label,.box>b,.materials>b,.activities>b{display:block;margin-bottom:4px;font-size:8.3pt;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:#52646c}.section,.stage{margin-top:16px}.box{padding:9px;border:1px solid #b9c6ca;break-inside:avoid-page}.box p{margin:0}.contents{display:grid;gap:6px}.content{padding:7px 8px;border:1px solid #c7d1d4;break-inside:avoid-page}.content small{display:block;color:#65757c;font-weight:700}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}.materials{padding:9px;border:1px solid #b9c6ca;margin:8px 0}.material{display:grid;grid-template-columns:1fr 34mm;gap:10px;padding:8px 0;border-top:1px solid #d7dfe2;break-inside:avoid-page}.material:first-of-type{border-top:0}.material small{display:block;color:#6b7a80}.access{text-align:center;font-size:8pt}.access img{width:27mm;height:27mm}.access a,.access span{display:block;margin-top:4px;overflow-wrap:anywhere}.media-img{display:block;max-width:100%;max-height:75mm;margin-top:6px;object-fit:contain}.activities{margin-top:9px}.activities>div{min-height:35mm;padding:10px;border:1px solid #9fadba;overflow-wrap:anywhere}.footer{margin-top:18px;padding-top:8px;border-top:1px solid #cbd5d8;color:#7a878d;font-size:8pt}@media print{.screen{display:none}.sheet{max-width:none}}@media(max-width:700px){.grid,.meta{grid-template-columns:1fr}.cell:nth-child(odd){border-right:0}.material{grid-template-columns:1fr}.access{text-align:left}}</style></head><body><div class="screen"><button onclick="window.print()">Imprimir / Guardar PDF</button><button class="secondary" onclick="window.close()">Cerrar</button></div><main class="sheet"><div class="kicker">${esc(ctx.area)} · Proyecto Curricular Institucional</div><h1>${esc(ctx.plan.name||`Plan bimestral ${ctx.plan.number}`)}</h1><section class="grid"><div class="cell"><div class="label">Tipo de espacio al que corresponde el plan</div><strong>${esc(kind(ctx.group))}</strong></div><div class="cell"><div class="label">Nombre del espacio</div><strong>${esc(ctx.group.name)}</strong></div><div class="cell"><div class="label">Duración</div><strong>1 bimestre</strong></div><div class="cell"><div class="label">Ubicación temporal del plan</div><strong>Bimestre ${esc(ctx.plan.number)} de ${esc(ctx.group.plansBimestrales?.length||'')}</strong></div><div class="cell full"><div class="label">Sinopsis</div>${String(ctx.plan.synopsis||'').trim()?br(ctx.plan.synopsis):'—'}</div></section><section class="section"><h2>Contenidos · A lo largo de este plan aprenderás</h2><div class="contents">${contents.length?contents.map((c)=>`<div class="content"><small>${esc(c.subject)} · ${esc(c.axis||'Sin eje / bloque')}</small>${esc(c.text)}</div>`).join(''):'<div class="box">Sin contenidos seleccionados.</div>'}</div></section><section class="section"><h2>Objetivos · Se espera que logres</h2><div class="box"><p>${String(ctx.plan.objectives||'').trim()?br(ctx.plan.objectives):'—'}</p></div></section>${Object.keys(STAGES).map((sid)=>printStage(sid,ctx.plan.stages?.[sid]??{})).join('')}<div class="footer">Documento generado desde la Matriz PCI. La cantidad de páginas se adapta automáticamente al contenido real del plan.</div></main>${auto?'<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),400));<\/script>':''}</body></html>`;}
function openPrint(auto=false){syncForm();const ctx=context();if(!ctx)return;const w=window.open('','_blank');if(!w){alert('El navegador bloqueó la vista previa. Habilitá ventanas emergentes e intentá nuevamente.');return;}w.document.open();w.document.write(printHtml(ctx,auto));w.document.close();}
function enhanceHeader(){const form=document.getElementById('pciPlanForm'),ctx=context(),top=document.querySelector('#pciPlansShell .pci-plan-top');if(!form||!ctx||!top||top.querySelector('[data-media-print-tools]'))return;const tools=document.createElement('div');tools.className='plan-media-tools';tools.dataset.mediaPrintTools='1';tools.innerHTML='<button class="button secondary" type="button" data-preview-plan>Vista previa</button><button class="button accent" type="button" data-print-plan>Imprimir / Guardar PDF</button>';const close=top.querySelector('[data-plans-close]');if(close)top.insertBefore(tools,close);else top.appendChild(tools);tools.querySelector('[data-preview-plan]').addEventListener('click',()=>openPrint(false));tools.querySelector('[data-print-plan]').addEventListener('click',()=>openPrint(true));}
function enhance(){ensureCss();ensureDialog();enhanceStages();enhanceHeader();}

document.addEventListener('click',(event)=>{const groupButton=event.target.closest('[data-pci-plan-entry] button');if(groupButton)activeGroupId=groupButton.closest('.group-card[data-group-id]')?.dataset.groupId||activeGroupId;const matrixButton=event.target.closest('[data-open-bimestral-plans]');if(matrixButton)activeGroupId=document.getElementById('matrixDetailsPanel')?.dataset.groupId||activeGroupId;const planButton=event.target.closest('[data-open-plan]');if(planButton)activePlanNumber=Number(planButton.dataset.openPlan)||null;if(event.target.closest('[data-back-plans]'))activePlanNumber=null;if(event.target.closest('[data-plans-close]')){activePlanNumber=null;activeGroupId=null;}},true);
const observer=new MutationObserver(()=>enhance());observer.observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('DOMContentLoaded',enhance);setTimeout(enhance,0);
