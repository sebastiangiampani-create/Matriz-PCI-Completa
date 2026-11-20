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

/**
 * Reemplazos por módulo. `de` debe aparecer exactamente `veces` veces.
 * `a` puede ser una función del perfil.
 */
const DERIVADOS={
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
    {de:"const AREAS=[\n    'Lengua y Literatura','Matemática','Lenguas Adicionales','Ciencias Naturales',\n    'Ciencias Sociales','Artes','Tecnologías','Educación Física',\n    'Formación Orientada'\n  ];",
      a:'const AREAS='+AREAS_MODALIDAD+';',veces:1,motivo:'Áreas habilitables para docentes tomadas del mapa de la modalidad.'}
  ],
  'v93-curricular-coverage-dashboard':[
    {de:'[1,2,3,4,5]',a:p=>lista(p.niveles),veces:3,motivo:'Cobertura por todos los niveles de la modalidad.'}
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

/** Reglas curriculares de Media: requieren normativa de cada modalidad. */
const PENDIENTES={
  'v20-format-order':'Orden Laboratorio/Taller de Formación Orientada en Nivel 4 y 5 de Media.',
  'v21-custom-social-ui':'Opción 10/12 laboratorios de Ciencias Sociales de Media.',
  'v23-prearm':'Prearmado de troncales y talleres según la estructura de Media.',
  'v24-social-interactions':'Intercambio de materias de Sociales Nivel 3 (C5/C6) de Media.',
  'v29-fo-rules':'Reglas de Formación Orientada de Media.',
  'v30-fo-minimum-guard':'Mínimos de materias por espacio FO de Media (foN4, foLab5, foTaller5).',
  'v33-articulation-rules':'Articulación FG → FO y tope de horas de Media.',
  'v47-fo-content-atomicizer':'Atomización de contenidos FO de las orientaciones de Media.'
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

function aplicar(modulo,original,perfil){
  let texto=original;const cambios=[];
  for(const r of DERIVADOS[modulo]){
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
      entrada.estado='pendiente-normativa';entrada.motivo=PENDIENTES[modulo];
    }else{
      entrada.estado='original';entrada.archivos={tecnica:ruta,ba15:ruta};
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
