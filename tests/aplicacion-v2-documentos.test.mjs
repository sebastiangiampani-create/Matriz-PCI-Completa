import test from 'node:test';
import assert from 'node:assert/strict';
import {
  identidadPci,contratoV2,validarDocumentoV2,crearDocumentoV2,
  claveBorrador,leerBorrador,guardarBorrador
} from '../src/aplicacion-v2/documentos.mjs';
import {crearClienteEscuela,permisosSesion} from '../src/aplicacion-v2/datos-escuela.mjs';

const UUID1='00000000-0000-4000-8000-000000000001';
const UUID2='00000000-0000-4000-8000-000000000002';
const context=()=>({school:{id:1017,name:'Escuela simulada'},pci:{
  school_id:1017,pci_id:UUID1,orientation_id:'comunicacion',shift_id:'manana',
  model:'comun',process_id:'pci-'+UUID1,legacy_sha256:'a'.repeat(64),status:'borrador',
  legacy_state:{schoolName:'Escuela simulada',profile:'comun',areas:{}}
}});
const state=()=>({school:'Escuela simulada',active:'Comunicación',selected:['Comunicación'],
  maps:{'Comunicación':{placements:{},phase2V28:{groups:{}},socialOption:'B'},
    Literatura:{placements:{},phase2V28:{groups:{}}}},
  institutional:{teachers:{docente1:{name:'Docente de prueba'}},assignments:{instancia1:'docente1'},
    coordinations:[{id:'coord1',teacherId:'docente1',kind:'area',scope:'Lengua y Literatura'}],
    students:{alumno1:{name:'Estudiante de prueba'}},commissions:{curso1:{students:['alumno1']}}},
  otraRaizDelMotor:{preferencia:'se conserva completa'}
});
function memoryStorage(initial={}){
  const entries=new Map(Object.entries(initial));
  return {entries,getItem:key=>entries.has(key)?entries.get(key):null,
    setItem:(key,value)=>entries.set(key,String(value)),removeItem:key=>entries.delete(key)};
}
const sessionRecord=(extra={})=>({token:'token-sintetico-de-prueba',role:'editor',school_id:1017,
  name:'Escuela simulada',...extra});
function mockClient({saved=sessionRecord(),verified={role:'editor',permissions:[],school_ids:[],all_schools:false},
  handle=()=>({})}={}){
  const calls=[],storage=memoryStorage(saved?{pci_access_session:JSON.stringify(saved)}:{});
  const cliente=crearClienteEscuela({storage,fetchImpl:async(url,init)=>{
    const body=JSON.parse(init.body);calls.push({url,init,body});
    const result=body.action==='session-info'?{data:verified}:await handle(body,calls);
    const wrapped=result!==null&&typeof result==='object'&&Object.hasOwn(result,'data');
    return new Response(JSON.stringify(wrapped?result.data:result),{status:wrapped?(result.status??200):200,
      headers:{'Content-Type':'application/json'}});
  }});
  return {cliente,calls,storage};
}
const links=()=>({schema:'pci-vinculos-historicos-v1',school_id:1017,
  source_updated_at:'2026-11-19T14:00:00Z',assignments:[
    {area:'Lengua y Literatura',id:'grupo-1',kind:'general',mode:'selected',pci_ids:[UUID1]}
  ]});

test('la identidad incluye escuela, PCI, modalidad, orientación, turno y procedencia',()=>{
  const c=context();
  assert.deepEqual(identidadPci(c),{schoolId:1017,pciId:UUID1,model:'comun',
    orientationId:'comunicacion',shiftId:'manana',processId:'pci-'+UUID1,legacySha256:'a'.repeat(64)});
  c.school.id=1020;
  assert.throws(()=>identidadPci(c),{code:'IDENTIDAD_PCI_INVALIDA'});
});

test('el contrato por modalidad conserva las unidades V2 existentes',()=>{
  assert.deepEqual(contratoV2('comun'),{component:'oferta',unitKind:'map',
    unitId:'mapa-original-v2-v1',baseVersion:'v2-original-embedded-v1'});
  for(const model of ['tecnica','ba15'])assert.deepEqual(contratoV2(model),{
    component:'oferta',unitKind:'map',unitId:`mapa-v2-familia-${model}-v1`,
    baseVersion:`v2-familia-${model}-20261120/1`});
  assert.throws(()=>contratoV2('media'),{code:'MODELO_V2_INVALIDO'});
});

