/**
 * Observación posterior a un fallo de Locator.click en Playwright 1.55.
 * No cambia opciones, permisos, desplazamiento, reintentos ni aserciones.
 * La excepción original siempre se vuelve a lanzar.
 */
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const coreRoot = dirname(require.resolve('playwright-core'));
const { Locator } = require(join(coreRoot, 'lib/client/locator.js'));
const output = resolve(process.env.PCI_PREVIEW_ARTIFACTS || 'test-artifacts/publicacion-revision-v2');
const originalClick = Locator.prototype.click;
if (typeof originalClick !== 'function') throw Error('No se encontró Locator.click para observar el fallo.');

Locator.prototype.click = async function (...args) {
  try {
    return await originalClick.apply(this, args);
  } catch (error) {
    const diagnostic = {
      fecha: new Date().toISOString(),
      selector: this._selector || this.toString(), errorOriginal: error?.stack || String(error),
    };
    try {
      await mkdir(output, { recursive: true });
      diagnostic.viewportPagina = this.page().viewportSize();
      try { diagnostic.rectRespectoPagina = await this.boundingBox({ timeout: 5000 }); }
      catch (observationError) { diagnostic.errorBoundingBox = observationError.message; }
      try {
        diagnostic.geometria = await this.evaluate(target => {
          const rect = element => {
            if (!element) return null;
            const r = element.getBoundingClientRect();
            return { x: r.x, y: r.y, top: r.top, right: r.right, bottom: r.bottom,
              left: r.left, width: r.width, height: r.height };
          };
          const describe = element => {
            if (!element) return null;
            const style = element.ownerDocument.defaultView.getComputedStyle(element);
            return { tag: element.tagName, id: element.id || '',
              className: typeof element.className === 'string' ? element.className : '',
              rect: rect(element), clientWidth: element.clientWidth, clientHeight: element.clientHeight,
              scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight,
              scrollLeft: element.scrollLeft, scrollTop: element.scrollTop,
              estilo: { display: style.display, visibility: style.visibility, position: style.position,
                overflowX: style.overflowX, overflowY: style.overflowY, scrollBehavior: style.scrollBehavior,
                transform: style.transform } };
          };
          const ancestors = element => {
            const result = [];
            for (let current = element; current; current = current.parentElement) result.push(describe(current));
            return result;
          };
          const viewport = win => {
            const visual = win.visualViewport;
            return { innerWidth: win.innerWidth, innerHeight: win.innerHeight,
              scrollX: win.scrollX, scrollY: win.scrollY, devicePixelRatio: win.devicePixelRatio,
              visualViewport: visual ? { width: visual.width, height: visual.height,
                offsetLeft: visual.offsetLeft, offsetTop: visual.offsetTop,
                pageLeft: visual.pageLeft, pageTop: visual.pageTop, scale: visual.scale } : null };
          };
          const owner = target.ownerDocument.defaultView;
          const result = { objetivo: describe(target), ancestrosObjetivo: ancestors(target), frames: [] };
          let current = owner;
          while (current) {
            try {
              const doc = current.document;
              const frameElement = current.frameElement;
              result.frames.push({ url: current.location.href,
                esSuperior: current === current.parent, viewport: viewport(current),
                scrollingElement: describe(doc.scrollingElement),
                frameElement: describe(frameElement),
                ancestrosFrameEnPadre: frameElement ? ancestors(frameElement) : [] });
              if (current === current.parent) break;
              current = current.parent;
            } catch (frameError) {
              result.frames.push({ errorLecturaFrame: frameError.message });
              break;
            }
          }
          return result;
        }, undefined, { timeout: 5000 });
      } catch (observationError) { diagnostic.errorGeometria = observationError.stack || observationError.message; }
      try {
        const screenshot = 'diagnostico-click-viewport.png';
        await this.page().screenshot({ path: join(output, screenshot), fullPage: false, timeout: 5000 });
        diagnostic.capturaViewport = screenshot;
      } catch (observationError) { diagnostic.errorCaptura = observationError.message; }
      await writeFile(join(output, 'diagnostico-click.json'), JSON.stringify(diagnostic, null, 2) + '\n');
      console.error(`Observación del clic fallido: ${join(output, 'diagnostico-click.json')}`);
    } catch (observationError) {
      console.error('No se pudo conservar la observación del clic:', observationError.stack || observationError);
    }
    throw error;
  }
};
