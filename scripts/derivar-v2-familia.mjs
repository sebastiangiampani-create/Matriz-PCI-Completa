#!/usr/bin/env node
/**
 * Generador de la familia V2 por modalidad.
 *
 * Reproduce, módulo por módulo, la secuencia de carga de PCI Secundaria
 * Aprende V2 (vendor/pci-sec-aprende-v2/app.html) para Educación Técnica y
 * Secundaria BA +15.
 *
 * Reglas:
 *  - El código original se lee desde vendor/ y NUNCA se modifica.
 *  - Cada módulo queda en uno de cuatro estados:
 *      original           → se carga el archivo de vendor sin cambios.
 *      derivado           → copia generada aquí con reemplazos exactos y
 *                           declarados (niveles, cuatrimestres, áreas).
 *      derivado-previo    → adaptación ya existente en src/v2-familia.
 *      pendiente-normativa→ regla curricular propia de Media; no se copia a
 *                           otra modalidad hasta contar con su normativa.
 *  - Cada reemplazo declara cuántas veces debe aparecer en el original. Si
 *    el original cambia y el texto no coincide, el generador falla.
 *
 * Uso:
 *   node scripts/derivar-v2-familia.mjs           # genera los archivos
 *   node scripts/derivar-v2-familia.mjs --check   # verifica que estén al día
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const VENDOR='vendor/pci-sec-aprende-v2';
const OUT='src/v2-familia/derivados';
const MANIFEST='src/v2-familia/manifiesto-paridad-v2.json';

/** Estructura curricular de cada modalidad derivada. */
export const PERFILES={
  tecnica:{nombre:'Educación Técnica',niveles:6,cuatrimestres:12},
  ba15:{nombre:'Secundaria BA +15',niveles:4,cuatrimestres:8}
};

const lista=n=>'['+Array.from({length:n},(_,i)=>i+1).join(',')+']';
const conteos=n=>'{'+Array.from({length:n},(_,i)=>`${i+1}:1`).join(',')+'}';
const AREAS_MEDIA="['Lengua y Literatura','Matemática','Lenguas Adicionales','Ciencias Naturales','Ciencias Sociales','Artes','Tecnologías','Educación Física','Formación Orientada']";
// Áreas tomadas de las filas del mapa de la modalidad (V2ModalMap.rowDefs).
const AREAS_MODALIDAD="(window.V2ModalMap?[...new Set(window.V2ModalMap.rowDefs().map(r=>r.area).filter(Boolean))]:"+AREAS_MEDIA+")";
const ACCESO_ESCOLAR_V85=[{
  de:"(() => {\n  const KEY='pci-v85-access-session';",veces:1,
  a:`(() => {
  // La aplicación integrada ya verificó la sesión escolar. V85 no ofrece
  // perfiles simulados ni cambia sus permisos; V80 recibe esa sesión.
  if(window.__PCI_ESCUELA_VERIFICADA__===true){
    window.PCIAccessPanelV85=Object.freeze({
      show:()=>false,applyProfile:()=>false,clear:()=>false,
      teachers:()=>Object.values(state.institutional?.teachers||{})
    });
    return;
  }
  const KEY='pci-v85-access-session';`,
  motivo:'Usar la sesión escolar verificada de la aplicación integrada sin mostrar ni persistir perfiles de prueba; conservar V85 habitual fuera de esa aplicación.'
}];
const NAVEGACION_ESCOLAR=[{
  de:"    if(offer)offer.hidden=management;\n    if(proposal)proposal.hidden=management;\n    if(institutional)institutional.hidden=curricular;",veces:1,
  a:`    const schoolApp=window.__PCI_ESCUELA_VERIFICADA__===true;
    if(offer)offer.hidden=schoolApp?false:management;
    if(proposal)proposal.hidden=schoolApp?false:management;
    if(institutional)institutional.hidden=schoolApp
      ? !window.PCIAplicacionV2?.contexto.permissions.puedeEditar : curricular;`,
  motivo:'Mantener accesibles Oferta, Desarrollo y Gestión en la misma navegación de la aplicación escolar; Gestión requiere el permiso escolar de edición.'
}];

/**
 * Reemplazos por módulo. `de` debe aparecer exactamente `veces` veces.
 * `a` puede ser una función del perfil.
 */