test('guardar y restaurar el sobre conserva el estado institucional completo sin mutarlo',()=>{
  const c=context(),source=state(),before=structuredClone(source);
  const document=crearDocumentoV2(source,c),restored=validarDocumentoV2(document,c);
  assert.deepEqual(restored.v2,before);
  restored.v2.institutional.teachers.docente1.name='Cambio en otra copia';
  restored.v2.maps.Comunicación.socialOption='A';
  assert.deepEqual(source,before);
  assert.deepEqual(document.v2,before);
});

test('rechaza un documento ajeno por cada dimensión de identidad, sin corregirlo a la fuerza',()=>{
  const c=context(),document=crearDocumentoV2(state(),c);
  const variations={schoolId:1020,pciId:UUID2,model:'tecnica',orientationId:'literatura',
    shiftId:'tarde',processId:'otro-proceso',legacySha256:'b'.repeat(64)};
  for(const [field,value] of Object.entries(variations)){
    const foreign={...structuredClone(document),[field]:value};
    const before=structuredClone(foreign);
    assert.throws(()=>validarDocumentoV2(foreign,c),{code:'DOCUMENTO_V2_AJENO'},field);
    assert.deepEqual(foreign,before);
  }
  assert.throws(()=>validarDocumentoV2({...document,schema:'oferta-pci-orientacion-v1'},c),
    {code:'DOCUMENTO_V2_INCOMPATIBLE'});
});

test('el mapa activo y la selección corresponden a la orientación institucional',()=>{
  const c=context(),source=state();
  source.active='Literatura';
  assert.throws(()=>crearDocumentoV2(source,c),{code:'ESTADO_V2_AJENO'});
  source.active='Comunicación';source.selected.push('Literatura');
  assert.throws(()=>crearDocumentoV2(source,c),{code:'ESTADO_V2_AJENO'});
  source.selected=['Comunicación'];delete source.maps.Comunicación;
  assert.throws(()=>crearDocumentoV2(source,c),{code:'ESTADO_V2_AJENO'});
});

test('Técnica y BA15 conservan identidad propia y todos los datos de gestión',()=>{
  for(const [model,orientation,specialty] of [
    ['tecnica','tecnica_computacion','Computación'],['ba15','comunicacion',null]
  ]){
    const c=context();Object.assign(c.pci,{model,orientation_id:orientation,specialty_name:specialty});
    const source=state(),track=specialty||'Comunicación';
    source.active=track;source.selected=[track];source.maps={[track]:{placements:{},phase2V28:{groups:{}}}};
    const document=crearDocumentoV2(source,c);
    assert.equal(document.model,model);
    assert.deepEqual(validarDocumentoV2(document,c).v2.institutional,source.institutional);
  }
});

test('los sobres anteriores sin metadatos opcionales se validan sin perder otras raíces',()=>{
  const c=context(),document=crearDocumentoV2(state(),c);
  delete document.model;delete document.processId;delete document.legacySha256;
  assert.deepEqual(validarDocumentoV2(document,c).v2,state());
  assert.equal(validarDocumentoV2(document,c).model,'comun');
});

test('el borrador incluye revisión, fecha e identidad y restaura toda la institución',()=>{
  const c=context(),source=state(),before=structuredClone(source),storage=memoryStorage();
  assert.equal(leerBorrador(c,storage),null);
  const saved=guardarBorrador(c,source,{storage,revisionRemota:7});
  assert.equal(saved.revisionRemota,7);
  assert.ok(Number.isFinite(Date.parse(saved.fecha)));
  assert.equal(saved.processId,c.pci.process_id);
  assert.deepEqual(leerBorrador(c,storage),saved);
  assert.deepEqual(source,before);
  saved.v2.institutional.teachers.docente1.name='Otro nombre';
  assert.deepEqual(leerBorrador(c,storage).v2,before);
});

test('dos PCI de la misma orientación en distintos turnos nunca comparten borrador',()=>{
  const first=context(),second=context(),storage=memoryStorage();
  Object.assign(second.pci,{pci_id:UUID2,process_id:'pci-'+UUID2,shift_id:'tarde'});
  const one=state(),two=state();
  one.institutional.teachers.docente1.name='Docente mañana';
  two.institutional.teachers.docente1.name='Docente tarde';
  guardarBorrador(first,one,{storage});guardarBorrador(second,two,{storage});
  assert.notEqual(claveBorrador(first),claveBorrador(second));
  assert.equal(leerBorrador(first,storage).v2.institutional.teachers.docente1.name,'Docente mañana');
  assert.equal(leerBorrador(second,storage).v2.institutional.teachers.docente1.name,'Docente tarde');
  for(const field of ['school','model','orientation','shift','process','source']){
    const changed=context();
    if(field==='school'){changed.school.id=1020;changed.pci.school_id=1020;}
    if(field==='model')changed.pci.model='ba15';
    if(field==='orientation')changed.pci.orientation_id='literatura';
    if(field==='shift')changed.pci.shift_id='noche';
    if(field==='process')changed.pci.process_id='proceso-nuevo';
    if(field==='source')changed.pci.legacy_sha256='b'.repeat(64);
    assert.notEqual(claveBorrador(first),claveBorrador(changed),field);
    assert.equal(leerBorrador(changed,storage),null,field);
  }
});

