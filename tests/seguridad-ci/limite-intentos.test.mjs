import test from 'node:test';
import assert from 'node:assert/strict';
import {comprobarLimiteIntentos,sujetoAcceso,MAX_INTENTOS_FALLIDOS,VENTANA_MS} from '../../supabase/functions/pci-access/limite-intentos.mjs';
const now=Date.parse('2026-11-27T12:00:00Z');
const attempt=(type,school,user,time)=>({access_type:type,school_id:school,actor_name:user,success:false,created_at:new Date(time).toISOString()});
function mockedDb(rows=[],forceError=null){
  const trace=[];
  return {
    trace,
    from(table){
      assert.equal(table,'pci_access_log');
      const where={};
      const query={
        select(column,opts){assert.equal(column,'id');assert.equal(opts.count,'exact');assert.equal(opts.head,true);return this},
        eq(k,v){where[k]=v;trace.push([k,v]);return this},
        gte(k,v){where[k]={gte:v};trace.push([k,v]);return this},
        then(resolve,reject){
          const count=rows.filter(r=>Object.entries(where).every(([k,v])=>
            typeof v==='object'&&v.gte ? r[k]>=v.gte : r[k]===v)).length;
          return Promise.resolve(forceError?{count:null,error:forceError}:{count,error:null}).then(resolve,reject);
        }
      };
      return query;
    }
  };
}
test('10 fallos en 15 minutos bloquean el intento 11 con 429 y Retry-After',async()=>{
  assert.equal(MAX_INTENTOS_FALLIDOS,10);
  assert.equal(VENTANA_MS,15*60*1000);
  const db=mockedDb(Array.from({length:10},(_,i)=>attempt('editor',1001,'',now-i*1000)));
  const response=await comprobarLimiteIntentos({db,action:'school-login',body:{school_id:1001},now,cors:{'Access-Control-Allow-Origin':'*'}});
  assert.equal(response.status,429);
  assert.equal(response.headers.get('Retry-After'),'900');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),'*');
  assert.match((await response.json()).error,/Demasiados intentos/);
});
test('9 fallos permiten el intento 10, los fallos de otra escuela no bloquean',async()=>{
  const rows=[...Array.from({length:9},()=>attempt('editor',1001,'',now)),...Array.from({length:40},()=>attempt('editor',1002,'',now))];
  const db=mockedDb(rows);
  assert.equal(await comprobarLimiteIntentos({db,action:'school-login',body:{school_id:1001},now}),null);
});
test('caducan los fallos a partir de los 15 minutos',async()=>{
 const old=Array.from({length:10},()=>attempt('school_admin',1001,'',now-VENTANA_MS-1000));
 const db=mockedDb(old);
 assert.equal(await comprobarLimiteIntentos({db,action:'school-admin-login',body:{school_id:1001},now}),null);
});
test('el límite del panel DIR se separa del editor PCI por tipo de ingreso',async()=>{
 const db=mockedDb(Array.from({length:10},()=>attempt('editor',1001,'',now)));
 assert.equal(await comprobarLimiteIntentos({db,action:'school-admin-login',body:{school_id:1001},now}),null);
});
test('la autenticación administrativa se limita por nombre de usuario normalizado',async()=>{
 const db=mockedDb(Array.from({length:10},()=>attempt('user',null,'admin',now)));
 const response=await comprobarLimiteIntentos({db,action:'admin-login',body:{username:' ADMIN '},now});
 assert.equal(response.status,429);
 assert.deepEqual(sujetoAcceso('admin-login',{username:' A '}),{access_type:'user',actor_name:'a'});
});
test('acciones anónimas y escuelas inválidas no ejecutan el contador',async()=>{
 const db=mockedDb();
 assert.equal(await comprobarLimiteIntentos({db,action:'public-catalog',body:{},now}),null);
 assert.equal(await comprobarLimiteIntentos({db,action:'school-login',body:{school_id:'invalid'},now}),null);
 assert.equal(db.trace.length,0);
});
test('un error de base de datos falla cerrado en lugar de permitir nuevos intentos',async()=>{
 const db=mockedDb([],new Error('DB unavailable'));
 await assert.rejects(()=>comprobarLimiteIntentos({db,action:'school-login',body:{school_id:1001},now}),/DB unavailable/);
});
