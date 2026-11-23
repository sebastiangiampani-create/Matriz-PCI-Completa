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
const artesVisuales=Object.freeze({
 fuente:Object.freeze({"norma":"Diseño Curricular Arte · Artes Visuales aprobado RES-321/15","url":"https://buenosaires.gob.ar/areas/educacion/nes/pdf/2015/NES-CO-arte_artes-visuales-musica-teatro_w.pdf","paginas":[44,45],"estado":"cotejado_con_diseno_curricular_publicado"}),
 comun:Object.freeze({3:Object.freeze([materia("Taller de artes visuales",4)])}),
 A:Object.freeze({4:Object.freeze([materia("Taller de artes visuales",4),materia("Artes en contextos históricos",2),materia("Lenguajes artísticos combinados",3)]),5:Object.freeze([materia("Arte público y producción colectiva",4),materia("Arte, cultura y sociedad",2),materia("Producción artística y gestión cultural",3),materia("Artes visuales y multimedia",3)])}),
 B:Object.freeze({4:Object.freeze([materia("Producción y análisis de la imagen",4),materia("Arte y sociedad",2),materia("Lenguajes combinados",3)]),5:Object.freeze([materia("Prácticas de arte público",4),materia("Historia de las artes",2),materia("Producción visual y gestión cultural",3),materia("Artes visuales y multimedia",3)])})
});

const arteMusica=Object.freeze({
 fuente:Object.freeze({"norma":"Diseño Curricular Arte · Música aprobado RES-321/15","url":"https://buenosaires.gob.ar/areas/educacion/nes/pdf/2015/NES-CO-arte_artes-visuales-musica-teatro_w.pdf","paginas":[70,71],"estado":"cotejado_con_diseno_curricular_publicado"}),
 comun:Object.freeze({3:Object.freeze([materia("Taller de música",4)])}),
 A:Object.freeze({4:Object.freeze([materia("Taller de música",4),materia("Artes en contextos históricos",2),materia("Lenguajes artísticos combinados",3)]),5:Object.freeze([materia("Improvisación y ensambles musicales",4),materia("Arte, cultura y sociedad",2),materia("Gestión de proyectos y producción musical",3),materia("Música y multimedia",3)])}),
 B:Object.freeze({4:Object.freeze([materia("Producción y apreciación musical",4),materia("Arte y sociedad",2),materia("Lenguajes combinados",3)]),5:Object.freeze([materia("Improvisación y ensambles musicales",4),materia("Historia de las artes",2),materia("Gestión cultural musical",3),materia("Música y multimedia",3)])})
});

const arteTeatro=Object.freeze({
 fuente:Object.freeze({"norma":"Diseño Curricular Arte · Teatro aprobado RES-321/15","url":"https://buenosaires.gob.ar/areas/educacion/nes/pdf/2015/NES-CO-arte_artes-visuales-musica-teatro_w.pdf","paginas":[96,97],"estado":"cotejado_con_diseno_curricular_publicado"}),
 comun:Object.freeze({3:Object.freeze([materia("Taller de Teatro",4)])}),
 A:Object.freeze({4:Object.freeze([materia("Taller de Teatro",4),materia("Artes en contextos históricos",2),materia("Lenguajes artísticos combinados",3)]),5:Object.freeze([materia("Teatro y creación colectiva",3),materia("Arte, cultura y sociedad",2),materia("Producción en artes escénicas y gestión cultural",4),materia("Teatro y multimedia",3)])}),
 B:Object.freeze({4:Object.freeze([materia("Producción y apreciación del teatro",4),materia("Arte y sociedad",2),materia("Lenguajes combinados",3)]),5:Object.freeze([materia("Teatro y puesta en escena",4),materia("Historia de las artes",2),materia("Producción teatral y gestión cultural",3),materia("Teatro y multimedia",3)])})
});

const agroAmbiente=Object.freeze({
 fuente:Object.freeze({"norma":"Diseño Curricular Agro y Ambiente aprobado RES-321/15 · Anexo XII","url":"https://buenosaires.gob.ar/areas/educacion/recursos/NES-CO-agro-y-ambiente_w.pdf","paginas":[46,47],"estado":"cotejado_con_diseno_curricular_publicado"}),
 comun:Object.freeze({3:Object.freeze([materia("Espacios agrarios",4)])}),
 A:Object.freeze({4:Object.freeze([materia("Ecología",3),materia("Sociología rural",3),materia("Producciones agrarias",3)]),5:Object.freeze([materia("Agro y ambiente",3),materia("Economía orientada al agro",3),materia("El agro en la Ciudad",3),materia("Espacio de integración teórico-práctico",3)])}),
 B:Object.freeze({4:Object.freeze([materia("El agro en la Ciudad",3),materia("Espacio de integración teórico-práctico",3),materia("Ecología",3)]),5:Object.freeze([materia("Economía y producción agraria",3),materia("El agro en la Ciudad",3),materia("Espacio de integración teórico-práctico",3),materia("Ambiente agrario",3)])})
});