const DERIVADOS={
  'ui-navigation-consistency':NAVEGACION_ESCOLAR,
  'v26-other-formats-print':[
    {de:'[1,2,3,4,5].map(printLevel)',a:p=>lista(p.niveles)+'.map(printLevel)',veces:1,
      motivo:'Imprimir todos los niveles de la modalidad.'},
    {de:'<span class="pci-print-badge">Sociales: ${esc(social)}</span>',a:'',veces:1,
      motivo:'La opción de laboratorios de Sociales (10/12) es una regla de Media.'}
  ],
  'v31-integration-hours-print':[
    {de:'Se imprime la matriz visual C1–C10 tal como está construida.',a:p=>`Se imprime la matriz visual C1–C${p.cuatrimestres} tal como está construida.`,veces:1,
      motivo:'Rango de cuatrimestres de la modalidad.'},
    {de:'<p>Nivel 1 a Nivel 5 · C1 a C10</p>',a:p=>`<p>Nivel 1 a Nivel ${p.niveles} · C1 a C${p.cuatrimestres}</p>`,veces:1,
      motivo:'Rango de niveles y cuatrimestres de la modalidad.'},
    {de:"rule.innerHTML='<strong>Integración FG + FO:</strong> desde Nivel 3, una materia/materialización de Formación Orientada puede incorporarse directamente a un Laboratorio de Ciencias Sociales o Ciencias Naturales del mismo año. También puede moverse desde un espacio FO ya conformado; en ese caso, el movimiento solo se permite si el espacio FO de origen conserva su composición mínima.';",
      a:'rule.hidden=true;',veces:1,
      motivo:'La integración FG + FO en Laboratorios desde Nivel 3 es una regla de Media; queda oculta hasta incorporar la normativa de la modalidad.'}
  ],
  'v42-homologacion-performance':[
    {de:"window.addEventListener('pci-app-ready',prewarmCurriculum,{once:true});",a:'/* Precarga de bases de Media omitida: la modalidad usa su propio catálogo. */',veces:1,
      motivo:'No descargar las bases curriculares de Media en Técnica ni en BA +15.'}
  ],
  'v48-institutional-layer':[
    {de:'{courseCounts:{1:1,2:1,3:1,4:1,5:1}}',a:p=>`{courseCounts:${conteos(p.niveles)}}`,veces:1,motivo:'Un curso por nivel de la modalidad.'},
    {de:'for(let y=1;y<=5;y++)',a:p=>`for(let y=1;y<=${p.niveles};y++)`,veces:1,motivo:'Recorrer los niveles de la modalidad.'},
    {de:'[1,2,3,4,5]',a:p=>lista(p.niveles),veces:2,motivo:'Cursos y divisiones por nivel de la modalidad.'}
  ],
  'v57-custom-divisions':[
    {de:'for(let y=1;y<=5;y++)',a:p=>`for(let y=1;y<=${p.niveles};y++)`,veces:1,motivo:'Divisiones de todos los niveles.'},
    {de:'[1,2,3,4,5]',a:p=>lista(p.niveles),veces:1,motivo:'Divisiones de todos los niveles.'}
  ],
  'v59-phase2-annual-matrix':[
    {de:'cells.length!==10',a:p=>`cells.length!==${p.cuatrimestres}`,veces:1,motivo:'Celdas cuatrimestrales de la modalidad.'},
    {de:'i<10;i+=2',a:p=>`i<${p.cuatrimestres};i+=2`,veces:1,motivo:'Unir pares de cuatrimestres de todos los niveles.'}
  ],
  'v71-simple-assignment-excel':[
    {de:'const COORDINATION_AREAS='+AREAS_MEDIA,a:'const COORDINATION_AREAS='+AREAS_MODALIDAD,veces:1,
      motivo:'Áreas de coordinación tomadas del mapa de la modalidad.'}
  ],
  'v71-lean-management':[
    {de:'const COORD_AREAS='+AREAS_MEDIA,a:'const COORD_AREAS='+AREAS_MODALIDAD,veces:1,
      motivo:'Áreas de coordinación tomadas del mapa de la modalidad.'}
  ],
  'v72-students-commissions':[
    {de:'for(let year=1;year<=5;year++)',a:p=>`for(let year=1;year<=${p.niveles};year++)`,veces:1,motivo:'Comisiones de todos los niveles.'},
    {de:'[1,2,3,4,5]',a:p=>lista(p.niveles),veces:1,motivo:'Comisiones de todos los niveles.'}
  ],
  'v74-home-redesign':[
    {de:'[1,2,3,4,5]',a:p=>lista(p.niveles),veces:1,motivo:'Total de cursos de todos los niveles.'}
  ],
  'v84-content-control-table':[
    {de:'C1–C10',a:p=>`C1–C${p.cuatrimestres}`,veces:2,motivo:'Rango de cuatrimestres de la modalidad.'},
    {de:"'C1-C10'",a:p=>`'C1-C${p.cuatrimestres}'`,veces:1,motivo:'Rango de cuatrimestres de la modalidad.'}
  ],
  'v85-access-panel':[
    ...ACCESO_ESCOLAR_V85,
    {de:"const AREAS=[\n    'Lengua y Literatura','Matemática','Lenguas Adicionales','Ciencias Naturales',\n    'Ciencias Sociales','Artes','Tecnologías','Educación Física',\n    'Formación Orientada'\n  ];",
      a:'const AREAS='+AREAS_MODALIDAD+';',veces:1,motivo:'Áreas habilitables para docentes tomadas del mapa de la modalidad.'}
  ],
  'v93-curricular-coverage-dashboard':[
    {de:'[1,2,3,4,5]',a:p=>lista(p.niveles),veces:3,motivo:'Cobertura por todos los niveles de la modalidad.'}
  ]
};

