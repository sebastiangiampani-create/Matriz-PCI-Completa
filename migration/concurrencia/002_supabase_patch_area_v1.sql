-- Supabase PostgreSQL 17 / concurrent area saves.
-- ADDITIVE ONLY. No data copy or changes to existing rows.
-- Invocation reserved to service_role *after* PCI session verification in Edge.
-- Actual legacy save-state endpoint is unchanged until cutover approval.
CREATE OR REPLACE FUNCTION public.pci_collab_patch_area_v1(
  p_school_id integer,
  p_area_name text,
  p_expected_area jsonb,
  p_next_area jsonb,
  p_actor_role text,
  p_actor_name text,
  p_actor_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_saved_area jsonb;
  v_updated_at timestamptz;
  v_exists boolean;
  v_current_area jsonb;
BEGIN
  IF p_school_id IS NULL OR p_school_id < 1
     OR p_area_name IS NULL OR length(btrim(p_area_name)) < 1 OR length(p_area_name) > 140
     OR p_area_name ~ '[[:cntrl:]]'
     OR p_area_name IN ('__proto__','constructor','prototype')
  THEN
    RAISE EXCEPTION 'Alcance curricular inválido' USING ERRCODE='22023';
  END IF;
  IF p_next_area IS NULL OR jsonb_typeof(p_next_area) <> 'object'
     OR pg_column_size(p_next_area) > 1048576
  THEN
    RAISE EXCEPTION 'Documento de área inválido o excesivo' USING ERRCODE='22023';
  END IF;
  IF p_expected_area IS NOT NULL AND jsonb_typeof(p_expected_area) <> 'object'
  THEN
    RAISE EXCEPTION 'Versión anterior inválida' USING ERRCODE='22023';
  END IF;
  IF p_actor_role NOT IN ('admin','user','editor')
     OR p_actor_name IS NULL OR length(p_actor_name) > 180
     OR p_actor_email IS NULL OR length(p_actor_email) > 180
  THEN
    RAISE EXCEPTION 'Actor de auditoría inválido' USING ERRCODE='22023';
  END IF;
  -- An identical document is not a new revision; no audit entry.
  IF p_expected_area IS NOT DISTINCT FROM p_next_area THEN
    RETURN jsonb_build_object('ok',true,'unchanged',true,'school_id',p_school_id,'area',p_area_name);
  END IF;
  -- Atomic compare-and-swap. PostgreSQL serializes competing updates of
  -- the same school and rechecks only the area being modified.
  UPDATE public.pci_proposals AS p
    SET data = jsonb_set(p.data, ARRAY['areas',p_area_name],p_next_area,true),
        updated_at = clock_timestamp()
    WHERE p.school_id = p_school_id
      AND jsonb_typeof(p.data->'areas') = 'object'
      AND (p.data->'areas'->p_area_name) IS NOT DISTINCT FROM p_expected_area
    RETURNING p.data->'areas'->p_area_name, p.updated_at
    INTO v_saved_area, v_updated_at;
  IF NOT FOUND THEN
    SELECT EXISTS(SELECT 1 FROM public.pci_proposals WHERE school_id=p_school_id)
      INTO v_exists;
    IF NOT v_exists THEN
      RETURN jsonb_build_object('ok',false,'status',404,'error','Escuela inexistente');
    END IF;
    SELECT data->'areas'->p_area_name INTO v_current_area
    FROM public.pci_proposals WHERE school_id=p_school_id;
    RETURN jsonb_build_object(
      'ok',false,'status',409,'error','Conflicto: el área cambió en otra sesión',
      'school_id',p_school_id,'area',p_area_name,
      'remote_area',v_current_area
    );
  END IF;
  -- Audit is part of the *same* transaction. If it fails, the update reverts.
  INSERT INTO public.pci_audit_log(
    school_id,actor_role,actor_name,actor_email,action,model,summary,changes,metadata
  ) VALUES (
    p_school_id,p_actor_role,p_actor_name,p_actor_email,
    'save_area', 'comun',
    'Guardado por espacio: ' || p_area_name,
    jsonb_build_array(jsonb_build_object('area',p_area_name,'scope','fg-historica')),
    jsonb_build_object('area',p_area_name,'mode','compare-and-swap','source','pci-collab-v1')
  );
  RETURN jsonb_build_object('ok',true,'unchanged',false,'school_id',p_school_id,
    'area',p_area_name,'updated_at',v_updated_at,
    'area_sha256',encode(sha256(convert_to(v_saved_area::text,'UTF8')),'hex'));
END;
$$;
REVOKE ALL ON FUNCTION public.pci_collab_patch_area_v1(
  integer,text,jsonb,jsonb,text,text,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pci_collab_patch_area_v1(
  integer,text,jsonb,jsonb,text,text,text
) TO service_role;
COMMENT ON FUNCTION public.pci_collab_patch_area_v1(
  integer,text,jsonb,jsonb,text,text,text
) IS 'API privada de escritura atómica por área para Edge pci-collab. No habilitada al frontend de producción.';
