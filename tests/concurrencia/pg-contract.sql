-- Pruebas transaccionales ejecutadas SOLO en Postgres efímero de GitHub Actions.
DO $t$
DECLARE
  r jsonb;
  legacy jsonb;
BEGIN
  SELECT data INTO legacy FROM public.pci_proposals WHERE school_id=1001;
  IF has_function_privilege('anon','public.pci_collab_save_unit_v1(integer,text,text,text,text,text,text,bigint,jsonb,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.pci_collab_save_unit_v1(integer,text,text,text,text,text,text,bigint,jsonb,text)','EXECUTE')
     OR has_function_privilege('anon','public.pci_collab_get_unit_v1(integer,text,text,text,text,text)','EXECUTE')
  THEN RAISE EXCEPTION 'RPC de concurrencia expuesta a rol público'; END IF;
  IF NOT has_function_privilege('service_role','public.pci_collab_save_unit_v1(integer,text,text,text,text,text,text,bigint,jsonb,text)','EXECUTE')
  THEN RAISE EXCEPTION 'service_role no puede ejecutar RPC'; END IF;
  IF has_schema_privilege('anon','pci_collaboration','USAGE')
  THEN RAISE EXCEPTION 'Esquema privado expuesto'; END IF;

  SELECT public.pci_collab_save_unit_v1(1001,'Economía y Administración','proceso-2026','fg','area',
   'Ciencias Sociales','fg-matriz-historica/1',0,'{"groups":[{"id":"s1","items":["h1","h2"]}]}'::jsonb,'Profesor Sociales') INTO r;
  IF r->>'ok'<>'true' OR (r->>'revision')::bigint<>1 THEN RAISE EXCEPTION 'Sociales no se creó'; END IF;

  SELECT public.pci_collab_save_unit_v1(1001,'Economía y Administración','proceso-2026','fg','area',
   'Ciencias Naturales','fg-matriz-historica/1',0,'{"groups":[{"id":"n1","items":["b1","b2"]}]}'::jsonb,'Profesora Naturales') INTO r;
  IF r->>'ok'<>'true' OR (r->>'revision')::bigint<>1 THEN RAISE EXCEPTION 'Naturales no se creó'; END IF;

  SELECT public.pci_collab_save_unit_v1(1001,'Economía y Administración','proceso-2026','fg','area',
   'Ciencias Sociales','fg-matriz-historica/1',0,'{"groups":[]}'::jsonb,'Profesor Segundo') INTO r;
  IF r->>'status'<>'409' THEN RAISE EXCEPTION 'Creación duplicada sobrescribió Sociales'; END IF;

  SELECT public.pci_collab_save_unit_v1(1001,'Economía y Administración','proceso-2026','fg','area',
   'Ciencias Sociales','fg-sec-aprende-v2/1',1,'{"groups":[]}'::jsonb,'Profesor Segundo') INTO r;
  IF r->>'status'<>'409' THEN RAISE EXCEPTION 'Se cambió versión histórica'; END IF;

  SELECT public.pci_collab_save_unit_v1(1001,'Economía y Administración','proceso-2026','fg','area',
   'Ciencias Sociales','fg-matriz-historica/1',1,'{"groups":[{"id":"s1","items":["h1","h3"]}]}'::jsonb,'Profesor Sociales') INTO r;
  IF r->>'ok'<>'true' OR (r->>'revision')::bigint<>2 THEN RAISE EXCEPTION 'Revisión 2 inválida'; END IF;

  SELECT public.pci_collab_save_unit_v1(1001,'Economía y Administración','proceso-2026','fg','area',
   'Ciencias Naturales','fg-matriz-historica/1',1,'{"groups":[{"id":"n1","items":["b1","b3"]}]}'::jsonb,'Profesora Naturales') INTO r;
  IF r->>'ok'<>'true' OR (r->>'revision')::bigint<>2 THEN RAISE EXCEPTION 'Naturales pisada por Sociales'; END IF;

  SELECT public.pci_collab_save_unit_v1(1001,'Arte','proceso-2026','fo','space',
   'Laboratorio','fo-sec-aprende-v2/1',0,'{"contentIds":["fo-1"],"plans":[]}'::jsonb,'Docente Arte') INTO r;
  IF r->>'ok'<>'true' THEN RAISE EXCEPTION 'FO no funciona'; END IF;

  IF (SELECT data FROM public.pci_proposals WHERE school_id=1001) IS DISTINCT FROM legacy
  THEN RAISE EXCEPTION 'El guardado modificó la matriz histórica'; END IF;
  IF (SELECT count(*) FROM pci_collaboration.unit_history)<>5
  THEN RAISE EXCEPTION 'El historial de versiones no coincide'; END IF;
END;
$t$;