/**
 * Derivados para Media (revision-v2-embed.html). Adaptaciones declaradas de
 * catálogo, presentación e importación explícita; el cálculo de cobertura
 * sigue a cargo de V91.
 */
const MEDIA={nombre:'Educación Media',niveles:5,cuatrimestres:10};
const DERIVADOS_MEDIA={
  'ui-navigation-consistency':NAVEGACION_ESCOLAR,
  'v85-access-panel':ACCESO_ESCOLAR_V85,
  'v23-prearm':[
    {de:'    const m=current();\n    m.placements=m.placements||{};',veces:1,
      a:'    const m=current();\n    // El puente identifica por referencia los mapas recibidos explícitamente.\n    if(window.__pciPreserveImportedMap?.(m))return false;\n    m.placements=m.placements||{};',
      motivo:'Conservar la composición de un mapa importado explícitamente, incluso vacío, sin impedir el prearmado habitual de un PCI nuevo.'},
    {de:"    placePaired(5,'Química','naturales');",veces:1,
      a:"    if(state.active!=='Ciencias Naturales')placePaired(5,'Química','naturales');",
      motivo:'No prearmar Química FG de 5.º en Ciencias Naturales: esa orientación tiene ocho laboratorios FG, solo en C1–C8.'}
  ],
  'v47-phase2-matrix':[
    {de:'async function loadFO(){',veces:1,
      a:`// Orientaciones ausentes en curriculum_v96: V2 conserva sus bloques y ejes
// en data/orientaciones/<archivo>.txt (eje como «Eje · Subeje»).
async function loadLegacyOrientation(file,orientation){
  try{
    const r=await fetch('data/orientaciones/'+file+'.txt',{cache:'force-cache'});
    if(!r.ok)return [];
    const rows=await unzip(await r.text());
    return (Array.isArray(rows)?rows:[]).filter(x=>String(x?.id||'').trim()&&String(x?.text||'').trim()).map(x=>{
      const [axis,...rest]=String(x.axis||'').trim().split(' · ');
      const block=String(x.block||'').trim();
      return {id:String(x.id).trim(),component:'FO',area:'Formación Orientada',orientation,suborientation:'',variant:'',
        block,subject:block||'Formación Orientada',axis:String(axis||'').trim(),subaxis:rest.join(' · ').trim(),text:String(x.text).trim(),kind:''};
    });
  }catch{return []}
}
async function loadFO(){`,
      motivo:'Agregar la lectura de orientaciones que V2 conserva en data/orientaciones/.'},
    {de:'if(m.v)rows=rows.filter(x=>x.variant===m.v);FO.set(fkey(),rows);return rows}',veces:1,
      a:'if(m.v)rows=rows.filter(x=>x.variant===m.v);if(!rows.length&&m.f)rows=await loadLegacyOrientation(m.f,orientation);FO.set(fkey(),rows);return rows}',
      motivo:'Ciencias Naturales, Matemática y Física, Informática y Educación no tienen filas en curriculum_v96: se completan con los bloques y ejes de V2.'},
    {de:'function componentCoverage(a,component){const gs=ga(a),official=areaPool(a).filter(c=>c.component===component),officialIds=new Set(official.map(c=>c.id)),used=new Set(gs.flatMap(g=>g.data.contents||[]).filter(id=>officialIds.has(id)));return{used,total:official.length,percent:official.length?Math.round(used.size/official.length*100):0,component}}',veces:1,
      a:`function componentCoverage(a,component){
  const gs=ga(a),official=areaPool(a).filter(c=>c.component===component),officialIds=new Set(official.map(c=>c.id));
  if(component==='FG'&&official.length){
    const core=window.PCICoverageV91,used=new Set();
    // La referencia canónica se resuelve en el nivel donde está ubicado cada contenido.
    for(const g of gs)for(const id of g.data.contents||[]){
      for(const row of core.canonicalForContent(findContent(id),g.year)){
        if(officialIds.has(row.id))used.add(row.id);
      }
    }
    const metric=core.trajectoryCoverage(a,gs);
    return{used,total:metric.total,percent:metric.percent,component};
  }
  // La Formación Orientada conserva su cobertura de trayectoria y su bolsa separada.
  const used=new Set(gs.flatMap(g=>g.data.contents||[]).filter(id=>officialIds.has(id)));
  return{used,total:official.length,percent:official.length?Math.round(used.size/official.length*100):0,component};
}`,
      motivo:'El encabezado FG utiliza las referencias por nivel y las métricas de trayectoria de V91, conserva el Set de IDs y mantiene FO separada.'},
    {de:'try{await Promise.all([loadFG(),loadFO()]);board()}catch(e)',veces:1,
      a:'try{await Promise.all([loadFG(),loadFO()]);await window.PCICoverageV91.ready();board()}catch(e)',
      motivo:'Esperar la base canónica de V91 antes de mostrar el encabezado; loadCurriculum no depende de openArea.'}
  ]
};

