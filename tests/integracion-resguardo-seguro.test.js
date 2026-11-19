import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {execFile as execFileCb} from 'node:child_process';
import {createHash} from 'node:crypto';
import {prepareSafeMigration,verifySafeMigration,inventoryOriginal,ensureSourceUnchanged} from
  '../src/integracion-curricular/resguardo-migracion-segura.js';
import {verify as verifyBackup} from '../scripts/verificar-resguardo-matriz.mjs';
const execFile=promisify(execFileCb);
const digest=value=>createHash('sha256').update(value).digest('hex');
const source={
  schoolName:'Escuela ensayo',schemaVersion:8,school_id:1124,
  unknownRoot:{something:{mayBeNeededLater:true}},
  areas:{
    'Ciencias Sociales':{unseenProperty:{child:'mantener'},groups:Array.from({length:12},(_,i)=>({
      id:'s-'+i,kind:'laboratory',name:'Sociales '+i,startTerm:i+1,items:['social-'+i],
      unusual:{nested:['dato',{'other':true}]},
      plansBimestrales:[{number:1,name:'Plan '+i,objectives:'Objetivos',
        contentIds:['social-'+i],
        stages:{
          punto_partida:{description:'Inicio '+i},
          indagacion:{description:'Pregunta '+i},
          produccion:{description:'Producto '+i},
          evaluacion:{description:'Evaluación '+i,unknown:'evidencias'}
        },extraPlanProperty:{unknown:1}}]
    }))},
    Matemática:{groups:[{id:'m-1',kind:'trunk',items:['x'],plansBimestrales:[]}]}},
  extraState:{archival:{history:'NO BORRAR'}}
};
test('copias independientes conservan íntegros todos los campos, IDs y 4 etapas',()=>{
 const original=JSON.stringify(source);
 const packageData=prepareSafeMigration({
   rawState:source,schoolId:1124,orientationIds:['economia_administracion','matematica_fisica'],
   offerByOrientation:{economia_administracion:{socialOption:'A'},matematica_fisica:{socialOption:'B'}}
 });
 assert.equal(packageData.publication.allowed,false);
 assert.equal(packageData.original.inventory.groups,13);
 assert.equal(packageData.original.inventory.plans,12);
 assert.equal(packageData.original.inventory.stageNodes,48);
 assert.equal(JSON.stringify(packageData.original.data),original);
 assert.equal(verifySafeMigration(source,packageData).ok,true);
 const econ=packageData.orientations.economia_administracion;
 const science=packageData.orientations.matematica_fisica;
 assert.equal(econ.fg.areas['Ciencias Sociales'].groups.length,12);
 assert.equal(econ.warnings.some(w=>w.code==='revisar-laboratorio'),true);
 assert.equal(science.warnings.some(w=>w.code==='revisar-laboratorio'),false);
 econ.fg.rawState.areas['Ciencias Sociales'].groups[0].plansBimestrales[0].stages.evaluacion.description='Modificado';
 assert.equal(verifySafeMigration(source,packageData).ok,false);
 assert.equal(science.fg.rawState.areas['Ciencias Sociales'].groups[0].plansBimestrales[0].stages.evaluacion.description,'Evaluación 0');
 assert.equal(JSON.stringify(source),original);
});
test('no normaliza ni elimina campos desconocidos, aunque haya IDs repetidos',()=>{
 const duplicate=structuredClone(source);
 duplicate.areas.Matemática.groups[0].id='s-1';
 const pack=prepareSafeMigration({rawState:duplicate,schoolId:1124,
   orientationIds:['economia_administracion']});
 assert.equal(pack.problems[0].code,'ids-repetidos');
 assert.equal(JSON.stringify(pack.orientations.economia_administracion.fg.rawState),JSON.stringify(duplicate));
 assert.equal(pack.publication.allowed,false);
});
test('bloquea escuela ajena, orientación duplicada, perfil técnico y cambios del origen',()=>{
 assert.throws(()=>prepareSafeMigration({rawState:source,schoolId:912,orientationIds:['economia_administracion']}),/otra escuela/);
 assert.throws(()=>prepareSafeMigration({rawState:source,schoolId:1124,orientationIds:['economia_administracion','economia_administracion']}),/repetidas/);
 assert.throws(()=>prepareSafeMigration({rawState:source,schoolId:1124,orientationIds:['orientacion-que-no-existe']}),/no reconocida/);
 assert.throws(()=>prepareSafeMigration({rawState:{...source,profile:'tecnica'},schoolId:1124,orientationIds:['economia_administracion']}),/Modelo técnico/);
 const different=structuredClone(source);different.areas.Matemática.groups[0].items.push('nuevo');
 assert.throws(()=>ensureSourceUnchanged(source,different),/cambió/);
 assert.equal(inventoryOriginal(source).groups,13);
});
test('CLI crea archivos privados y verificables, bloquea alteraciones y no sobrescribe',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pci-auditoria-'));
 try {
   const input=join(root,'escuela.json'),target=join(root,'resguardo-2026');
   const content=JSON.stringify(source,null,2)+'\n';
   await writeFile(input,content);
   const args=['scripts/resguardar-matriz-por-orientacion.mjs','--source',input,'--school','1124',
     '--orientations','economia_administracion,matematica_fisica','--destination',target];
   const res=await execFile(process.execPath,args,{timeout:15000});
   assert.match(res.stdout,/Publicación BLOQUEADA/);
   const original=await readFile(join(target,'matriz-original-INALTERADA.json'));
   assert.equal(original.toString('utf8'),content);
   assert.equal(digest(original),digest(content));
   const ok=await verifyBackup(target);
   assert.equal(ok.verified,true);
   assert.equal(ok.orientations,2);
   await assert.rejects(()=>execFile(process.execPath,args,{timeout:15000}),/already exists|EEXIST/);
   const file=join(target,'copias-revision-no-publicar.json');
   const before=await readFile(file);
   const tampered=before.toString('utf8').replace('Evaluación 0','Evaluación ALTERADA');
   assert.notEqual(tampered,before.toString('utf8'));
   await writeFile(file,tampered);
   await assert.rejects(()=>verifyBackup(target),/SHA-256 diferente/);
 }finally{await rm(root,{recursive:true,force:true})}
});
