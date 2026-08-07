(()=>{
  'use strict';
  const frame=()=>document.getElementById('pci');
  const ACTIVE_KEY='pciActiveSchoolV1';
  const NAMES_KEY='pciSchoolNamesV1';
  const STATE_PREFIX='pciSchoolStateV1:';

  function activeCode(){return localStorage.getItem(ACTIVE_KEY)||'PCI'}
  function schoolName(){
    const code=activeCode();
    try{return JSON.parse(localStorage.getItem(NAMES_KEY)||'{}')[code]||code}catch{return code}
  }
  function currentState(){
    const code=activeCode();
    const raw=localStorage.getItem(STATE_PREFIX+code)||localStorage.getItem('pciAppV2')||'{"areas":{}}';
    try{return JSON.parse(raw)}catch{return {areas:{}}}
  }
  function slug(value){return String(value||'pci').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase()}
  function download(name,content,type){
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function csvCell(value){const text=String(value??'');return /[",;\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text}
  function rows(){
    const state=currentState(),out=[];
    Object.entries(state.areas||{}).forEach(([area,data])=>{
      (data?.groups||[]).forEach((group,index)=>{
        const start=Number(group.termStart||group.term||0)||'';
        const end=Number(group.termEnd||group.term||start)||'';
        const level=Number(group.level)||((start&&Math.ceil(start/2))||'');
        const hours=Number(group.weeklyHours??group.hours??0)||0;
        const items=Array.isArray(group.items)?group.items:[];
        out.push({area,index:index+1,name:group.name||'',type:group.type||'',level,start,end,hours,items:items.join('|'),itemCount:items.length});
      });
    });
    return out;
  }
  function exportJSON(){
    const code=activeCode(),name=schoolName(),state=currentState();
    const payload={exportedAt:new Date().toISOString(),school:{code,name},schemaVersion:state.schemaVersion??null,pci:state};
    download(`${slug(code+'-'+name)}-pci.json`,JSON.stringify(payload,null,2),'application/json;charset=utf-8');
  }
  function exportCSV(){
    const header=['escuela_codigo','escuela_nombre','area','agrupamiento_n','agrupamiento','tipo','nivel','cuatrimestre_inicio','cuatrimestre_fin','hc_semanales','contenidos_cantidad','contenidos_ids'];
    const code=activeCode(),name=schoolName();
    const body=rows().map(row=>[code,name,row.area,row.index,row.name,row.type,row.level,row.start,row.end,row.hours,row.itemCount,row.items].map(csvCell).join(','));
    download(`${slug(code+'-'+name)}-mapa-curricular.csv`,'\uFEFF'+[header.join(','),...body].join('\n'),'text/csv;charset=utf-8');
  }
  function ensureMenu(d){
    const actions=d.querySelector('.top .actions');if(!actions||d.getElementById('pciExportBox'))return;
    const box=d.createElement('span');box.id='pciExportBox';box.style.cssText='display:inline-flex;gap:6px;align-items:center';
    const json=d.createElement('button');json.className='btn';json.type='button';json.textContent='Respaldo JSON';json.title='Descargar una copia completa del PCI institucional activo';json.onclick=exportJSON;
    const csv=d.createElement('button');csv.className='btn';csv.type='button';csv.textContent='Mapa CSV';csv.title='Descargar el mapa curricular del PCI activo para abrir en Excel';csv.onclick=exportCSV;
    box.append(json,csv);actions.appendChild(box);
  }
  function decorate(){const d=frame()?.contentDocument;if(d)ensureMenu(d)}
  function boot(){frame()?.addEventListener('load',()=>setTimeout(decorate,500));setInterval(decorate,1000);decorate()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