/** Adaptaciones existentes en src/v2-familia (comunes a ambas modalidades). */
const PREVIOS={
  'v19-map':{archivo:'src/v2-familia/v19-mapa-modalidad.js',motivo:'Filas, formatos, niveles y cuatrimestres de cada modalidad.'},
  'v38-phase2-workspace':{archivo:'src/v2-familia/v38-phase2-workspace.js',motivo:'Espacio de trabajo de Fase 2 con catálogo de la modalidad.'},
  'v47-phase2-matrix':{archivo:'src/v2-familia/v47-desarrollo-modalidad.js',motivo:'Desarrollo curricular con bases de contenidos de la modalidad.'},
  'v91-coverage-core':{archivo:'src/v2-familia/v91-coverage-core.js',motivo:'Cobertura sobre la base de contenidos de la modalidad.'},
  'v91-plans-coverage':{archivo:'src/v2-familia/v91-plans-coverage.js',motivo:'Cobertura de planes sobre la base de la modalidad.'}
};

/**
 * Reglas curriculares de Media: no se copian. Para cada modalidad se indica
 * cómo se resuelve según su propia norma (o qué falta).
 */
const NORMA_TECNICA='IF-2026-51169092-GCABA-SSPIE (Anexo II, 17/11/2026), Modalidad Técnica, págs. 13–18';
const NORMA_BA15='RES-1375-MEDGC-25, Anexo I (6.3 estructura y 6.5 áreas) y SSGDA-105-26 (turno noche)';
const BA15_REGLAS='Reemplazado: áreas por nivel, talleres, Tutoría en Nivel I y estructura completa de 38 h en v19-mapa-modalidad (baMember/baEvaluate), según '+NORMA_BA15+'.';
const BA15_NO_APLICA='No aplica: el Régimen +15 no establece esta regla de Media ('+NORMA_BA15+').';
const PENDIENTES={
  'v20-format-order':{motivo:'Orden Laboratorio/Taller de Formación Orientada en Nivel 4 y 5 de Media.',
    tecnica:'No aplica: '+NORMA_TECNICA+' no define ese orden; los formatos de la Especialidad se ubican por nivel en v19-mapa-modalidad.',ba15:BA15_NO_APLICA},
  'v21-custom-social-ui':{motivo:'Opción 10/12 laboratorios de Ciencias Sociales de Media.',
    tecnica:'Reemplazado: Sociales 8 espacios (10 en Computación) y ubicación de Ciudadanía y Trabajo / Ciencia y Tecnología en 4.º–6.º, en v19-mapa-modalidad y validador '+NORMA_TECNICA+'.',ba15:BA15_REGLAS},
  'v23-prearm':{motivo:'Prearmado de troncales y talleres según la estructura de Media.',
    tecnica:'No aplica: la norma no establece un prearmado; las troncales se ubican en celdas anuales por nivel.',ba15:BA15_NO_APLICA},
  'v24-social-interactions':{motivo:'Intercambio de materias de Sociales Nivel 3 (C5/C6) de Media.',
    tecnica:'Reemplazado: integración de Ciudadanía y Trabajo / Ciencia y Tecnología con la Formación Específica del mismo año (pág. 15), en v19-mapa-modalidad.',ba15:BA15_NO_APLICA},
  'v29-fo-rules':{motivo:'Reglas de Formación Orientada de Media.',
    tecnica:'Reemplazado: formatos de la Especialidad (Taller anual 3.º–6.º, Espacio anual 4.º–6.º, integraciones 4.º–6.º, Prácticas 5.º–6.º) según '+NORMA_TECNICA+'.',ba15:BA15_REGLAS},
  'v30-fo-minimum-guard':{motivo:'Mínimos de materias por espacio FO de Media (foN4, foLab5, foTaller5).',
    tecnica:'Reemplazado: mínimo de dos asignaturas, tope de 9 horas y cantidades por nivel con validateFinalComposition ('+NORMA_TECNICA+').',ba15:BA15_REGLAS},
  'v33-articulation-rules':{motivo:'Articulación FG → FO y tope de horas de Media.',
    tecnica:'No aplica: la integración FG + FO en laboratorios es margen del Bachillerato (pág. 12).',ba15:BA15_NO_APLICA},
  'v47-fo-content-atomicizer':{motivo:'Atomización de contenidos FO de las orientaciones de Media.',
    tecnica:'No aplica: Técnica usa la base de contenidos de su especialidad.',ba15:BA15_NO_APLICA}
};

