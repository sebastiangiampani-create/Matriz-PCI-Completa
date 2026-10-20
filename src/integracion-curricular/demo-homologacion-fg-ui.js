/**
 * Vista de demostración de homologación curricular 1 -> N.
 * Solo lee archivos estáticos originales de Matriz y V2 FG.
 * No accede a Supabase, no altera agrupamientos institucionales,
 * no persiste en localStorage ni modifica datos de la escuela.
 */
import { loadMatrixContents, loadV2Fg } from './catalogos.js';
import {
  suggestHomologations, buildHomologationReviewQueue,
  approveHomologation, mappingKey
} from './homologaciones.js';

const $ = id => document.getElementById(id);
const normalize = value => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const aliases = new Map([
  ['lengua adicional', 'lenguas adicionales'],
  ['formacion etica ciudadana', 'formacion etica y ciudadana'],
  ['tecnologia de la informacion', 'tecnologias de la informacion'],
  ['educacion artistica artes visuales', 'artes visuales']
]);
const subjectKey = x => aliases.get(normalize(x)) || normalize(x);
const formatter = new Intl.NumberFormat('es-AR');
const state = {
  matrixRows: [], fgRows: [], area: '', year: 3, matrixId: null,
  sourceLimit: 24, candidateLimit: 28, chosen: new Set(),
  packs: new Map(), lastSuggestion: null, candidatePool: []
};

