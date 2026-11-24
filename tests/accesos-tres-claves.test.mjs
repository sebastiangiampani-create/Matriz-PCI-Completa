/**
 * Contrato de acceso para las TRES puertas del PCI.
 * Las credenciales son fixtures sintéticas; no se leen ni modifican claves
 * reales de escuelas o cuentas de la plataforma.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {permisosSesion} from '../src/aplicacion-v2/datos-escuela.mjs';

const read=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const edge=await read('supabase/functions/pci-multipci/index.ts');
const first=edge.indexOf('function canRead(s){');
const last=edge.indexOf('function actor(s){',first);
assert.ok(first>=0&&last>first,'La política de roles debe existir en la función Edge.');
const {canRead,canEdit,canDeclareOrientations}=vm.runInNewContext(
 edge.slice(first,last)+'\n({canRead,canEdit,canDeclareOrientations})'
);
const principals=[
 ['Administrador',{role:'admin'},[true,true,true]],
 ['Clave PCI',{role:'editor',school_id:1017},[true,true,false]],
 ['Clave DIR',{role:'school_admin',school_id:1017},[true,false,true]],
 ['Usuario editor curricular',{role:'user',school_ids:[1017],permissions:['pci.edit','pci.view']},[true,true,false]],
 ['Referente institucional',{role:'user',school_ids:[1017],permissions:['institutional.view','pci.view','keys.manage']},[true,false,true]],
 ['Auditor',{role:'user',school_ids:[1017],permissions:['institutional.view','pci.view']},[true,false,false]],
 ['Usuario sin permisos',{role:'user',permissions:[]},[false,false,false]]
];

test('la autorización remota distingue consultar, editar y gestionar oferta institucional',()=>{
 for(const [name,session,expected] of principals){
  const result=[canRead(session),canEdit(session),canDeclareOrientations(session)];
  assert.deepEqual(result,expected,name);
 }
});

test('el cliente y el servidor coinciden en quién puede editar y gestionar oferta',()=>{
 for(const [name,session,expected] of principals){
  const p=permisosSesion(session);
  assert.equal(p.puedeEditar,expected[1],name+' edición');
  assert.equal(p.puedeDeclarar,expected[2],name+' oferta');
 }
});

test('los endpoints de alta y de vínculos institucionales verifican permiso DIR en el servidor',()=>{
 for(const action of ["create-school-pci","save-school-legacy-links"]){
  const index=edge.indexOf("if(action==='"+action+"')");
  assert.ok(index>0,action+' no existe');
  assert.ok(edge.slice(index,index+200).includes('if(!canDeclareOrientations(s))'),
   action+' debe denegar la clave PCI, incluso invocando la API directamente.');
 }
 assert.ok(edge.includes("const p=await authorizedPci(s,body,saving)"),
  'El guardado curricular debe exigir autorización por PCI y estado de edición.');
 assert.ok(edge.includes('if(!validSchool(sid)||!validUuid(pci_id)||!isScoped(s,sid)'),
  'La lectura y edición deben limitarse a la escuela autorizada.');
});

test('DIR y PCI abren pantallas diferentes; el panel DIR consulta solo su escuela',async()=>{
 const [portal,dir,front]=await Promise.all([
  read('index.html'),read('panel-escuela.html'),read('src/orientaciones-online.mjs')
 ]);
 assert.match(portal,/Constructor curricular · clave PCI/);
 assert.match(portal,/href="panel-escuela.html">Panel institucional · DIR/);
 assert.match(portal,/href="panel-general.html">Administración general/);
 assert.match(dir,/action:'school-admin-login'/);
 assert.match(dir,/action:'get-school-dashboard'/);
 assert.match(dir,/action:'list-school-pcis'/);
 assert.match(dir,/token:session.token,school_id:sid/);
 assert.match(dir,/id="pciPortfolioBody"/);
 assert.match(dir,/No se pudo cargar el listado de PCI/);
 assert.match(front,/function canDeclareOrientations/);
 assert.match(front,/session\?\.role==='school_admin'/);
 assert.match(front,/if\(!canDeclareOrientations\(\)\)/);
 assert.match(front,/disabled=!canDeclareOrientations\(\)/);
});

test('la clave PCI jamás recibe enlaces administrativos en la navegación curricular',async()=>{
 const source=await read('src/orientaciones-online.mjs');
 assert.ok(source.includes("$('adminPanelLink').hidden=!admin"));
 assert.ok(source.includes("$('schoolPanelLink').hidden=!(admin||role==='school_admin')"));
 const client=await read('src/aplicacion-v2/datos-escuela.mjs');
 assert.ok(client.includes('if(!permisosSesion(session).puedeDeclarar)'),
  'El alta institucional debe bloquearse también en el cliente.');
});
