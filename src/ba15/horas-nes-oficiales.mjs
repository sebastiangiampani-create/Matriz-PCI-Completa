/**
 * Evidencia documental por asignatura para el Régimen BA +15.
 *
 * Fuente primaria: RES-321/MEGC/2015, Anexo VII,
 * "Bachillerato con orientación en Economía y Administración",
 * páginas impresas 53-54, sección Alternativas de Estructura Curricular.
 * RES-1375/MEDGC/25, Anexo I, 6.3 incorpora la estructura NES de 38 HC.
 *
 * Este registro conserva SEPARADOS dos hechos:
 *   - Horas NES verificadas en el documento de la orientación.
 *   - Homologación BA +15: NO afirmada por la mera coincidencia de horas NES.
 * Nunca se imputan horas a una materia sin respaldo documental.
 */
const fuenteEconomia=Object.freeze({
  norma:'RES-321/MEGC/2015, Anexo VII',
  url:'https://buenosaires.gob.ar/sites/default/files/media/document/2015/08/28/743757bb6d7cce0611bc87ce520ab1bd46349615.pdf',
  paginas:Object.freeze([53,54]),
  estado:'cotejado_con_anexo_oficial'
});
const materia=(nombre,horas)=>Object.freeze({nombre,horas});
const economia=Object.freeze({
  fuente:fuenteEconomia,
  comun:Object.freeze({
    3:Object.freeze([materia('Organizaciones',4)])
  }),
  A:Object.freeze({
    4:Object.freeze([
      materia('Economía',3),materia('Sistemas Administrativos',3),
      materia('Sistemas de Información Contable',3)
    ]),
    5:Object.freeze([
      materia('Economía',3),materia('Proyecto Organizacional',3),
      materia('Contabilidad Patrimonial y de Gestión',3),materia('Derecho',3)
    ])
  }),
  B:Object.freeze({
    4:Object.freeze([
      materia('Economía',3),materia('Sistemas Administrativos',3),
      materia('Sistemas de Información Contable',3)
    ]),
    5:Object.freeze([
      materia('Economía / Administración',3),materia('Proyecto Organizacional',3),
      materia('Contabilidad Patrimonial y de Gestión',3),materia('Derecho',3)
    ])
  })
});

