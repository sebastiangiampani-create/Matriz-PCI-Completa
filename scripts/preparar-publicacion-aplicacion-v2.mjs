#!/usr/bin/env node
/** Distribución de la aplicación escolar; las fuentes originales se copian intactas. */
import {createHash} from 'node:crypto';
import {lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, rmdir, writeFile} from 'node:fs/promises';
import {basename, dirname, extname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=await realpath(fileURLToPath(new URL('..',import.meta.url)));
const EXTENSIONS=new Set(['.html','.js','.mjs','.css','.json','.txt','.svg','.png','.jpg','.jpeg','.webp','.ico','.woff','.woff2','.ttf','.md']);
const ROOT_FILES=['index.html','modelos-v2.html','modelo-comun.html','modelo-tecnica.html','modelo-ba15.html','revision-v2-embed.html','revision-v2-modalidad.html','pci-orientaciones.html','panel-general.html','panel-escuela.html',
  'panel-usuarios.html','panel-accesos.html','app.css','pci-orientaciones.css','pci-model.js','schools-catalog.csv'];
const inside=(path,dir)=>{const rel=relative(dir,path);return !rel||rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel);};
async function exists(path){try{await lstat(path);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}

async function collect(dir,files){
  for(const entry of (await readdir(join(ROOT,dir),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
    if(entry.name.startsWith('.')||/^(?:node_modules|tests?|test-artifacts|backups?|supabase)$/.test(entry.name))continue;
    const path=dir+'/'+entry.name;
    if(entry.isSymbolicLink())throw Error('No se publican enlaces simbólicos: '+path);
    if(entry.isDirectory())await collect(path,files);
    else if(entry.isFile()&&EXTENSIONS.has(extname(entry.name))&&!/\.(?:test|spec)\.[cm]?js$/.test(entry.name))files.add(path);
  }
}

async function prepare(raw){
  if(!raw||!isAbsolute(raw))throw Error('--out requiere una ruta absoluta.');
  const out=resolve(raw);
  if(inside(out,ROOT)||inside(ROOT,out)||['/','/workspace','/workspace/sites','/tmp'].includes(out))
    throw Error('El destino debe ser un directorio propio, fuera del repositorio.');
  await mkdir(dirname(out),{recursive:true});
  const canonical=join(await realpath(dirname(out)),basename(out));
  if(inside(canonical,ROOT)||inside(ROOT,canonical))throw Error('El destino resuelve al repositorio.');
  if(await exists(out)){
    const stat=await lstat(out);
    if(!stat.isDirectory()||stat.isSymbolicLink()||(await readdir(out)).length)
      throw Error('El destino debe estar vacío o no existir.');
  }
  const files=new Set(ROOT_FILES);
  for(const dir of ['src','assets','data','tecnica/data','vendor/pci-sec-aprende-v2'])await collect(dir,files);
  for(const path of [...files]){
    if(/school\d+-seed|preview-pr47|(?:^|\/)(?:supabase|tests?|test-artifacts|backups?)(?:\/|$)/i.test(path))
      files.delete(path);
  }
  const entry=await readFile(join(ROOT,'pci-orientaciones.html'),'utf8');
  if(/<iframe\b/i.test(entry)||!entry.includes('src/aplicacion-v2/entrada.mjs'))
    throw Error('La entrada debe cargar la aplicación directa sin marcos.');
  for(const path of ['src/aplicacion-v2/cargador.mjs','src/aplicacion-v2/runtime-v2.js']){
    const source=await readFile(join(ROOT,path),'utf8');
    if(/createElement\(['"]iframe['"]\)|<iframe\b/i.test(source))throw Error('El motor no puede montarse en un marco.');
  }
  const stage=await mkdtemp(join(dirname(out),'.'+basename(out)+'-stage-'));
  try{
    const hashes=[];let bytes=0;
    for(const path of [...files].sort()){
      const source=join(ROOT,path),stat=await lstat(source);
      if(!stat.isFile()||stat.isSymbolicLink())throw Error('Fuente no regular: '+path);
      const buffer=await readFile(source),target=join(stage,path);
      await mkdir(dirname(target),{recursive:true});
      await writeFile(target,buffer,{flag:'wx'});
      hashes.push(path+'\0'+createHash('sha256').update(buffer).digest('hex')+'\n');
      bytes+=buffer.length;
    }
    const metadata={version:'pci-aplicacion-escolar-v2/1',entrada:'index.html',
      archivos:files.size,bytes,sha256:createHash('sha256').update(hashes.join('')).digest('hex')};
    await writeFile(join(stage,'aplicacion-publicada.json'),JSON.stringify(metadata,null,2)+'\n',{flag:'wx'});
    if(await exists(out))await rmdir(out);
    await rename(stage,out);
    return {out,...metadata};
  }catch(error){await rm(stage,{recursive:true,force:true});throw error;}
}

try{
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--out')throw Error('Uso: node scripts/preparar-publicacion-aplicacion-v2.mjs --out /ruta/absoluta/vacia');
  console.log(JSON.stringify(await prepare(args[1]),null,2));
}catch(error){console.error('No se pudo preparar la aplicación: '+error.message);process.exitCode=1;}
