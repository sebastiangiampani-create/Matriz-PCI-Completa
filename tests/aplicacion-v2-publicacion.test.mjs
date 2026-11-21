import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const panels=['panel-general.html','panel-escuela.html','panel-usuarios.html','panel-accesos.html'];

test('la distribución publica el acceso administrativo completo y sus recursos locales',async()=>{
  const tmp=await mkdtemp(join(tmpdir(),'pci-publicacion-admin-'));
  const out=join(tmp,'dist');
  try{
    execFileSync(process.execPath,['scripts/preparar-publicacion-aplicacion-v2.mjs','--out',out],{cwd:root});
    for(const path of panels){
      const published=await readFile(join(out,path),'utf8');
      assert.equal(published,await readFile(join(root,path),'utf8'),path+' debe publicarse completo');
      for(const match of published.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)){
        const value=match[1];
        if(value.startsWith('#')||value.includes('${')||/^(?:https?:|data:|mailto:|javascript:)/.test(value))continue;
        const resource=value.split(/[?#]/)[0];
        if(resource)assert.ok((await stat(join(out,resource))).isFile(),path+' requiere '+resource);
      }
      assert.doesNotMatch(published,/(?:src|href)=["']https:\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)/,
        path+' debe usar las fuentes y bibliotecas incluidas en la publicación');
    }
    assert.match(await readFile(join(out,'index.html'),'utf8'),/href="panel-general\.html"/);
  }finally{await rm(tmp,{recursive:true,force:true});}
});