const lenguas=Object.freeze({
 fuente:Object.freeze({"norma":"RES-1189/MEGC/15 · Anexo IX (rectificatorio de 321/15)","url":"https://buenosaires.gob.ar/sites/default/files/media/document/2015/08/28/b061778fa67f2cf17834f094f414c6cbe109152c.pdf","paginas":[25],"estado":"cotejado_con_anexo_rectificado"}),
 comun:Object.freeze({3:Object.freeze([materia("Lengua adicional B",4)])}),
 A:Object.freeze({4:Object.freeze([materia("Lengua adicional B",3),materia("Profundización lengua adicional A",3),materia("Lengua y cultura",3)]),5:Object.freeze([materia("Lengua adicional B",3),materia("Profundización lengua adicional A",3),materia("Lengua adicional C",3),materia("Proyecto",3)])}),
 B:Object.freeze({4:Object.freeze([materia("Lengua adicional B",3),materia("Profundización lengua adicional A",3),materia("Lingüística o Interculturalidad",3)]),5:Object.freeze([materia("Lengua adicional B",2),materia("Profundización lengua adicional A",3),materia("Lengua adicional C",3),materia("Proyecto",4)])})
});

const literatura=Object.freeze({
 fuente:Object.freeze({"norma":"RES-321/MEGC/15 + RES-1189/MEGC/15 · Literatura","url":"https://buenosaires.gob.ar/areas/educacion/nes/pdf/2015/NES-CO-literatura_w.pdf","paginas":[47],"estado":"cotejado_con_diseno_curricular_publicado"}),
 A:Object.freeze({3:Object.freeze([materia("Taller de Producción en Lenguajes: Literatura y otras Artes",4)]),4:Object.freeze([materia("Taller de Lectura y Escritura Literarias",3),materia("Taller de Gramática",3),materia("Literatura, Cultura y Sociedad",3)]),5:Object.freeze([materia("Proyecto de Mediación y/o Promoción de la Lectura y la Escritura",3),materia("Literatura y Problemáticas Culturales o Investigación Literaria",3),materia("Lectura Literaria en una Lengua Adicional / Arte, Cultura y Sociedad",3),materia("Análisis del Discurso",3)])}),
 B:Object.freeze({3:Object.freeze([materia("Taller de Lectura y Escritura Literarias",4)]),4:Object.freeze([materia("Taller de Gramática",3),materia("Investigación Literaria",3),materia("Arte, Cultura y Sociedad",3)]),5:Object.freeze([materia("Literatura, Cultura y Sociedad",4),materia("Proyecto de Mediación de la Lectura y la Escritura",4),materia("Análisis del Discurso",4)])})
});

const comunicacion=Object.freeze({
 fuente:Object.freeze({"norma":"RES-3510/MEGC/15 · Anexo de Comunicación","url":"https://documentosboletinoficial.buenosaires.gob.ar/publico/PE-RES-MEGC-MEGC-3510-15-ANX.pdf","paginas":[99,100],"estado":"cotejado_con_anexo_reformado"}),
 A:Object.freeze({3:Object.freeze([materia("Introducción a la Comunicación",4)]),4:Object.freeze([materia("Teorías de la Comunicación",3),materia("Comunicación, Discursos Sociales y Medios",3),materia("Taller cuatrimestral de Producción en Lenguajes Multimediales",3)]),5:Object.freeze([materia("Seminario de Comunicación, Tecnología y Sociedad",3),materia("Taller cuatrimestral de Producción en Lenguajes Multimediales",5),materia("Proyecto de Comunicación",4)])}),
 B:Object.freeze({3:Object.freeze([materia("Introducción al Estudio de la Comunicación",4)]),4:Object.freeze([materia("Teorías de la Comunicación",3),materia("Comunicación, Discursos Sociales y Medios",3),materia("Taller anual de Producción en Lenguajes",3)]),5:Object.freeze([materia("Comunicación, Cultura y Sociedad",3),materia("Taller anual de Producción Gráfica",2),materia("Taller anual de Producción en Lenguajes",3),materia("Proyecto de Comunicación",4)])})
});

const educacion=Object.freeze({
 fuente:Object.freeze({"norma":"RES-321/MEGC/2015 · Anexo de Educación","url":"https://buenosaires.gob.ar/sites/default/files/media/document/2017/10/26/fedd40821b6e6335cfac94716114267412468d45.pdf","paginas":[39],"estado":"cotejado_con_diseno_curricular_publicado"}),
 comun:Object.freeze({3:Object.freeze([materia("Educación y Sociedad",4)])}),
 A:Object.freeze({4:Object.freeze([materia("Educación y Estado",3),materia("Sujeto de la Educación",3),materia("Perspectivas Pedagógicas",3)]),5:Object.freeze([materia("Proyecto",3),materia("Educación y Psicología",3),materia("Educación y Globalización",3),materia("Educación y Cultura",3)])}),
 B:Object.freeze({4:Object.freeze([materia("Educación y Psicología",3),materia("Sujeto de la Educación",3),materia("Educación y Cultura",3)]),5:Object.freeze([materia("Proyecto",3),materia("Educación y Estado",3),materia("Educación y Globalización",3),materia("Perspectivas Pedagógicas",3)])})
});

