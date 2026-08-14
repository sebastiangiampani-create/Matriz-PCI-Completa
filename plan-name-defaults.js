const PLAN_NAME_SEPARATOR = ' · ';

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

function automaticPlanName(group, number) {
  return `Plan ${number}${PLAN_NAME_SEPARATOR}${group.name}`;
}

function isLegacyAutomaticName(name, group, number, previousSource = '') {
  const value = String(name ?? '').trim();
  if (!value) return true;
  if (value === `${group.name} ${number}`) return true;
  if (value === `Bimestre ${number}`) return true;
  if (previousSource && value === `Plan ${number}${PLAN_NAME_SEPARATOR}${previousSource}`) return true;
  return false;
}

function savePlanNameState() {
  const current = pciState();
  if (!current) return;
  localStorage.setItem('pciAppV2', JSON.stringify(current));
  window.app = current;
  window.dispatchEvent(new CustomEvent('pci-state-change', { detail: { source: 'plan-name-defaults' } }));
}

function normalizePlanNames(groupId) {
  const found = findPlanGroup(groupId);
  if (!found || !Array.isArray(found.group.plansBimestrales)) return false;
  let changed = false;
  found.group.plansBimestrales.forEach((plan, index) => {
    const number = Number(plan.number) || index + 1;
    const previousSource = String(plan.autoNameSource ?? '').trim();
    const mayUpdate = plan.autoName !== false && isLegacyAutomaticName(plan.name, found.group, number, previousSource);
    if (!mayUpdate) return;
    const desired = automaticPlanName(found.group, number);
    if (plan.name !== desired || plan.autoName !== true || plan.autoNameSource !== found.group.name) {
      plan.name = desired;
      plan.autoName = true;
      plan.autoNameSource = found.group.name;
      changed = true;
    }
  });
  if (changed) savePlanNameState();
  return changed;
}

function refreshVisiblePlanNames(groupId) {
  const found = findPlanGroup(groupId);
  if (!found || !Array.isArray(found.group.plansBimestrales)) return;
  const shell = document.getElementById('pciPlansShell');
  if (!shell || shell.closest('[hidden]')) return;

  shell.querySelectorAll('[data-open-plan]').forEach((button) => {
    const number = Number(button.dataset.openPlan);
    const plan = found.group.plansBimestrales[number - 1];
    const card = button.closest('.pci-plan-card');
    const title = card?.querySelector('p');
    if (title && plan) title.textContent = plan.name || automaticPlanName(found.group, number);
  });

  const nameInput = shell.querySelector('[data-plan-field="name"]');
  if (nameInput) {
    const heading = shell.querySelector('#pciPlansTitle')?.textContent ?? '';
    const match = heading.match(/Plan bimestral\s+(\d+)/i);
    const number = match ? Number(match[1]) : null;
    const plan = number ? found.group.plansBimestrales[number - 1] : null;
    if (plan && nameInput.value !== plan.name && document.activeElement !== nameInput) nameInput.value = plan.name;
  }
}

let activePlanGroupId = null;

function resolveGroupIdFromClick(target) {
  const matrixButton = target.closest?.('[data-open-bimestral-plans]');
  if (matrixButton) return document.getElementById('matrixDetailsPanel')?.dataset.groupId || null;
  const groupEntry = target.closest?.('[data-pci-plan-entry]');
  if (groupEntry) return groupEntry.closest('.group-card[data-group-id]')?.dataset.groupId || null;
  return null;
}

document.addEventListener('click', (event) => {
  const groupId = resolveGroupIdFromClick(event.target);
  if (groupId) {
    activePlanGroupId = groupId;
    normalizePlanNames(groupId);
    setTimeout(() => {
      normalizePlanNames(groupId);
      refreshVisiblePlanNames(groupId);
    }, 0);
    return;
  }

  if (event.target.closest?.('[data-open-plan]') && activePlanGroupId) {
    normalizePlanNames(activePlanGroupId);
    setTimeout(() => refreshVisiblePlanNames(activePlanGroupId), 0);
  }
}, true);

document.addEventListener('input', (event) => {
  const input = event.target.closest?.('[data-plan-field="name"]');
  if (!input || !activePlanGroupId) return;
  const found = findPlanGroup(activePlanGroupId);
  if (!found || !Array.isArray(found.group.plansBimestrales)) return;
  const heading = document.getElementById('pciPlansTitle')?.textContent ?? '';
  const match = heading.match(/Plan bimestral\s+(\d+)/i);
  const number = match ? Number(match[1]) : null;
  const plan = number ? found.group.plansBimestrales[number - 1] : null;
  if (!plan) return;
  plan.autoName = false;
  plan.autoNameSource = found.group.name;
}, true);

const planNameObserver = new MutationObserver(() => {
  if (!activePlanGroupId) return;
  normalizePlanNames(activePlanGroupId);
  refreshVisiblePlanNames(activePlanGroupId);
});
planNameObserver.observe(document.documentElement, { childList: true, subtree: true });
