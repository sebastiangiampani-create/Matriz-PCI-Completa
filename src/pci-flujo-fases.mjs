/**
 * Fases del PCI Secundaria Aprende.
 *
 * Fase 1: construir y validar el Mapa de la Oferta de UN PCI.
 * Fase 2: heredar su estructura para desarrollar contenidos, secuencias y planes.
 *
 * No crea estados nuevos en la base ni homologa automáticamente un PCI:
 * la puerta depende de una revisión guardada y de su validación actual.
 */
const list=v=>Array.isArray(v)?v:[];
export function phaseGate({revision=0,dirty=false,issues=[],warnings=[],label='Mapa de la Oferta'}={}){
  const errors=[...new Set(list(issues).map(i=>typeof i==='string'?i:i?.message||String(i)).filter(Boolean))];
  const cautions=[...new Set(list(warnings).map(i=>typeof i==='string'?i:i?.message||String(i)).filter(Boolean))];
  const reasons=[];
  if(!Number.isSafeInteger(Number(revision))||Number(revision)<=0)
    reasons.push('Guardá el mapa curricular de este PCI.');
  if(dirty)
    reasons.push('Hay cambios en el constructor sin guardar.');
  if(errors.length)
    reasons.push('El constructor tiene '+errors.length+' pendiente'+(errors.length===1?'':'s')+' de composición.');
  return {
    label,revision:Number(revision)||0,
    ready:reasons.length===0,reasons,issues:errors,warnings:cautions,
    step:reasons.length?'constructor':'desarrollo',
    detail:reasons.length
      ?reasons.join(' ')+' '+errors.slice(0,3).join(' · ')
      :'Mapa curricular de este PCI guardado y sin inconsistencias de composición. Ya podés entrar al Desarrollo Curricular.'
  };
}
export function phaseText(result){
  return result.ready
    ?'Fase 1 lista · Podés ingresar a Fase 2: Desarrollo Curricular.'
    :'Fase 1 pendiente · '+result.detail;
}
