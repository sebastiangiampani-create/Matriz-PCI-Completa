import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryScopedStore, VERSIONS } from './scoped-store.mjs';
import { AreaSyncSession, createSupabaseUnitTransport } from './sync-session.mjs';

const schoolId = 1001;
const actor = { verified: true, id: 'docente-test', grants: [{ schoolId, permissions: ['pci.view', 'pci.edit'] }] };
const scopeBase = { schoolId, orientationId: 'Economía y Administración',
  processId: 'fg-2026-import-historico', baseVersion: VERSIONS.FG_HISTORICA };
const doc = (n) => ({ closed: false, groups: [{ id: 'g1', items: [n],
  plansBimestrales: [{ number: 1, stages: { inicio: { activity: 'Actividad ' + n } } }] }] });
const jsonResponse = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });

function apiFor(store) {
  return createSupabaseUnitTransport({
    endpoint: 'https://example.invalid/functions/v1/pci-collab', token: 'test-token',
    schoolId,
    fetchImpl: async (_url, options) => {
      const b = JSON.parse(options.body);
      const scope = {
        schoolId: b.school_id, orientationId: b.orientation_id, processId: b.process_id,
        component: b.component, kind: b.unit_kind, scopeId: b.unit_id, baseVersion: b.base_version
      };
      if (b.action === 'get-unit') {
        const current = await store.read(actor, scope);
        return jsonResponse(current ? {
          ok: true, exists: true, revision: current.revision,
          document: current.document, base_version: current.scope.baseVersion
        } : { ok: true, exists: false, revision: 0 });
      }
      try {
        const saved = await store.save(actor, scope, b.document, b.expected_revision);
        return jsonResponse({ ok: true, revision: saved.revision });
      } catch (err) {
        return jsonResponse({ error: err.message, code: err.code,
          current_revision: err.currentRevision }, err.status || 500);
      }
    }
  });
}
function session(store, orientationId = scopeBase.orientationId) {
  return new AreaSyncSession({ scopeBase: { ...scopeBase, orientationId }, transport: apiFor(store) });
}

test('dos docentes guardan Sociales y Naturales sin interferir', async () => {
  const store = new MemoryScopedStore();
  const sociales = session(store), naturales = session(store);
  const [s, n] = await Promise.all([
    sociales.inspect('Ciencias Sociales', doc('historia')),
    naturales.inspect('Ciencias Naturales', doc('biología'))
  ]);
  assert.equal(s.status, 'ready');
  assert.equal(n.status, 'ready');
  const [savedS, savedN] = await Promise.all([
    sociales.commit('Ciencias Sociales', doc('historia')),
    naturales.commit('Ciencias Naturales', doc('biología'))
  ]);
  assert.equal(savedS.revision, 1);
  assert.equal(savedN.revision, 1);
  assert.equal(store.history.length, 2);
  const readN = await store.read(actor, {
    ...scopeBase, component: 'fg', kind: 'area', scopeId: 'Ciencias Naturales'
  });
  assert.deepEqual(readN.document.groups[0].items, ['biología']);
});

test('dos docentes sobre la misma área: conflicto 409 y borrador local intacto', async () => {
  const store = new MemoryScopedStore(), a = session(store), b = session(store);
  const draftA = doc('a'), draftB = doc('b');
  await Promise.all([
    a.inspect('Ciencias Sociales', draftA),
    b.inspect('Ciencias Sociales', draftB)
  ]);
  await a.commit('Ciencias Sociales', draftA);
  await assert.rejects(b.commit('Ciencias Sociales', draftB), { status: 409 });
  assert.equal(b.getStatus('Ciencias Sociales').status, 'conflict');
  assert.deepEqual(draftB, doc('b'));
  assert.equal(store.history.length, 1);
});

test('diferentes orientaciones mantienen copias independientes', async () => {
  const store = new MemoryScopedStore();
  const ec = session(store, 'Economía y Administración');
  const soc = session(store, 'Ciencias Sociales');
  await Promise.all([
    ec.inspect('Ciencias Sociales', doc('economía')),
    soc.inspect('Ciencias Sociales', doc('sociales'))
  ]);
  await Promise.all([
    ec.commit('Ciencias Sociales', doc('economía')),
    soc.commit('Ciencias Sociales', doc('sociales'))
  ]);
  assert.equal(store.history.length, 2);
});

test('un borrador divergente de Supabase no se sobreescribe silenciosamente', async () => {
  const store = new MemoryScopedStore(), origin = session(store);
  await origin.inspect('Ciencias Sociales', doc('inicial'));
  await origin.commit('Ciencias Sociales', doc('inicial'));
  const another = session(store), oldDraft = doc('borrador-local');
  const observed = await another.inspect('Ciencias Sociales', oldDraft);
  assert.equal(observed.status, 'review_required');
  await assert.rejects(another.commit('Ciencias Sociales', oldDraft), { status: 409 });
  assert.deepEqual(another.acceptRemote('Ciencias Sociales'), doc('inicial'));
  assert.deepEqual(oldDraft, doc('borrador-local'));
  assert.equal(store.history.length, 1);
});

test('versión FG histórica obligatoria y escuela aislada', async () => {
  const store = new MemoryScopedStore();
  const transport = apiFor(store);
  await assert.rejects(transport.getUnit({
    ...scopeBase, schoolId: 1002, component: 'fg', kind: 'area', scopeId: 'Ciencias Sociales'
  }), { status: 403 });
  assert.throws(() => new AreaSyncSession({
    scopeBase: { ...scopeBase, baseVersion: 'sin-version' }, transport
  }), /versión histórica o vigente/);
});
