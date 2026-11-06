/* Aislamiento del borrador PCI online: solo afecta iframes con escuela y pestaña válidas. */
(() => {
  const params = new URLSearchParams(window.location.search);
  const school = params.get('pci_school');
  const tab = params.get('pci_tab');
  if (!/^\d+$/.test(school || '') || !/^[a-f0-9]{32}$/.test(tab || '')) return;
  if (window.parent === window) return;

  const scopedKeys = new Set(['pciAppV2', 'pciTecnicaV2', 'pciTecnicaV1']);
  const scoped = key => scopedKeys.has(String(key))
    ? 'pci-online:' + school + ':' + tab + ':' + key
    : key;
  const read = Storage.prototype.getItem;
  const write = Storage.prototype.setItem;
  const remove = Storage.prototype.removeItem;
  Storage.prototype.getItem = function (key) {
    return read.call(this, this === window.localStorage ? scoped(key) : key);
  };
  Storage.prototype.setItem = function (key, value) {
    return write.call(this, this === window.localStorage ? scoped(key) : key, value);
  };
  Storage.prototype.removeItem = function (key) {
    return remove.call(this, this === window.localStorage ? scoped(key) : key);
  };
})();
