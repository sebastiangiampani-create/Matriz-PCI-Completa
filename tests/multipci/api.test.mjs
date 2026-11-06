import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {handleMultiPci} from '../../src/multipci/pci-workspace-handlers.mjs';
globalThis.crypto ??= webcrypto;
const PCI_ID='a3a3a3a3-1111-4111-8111-aaaaaaaaaaaa';

function fixture(session={role:'editor',school_id:1001}){
  const calls=[];
  let records=[{pci_id:PCI_ID,orientation_id:'economia_administracion',
    process_id:'process-test-1',status:'borrador',title:'Economía'}];
  const db={rpc:async(fn,args)=>{
    calls.push({fn,args});
    if(fn==='pci_workspace_list_pcis_v1')return {data:records,error:null};
    if(fn==='pci_workspace_create_pci_v1')return {data:{ok:true,pci_id:PCI_ID},error:null};
    if(fn==='pci_workspace_create_school_v1')return {data:{ok:true,school_id:1002},error:null};
    if(fn==='pci_workspace_get_pci_v1')return {data:{pci_id:PCI_ID,source_protected:true},error:null};
    if(fn==='pci_collab_get_unit_v1')return {data:{exists:false,revision:0},error:null};
    if(fn==='pci_collab_save_unit_v1')return {data:{ok:true,revision:1},error:null};
    throw new Error('RPC inesperado: '+fn);
  }};
  const ctx=(action,body)=>handleMultiPci({
    action,body,session,db,cors:{'Content-Type':'application/json'},
    inScope:(s,sid)=>s.role==='admin'||Number(s.school_id)===sid,
    hasPerm:()=>false,actorFromSession:()=>({name:'Docente de prueba'})
  });
  return {ctx,calls,setRecords:r=>records=r};
}
async function status(resp){return {status:resp.status,body:await resp.json()};}

test('una sesión de escuela no puede crear otra institución',async()=>{
  const {ctx,calls}=fixture();
  const r=await status(await ctx('create-school-v2',{name:'Escuela X',cue:'TEST-999',email:'',year:2027}));
  assert.equal(r.status,403);assert.equal(calls.length,0);
});
test('el superadministrador crea escuela con claves generadas en servidor',async()=>{
  const {ctx,calls}=fixture({role:'admin'});
  const r=await status(await ctx('create-school-v2',{name:'Escuela X',cue:'TEST-999',email:'x@ejemplo.test',year:2027}));
  assert.equal(r.status,201);assert.equal(r.body.school_id,1002);
  assert.match(r.body.edit_code,/^PCI-\d{4}$/);assert.match(r.body.primary_code,/^DIR-[A-F0-9]{8}$/);
  assert.equal(calls[0].fn,'pci_workspace_create_school_v1');
});
test('las solicitudes de otra escuela se bloquean antes de consultar la base',async()=>{
  const {ctx,calls}=fixture();
  const r=await status(await ctx('list-school-pcis',{school_id:1002}));
  assert.equal(r.status,403);assert.equal(calls.length,0);
});
test('es posible crear varios PCI sin alterar la matriz original',async()=>{
  const {ctx,calls}=fixture();
  const r=await status(await ctx('create-school-pci',{school_id:1001,orientation_id:'economia_administracion',title:'Economía · Turno Tarde'}));
  assert.equal(r.status,201);
  assert.deepEqual(calls.map(x=>x.fn),['pci_workspace_create_pci_v1']);
});
test('el servidor impone la orientación y el proceso registrados en ese PCI',async()=>{
  const {ctx,calls}=fixture();
  const r=await status(await ctx('save-school-pci-unit',{
    school_id:1001,pci_id:PCI_ID,orientation_id:'ciencias_naturales',process_id:'proceso-falso',
    component:'fg',unit_kind:'area',unit_id:'Ciencias Sociales',
    base_version:'fg-sec-aprende-v2/1',expected_revision:0,
    document:{groups:[{id:'grupo-demo',items:['contenido-ficticio']}]}
  }));
  assert.equal(r.status,200);
  const query=calls.find(x=>x.fn==='pci_collab_save_unit_v1');
  assert.ok(query);assert.equal(query.args.p_orientation_id,'economia_administracion');
  assert.equal(query.args.p_process_id,'process-test-1');
  assert.equal(query.args.p_expected_revision,0);
  assert.ok(calls.every(x=>x.fn!=='pci_proposals'));
});
test('no permite editar un PCI publicado ni sin revisión esperada',async()=>{
  const f=fixture();f.setRecords([{pci_id:PCI_ID,orientation_id:'economia_administracion',
    process_id:'test',status:'publicado'}]);
  const r=await status(await f.ctx('save-school-pci-unit',{
    school_id:1001,pci_id:PCI_ID,component:'fo',unit_kind:'space',
    unit_id:'Laboratorio FO',base_version:'fo-sec-aprende-v2/1',
    expected_revision:0,document:{label:'Borrador'}
  }));
  assert.equal(r.status,403);
  assert.ok(!f.calls.some(x=>x.fn==='pci_collab_save_unit_v1'));
});
