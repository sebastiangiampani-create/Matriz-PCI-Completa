/**
 * Contrato de concurrencia de Matriz PCI Completa.
 * SIN acceso a Supabase, Oracle, HTTP ni almacenamiento del navegador.
 * La autorización recibe EXCLUSIVAMENTE identidades verificadas por el servidor.
 * La persistencia nueva no escribe nunca en public.pci_proposals.
 */
export const VERSIONS = Object.freeze({
  FG_HISTORICA: 'fg-matriz-historica/1',
  FG_VIGENTE: 'fg-sec-aprende-v2/1',
  FO_VIGENTE: 'fo-sec-aprende-v2/1',
  ARTICULACION: 'pci-articulacion-fg-fo/1'
});

const allowedKinds = Object.freeze({
  fg: new Set(['area', 'group', 'plan']),
  fo: new Set(['space', 'group', 'plan']),
  articulacion: new Set(['link']),
  oferta: new Set(['map'])
});
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const copy = x => JSON.parse(JSON.stringify(x));

export class ScopeError extends Error {
  constructor(message, status = 400, code = 'invalid_scope') {
    super(message);
    this.name = 'ScopeError';
    this.status = status;
    this.code = code;
  }
}
export class ConflictError extends ScopeError {
  constructor(reason, currentRevision = null) {
    super('Conflicto: el espacio cambió desde que se abrió (' + reason + ').', 409, 'stale_revision');
    this.name = 'ConflictError';
    this.currentRevision = currentRevision;
  }
}

function exactString(value, name, max = 160) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value))
    throw new ScopeError(name + ' debe ser una cadena válida (' + max + ' caracteres máximo).');
  return value.trim();
}

export function validateScope(scope) {
  if (!record(scope)) throw new ScopeError('Se necesita un alcance curricular explícito.');
  const schoolId = Number(scope.schoolId);
  if (!Number.isSafeInteger(schoolId) || schoolId <= 0)
    throw new ScopeError('Escuela inválida.');
  const component = exactString(scope.component, 'Componente');
  const kind = exactString(scope.kind, 'Tipo de unidad');
  if (!allowedKinds[component]?.has(kind)) throw new ScopeError('Unidad incompatible con el componente.');
  const orientationId = exactString(scope.orientationId, 'Orientación');
  const processId = exactString(scope.processId, 'Proceso');
  const baseVersion = exactString(scope.baseVersion, 'Versión curricular');
  const scopeId = exactString(scope.scopeId, 'Identificador del espacio', 240);
  if (component === 'fg' && ![VERSIONS.FG_HISTORICA, VERSIONS.FG_VIGENTE].includes(baseVersion))
    throw new ScopeError('La FG requiere su versión histórica o vigente explícita.');
  if (component === 'fo' && baseVersion !== VERSIONS.FO_VIGENTE)
    throw new ScopeError('La FO requiere su base oficial.');
  if (component === 'articulacion' && baseVersion !== VERSIONS.ARTICULACION)
    throw new ScopeError('La articulación requiere su versión propia.');
  if (component === 'fo' && orientationId === '_general')
    throw new ScopeError('La FO requiere una orientación concreta.');
  if (component === 'oferta' && !baseVersion.startsWith('oferta-'))
    throw new ScopeError('El Mapa de la Oferta requiere una versión identificada.');
  return Object.freeze({ schoolId, component, orientationId, processId, kind, scopeId, baseVersion });
}

export function scopedIdentity(scope) {
  const s = validateScope(scope);
  return JSON.stringify([s.schoolId, s.component, s.orientationId, s.processId, s.kind, s.scopeId]);
}

export function validatePayload(payload) {
  if (!record(payload)) throw new ScopeError('El contenido debe ser un objeto JSON, no un estado escolar completo.');
  if (Object.prototype.hasOwnProperty.call(payload, '__proto__') ||
      Object.prototype.hasOwnProperty.call(payload, 'constructor'))
    throw new ScopeError('Claves inseguras en el documento.');
  return copy(payload);
}

