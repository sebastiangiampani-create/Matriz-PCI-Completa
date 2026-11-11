/**
 * Proyecto de Vinculación con el Futuro, modalidad Bachillerato.
 * Fuente: "Pautas para la construcción del PCI" (05/10/2026),
 * página impresa 11, PDF página 12. Tabla A/B de las 16 orientaciones.
 *
 * Es un ÚNICO espacio anual en 5.º año (C9-C10).
 * No añadir otro proyecto por cuatrimestre ni duplicar horas.
 * No modifica documentos históricos ni hace escrituras.
 */
export const PVF_RULESET='pci-2026-10-05/pvf-bachillerato/1';
export const PVF_SOURCE={title:'Pautas para la construcción del Proyecto Curricular Institucional (PCI)',date:'2026-10-05',printedPage:11,pdfPage:12};
const sourceRows=[
  ['agro_ambiente','Agro y ambiente','Espacio de integración teórico-práctico',3,'Espacio de integración teórico-práctico',3],
  ['arte_artes_visuales','Artes Visuales','Producción artística y gestión cultural',3,'Producción visual y gestión cultural',3],
  ['arte_musica','Artes - Música','Gestión de proyectos y producción musical',3,'Gestión cultural musical',3],
  ['arte_teatro','Artes - Teatro','Producción en artes escénicas y gestión cultural',4,'Producción teatral y gestión cultural',3],
  ['ciencias_naturales','Ciencias Naturales','Problemáticas científicas con impacto social',2,'Problemáticas científicas con impacto social',2],
  ['ciencias_sociales_humanidades','Ciencias Sociales y Humanidades','Proyecto',3,'Proyecto',3],
  ['comunicacion','Comunicación','Proyecto de Comunicación',4,'Proyecto de Comunicación',4],
  ['economia_administracion','Economía y Administración','Proyecto Organizacional',3,'Proyecto Organizacional',3],
  ['educacion','Educación','Proyecto',3,'Proyecto',3],
  ['educacion_fisica','Educación Física','Proyecto II',3,'Proyecto II',3],
  ['energia_sustentabilidad','Energía y sustentabilidad','Proyecto: Consumidores/as y productores/as',4,'Proyecto: Consumidores/as y productores/as',4],
  ['informatica','Informática','Proyectos de Producción',4,'Desarrollo de Proyectos de Producción',4],
  ['lenguas','Lenguas','Proyecto',3,'Proyecto',3],
  ['literatura','Literatura','Proyecto de Mediación y/o Promoción de la Lectura y la Escritura',3,'Proyecto de Mediación de la Lectura y la Escritura',4],
  ['matematica_fisica','Matemática y física','Lógica y Filosofía de la Ciencia',4,'Ciencia en Contexto',4],
  ['turismo','Turismo','Proyecto de turismo comunitario',4,'Proyecto de turismo comunitario',4]
];
export const PVF_TABLE=Object.freeze(sourceRows.map(([orientationId,label,a,hoursA,b,hoursB])=>Object.freeze({
  orientationId,label,
  A:Object.freeze({name:a,hours:hoursA}),
  B:Object.freeze({name:b,hours:hoursB})
})));
const byId=new Map(PVF_TABLE.map(row=>[row.orientationId,row]));
export function pvfReference(orientationId,alternative='A'){
  const record=byId.get(orientationId);
  if(!record)throw new Error('Proyecto de Vinculación: orientación no identificada en la tabla oficial.');
  if(!['A','B'].includes(alternative))throw new Error('Proyecto de Vinculación: alternativa curricular inválida.');
  const unit=record[alternative];
  return {
    id:'pvf:'+orientationId+':'+alternative,
    name:unit.name,hours:unit.hours,
    year:5,kind:'proyecto',duration:'annual',startTerm:9,endTerm:10,
    orientationId,alternative,
    ruleSet:PVF_RULESET,sourcePage:11,source:'Pautas PCI 05/10/2026'
  };
}
export function isPvfReference(subject){
  return typeof subject?.id==='string' && /^pvf:[a-z0-9_]+:[AB]$/.test(subject.id)
    && subject.ruleSet===PVF_RULESET;
}
export function validatePvfProject(space,{orientationId,alternative='A'}={}){
  const expected=pvfReference(orientationId,alternative), errors=[];
  if(space?.kind!=='proyecto'||Number(space.year)!==5||
    Number(space.startTerm)!==9||Number(space.endTerm)!==10||
    space.duration!=='annual')
    errors.push('El Proyecto de Vinculación debe ser un solo espacio anual de 5.º, C9–C10.');
  const members=Array.isArray(space?.members)?space.members:[];
  if(members.length!==1)
    errors.push('El Proyecto de Vinculación debe tener exactamente un espacio curricular asignado según la alternativa '+alternative+'.');
  else {
    const actual=members[0];
    if(actual.name!==expected.name)
      errors.push('El espacio del proyecto no corresponde a '+orientationId+' en alternativa '+alternative+': '+expected.name+'.');
    if(Number(actual.hours)!==expected.hours)
      errors.push('La carga horaria del Proyecto de Vinculación debe ser '+expected.hours+' h para la alternativa '+alternative+'.');
    if(actual.id!==expected.id || actual.orientationId!==orientationId || actual.alternative!==alternative)
      errors.push('La referencia del proyecto no coincide con la orientación y alternativa seleccionadas.');
  }
  return {valid:errors.length===0,errors,expected,year:5,terms:[9,10]};
}
export function projectMatchesReference(space,{orientationId,alternative='A'}={}){
  return validatePvfProject(space,{orientationId,alternative}).valid;
}
