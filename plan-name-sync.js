const planNameState = { groupId: null, planNumber: null };

function pciState() {
  return window.PCIApp?.getState?.() ?? null;
}

function findPlanGroup(groupId) {
  const current = pciState();
  if (!current || !groupId) return null;
  for (const [area, areaState] of Object.entries(current.areas ?? {})) {
    const group = (areaState.groups ?? []).find((item) => item.id === groupId);
    if (group) return { area, group };
  }
  return null;
}

function defaultPlanName(group, number) {
  const base = String(group?.name || 'Espacio').trim();
  return `Plan ${number} · ${base}`;
}

function looksLikeOldAutomaticName(group, plan, number) {
  const name = String(plan?.name || '').trim();
  if (!name) return true;
  const groupName = String(group?.name || '').trim();
  return name === `${groupName} ${number}`
    || name === `Bimestre ${number}`
    || name === `Plan ${number}`
    || name === defaultPlanName(group, number);
}

function normalizePlanNames() {
  const current = pciState();
  if (!current) return false;
  let changed = false;

  for (const areaState of Object.values(current.areas ?? {})) {
    for (const group of areaState.groups ?? []) {
      if (!Array.isArray(group.plansBimestrales)) continue;
      group.plansBimestrales.forEach((plan, index) => {
        if (!plan || typeof plan !== 'object') return;
        const number = Number(plan.number) || index + 1;
        const automatic = defaultPlanName(group, number);

        if (typeof plan.nameCustomized !== 'boolean') {
          plan.nameCustomized = looksLikeOldAutomaticName(group, plan, number) && !plan.updatedAt;
          plan.nameCustomized = !plan.nameCustomized;
          if (!plan.nameCustomized) {
            plan.name = automatic;
            plan.autoName = automatic;
            changed = true;
          }
          return;
        }

        if (!plan.nameCustomized && plan.name !== automatic) {
          plan.name = automatic;
          plan.autoName = automatic;
          changed = true;
        }
      });
    }
  }

  if (changed) localStorage.setItem('pciAppV2', JSON.stringify(current));
  return changed;
}

function currentPlan() {
  const found = findPlanGroup(planNameState.groupId);
  if (!found || !planNameState.planNumber) return null;
  const plan = found.group.plansBimestrales?.[planNameState.planNumber - 1];
  return plan ? { ...found, plan } : null;
}

function syncEditorName() {
  const context = currentPlan();
  const input = document.querySelector('#pciPlanForm [data-plan-field="name"]');
  if (!context || !input) return;
  if (!context.plan.nameCustomized) {
    const automatic = defaultPlanName(context.group, planNameState.planNumber);
    if (input.value !== automatic) input.value = automatic;
    context.plan.name = automatic;
    context.plan.autoName = automatic;
    localStorage.setItem('pciAppV2', JSON.stringify(pciState()));
  }
  const help = input.closest('.pci-plan-field')?.querySelector('small');
  if (help) help.textContent = 'Se completa automáticamente con el nombre del agrupamiento, pero podés editarlo para darle un título propio a este bimestre.';
}

function markCustomized(input) {
  const context = currentPlan();
  if (!context) return;
  context.plan.name = input.value;
  context.plan.nameCustomized = true;
  context.plan.autoName = defaultPlanName(context.group, planNameState.planNumber);
  context.plan.updatedAt = new Date().toISOString();
  localStorage.setItem('pciAppV2', JSON.stringify(pciState()));
}

document.addEventListener('click', (event) => {
  const groupButton = event.target.closest('[data-pci-plan-entry] button');
  if (groupButton) {
    planNameState.groupId = groupButton.closest('.group-card[data-group-id]')?.dataset.groupId || planNameState.groupId;
    planNameState.planNumber = null;
  }

  const matrixButton = event.target.closest('[data-open-bimestral-plans]');
  if (matrixButton) {
    planNameState.groupId = document.getElementById('matrixDetailsPanel')?.dataset.groupId || planNameState.groupId;
    planNameState.planNumber = null;
  }

  const openPlan = event.target.closest('[data-open-plan]');
  if (openPlan) {
    planNameState.planNumber = Number(openPlan.dataset.openPlan) || null;
    setTimeout(syncEditorName, 0);
  }
}, true);

document.addEventListener('input', (event) => {
  const input = event.target.closest?.('#pciPlanForm [data-plan-field="name"]');
  if (input) markCustomized(input);
}, true);

const planNameObserver = new MutationObserver(() => {
  normalizePlanNames();
  syncEditorName();
});
planNameObserver.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', () => {
  normalizePlanNames();
  syncEditorName();
});
window.addEventListener('pci-state-change', () => {
  normalizePlanNames();
  syncEditorName();
});
setTimeout(() => {
  normalizePlanNames();
  syncEditorName();
}, 0);