test('un registro local mal ubicado o ilegible se rechaza y permanece conservado',()=>{
  const c=context(),storage=memoryStorage();
  const record=guardarBorrador(c,state(),{storage});
  record.pciId=UUID2;
  storage.setItem(claveBorrador(c),JSON.stringify(record));
  const foreign=storage.getItem(claveBorrador(c));
  assert.throws(()=>leerBorrador(c,storage),{code:'DOCUMENTO_V2_AJENO'});
  assert.equal(storage.getItem(claveBorrador(c)),foreign);
  storage.setItem(claveBorrador(c),'{incompleto');
  assert.throws(()=>leerBorrador(c,storage),{code:'BORRADOR_INVALIDO'});
  assert.equal(storage.getItem(claveBorrador(c)),'{incompleto');
  assert.throws(()=>guardarBorrador(c,state(),{storage,revisionRemota:-1}),{code:'REVISION_INVALIDA'});
  assert.equal(storage.getItem(claveBorrador(c)),'{incompleto');
});

test('permisos institucionales no convierten school_admin ni perfiles V2 en editores',()=>{
  for(const role of ['admin','editor'])assert.deepEqual(permisosSesion({role}),{puedeEditar:true,puedeDeclarar:true});
  assert.deepEqual(permisosSesion({role:'school_admin'}),{puedeEditar:false,puedeDeclarar:true});
  assert.deepEqual(permisosSesion({role:'user',permissions:['pci.view']}),{puedeEditar:false,puedeDeclarar:false});
  assert.deepEqual(permisosSesion({role:'user',permissions:['pci.edit']}),{puedeEditar:true,puedeDeclarar:true});
  for(const role of ['coordinator','teacher',undefined])
    assert.deepEqual(permisosSesion({role}),{puedeEditar:false,puedeDeclarar:false});
});

test('el cliente no inicia red automáticamente, requiere permisos para guardar V2 y no expone el token',async()=>{
  const {cliente,calls}=mockClient({saved:sessionRecord({role:'admin',permissions:['pci.edit']}),
    verified:{role:'school_admin',permissions:[],school_ids:[],all_schools:false}});
  assert.equal(calls.length,0);
  assert.equal(typeof cliente.guardarUnidad,'function');
  const verified=await cliente.validarSesion();
  assert.equal(verified.role,'school_admin');
  assert.deepEqual(verified.permissions,[]);
  assert.equal(verified.token,undefined);
  assert.equal(verified.school_id,1017);
  verified.role='admin';
  await assert.rejects(()=>cliente.listarPcis(1020),{code:'ESCUELA_NO_AUTORIZADA'});
  assert.equal(calls.length,1);
  assert.equal(calls[0].body.action,'session-info');
  assert.equal(calls[0].url.includes('token-sintetico'),false);
});

