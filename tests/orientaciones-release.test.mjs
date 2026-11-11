import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newFgUnit,guardFgUnit,newOfferUnit,restoreOfferUnit,newFoUnit,
  guardFoUnit,inventory,editStageDescription
} from '../src/orientaciones-release-core.mjs';

const p={
  pci_id:'11111111-1111-4111-8111-111111111111',
  school_id:1001,orientation_id:'economia_administracion',process_id:'proc-1',
  legacy_sha256:'a'.repeat(64),
  legacy_state:{schemaVersion:10,schoolName:'Ficticia',areas:{
    'Ciencias Sociales':{groups:[{
      id:'G1',name:'Sociales 3º',level:3,startTerm:5,endTerm:5,
      items:['M1'],plansBimestrales:[{
        id:'plan-1',objectives:'Objetivos anteriores',synopsis:'Sinopsis anterior',
        stages:{punto_partida:{description:'Partida anterior'},
          indagacion:{description:'Indagación anterior'},
          produccion:{description:'Producto anterior'},
          evaluacion:{description:'Evaluación anterior'}}
      }]
    }]}
  }}
};
const clone=x=>JSON.parse(JSON.stringify(x));
const workspace={orientations:{economia_administracion:{
  fg:{areas:clone(p.legacy_state.areas)},fo:{
    spaces:[{id:'fo-laboratorio-3-1',year:3,kind:'laboratorio',contentIds:[],members:[]}],
    subjectAlternative:'A'
  }
}}};

test('una FG importada conserva grupos, planes y las cuatro etapas sin tocar el original',()=>{
  const original=clone(p.legacy_state);
  const converted=clone(p.legacy_state.areas);
  converted['Ciencias Sociales'].groups[0].items=['FGV2-1','FGV2-2'];
  converted['Ciencias Sociales'].groups[0].fgV2ContentIds=['FGV2-1','FGV2-2'];
  const unit=newFgUnit({pci:p,area:'Ciencias Sociales',convertedAreas:converted});
  assert.deepEqual(unit.groups[0].items,['FGV2-1','FGV2-2']);
  assert.equal(unit.original_sha256,p.legacy_sha256);
  assert.equal(unit.pci_id,p.pci_id);
  assert.equal(unit.groups[0].plansBimestrales[0].stages.evaluacion.description,'Evaluación anterior');
  unit.groups[0].plansBimestrales[0].stages.evaluacion.description='Modificado en orientación';
  assert.deepEqual(p.legacy_state,original);
  assert.deepEqual(guardFgUnit(unit,p,'Ciencias Sociales'),unit);
});
test('la FG no puede importar una pérdida de planes',()=>{
  const converted=clone(p.legacy_state.areas);
  converted['Ciencias Sociales'].groups[0].plansBimestrales=[];
  assert.throws(()=>newFgUnit({pci:p,area:'Ciencias Sociales',convertedAreas:converted}),/planes/);
});
test('la FG no puede importar etapas alteradas ni IDs de agrupamiento cambiados',()=>{
  const a=clone(p.legacy_state.areas);
  a['Ciencias Sociales'].groups[0].plansBimestrales[0].stages.evaluacion.description='';
  assert.throws(()=>newFgUnit({pci:p,area:'Ciencias Sociales',convertedAreas:a}),/etapa/);
  const b=clone(p.legacy_state.areas);
  b['Ciencias Sociales'].groups[0].id='nuevo';
  assert.throws(()=>newFgUnit({pci:p,area:'Ciencias Sociales',convertedAreas:b}),/agrupamientos/);
});
test('el mapa FO no reemplaza la FG original ni otra orientación',()=>{
  const document=newOfferUnit({pci:p,workspace});
  const original=clone(workspace);
  document.fo.spaces[0].name='Laboratorio de Economía';
  const restored=restoreOfferUnit({pci:p,workspace,document});
  assert.equal(restored.orientations.economia_administracion.fo.spaces[0].name,'Laboratorio de Economía');
  assert.deepEqual(workspace,original);
  assert.deepEqual(restored.orientations.economia_administracion.fg,original.orientations.economia_administracion.fg);
});
test('un PCI ajeno no puede acceder al área, mapa ni plan de la orientación',()=>{
  const unit=newFgUnit({pci:p,area:'Ciencias Sociales',convertedAreas:p.legacy_state.areas});
  const other={...p,pci_id:'22222222-2222-4222-8222-222222222222'};
  assert.throws(()=>guardFgUnit(unit,other,'Ciencias Sociales'),/no pertenece/);
  const map=newOfferUnit({pci:p,workspace});
  assert.throws(()=>restoreOfferUnit({pci:other,workspace,document:map}),/otra escuela/);
});
test('los planes FO son cuatro y se rechazan documentos cruzados',()=>{
  const space={id:'fo-laboratorio-3-1'};
  const development={slot:space.id,orientation:p.orientation_id,format:'laboratorio',year:3,
    plansBimestrales:[1,2,3,4].map(n=>({number:n,stages:{}}))};
  const unit=newFoUnit({pci:p,space,development});
  assert.equal(unit.plansBimestrales.length,4);
  assert.deepEqual(guardFoUnit(unit,p,space.id),unit);
  assert.throws(()=>guardFoUnit(unit,p,'fo-taller-3-1'),/no pertenece/);
  assert.throws(()=>newFoUnit({pci:p,space,development:{...development,plansBimestrales:[]}}),/cuatro planes/);
});
test('la función de edición no elimina campos de etapas existentes',()=>{
  const plan=clone(p.legacy_state.areas['Ciencias Sociales'].groups[0].plansBimestrales[0]);
  plan.stages.evaluacion.resources='Carpeta';
  const edited=editStageDescription(plan,'evaluacion','Texto revisado');
  assert.equal(edited.stages.evaluacion.resources,'Carpeta');
  assert.equal(plan.stages.evaluacion.description,'Evaluación anterior');
});
test('el inventario distingue áreas, agrupamientos, planes y contenidos',()=>{
  assert.deepEqual(inventory(p.legacy_state),{areas:1,groups:1,plans:1,contents:1});
});

test('una escuela nueva sin contenido histórico puede iniciar FG V2 propia',()=>{
  const blank={...p,legacy_state:{schoolName:'Escuela nueva',areas:{},current:null}};
  const template={ 'Ciencias Sociales': {groups:[{
    id:'nuevo-G1',name:'Nuevo laboratorio',level:1,startTerm:1,items:[],plansBimestrales:[]
  }]}};
  const before=clone(blank.legacy_state);
  const unit=newFgUnit({pci:blank,area:'Ciencias Sociales',convertedAreas:template});
  assert.equal(unit.originType,'empty-institution-template');
  assert.equal(unit.groups.length,1);
  assert.equal(unit.original_sha256,blank.legacy_sha256);
  assert.deepEqual(blank.legacy_state,before);
  assert.throws(()=>newFgUnit({pci:p,area:'Matemática',convertedAreas:template}),/no pertenece/);
});
