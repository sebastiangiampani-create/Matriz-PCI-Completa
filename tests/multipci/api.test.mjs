import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {handleMultiPci} from '../../src/multipci/pci-workspace-handlers.mjs';
globalThis.crypto ??= webcrypto;
const PCI_ID='a3a3a3a3-1111-4111-8111-aaaaaaaaaaaa';

function fixture(session={role:'editor',school_id:1001}){
  const calls=[];
  let records=[{pci_id:PCI_ID,orientation_id:'economia_administracion',
    process_id:'process-test-1',model:'comun',curriculum_status:'ready',
    shift_id:'manana',status:'borrador',title:'Economía'}];
  const db={rpc:async(fn,args)=>{
    calls.push({fn,args});
    if(fn==='pci_workspace_list_pcis_v1')return {data:records,error:null};
    if(fn==='pci_workspace_create_pci_v2')return {data:{ok:true,pci_id:PCI_ID},error:null};
    if(fn==='pci_workspace_create_school_v1')return {data:{ok:true,school_id:1002},error:null};
    if(fn==='pci_workspace_get_pci_v1')return {data:{pci_id:PCI_ID,source_protected:true,legacy_sha256:'a'.repeat(64),legacy_state:{areas:{}}},error:null};
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
  assert.deepEqual(calls.map(x=>x.fn),['pci_workspace_create_pci_v2']);
  assert.equal(calls[0].args.p_model,'comun');
  assert.equal(calls[0].args.p_shift_id,'manana');
  assert.equal(calls[0].args.p_specialty_name,null);
});
test('el servidor impone la orientación y el proceso registrados en ese PCI',async()=>{
  const {ctx,calls}=fixture();
  const r=await status(await ctx('save-school-pci-unit',{
    school_id:1001,pci_id:PCI_ID,orientation_id:'ciencias_naturales',process_id:'proceso-falso',
    component:'fg',unit_kind:'area',unit_id:'Ciencias Sociales',
    base_version:'fg-sec-aprende-v2/1',expected_revision:0,
    document:{schema:'pci-fg-area-v2/1',school_id:1001,pci_id:PCI_ID,orientation_id:'economia_administracion',original_sha256:'a'.repeat(64),area:'Ciencias Sociales',groups:[{id:'grupo-demo',items:['contenido-ficticio']}]}
  }));
  assert.equal(r.status,200);
  const query=calls.find(x=>x.fn==='pci_collab_save_unit_v1');
  assert.ok(query);assert.equal(query.args.p_orientation_id,'economia_administracion');
  assert.equal(query.args.p_process_id,'process-test-1');
  assert.equal(query.args.p_expected_revision,0);
  assert.ok(calls.every(x=>x.fn!=='pci_proposals'));
  assert.ok(calls.some(x=>x.fn==='pci_workspace_get_pci_v1'));
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

test('rechaza orientaciones ajenas al catálogo sin crear registros',async()=>{
  const {ctx,calls}=fixture();
  const r=await status(await ctx('create-school-pci',{school_id:1001,orientation_id:'orientacion_inventada',title:'Ficticio'}));
  assert.equal(r.status,400);assert.equal(calls.length,0);
});
test('rechaza un documento de otra escuela aunque el URL contenga la escuela correcta',async()=>{
  const {ctx,calls}=fixture();
  const r=await status(await ctx('save-school-pci-unit',{
    school_id:1001,pci_id:PCI_ID,component:'fg',unit_kind:'area',unit_id:'Ciencias Sociales',
    base_version:'fg-sec-aprende-v2/1',expected_revision:0,
    document:{schema:'pci-fg-area-v2/1',school_id:1002,pci_id:PCI_ID,
      orientation_id:'economia_administracion',original_sha256:'a'.repeat(64),
      area:'Ciencias Sociales',groups:[]}
  }));
  assert.equal(r.status,409);
  assert.ok(!calls.some(x=>x.fn==='pci_collab_save_unit_v1'));
});
test('rechaza datos etiquetados con un origen histórico o área ajenos',async()=>{
  const {ctx,calls}=fixture();
  const r=await status(await ctx('save-school-pci-unit',{
    school_id:1001,pci_id:PCI_ID,component:'fg',unit_kind:'area',unit_id:'Ciencias Sociales',
    base_version:'fg-sec-aprende-v2/1',expected_revision:0,
    document:{schema:'pci-fg-area-v2/1',school_id:1001,pci_id:PCI_ID,
      orientation_id:'economia_administracion',original_sha256:'b'.repeat(64),
      area:'Matemática',groups:[]}
  }));
  assert.equal(r.status,409);
  assert.ok(!calls.some(x=>x.fn==='pci_collab_save_unit_v1'));
});

test('un colegio puede registrar un PCI Media y otro de Técnica en distintos turnos',async()=>{
  const {ctx,calls}=fixture();
  const media=await status(await ctx('create-school-pci',{
    school_id:1001,model:'comun',shift_id:'manana',
    orientation_id:'ciencias_naturales',title:'Media - Naturales'
  }));
  const tecnica=await status(await ctx('create-school-pci',{
    school_id:1001,model:'tecnica',shift_id:'tarde',
    orientation_id:'',specialty_name:'Computación',title:'Técnica - Computación'
  }));
  assert.equal(media.status,201);
  assert.equal(tecnica.status,201);
  const writes=calls.filter(x=>x.fn==='pci_workspace_create_pci_v2');
  assert.equal(writes.length,2);
  assert.equal(writes[0].args.p_model,'comun');
  assert.equal(writes[1].args.p_model,'tecnica');
  assert.equal(writes[1].args.p_shift_id,'tarde');
  assert.equal(writes[1].args.p_specialty_name,'Computación');
  assert.equal(writes[1].args.p_orientation_id,null);
  assert.ok(calls.every(x=>x.fn!=='pci_proposals'));
});
test('la composición técnica pendiente no puede leer ni guardar unidades de Media',async()=>{
  const f=fixture();
  f.setRecords([{pci_id:PCI_ID,orientation_id:'tecnica_aabbccdd',model:'tecnica',
    curriculum_status:'pending_rules',shift_id:'tarde',specialty_name:'Computación',
    process_id:'technical-1',status:'borrador',title:'Técnica'}]);
  for(const action of ['get-school-pci-unit','save-school-pci-unit']){
    const r=await status(await f.ctx(action,{
      school_id:1001,pci_id:PCI_ID,component:'fg',unit_kind:'area',
      unit_id:'Ciencias Naturales',base_version:'fg-sec-aprende-v2/1',
      expected_revision:0,document:{schema:'pci-fg-area-v2/1'}
    }));
    assert.equal(r.status,423);
    assert.match(r.body.error,/pendiente de reglas/i);
  }
  assert.ok(!f.calls.some(x=>x.fn==='pci_collab_get_unit_v1'));
  assert.ok(!f.calls.some(x=>x.fn==='pci_collab_save_unit_v1'));
});
test('validar nombre de especialidad y turno antes de insertar PCI',async()=>{
  const f=fixture();
  const bad=await status(await f.ctx('create-school-pci',{
    school_id:1001,model:'tecnica',shift_id:'tarde',
    specialty_name:'',orientation_id:'',title:'Técnica sin especialidad'
  }));
  const badShift=await status(await f.ctx('create-school-pci',{
    school_id:1001,model:'comun',shift_id:'inventado',
    orientation_id:'economia_administracion',title:'Media'
  }));
  assert.equal(bad.status,400);
  assert.equal(badShift.status,400);
  assert.equal(f.calls.length,0);
});

test('rechaza nombre de especialidad inventado: el alta requiere denominación específica',async()=>{
  const f=fixture();
  const result=await status(await f.ctx('create-school-pci',{
    school_id:1001,model:'tecnica',shift_id:'tarde',orientation_id:'',
    specialty_name:'Programación',title:'Especialidad sin nombre oficial'
  }));
  assert.equal(result.status,400);
  assert.equal(f.calls.length,0,'Un nombre fuera del catálogo no debe llegar al RPC');
});
test('admite especialidades identificadas aunque su espacio anual esté pendiente',async()=>{
  const f=fixture();
  const result=await status(await f.ctx('create-school-pci',{
    school_id:1001,model:'tecnica',shift_id:'noche',orientation_id:'',
    specialty_name:'Metalurgia',title:'PCI Metalurgia - noche'
  }));
  assert.equal(result.status,201);
  assert.equal(f.calls.at(-1).args.p_specialty_name,'Metalurgia');
});
