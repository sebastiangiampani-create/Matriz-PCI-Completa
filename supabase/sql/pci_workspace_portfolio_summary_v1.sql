-- Inventario de modalidades por escuela, SOLO lectura.
-- La clasificación de la matriz histórica permanece en pci_proposals.data.profile.
-- Una escuela puede tener muchos PCI de Media, Técnica y/o BA +15.
-- El endpoint Edge autentica y limita las escuelas antes de devolver los datos.
CREATE OR REPLACE FUNCTION public.pci_workspace_portfolio_summary_v1()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $sql$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('school_id', s.school_id,
                         'pci_count', s.pci_count,
                         'offers', s.offers)
      ORDER BY s.school_id
    ), '[]'::jsonb
  )
  FROM (
    SELECT school_id,
           SUM(n)::integer AS pci_count,
           jsonb_agg(
             jsonb_build_object('model', model,
                                'count', n,
                                'shifts', shifts)
             ORDER BY model
           ) AS offers
    FROM (
      SELECT school_id, model,
             COUNT(*)::integer AS n,
             ARRAY_AGG(DISTINCT shift_id ORDER BY shift_id) AS shifts
      FROM pci_workspace.pcis
      WHERE model IN ('comun','tecnica','ba15')
      GROUP BY school_id, model
    ) p
    GROUP BY school_id
  ) s;
$sql$;

-- Prohibir acceso sin autenticar o desde el navegador. Solo Edge con service_role.
REVOKE ALL ON FUNCTION public.pci_workspace_portfolio_summary_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pci_workspace_portfolio_summary_v1() TO service_role;
