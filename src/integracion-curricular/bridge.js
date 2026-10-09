/**
 * Integracion curricular (etapa aislada, sin persistencia).
 *
 * La FG original de Matriz PCI Completa es inmutable en este adaptador.
 * Una copia independiente por orientacion conserva cada agrupamiento,
 * sus contenidos, los planes bimestrales y las cuatro etapas de secuencia.
 *
 * No mover materias FG/FO ni guardar en produccion desde este modulo.
 */
export const BRIDGE_VERSION='pci-integracion/1';
export const FG_MODES=Object.freeze({
  CONSERVAR:'conservar',
  REVISAR:'revisar'
});
export const ORIENTATIONS=Object.freeze([
  {id:'ciencias_naturales',name:'Ciencias Naturales'},
  {id:'matematica_fisica',name:'Matemática y Física'},
  {id:'energia_sustentabilidad',name:'Energía y Sustentabilidad'},
  {id:'economia_administracion',name:'Economía y Administración'},
  {id:'educacion_fisica',name:'Educación Física'},
  {id:'comunicacion',name:'Comunicación'},
  {id:'literatura',name:'Literatura'},
  {id:'turismo',name:'Turismo'},
  {id:'lenguas',name:'Lenguas'},
  {id:'informatica',name:'Informática'},
  {id:'educacion',name:'Educación'},
  {id:'ciencias_sociales_humanidades',name:'Ciencias Sociales y Humanidades'},
  {id:'arte',name:'Arte'},
  {id:'agro_ambiente',name:'Agro y Ambiente'}
]);
const CATALOG=new Map(ORIENTATIONS.map(o=>[o.id,o]));
const STAGE_IDS=['punto_partida','indagacion','produccion','evaluacion'];
const copy=v=>JSON.parse(JSON.stringify(v));
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const nonEmpty=v=>typeof v==='string'&&v.trim().length>0;
function groups(areas) {
  return Object.entries(areas||{}).flatMap(([area,a])=>
    Array.isArray(a?.groups)?a.groups.map(group=>({area,group})):[]
  );
}
function hasStageWork(stage) {
  return isObject(stage)&&['description','duration','resources','activities']
    .some(k=>nonEmpty(stage[k]));
}
function hasPlanWork(plan) {
  return nonEmpty(plan?.objectives)||nonEmpty(plan?.synopsis)||
    (Array.isArray(plan?.contentIds)&&plan.contentIds.length>0)||
    STAGE_IDS.some(id=>hasStageWork(plan?.stages?.[id]));
}
function countInventory(areas) {
  const gs=groups(areas),ps=gs.flatMap(({group})=>Array.isArray(group.plansBimestrales)?group.plansBimestrales:[]);
  return {
    groups:gs.length,
    groupsWithContents:gs.filter(({group})=>Array.isArray(group.items)&&group.items.length>0).length,
    groupsWithPlans:gs.filter(({group})=>Array.isArray(group.plansBimestrales)&&group.plansBimestrales.length>0).length,
    plans:ps.length,
    plansWithWork:ps.filter(hasPlanWork).length,
    stagesWithWork:ps.reduce((n,p)=>n+STAGE_IDS.filter(id=>hasStageWork(p?.stages?.[id])).length,0)
  };
}
// This non-cryptographic checksum detects routine changes; it is not
// a replacement for a verified backup or a server-side SHA-256.
function fingerprint(v) {
  const s=JSON.stringify(v);let hash=2166136261;
  for(let i=0;i<s.length;i++)hash=Math.imul(hash^s.charCodeAt(i),16777619);
  return s.length.toString(16)+'-'+(hash>>>0).toString(16);
}
function validateLegacy(legacy) {
  if(!isObject(legacy)||!isObject(legacy.areas))
    throw new TypeError('La Matriz PCI debe contener sus áreas originales.');
  if(legacy.profile==='tecnica'||legacy.areas['Tecnología de la Representación'])
    throw new Error('El modelo técnico necesita un adaptador distinto.');
  const keys=new Set();
  for(const {area,group} of groups(legacy.areas)){
    if(!isObject(group)||group.id===undefined||group.id===null||!String(group.id))
      throw new Error('Existe un agrupamiento sin identificador.');
    const key=JSON.stringify([area,String(group.id)]);
    if(keys.has(key))throw new Error('Hay agrupamientos duplicados: '+area);
    keys.add(key);
  }
}
function workspace(pack,id) {
  if(!isObject(pack)||pack.version!==BRIDGE_VERSION)
    throw new Error('Paquete de integración incompatible.');
  if(!pack.orientations?.[id])throw new Error('La orientación aún no fue seleccionada.');
  return pack.orientations[id];
}
function groupCopy(legacy,orientation) {
  const areas=copy(legacy.areas);
  return {
    id:orientation.id,
    name:orientation.name,
    fg:{
      mode:FG_MODES.CONSERVAR,
      areas,
      originFingerprint:fingerprint(legacy.areas),
      links:groups(areas).map(({area,group})=>({
        area,originGroupId:String(group.id),copiedGroupId:String(group.id)
      }))
    },
    fo:{spaces:[],assignments:[]},
    decisions:[],
    pendingReviews:[],
    status:'pendiente-validacion-curricular'
  };
}

