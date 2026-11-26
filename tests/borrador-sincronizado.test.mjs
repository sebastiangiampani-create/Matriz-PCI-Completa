/**
 * Regresión C1/M1 (auditoría 26/11/2026): un PCI nunca queda bloqueado en un
 * dispositivo porque otra persona guardó, y los cambios locales no confirmados
 * se resguardan sin borrarse. Datos 100 % simulados.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {guardarBorrador,leerBorrador,borradorSincronizadoCon,resguardarBorrador,listarResguardos} from '../src/aplicacion-v2/documentos.mjs';
import {crearColaGuardadoV2} from '../src/aplicacion-v2/persistencia-cola.mjs';

function memoria(){
 const m=new Map();
 return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),
  key:i=>[...m.keys()][i]??null,get length(){return m.size}};
}
const pci={school_id:1701,pci_id:'17171717-1111-4111-8111-000000000001',orientation_id:'economia_administracion',
 process_id:'proc-sim',legacy_sha256:'abc',shift_id:'manana',model:'comun',status:'borrador'};
const ctx={school:{id:1701},pci};
const estado=valor=>({active:'Economía y Administración',selected:['Economía y Administración'],
 maps:{'Economía y Administración':{placements:{},teachers:{nota:valor}}}});

test('la cola marca el borrador como sincronizado solo después de la confirmación remota',async()=>{
 const store=memoria();let servidor=0;
 const cola=crearColaGuardadoV2({revisionInicial:0,
  guardarLocal:(s,r,sync)=>guardarBorrador(ctx,s,{storage:store,revisionRemota:r,sincronizado:sync}),
  guardarRemoto:async(_s,r)=>{assert.equal(r,servidor);return {revision:++servidor}}});
 await cola.guardar(estado('a'));
 const b=leerBorrador(ctx,store);
 assert.equal(b.sincronizado,true);
 assert.equal(b.revisionRemota,1);
});

test('un corte de red deja el borrador como no sincronizado',async()=>{
 const store=memoria();
 const cola=crearColaGuardadoV2({revisionInicial:0,
  guardarLocal:(s,r,sync)=>guardarBorrador(ctx,s,{storage:store,revisionRemota:r,sincronizado:sync}),
  guardarRemoto:async()=>{throw Object.assign(Error('corte'),{status:502})}});
 await assert.rejects(()=>cola.guardar(estado('sin red')));
 assert.equal(leerBorrador(ctx,store).sincronizado,false);
});

test('borrador sincronizado y servidor más nuevo: no hay cambios propios que conservar',()=>{
 const store=memoria();
 guardarBorrador(ctx,estado('a'),{storage:store,revisionRemota:1,sincronizado:true});
 const b=leerBorrador(ctx,store);
 assert.equal(borradorSincronizadoCon(b,{exists:true,revision:3,document:{v2:estado('c')}}),true);
});

test('borrador con cambios no confirmados: se detecta y se resguarda sin perder nada',()=>{
 const store=memoria();
 guardarBorrador(ctx,estado('propio'),{storage:store,revisionRemota:1,sincronizado:false});
 const b=leerBorrador(ctx,store);
 assert.equal(borradorSincronizadoCon(b,{exists:true,revision:2,document:{v2:estado('ajeno')}}),false);
 const clave=resguardarBorrador(ctx,store);
 assert.equal(leerBorrador(ctx,store),null,'El borrador vigente se libera para abrir el servidor.');
 const resguardado=JSON.parse(store.getItem(clave));
 assert.equal(resguardado.v2.maps['Economía y Administración'].teachers.nota,'propio');
 assert.equal(listarResguardos(ctx,store).length,1);
});

test('borradores anteriores sin marca se comparan por contenido',()=>{
 const store=memoria();
 guardarBorrador(ctx,estado('igual'),{storage:store,revisionRemota:1});
 const b={...leerBorrador(ctx,store)};delete b.sincronizado;
 assert.equal(borradorSincronizadoCon(b,{exists:true,revision:2,document:{v2:estado('igual')}}),true);
 assert.equal(borradorSincronizadoCon(b,{exists:true,revision:2,document:{v2:estado('otro')}}),false);
});
