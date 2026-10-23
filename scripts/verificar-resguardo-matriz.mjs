#!/usr/bin/env node
/**
 * Audita de nuevo una carpeta privada de resguardo, sin reescribir archivos.
 * Devuelve exit code 1 ante manipulaciones, cambios o copias incompletas.
 */
import { readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifySafeMigration } from '../src/integracion-curricular/resguardo-migracion-segura.js';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function assert(condition,message){if(!condition)throw Error(message);}
export async function verify(directory) {
 const root=resolve(directory);
 const read=(name)=>readFile(join(root,name));
 const manifest=JSON.parse((await read('manifiesto-verificacion.json')).toString('utf8'));
 assert(manifest.format==='pci-auditoria-de-resguardo/1','Manifiesto inválido.');
 assert(manifest.approved===false&&manifest.publishAllowed===false,'El manifiesto nunca habilita publicación.');
 const expected=['matriz-original-INALTERADA.json','copias-revision-no-publicar.json'];
 for(const key of expected){
   const meta=manifest.files?.[key];
   assert(meta && /^[0-9a-f]{64}$/.test(meta.sha256),'Falta checksum de '+key);
   const file=join(root,key), info=await lstat(file);
   assert(info.isFile()&&!info.isSymbolicLink(),'Archivo inválido: '+key);
   const bytes=await read(key);
   assert(bytes.length===meta.bytes&&sha(bytes)===meta.sha256,'SHA-256 diferente: '+key);
 }
 const original=JSON.parse((await read(expected[0])).toString('utf8'));
 const staged=JSON.parse((await read(expected[1])).toString('utf8'));
 const audit=verifySafeMigration(original,staged);
 assert(audit.ok,'Integridad de la copia: '+audit.failures.join(' | '));
 assert(JSON.stringify(audit.inventory)===JSON.stringify(manifest.inventory),'Cambió el inventario.');
 assert(staged.schoolId===manifest.schoolId,'El ID de escuela no coincide.');
 assert(JSON.stringify(Object.keys(staged.orientations))===JSON.stringify(manifest.orientations),'Orientaciones inconsistentes.');
 return {verified:true,schoolId:manifest.schoolId,orientations:manifest.orientations.length,
    inventory:audit.inventory,writeEnabled:false};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const argv=process.argv.slice(2);
 if(argv.length!==2||argv[0]!=='--directory'){console.error('Uso: node scripts/verificar-resguardo-matriz.mjs --directory /carpeta/privada');process.exitCode=2;}
 else verify(argv[1]).then(result=>{
    console.log('SHA-256 e inventarios correctos para '+result.orientations+
      ' orientaciones. Datos originales conservados. Importación BLOQUEADA.');
 }).catch(err=>{console.error('VERIFICACIÓN FALLIDA: '+err.message);process.exitCode=1;});
}
