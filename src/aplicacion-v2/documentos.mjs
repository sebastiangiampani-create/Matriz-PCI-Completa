/** Documentos completos del motor: copia local por escuela y PCI, sin red. */
import {ORIENTATIONS} from '../integracion-curricular/bridge.js';
import {findSpecialty} from '../tecnica/pautas-pci-20261005.mjs';

const BORRADOR_VERSION='pci-aplicacion-v2-borrador/1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TURNOS=new Set(['manana','tarde','vespertino','noche']);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=value=>typeof value==='string'&&value.trim().length>0;
const copy=value=>JSON.parse(JSON.stringify(value));
function fail(code,message){throw Object.assign(new Error(message),{code});}

/** Identidad completa del PCI obtenido del backend; no depende del perfil V2. */
export function identidadPci(contexto){
  const schoolId=Number(contexto?.school?.id),p=contexto?.pci;
  if(!Number.isSafeInteger(schoolId)||schoolId<1001||!object(p)||
    Number(p.school_id)!==schoolId||!UUID.test(p.pci_id)||
    !text(p.orientation_id)||!text(p.process_id)||!text(p.legacy_sha256)||
    !TURNOS.has(p.shift_id)||!['comun','tecnica','ba15'].includes(p.model))
    fail('IDENTIDAD_PCI_INVALIDA','La escuela, el PCI o su procedencia son inválidos.');
  return {schoolId,pciId:p.pci_id,orientationId:p.orientation_id,
    shiftId:p.shift_id,model:p.model,processId:p.process_id,legacySha256:p.legacy_sha256};
}

/** Contrato existente del frontend; no implica que el backend lo admita. */
export function contratoV2(model){
  if(!['comun','tecnica','ba15'].includes(model))
    fail('MODELO_V2_INVALIDO','Modalidad curricular no reconocida.');
  return {component:'oferta',unitKind:'map',
    unitId:model==='comun'?'mapa-original-v2-v1':`mapa-v2-familia-${model}-v1`,
    baseVersion:model==='comun'?'v2-original-embedded-v1':`v2-familia-${model}-20261120/1`};
}

function validarEstado(estado,contexto){
  const p=contexto.pci;
  const orientation=p.model==='tecnica'?findSpecialty(p.specialty_name||p.specialty_id)?.name:
    ORIENTATIONS.find(item=>item.id===p.orientation_id)?.name;
  if(!text(orientation)||!object(estado)||!object(estado.maps)||
    estado.active!==orientation||!Object.hasOwn(estado.maps,orientation)||
    !object(estado.maps[orientation])||
    (estado.selected!==undefined&&(!Array.isArray(estado.selected)||
      estado.selected.length!==1||estado.selected[0]!==orientation)))
    fail('ESTADO_V2_AJENO','El estado V2 no corresponde a la orientación o especialidad de este PCI.');
  // Se conservan TODAS las raíces, incluida institutional y los datos de gestión.
  // No se reconstruye el documento únicamente desde maps[active].
  try{return copy(estado);}
  catch{fail('ESTADO_V2_INVALIDO','El estado V2 no se puede convertir a un documento local.');}
}

/** Devuelve una copia validada del sobre completo, sin modificar la entrada. */
export function validarDocumentoV2(documento,contexto){
  const identity=identidadPci(contexto),contract=contratoV2(identity.model);
  if(!object(documento)||documento.schema!==contract.baseVersion)
    fail('DOCUMENTO_V2_INCOMPATIBLE','La versión del documento no corresponde a este motor V2.');
  if(Number(documento.schoolId)!==identity.schoolId||documento.pciId!==identity.pciId||
    documento.orientationId!==identity.orientationId||documento.shiftId!==identity.shiftId||
    (documento.model!==undefined&&documento.model!==identity.model)||
    (documento.processId!==undefined&&documento.processId!==identity.processId)||
    (documento.legacySha256!==undefined&&documento.legacySha256!==identity.legacySha256))
    fail('DOCUMENTO_V2_AJENO','El documento pertenece a otra escuela, PCI, orientación, turno o procedencia.');
  const v2=validarEstado(documento.v2,contexto);
  // Los sobres anteriores no incluían model, processId ni legacySha256.
  // Si los incluyen se contrastan; los borradores nuevos siempre los conservan.
  return {...copy(documento),model:identity.model,v2};
}

/** Sobre V2 completo; conserva gestión institucional, mapas y planes. */
export function crearDocumentoV2(estado,contexto){
  const identity=identidadPci(contexto);
  return {schema:contratoV2(identity.model).baseVersion,...identity,
    v2:validarEstado(estado,contexto)};
}

