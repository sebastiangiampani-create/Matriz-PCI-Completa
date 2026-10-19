/**
 * Adaptador de la interfaz Matriz (window.PCIApp) al guardado por áreas.
 * No se conecta automáticamente. Requiere proceso FG/version registrados y
 * habilitación explícita de la puerta de publicación.
 * Preserva la copia local y NUNCA escribe en pciAppV2 ni pci_proposals.data.
 */
import { AreaSyncSession } from './sync-session.mjs';

const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const snapshot = x => JSON.stringify(x);

export class FGAreaBridge {
  constructor({ app, schoolId, orientationId, processId, baseVersion, transport, onStatus = () => {} }) {
    if (!app || typeof app.getState !== 'function' || typeof app.getActiveOrientation !== 'function')
      throw Error('Se requiere una instancia PCIApp operativa.');
    if (typeof onStatus !== 'function') throw Error('Observador de guardado inválido.');
    this.app = app;
    this.orientationId = orientationId;
    this.onStatus = onStatus;
    this.session = new AreaSyncSession({
      scopeBase: { schoolId, orientationId, processId, baseVersion },
      transport,
      onEvent: event => this.onStatus(event)
    });
    this.initialized = false;
    this.disposed = false;
    this.flushing = false;
    this.changedWhileFlushing = false;
    this.seen = new Map();
  }
  currentAreas() {
    if (this.app.getActiveOrientation() !== this.orientationId) return null;
    const areas = this.app.getState()?.areas;
    return plain(areas) ? areas : null;
  }
  async initialize() {
    if (this.disposed) throw Error('El adaptador está cerrado.');
    const areas = this.currentAreas();
    if (!areas) throw Error('Primero elegí una orientación y abrí su copia de trabajo.');
    const results = [];
    for (const [area, document] of Object.entries(areas)) {
      if (!plain(document)) throw Error('Área inválida: ' + area);
      const inspected = await this.session.inspect(area, document);
      this.seen.set(area, snapshot(document));
      results.push({ area, ...inspected });
    }
    this.initialized = true;
    this.onStatus({ type: 'ready', orientation: this.orientationId,
      requiresReview: results.filter(x => x.status === 'review_required').map(x => x.area) });
    return results; // SOLO lectura; no crea ningún registro en Supabase
  }
  async notifyChange() {
    if (this.disposed || !this.initialized) return;
    if (this.flushing) { this.changedWhileFlushing = true; return; }
    this.flushing = true;
    try {
      do {
        this.changedWhileFlushing = false;
        const areas = this.currentAreas();
        if (!areas) return;
        for (const [area, document] of Object.entries(areas)) {
          if (!plain(document)) continue;
          if (!this.seen.has(area)) {
            this.onStatus({ type: 'unknown_area', area, requiresExplicitInspect: true });
            continue;
          }
          const current = snapshot(document);
          if (this.seen.get(area) === current) continue;
          try {
            await this.session.commit(area, document);
            this.seen.set(area, current);
          } catch (error) {
            this.onStatus({ type: 'blocked', area, status: error.status, message: error.message });
            // Mantener el contenido pendiente localmente; otras áreas pueden seguir.
          }
        }
      } while (this.changedWhileFlushing && !this.disposed);
    } finally {
      this.flushing = false;
    }
  }
  reviewedLocal(area) { return this.session.markReviewedLocal(area); }
  receiveRemote(area) {
    // Devuelve la revisión remota. Nunca muta la copia local silenciosamente.
    return this.session.acceptRemote(area);
  }
  dispose() { this.disposed = true; }
}
