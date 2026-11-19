-- Solo lectura; devuelve cantidad y SHA256, nunca textos de PCI.
SELECT count(*)::text || ':' || encode(sha256(convert_to(
  coalesce(string_agg(school_id::text || ':' ||
    encode(sha256(convert_to(data::text,'UTF8')),'hex'),E'\n' ORDER BY school_id),''),
  'UTF8')),'hex')
FROM public.pci_proposals;
