/**
 * Revisión no destructiva de la Formación General histórica.
 * No usa Supabase ni muta la Matriz, el Mapa de la Oferta o el navegador.
 * IMPORTANTE: la migración definitiva debe usar el estado bruto respaldado
 * desde la base escolar, ANTES de toda normalización del editor.
 */
const clone = value => JSON.parse(JSON.stringify(value));
const isRecord = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const list = v => Array.isArray(v) ? v : [];
const stageValues = value => isRecord(value) ? Object.values(value) : [];
const hasData = v => {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (isRecord(v)) return Object.values(v).some(hasData);
  return typeof v === 'number' || v === true;
};

export function summarizeSource(source) {
  if (!isRecord(source) || !isRecord(source.areas)) throw new Error('La Matriz original no contiene áreas curriculares reconocibles.');
  const areas = Object.entries(source.areas).map(([name, value]) => {
    const groups = list(value?.groups);
    const ids = new Set(groups.map(group => String(group?.id || '')).filter(Boolean));
    const placedIds = new Set(groups.flatMap(group => list(group?.items).map(String)));
    let plans = 0, plansWithData = 0, sequences = 0;
    for (const group of groups) {
      for (const plan of list(group?.plansBimestrales)) {
        plans += 1;
        if (['name','synopsis','objectives','contentIds','stages','description','context'].some(key => hasData(plan?.[key]))) plansWithData += 1;
        if (stageValues(plan?.stages).some(hasData)) sequences += 1;
      }
    }
    return {name, groups:groups.length, groupIds:ids.size, contents:placedIds.size, plans, plansWithData, sequences};
  });
  return {
    schoolName:String(source.schoolName || 'Sin nombre'),
    areaCount:areas.length,
    groupCount:areas.reduce((sum,a)=>sum+a.groups,0),
    contentCount:new Set(Object.values(source.areas).flatMap(a=>list(a?.groups).flatMap(g=>list(g?.items).map(String)))).size,
    plans:areas.reduce((sum,a)=>sum+a.plans,0),
    plansWithData:areas.reduce((sum,a)=>sum+a.plansWithData,0),
    sequences:areas.reduce((sum,a)=>sum+a.sequences,0),
    areas
  };
}

export function prepareReview(source, orientation, offerMap = null) {
  if (!isRecord(source) || !isRecord(source.areas)) throw new Error('No hay una Matriz original disponible para preparar la copia.');
  if (typeof orientation !== 'string' || !orientation.trim()) throw new Error('Seleccioná una orientación.');
  const originalText = JSON.stringify(source);
  if (!originalText) throw new Error('No se pudo leer el documento original.');
  // Se preserva TODO el objeto y cada campo desconocido. No se migra ni se normaliza.
  const copy = JSON.parse(originalText);
  const summary = summarizeSource(copy);
  const warnings = [];
  const historicSocial = list(copy.areas?.['Ciencias Sociales']?.groups);
  const mapSocial = offerMap?.socialOption === 'A' ? 10 : offerMap?.socialOption === 'B' ? 12 : null;
  if (mapSocial !== null && historicSocial.length !== mapSocial) {
    warnings.push({
      type:'revisar-laboratorio',area:'Ciencias Sociales',
      message:'Revisar laboratorio: la Matriz original tiene '+historicSocial.length+
        ' agrupamientos de Sociales y el mapa de esta orientación define '+mapSocial+
        '. Hay que revisar ubicaciones, contenidos, planes y secuencias antes de aplicar cambios.'
    });
  }
  if (mapSocial === null) warnings.push({
    type:'mapa-pendiente',area:'Ciencias Sociales',
    message:'Todavía no está confirmada la opción de Ciencias Sociales en el mapa de esta orientación.'
  });
  const duplicated = new Set(),seen = new Set();
  for (const area of Object.values(copy.areas)) for(const group of list(area?.groups)){
    const id=String(group?.id || '');
    if(!id)continue;
    if(seen.has(id))duplicated.add(id);
    seen.add(id);
  }
  if (duplicated.size) warnings.push({
    type:'identificadores',area:'General',
    message:'Hay identificadores de agrupamientos repetidos. No se modificaron automáticamente.'
  });
  return {
    format:'matriz-pci-revision-no-destructiva-v1',
    orientation:orientation.trim(),
    source:copy,
    summary,
    warnings,
    reviewed:false,
    approved:false,
    // Marca del contenido: se verifica contra el origen en el momento del OK.
    sourceSnapshot:originalText
  };
}

export function approveReview(draft, currentSource) {
  if (!draft || draft.format !== 'matriz-pci-revision-no-destructiva-v1') throw new Error('Primero prepará una copia para revisar.');
  if (JSON.stringify(currentSource) !== draft.sourceSnapshot) {
    throw new Error('La Matriz original cambió desde que se preparó la copia. Volvé a iniciar la revisión.');
  }
  if (draft.approved) return draft;
  return {...draft, reviewed:true, approved:true};
}