/**
 * Copies the FG once per newly selected orientation.
 * Re-selecting does not rebuild existing orientations or their sequences.
 * Never modifies legacyState or writes to Supabase.
 */
export function createOrientationPackage({legacyState,schoolId,orientationIds,existing=null}) {
  validateLegacy(legacyState);
  const sid=Number(schoolId);
  if(!Number.isInteger(sid)||sid<1001)throw new Error('Se requiere una escuela real.');
  if(!Array.isArray(orientationIds))throw new TypeError('Se requieren orientaciones.');
  const sourceFingerprint=fingerprint(legacyState.areas);
  const pack=existing?copy(existing):{
    version:BRIDGE_VERSION,
    schoolId:sid,
    legacy:{schemaVersion:legacyState.schemaVersion??null,
      fingerprint:sourceFingerprint,inventory:countInventory(legacyState.areas)},
    orientations:{}
  };
  if(pack.version!==BRIDGE_VERSION||pack.schoolId!==sid)
    throw new Error('No se puede reutilizar un paquete de otra escuela.');
  if(pack.legacy?.fingerprint!==sourceFingerprint)
    throw new Error('Cambió la Formación General original: se requiere conciliación, no sobrescritura.');
  for(const id of new Set(orientationIds)) {
    const orientation=CATALOG.get(id);
    if(!orientation)throw new Error('Orientación desconocida: '+String(id));
    if(!Object.hasOwn(pack.orientations,id))
      pack.orientations[id]=groupCopy(legacyState,orientation);
  }
  return pack;
}

/**
 * Choice presented once the initial FG is already organized:
 * 'conservar' (default) or 'revisar'. Both are non-destructive.
 */
export function chooseFgMode(pack,orientationId,mode) {
  if(!Object.values(FG_MODES).includes(mode))
    throw new Error('Elegí conservar o revisar.');
  workspace(pack,orientationId);
  const changed=copy(pack);
  changed.orientations[orientationId].fg.mode=mode;
  return changed;
}

/**
 * Read-only choice information for a future school-facing interface.
 * UI code should take title/labels as text, never inject saved HTML.
 */
export function getFgDecision(pack,orientationId) {
  const w=workspace(pack,orientationId);
  return {
    title:'Tu Formación General ya está construida',
    description:'Podés conservar los agrupamientos existentes o revisarlos para esta orientación. Las secuencias y planes no se eliminan.',
    orientation:w.name,
    selected:w.fg.mode,
    options:[
      {value:FG_MODES.CONSERVAR,label:'Conservar la Formación General',description:'Mantener los agrupamientos, contenidos y secuencias copiados de la matriz existente.'},
      {value:FG_MODES.REVISAR,label:'Revisar y adaptar esta orientación',description:'Analizar posibles articulaciones FG–FO y señalar los laboratorios y planes que requieran revisión.'}
    ],
    pendingReviews:w.pendingReviews.length
  };
}

/**
 * Registers a proposed FO space in this isolated package only.
 * The prescribed number and composition of FO spaces remains subject
 * to a separate curriculum validator before publishing.
 */
export function registerFoSpace(pack,orientationId,definition) {
  const w=workspace(pack,orientationId);
  if(!isObject(definition)||!nonEmpty(String(definition.id??'')))
    throw new Error('Se requiere el identificador de un espacio FO.');
  const year=Number(definition.year);
  if(!Number.isInteger(year)||year<3||year>5)
    throw new Error('La Formación Orientada se organiza en niveles 3.º a 5.º.');
  const kind=definition.kind;
  if(!['laboratorio','taller','proyecto'].includes(kind))
    throw new Error('El tipo de espacio FO es inválido.');
  if(kind==='proyecto'&&year!==5)
    throw new Error('El Proyecto de Vinculación se ubica en 5.º.');
  if(w.fo.spaces.some(x=>String(x.id)===String(definition.id)))
    throw new Error('Ese espacio FO ya existe; no se sobrescribe.');
  const updated=copy(pack);
  updated.orientations[orientationId].fo.spaces.push({
    id:String(definition.id),name:String(definition.name||definition.id),year,kind,
    members:Array.isArray(definition.members)?copy(definition.members):[]
  });
  return updated;
}