function element(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function add(parent, tag, text, className) {
  const child = element(tag, text, className);
  parent.append(child);
  return child;
}
function contextKey() { return JSON.stringify([state.area, state.year]); }
function currentOriginal() {
  return state.matrixRows.find(r => r.id === state.matrixId && r.area === state.area) || null;
}
function mappedRecord() {
  const pack = state.packs.get(contextKey());
  return pack?.orientations?.demo?.fg?.homologations?.[
    mappingKey(state.area, state.year, state.matrixId)
  ] || null;
}
function restoreChosen() {
  const record = mappedRecord();
  state.chosen = new Set(record?.referenceIds || (record?.referenceId ? [record.referenceId] : []));
  $('reason').value = record?.reason || '';
  $('reviewMessage').textContent = '';
  $('reviewMessage').dataset.kind = '';
}
function makePack() {
  // Tarjeta ficticia, exclusivamente en memoria. La base histórica original
  // NO identifica año por fila y no se interpreta ni transforma.
  const allIds = state.matrixRows.filter(r => r.area === state.area).map(r => r.id);
  return {
    orientations: {
      demo: { fg: { areas: { [state.area]: {
        groups: [{
          id: 'grupo-ficticio-solo-muestra', level: state.year,
          name: 'Simulación de agrupamiento FG',
          items: allIds, plansBimestrales: []
        }]
      } }, homologations: {}, homologationHistory: [] } }
    }
  };
}
function currentPack() {
  const key = contextKey();
  if (!state.packs.has(key)) state.packs.set(key, makePack());
  return state.packs.get(key);
}

function sourceRows() {
  const q = normalize($('matrixSearch').value);
  return state.matrixRows.filter(r => r.area === state.area &&
    (!q || normalize([r.subject, r.axis, r.text].join(' ')).includes(q)));
}
function selectOriginal(id) {
  if (state.matrixId === id) return;
  state.matrixId = id;
  state.candidateLimit = 28;
  $('v2Search').value = '';
  restoreChosen();
  renderAll();
}
function renderSources() {
  const rows = sourceRows();
  if (!rows.some(r => r.id === state.matrixId)) {
    state.matrixId = rows[0]?.id || null;
    restoreChosen();
  }
  $('sourceCount').textContent = formatter.format(rows.length) +
    ' contenidos históricos en la búsqueda (sin año de origen).';
  const container = $('matrixList');
  container.replaceChildren();
  for (const row of rows.slice(0, state.sourceLimit)) {
    const button = element('button', undefined, 'source-option');
    button.type = 'button';
    button.setAttribute('role', 'listitem');
    button.setAttribute('aria-pressed', String(row.id === state.matrixId));
    add(button, 'span', row.subject + (row.axis ? ' · ' + row.axis : ''), 'subject');
    add(button, 'span', row.text, 'source-text');
    button.addEventListener('click', () => selectOriginal(row.id));
    container.append(button);
  }
  $('moreMatrix').hidden = rows.length <= state.sourceLimit;
}
function candidateData() {
  const original = currentOriginal();
  if (!original) return { pool: [], suggested: new Set(), preview: null };
  const area = state.area, year = state.year;
  const sample = {
    [area]: {groups: [{
      id: 'vista-ficticia',level: year,items: [original.id]
    }]}
  };
  const preview = buildHomologationReviewQueue({
    matrixRows: state.matrixRows, v2FgRows: state.fgRows,
    areas: sample,area,year,maxSuggestions:12
  });
  const direct = suggestHomologations({
    matrixRows: state.matrixRows, v2FgRows: state.fgRows,
    area,year,matrixId: original.id,limit:20
  });
  const suggested = new Set(preview.rows[0]?.suggestedReferenceIds || []);
  const ranks = new Map(direct.candidates.map((r,i) => [String(r.id),i]));
  const pool = state.fgRows.filter(row =>
    Number(row.year) === year && normalize(row.area) === normalize(area) &&
    subjectKey(row.subject) === subjectKey(original.subject));
  pool.sort((a,b) =>
    Number(ranks.has(b.id)) - Number(ranks.has(a.id)) ||
    (ranks.get(a.id) ?? 100000) - (ranks.get(b.id) ?? 100000) ||
    a.text.localeCompare(b.text, 'es')
  );
  return { pool, suggested, preview };
}
function renderOriginal() {
  const parent = $('selectedOriginal');
  parent.replaceChildren();
  const original = currentOriginal();
  if (!original) {
    add(parent, 'span', 'No hay contenido original para esos filtros.');
    return;
  }
  add(parent, 'small', 'MATRIZ ORIGINAL · ' + original.subject +
    (original.axis ? ' · ' + original.axis : ''));
  add(parent, 'strong', original.text);
  add(parent, 'small', 'Año de referencia elegido: ' + state.year +
    '.º (no asignado automáticamente al contenido histórico).');
}
function renderCandidates() {
  const original = currentOriginal();
  const container = $('v2List');
  container.replaceChildren();
  if (!original) {
    $('candidateNotice').textContent = 'Elegí un contenido de Matriz para comenzar.';
    $('suggestedCount').textContent = '0';
    state.candidatePool = [];
    renderChosen();
    return;
  }
  const {pool,suggested} = candidateData();
  state.candidatePool = pool;
  $('suggestedCount').textContent = formatter.format(suggested.size);
  const query = normalize($('v2Search').value);
  const visible = pool.filter(r => !query ||
    normalize([r.subject,r.axis,r.subaxis,r.text].join(' ')).includes(query));
  $('candidateNotice').textContent = pool.length
    ? formatter.format(pool.length) + ' referencias del mismo año, área y materia. ' +
      formatter.format(suggested.size) + ' se destacan por proximidad textual. ' +
      'Las demás pueden localizarse con el buscador. Ninguna está aprobada.'
    : 'No se hallaron referencias V2 para esta materia y año. Requiere revisión curricular manual.';
  for (const row of visible.slice(0,state.candidateLimit)) {
    const label = element('label',undefined,'candidate');
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = state.chosen.has(row.id);
    check.value = row.id;
    check.setAttribute('aria-label','Seleccionar contenido V2: ' + row.text);
    const content = element('span',undefined,'candidate-copy');
    add(content,'span',(row.axis || 'Sin eje') + (row.subaxis ? ' · ' + row.subaxis : '') +
      ' · ' + row.year + '.º año','candidate-axis');
    add(content,'span',row.text,'candidate-text');
    add(content,'span',suggested.has(row.id) ?
      'Sugerencia textual: requiere revisión pedagógica' :
      'Referencia disponible para selección manual','candidate-reason');
    check.addEventListener('change',() => {
      if(check.checked) state.chosen.add(row.id);
      else state.chosen.delete(row.id);
      renderChosen();
    });
    label.append(check,content);
    container.append(label);
  }
  if (!visible.length) add(container,'p','No hay referencias que coincidan con la búsqueda.','empty');
  $('moreV2').hidden = visible.length <= state.candidateLimit;
  renderChosen();
}
function renderChosen() {
  $('selectedCount').textContent = state.chosen.size + ' seleccionados de V2';
  const selectedV2 = new Set(state.candidatePool.map(x => x.id));
  $('confirmDemo').disabled = !currentOriginal() || !state.chosen.size ||
    [...state.chosen].some(id => !selectedV2.has(id));
}
function renderMetrics() {
  $('matrixTotal').textContent = formatter.format(state.matrixRows.length);
  $('v2Total').textContent = formatter.format(state.fgRows.length);
  const records = [...state.packs.values()].flatMap(p =>
    Object.values(p?.orientations?.demo?.fg?.homologations || {}));
  const ids = new Set(records.flatMap(r => r.referenceIds || (r.referenceId ? [r.referenceId] : [])));
  $('approvedCount').textContent = formatter.format(ids.size);
  $('downloadDemo').disabled = records.length === 0;
}
function renderHistory() {
  const parent = $('historyList');
  parent.replaceChildren();
  const approved = Object.values(currentPack().orientations.demo.fg.homologations || {});
  if (!approved.length) {
    add(parent,'p','Todavía no se simularon aprobaciones para esta área y año.','empty');
    return;
  }
  const matrix = new Map(state.matrixRows.map(x => [x.id,x]));
  for (const r of approved) {
    const el = element('div',undefined,'history-line');
    const source = matrix.get(r.matrixId);
    add(el,'strong',(source?.subject || r.area) + ' · ' + r.year + '.º año');
    add(el,'div',source?.text || r.matrixId);
    add(el,'div',(r.referenceIds || [r.referenceId]).length +
      ' contenidos V2 vinculados en esta muestra · ' + r.reviewer);
    parent.append(el);
  }
}
function renderAll() {
  renderSources();
  renderOriginal();
  renderCandidates();
  renderMetrics();
  renderHistory();
}
function changedContext() {
  state.area = $('areaSelect').value;
  state.year = Number($('yearSelect').value);
  state.matrixId = null;
  state.sourceLimit = 24;
  state.candidateLimit = 28;
  $('matrixSearch').value = '';
  $('v2Search').value = '';
  renderAll();
}
function message(text,kind='error') {
  $('reviewMessage').dataset.kind = kind;
  $('reviewMessage').textContent = text;
}
function approveSelected() {
  const source = currentOriginal();
  if (!source) return message('Seleccioná un contenido original.');
  const chosen = [...state.chosen];
  if (!chosen.length) return message('Elegí al menos un contenido V2.');
  const reviewer = $('reviewer').value.trim();
  const reason = $('reason').value.trim();
  if (!reviewer) return message('Ingresá quién revisó la equivalencia.');
  if (reason.length < 10) return message('Agregá una justificación pedagógica de al menos 10 caracteres.');
  try {
    const updated = approveHomologation(currentPack(), {
      orientationId: 'demo',
      area: state.area, year: state.year, matrixId: source.id,
      referenceIds: chosen, reason, reviewer,
      matrixRows: state.matrixRows, v2FgRows: state.fgRows
    });
    state.packs.set(contextKey(), updated);
    renderMetrics();
    renderHistory();
    message('Aprobación simulada: 1 contenido histórico vinculado con ' +
      chosen.length + ' referencias V2. No se guardó en Supabase ni se atribuyó cobertura escolar.','success');
  } catch(err) {
    message('No se pudo simular la homologación: ' + (err?.message || String(err)));
  }
}
function downloadDemo() {
  const records = [...state.packs.entries()].flatMap(([ctx,p]) =>
    Object.values(p?.orientations?.demo?.fg?.homologations || {}).map(r =>
      ({context:JSON.parse(ctx),...r})));
  if (!records.length) return;
  const payload = {
    type:'demostracion-homologacion-fg',schoolId:null,environment:'solo-navegador',
    source:'Matriz PCI histórica',reference:'FG Secundaria Aprende V2 v103',
    note:'Exportación de una simulación: no representa aprobaciones institucionales ni cobertura acreditada.',
    correspondences:records
  };
  const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const href = URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=href;
  link.download='muestra-homologacion-fg.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href),1000);
}
function resetDemo() {
  state.packs.clear();
  state.matrixId=null;
  state.sourceLimit=24;
  state.candidateLimit=28;
  $('reason').value='';
  $('matrixSearch').value='';
  $('v2Search').value='';
  renderAll();
  message('Se reinició la muestra; no se borró ningún dato real.','success');
}
function wire() {
  $('areaSelect').addEventListener('change',changedContext);
  $('yearSelect').addEventListener('change',changedContext);
  $('matrixSearch').addEventListener('input',() => {
    state.sourceLimit=24;
    renderAll();
  });
  $('v2Search').addEventListener('input',() => {
    state.candidateLimit=28;
    renderCandidates();
  });
  $('moreMatrix').addEventListener('click',() => {state.sourceLimit+=24;renderSources();});
  $('moreV2').addEventListener('click',() => {state.candidateLimit+=28;renderCandidates();});
  $('clearSelected').addEventListener('click',() => {
    state.chosen.clear();
    renderCandidates();
  });
  $('confirmDemo').addEventListener('click',approveSelected);
  $('downloadDemo').addEventListener('click',downloadDemo);
  $('resetDemo').addEventListener('click',resetDemo);
}
async function start() {
  try {
    const [matrix,fg] = await Promise.all([loadMatrixContents(),loadV2Fg()]);
    state.matrixRows = matrix;
    state.fgRows = fg;
    const areas = [...new Set(matrix.map(r=>r.area))].sort((a,b)=>a.localeCompare(b,'es'));
    const select=$('areaSelect');
    for(const name of areas) {
      const option=document.createElement('option');
      option.value=name;
      option.textContent=name;
      select.append(option);
    }
    state.area = areas.includes('Ciencias Sociales') ? 'Ciencias Sociales' : areas[0];
    select.value = state.area;
    $('yearSelect').value=String(state.year);
    wire();
    renderAll();
    $('loading').hidden=true;
    $('workspace').hidden=false;
  } catch (error) {
    $('loading').textContent =
      'No se pudieron cargar los catálogos de la muestra: ' +
      (error?.message || String(error)) + '. Abrí la vista desde el enlace publicado de GitHub, no como archivo local.';
  }
}
start();
