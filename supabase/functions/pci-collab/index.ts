/**
 * PCI Collaboration API v1 - branch preview.
 * Disabled unless PCI_COLLAB_ENABLED=true. Never changes pci_proposals.data.
 * Custom PCI sessions are signed by pci-access using the project service key.
 * The service key is NEVER returned to browsers.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const URL = Deno.env.get('SUPABASE_URL') ?? '';
const SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ENABLED = Deno.env.get('PCI_COLLAB_ENABLED') === 'true';
const db = createClient(URL, SECRET, { auth: { persistSession: false } });
const enc = new TextEncoder();
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type,authorization,apikey',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Content-Type': 'application/json; charset=utf-8'
};
const send = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: cors });

function fromB64u(input: string) {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  return atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='));
}
function b64u(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
async function signedBody(body: string) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return b64u(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body))));
}
async function verifySession(token: unknown): Promise<any | null> {
  if (typeof token !== 'string' || token.length > 12000) return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra !== undefined) return null;
  try {
    const expected = enc.encode(await signedBody(body));
    const received = enc.encode(signature);
    if (expected.length !== received.length) return null;
    let different = 0;
    for (let i = 0; i < expected.length; i++) different |= expected[i] ^ received[i];
    if (different !== 0) return null;
    const session = JSON.parse(fromB64u(body));
    if (!Number.isSafeInteger(session?.exp) || session.exp <= Date.now()) return null;
    if (session.role === 'user' && session.user_id) {
      const { data: user, error } = await db.from('pci_users')
        .select('is_active,permissions,all_schools,must_change_password,username,first_name,last_name,email')
        .eq('id', session.user_id).maybeSingle();
      if (error || !user?.is_active) return null;
      const { data: memberships, error: membershipError } = await db.from('pci_user_schools')
        .select('school_id').eq('user_id', session.user_id);
      if (membershipError) return null;
      return {
        ...session,
        permissions: Array.isArray(user.permissions) ? user.permissions : [],
        all_schools: user.all_schools === true,
        school_ids: (memberships ?? []).map(x => Number(x.school_id)),
        must_change_password: user.must_change_password === true,
        identity: { first_name: user.first_name, last_name: user.last_name, email: user.email },
        username: user.username
      };
    }
    if (!['admin', 'editor', 'school_admin'].includes(session.role)) return null;
    return session;
  } catch { return null; }
}
function canAccess(session: any, schoolId: number, write: boolean) {
  if (!Number.isSafeInteger(schoolId) || schoolId < 1001) return false;
  if (session.role === 'admin') return true;
  if (session.role === 'editor') return Number(session.school_id) === schoolId;
  if (session.role === 'school_admin') return !write && Number(session.school_id) === schoolId;
  if (session.role !== 'user') return false;
  if (write && session.must_change_password) return false;
  const belongs = session.all_schools === true ||
    (session.school_ids ?? []).some((x: any) => Number(x) === schoolId);
  const permissions = session.permissions ?? [];
  return belongs && Array.isArray(permissions) &&
    permissions.includes(write ? 'pci.edit' : 'pci.view') ||
    (belongs && !write && Array.isArray(permissions) && permissions.includes('pci.edit'));
}
const units: Record<string, string[]> = {
  fg: ['area', 'group', 'plan'],
  fo: ['space', 'group', 'plan'],
  articulacion: ['link'],
  oferta: ['map']
};
function safeText(value: unknown, max = 160) {
  return typeof value === 'string' && value.length >= 1 && value.length <= max &&
    value.trim().length > 0 && !/[\u0000-\u001f]/.test(value) &&
    !['__proto__', 'constructor', 'prototype'].includes(value);
}
function validateScope(body: any) {
  const s = {
    schoolId: Number(body.school_id),
    orientationId: body.orientation_id,
    processId: body.process_id,
    component: body.component,
    unitKind: body.unit_kind,
    unitId: body.unit_id,
    baseVersion: body.base_version
  };
  if (!Number.isSafeInteger(s.schoolId) || s.schoolId < 1001 ||
      !safeText(s.orientationId) || !safeText(s.processId) ||
      !safeText(s.component, 32) || !safeText(s.unitKind, 32) ||
      !safeText(s.unitId, 240) || !safeText(s.baseVersion)) return null;
  if (!units[s.component]?.includes(s.unitKind)) return null;
  if (s.component === 'fg' &&
      !['fg-matriz-historica/1', 'fg-sec-aprende-v2/1'].includes(s.baseVersion)) return null;
  if (s.component === 'fo' &&
      (s.baseVersion !== 'fo-sec-aprende-v2/1' || s.orientationId === '_general')) return null;
  if (s.component === 'articulacion' && s.baseVersion !== 'pci-articulacion-fg-fo/1') return null;
  if (s.component === 'oferta' && !s.baseVersion.startsWith('oferta-')) return null;
  return s;
}
function actorName(session: any) {
  const name = [session.identity?.first_name, session.identity?.last_name]
    .filter(Boolean).join(' ').trim() || session.username || session.user || 'Editor';
  return String(name).trim().slice(0, 180);
}
function plainObject(x: unknown) {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('', { headers: cors });
  if (req.method !== 'POST') return send({ error: 'Método no admitido' }, 405);
  if (!ENABLED) return send({ error: 'Colaboración no habilitada en esta versión' }, 503);

  let body: any;
  try {
    const input = await req.text();
    if (input.length > 1500000) return send({ error: 'Solicitud demasiado extensa' }, 413);
    body = JSON.parse(input);
  } catch { return send({ error: 'JSON inválido' }, 400); }
  if (!plainObject(body)) return send({ error: 'Solicitud inválida' }, 400);
  const session = await verifySession(body.token);
  if (!session) return send({ error: 'Sesión PCI inválida o vencida' }, 401);
  const scope = validateScope(body);
  if (!scope) return send({ error: 'Alcance curricular inválido' }, 400);
  const action = String(body.action ?? '');
  const write = action === 'save-unit';
  if (!['get-unit', 'save-unit'].includes(action)) return send({ error: 'Acción desconocida' }, 400);
  if (!canAccess(session, scope.schoolId, write)) return send({ error: 'Sin permiso' }, 403);

  try {
    const { data: school, error: schoolError } = await db.from('pci_proposals')
      .select('data').eq('school_id', scope.schoolId).maybeSingle();
    if (schoolError) throw schoolError;
    if (!school) return send({ error: 'Escuela inexistente' }, 404);
    if (school.data?.profile === 'tecnica') return send({ error: 'PCI Técnica no habilitada para colaboración' }, 422);

    const args = {
      p_school_id: scope.schoolId,
      p_orientation_id: scope.orientationId,
      p_process_id: scope.processId,
      p_component: scope.component,
      p_unit_kind: scope.unitKind,
      p_unit_id: scope.unitId
    };
    if (!write) {
      const { data, error } = await db.rpc('pci_collab_get_unit_v1', args);
      if (error) throw error;
      if (data?.exists && data.base_version !== scope.baseVersion)
        return send({ error: 'La versión curricular del proceso no coincide', current_base_version: data.base_version }, 409);
      return send({ ok: true, ...data });
    }
    if (!plainObject(body.document) || !Number.isSafeInteger(body.expected_revision) ||
        body.expected_revision < 0) return send({ error: 'Documento o revisión inválida' }, 400);
    const { data, error } = await db.rpc('pci_collab_save_unit_v1', {
      ...args,
      p_base_version: scope.baseVersion,
      p_expected_revision: body.expected_revision,
      p_document: body.document,
      p_actor: actorName(session)
    });
    if (error) throw error;
    if (data?.ok === true) return send({ ...data, scope: args });
    if (data?.status === 409) return send(data, 409);
    return send({ error: 'No se pudo guardar' }, 422);
  } catch (error) {
    console.error('pci-collab', error);
    return send({ error: 'Error del servicio de colaboración' }, 500);
  }
});