test('el guardado remoto V2 exige revisión y confirma la unidad correcta de cada PCI',async()=>{
 const c=context(),original=state(),prior=structuredClone(original);
 const mock=mockClient({handle:body=>{
  if(body.action!=='save-school-pci-unit')return {};
  assert.equal(body.school_id,1017);
  assert.equal(body.pci_id,UUID1);
  assert.equal(body.component,'oferta');
  assert.equal(body.unit_kind,'map');
  assert.equal(body.unit_id,'mapa-original-v2-v1');
  assert.equal(body.base_version,'v2-original-embedded-v1');
  assert.equal(body.expected_revision,3);
  assert.deepEqual(body.document.v2,original);
  assert.equal(body.document.legacySha256,c.pci.legacy_sha256);
  assert.equal(body.document.shiftId,'manana');
  return {ok:true,revision:4};
 }});
 await mock.cliente.validarSesion();
 await assert.rejects(()=>mock.cliente.guardarUnidad(c,original,{expected_revision:-1}),{code:'REVISION_INVALIDA'});
 assert.equal(mock.calls.length,1);
 assert.deepEqual(await mock.cliente.guardarUnidad(c,original,{expected_revision:3}),
  {ok:true,revision:4});
 assert.equal(mock.calls.length,2);
 assert.deepEqual(original,prior,'El guardado no modifica las raíces institucionales ni el mapa');
});
test('un conflicto 409 no se reintenta ni se transforma en guardado exitoso',async()=>{
 const c=context(),mock=mockClient({handle:()=>({status:409,data:{error:'Otra persona modificó el documento.'}})});
 await mock.cliente.validarSesion();
 await assert.rejects(()=>mock.cliente.guardarUnidad(c,state(),{expected_revision:2}),{status:409});
 assert.equal(mock.calls.length,2);
});
test('el guardado remoto V2 requiere permisos de edición y alcance escolar',async()=>{
 const c=context();
 const read=mockClient({verified:{role:'user',permissions:['pci.view'],all_schools:false,school_ids:[1017]}});
 await read.cliente.validarSesion();
 await assert.rejects(()=>read.cliente.guardarUnidad(c,state(),{expected_revision:0}),{code:'SIN_PERMISO'});
 assert.equal(read.calls.length,1);
 const other=context();other.school.id=1055;other.pci.school_id=1055;
 const school=mockClient({verified:{role:'editor',permissions:[],school_ids:[],all_schools:false}});
 await school.cliente.validarSesion();
 await assert.rejects(()=>school.cliente.guardarUnidad(other,state(),{expected_revision:0}),{code:'ESCUELA_NO_AUTORIZADA'});
 assert.equal(school.calls.length,1);
});
test('sesión ausente o rechazada no habilita lecturas ni revela credenciales',async()=>{
  const absent=mockClient({saved:null});
  await assert.rejects(()=>absent.cliente.validarSesion(),{code:'SESION_REQUERIDA',status:401});
  assert.equal(absent.calls.length,0);
  const rejected=crearClienteEscuela({storage:memoryStorage({pci_access_session:JSON.stringify(sessionRecord())}),
    fetchImpl:async()=>new Response(JSON.stringify({error:'Sesión vencida'}),{status:401})});
  await assert.rejects(()=>rejected.validarSesion(),{status:401});
  await assert.rejects(()=>rejected.listarPcis(1017),{code:'SESION_REQUERIDA'});
});

test('las lecturas devuelven escuela y PCI completos y rechazan respuestas de otra escuela',async()=>{
  const c=context(),source=structuredClone(c.pci);
  const good=mockClient({handle:body=>body.action==='list-school-pcis'?{pcis:[source]}:{pci:source}});
  await good.cliente.validarSesion();
  assert.equal((await good.cliente.listarEscuelas())[0].school_id,1017);
  assert.deepEqual(await good.cliente.listarPcis(1017),[source]);
  assert.deepEqual(await good.cliente.obtenerPci(1017,UUID1),source);
  assert.deepEqual(c.pci,source);
  const bad=mockClient({handle:()=>({pci:{...source,school_id:1020}})});
  await bad.cliente.validarSesion();
  await assert.rejects(()=>bad.cliente.obtenerPci(1017,UUID1),{code:'PCI_AJENO'});
});

test('la lectura remota distingue contrato no disponible, permiso y versión incompatible',async()=>{
  for(const [status,message,code] of [
    [400,'Unidad y modalidad incompatibles.','CONTRATO_V2_NO_DISPONIBLE'],
    [404,'Acción no disponible en este servicio.','CONTRATO_V2_NO_DISPONIBLE'],
    [403,'Escuela fuera del alcance autorizado.','API_ESCUELA'],
    [409,'Versión curricular diferente: no se cargó el documento.','API_ESCUELA']
  ]){
    const mock=mockClient({handle:()=>({status,data:{error:message}})});
    await mock.cliente.validarSesion();
    await assert.rejects(()=>mock.cliente.obtenerUnidad(context()),{code,status});
    assert.deepEqual(mock.calls.map(call=>call.body.action),['session-info','get-school-pci-unit']);
  }
});

test('la unidad remota devuelve estado completo y valida identidad antes de restaurar',async()=>{
  const c=context(),document=crearDocumentoV2(state(),c);
  const reply={exists:true,revision:3,base_version:document.schema,document};
  const good=mockClient({handle:()=>reply});await good.cliente.validarSesion();
  assert.deepEqual((await good.cliente.obtenerUnidad(c)).document.v2,state());
  const bad=mockClient({handle:()=>({...reply,document:{...document,shiftId:'tarde'}})});
  await bad.cliente.validarSesion();
  await assert.rejects(()=>bad.cliente.obtenerUnidad(c),{code:'DOCUMENTO_V2_AJENO'});
  const incompatible=mockClient({handle:()=>({...reply,base_version:'oferta-pci-orientacion-v1'})});
  await incompatible.cliente.validarSesion();
  await assert.rejects(()=>incompatible.cliente.obtenerUnidad(c),{code:'DOCUMENTO_V2_INCOMPATIBLE'});
});