export function requireActor(actor, scope, capability) {
  // El adaptador de autenticación debe construir actor EN EL SERVIDOR.
  if (!record(actor) || actor.verified !== true || typeof actor.id !== 'string' ||
      !actor.id.trim()) throw new ScopeError('Sesión no verificada.', 401, 'unauthenticated');
  const grant = Array.isArray(actor.grants) ? actor.grants.find(item =>
    item && Number(item.schoolId) === scope.schoolId &&
    Array.isArray(item.permissions) && item.permissions.includes(capability) &&
    (!item.orientations || item.orientations.includes(scope.orientationId)) &&
    (!item.components || item.components.includes(scope.component)) &&
    (!item.scopeIds || item.scopeIds.includes(scope.scopeId))
  ) : null;
  if (!grant) throw new ScopeError('Sin permiso para este espacio de la escuela.', 403, 'forbidden');
  return actor.id.trim();
}

export function requireRevision(value) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new ScopeError('Se requiere revisión base entera (0 solo para creación).');
  return value;
}

export function newScopedRecord(scope, payload, revision, actorId) {
  return {
    scope: validateScope(scope),
    revision,
    document: validatePayload(payload),
    updatedBy: actorId
  };
}

/**
 * Adaptador memoria para tests sintéticos: NO es almacenamiento productivo.
 * Representa las mismas restricciones de revisión que exige PostgreSQL.
 */
export class MemoryScopedStore {
  constructor() {
    this.values = new Map();
    this.history = [];
  }
  async read(actor, scope) {
    const s = validateScope(scope);
    requireActor(actor, s, 'pci.view');
    return copy(this.values.get(scopedIdentity(s)) || null);
  }
  async save(actor, scope, payload, expectedRevision) {
    const s = validateScope(scope);
    const who = requireActor(actor, s, 'pci.edit');
    const wanted = requireRevision(expectedRevision);
    const safe = validatePayload(payload);
    const key = scopedIdentity(s);
    const before = this.values.get(key);
    if (!before && wanted !== 0) throw new ConflictError('la unidad no existe', null);
    if (before && before.scope.baseVersion !== s.baseVersion)
      throw new ConflictError('versión curricular distinta', before.revision);
    if (before && before.revision !== wanted)
      throw new ConflictError('revisión desactualizada', before.revision);
    const next = newScopedRecord(s, safe, wanted + 1, who);
    this.values.set(key, next);
    this.history.push(copy(next));
    return copy(next);
  }
}

/** Prepara SOLO copias en memoria; jamás reinterpreta la FG histórica. */
export function stageHistoricalAreas(original, { schoolId, orientationId, processId, baseVersion }) {
  if (!record(original) || !record(original.areas) || original.profile === 'tecnica')
    throw new ScopeError('Este modelo exige una preparación de FG común verificada.');
  if (baseVersion !== VERSIONS.FG_HISTORICA)
    throw new ScopeError('Una FG histórica no se actualiza automáticamente a la vigente.');
  return Object.entries(original.areas).map(([scopeId, document]) => ({
    scope: validateScope({
      schoolId, component: 'fg', orientationId, processId,
      baseVersion, kind: 'area', scopeId
    }),
    document: validatePayload(document),
    expectedRevision: 0
  }));
}

/** Vuelve a armar una vista heredada SIN tocar el snapshot ni cambiar coberturas. */
export function overlayHistoricalAreas(original, records, options) {
  if (!record(original) || !record(original.areas)) throw new ScopeError('Snapshot escolar inválido.');
  const result = copy(original);
  for (const row of records) {
    const s = validateScope(row.scope);
    if (s.component !== 'fg' || s.kind !== 'area' ||
        s.schoolId !== options.schoolId || s.orientationId !== options.orientationId ||
        s.processId !== options.processId || s.baseVersion !== options.baseVersion)
      throw new ScopeError('No se puede insertar información de otro proceso o escuela.');
    if (!Object.prototype.hasOwnProperty.call(result.areas, s.scopeId))
      throw new ScopeError('El área no existía en el snapshot histórico.');
    result.areas[s.scopeId] = validatePayload(row.document);
  }
  return result;
}
