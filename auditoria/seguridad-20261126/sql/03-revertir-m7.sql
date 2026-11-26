-- 03 (REVERSIÓN EXACTA) · Restituye solo los privilegios que cada
-- rol tenía ANTES de 03. Requiere la tabla de ACL tomada antes de revocar.
-- IMPORTANTE: no usar GRANT ALL: puede elevar privilegios previamente ausentes.
-- No modifica RLS, datos, contraseñas ni permisos de service_role.
BEGIN;
DO $$
DECLARE
  entrada record;
  targets text[] := ARRAY[
    'pci_users', 'pci_user_schools', 'pci_system_settings',
    'pci_security_audit_log', 'pci_audit_log', 'pci_access_log'
  ];
BEGIN
  IF to_regclass('pci_resguardo_seguridad_20261126.permisos_previos') IS NULL THEN
    RAISE EXCEPTION 'No se puede revertir: falta la copia de ACL anterior.';
  END IF;
  IF (SELECT COUNT(*) FROM pci_resguardo_seguridad_20261126.permisos_previos
      WHERE relname = ANY(targets)) <> array_length(targets, 1) THEN
    RAISE EXCEPTION 'Resguardo incompleto: faltan ACL de tablas objetivo. Sin cambios.';
  END IF;

  -- 03 únicamente revocó ACL directas de anon y authenticated; no tocó
  -- los permisos concedidos a PUBLIC, otros roles o service_role.
  FOR entrada IN
    SELECT a.relname, r.rolname, grant_entry.privilege_type,
           grant_entry.is_grantable
    FROM pci_resguardo_seguridad_20261126.permisos_previos a
    JOIN pg_catalog.pg_class c ON c.relname=a.relname
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public'
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(a.relacl::aclitem[], pg_catalog.acldefault('r', c.relowner))
    ) AS grant_entry
    JOIN pg_catalog.pg_roles r ON r.oid=grant_entry.grantee
    WHERE a.relname=ANY(targets)
      AND r.rolname IN ('anon','authenticated')
    ORDER BY a.relname,r.rolname,grant_entry.privilege_type
  LOOP
    EXECUTE format('GRANT %s ON TABLE public.%I TO %I%s',
      entrada.privilege_type,entrada.relname,entrada.rolname,
      CASE WHEN entrada.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
    );
  END LOOP;
END $$;
COMMIT;
-- Al terminar, comparar los permisos efectivos con el resguardo y
-- verificar que service_role conserve su acceso. No borrar el esquema de copia.