const energiaSustentabilidad=Object.freeze({
 fuente:Object.freeze({norma:'RES-2370/MEDGC/2022 · Anexo Curricular Energía y Sustentabilidad',
  url:'https://documentosboletinoficial.buenosaires.gob.ar/publico/PE-RES-MEDGC-MEDGC-2370-22-ANX.pdf',
  paginas:[36,37],estado:'cotejado_con_anexo_oficial'}),
 comun:Object.freeze({3:Object.freeze([materia('Taller de modelización en Producción de energía y consumo',4)])}),
 A:Object.freeze({
  4:Object.freeze([materia('Observatorio de participación ciudadana en Energía y calidad de vida',3),
   materia('Taller de modelización en Cuidado del ambiente, ciencia y tecnología',4),
   materia('Seminario de Políticas en energía, ciencia y tecnología',2)]),
  5:Object.freeze([materia('Taller de modelización en Recursos energéticos, ciencia y tecnología',4),
   materia('Observatorio de participación ciudadana en Matriz energética y leyes ambientales',4),
   materia('Proyecto: Consumidores/as y productores/as',4)])
 })
});

const matematicaFisica=Object.freeze({
 fuente:Object.freeze({norma:'RES-321/MEGC/15 · Anexo y plan de Matemática y Física · RES-105/SSPLINED/16',
  url:'https://documentosboletinoficial.buenosaires.gob.ar/publico/PE-RES-MEDGC-SSPLINED-105-16-ANX-1.pdf',
  paginas:[1,2],estado:'cotejado_con_anexo_oficial'}),
 comun:Object.freeze({3:Object.freeze([materia('Laboratorio (taller)',4)])}),
 A:Object.freeze({
  4:Object.freeze([materia('Ciencia en Contexto',3),materia('Laboratorio de Matemática (taller)',3),
   materia('Física y Tecnología',3)]),
  5:Object.freeze([materia('Lógica y Filosofía de la Ciencia',4),
   materia('Matemática para la Física (taller)',4),materia('Problemáticas de la Física Actual',4)])
 }),
 B:Object.freeze({
  4:Object.freeze([materia('Lógica y Filosofía de la Ciencia',3),materia('Laboratorio de Matemática (taller)',3),
   materia('Física y Tecnología',3)]),
  5:Object.freeze([materia('Ciencia en Contexto',4),materia('Matemática para la Física (taller)',4),
   materia('Problemáticas de la Física Actual',4)])
 })
});
const informatica=Object.freeze({
 fuente:Object.freeze({norma:'RES-1189/MEGC/15 · Anexo X, estructura de Informática',
  url:'https://documentosboletinoficial.buenosaires.gob.ar/publico/PE-RES-MEGC-MEGC-1189-15.-ANX.pdf',
  paginas:[150],estado:'cotejado_con_anexo_rectificado'}),
 A:Object.freeze({
  3:Object.freeze([materia('Tratamiento de Imágenes por Medios Informáticos',4)]),
  4:Object.freeze([materia('Taller de Programación',3),materia('Bases de Datos',3),
   materia('Estructura y Funcionamiento de los Sistemas Informáticos I',3)]),
  5:Object.freeze([materia('Desarrollo de Aplicaciones Informáticas',4),
   materia('Estructura y Funcionamiento de los Sistemas Informáticos II',2),
   materia('Proyectos de Producción',4),
   materia('Seminario optativo de Informática (TIC o producción de bienes y servicios)',2)])
 }),
 B:Object.freeze({
  // Dos asignaturas cuatrimestrales dentro de UN cupo anual de 4 HC.
  // No duplicar como 8 HC ni crear una asignatura anual ficticia.
  3:Object.freeze([materia('Estructura y Funcionamiento de los Sistemas Informáticos I / Tratamiento de Imágenes (cuatrimestrales)',4)]),
  4:Object.freeze([materia('Taller de Programación',4),materia('Bases de Datos',2),
   materia('Estructura y Funcionamiento de los Sistemas Informáticos II',3)]),
  5:Object.freeze([materia('Desarrollo de Aplicaciones Informáticas',4),
   materia('Metodologías de Proyectos',2),
   materia('Desarrollo de Proyectos de Producción',4),
   materia('Seminario optativo de Informática (TIC o producción de bienes y servicios)',2)])
 })
});

export const NES_PLANES_FO_COTEJADOS=Object.freeze({
 'Economía y Administración':economia,
 'Ciencias Sociales y Humanidades':sociales,
 'Turismo':turismo,
 'Educación Física':educacionFisica,
 'Arte - Artes Visuales':artesVisuales,
 'Arte - Música':arteMusica,
 'Arte - Teatro':arteTeatro,
 'Agro y Ambiente':agroAmbiente,
 'Lenguas':lenguas,
 'Literatura':literatura,
 'Comunicación':comunicacion,
 'Educación':educacion,
 'Energía y Sustentabilidad':energiaSustentabilidad,
 'Matemática y Física':matematicaFisica,
 'Informática':informatica
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