/** Lee la secuencia exacta de módulos del V2 original. */
export async function secuenciaV2(){
  const html=await readFile(join(ROOT,VENDOR,'app.html'),'utf8');
  const lista=html.slice(html.indexOf('const modulePaths=['),html.indexOf('];',html.indexOf('const modulePaths=[')));
  const modulos=[...lista.matchAll(/'src\/([^']+)\.js'/g)].map(m=>m[1]);
  // app.html inserta atomizador y Fase 2 después de los 8 primeros módulos.
  if(!html.includes("fetchText('src/v47-phase2-matrix.js')")||!html.includes("fetchText('src/v47-fo-content-atomicizer.js')")||!html.includes('moduleSources.slice(0,8)'))
    throw Error('Cambió la secuencia de carga del V2 original: revisar el generador.');
  return [...modulos.slice(0,8),'v47-fo-content-atomicizer','v47-phase2-matrix',...modulos.slice(8)];
}

const sha=t=>createHash('sha256').update(t).digest('hex').slice(0,16);

function aplicar(modulo,original,perfil,tabla=DERIVADOS){
  let texto=original;const cambios=[];
  for(const r of tabla[modulo]){
    const n=texto.split(r.de).length-1;
    if(n!==r.veces)throw Error(`${modulo}: se esperaban ${r.veces} apariciones y hay ${n} de «${r.de.slice(0,70)}»`);
    const a=typeof r.a==='function'?r.a(perfil):r.a;
    texto=texto.split(r.de).join(a);
    cambios.push({motivo:r.motivo,veces:r.veces,original:r.de.length>120?r.de.slice(0,117)+'…':r.de,derivado:a.length>120?a.slice(0,117)+'…':a});
  }
  return {texto,cambios};
}

