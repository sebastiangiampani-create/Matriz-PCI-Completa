import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  auditarCierreMedia,cambiarArticulacionPvf,resguardarNaturalesQuinto,
  MEDIA_NATURALES_QUINTO,MEDIA_FO_QUINTO,MEDIA_ARTICULACION_VERSION
} from '../src/aplicacion-v2/media-cierre.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const horasReales=JSON.parse(read('vendor/pci-sec-aprende-v2/data/horas-v2.json'));
const F=(name,id,year=5)=>({id,origin:'FO',year,name});
const eco=[
  F('Economía','fo-economia-5-0'),F('Contabilidad Patrimonial y de Gestión','fo-contabilidad-5-1'),
  F('Derecho','fo-derecho-5-2'),F('Historia (orientada)','fo-historia-5-3'),
  F('Tecnologías de la Información (orientada)','fo-tecnologias-5-4'),
  F('Proyecto Organizacional','fo-economia-pvf')
];
const nat=[
  F('Partículas, energía y cosmología','fo-nat-p'),F('Radiación y vida','fo-nat-r'),
  F('Química, alimentación y salud','fo-nat-q'),
  F('Historia (orientada)','fo-nat-h'),
  F('Tecnologías de la Información (orientada)','fo-nat-t'),
  F('Problemáticas científicas con impacto social','fo-nat-pvf')
];
const group=(origin='histórico')=>({
  name:origin,objectives:'No eliminar',contents:['contenido-uno'],
  plansBimestrales:[1,2,3,4].map(number=>({
    number,name:'Bimestre '+number,objectives:'Objetivo propio',
    contentIds:['contenido-uno'],stages:{produccion:{activities:'Investigación escolar'}}
  }))
});
function map(placements={},extra={}) {
  return {alt:'A',valid:true,placements:{...placements},phase2V28:{groups:{'proyecto-n5':group('PVF')}},...extra};
}
function inputEco(extraMap) {
  return {mapa:extraMap,orientacionId:'economia_administracion',
    orientacion:'Economía y Administración',materias:eco,catalogoHoras:horasReales};
}
function freeze(value) {
  if(value && typeof value==='object') {
    for(const child of Object.values(value))freeze(child);
    Object.freeze(value);
  }return value;
}
test('Ciencias Naturales tiene exactamente ocho laboratorios FG C1-C8 y celdas no disponibles en C9/C10',()=>{
  assert.deepEqual(MEDIA_NATURALES_QUINTO,['naturales-c9','naturales-c10']);
  const generator=read('scripts/derivar-v2-familia.mjs');
  const generated=read('src/v2-familia/derivados/media/v23-prearm.js');
  assert.match(generator,/if\(state.active!==['"]Ciencias Naturales['"]\)placePaired\(5,'Química','naturales'\)/);
  assert.match(generated,/if\(state.active!==['"]Ciencias Naturales['"]\)placePaired\(5,'Química','naturales'\)/);
  const derivadoFG=read('src/v2-familia/derivados/media/v47-phase2-matrix.js');
  assert.match(derivadoFG,/if\(state.active==='Ciencias Naturales'\)FG=FG\.filter/);
  assert.match(generator,/if\(state.active==='Ciencias Naturales'\)FG=FG\.filter/);
  const runtime=read('src/aplicacion-v2/media-cierre-runtime.js');
  assert.match(runtime,/t<=8/);assert.match(runtime,/MEDIA_NATURALES_QUINTO\.includes\(slot\)/);
});
test('FO de quinto exige dos materias por espacio y detecta horas pendientes',()=>{
  const source=map({});
  const result=auditarCierreMedia(source,inputEco(source));
  assert.equal(result.valido,false);
  assert.equal(result.errores.filter(x=>x.codigo==='MEDIA_FO_MINIMO').length,4);
  assert.equal(result.detalle.length,4);
  assert.ok(result.detalle.some(x=>x.slot==='foLab5-c9'));
  assert.ok(result.detalle.some(x=>x.slot==='foTaller5-c10'));
});
test('registra horas conocidas y no duplica la hora del Proyecto en FO',()=>{
  const placements={
    'proyecto-n5':['fo-economia-pvf'],
    'foLab5-c9':['fo-economia-5-0','fo-contabilidad-5-1'],
    'foTaller5-c9':['fo-derecho-5-2','fo-historia-5-3'],
    'foLab5-c10':['fo-economia-5-0','fo-contabilidad-5-1'],
    'foTaller5-c10':['fo-derecho-5-2','fo-tecnologias-5-4']
  };
  const data=inputEco(map(placements));
  const actual=auditarCierreMedia(data.mapa,data);
  assert.equal(actual.valido,true,JSON.stringify(actual));
  assert.equal(actual.detalle.find(x=>x.slot==='foLab5-c9').hcConocidas,6);
  assert.equal(actual.detalle.find(x=>x.slot==='foTaller5-c9').hcConocidas,5);
  assert.equal(actual.detalle.find(x=>x.slot==='foTaller5-c10').hcConocidas,5);
  assert.equal(actual.errores.length,0);
});
test('la misma materia en dos espacios de un mismo cuatrimestre se rechaza',()=>{
  const placements={'proyecto-n5':['fo-economia-pvf'],
    'foLab5-c9':['fo-economia-5-0','fo-contabilidad-5-1'],
    'foTaller5-c9':['fo-economia-5-0','fo-historia-5-3']};
  const actual=auditarCierreMedia(inputEco(map(placements)).mapa,inputEco(map(placements)));
  assert.ok(actual.errores.some(e=>e.codigo==='MEDIA_FO_DUPLICADA'));
});
test('la materia prescripta PVF no se reasigna en un laboratorio FO; una articulación no la mueve',()=>{
  const placements={'proyecto-n5':['fo-economia-pvf'],
    'foLab5-c9':['fo-economia-pvf','fo-contabilidad-5-1']};
  const source=map(placements),before=structuredClone(source);
  const audit=auditarCierreMedia(source,inputEco(source));
  assert.ok(audit.errores.some(e=>e.codigo==='MEDIA_PVF_DUPLICADO'));
  const updated=cambiarArticulacionPvf(source,'foLab5-c9',true);
  assert.deepEqual(updated.placements,source.placements);
  assert.deepEqual(updated.phase2V28,source.phase2V28);
  assert.deepEqual(updated.pvfArticulaciones,{version:MEDIA_ARTICULACION_VERSION,espacios:['foLab5-c9']});
  assert.deepEqual(source,before);
  const undone=cambiarArticulacionPvf(updated,'foLab5-c9',false);
  assert.deepEqual(undone.pvfArticulaciones.espacios,[]);
});
test('máximo 9 HC para Media no Naturales; Naturales quinto puede superar el máximo',()=>{
  const s=[
    F('Química, alimentación y salud','fo-nat-q'),
    F('Radiación y vida','fo-nat-r'),
    F('Partículas, energía y cosmología','fo-nat-p'),
    F('Historia (orientada)','fo-nat-h'),
    F('Tecnologías de la Información (orientada)','fo-nat-t'),
    F('Problemáticas científicas con impacto social','fo-nat-pvf')
  ];
  const p={'foLab5-c9':['fo-nat-p','fo-nat-r','fo-nat-q'],
    'foTaller5-c9':['fo-nat-h','fo-nat-t'],
    'foLab5-c10':['fo-nat-p','fo-nat-r','fo-nat-q'],
    'foTaller5-c10':['fo-nat-h','fo-nat-t'],
    'proyecto-n5':['fo-nat-pvf']};
  const naturales=auditarCierreMedia(map(p),{
    orientacionId:'ciencias_naturales',orientacion:'Ciencias Naturales',
    materias:s,catalogoHoras:horasReales});
  assert.equal(naturales.valido,true,JSON.stringify(naturales));
  assert.equal(naturales.detalle.find(x=>x.slot==='foLab5-c9').hcConocidas,12);
  assert.equal(naturales.detalle.find(x=>x.slot==='foLab5-c9').excepcionMasDe9,true);
  const other=auditarCierreMedia(map(p),{
    orientacionId:'otra',orientacion:'Ciencias Naturales',materias:s,catalogoHoras:horasReales});
  assert.ok(other.errores.some(x=>x.codigo==='MEDIA_FO_MAX_9'));
});
test('sin base oficial de horas no permite afirmar validación completa',()=>{
  const source=map({'foLab5-c9':['fo-economia-5-0','fo-contabilidad-5-1'],
    'foTaller5-c9':['fo-derecho-5-2','fo-historia-5-3'],
    'foLab5-c10':['fo-economia-5-0','fo-contabilidad-5-1'],
    'foTaller5-c10':['fo-derecho-5-2','fo-historia-5-3']});
  const audit=auditarCierreMedia(source,{...inputEco(source),catalogoHoras:null});
  assert.equal(audit.valido,false);
  assert.ok(audit.pendientes.length>=4);
});
test('detecta y resguarda trabajo de Naturales quinto sin eliminar planes ni datos históricos',()=>{
  const source=freeze(map({'naturales-c9':['fg-5-quimica'],
    'naturales-c10':['fg-5-quimica'],'proyecto-n5':['fo-nat-pvf']},{
    phase2V28:{groups:{'naturales-c9':group(),'naturales-c10':group(),
      'proyecto-n5':group('PVF')},
      customContents:[{id:'institucional-1',groupId:'naturales-c9',text:'Contenido propio'},
        {id:'otro',groupId:'foLab5-c9',text:'Otro'}]},
    phase2:{'naturales-c10':{texto:'Histórico'}},
    profesores:{a:['docente']}
  }));
  const original=structuredClone(source);
  const audit=auditarCierreMedia(source,{orientacionId:'ciencias_naturales',materias:nat});
  assert.ok(audit.errores.some(x=>x.codigo==='MEDIA_NATURALES_5_HISTORICO'));
  const result=resguardarNaturalesQuinto(source,{
    orientacionId:'ciencias_naturales',fecha:'2026-11-21T23:10:00Z'
  });
  assert.equal(result.cambio,true);
  assert.equal(result.mapa.placements['naturales-c9'],undefined);
  assert.equal(result.mapa.phase2V28.groups['naturales-c9'],undefined);
  assert.deepEqual(result.resguardo.ubicaciones['naturales-c9'],['fg-5-quimica']);
  assert.deepEqual(result.resguardo.grupos['naturales-c9'],original.phase2V28.groups['naturales-c9']);
  assert.deepEqual(result.resguardo.fase2['naturales-c10'],original.phase2['naturales-c10']);
  assert.equal(result.resguardo.contenidosPropios.length,1);
  assert.deepEqual(result.mapa.phase2V28.groups['proyecto-n5'],original.phase2V28.groups['proyecto-n5']);
  assert.deepEqual(result.mapa.profesores,original.profesores);
  assert.deepEqual(source,original);
  assert.equal(resguardarNaturalesQuinto(result.mapa,{
    orientacionId:'ciencias_naturales',fecha:'2026-11-21T23:10:00Z'}).cambio,false);
  assert.throws(()=>resguardarNaturalesQuinto(source,{
    orientacionId:'economia_administracion',fecha:'2026-11-21T23:10:00Z'
  }),TypeError);
});
test('articulaciones guardan metadata reversible y preservan los cuatro planes bimestrales',()=>{
  const p=map({'foLab5-c9':['fo-economia-5-0','fo-contabilidad-5-1'],
    'foTaller5-c9':['fo-derecho-5-2','fo-historia-5-3']});
  const source=freeze(p),previo=structuredClone(p);
  const updated=cambiarArticulacionPvf(source,'foLab5-c9',true);
  const again=cambiarArticulacionPvf(updated,'foTaller5-c9',true);
  assert.deepEqual(again.phase2V28,previo.phase2V28);
  assert.equal(again.phase2V28.groups['proyecto-n5'].plansBimestrales.length,4);
  assert.deepEqual(again.pvfArticulaciones.espacios,['foLab5-c9','foTaller5-c9']);
  assert.throws(()=>cambiarArticulacionPvf(source,'naturales-c9',true),TypeError);
  assert.deepEqual(source,previo);
  assert.equal(MEDIA_FO_QUINTO.length,4);
});
