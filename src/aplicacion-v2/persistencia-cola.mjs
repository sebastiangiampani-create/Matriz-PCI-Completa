/**
 * Cola V2: máximo una escritura a la vez, conserva el último estado editado.
 * Los cambios intermedios se consolidan; se mantienen las revisiones optimistas
 * y los errores 409 no se reintentan silenciosamente.
 */
const copy=value=>structuredClone(value);
export function crearColaGuardadoV2({
 guardarLocal,guardarRemoto,revisionInicial=0,remotoDisponible=true,onRevision=()=>{}
}={}){
 if(typeof guardarLocal!=='function'||typeof guardarRemoto!=='function'||
    !Number.isSafeInteger(revisionInicial)||revisionInicial<0)
  throw new TypeError('La cola requiere funciones y revisión inicial válidas.');
 let revision=revisionInicial,pendiente=null,enCurso=null,conflicto=null,secuencia=0;
 async function vaciar(){
  while(pendiente){
   const {estado,seq}=pendiente;pendiente=null;
   try{
    const resultado=await guardarRemoto(copy(estado),revision);
    if(!Number.isSafeInteger(resultado?.revision)||resultado.revision!==revision+1)
     throw Object.assign(new Error('No se confirmó la revisión del servidor.'),{code:'GUARDADO_NO_CONFIRMADO',status:409});
    revision=resultado.revision;
    onRevision(revision);
    // Conservar la revisión remota nueva en el borrador SOLO si no llegó otra
    // edición mientras se escribía (nunca resucitar un borrador anterior).
    if(secuencia===seq){try{guardarLocal(copy(estado),revision,true)}catch{/* Guardado remoto confirmado. El respaldo local puede estar lleno; no se descarta la revisión remota. */}}
   }catch(error){
    if(error?.status===409||['stale_revision','CONFLICTO','GUARDADO_NO_CONFIRMADO'].includes(error?.code))
     conflicto=error;
    throw error;
   }
  }
  return true;
 }
 function guardar(estado){
  const snapshot=copy(estado),seq=++secuencia;
  let falloLocal;
  try{guardarLocal(copy(snapshot),revision,false)}catch(error){falloLocal=error}
  if(!remotoDisponible){
   if(falloLocal)throw falloLocal;
   return Promise.resolve(true);
  }
  if(conflicto)return Promise.reject(conflicto);
  pendiente={estado:snapshot,seq};
  if(!enCurso){
   enCurso=vaciar().finally(()=>{enCurso=null});
  }
  // Si falló el almacenamiento local, el servidor sigue pudiendo respaldar.
  // Un error en ambos canales sí impide salir y deja el estado actual en RAM.
  return enCurso;
 }
 return Object.freeze({
  guardar,revision:()=>revision,conflicto:()=>conflicto,
  enCurso:()=>enCurso!==null
 });
}