export function claveBorrador(contexto){
  const identity=identidadPci(contexto);
  return BORRADOR_VERSION+'::'+[identity.schoolId,identity.pciId,identity.model,
    identity.orientationId,identity.shiftId,identity.processId,identity.legacySha256]
    .map(value=>encodeURIComponent(String(value))).join('::');
}

function revisionValida(revision){
  if(!Number.isSafeInteger(revision)||revision<0)
    fail('REVISION_INVALIDA','La revisión de referencia del borrador es inválida.');
}

/** null si no existe; si existe devuelve {...sobreV2,borradorVersion,revisionRemota,fecha}. */
export function leerBorrador(contexto,storage=globalThis.localStorage){
  const key=claveBorrador(contexto);
  if(typeof storage?.getItem!=='function')
    fail('ALMACENAMIENTO_NO_DISPONIBLE','El navegador no permite leer el borrador local.');
  const raw=storage.getItem(key);
  if(raw===null)return null;
  let record;
  try{record=JSON.parse(raw);}
  catch{fail('BORRADOR_INVALIDO','El borrador local no se pudo leer. Se conserva para su revisión.');}
  if(!object(record)||record.borradorVersion!==BORRADOR_VERSION||
    !text(record.fecha)||!Number.isFinite(Date.parse(record.fecha)))
    fail('BORRADOR_INVALIDO','El borrador local tiene una versión o fecha incompatible.');
  revisionValida(record.revisionRemota);
  const identity=identidadPci(contexto);
  if(record.processId!==identity.processId||record.legacySha256!==identity.legacySha256||
    record.model!==identity.model)
    fail('DOCUMENTO_V2_AJENO','El borrador local tiene otra procedencia o modalidad.');
  return validarDocumentoV2(record,contexto);
}

/**
 * Escribe sólo en el navegador y devuelve el registro completo que escribió.
 * sincronizado=true: el mismo estado ya fue confirmado por el servidor en
 * revisionRemota. sincronizado=false: hay cambios locales aún no confirmados.
 */
export function guardarBorrador(contexto,estado,
  {storage=globalThis.localStorage,revisionRemota=0,sincronizado=false}={}){
  revisionValida(revisionRemota);
  const record={...crearDocumentoV2(estado,contexto),borradorVersion:BORRADOR_VERSION,
    revisionRemota,sincronizado:sincronizado===true,fecha:new Date().toISOString()};
  const key=claveBorrador(contexto),serialized=JSON.stringify(record);
  if(typeof storage?.setItem!=='function')
    fail('ALMACENAMIENTO_NO_DISPONIBLE','El navegador no permite conservar el borrador local.');
  storage.setItem(key,serialized);
  return copy(record);
}

const RESGUARDO_PREFIJO='pci-aplicacion-v2-resguardo/1::';

/** true si el borrador no aporta nada que el servidor no tenga. */
export function borradorSincronizadoCon(borrador,unidad){
  if(!borrador)return true;
  if(borrador.sincronizado===true&&unidad?.exists&&
    Number(borrador.revisionRemota)<=Number(unidad.revision))return true;
  // Borradores anteriores a este cambio no tienen la marca: se comparan por contenido.
  try{return !!unidad?.document?.v2&&JSON.stringify(borrador.v2)===JSON.stringify(unidad.document.v2);}
  catch{return false;}
}

/**
 * Mueve el borrador vigente a una clave de resguardo con fecha, sin borrarlo
 * nunca. Devuelve la clave de resguardo. El borrador original queda intacto
 * en el resguardo y puede descargarse o restaurarse.
 */
export function resguardarBorrador(contexto,storage=globalThis.localStorage){
  const key=claveBorrador(contexto),raw=storage.getItem(key);
  if(raw===null)return null;
  const destino=RESGUARDO_PREFIJO+key+'::'+new Date().toISOString();
  storage.setItem(destino,raw);
  if(storage.getItem(destino)!==raw)
    fail('RESGUARDO_FALLIDO','No se pudo resguardar el borrador local. No se modificó nada.');
  storage.removeItem(key);
  return destino;
}

/** Resguardos locales de este PCI, del más reciente al más antiguo. */
export function listarResguardos(contexto,storage=globalThis.localStorage){
  const prefix=RESGUARDO_PREFIJO+claveBorrador(contexto)+'::',out=[];
  for(let i=0;i<storage.length;i++){
    const key=storage.key(i);
    if(key?.startsWith(prefix))out.push({clave:key,fecha:key.slice(prefix.length)});
  }
  return out.sort((a,b)=>b.fecha.localeCompare(a.fecha));
}
