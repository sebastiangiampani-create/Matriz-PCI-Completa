(()=>{
  const frame=()=>document.getElementById('pci');
  const KEY='pciCurricularBaseV1';
  const VERSION_KEY='pciCurricularBaseVersionsV1';

  function parseCSV(text){
    const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());
    if(!lines.length)return [];
    const split=line=>{const out=[];let cell='',quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if((ch===','||ch===';')&&!quoted){out.push(cell.trim());cell=''}else cell+=ch}out.push(cell.trim());return out};
    const headers=split(lines.shift()).map(h=>h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_'));
    const aliases={area:['area'],subject:['materia','materia_nes','asignatura'],axis:['eje','bloque','eje_de_contenido'],text:['contenido','contenido_priorizado','descripcion'],id:['codigo','id','codigo_contenido']};
    const indexOf=key=>headers.findIndex(h=>aliases[key].includes(h));
    const idx={area:indexOf('area'),subject:indexOf('subject'),axis:indexOf('axis'),text:indexOf('text'),id:indexOf('id')};
    if(idx.area<0||idx.subject<0||idx.axis<0||idx.text<0)throw new Error('La planilla debe incluir: area, materia, eje y contenido.');
    return lines.map((line,row)=>{const cols=split(line);const area=cols[idx.area]?.trim(),subject=cols[idx.subject]?.trim(),axis=cols[idx.axis]?.trim(),content=cols[idx.text]?.trim();if(!area||!subject||!axis||!content)return null;const id=(idx.id>=0&&cols[idx.id]?.trim())||`ADM-${Date.now()}-${row+1}`;return [String(id),area,subject,axis,content]}).filter(Boolean);
  }

  function applyBase(rows){
    const f=frame(),w=f?.contentWindow;
    if(!w)return;
    w.DATA=rows.map(([id,area,subject,axis,text])=>({id,area,subject,axis,text}));
    localStorage.setItem(KEY,JSON.stringify(rows));
    const versions=JSON.parse(localStorage.getItem(VERSION_KEY)||'[]');
    versions.unshift({id:`v${versions.length+1}`,date:new Date().toISOString(),count:rows.length});
    localStorage.setItem(VERSION_KEY,JSON.stringify(versions.slice(0,20)));
    try{w.renderAreas?.();w.renderBoard?.()}catch{}
  }

  function restoreSaved(){
    const raw=localStorage.getItem(KEY);if(!raw)return;
    try{applyBase(JSON.parse(raw))}catch{}
  }

  function template(){
    const content='codigo,area,materia,eje,contenido\nCN-BIO-E1-C1,Ciencias Naturales,Biología,Seres vivos,Relaciones entre los seres vivos y el ambiente\n';
    const blob=new Blob([content],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='plantilla-contenidos-priorizados.csv';a.click();URL.revokeObjectURL(url);
  }

  function mount(){
    if(document.getElementById('curricularAdmin'))return;
    const style=document.createElement('style');
    style.textContent=`.admin-fab{position:fixed;left:16px;bottom:16px;z-index:9999;border:0;border-radius:14px;padding:11px 14px;background:#15374a;color:#fff;font:800 14px system-ui;box-shadow:0 8px 24px #0003}.admin-modal{position:fixed;inset:0;z-index:10000;display:none;background:#0008;padding:20px;overflow:auto}.admin-modal.open{display:grid;place-items:center}.admin-card{width:min(720px,100%);background:#fff;border-radius:20px;padding:20px;font-family:system-ui;color:#15374a}.admin-card h2{margin-top:0}.admin-row{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.admin-card button,.admin-card label{border:0;border-radius:12px;padding:10px 13px;font-weight:800;cursor:pointer;background:#e7edef}.admin-card .primary{background:#15374a;color:#fff}.admin-note{color:#687985;font-size:.88rem}.admin-status{padding:10px;border-radius:12px;background:#eef6f7;margin-top:10px}.admin-list{max-height:180px;overflow:auto;border:1px solid #dbe5e8;border-radius:12px;padding:8px}`;
    document.head.appendChild(style);
    const button=document.createElement('button');button.className='admin-fab';button.textContent='Administración curricular';button.onclick=()=>modal.classList.add('open');
    const modal=document.createElement('section');modal.id='curricularAdmin';modal.className='admin-modal';modal.innerHTML=`<div class="admin-card"><h2>Administración curricular</h2><p class="admin-note">Importá una planilla CSV exportada desde Excel con las columnas: código, área, materia, eje y contenido.</p><div class="admin-row"><label class="primary">Importar CSV<input id="curricularFile" type="file" accept=".csv,text/csv" hidden></label><button id="curricularTemplate">Descargar plantilla</button><button id="curricularRestore">Usar base original</button><button id="curricularClose">Cerrar</button></div><div id="curricularStatus" class="admin-status">Sin cambios.</div><h3>Versiones locales</h3><div id="curricularVersions" class="admin-list"></div></div>`;
    document.body.append(button,modal);
    const status=modal.querySelector('#curricularStatus'),versions=modal.querySelector('#curricularVersions');
    function renderVersions(){const data=JSON.parse(localStorage.getItem(VERSION_KEY)||'[]');versions.innerHTML=data.length?data.map(v=>`<div><strong>${v.id}</strong> · ${v.count} contenidos · ${new Date(v.date).toLocaleString('es-AR')}</div>`).join(''):'Todavía no hay versiones importadas.'}
    modal.querySelector('#curricularClose').onclick=()=>modal.classList.remove('open');
    modal.querySelector('#curricularTemplate').onclick=template;
    modal.querySelector('#curricularRestore').onclick=()=>{localStorage.removeItem(KEY);location.reload()};
    modal.querySelector('#curricularFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const rows=parseCSV(await file.text());if(!rows.length)throw new Error('La planilla no contiene filas válidas.');applyBase(rows);status.textContent=`Base importada: ${rows.length} contenidos priorizados.`;renderVersions()}catch(error){status.textContent=`Error: ${error.message}`}};
    renderVersions();
    frame()?.addEventListener('load',()=>setTimeout(restoreSaved,900));
    setTimeout(restoreSaved,900);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();