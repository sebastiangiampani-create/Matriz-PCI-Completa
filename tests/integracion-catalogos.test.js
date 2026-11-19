import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  loadMatrixContents,loadV2Fg,loadV2Fo,loadV2Rules,
  selectFoByOrientation,matchMatrixToV2Fg,fgCoverageByLevel,
  fgCatalogPlacementSummary,foTrajectoryCoverage
} from '../src/integracion-curricular/catalogos.js';
import {ORIENTATIONS} from '../src/integracion-curricular/bridge.js';

const fetchFn=async url=>{
  try{
    const data=await readFile(url,'utf8');
    return {ok:true,text:async()=>data};
  }catch{return {ok:false,text:async()=>''};}
};
test('carga catálogos completos de Matriz, FG V2 (1126) y FO V2 (860)',async()=>{
  const [matrix,fg,fo]=await Promise.all([
    loadMatrixContents({fetchFn}),
    loadV2Fg({fetchFn}),
    loadV2Fo({fetchFn})
  ]);
  assert.ok(matrix.length>100);
  assert.equal(fg.length,1126);
  assert.equal(fo.length,860);
  assert.equal(new Set(fo.map(r=>r.id)).size,fo.length);
  assert.ok(matrix.every(x=>typeof x.id==='string'&&typeof x.subject==='string'));
  assert.ok(fg.every(x=>x.year>=1&&x.year<=5));
  assert.ok(fo.every(x=>x.level===null&&x.levelBasis==='trayectoria'));
});
test('catálogo de prescripciones incluye composición, horas y orientaciones',async()=>{
  const refs=await loadV2Rules({fetchFn});
  assert.equal(refs.rules.formacion_orientada.laboratorios.cantidad,4);
  assert.equal(refs.rules.formacion_orientada.talleres.cantidad,4);
  assert.equal(refs.rules.laboratorios.max_horas_catedra,9);
  assert.ok(refs.subjects.formacion_general['3'].includes('Economía'));
  assert.equal(refs.hours.formacion_general['3']['Economía'],3);
});
test('FO Arte usa solo contenidos de su variante sin inventar niveles',async()=>{
  const fo=await loadV2Fo({fetchFn});
  const visuales=selectFoByOrientation(fo,'arte_artes_visuales',ORIENTATIONS);
  const musica=selectFoByOrientation(fo,'arte_musica',ORIENTATIONS);
  const teatro=selectFoByOrientation(fo,'arte_teatro',ORIENTATIONS);
  assert.ok(visuales.length>0);
  assert.ok(musica.length>0);
  assert.ok(teatro.length>0);
  assert.ok(visuales.every(x=>x.variant==='artes_visuales'));
  assert.ok(musica.every(x=>x.variant==='musica'));
  assert.ok(teatro.every(x=>x.variant==='teatro'));
  const coverage=foTrajectoryCoverage({
    rows:fo,spaces:[],orientationId:'arte_musica',orientations:ORIENTATIONS
  });
  assert.equal(coverage.basis,'trayectoria');
  assert.equal(coverage.total,musica.length);
  assert.equal(coverage.used,0);
});
test('FO seguimiento por bloques usa únicos y evita duplicar el mismo contenido',async()=>{
  const fo=await loadV2Fo({fetchFn});
  const economia=selectFoByOrientation(fo,'economia_administracion',ORIENTATIONS);
  assert.ok(economia.length>0);
  const first=economia[0],second=economia.at(-1);
  const result=foTrajectoryCoverage({
    rows:fo,orientationId:'economia_administracion',orientations:ORIENTATIONS,
    spaces:[{contentIds:[first.id,second.id]},{contentIds:[first.id]}]
  });
  assert.equal(result.used,first.id===second.id?1:2);
  assert.equal(result.total,economia.length);
  assert.equal(result.byBlock.reduce((n,x)=>n+x.used,0),result.used);
  assert.equal(result.unknownIds.length,0);
});
test('homologación FG no inventa niveles ni suma IDs incompatibles',()=>{
  const fg=[
    {id:'v2-e3',year:3,area:'Ciencias Sociales',subject:'Economía',text:'Los mercados'},
    {id:'v2-e4',year:4,area:'Ciencias Sociales',subject:'Economía',text:'Los mercados'},
    {id:'v2-h3',year:3,area:'Ciencias Sociales',subject:'Historia',text:'La industria'}
  ];
  const matrix=[
    {id:'m1',area:'Ciencias Sociales',subject:'Economía',text:'Los mercados'},
    {id:'m2',area:'Ciencias Sociales',subject:'Historia',text:'La industria'},
    {id:'m3',area:'Ciencias Sociales',subject:'Economía',text:'Texto antiguo sin equivalencia'}
  ];
  const matched=matchMatrixToV2Fg({matrixRows:matrix,v2FgRows:fg,contentId:'m1',level:3,area:'Ciencias Sociales'});
  assert.equal(matched.status,'matched');
  assert.equal(matched.referenceId,'v2-e3');
  assert.equal(matchMatrixToV2Fg({matrixRows:matrix,v2FgRows:fg,contentId:'m3',level:3,area:'Ciencias Sociales'}).status,'unresolved');
  const areas={'Ciencias Sociales':{groups:[
    {level:3,items:['m1','m2','m1','m3']},
    {level:3,items:['m2']},
    {level:4,items:['m1']}
  ]}};
  const c=fgCoverageByLevel({areas,matrixRows:matrix,v2FgRows:fg,area:'Ciencias Sociales',level:3});
  assert.equal(c.locatedLegacyContents,3);
  assert.equal(c.mappedUniqueContents,2);
  assert.equal(c.prescribedTotal,2);
  assert.equal(c.coverageStatus,'partial-homologation');
  assert.equal(c.unmatched.length,1);
  const totals=fgCatalogPlacementSummary({areas,matrixRows:matrix,area:'Ciencias Sociales'});
  assert.equal(totals.assignedUnique,3);
  assert.equal(totals.total,3);
  assert.match(totals.basis,/no por nivel/);
});
