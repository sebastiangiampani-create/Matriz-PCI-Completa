import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../supabase/functions/pci-multipci/index.ts',import.meta.url),'utf8');
const start=source.indexOf('function allowedUnit(p,body){');
const next=source.indexOf('function documentIsScoped(p,body){',start);
const end=source.indexOf('/**\n * Asignación de trabajo histórico',next);
assert.ok(start>0&&next>start&&end>next,'La función Edge conserva el contrato de autorización y documento.');
const checked=source.slice(start,end);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const server=vm.runInNewContext(checked+'\n({allowedUnit,documentIsScoped})',{object});
const uuid='00000000-0000-4000-8000-000000000001';
const sha='a'.repeat(64);
const pci=model=>({
 model,school_id:1017,pci_id:uuid,orientation_id:model==='tecnica'?'tecnica_computacion':'comunicacion',
 shift_id:'manana',process_id:'pci-'+uuid,legacy_sha256:sha
});
const contract=model=>({
 component:'oferta',unit_kind:'map',
 unit_id:model==='comun'?'mapa-original-v2-v1':'mapa-v2-familia-'+model+'-v1',
 base_version:model==='comun'?'v2-original-embedded-v1':'v2-familia-'+model+'-20261120/1'
});
const doc=(p,body)=>({
 schema:body.base_version,schoolId:p.school_id,pciId:p.pci_id,
 orientationId:p.orientation_id,shiftId:p.shift_id,model:p.model,
 processId:p.process_id,legacySha256:p.legacy_sha256,
 v2:{active:'Comunicación',selected:['Comunicación'],maps:{Comunicación:{placements:{}}},
  institutional:{teachers:{},assignments:{}},otraRaiz:{version:2}}
});

test('el contrato V2 autoriza sólo la unidad explícita por modalidad',()=>{
 for(const model of ['comun','tecnica','ba15']){
  const p=pci(model),body=contract(model);
  assert.equal(server.allowedUnit(p,body),true,model);
  for(const changed of ['base_version','unit_id','unit_kind','component']){
   const altered={...body,[changed]:'incompatible'};
   assert.equal(server.allowedUnit(p,altered),false,model+' debe rechazar '+changed);
  }
 }
});
test('los contratos V1 históricos continúan permitidos, sin ampliar escritura indiscriminada',()=>{
 assert.equal(server.allowedUnit(pci('comun'),{component:'oferta',unit_kind:'map',
  unit_id:'mapa-v1',base_version:'oferta-pci-orientacion-v1'}),true);
 assert.equal(server.allowedUnit(pci('tecnica'),{component:'fo',unit_kind:'space',
  unit_id:'espacio-v1',base_version:'fo-tecnica-v1'}),true);
 assert.equal(server.allowedUnit(pci('ba15'),{component:'oferta',unit_kind:'map',
  unit_id:'oferta',base_version:'oferta-ba15-constructor-v1'}),true);
});
test('el documento remoto V2 exige coincidencia de escuela, PCI, turno, modelo y procedencia',()=>{
 for(const model of ['comun','tecnica','ba15']){
  const p=pci(model),body=contract(model),d=doc(p,body);
  assert.equal(server.documentIsScoped(p,{...body,document:d}),true);
  const withLegacyMaps=structuredClone(d);
  withLegacyMaps.v2.maps.Literatura={placements:{},plans:{}};
  assert.equal(server.documentIsScoped(p,{...body,document:withLegacyMaps}),true,
   'No eliminar mapas heredados del snapshot');
  for(const key of ['schoolId','pciId','orientationId','shiftId','model','processId','legacySha256']){
   const altered={...d,[key]:'ajeno'};
   assert.equal(server.documentIsScoped(p,{...body,document:altered}),false,model+': '+key);
  }
  assert.equal(server.documentIsScoped(p,{...body,document:{...d,v2:{...d.v2,selected:['Otras']}}}),false);
  assert.equal(server.documentIsScoped(p,{...body,document:{...d,v2:{...d.v2,maps:{}}}}),false);
 }
});
test('la ruta de escritura conserva autorización institucional, cierre y control de revisión',()=>{
 for(const snippet of [
  "const s=await verifySessionToken(body.token)",
  "authorizedPci(s,body,saving)",
  "if(!['borrador','en_revision'].includes(p.status))",
  "if(!documentIsScoped(p,body))",
  "const expected=Number(body.expected_revision)",
  "pci_collab_save_unit_v1",
  "result?.code==='stale_revision'"
 ])assert.ok(source.includes(snippet),'Regla de seguridad eliminada: '+snippet);
 assert.equal(source.includes("pci_proposals').update("),false,'El motor no modifica propuestas históricas.');
});