const sociales=Object.freeze({
 fuente:Object.freeze({
  norma:'RES-321/MEGC/2015, Anexo VI rectificado por RES-1189/MEGC/2015',
  url:'https://buenosaires.gob.ar/sites/default/files/media/document/2015/08/28/b2f87f5f9a500cbfcff4d1a6718aba51faeb81ac.pdf',
  paginas:Object.freeze([25]),estado:'cotejado_con_anexo_rectificado'
 }),
 comun:Object.freeze({3:Object.freeze([
  materia('Introducción a las Ciencias Sociales y a las Humanidades',4)
 ])}),
 A:Object.freeze({
  4:Object.freeze([materia('Psicología',3),materia('Antropología Cultural',3),materia('Sociología',3)]),
  5:Object.freeze([materia('Geografía Ambiental y Política',3),materia('Sociedad y Estado',3),
   materia('Historia Cultural Latinoamericana',3),materia('Proyecto',3)])
 }),
 B:Object.freeze({
  4:Object.freeze([materia('Psicología',3),materia('Antropología Cultural',3),materia('Lógica',3)]),
  5:Object.freeze([materia('Teoría Social y Política',3),materia('Ambientes y Territorios',3),
   materia('Movimientos Culturales Latinoamericanos Contemporáneos / La CABA y su Historia',3),
   materia('Proyecto',3)])
 })
});
const turismo=Object.freeze({
 fuente:Object.freeze({
  norma:'RES-321/MEGC/2015, Anexo XI rectificado por RES-1189/MEGC/2015',
  url:'https://buenosaires.gob.ar/sites/default/files/media/document/2015/08/28/a457a78462d548464537a8aa8cf6d3dad5ed1200.pdf',
  paginas:Object.freeze([21,22]),estado:'cotejado_con_anexo_rectificado'
 }),
 A:Object.freeze({
  3:Object.freeze([materia('Introducción al turismo',4)]),
  4:Object.freeze([materia('Servicios turísticos',3),materia('Turismo y territorio',3),materia('Turismo y comunicación',3)]),
  5:Object.freeze([materia('Seminario sobre turismo y sociedad',3),materia('Segunda lengua adicional',2),
   materia('Servicios turísticos',3),materia('Proyecto de turismo comunitario',4)])
 }),
 B:Object.freeze({
  3:Object.freeze([materia('Turismo y sociedad',4)]),
  4:Object.freeze([materia('Servicios turísticos I',3),materia('Servicios turísticos II',3),
   materia('Turismo y territorio',3)]),
  5:Object.freeze([materia('Segunda lengua adicional',2),materia('Servicios turísticos III',4),
   materia('Comunicación turística',2),materia('Proyecto de turismo comunitario',4)])
 })
});
const educacionFisica=Object.freeze({
 fuente:Object.freeze({
  norma:'RES-321/MEGC/2015, Anexo VIII',
  url:'https://buenosaires.gob.ar/sites/default/files/media/document/2015/08/28/555154d978211587a6808669f00df2deb2115f5b.pdf',
  paginas:Object.freeze([51,52]),estado:'cotejado_con_anexo_oficial'
 }),
 A:Object.freeze({
  3:Object.freeze([materia('Deportes abiertos y cerrados I',4)]),
  4:Object.freeze([materia('Deportes abiertos y cerrados II',3),
   materia('Gimnasia y movimiento expresivo I',3),materia('Proyecto I',3)]),
  5:Object.freeze([materia('Deportes abiertos',3),materia('Gimnasia y movimiento expresivo II',3),
   materia('Proyecto II',3),materia('Recreación y prácticas ludomotrices',3)])
 }),
 B:Object.freeze({
  3:Object.freeze([materia('Deportes abiertos y cerrados',4)]),
  4:Object.freeze([materia('Gimnasia y movimiento expresivo',3),
   materia('Proyecto I',3),materia('Recreación y prácticas ludomotrices',3)]),
  5:Object.freeze([materia('Deportes abiertos',4),materia('Deportes cerrados',2),
   materia('Gimnasia y movimiento expresivo II',3),materia('Proyecto II',3)])
 })
});
export const NES_PLANES_FO_COTEJADOS=Object.freeze({
 'Economía y Administración':economia,
 'Ciencias Sociales y Humanidades':sociales,
 'Turismo':turismo,
 'Educación Física':educacionFisica
});
const canon=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const fijo=name=>/^(historia orientada|tecnologias? de la informacion orientada)\b/.test(canon(name));
const minutas={3:4,4:9,5:12};
export function cotejarHorasNesOrientadas({orientacion,alternativa,anio,materiasReferencia=[]}){
 const year=Number(anio),alt=alternativa==null?null:String(alternativa);
 if(![3,4,5].includes(year)||year!==3&&!['A','B'].includes(alt))
  throw new RangeError('Año o alternativa curricular NES inválidos.');
 if(!Array.isArray(materiasReferencia))
  throw new TypeError('La referencia de materias debe ser una lista.');
 const plan=NES_PLANES_FO_COTEJADOS[orientacion];
 const documentadas=year===3?(plan?.[alt||'comun']?.[3]||plan?.comun?.[3]):plan?.[alt]?.[year];
 const nombresReferencia=materiasReferencia.map(x=>String(x||'').trim()).filter(x=>x&&!fijo(x));
 if(!documentadas){
  return {estado:'pendiente_documental',orientacion,alternativa:alt,anio:year,
   cupoPrevisto:minutas[year],sumaHorasNes:null,coincideCupo:null,discrepancias:[],
   materias:nombresReferencia.map(nombre=>({nombre,horasNes:null,estado:'pendiente_documental'})),
   fuente:null};
 }
 const sumaHorasNes=documentadas.reduce((acc,m)=>acc+m.horas,0);
 if(sumaHorasNes!==minutas[year])
  throw new Error('La tabla documental '+orientacion+' '+year+' no coincide con la franja FO de '+minutas[year]+' HC.');
 const actuales=new Set(nombresReferencia.map(canon)),oficiales=new Set(documentadas.map(m=>canon(m.nombre)));
 const noOficiales=nombresReferencia.filter(x=>!oficiales.has(canon(x)));
 const faltantes=documentadas.filter(x=>!actuales.has(canon(x.nombre))).map(x=>x.nombre);
 return {estado:'cotejado_fuente_primaria',orientacion,alternativa:alt,anio:year,
  cupoPrevisto:minutas[year],sumaHorasNes,coincideCupo:true,
  discrepancias:{enCatalogoSinFuente:noOficiales,enFuenteSinCatalogo:faltantes},
  materias:documentadas.map(m=>({nombre:m.nombre,horasNes:m.horas,estado:'nes_documentada'})),
  fuente:{...plan.fuente}};
}
