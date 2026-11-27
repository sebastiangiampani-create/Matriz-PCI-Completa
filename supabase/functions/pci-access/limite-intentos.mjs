/**
 * C3: bloqueo por identidad institucional con máximo 10 intentos fallidos
 * en 15 minutos. No contiene claves, tokens ni datos de ninguna escuela.
 * Integrar en pci-access justo después de leer body.action y ANTES
 * de verificar contraseñas; desplegar sólo tras respaldar versión actual.
 */
export const MAX_INTENTOS_FALLIDOS=10;
export const VENTANA_MS=15*60*1000;

export function sujetoAcceso(action,body={}){
  const n=Number(body.school_id);
  if(action==='school-login'||action==='school-admin-login'){
    if(!Number.isInteger(n)||n<1001)return null;
    return{access_type:action==='school-login'?'editor':'school_admin',school_id:n};
  }
  if(action==='admin-login'){
    const username=String(body.username||'').trim().toLowerCase().slice(0,120);
    return{access_type:'user',actor_name:username};
  }
  return null;
}

export async function comprobarLimiteIntentos({db,action,body,now=Date.now(),cors={}}){
  const sujeto=sujetoAcceso(action,body);
  if(!sujeto)return null;
  if(!Number.isFinite(now))throw Error('Reloj inválido para el límite de intentos');
  const since=new Date(now-VENTANA_MS).toISOString();
  let query=db.from('pci_access_log').select('id',{count:'exact',head:true})
    .eq('success',false).eq('access_type',sujeto.access_type)
    .gte('created_at',since);
  if('school_id' in sujeto)query=query.eq('school_id',sujeto.school_id);
  else query=query.eq('actor_name',sujeto.actor_name);
  const {count,error}=await query;
  // Si no se puede verificar, no abrir una vía de fuerza bruta.
  if(error)throw error;
  if((count||0)<MAX_INTENTOS_FALLIDOS)return null;
  return new Response(JSON.stringify({error:'Demasiados intentos de acceso. Volvé a intentar en 15 minutos.'}),{
    status:429,
    headers:{...cors,'Retry-After':'900','Cache-Control':'no-store'}
  });
}
