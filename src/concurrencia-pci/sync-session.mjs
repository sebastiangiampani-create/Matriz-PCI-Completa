/**
 * Cliente de colaboración: solo transmite UNIDAD curricular, nunca la matriz entera.
 * La interfaz mantiene su borrador local incluso ante desconexiones/conflictos.
 * No hay conexión automática: el controlador de la UI debe habilitarla explícitamente.
 */
import { validateScope } from './scoped-store.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const validDoc = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export class SyncError extends Error {
  constructor(message, status, details = {}) {
    super(message);
    this.name = 'SyncError';
    this.status = status;
    this.details = details;
  }
}
export class ReviewRequiredError extends SyncError {
  constructor(area) {
    super('La versión local de ' + area + ' difiere de la versión guardada. Revisá ambas antes de publicar.', 409, { area });
  }
}
export function createSupabaseUnitTransport({
  endpoint,
  token,
  schoolId,
  fetchImpl = globalThis.fetch
}) {
  if (!/^https:\/\//.test(endpoint) || typeof token !== 'string' || !token.trim() ||
      !Number.isSafeInteger(schoolId) || schoolId < 1001 || typeof fetchImpl !== 'function')
    throw Error('Configuración de conexión PCI inválida.');
  async function request(action, scope, extra = {}) {
    const s = validateScope(scope);
    if (s.schoolId !== schoolId) throw new SyncError('Otra escuela no permitida.', 403);
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action, token, school_id: s.schoolId, orientation_id: s.orientationId,
        process_id: s.processId, component: s.component, unit_kind: s.kind,
        unit_id: s.scopeId, base_version: s.baseVersion, ...extra
      })
    });
    let result = {};
    try { result = await response.json(); } catch { /* API sin JSON */ }
    if (!response.ok) throw new SyncError(
      result.error || (response.status === 409 ? 'Cambios simultáneos detectados.' : 'Error de red PCI'),
      response.status, result
    );
    return result;
  }
  return Object.freeze({
    getUnit: scope => request('get-unit', scope),
    saveUnit: (scope, document, expectedRevision) => {
      if (!validDoc(document) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
        throw new SyncError('Unidad o revisión inválidas.', 400);
      return request('save-unit', scope, {
        document: copy(document), expected_revision: expectedRevision
      });
    }
  });
}

/**
 * Modo seguro:
 *  - inspect() NUNCA sube ni reemplaza datos.
 *  - En divergencia inicial, commit() queda bloqueado hasta acceptRemote()
 *    o markReviewedLocal() llamados explícitamente después de una comparación.
 *  - Un 409 bloquea el área, preserva borrador y exige recargar la revisión.
 *  - Otras áreas continúan disponibles.
 */
export class AreaSyncSession {
  constructor({ scopeBase, transport, onEvent = () => {} }) {
    if (!transport || typeof transport.getUnit !== 'function' ||
        typeof transport.saveUnit !== 'function') throw Error('Transporte PCI inválido.');
    if (typeof onEvent !== 'function') throw Error('Observador PCI inválido.');
    this.base = { ...scopeBase, component: 'fg', kind: 'area' };
    validateScope({ ...this.base, scopeId: 'Ciencias Sociales' });
    this.transport = transport;
    this.onEvent = onEvent;
    this.areas = new Map();
    this.pending = new Map();
  }
  scope(area) { return validateScope({ ...this.base, scopeId: area }); }
  async inspect(area, localDocument) {
    const scope = this.scope(area);
    if (!validDoc(localDocument)) throw new SyncError('Borrador de área inválido.', 400);
    const current = await this.transport.getUnit(scope);
    const exists = current.exists === true;
    const remote = exists ? copy(current.document) : null;
    const revision = exists ? Number(current.revision) : 0;
    if (!Number.isSafeInteger(revision) || revision < 0 || (exists && revision < 1))
      throw new SyncError('Revisión remota inválida.', 502);
    const state = {
      revision,
      remote,
      status: exists && !equal(localDocument, remote) ? 'review_required' : 'ready'
    };
    this.areas.set(area, state);
    this.onEvent({ type: 'inspected', area, status: state.status, revision });
    return { status: state.status, revision, exists, remote: copy(remote) };
  }
  acceptRemote(area) {
    const state = this.areas.get(area);
    if (!state || state.remote === null) throw new SyncError('No hay documento remoto para incorporar.', 400);
    state.status = 'ready';
    this.onEvent({ type: 'remote_accepted', area, revision: state.revision });
    return copy(state.remote); // la UI decide cuándo sustituir su borrador local
  }
  markReviewedLocal(area) {
    const state = this.areas.get(area);
    if (!state || state.status !== 'review_required')
      throw new SyncError('No existe divergencia pendiente de resolver.', 400);
    state.status = 'ready';
    this.onEvent({ type: 'local_reviewed', area, revision: state.revision });
  }
  async commit(area, localDocument) {
    const state = this.areas.get(area);
    if (!state) throw new SyncError('Primero hay que consultar la versión remota.', 412);
    if (!validDoc(localDocument)) throw new SyncError('Borrador de área inválido.', 400);
    if (state.status === 'review_required' || state.status === 'conflict')
      throw new ReviewRequiredError(area);
    const previous = this.pending.get(area) || Promise.resolve();
    const result = previous.catch(() => {}).then(async () => {
      if (state.status !== 'ready') throw new ReviewRequiredError(area);
      if (state.remote !== null && equal(state.remote, localDocument))
        return { ok: true, unchanged: true, revision: state.revision };
      try {
        const saved = await this.transport.saveUnit(this.scope(area), localDocument, state.revision);
        if (!saved?.ok || !Number.isSafeInteger(saved.revision) || saved.revision !== state.revision + 1)
          throw new SyncError('El servidor no confirmó una revisión consistente.', 502);
        state.revision = saved.revision;
        state.remote = copy(localDocument);
        this.onEvent({ type: 'saved', area, revision: saved.revision });
        return { ...saved, unchanged: false };
      } catch (err) {
        if (err?.status === 409) {
          state.status = 'conflict';
          this.onEvent({ type: 'conflict', area, revision: state.revision, remoteRevision: err.details?.current_revision });
        } else this.onEvent({ type: 'save_error', area, error: err?.message });
        throw err;
      }
    });
    this.pending.set(area, result);
    void result.finally(() => {
      if (this.pending.get(area) === result) this.pending.delete(area);
    }).catch(() => {});
    return result;
  }
  getStatus(area) {
    const state = this.areas.get(area);
    return state ? Object.freeze({ status: state.status, revision: state.revision }) : null;
  }
}
