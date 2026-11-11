-- Test sobre PostgreSQL de CI con escuelas sintéticas, nunca sobre Supabase real.
INSERT INTO public.pci_proposals(school_id,data,edit_code,primary_code)
VALUES(1001,'{"schoolName":"Escuela Ficticia","areas":{"Ciencias Sociales":{"groups":[{"id":"g-1","items":["c1"],"plansBimestrales":[{"stages":{"punto_partida":"A","indagacion":"B","produccion":"C","evaluacion":"D"}}]}]}},"current":null,"_meta":{"cue":"TEST-001"}}'::jsonb,'PCI-0001','DIR-00000001');

DO $test$
DECLARE
  v_before jsonb;
  v_hash text;
  v_one jsonb;
  v_two jsonb;
  v_third jsonb;
  v_media jsonb;
  v_tech jsonb;
  v_tech_school jsonb;
  v_tech_origin jsonb;
  v_school jsonb;
  v_list jsonb;
  v_get jsonb;
  v_priv boolean;
BEGIN
  SELECT data INTO v_before FROM public.pci_proposals WHERE school_id=1001;
  v_hash=encode(pg_catalog.sha256(pg_catalog.convert_to(v_before::text,'UTF8')),'hex');

  SELECT public.pci_workspace_create_pci_v1(1001,'economia_administracion','Economía · turno mañana','admin-test') INTO v_one;
  SELECT public.pci_workspace_create_pci_v1(1001,'ciencias_sociales_humanidades','Sociales · turno tarde','admin-test') INTO v_two;

  IF (v_one->>'pci_id') IS NULL OR (v_two->>'pci_id') IS NULL OR
     (v_one->>'pci_id')=(v_two->>'pci_id')
  THEN RAISE EXCEPTION 'Dos PCI no recibieron IDs independientes'; END IF;

  SELECT public.pci_workspace_list_pcis_v1(1001) INTO v_list;
  IF jsonb_array_length(v_list)<>2 THEN RAISE EXCEPTION 'La lista no muestra dos PCI'; END IF;

  SELECT public.pci_workspace_get_pci_v1(1001,(v_one->>'pci_id')::uuid) INTO v_get;
  IF v_get->'legacy_state'<>v_before OR v_get->>'legacy_sha256'<>v_hash
  THEN RAISE EXCEPTION 'La FG histórica no se copió literalmente'; END IF;

  IF (SELECT data FROM public.pci_proposals WHERE school_id=1001)<>v_before
  THEN RAISE EXCEPTION 'La función tocó la matriz histórica'; END IF;

  IF (SELECT count(*) FROM pci_workspace.legacy_snapshots WHERE school_id=1001)<>1
  THEN RAISE EXCEPTION 'La misma FG se respaldó varias veces'; END IF;

  -- Más de un PCI de la MISMA orientación es válido (turnos o sedes).
  SELECT public.pci_workspace_create_pci_v1(1001,'economia_administracion','Economía · turno tarde','admin-test') INTO v_third;
  IF (v_one->>'process_id')=(v_third->>'process_id')
  THEN RAISE EXCEPTION 'Dos PCI comparten proceso'; END IF;

  -- Alta de escuela: solamente INSERT, no modificación de 1001.
  SELECT public.pci_workspace_create_school_v1('Instituto Nuevo Ficticio','TEST-002','test@ejemplo.test',2027,'PCI-0002','DIR-00000002','admin-test') INTO v_school;
  IF (v_school->>'school_id')::integer<>1002
  THEN RAISE EXCEPTION 'El alta no asignó el ID siguiente'; END IF;
  IF (SELECT data FROM public.pci_proposals WHERE school_id=1001)<>v_before
  THEN RAISE EXCEPTION 'El alta alteró la institución existente'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.pci_proposals WHERE school_id=1002)
  THEN RAISE EXCEPTION 'La escuela nueva no se insertó'; END IF;


  -- Una misma escuela tiene un PCI Media y uno Técnico; ambas identidades
  -- se preservan y ninguna hereda reglas del otro modelo.
  SELECT public.pci_workspace_create_pci_v2(
    1001,'ciencias_naturales','Media Naturales · mañana','admin-test',
    'comun','manana',NULL) INTO v_media;
  SELECT public.pci_workspace_create_pci_v2(
    1001,NULL,'Técnica Programación · tarde','admin-test',
    'tecnica','tarde','Programación') INTO v_tech;
  IF v_media->>'model'<>'comun' OR v_tech->>'model'<>'tecnica'
    OR v_media->>'curriculum_status'<>'ready'
    OR v_tech->>'curriculum_status'<>'pending_rules'
    OR v_tech->>'specialty_name'<>'Programación'
    OR v_tech->>'shift_id'<>'tarde'
    OR v_tech->>'orientation_id' NOT LIKE 'tecnica_%'
    OR v_media->>'pci_id'=v_tech->>'pci_id'
  THEN RAISE EXCEPTION 'Los PCI mixtos no se aislaron correctamente'; END IF;
  IF (SELECT data FROM public.pci_proposals WHERE school_id=1001)<>v_before
  THEN RAISE EXCEPTION 'El alta mixta alteró los contenidos históricos'; END IF;
  IF (SELECT count(*) FROM pci_workspace.legacy_snapshots WHERE school_id=1001)<>1
  THEN RAISE EXCEPTION 'La rama Técnica produjo duplicación del origen histórico'; END IF;

  -- Un colegio cuya matriz histórica es técnica también puede registrar una
  -- orientación de Media sin transformar ni borrar su legado técnico.
  INSERT INTO public.pci_proposals(school_id,data,edit_code,primary_code)
  VALUES(1003,'{"schoolName":"Escuela Técnica Ficticia","profile":"tecnica","areas":{"Talleres":{"groups":[{"id":"t1","name":"Taller histórico","items":["c1"]}]}},"current":"Talleres"}'::jsonb,
    'PCI-0003','DIR-00000003');
  SELECT data INTO v_tech_origin FROM public.pci_proposals WHERE school_id=1003;
  SELECT public.pci_workspace_create_pci_v2(
    1003,'economia_administracion','Media Economía independiente','admin-test',
    'comun','tarde',NULL) INTO v_tech_school;
  IF v_tech_school->>'legacy_source_model'<>'tecnica'
  THEN RAISE EXCEPTION 'Se perdió la trazabilidad del modelo técnico original'; END IF;
  IF (SELECT data FROM public.pci_proposals WHERE school_id=1003)<>v_tech_origin
  THEN RAISE EXCEPTION 'Se transformó indebidamente el PCI Técnico histórico'; END IF;

  -- Un PCI técnico también puede registrarse sin habilitar composición.
  SELECT public.pci_workspace_create_pci_v2(
    1003,NULL,'Especialidad Técnica Ficticia','admin-test',
    'tecnica','vespertino','Construcciones') INTO v_tech_school;
  IF v_tech_school->>'curriculum_status'<>'pending_rules'
  THEN RAISE EXCEPTION 'Reglas técnicas fueron habilitadas sin validación'; END IF;

  -- Un PCI en escuela 1002 jamás permite leer el PCI de 1001 por school_id.
  IF public.pci_workspace_get_pci_v1(1002,(v_one->>'pci_id')::uuid) IS NOT NULL
  THEN RAISE EXCEPTION 'Cruce de lectura entre escuelas'; END IF;

  -- La API pública anon/authenticated no ejecuta los RPC.
  SELECT pg_catalog.has_function_privilege(
    'anon','public.pci_workspace_create_school_v1(text,text,text,integer,text,text,text)','EXECUTE')
  INTO v_priv;
  IF v_priv THEN RAISE EXCEPTION 'El alta es accesible a anon';END IF;
  SELECT pg_catalog.has_function_privilege(
    'authenticated','public.pci_workspace_create_pci_v1(integer,text,text,text)','EXECUTE')
  INTO v_priv;
  IF v_priv THEN RAISE EXCEPTION 'El alta de PCI es accesible a authenticated';END IF;

  SELECT pg_catalog.has_function_privilege(
    'authenticated','public.pci_workspace_create_pci_v2(integer,text,text,text,text,text,text)','EXECUTE')
  INTO v_priv;
  IF v_priv THEN RAISE EXCEPTION 'El nuevo alta mixta es accesible sin service role'; END IF;

  IF pg_catalog.has_schema_privilege('anon','pci_workspace','USAGE')
  THEN RAISE EXCEPTION 'Se expuso el esquema privado';END IF;
END;
$test$;
SELECT 'TEST MULTIPCI OK: sin modificaciones a los documentos históricos' AS resultado;
