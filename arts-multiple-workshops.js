(() => {
  const AREA = 'Artes';
  const BASE_WORKSHOPS = 6;
  const EXTRA_PREFIX = 'artes-workshop-extra-';
  let restoring = false;
  let refreshTimer = null;

  function readRawState() {
    try {
      return JSON.parse(localStorage.getItem('pciAppV2') || '{}');
    } catch {
      return {};
    }
  }

  const rawAtLoad = readRawState();
  const capturedExtras = Array.isArray(rawAtLoad?.areas?.[AREA]?.groups)
    ? rawAtLoad.areas[AREA].groups.slice(BASE_WORKSHOPS).map((group) => ({ ...group }))
    : [];

  function state() {
    return window.PCIApp?.getState?.() ?? window.app ?? null;
  }

  function levelForTerm(term) {
    const value = Math.min(10, Math.max(1, Number(term) || 1));
    return Math.ceil(value / 2);
  }

  function isExtra(group) {
    return Boolean(group?.custom) && String(group?.id || '').startsWith(EXTRA_PREFIX);
  }

  function normalizeExtra(group, index) {
    const term = Math.min(10, Math.max(1, Number(group?.startTerm ?? group?.termStart ?? group?.term) || 1));
    return {
      ...group,
      id: String(group?.id || `${EXTRA_PREFIX}${Date.now()}-${index + 1}`),
      kind: 'workshop',
      name: String(group?.name || `Taller ${BASE_WORKSHOPS + index + 1}`),
      objective: String(group?.objective ?? group?.objectives ?? ''),
      synopsis: String(group?.synopsis ?? group?.summary ?? ''),
      context: String(group?.context ?? ''),
      practiceAxis: String(group?.practiceAxis ?? group?.practiceProductAxis ?? ''),
      formatType: '',
      duration: 'quarterly',
      level: levelForTerm(term),
      startTerm: term,
      endTerm: term,
      type: group?.type === 'Electivo' ? 'Electivo' : 'Obligatorio',
      custom: true,
      elective: group?.type === 'Electivo' || Boolean(group?.elective),
      items: Array.isArray(group?.items) ? [...new Set(group.items.map(String))] : [],
      plansBimestrales: Array.isArray(group?.plansBimestrales) ? group.plansBimestrales : group?.plansBimestrales,
    };
  }

  function writeState(current, announce = true) {
    if (!current) return;
    localStorage.setItem('pciAppV2', JSON.stringify(current));
    window.app = current;
    if (announce) {
      window.dispatchEvent(new CustomEvent('pci-state-change', {
        detail: { schemaVersion: current.schemaVersion ?? 10, source: 'arts-multiple-workshops' },
      }));
    }
  }

  function restoreCapturedExtras() {
    if (restoring || !capturedExtras.length) return;
    const current = state();
    const groups = current?.areas?.[AREA]?.groups;
    if (!Array.isArray(groups)) return;

    const existingIds = new Set(groups.map((group) => String(group.id)));
    const missing = capturedExtras
      .map(normalizeExtra)
      .filter((group) => !existingIds.has(String(group.id)));
    if (!missing.length) return;

    restoring = true;
    groups.push(...missing);
    writeState(current, false);
    restoring = false;
  }

  function selectedArtsTerm() {
    const current = state();
    const groups = current?.areas?.[AREA]?.groups ?? [];
    const selectedId = document.querySelector('.group-card.selected[data-group-id]')?.dataset.groupId;
    const selected = groups.find((group) => group.id === selectedId);
    return Number(selected?.startTerm) || Number(groups[0]?.startTerm) || 1;
  }

  function createExtraWorkshop() {
    const current = state();
    const groups = current?.areas?.[AREA]?.groups;
    if (!Array.isArray(groups)) return;

    const term = selectedArtsTerm();
    const index = groups.length;
    const group = normalizeExtra({
      id: `${EXTRA_PREFIX}${Date.now()}-${index + 1}`,
      name: `Taller ${index + 1}`,
      startTerm: term,
      endTerm: term,
      level: levelForTerm(term),
      type: 'Obligatorio',
      custom: true,
      items: [],
    }, Math.max(0, index - BASE_WORKSHOPS));

    groups.push(group);
    writeState(current);
    window.PCIApp?.openArea?.(AREA, group.id);
  }

  function deleteExtraWorkshop(groupId) {
    const current = state();
    const groups = current?.areas?.[AREA]?.groups;
    if (!Array.isArray(groups)) return;
    const index = groups.findIndex((group) => group.id === groupId && isExtra(group));
    if (index < 0) return;
    const group = groups[index];
    if (!confirm(`¿Eliminar “${group.name}”? También se eliminarán sus planes bimestrales y materiales asociados.`)) return;

    groups.splice(index, 1);
    writeState(current);
    window.PCIApp?.openArea?.(AREA, groups[0]?.id ?? null);
  }

  function ensureCreateButton() {
    const current = state();
    const row = document.querySelector('#board .board-heading .button-row');
    if (!row) return;

    let button = document.getElementById('pciAddArtsWorkshop');
    if (!button) {
      button = document.createElement('button');
      button.id = 'pciAddArtsWorkshop';
      button.className = 'button accent';
      button.type = 'button';
      button.textContent = '＋ Crear taller de Artes';
      button.addEventListener('click', createExtraWorkshop);
      row.prepend(button);
    }
    button.hidden = current?.current !== AREA;
  }

  function ensureHint() {
    const current = state();
    const description = document.getElementById('boardDescription');
    if (!description) return;
    let hint = document.getElementById('pciArtsMultipleHint');
    if (!hint) {
      hint = document.createElement('p');
      hint.id = 'pciArtsMultipleHint';
      hint.className = 'muted';
      hint.style.margin = '.35rem 0 0';
      hint.style.fontWeight = '750';
      description.insertAdjacentElement('afterend', hint);
    }
    hint.hidden = current?.current !== AREA;
    hint.textContent = 'Podés crear varios talleres de Artes en el mismo cuatrimestre. Cada taller mantiene sus propios contenidos y sus 2 planes bimestrales.';
  }

  function ensureDeleteButtons() {
    const current = state();
    if (current?.current !== AREA) return;
    const groups = current?.areas?.[AREA]?.groups ?? [];
    const byId = new Map(groups.map((group) => [String(group.id), group]));

    document.querySelectorAll('.group-card[data-group-id]').forEach((card) => {
      const group = byId.get(String(card.dataset.groupId));
      if (!isExtra(group) || card.querySelector('[data-delete-art-workshop]')) return;
      let footer = card.querySelector('.group-footer');
      if (!footer) {
        footer = document.createElement('div');
        footer.className = 'group-footer';
        card.appendChild(footer);
      }
      const button = document.createElement('button');
      button.className = 'button danger';
      button.type = 'button';
      button.dataset.deleteArtWorkshop = '1';
      button.textContent = 'Eliminar taller adicional';
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        deleteExtraWorkshop(group.id);
      });
      footer.appendChild(button);
    });
  }

  function refreshUi() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      restoreCapturedExtras();
      ensureCreateButton();
      ensureHint();
      ensureDeleteButtons();
    }, 20);
  }

  window.addEventListener('pci-state-change', () => {
    restoreCapturedExtras();
    refreshUi();
  });
  window.addEventListener('DOMContentLoaded', refreshUi);

  const observer = new MutationObserver(refreshUi);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  refreshUi();
})();
