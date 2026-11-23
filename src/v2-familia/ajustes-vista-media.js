/**
 * Compatibilidad de la vista Media con pantallas estrechas.
 * Conserva la presentación de V2; no cambia datos, catálogos ni persistencia.
 */
(() => {
  'use strict';

  const style = document.createElement('style');
  style.id = 'v2-media-ajustes-vista';
  style.textContent = `
    @media (max-width:900px) {
      /* Los mínimos originales de 260 + 240 px expandían el viewport móvil. */
      #proposal #v28board .v28-coverage,
      #proposal #v28groups {grid-template-columns:minmax(0,1fr)}
      #proposal .v28-work > *,
      #proposal .v28-group {min-width:0}
    }
    #v38modal {grid-template-columns:minmax(0,1fr)}
    #v38shell {min-width:0;max-width:100%}
    #v38modal .v38-top-actions {flex:1;min-width:0}
    #v38modal .v38-top-actions > div,
    #v38modal .v38-card,
    #v38modal .v38-section,
    #v38modal .v38-field {min-width:0}
    #v38modal .v95-coverage-table {max-width:100%;overflow-x:auto}
    #v38modal .v38-top > [data-close] {flex:0 0 auto}
    @media (max-width:760px) {
      /* El editor abierto debe quedar por encima del dock móvil (9997). */
      #v38modal {z-index:10000}
      #v38modal .v38-grid,
      #v38modal .v38-fields {grid-template-columns:minmax(0,1fr)}
      /* Las tarjetas crecen al apilar los campos: no diferir su contenido. */
      #proposal #v28groups .v28-group {content-visibility:visible;contain-intrinsic-size:none}
    }
  `;
  document.head.appendChild(style);

  let observedShell;
  let shellObserver;
  function observeModal() {
    const shell = document.getElementById('v38shell');
    if (shell === observedShell) return;
    shellObserver?.disconnect();
    observedShell = shell;
    if (!shell) return;
    const resetScroll = () => { shell.scrollTop = 0; shell.scrollLeft = 0; };
    resetScroll();
    // V38 sustituye los hijos directos al pasar de lista a editor o al volver.
    // Las modificaciones dentro del formulario no reinician el desplazamiento.
    shellObserver = new MutationObserver(resetScroll);
    shellObserver.observe(shell, { childList: true });
  }

  observeModal();
  new MutationObserver(observeModal).observe(document.body, { childList: true });
})();
