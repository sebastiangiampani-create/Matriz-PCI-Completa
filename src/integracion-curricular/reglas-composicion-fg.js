/**
 * Validates copied Formation General against V2 prescribed structure.
 * NEVER regenerates Matriz groups or changes teaching plans.
 *
 * Group curriculum membership cannot be proven from Matriz content IDs.
 * Until subjects are explicitly reviewed, report warnings, not an invented
 * composition. This distinction is essential for mixed FG/FO articulations.
 */
const arr=x=>Array.isArray(x)?x:[];
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const aliases=new Map([['lenguas adicionales','lengua adicional'],
  ['formacion etica ciudadana','formacion etica y ciudadana']]);
const subjectKey=x=>aliases.get(norm(x))||norm(x);
const n=x=>Number(x)||0;
const expectedTrunks=['Lengua y Literatura','Matemática','Lenguas Adicionales'];
const TYPE={trunk:'troncal',laboratory:'laboratorio',workshop:'taller'};
const groups=(areas,area)=>arr(areas?.[area]?.groups);
const termsOf=g=>{
  const start=n(g.startTerm??g.termStart??g.term),end=n(g.endTerm??g.termEnd??g.term??start);
  return [start,end||start];
};
const yearOf=g=>{
  const [start]=termsOf(g);return n(g.level)||Math.ceil(start/2);
};
const hoursFor=(hours,year,subject)=>{
  const o=hours?.formacion_general?.[String(year)]||{};
  const found=Object.entries(o).find(([name])=>subjectKey(name)===subjectKey(subject));
  return found?Number(found[1]):null;
};
function expectCount(area,list,count,errors){
  if(list.length!==count)errors.push('FG '+area+': '+count+' espacios prescriptos, encontrados '+list.length+'.');
}
function expectPeriods(area,list,terms,errors){
  const actual=list.map(g=>termsOf(g)[0]).sort((a,b)=>a-b);
  const expected=[...terms].sort((a,b)=>a-b);
  if(JSON.stringify(actual)!==JSON.stringify(expected))
    errors.push('FG '+area+': distribución C1-C10 distinta de la prescripta.');
}
function yearlyCount(area,list,distribution,errors){
  for(const [year,total] of Object.entries(distribution)){
    const found=list.filter(g=>yearOf(g)===Number(year)).length;
    if(found!==total)errors.push('FG '+area+' '+year+'º: se requieren '+total+' espacios, encontrados '+found+'.');
  }
}
function canSingle(area,year){
  return (area==='Ciencias Naturales'&&(year===4||year===5))||
    (area==='Ciencias Sociales'&&year===5);
}
export function validateFgComposition(areas,refs){
  const rules=refs?.rules?.formacion_general;
  if(!rules)throw new Error('Faltan las reglas normativas de Formación General.');
  const errors=[],warnings=[],confirmed=[];
  for(const area of expectedTrunks){
    const list=groups(areas,area);
    expectCount(area,list,5,errors);
    for(const g of list){
      const year=yearOf(g),terms=termsOf(g);
      if(g.kind!=='trunk')errors.push('FG '+area+': un espacio troncal debe ser anual.');
      if(year<1||year>5||terms[0]!==year*2-1||terms[1]!==year*2)
        errors.push('FG '+area+': nivel/cuatrimestres anuales incorrectos.');
    }
  }
  const other=[
    ['Ciencias Naturales','ciencias_naturales',10,'laboratory'],
    ['Artes','artes',6,'workshop'],
    ['Tecnologías','tecnologias',8,'workshop'],
    ['Educación Física','educacion_fisica',10,'workshop']
  ];
  for(const [area,key,count,kind] of other){
    const list=groups(areas,area);
    expectCount(area,list,count,errors);
    const rule=rules[key];
    if(Array.isArray(rule.cuatrimestres))expectPeriods(area,list,rule.cuatrimestres,errors);
    if(rule.distribucion)yearlyCount(area,list,rule.distribucion,errors);
    for(const g of list)if(g.kind!==kind)
      errors.push('FG '+area+': formato diferente al prescripto.');
  }
  const social=groups(areas,'Ciencias Sociales');
  if(!rules.ciencias_sociales.cantidades_validas.includes(social.length))
    errors.push('FG Ciencias Sociales: se admiten 10 o 12 laboratorios, no '+social.length+'.');
  yearlyCount('Ciencias Sociales',social,{
    ...rules.ciencias_sociales.distribucion_base,
    3:social.length===12?4:2
  },errors);
  if(social.length===10||social.length===12)
    expectPeriods('Ciencias Sociales',social,
      social.length===12?[1,2,3,4,5,5,6,6,7,8,9,10]:
        [1,2,3,4,5,6,7,8,9,10],errors);
  for(const g of social)if(g.kind!=='laboratory')
    errors.push('FG Ciencias Sociales: se requiere formato Laboratorio.');
  for(const [area,block] of Object.entries(areas||{})){
    for(const g of arr(block.groups)){
      const year=yearOf(g),[first,last]=termsOf(g),title=area+' · '+String(g.name||g.id);
      if(year<1||year>5||first<1||first>10||last>10||
        (year!==Math.ceil(first/2))||(year!==Math.ceil(last/2)))
        errors.push('FG '+title+': asignación temporal o nivel incompatible.');
      if(![1,2,3,4,5].includes(year))continue;
      const explicit=arr(g.curricularSubjects),confirmedFlag=g.compositionReviewed===true;
      if(!explicit.length||!confirmedFlag){
        warnings.push('FG '+title+': falta homologar y confirmar las materias que componen el agrupamiento.');
        continue;
      }
      if(new Set(explicit.map(subjectKey)).size!==explicit.length)
        errors.push('FG '+title+': materias repetidas dentro del mismo espacio.');
      const prescribed=arr(refs?.subjects?.formacion_general?.[String(year)])
        .map(subjectKey);
      for(const subject of explicit){
        if(!prescribed.includes(subjectKey(subject)))
          errors.push('FG '+title+': materia no prescripta para '+year+'º: '+subject+'.');
      }
      if(g.kind==='laboratory'){
        const min=canSingle(area,year)?1:2;
        if(explicit.length<min)
          errors.push('FG '+title+': requiere '+min+' materias como mínimo.');
        const hs=explicit.map(subject=>hoursFor(refs?.hours,year,subject));
        if(hs.some(h=>!Number.isFinite(h)||h<=0))
          errors.push('FG '+title+': la carga horaria oficial de alguna materia no se encuentra.');
        else if(hs.reduce((a,b)=>a+b,0)>(Number(refs?.rules?.laboratorios?.max_horas_catedra)||9))
          errors.push('FG '+title+': supera las 9 horas cátedra permitidas.');
      }
      confirmed.push({area,id:String(g.id),year,subjects:[...explicit]});
    }
  }
  if(social.length===10||social.length===12){
    // Social 3 composition is only fully checkable after verified membership.
    const y3=social.filter(g=>yearOf(g)===3),subgroups=y3.map(g=>
      confirmed.find(x=>x.area==='Ciencias Sociales'&&x.id===String(g.id)));
    if(subgroups.length===y3.length&&subgroups.every(Boolean)){
      const expected=social.length===10?4:2;
      for(const c of subgroups)if(c.subjects.length!==expected)
        errors.push('FG Sociales 3º: cada laboratorio requiere '+expected+' materias para su opción.');
      const a=y3.filter(g=>termsOf(g)[0]===5),b=y3.filter(g=>termsOf(g)[0]===6);
      const describe=list=>list.map(g=>{
        const members=confirmed.find(c=>c.id===String(g.id)&&c.area==='Ciencias Sociales');
        return arr(members?.subjects).map(subjectKey).sort().join('|');
      }).sort();
      if(JSON.stringify(describe(a))!==JSON.stringify(describe(b)))
        errors.push('FG Sociales 3º: C5 y C6 deben repetir la misma conformación de materias.');
    }
  }
  return {valid:errors.length===0&&warnings.length===0,
    errors,warnings,confirmedGroups:confirmed.length,
    requiresTeacherSequenceRewrite:false};
}
