#!/usr/bin/env node
/**
 * Uso (EN UNA COMPUTADORA AUTORIZADA):
 * node scripts/resguardar-matriz-por-orientacion.mjs \
 *   --source /privado/estado-original.json --school 1234 \
 *   --orientations economia_administracion,matematica_fisica \
 *   --destination /privado/resguardos/escuela-1234-2026-10-13
 *
 * NO llama a Supabase, NO guarda datos en el repositorio,
 * NO sobrescribe directorios existentes y NO aplica cambios a escuelas.
 */
import { readFile, writeFile, mkdir, lstat, chmod } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareSafeMigration,verifySafeMigration } from '../src/integracion-curricular/resguardo-migracion-segura.js';

const project=resolve(fileURLToPath(new URL('..',import.meta.url)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (dir,path) => {const rel=relative(dir,path);return !rel || (!rel.startsWith('..'+sep) && rel !== '..' && !isAbsolute(rel));};
function options(argv) {
 const out={};
 for(let i=0;i<argv.length;i+=2) {
   const key=argv[i];
   if(!/^--(source|school|orientations|destination)$/.test(key) || !argv[i+1])throw Error('Opciones: --source --school --orientations --destination.');
   if(out[key])throw Error('Parámetro repetido: '+key);
   out[key]=argv[i+1];
 }
 if(['--source','--school','--orientations','--destination'].some(k=>!out[k]))
   throw Error('Falta un parámetro obligatorio (--source --school --orientations --destination).');
 return out;
}
export async function main(argv=process.argv.slice(2)) {
 const opts=options(argv);
 const source=resolve(opts['--source']), target=resolve(opts['--destination']);
 if(inside(project,source)||inside(project,target))
   throw Error('Por privacidad, los datos reales y respaldos deben estar FUERA del repositorio.');
 if(source===target)throw Error('El destino no puede ser la fuente original.');
 const info=await lstat(source);
 if(!info.isFile()||info.isSymbolicLink())throw Error('El origen debe ser un archivo JSON regular, no un enlace.');
 const bytes=await readFile(source);
 // Preservar los bytes ORIGINALES (saltos de línea, acentos, espacios, orden).
 let raw;
 try {raw=JSON.parse(bytes.toString('utf8'));}catch{throw Error('El archivo de origen no es JSON válido; no se genera ningún respaldo.');}
 const ids=opts['--orientations'].split(',').map(x=>x.trim()).filter(Boolean);
 const staged=prepareSafeMigration({rawState:raw,schoolId:Number(opts['--school']),orientationIds:ids});
 const audit=verifySafeMigration(raw,staged);
 if(!audit.ok)throw Error('La auditoría previa falló: '+audit.failures.join(' | '));
 // La carpeta debe ser NUEVA. Nunca hacemos overwrite de una copia previa.
 await mkdir(target,{recursive:false,mode:0o700});
 await chmod(target,0o700);
 const files={};
 async function put(name,value) {
   const file=resolve(target,name);
   if(!inside(target,file))throw Error('Nombre de archivo fuera de la carpeta de respaldo.');
   const data=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value,null,2)+'\n','utf8');
   await writeFile(file,data,{flag:'wx',mode:0o600});
   await chmod(file,0o600);
   const recovered=await readFile(file);
   if(sha(data)!==sha(recovered)||data.length!==recovered.length)
     throw Error('La verificación de lectura del respaldo falló: '+name);
   files[name]={sha256:sha(data),bytes:data.length};
 }
 await put('matriz-original-INALTERADA.json',bytes);
 await put('copias-revision-no-publicar.json',staged);
 const manifest={
   format:'pci-auditoria-de-resguardo/1',schoolId:staged.schoolId,
   source:'exportacion-original-previa-al-editor',
   files,inventory:audit.inventory,orientations:Object.keys(staged.orientations),
   integrity:'SHA-256 de cada archivo y comparación literal de todas las áreas por orientación',
   approved:false,publishAllowed:false,
   pending:'Homologación FG/FO, validación por escuela y autorización de migración de datos',
   // La fecha nunca forma parte de una decisión de igualdad.
   generatedAt:new Date().toISOString()
 };
 await put('manifiesto-verificacion.json',manifest);
 console.log('Resguardo local creado y leído de nuevo. '+audit.comparedOrientations+
    ' copias independientes verificadas. Publicación BLOQUEADA.');
 console.log('Directorio privado: '+target);
 console.log('Comprobar con: node scripts/verificar-resguardo-matriz.mjs --directory "'+target+'"');
 return {directory:target,manifest};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(error=>{console.error('OPERACIÓN DETENIDA: '+error.message);process.exitCode=1;});
}
