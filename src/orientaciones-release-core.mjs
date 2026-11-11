/**
 * Núcleo de persistencia curricular por PCI (sin efectos secundarios).
 * El JSON histórico solo se lee: toda edición se realiza sobre una copia.
 */
export const FG_UNIT_SCHEMA='pci-fg-area-v2/1';
export const OFFER_UNIT_SCHEMA='pci-oferta-fo-v2/1';
export const FO_UNIT_SCHEMA='pci-fo-desarrollo-v2/1';
const copy=x=>JSON.parse(JSON.stringify(x));
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const stages=['punto_partida','indagacion','produccion','evaluacion'];

export function requireSchoolPci(pci,schoolId){
  if(!object(pci)||!nonempty(pci.pci_id)||Number(pci.school_id)!==Number(schoolId)||
    !nonempty(pci.orientation_id)||!nonempty(pci.process_id)||
    !nonempty(pci.legacy_sha256)||!object(pci.legacy_state)||
    !object(pci.legacy_state.areas))
    throw Error('Datos institucionales o procedencia de la FG inválidos.');
  if(pci.legacy_state.profile==='tecnica')
    throw Error('La Matriz Técnica requiere un adaptador curricular específico.');
  return pci;
}

export function newFgUnit({pci,area,convertedAreas}){
  requireSchoolPci(pci,pci.school_id);
  const historical=Object.hasOwn(pci.legacy_state.areas,area);
  if(!nonempty(area)||(!historical&&Object.keys(pci.legacy_state.areas).length!==0))
    throw Error('El área no pertenece a esta escuela o su plantilla inicial.');
  const old=historical?copy(pci.legacy_state.areas[area]):{groups:[]};
  const converted=object(convertedAreas?.[area])?copy(convertedAreas[area]):copy(old);
  if(!Array.isArray(old.groups)||!Array.isArray(converted.groups))
    throw Error('Agrupamientos inválidos: no se puede importar.');
  if(historical){
    const oldIds=old.groups.map(g=>String(g.id));
    const currentIds=converted.groups.map(g=>String(g.id));
    if(oldIds.length!==currentIds.length || oldIds.some((id,i)=>id!==currentIds[i]))
      throw Error('La importación alteró agrupamientos. Se suspende el guardado.');
  }
  for(let i=0;i<old.groups.length;i++){
    const before=old.groups[i],after=converted.groups[i];
    const bp=Array.isArray(before.plansBimestrales)?before.plansBimestrales:[];
    const ap=Array.isArray(after.plansBimestrales)?after.plansBimestrales:[];
    if(bp.length!==ap.length)
      throw Error('La importación alteró el número de planes de un agrupamiento.');
    for(let j=0;j<bp.length;j++){
      for(const id of stages)if(JSON.stringify(bp[j]?.stages?.[id])!==JSON.stringify(ap[j]?.stages?.[id]))
        throw Error('Se alteró una etapa pedagógica histórica durante la importación.');
    }
  }
  return {
    ...converted,
    schema:FG_UNIT_SCHEMA,
    school_id:pci.school_id,pci_id:pci.pci_id,orientation_id:pci.orientation_id,
    original_sha256:pci.legacy_sha256,area,
    originType:historical?'historical':'empty-institution-template',
    curriculumCatalog:'fg-sec-aprende-v2/1'
  };
}

export function guardFgUnit(unit,pci,area){
  requireSchoolPci(pci,pci.school_id);
  if(!object(unit)||unit.schema!==FG_UNIT_SCHEMA||
    Number(unit.school_id)!==Number(pci.school_id)||
    unit.pci_id!==pci.pci_id||unit.orientation_id!==pci.orientation_id||
    unit.original_sha256!==pci.legacy_sha256||unit.area!==area||
    !Array.isArray(unit.groups))
    throw Error('El área FG no pertenece a este PCI. No se guarda.');
  return copy(unit);
}

export function newOfferUnit({pci,workspace}){
  requireSchoolPci(pci,pci.school_id);
  const fo=workspace?.orientations?.[pci.orientation_id]?.fo;
  if(!object(fo)||!Array.isArray(fo.spaces))throw Error('Mapa de oferta FO inválido.');
  return {schema:OFFER_UNIT_SCHEMA,school_id:pci.school_id,pci_id:pci.pci_id,
    orientation_id:pci.orientation_id,original_sha256:pci.legacy_sha256,fo:copy(fo)};
}

export function restoreOfferUnit({pci,workspace,document}){
  requireSchoolPci(pci,pci.school_id);
  if(!object(document)||document.schema!==OFFER_UNIT_SCHEMA||
    Number(document.school_id)!==Number(pci.school_id)||document.pci_id!==pci.pci_id||
    document.orientation_id!==pci.orientation_id||
    document.original_sha256!==pci.legacy_sha256||
    !object(document.fo)||!Array.isArray(document.fo.spaces))
    throw Error('Mapa de oferta de otra escuela, orientación, proceso o revisión.');
  const clone=copy(workspace);
  if(!clone?.orientations?.[pci.orientation_id])
    throw Error('La orientación del paquete no existe.');
  // Reponer solamente la FO registrada: nunca tocar la FG histórica o su copia.
  clone.orientations[pci.orientation_id].fo=copy(document.fo);
  return clone;
}

export function newFoUnit({pci,space,development}){
  requireSchoolPci(pci,pci.school_id);
  if(!object(space)||!nonempty(space.id)||!object(development)||
     String(development.slot)!==String(space.id)||
     development.orientation!==pci.orientation_id)
    throw Error('El desarrollo FO no corresponde a este espacio.');
  const plans=development.plansBimestrales;
  if(!Array.isArray(plans)||plans.length!==4)
    throw Error('El desarrollo FO debe conservar sus cuatro planes de aprendizaje.');
  return {...copy(development),schema:FO_UNIT_SCHEMA,school_id:pci.school_id,pci_id:pci.pci_id,
    orientation_id:pci.orientation_id,original_sha256:pci.legacy_sha256,
    space_id:String(space.id)};
}

export function guardFoUnit(unit,pci,spaceId){
  if(!object(unit)||unit.schema!==FO_UNIT_SCHEMA||unit.space_id!==String(spaceId)||
    unit.orientation_id!==pci.orientation_id||unit.pci_id!==pci.pci_id||
    Number(unit.school_id)!==Number(pci.school_id)||
    unit.original_sha256!==pci.legacy_sha256)
    throw Error('El desarrollo FO no pertenece a este PCI.');
  return copy(unit);
}

export function inventory(legacy){
  const areas=Object.entries(legacy?.areas||{});
  const groups=areas.flatMap(([area,obj])=>(obj?.groups||[]).map(g=>({area,...g})));
  return {areas:areas.length,groups:groups.length,plans:groups.reduce((a,g)=>a+(g.plansBimestrales?.length||0),0),
    contents:new Set(groups.flatMap(g=>g.items||[]).map(String)).size};
}

export function editStageDescription(plan,stageId,value){
  if(!stages.includes(stageId)||!object(plan))throw Error('Etapa inválida.');
  const result=copy(plan);
  const current=result.stages?.[stageId];
  result.stages={...result.stages,[stageId]:typeof current==='string'?
    {description:String(value),originalText:current}: {...(object(current)?current:{}),description:String(value)}};
  return result;
}