export function inspectIntegration(legacyState,pack) {
  validateLegacy(legacyState);
  const baseline=countInventory(legacyState.areas);
  const currentFingerprint=fingerprint(legacyState.areas);
  const result={original:baseline,legacyUntouched:pack.legacy?.fingerprint===currentFingerprint,orientations:{}};
  for(const [id,w] of Object.entries(pack.orientations||{})){
    const inv=countInventory(w.fg.areas);
    result.orientations[id]={
      mode:w.fg.mode,
      inventory:inv,
      identicalToOriginal:JSON.stringify(w.fg.areas)===JSON.stringify(legacyState.areas),
      countPreserved:JSON.stringify(inv)===JSON.stringify(baseline),
      linkedGroups:w.fg.links?.length||0,
      pendingReviews:w.pendingReviews?.length||0
    };
  }
  return result;
}

/**
 * Preview only. Until FG subject IDs are matched against official V2
 * references, and FG/FO hours/minima verified, no articulation is applied.
 */
export function previewArticulation(pack,{orientationId,area,groupId,foSpaceId,subject,year}) {
  const w=workspace(pack,orientationId);
  if(w.fg.mode!==FG_MODES.REVISAR)
    throw new Error('Primero elegí revisar la Formación General.');
  const source=w.fg.areas?.[area]?.groups?.find(g=>String(g.id)===String(groupId));
  if(!source)throw new Error('No existe el laboratorio original.');
  if(source.kind!=='laboratory'||!['Ciencias Sociales','Ciencias Naturales'].includes(area))
    throw new Error('La articulación FG-FO requiere un laboratorio de Sociales o Naturales.');
  const y=Number(year),term=Number(source.startTerm??source.termStart??source.term);
  const level=Number(source.level)||(Number.isInteger(term)?Math.ceil(term/2):0);
  if(!Number.isInteger(y)||y<3||y>5||level!==y)
    throw new Error('La articulación FG-FO corresponde al mismo nivel, desde 3.º.');
  if(!nonEmpty(subject)||!nonEmpty(String(foSpaceId??'')))
    throw new Error('Falta identificar la materia o el destino.');
  const foSpace=w.fo.spaces.find(x=>String(x.id)===String(foSpaceId));
  if(!foSpace)throw new Error('El espacio de Formación Orientada todavía no fue creado.');
  if(foSpace.year!==y)throw new Error('El laboratorio y el espacio FO deben corresponder al mismo nivel.');
  const plans=Array.isArray(source.plansBimestrales)?source.plansBimestrales:[];
  const withWork=plans.map((p,i)=>({
    number:p.number??i+1,name:p.name||'',
    stagesWithWork:STAGE_IDS.filter(id=>hasStageWork(p?.stages?.[id])),
    contents:(p.contentIds||[]).length,
    hasWork:hasPlanWork(p)
  })).filter(p=>p.hasWork);
  const preview={
    status:'pending-review',
    canApply:false,
    orientationId,area,groupId:String(source.id),
    originGroupId:w.fg.links.find(x=>x.area===area&&x.copiedGroupId===String(source.id))?.originGroupId||null,
    groupName:source.name,year:y,subject:subject.trim(),foSpaceId:String(foSpaceId),
    affectedPlans:withWork,contentsInGroup:(source.items||[]).length,
    notices:[{
      code:'review-laboratory',level:'warning',title:'Revisar laboratorio',
      detail:'La decisión puede afectar el agrupamiento y las secuencias ya construidas.'
    },{
      code:'curricular-mapping',level:'blocking',title:'Homologación curricular pendiente',
      detail:'Hay que verificar la correspondencia de la materia y los contenidos antes de moverla.'
    },{
      code:'normative-validation',level:'blocking',title:'Validación curricular pendiente',
      detail:'Comprobar los mínimos de FG/FO y la carga horaria antes de confirmar.'
    }]
  };
  return preview;
}

/** Only registers an alert in a copied package; never edits FG or sequences. */
export function queueReview(pack,preview) {
  if(!preview||preview.canApply!==false||preview.status!=='pending-review')
    throw new Error('Vista previa de revisión inválida.');
  const w=workspace(pack,preview.orientationId);
  if(w.fg.mode!==FG_MODES.REVISAR)throw new Error('La orientación debe estar en modo revisión.');
  if(!w.fo.spaces.some(s=>String(s.id)===String(preview.foSpaceId)))throw new Error('El destino FO ya no existe.');
  if(!w.fg.areas?.[preview.area]?.groups?.some(g=>String(g.id)===preview.groupId))
    throw new Error('El laboratorio dejó de existir.');
  const updated=copy(pack),alerts=updated.orientations[preview.orientationId].pendingReviews;
  const key=JSON.stringify([preview.area,preview.groupId,preview.subject,preview.foSpaceId]);
  if(!alerts.some(a=>a.key===key))alerts.push({
    key,status:'pendiente',title:'Revisar laboratorio',
    groupName:preview.groupName,area:preview.area,year:preview.year,
    subject:preview.subject,affectedPlans:preview.affectedPlans,
    notices:preview.notices
  });
  return updated;
}
