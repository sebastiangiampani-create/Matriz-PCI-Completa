-- Corregir CHECK legado que rechazaba cualquier guardado V2 (23514).
-- Misma validación histórica, más los TRES contratos V2 ya protegidos por Edge
-- y por la RPC transaccional pci_collab_save_unit_v1.
-- DDL transaccional; no actualiza ni elimina unidades, documentos ni historial.
BEGIN;
ALTER TABLE pci_collaboration.units
  DROP CONSTRAINT units_version_check;
ALTER TABLE pci_collaboration.units
  ADD CONSTRAINT units_version_check CHECK (
    (component='fg' AND
      base_version IN ('fg-matriz-historica/1','fg-sec-aprende-v2/1'))
    OR (component='fo' AND orientation_id<>'_general' AND
      base_version IN ('fo-sec-aprende-v2/1','fo-tecnica-v1'))
    OR (component='articulacion' AND
      base_version='pci-articulacion-fg-fo/1')
    OR (component='oferta' AND (
      base_version LIKE 'oferta-%'
      OR base_version IN (
        'v2-original-embedded-v1',
        'v2-familia-tecnica-20261120/1',
        'v2-familia-ba15-20261120/1'
      )
    ))
  );
COMMIT;
