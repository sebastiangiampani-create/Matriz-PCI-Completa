import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryScopedStore, VERSIONS } from './scoped-store.mjs';
import { FGAreaBridge } from './iframe-bridge.mjs';

const schoolId = 1001, orientationId = 'Economía y Administración';
const actor = { verified: true, id: 'docente', grants: [{ schoolId, permissions: ['pci.view','pci.edit'] }] };
const scopeBase = { schoolId, orientationId, processId: 'fg-2026-import',
  baseVersion: VERSIONS.FG_HISTORICA };
const scope = area => ({ ...scopeBase, component: 'fg', kind: 'area', scopeId: area });
const original = () => ({
  areas: {
    'Ciencias Sociales': { groups: [{ id: 'social', items: ['historia'] }] },
    'Ciencias Naturales': { groups: [{ id: 'natural', items: ['biología'] }] }
  }
});
function mockTransport(store) {
  return {
    async getUnit(scope) {
      const record = await store.read(actor, scope);
      return record ? { exists:true, revision:record.revision, document:record.document } :
        { exists:false, revision:0 };
    },
    async saveUnit(scope, document, revision) {
      const record = await store.save(actor, scope, document, revision);
      return { ok:true, revision:record.revision };
    }
  };
}
function fixture(store) {
  const state=original();
  const app={getState:()=>state,getActiveOrientation:()=>orientationId};
  const events=[];
  const bridge=new FGAreaBridge({app,...scopeBase,transport:mockTransport(store),onStatus:event=>events.push(event)});
  return {app,state,bridge,events};
}

test('al abrir la orientación, lee sin importar ni sobrescribir FG', async () => {
  const store=new MemoryScopedStore(), f=fixture(store);
  const snapshot=structuredClone(f.state);
  const inspected=await f.bridge.initialize();
  assert.equal(inspected.length,2);
  assert.deepEqual(f.state,snapshot);
  assert.equal(store.history.length,0);
});

test('al editar Sociales, la interfaz guarda solo ese ámbito', async () => {
  const store=new MemoryScopedStore(), f=fixture(store);
  await f.bridge.initialize();
  f.state.areas['Ciencias Sociales'].groups[0].items.push('economía');
  await f.bridge.notifyChange();
  assert.equal(store.history.length,1);
  assert.equal(store.history[0].scope.scopeId,'Ciencias Sociales');
  assert.deepEqual(f.state.areas['Ciencias Naturales'].groups[0].items,['biología']);
  f.state.areas['Ciencias Naturales'].groups[0].items.push('química');
  await f.bridge.notifyChange();
  assert.equal(store.history.length,2);
  assert.equal(store.history[1].scope.scopeId,'Ciencias Naturales');
});

test('conflicto remoto no modifica el borrador local', async () => {
  const store=new MemoryScopedStore();
  await store.save(actor, scope('Ciencias Sociales'), {groups:[{id:'remote'}]}, 0);
  const f=fixture(store);
  const results=await f.bridge.initialize();
  assert.ok(results.some(x=>x.area==='Ciencias Sociales'&&x.status==='review_required'));
  const before=structuredClone(f.state);
  f.state.areas['Ciencias Sociales'].groups[0].items.push('geografía');
  await f.bridge.notifyChange();
  assert.equal(store.history.length,1);
  assert.equal(f.state.areas['Ciencias Sociales'].groups[0].items.at(-1),'geografía');
  assert.deepEqual(f.state.areas['Ciencias Naturales'],before.areas['Ciencias Naturales']);
  assert.ok(f.events.some(x=>x.type==='blocked'&&x.area==='Ciencias Sociales'));
});

test('la orientación no seleccionada no puede guardarse', async () => {
  const store=new MemoryScopedStore(), state=original();
  const app={getState:()=>state,getActiveOrientation:()=> 'Ciencias Sociales'};
  const bridge=new FGAreaBridge({app,...scopeBase,transport:mockTransport(store)});
  await assert.rejects(bridge.initialize(),/Primero elegí una orientación/);
  assert.equal(store.history.length,0);
});
