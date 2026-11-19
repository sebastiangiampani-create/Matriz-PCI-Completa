import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../pci-online-storage-scope.js', import.meta.url), 'utf8');
const store = new Map();

function openFrame(url, embedded = true) {
  class Storage {
    getItem(key) { return store.has(key) ? store.get(key) : null; }
    setItem(key, value) { store.set(key, String(value)); }
    removeItem(key) { store.delete(key); }
  }
  const localStorage = new Storage();
  const sessionStorage = new Storage();
  const window = {
    location: { search: new URL(url).search },
    localStorage,
    sessionStorage,
  };
  window.parent = embedded ? {} : window;
  runInNewContext(script, { Storage, window, URLSearchParams });
  return { localStorage, sessionStorage };
}

test('dos escuelas y dos pestañas no comparten borradores', () => {
  store.clear();
  const a = openFrame('https://example.org/app.html?pci_school=1001&pci_tab=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  const b = openFrame('https://example.org/app.html?pci_school=1002&pci_tab=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  const c = openFrame('https://example.org/app.html?pci_school=1001&pci_tab=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  a.localStorage.setItem('pciAppV2', '{"owner":"a"}');
  b.localStorage.setItem('pciAppV2', '{"owner":"b"}');
  c.localStorage.setItem('pciAppV2', '{"owner":"c"}');
  assert.equal(a.localStorage.getItem('pciAppV2'), '{"owner":"a"}');
  assert.equal(b.localStorage.getItem('pciAppV2'), '{"owner":"b"}');
  assert.equal(c.localStorage.getItem('pciAppV2'), '{"owner":"c"}');
  assert.equal(store.has('pciAppV2'), false);
  a.localStorage.removeItem('pciAppV2');
  assert.equal(b.localStorage.getItem('pciAppV2'), '{"owner":"b"}');
});

test('el aislamiento también se aplica a Técnica y no modifica sessionStorage', () => {
  store.clear();
  const a = openFrame('https://example.org/tecnica/app.html?pci_school=1001&pci_tab=cccccccccccccccccccccccccccccccc');
  a.localStorage.setItem('pciTecnicaV2', 'T');
  assert.equal(store.get('pci-online:1001:cccccccccccccccccccccccccccccccc:pciTecnicaV2'), 'T');
  a.sessionStorage.setItem('pciTecnicaV2', 'S');
  assert.equal(a.sessionStorage.getItem('pciTecnicaV2'), 'S');
});

test('fuera del iframe online las claves originales no se interceptan', () => {
  store.clear();
  const direct = openFrame('https://example.org/app.html', false);
  direct.localStorage.setItem('pciAppV2', 'legacy');
  assert.equal(store.get('pciAppV2'), 'legacy');
  const invalid = openFrame('https://example.org/app.html?pci_school=x&pci_tab=dddddddddddddddddddddddddddddddd');
  assert.equal(invalid.localStorage.getItem('pciAppV2'), 'legacy');
});
