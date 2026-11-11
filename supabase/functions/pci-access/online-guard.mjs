/* State routes only. Authentication and permission resolution remain in pci-access. */
export const SAVE_PROTOCOL = 'session-three-way-v1';
export async function guardedStateRequest({ action, body, session, db, cors, inScope, hasPerm, canAny, actorFromSession, sha256 }) {
  const headers = { ...cors, 'Cache-Control': 'no-store', 'X-PCI-Save-Protocol': SAVE_PROTOCOL };
  const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
  const sid = Number(body.school_id);
  if (!Number.isSafeInteger(sid) || sid < 1 || sid > 2147483647) return reply({ error: 'Escuela invalida' }, 400);
  const scoped = inScope(session, sid);
  const write = scoped && (session.role === 'admin' || session.role === 'editor' || hasPerm(session, 'pci.edit'));
  const read = scoped && (session.role === 'editor' || session.role === 'school_admin' || canAny(session, ['pci.view', 'pci.edit']));
  if ((action === 'get-state' && !read) || (action === 'save-state' && !write)) return reply({ error: 'Sin permiso' }, 403);
  if (action !== 'get-state' && action !== 'save-state') return reply({ error: 'Accion invalida' }, 400);
  const decorate = result => ({ ...result, role: session.role, permissions: session.permissions || [], identity: session.identity || null, user: session.username || session.user || null });
  if (action === 'get-state' && !write) {
    const { data, error } = await db.from('pci_proposals').select('school_id,data,updated_at').eq('school_id', sid).maybeSingle();
    if (error) throw error;
    return data ? reply(decorate({ ...data, save_protocol: SAVE_PROTOCOL })) : reply({ error: 'Escuela inexistente' }, 404);
  }
  if (action === 'save-state' && (!body.data || typeof body.data !== 'object' || Array.isArray(body.data) || !body.data.areas || typeof body.data.areas !== 'object' || Array.isArray(body.data.areas))) {
    return reply({ error: 'Documento curricular invalido. No se reemplazo informacion.' }, 400);
  }
  const actor = { ...actorFromSession(session), first_name: session.identity?.first_name || '', last_name: session.identity?.last_name || '', username: session.username || session.user || '' };
  const sessionHash = await sha256('pci-online-guard-v1:' + String(body.token));
  const args = { p_school_id: sid, p_session_hash: sessionHash, p_actor: actor };
  if (action === 'save-state') args.p_incoming = body.data;
  const rpc = action === 'get-state' ? 'pci_online_open_v1' : 'pci_online_save_v1';
  const { data, error } = await db.rpc(rpc, args);
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new Error('Respuesta de guardado invalida');
  if (data.ok !== true) {
    const status = Number.isInteger(data.status) && data.status >= 400 && data.status <= 599 ? data.status : 500;
    return reply({ ...data, save_protocol: SAVE_PROTOCOL }, status);
  }
  return reply(action === 'get-state' ? decorate(data) : { ...data, save_protocol: SAVE_PROTOCOL });
}
