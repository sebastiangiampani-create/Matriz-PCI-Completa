import test from 'node:test';
import assert from 'node:assert/strict';
import {crearColaGuardadoV2} from '../src/aplicacion-v2/persistencia-cola.mjs';

test('coalescer: tres ediciones rápidas producen como máximo dos escrituras, sin perder la última',async()=>{
 let resolveFirst;
 const first=new Promise(r=>{resolveFirst=r}),calls=[],locals=[],confirmed=[];
 const cola=crearColaGuardadoV2({
  guardarLocal:(state,revision)=>locals.push({state:state.value,revision}),
  guardarRemoto:async(state,revision)=>{
   calls.push({state:state.value,revision});
   if(calls.length===1)await first;
   return {revision:revision+1};
  },onRevision:rev=>confirmed.push(rev)
 });
 const a=cola.guardar({value:1});
 const b=cola.guardar({value:2});
 const c=cola.guardar({value:3});
 resolveFirst();
 await Promise.all([a,b,c]);
 assert.deepEqual(calls,[{state:1,revision:0},{state:3,revision:1}]);
 assert.equal(locals.at(-1).state,3);
 assert.equal(locals.at(-1).revision,2);
 assert.deepEqual(confirmed,[1,2]);
 assert.equal(cola.revision(),2);
});
test('un corte de red permite reintentar sin bloquear la sesión del editor',async()=>{
 let n=0;const originals=[];
 const cola=crearColaGuardadoV2({
  guardarLocal:(state,revision)=>originals.push([state.x,revision]),
  guardarRemoto:async(_state,revision)=>{
   if(++n===1)throw Object.assign(new Error('Corte de red'),{status:502});
   return {revision:revision+1};
  }
 });
 await assert.rejects(()=>cola.guardar({x:1}),/Corte de red/);
 assert.equal(cola.conflicto(),null);
 assert.equal(await cola.guardar({x:2}),true);
 assert.deepEqual(originals.at(-1),[2,1]);
});
test('un conflicto 409 se bloquea: no sobreescribe una revisión ajena',async()=>{
 let requests=0;const err=Object.assign(new Error('Edición concurrente'),{status:409});
 const cola=crearColaGuardadoV2({
  guardarLocal:()=>{},
  guardarRemoto:async()=>{requests++;throw err}
 });
 await assert.rejects(()=>cola.guardar({x:1}),{status:409});
 await assert.rejects(()=>cola.guardar({x:2}),{status:409});
 assert.equal(requests,1);
 assert.equal(cola.conflicto(),err);
});
test('respaldo local exclusivamente, si servicio no disponible',async()=>{
 const local=[];
 const cola=crearColaGuardadoV2({
  guardarLocal:(s,r)=>local.push([s.x,r]),
  guardarRemoto:()=>{throw Error('no debería iniciar red')},
  remotoDisponible:false
 });
 assert.equal(await cola.guardar({x:11}),true);
 assert.deepEqual(local,[[11,0]]);
});
test('un límite del navegador no invalida lo que confirmó Supabase',async()=>{
 let remote=0;
 const cola=crearColaGuardadoV2({
  guardarLocal:()=>{throw Error('QuotaExceeded')},
  guardarRemoto:async(_s,r)=>{remote++;return{revision:r+1}}
 });
 assert.equal(await cola.guardar({x:1}),true);
 assert.equal(remote,1);
 assert.equal(cola.revision(),1);
});
