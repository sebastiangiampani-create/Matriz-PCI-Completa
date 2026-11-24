/** Cierre de reglas Media sobre V2 nativo, sin alterar vendor ni V91. */
(() => {
  'use strict';
  const cfg=window.__PCI_APLICACION_CONFIG;
  if (cfg?.modelo!=='media') return;
  const reglas=cfg.mediaCierre;
  if (!reglas?.auditarCierreMedia || !reglas?.cambiarArticulacionPvf ||
      !reglas?.resguardarNaturalesQuinto)
    throw Error('No está disponible el cierre normativo de Media.');
  const editable=cfg.contexto.permissions.puedeEditar===true;
  const naturaleza=cfg.contexto.pci.orientation_id===reglas.MEDIA_NATURALES_ORIENTACION;
  const slots=reglas.MEDIA_FO_QUINTO;
  const current=()=>ensure(state.active);
  const copy=x=>structuredClone(x);
  let horas=null,errorHoras=null,articulacionAbierta=false;

  const previoRowDefs=rowDefs;
  rowDefs=function(...args) {
    const rows=previoRowDefs(...args);
    if(!naturaleza) return rows;
    return rows.map(row=>{
      if(row.k!=='naturales')return row;
      const acepta=row.a;
      return {...row,a:t=>t<=8 && (!acepta || acepta(t))};
    });
  };
  const previoRenderBag=renderBag;
  renderBag=function(...args) {
    const result=previoRenderBag(...args);
    if(naturaleza) {
      const excluida=subjects().find(s=>s?.origin==='FG'&&Number(s.year)===5&&s.name==='Química');
      if(excluida)document.querySelectorAll('#bagContent [data-sub]').forEach(node=>{
        if(node.dataset.sub===excluida.id)node.remove();
      });
    }
    return result;
  };
  const previoValidTarget=validTarget;
  validTarget=function(slot,s) {
    if(naturaleza&&s?.origin==='FG'&&Number(s.year)===5&&s.name==='Química')
      return [false,'En la orientación Ciencias Naturales no corresponde la materia FG Química de 5.º; los laboratorios FG terminan en C8.'];
    if(naturaleza&&reglas.MEDIA_NATURALES_QUINTO.includes(slot))
      return [false,'La orientación Ciencias Naturales ofrece 8 laboratorios FG, de C1 a C8. No hay laboratorios FG en 5.º.'];
    return previoValidTarget(slot,s);
  };

  function audit() {
    return reglas.auditarCierreMedia(current(),{
      orientacionId:cfg.contexto.pci.orientation_id,orientacion:state.active,
      materias:subjects(),catalogoHoras:horas
    });
  }
  function invalid(message) {
    const target=document.getElementById('validation');
    if(target) {
      target.className='validation rule-block';
      target.replaceChildren();
      const strong=document.createElement('strong');strong.textContent='Composición pendiente de corrección';
      target.append(strong,document.createTextNode(message));
    }
    current().valid=false;
    toast(message,true);
  }
  function actualizarRelacion(slot,checked) {
    if(!editable) return false;
    const mapa=current(),update=reglas.cambiarArticulacionPvf(mapa,slot,checked);
    mapa.pvfArticulaciones=update.pvfArticulaciones;
    mapa.valid=false;
    save();renderOffer();
    return true;
  }
  function resguardar() {
    if(!editable || !naturaleza) return false;
    const mapa=current(),result=reglas.resguardarNaturalesQuinto(mapa,{
      orientacionId:cfg.contexto.pci.orientation_id,fecha:new Date().toISOString()
    });
    if(!result.cambio)return false;
    const nuevo=result.mapa;
    // No sustituir el mapa: otras capas mantienen referencias a su desarrollo.
    for(const campo of ['placements','phase2V28','phase2','resguardosNormativos'])
      if(Object.hasOwn(nuevo,campo))mapa[campo]=nuevo[campo];
    mapa.valid=false;
    save();renderOffer();
    toast('Asignaciones anteriores conservadas en Resguardos normativos. La cobertura de V91 no se modificó.');
    return true;
  }
  function descargarResguardos() {
    const resguardos=current().resguardosNormativos?.naturales5 || [];
    if(!resguardos.length)return;
    const raw=JSON.stringify({escuela:cfg.contexto.school.id,pci:cfg.contexto.pci.pci_id,
      orientacion:state.active,resguardos},null,2);
    const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
    const a=document.createElement('a');
    a.href=url;a.download='resguardo-naturales-5-pci.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const make=(tag,text,className)=>{
    const element=document.createElement(tag);
    if(text!==undefined)element.textContent=text;
    if(className)element.className=className;
    return element;
  };
  function buildPanel() {
    const host=document.querySelector('#offer .matrix-card');
    if(!host)return;
    let panel=document.getElementById('pciMediaCierre');
    if(!panel) {
      panel=make('details',undefined,'pci-media-cierre');
      panel.id='pciMediaCierre';
      const matrix=host.querySelector('.matrix-shell');
      if(matrix)matrix.after(panel);else host.append(panel);
      panel.addEventListener('toggle',()=>{articulacionAbierta=panel.open;});
    }
    panel.replaceChildren();
    const stateAudit=audit();
    const heading=make('summary','Proyecto de Vinculación · articulación FO 5.º ('+stateAudit.articulaciones.length+' espacios vinculados)');
    const help=make('p','Podés vincular pedagógicamente los laboratorios y talleres de FO con el proyecto anual prescripto. No se trasladan materias ni se fusionan espacios: cada espacio conserva sus planes bimestrales, evaluación, calificación y horas. El proyecto conserva sus cuatro planes bimestrales.');
    panel.append(heading,help);
    const grid=make('div',undefined,'pci-media-cierre-grid');
    for(const slot of slots) {
      const term=slot.endsWith('c9')?'C9':'C10';
      const tipo=slot.startsWith('foLab')?'Laboratorio':'Taller';
      const details=stateAudit.detalle.find(item=>item.slot===slot);
      const name=tipo+' FO '+term;
      const row=make('label',undefined,'pci-media-cierre-option');
      const box=document.createElement('input');box.type='checkbox';
      box.dataset.pvfArticulacion=slot;
      box.checked=stateAudit.articulaciones.includes(slot);
      box.disabled=!editable;
      box.onchange=()=>actualizarRelacion(slot,box.checked);
      const wrap=make('span',undefined,'pci-media-cierre-text');
      wrap.append(make('strong',name));
      const sum=details ? details.cantidad+' materias · '+details.hcConocidas+' HC'+
        (details.horasPendientes?' · '+details.horasPendientes+' cargas pendientes':'') : 'Composición pendiente';
      wrap.append(make('small',sum));
      row.append(box,wrap);
      grid.append(row);
    }
    panel.append(grid);
    const footer=make('p','Regla: mínimo dos materias de FO del mismo año por laboratorio/taller. Máximo 9 HC por espacio, salvo los espacios de FO de 5.º de Ciencias Naturales. Las horas del Proyecto de Vinculación no se duplican en los espacios articulados.','pci-media-cierre-help');
    panel.append(footer);
    if(naturaleza)panel.append(make('p','Ciencias Naturales: los 8 laboratorios FG terminan en C8. En 5.º no existen las celdas de laboratorio FG de Naturales.','pci-media-cierre-help'));
    if(errorHoras)panel.append(make('p','No se pudo cargar la base oficial de horas: '+errorHoras,'pci-media-cierre-warning'));
    const previous=current().resguardosNormativos?.naturales5 || [];
    const irregular=stateAudit.naturalesQuinto;
    if(naturaleza&&(irregular.ubicaciones.length||irregular.grupos.length||irregular.propios)) {
      const warning=make('div',undefined,'pci-media-cierre-warning');
      warning.setAttribute('role','alert');
      warning.append(make('strong','Revisión de un mapa anterior de Ciencias Naturales'));
      warning.append(make('p','Hay trabajo en C9/C10 de Naturales FG. No se eliminó. Para corregir el mapa, podés resguardarlo expresamente dentro del mismo PCI antes de volver a validar.'));
      if(editable) {
        const button=make('button','Conservar copia y retirar las ubicaciones no prescriptas','btn soft small');
        button.type='button';
        button.onclick=resguardar;
        warning.append(button);
      }
      panel.append(warning);
    }
    if(previous.length) {
      const row=make('div',undefined,'pci-media-cierre-history');
      row.append(make('span',previous.length+' resguardo(s) histórico(s) dentro del PCI.'));
      const button=make('button','Descargar resguardo JSON','btn soft small');
      button.type='button';button.onclick=descargarResguardos;row.append(button);
      panel.append(row);
    }
    const extras=stateAudit.errores.filter(e=>e.codigo!=='MEDIA_FO_MINIMO' &&
      e.codigo!=='MEDIA_NATURALES_5_HISTORICO');
    if(extras.length)panel.append(make('p','Revisar: '+extras.map(x=>x.mensaje).join(' '),'pci-media-cierre-warning'));
    // No abrir un bloque extenso por defecto; las advertencias que exigen
    // actuación sí deben mostrarse sin interacción adicional.
    panel.open=articulacionAbierta||Boolean(errorHoras)||(naturaleza&&
      (irregular.ubicaciones.length||irregular.grupos.length||irregular.propios))||extras.length>0;
  }
  const previoRenderOffer=renderOffer;
  renderOffer=function(...args) {
    const result=previoRenderOffer(...args);
    buildPanel();
    return result;
  };
  const previoValidateOffer=validateOffer;
  validateOffer=function(...args) {
    const result=audit(),alerts=[...result.errores,...result.pendientes];
    if(alerts.length) {
      invalid(alerts[0].mensaje+' ('+alerts[0].slot+').');
      save();
      return false;
    }
    return previoValidateOffer(...args);
  };
  function decorarFase2() {
    const group=document.querySelector('#v28groups [data-g="proyecto-n5"] .v28-subjects');
    if(!group)return;
    let text=group.querySelector('[data-pvf-articulaciones]');
    if(!text) {
      text=make('small',undefined,'pci-media-cierre-plan');
      text.dataset.pvfArticulaciones='true';group.append(text);
    }
    const pairs=current().pvfArticulaciones?.espacios || [];
    text.textContent=pairs.length ? 'Articulación pedagógica con '+pairs.length+
      ' espacios FO de 5.º (planes y calificaciones independientes)' :
      'Puede articular pedagógicamente con espacios FO de 5.º (sin fusionar planes)';
  }
  const css=document.createElement('style');
  css.textContent='#offer .matrix-card{display:flex;flex-direction:column}#offer .matrix-card>.pci-media-cierre{order:20}' +
    '.pci-media-cierre{margin:9px 0;padding:8px 12px;border:1px solid var(--l);border-radius:12px;background:#fff}' +
    '.pci-media-cierre>summary{cursor:pointer;font-size:.77rem;font-weight:850;padding:3px 2px;list-style-position:inside}.pci-media-cierre:not([open]){background:var(--band)}' +
    '.pci-media-cierre h3{font-size:.84rem;margin:0 0 7px}.pci-media-cierre p{font-size:.73rem;line-height:1.48;margin:5px 0 11px}' +
    '.pci-media-cierre-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}' +
    '.pci-media-cierre-option{display:flex;gap:9px;align-items:flex-start;padding:10px;border:1px solid var(--l);border-radius:10px;background:var(--band);min-width:0}' +
    '.pci-media-cierre-option input{margin-top:2px;flex-shrink:0}.pci-media-cierre-text{display:grid;min-width:0;overflow-wrap:anywhere}' +
    '.pci-media-cierre-text strong{font-size:.72rem}.pci-media-cierre-text small{font-size:.66rem;color:var(--muted)}' +
    '.pci-media-cierre-help{color:var(--muted)}.pci-media-cierre-warning{font-size:.72rem;line-height:1.5;padding:10px;border:1px solid #e3b9a4;border-radius:10px;overflow-wrap:anywhere}' +
    '.pci-media-cierre-history{display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:.7rem;margin-top:9px}' +
    '.pci-media-cierre-plan{display:block;flex-basis:100%;font-size:.65rem;color:var(--muted)}' +
    '@media(max-width:650px){.pci-media-cierre-grid{grid-template-columns:minmax(0,1fr)}}';
  document.head.appendChild(css);
  window.addEventListener('pci-phase2-groups-rendered',decorarFase2);
  window.addEventListener('pci-app-ready',()=>{
    fetch('data/horas-v2.json?v=media-cierre-20261121',{cache:'force-cache'}).then(r=>{
      if(!r.ok)throw Error('No se recibió la base de horas de Media.');
      return r.json();
    }).then(data=>{horas=data;errorHoras=null;buildPanel();},
      error=>{errorHoras=String(error.message||error);buildPanel();});
    buildPanel();decorarFase2();
  });
  window.PCIMediaCierre=Object.freeze({auditar:audit,articular:actualizarRelacion,
    resguardarNaturales:resguardar,render:buildPanel});
})();