export async function construir(){
  const secuencia=await secuenciaV2();
  const commit=(await readFile(join(ROOT,VENDOR,'SOURCE_SNAPSHOT.txt'),'utf8')).match(/Commit original:\s*([0-9a-f]{40})/)?.[1]||'desconocido';
  const conocidos=new Set([...Object.keys(DERIVADOS),...Object.keys(PREVIOS),...Object.keys(PENDIENTES)]);
  for(const m of conocidos)if(!secuencia.includes(m))throw Error(`El módulo ${m} no figura en la secuencia de V2.`);
  const archivos=new Map();
  const manifiesto={
    descripcion:'Correspondencia módulo por módulo entre PCI Secundaria Aprende V2 y sus modalidades derivadas. Generado por scripts/derivar-v2-familia.mjs; no editar a mano.',
    origen:{repositorio:'sebastiangiampani-create/pci-sec-aprendeV2',commit,copia:VENDOR},
    perfiles:PERFILES,
    fase2:'v47-phase2-matrix',
    antesDeFase2:secuencia.slice(0,secuencia.indexOf('v47-fo-content-atomicizer')),
    modulos:[]
  };
  for(const modulo of secuencia){
    const ruta=`${VENDOR}/src/${modulo}.js`;
    const original=await readFile(join(ROOT,ruta),'utf8');
    const entrada={modulo,original:ruta,sha256Original:sha(original)};
    if(DERIVADOS[modulo]){
      entrada.estado='derivado';entrada.archivos={};entrada.cambios={};
      for(const [clave,perfil] of Object.entries(PERFILES)){
        const {texto,cambios}=aplicar(modulo,original,perfil);
        const destino=`${OUT}/${clave}/${modulo}.js`;
        const cabecera=`/* DERIVADO AUTOMÁTICO · no editar a mano.\n * Original: ${ruta} (V2 ${commit.slice(0,7)}).\n * Modalidad: ${perfil.nombre} · ${perfil.niveles} niveles · ${perfil.cuatrimestres} cuatrimestres.\n * Cambios:\n${cambios.map(c=>` *  - ${c.motivo}`).join('\n')}\n * Regenerar: node scripts/derivar-v2-familia.mjs\n */\n`;
        archivos.set(destino,cabecera+texto);
        entrada.archivos[clave]=destino;entrada.cambios[clave]=cambios;
      }
    }else if(PREVIOS[modulo]){
      entrada.estado='derivado-previo';entrada.archivos={tecnica:PREVIOS[modulo].archivo,ba15:PREVIOS[modulo].archivo};entrada.motivo=PREVIOS[modulo].motivo;
    }else if(PENDIENTES[modulo]){
      entrada.estado='pendiente-normativa';entrada.motivo=PENDIENTES[modulo].motivo;
      entrada.equivalentes={tecnica:PENDIENTES[modulo].tecnica,ba15:PENDIENTES[modulo].ba15};
    }else{
      entrada.estado='original';entrada.archivos={tecnica:ruta,ba15:ruta};
    }
    if(DERIVADOS_MEDIA[modulo]){
      const {texto,cambios}=aplicar(modulo,original,MEDIA,DERIVADOS_MEDIA);
      const destino=`${OUT}/media/${modulo}.js`;
      const cabecera=`/* DERIVADO AUTOMÁTICO · no editar a mano.\n * Original: ${ruta} (V2 ${commit.slice(0,7)}).\n * Modalidad: ${MEDIA.nombre} (revision-v2-embed.html).\n * Cambios:\n${cambios.map(c=>` *  - ${c.motivo}`).join('\n')}\n * Regenerar: node scripts/derivar-v2-familia.mjs\n */\n`;
      archivos.set(destino,cabecera+texto);
      entrada.media={archivo:destino,cambios};
    }
    manifiesto.modulos.push(entrada);
  }
  archivos.set(MANIFEST,JSON.stringify(manifiesto,null,2)+'\n');
  return archivos;
}

async function main(){
  const verificar=process.argv.includes('--check');
  const archivos=await construir();
  const desactualizados=[];
  for(const [ruta,contenido] of archivos){
    const completo=join(ROOT,ruta);
    let actual=null;try{actual=await readFile(completo,'utf8')}catch{}
    if(actual===contenido)continue;
    if(verificar){desactualizados.push(ruta);continue}
    await mkdir(dirname(completo),{recursive:true});
    await writeFile(completo,contenido);
    console.log('generado',ruta);
  }
  if(verificar&&desactualizados.length){
    console.error('Derivados desactualizados:\n'+desactualizados.join('\n'));
    process.exit(1);
  }
  if(verificar)console.log('Derivados V2 al día:',archivos.size,'archivos.');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])await main();