test('un usuario de lectura no puede crear PCI ni guardar vínculos',async()=>{
  const mock=mockClient({verified:{role:'user',permissions:['pci.view'],school_ids:[1017],all_schools:false}});
  await mock.cliente.validarSesion();
  await assert.rejects(()=>mock.cliente.crearPci(1017,{}),{code:'SIN_PERMISO'});
  await assert.rejects(()=>mock.cliente.guardarVinculos(1017,{document:links(),expected_revision:0}),{code:'SIN_PERMISO'});
  assert.equal(mock.calls.length,1);
});

test('school_admin conserva el alta explícita y los vínculos existentes con revisión',async()=>{
  const c=context(),doc=links(),before=structuredClone(doc);
  const mock=mockClient({verified:{role:'school_admin',permissions:[],school_ids:[],all_schools:false},
    handle:body=>body.action==='get-school-legacy-links'?{
      exists:true,revision:2,document:doc,rows:[],source_model:'comun',source_updated_at:doc.source_updated_at
    }:body.action==='save-school-legacy-links'?{ok:true,revision:3}:c.pci});
  await mock.cliente.validarSesion();
  assert.deepEqual((await mock.cliente.obtenerVinculos(1017)).document,doc);
  assert.equal(mock.calls.some(call=>call.body.action.startsWith('save-')),false);
  const created=await mock.cliente.crearPci(1017,{model:'comun',orientation_id:'comunicacion',shift_id:'manana',
    title:'Comunicación mañana',school_id:1020,token:'valor-no-autorizado'});
  assert.equal(created.pci_id,UUID1);
  assert.equal(mock.calls.at(-1).body.school_id,1017);
  assert.equal(mock.calls.at(-1).body.token,'token-sintetico-de-prueba');
  assert.deepEqual(await mock.cliente.guardarVinculos(1017,{document:doc,expected_revision:2}),{ok:true,revision:3});
  assert.deepEqual(doc,before);
});

test('los vínculos ajenos y las revisiones sin avance se rechazan',async()=>{
  const doc=links();
  const wrong=mockClient({handle:()=>({exists:true,revision:1,rows:[],document:{...doc,school_id:1020}})});
  await wrong.cliente.validarSesion();
  await assert.rejects(()=>wrong.cliente.obtenerVinculos(1017),{code:'VINCULOS_AJENOS'});
  const unchanged=mockClient({handle:()=>({ok:true,revision:2})});await unchanged.cliente.validarSesion();
  await assert.rejects(()=>unchanged.cliente.guardarVinculos(1017,{document:doc,expected_revision:2}),
    {code:'GUARDADO_NO_CONFIRMADO'});
  const count=unchanged.calls.length;
  await assert.rejects(()=>unchanged.cliente.guardarVinculos(1017,{document:{...doc,school_id:1020},expected_revision:2}),
    {code:'VINCULOS_AJENOS'});
  assert.equal(unchanged.calls.length,count);
});

test('Técnica valida la especialidad canónica del motor sin renombrar la ficha original',()=>{
  for(const storedName of ['Computacion','computacion']){
    const c=context();Object.assign(c.pci,{model:'tecnica',orientation_id:'tecnica_computacion',specialty_name:storedName});
    const before=structuredClone(c),source=state();
    source.active='Computación';source.selected=['Computación'];
    source.maps={'Computación':{placements:{},phase2V28:{groups:{}}}};
    const document=crearDocumentoV2(source,c);
    assert.deepEqual(validarDocumentoV2(document,c).v2,source);
    assert.deepEqual(c,before);
  }
});

test('un PCI con snapshot histórico vacío abre sin inventar áreas ni modificar el original',async()=>{
  const pci=context().pci;pci.legacy_state={};
  const before=structuredClone(pci),mock=mockClient({handle:()=>({pci})});
  await mock.cliente.validarSesion();
  assert.deepEqual(await mock.cliente.obtenerPci(1017,UUID1),before);
  assert.deepEqual(pci,before);
  assert.equal(Object.hasOwn(pci.legacy_state,'areas'),false);
});

test('áreas históricas presentes con tipo inválido no se interpretan como documento vacío',async()=>{
  for(const areas of [[],null,'inválidas']){
    const pci=context().pci;pci.legacy_state.areas=areas;
    const mock=mockClient({handle:()=>({pci})});await mock.cliente.validarSesion();
    await assert.rejects(()=>mock.cliente.obtenerPci(1017,UUID1),{code:'PCI_INVALIDO'});
  }
});
