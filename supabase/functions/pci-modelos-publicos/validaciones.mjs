// Validaciones de la biblioteca PÚBLICA de modelos; no altera los PCI escolares.
export const PLAN_MODELS=Object.freeze(['general','comun','tecnica','ba15']);
export const FILE_LIMIT=8*1024*1024;
export const BUCKET='pci-modelos-planes-v2';
export const FILE_TYPES=Object.freeze({pdf:{mime:'application/pdf',magic:'pdf'}});
export function validModel(value){return PLAN_MODELS.includes(String(value||''));}
export function validUuid(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value||''));}
export function cleanText(value,max=120){return String(value??'').replace(/[\u0000-\u001F\u007F]/g,' ').trim().slice(0,max);}
export function fileMeta(file){
  if(!file || typeof file.name!=='string'||typeof file.size!=='number')throw Error('Elegí un archivo de plan.');
  if(file.size<1||file.size>FILE_LIMIT)throw Error('El archivo debe pesar hasta 8 MB.');
  const ext=(file.name.toLowerCase().match(/\.([a-z0-9]+)$/)||[])[1],kind=FILE_TYPES[ext];
  if(!kind)throw Error('Solamente se admiten documentos PDF.');
  const mime=String(file.type||'').toLowerCase();
  if(mime && mime!==kind.mime && mime!=='application/octet-stream')
    throw Error('El tipo de archivo no corresponde a su extensión.');
  return {ext,mime:kind.mime,filename:cleanText(file.name.replace(/[/\\]+/g,'_'),180),magic:kind.magic};
}
export function verifyMagic(bytes,magic){
  if(!(bytes instanceof Uint8Array))throw Error('Archivo inválido.');
  const ok=magic==='pdf'&&bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70&&bytes[4]===45;
  if(!ok)throw Error('El archivo no coincide con el formato seleccionado.');
}
function unbase64(s){const padded=s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4);return Uint8Array.from(atob(padded),c=>c.charCodeAt(0));}
export async function validAdminToken(token,secret,now=Date.now()){
  try{
    const parts=String(token||'').split('.');
    if(parts.length!==2||!secret||parts.some(x=>!x))return false;
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
    const valid=await crypto.subtle.verify('HMAC',key,unbase64(parts[1]),new TextEncoder().encode(parts[0]));
    if(!valid)return false;
    const payload=JSON.parse(new TextDecoder().decode(unbase64(parts[0])));
    return payload.role==='admin'&&payload.superadmin===true&&Number.isFinite(payload.exp)&&payload.exp>now;
  }catch{return false;}
}
