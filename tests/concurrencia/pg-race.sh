#!/bin/sh
set -eu
scope="1001,'Economía y Administración','proceso-2026','fg','area','Ciencias Sociales','fg-matriz-historica/1'"
SQL_A="SELECT public.pci_collab_save_unit_v1($scope,2,'{\"groups\":[{\"id\":\"a\"}]}'::jsonb,'Editor A')->>'ok'"
SQL_B="SELECT public.pci_collab_save_unit_v1($scope,2,'{\"groups\":[{\"id\":\"b\"}]}'::jsonb,'Editor B')->>'ok'"
psql -X -A -t -v ON_ERROR_STOP=1 -c "$SQL_A" > /tmp/pci-race-a.txt &
a=$!
psql -X -A -t -v ON_ERROR_STOP=1 -c "$SQL_B" > /tmp/pci-race-b.txt &
b=$!
wait "$a"
wait "$b"
success=$(cat /tmp/pci-race-a.txt /tmp/pci-race-b.txt | grep -c '^true$' || true)
failure=$(cat /tmp/pci-race-a.txt /tmp/pci-race-b.txt | grep -c '^false$' || true)
test "$success" = 1
test "$failure" = 1
psql -X -A -t -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pci_collaboration.unit_history WHERE unit_id='Ciencias Sociales' AND revision=3" | grep -x 1
echo "Concurrencia comprobada: exactamente una escritura y un conflicto 409."
