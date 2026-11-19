/**
 * Secundaria BA +15: Anexo I IF-2025-44785236-GCABA-SSPIE,
 * Resolución 1375/MEDGC/25, apartados 6, 6.3, 6.4 y 6.5.
 * Contrato de consulta y validación; sin persistencia ni cambios históricos.
 */
export const BA15_NORMATIVA=Object.freeze({
 resolucion:'1375/MEDGC/25',anexo:'IF-2025-44785236-GCABA-SSPIE',
 url:'https://documentosboletinoficial.buenosaires.gob.ar/publico/PE-RES-MEDGC-MEDGC-1375-25-ANX-2.pdf',
 niveles:4,horasSemanales:38,ccc:'Acreditación de espacios equivalentes de primer año NES'
});
const entry=(nombre,horas,area,formato='area')=>Object.freeze({nombre,horas,area,formato});
export const BA15_NIVELES=Object.freeze([
 Object.freeze([
  entry('Matemática',5,'Troncales','troncal'),entry('Lengua y Literatura',5,'Troncales','troncal'),
  entry('Lengua Adicional (Inglés)',4,'Troncales','troncal'),entry('Educación Física',3,'Talleres articulados','taller'),
  entry('Biología',4,'Ciencias Naturales'),entry('Historia',4,'Ciencias Sociales'),
  entry('Geografía',3,'Ciencias Sociales'),entry('Formación Ética y Ciudadana',2,'Ciencias Sociales'),
  entry('Educación Tecnológica',2,'Formación General'),entry('Artes',3,'Talleres articulados','taller'),
  entry('EDI',2,'Talleres articulados','taller'),entry('Tutoría',1,'Acompañamiento')
 ]),
 Object.freeze([
  entry('Matemática',4,'Troncales','troncal'),entry('Lengua y Literatura',4,'Troncales','troncal'),
  entry('Lengua Adicional (Inglés)',3,'Troncales','troncal'),entry('Educación Física',3,'Talleres articulados','taller'),
  entry('Biología',3,'Ciencias Naturales'),entry('Historia',2,'Ciencias Sociales'),
  entry('Geografía',2,'Ciencias Sociales'),entry('Formación Ética y Ciudadana',2,'Ciencias Sociales'),
  entry('Tecnologías de la Información',2,'Talleres articulados','taller'),
  entry('Economía',3,'Ciencias Sociales'),entry('Físico-Química',4,'Ciencias Naturales'),
  entry('EDI',2,'Talleres articulados','taller'),entry('Materia de la orientación',4,'Formación Orientada','orientado')
 ]),
 Object.freeze([
  entry('Matemática',4,'Troncales','troncal'),entry('Lengua y Literatura',4,'Troncales','troncal'),
  entry('Lengua Adicional (Inglés)',3,'Troncales','troncal'),entry('Educación Física',3,'Talleres articulados','taller'),
  entry('Artes',2,'Talleres articulados','taller'),entry('Historia',2,'Ciencias Sociales'),
  entry('Geografía',2,'Ciencias Sociales'),entry('Formación Ética y Ciudadana',2,'Ciencias Sociales'),
  entry('Tecnologías de la Información',2,'Talleres articulados','taller'),
  entry('Física',3,'Ciencias Naturales'),entry('EDI',2,'Talleres articulados','taller'),
  entry('Materias de la orientación',9,'Formación Orientada','orientado')
 ]),
 Object.freeze([
  entry('Matemática',4,'Troncales','troncal'),entry('Lengua y Literatura',4,'Troncales','troncal'),
  entry('Lengua Adicional (Inglés)',3,'Troncales','troncal'),entry('Educación Física',3,'Talleres articulados','taller'),
  entry('Filosofía',2,'Ciencias Sociales'),entry('Química',4,'Ciencias Naturales'),
  entry('EDI',2,'Talleres articulados','taller'),entry('Materias de la orientación',12,'Formación Orientada','orientado'),
  entry('Historia Orientada',2,'Formación Orientada','orientado'),
  entry('Tecnologías de la Información Orientada',2,'Formación Orientada','orientado')
 ])
]);
export const BA15_CCC=Object.freeze([
 'Matemática','Lengua y Literatura','Lengua Adicional (Inglés)','Educación Física',
 'Biología','Historia','Geografía','Formación Ética y Ciudadana','Educación Tecnológica','Artes'
]);
export function validarBa15({niveles=BA15_NIVELES,articulaciones={},ccc=[],exigirArticulaciones=false}={}){
 const errores=[],advertencias=[];
 if(!Array.isArray(niveles)||niveles.length!==4)return {valido:false,errores:['BA +15 requiere 4 niveles.'],advertencias:[]};
 for(let i=0;i<4;i++){
  const espacios=niveles[i];
  if(!Array.isArray(espacios)){errores.push('Nivel '+(i+1)+': espacios inválidos');continue;}
  const total=espacios.reduce((n,e)=>n+(Number(e.horas)||0),0);
  if(total!==38)errores.push('Nivel '+(i+1)+': '+total+' de 38 horas cátedra.');
  const required=BA15_NIVELES[i];
  for(const base of required){
    const match=espacios.find(e=>e.nombre===base.nombre);
    if(!match)errores.push('Nivel '+(i+1)+': falta '+base.nombre);
    else if(match.horas!==base.horas)errores.push('Nivel '+(i+1)+': carga incorrecta de '+base.nombre);
  }
  for(const espacio of espacios.filter(e=>e.formato==='taller'&&e.nombre!=='Educación Física'&&e.nombre!=='Artes'&&e.nombre!=='EDI'&&e.nombre!=='Tecnologías de la Información')) {
   advertencias.push('Nivel '+(i+1)+': revisar taller no incluido en la estructura base: '+espacio.nombre);
  }
 }
 // La articulación se exige para EDI, Artes, Educación Física y TI cuando corresponde.
 for(let i=0;i<4;i++)for(const e of BA15_NIVELES[i].filter(e=>e.formato==='taller')){
  const key=(i+1)+':'+e.nombre;
  if(!articulaciones[key]){
   const msg='Nivel '+(i+1)+': falta documentar articulación de '+e.nombre;
   (exigirArticulaciones?errores:advertencias).push(msg);
  }
 }
 for(const e of ccc)if(!BA15_CCC.includes(e))advertencias.push('CCC: espacio no homologado en la lista base: '+e);
 return {valido:errores.length===0,errores,advertencias};
}
