/**
 * Prescripciones anuales de Técnica aplicables al mapa V2.
 * Puro, inmutable, sin escritura ni acceso al estado de otros PCI.
 * Una falta normativa nunca se "corrige" borrando trabajo histórico.
 */
export const ANUALES_TECNICA_VERSION='espacios-anuales-tecnica-v2/1';

const copy = v => structuredClone(v);
const norm = x => String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/\s+/g,' ').trim();
const groupWork = group => {
  if(!group || typeof group!=='object')return false;
  const note = [group.objectives,group.synopsis,group.context,group.description,
    ...(group.contents||[]),...(group.items||[])].some(x=>String(x||'').trim());
  if(note)return true;
  return (group.plansBimestrales||[]).some(p=>{
    if((p?.contentIds||[]).length)return true;
    if([p?.synopsis,p?.objectives,p?.description].some(x=>String(x||'').trim()))return true;
    return Object.values(p?.stages||{}).some(stage=>
      ['description','activities','resources','duration','evidence'].some(k=>
        String(stage?.[k]||'').trim()));
  });
};
const byYear = (perfil,year) => (perfil.espacioAnual?.espacios||[])
  .find(x=>x.year===year) || null;
const findPrescribedSubject = (subjects,item) => {
  const matched=(subjects||[]).filter(s=>Number(s.year)===item.year &&
    norm(s.name)===norm(item.name) &&
    s.origin==='FO' && s.field==='formacion_tecnica_especifica');
  return matched.length===1?matched[0]:null;
};
const occupiedElsewhere = (map,id,slot) =>
  Object.entries(map.placements||{}).filter(([key,ids])=>key!==slot&&
    Array.isArray(ids)&&ids.includes(id)).map(([key])=>key);

export function auditarPrescripcionesAnualesTecnica(map,perfil,subjects=[]) {
  if(!map||typeof map!=='object'||!perfil?.specialtyId||!Array.isArray(subjects))
    throw new TypeError('Mapa, perfil técnico y materias requeridos.');
  const issues=[],expected=[],ready=[];
  const status=perfil.espacioAnual.status;
  for(const year of [4,5,6]) {
    const slot='anualEsp-n'+year;
    const assigned=map.placements?.[slot]||[];
    if(!Array.isArray(assigned)) {
      issues.push({slot,year,code:'ESTRUCTURA_INVALIDA',message:'Ubicaciones del anual inválidas.'});
      continue;
    }
    const item=byYear(perfil,year);
    if(!item) {
      if(assigned.length || groupWork(map.phase2V28?.groups?.[slot]))
        issues.push({slot,year,code:status==='no_ofrece'?'ANUAL_NO_CORRESPONDE':'ANUAL_NO_DEFINIDO',
          message:'El Anexo no prescribe anual para esta especialidad y año. Conservá la asignación histórica para revisión.'});
      continue;
    }
    const subject=findPrescribedSubject(subjects,item);
    const moved=subject ? occupiedElsewhere(map,subject.id,slot) : [];
    const exact=assigned.length===1 && subject && assigned[0]===subject.id;
    const record={slot,year,name:item.name,subjectId:subject?.id||null,
      expectedFrom:'Anexo II, páginas 17–18'};
    expected.push(record);
    if(!subject) {
      issues.push({...record,code:'MATERIA_NO_DISPONIBLE',
        message:'Falta la materia anual prescripta en el catálogo de la especialidad. No se inventa.'});
    }else if(moved.length) {
      issues.push({...record,code:'MATERIA_ASIGNADA_EN_OTRO_ESPACIO',
        message:'La materia anual prescripta está ubicada en otro espacio; no se duplica.',
        locations:moved});
    }
    if(assigned.length && !exact)issues.push({...record,code:'ANUAL_INCOMPATIBLE',
      message:'El espacio anual contiene una asignación distinta de la prescripción. No se sobrescribe.',
      originalIds:[...assigned]});
    if(!assigned.length && groupWork(map.phase2V28?.groups?.[slot]))
      issues.push({...record,code:'DESARROLLO_SIN_ASIGNACION',
        message:'El espacio anual tiene contenidos o planes anteriores. Debe revisarse antes de asociar otra materia.'});
    if(exact && !moved.length)ready.push({...record,status:'correcto'});
    else if(subject && !assigned.length && !moved.length &&
      !groupWork(map.phase2V28?.groups?.[slot]))
      ready.push({...record,status:'incorporable'});
  }
  return {
    status,expected,ready,issues,
    fixed:ready.filter(x=>x.status==='correcto'),
    toPlace:ready.filter(x=>x.status==='incorporable'),
    prescripcionCompleta:status==='prescripto'&&
      expected.length===3&&issues.length===0&&ready.every(x=>x.status==='correcto')
  };
}

export function prearmarAnualesTecnica(map,perfil,subjects=[]) {
  const audit=auditarPrescripcionesAnualesTecnica(map,perfil,subjects);
  const next=copy(map);
  const applied=[];
  for(const item of audit.toPlace) {
    next.placements ||= {};
    next.placements[item.slot]=[item.subjectId];
    applied.push({...item});
  }
  if(applied.length)next.valid=false;
  return {map:next,applied,issues:copy(audit.issues),
    version:ANUALES_TECNICA_VERSION};
}

export function anualPrescriptoDeMateria(perfil,subject) {
  if(!perfil || !subject)return null;
  return (perfil.espacioAnual?.espacios||[]).find(item=>
    Number(subject.year)===item.year && norm(subject.name)===norm(item.name))||null;
}

export function esMateriaAnualCorrecta(perfil,subject,year) {
  if(!subject || !perfil || ![4,5,6].includes(Number(year)))return false;
  const item=byYear(perfil,Number(year));
  return Boolean(item&&anualPrescriptoDeMateria(perfil,subject) &&
    subject.origin==='FO' && subject.field==='formacion_tecnica_especifica');
}
