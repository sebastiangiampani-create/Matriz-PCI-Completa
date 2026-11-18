/** Organizador institucional de PCI, sin modificar ni fusionar documentos. */
export const TURNOS=[['manana','Mañana'],['tarde','Tarde'],['vespertino','Vespertino'],['noche','Noche']];
export const MODELOS=[['comun','Bachillerato / Media · mapa C1–C10'],['tecnica','Educación Técnica · mapa C1–C12']];
export function agruparPcis(pcis){
  if(!Array.isArray(pcis))throw new TypeError('Se requiere una lista de PCI.');
  const ids=new Set();
  const turnos=TURNOS.map(([id,nombre])=>({id,nombre,modelos:[],cantidad:0}));
  for(const p of pcis){
    if(!p||typeof p.pci_id!=='string'||!p.pci_id||
      !TURNOS.some(([id])=>id===p.shift_id)||
      !MODELOS.some(([id])=>id===p.model)||
      (p.model==='tecnica'?!p.specialty_name:!p.orientation_id)||
      ids.has(p.pci_id))throw Error('PCI institucional incompleto o duplicado.');
    ids.add(p.pci_id);
    const turno=turnos.find(t=>t.id===p.shift_id);
    let modelo=turno.modelos.find(m=>m.id===p.model);
    if(!modelo){
      modelo={id:p.model,nombre:MODELOS.find(([id])=>id===p.model)[1],pcis:[]};
      turno.modelos.push(modelo);
    }
    modelo.pcis.push(p);
    turno.cantidad++;
  }
  for(const t of turnos){
    t.modelos.sort((a,b)=>MODELOS.findIndex(([id])=>id===a.id)-MODELOS.findIndex(([id])=>id===b.id));
    for(const m of t.modelos)m.pcis.sort((a,b)=>String(a.title||'').localeCompare(String(b.title||''),'es'));
  }
  return turnos.filter(t=>t.cantidad);
}
