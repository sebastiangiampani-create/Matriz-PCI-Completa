/**
 * Constructor seguro de la oferta curricular por PCI y orientación.
 *
 * Las asignaciones NUEVAS viven únicamente en fo.composicionFgV2 de la
 * unidad de oferta de ESTE PCI. Los agrupamientos FG históricos se muestran
 * como fuente, nunca se reescriben ni se eliminan al editar la propuesta.
 *
 * Esta capa genera un borrador de composición, NO una homologación oficial.
 * Las reglas sustantivas siguen en los validadores V2 y del Anexo II.
 */
export const COMPOSITION_VERSION='pci-fg-fo-composicion-v2/1';
const TYPES=Object.freeze(['troncal','laboratorio','taller','integrado','otro']);
const array=v=>Array.isArray(v)?v:[];
const clone=v=>JSON.parse(JSON.stringify(v));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const slug=s=>norm(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const positive=i=>Number.isInteger(Number(i))&&Number(i)>0;
export const quarterYear=term=>Math.ceil(Number(term)/2);
export const pairedTerm=term=>Number(term)%2?Number(term)+1:Number(term)-1;
function officialHours(refs,year,name){
 const source=refs?.hours?.formacion_general?.[String(year)]||{};
 const item=Object.entries(source).find(([subject])=>norm(subject)===norm(name));
 const value=item?.[1];
 return value===undefined||value===null||value===''?null:
  Number.isFinite(Number(value))&&Number(value)>0?Number(value):null;
}
export function fgSubjectsByYear(refs,year){
  const subjects=array(refs?.subjects?.formacion_general?.[String(year)]);
  if(!Number.isInteger(Number(year))||year<1||year>5)
    throw Error('Nivel FG fuera de 1.º a 5.º.');
  return [...new Set(subjects.map(String).filter(Boolean))].map(name=>({
    id:'fg:'+year+':'+slug(name),name,year:Number(year),
    component:'FG',area:subjectArea(name),hours:officialHours(refs,year,name)
  }));
}
export function subjectArea(name){
  const n=norm(name);
  if(/matemat/.test(n))return 'Matemática';
  if(/lengua y literatura/.test(n))return 'Lengua y Literatura';
  if(/lengua adicional|ingles|frances|portugues/.test(n))return 'Lenguas Adicionales';
  if(/educacion fisica/.test(n))return 'Educación Física';
  if(/biologia|fisica|quimica/.test(n))return 'Ciencias Naturales';
  if(/historia|geografia|economia|filosofia|etica|ciudadan/.test(n))return 'Ciencias Sociales';
  if(/artes|educacion artistica|musica|teatro/.test(n))return 'Artes';
  if(/tecnolog|informacion/.test(n))return 'Tecnologías';
  return 'Otros formatos';
}
export function mapRow(area,kind=''){
  const a=norm(area),k=norm(kind);
  if(k==='integrado')return 'Integración FG–FO';
  if(/matemat/.test(a))return 'Matemática';
  if(/lengua y literatura/.test(a))return 'Lengua y Literatura';
  if(/lenguas adicional|lengua adicional/.test(a))return 'Lenguas Adicionales';
  if(/educacion fisica/.test(a))return 'Talleres FG · Educación Física';
  if(/naturales|biologia|fisica|quimica/.test(a))return 'Laboratorios FG · Naturales';
  if(/sociales|historia|geografia|economia|filosofia/.test(a))return 'Laboratorios FG · Sociales';
  if(/artes|artistica/.test(a))return 'Talleres FG · Artes';
  if(/tecnolog/.test(a))return 'Talleres FG · Tecnologías';
  if(k==='troncal')return 'Otros espacios FG';
  return 'Otros formatos';
}
export const ROWS=Object.freeze([
  'Lengua y Literatura','Matemática','Lenguas Adicionales',
  'Laboratorios FG · Naturales','Laboratorios FG · Sociales',
  'Talleres FG · Artes','Talleres FG · Tecnologías',
  'Talleres FG · Educación Física','Otros espacios FG',
  'Integración FG–FO','Laboratorios FO','Talleres FO',
  'Proyecto de Vinculación con el Futuro','Otros formatos'
]);
/**
 * Opción B de Sociales de Bachillerato: 10 o 12 laboratorios.
 * El mapa antiguo podía tener un segundo C6 y un segundo C7; las normas
 * finales requieren dos agrupamientos en C5 y dos en C6 para la opción 12.
 * Proyectamos una COPIA por PCI. Nunca reescribimos los grupos históricos.
 */
export function projectSocialGroupsForPci(original,option=null){
 const selected=option===10||option===12?option:null;
 const groups=clone(array(original));
 const conflicts=[];
 const beginning=g=>Number(g.startTerm??g.termStart??g.term??((Number(g.level)||0)*2-1));
 const worked=g=>array(g.items).length>0||
  ['summary','synopsis','objective','objectives','context','practiceAxis']
   .some(k=>typeof g[k]==='string'&&g[k].trim())||
  array(g.plansBimestrales).some(p=>
   ['objectives','synopsis','context'].some(k=>typeof p?.[k]==='string'&&p[k].trim())||
   array(p?.contentIds).length>0||
   Object.values(p?.stages||{}).some(stage=>
    typeof stage==='string'?stage.trim():
    Object.values(stage||{}).some(v=>typeof v==='string'&&v.trim())));
 if(!selected)return {groups,conflicts};
 const positions=new Map();
 groups.forEach((g,index)=>{
  const term=beginning(g),seen=positions.get(term)||[];
  seen.push(index);positions.set(term,seen);
 });
 const extra=(term)=>positions.get(term)?.slice(1)||[];
 const extra5=extra(5),extra6=extra(6),extra7=extra(7);
 const excess=groups.length===12&&extra5.length+extra6.length+extra7.length===2;
 const placement=excess&&extra5.length===0&&extra6.length===1&&extra7.length===1?
  [extra6[0],extra7[0]]:null;
 const correct=excess&&extra5.length===1&&extra6.length===1;
 let exclude=[];
 if(selected===10&&excess)exclude=correct?[extra5[0],extra6[0]]:
  placement||[];
 if(selected===12&&placement){
  for(const [index,target] of [[placement[0],5],[placement[1],6]]){
   if(worked(groups[index])){
    conflicts.push('El agrupamiento histórico '+groups[index].name+
     ' tiene contenidos o planes; revisar antes de cambiar su cuatrimestre.');
    continue;
   }
   groups[index].originalTerm=beginning(groups[index]);
   groups[index].startTerm=target;groups[index].endTerm=target;
   groups[index].level=Math.ceil(target/2);
   groups[index].proyectadoSoloEnPci=true;
  }
 }
 for(const index of exclude){
  if(worked(groups[index])){
   conflicts.push('No se puede excluir del PCI el agrupamiento histórico '+groups[index].name+
    ': contiene trabajo pedagógico. Requiere conciliación.');
   continue;
  }
  groups[index].excludedFromPci=true;
 }
 if(excess&&!correct&&!placement)
  conflicts.push('La distribución histórica de Sociales requiere revisión de C5 y C6.');
 return {groups,conflicts};
}
export function selectSocialOption(data,option){
 const draft=guardComposition(data),choice=Number(option);
 if(![10,12].includes(choice))throw Error('Elegí 10 o 12 laboratorios de Sociales.');
 draft.socialOption=choice;return draft;
}
export function historicGroups(pack,orientationId){
  const current=pack?.orientations?.[orientationId];
  const fg=current?.fg?.areas||{},option=current?.fo?.composicionFgV2?.socialOption;
  const groups=[];
  for(const [area,block] of Object.entries(fg)){
    const source=area==='Ciencias Sociales'?projectSocialGroupsForPci(block?.groups,option).groups:array(block?.groups);
    for(const g of source.filter(x=>!x.excludedFromPci)){
      const start=Number(g.startTerm||((Number(g.level)||0)*2-1));
      const end=Number(g.endTerm||start);
      if(!positive(start)||start>10||end<start)continue;
      const kind=String(g.kind||'');
      groups.push({
        id:String(g.id),area,name:String(g.name||area),kind,
        row:mapRow(area,kind),
        startTerm:start,endTerm:Math.min(10,end),
        level:Number(g.level)||quarterYear(start),
        contents:array(g.items).length,plans:array(g.plansBimestrales).length,
        // Solo las plantillas sin trabajo pedagógico se pueden revisar
        // automáticamente en Fase 1. El original queda intacto.
        hasWork:array(g.items).length>0||Boolean(g.objective||g.synopsis||g.context||
          g.practiceAxis)||array(g.plansBimestrales).some(p=>
            p?.objectives||p?.synopsis||array(p?.contentIds).length||
            Object.values(p?.stages||{}).some(stage=>
              typeof stage==='string'?stage.trim():Object.values(stage||{}).some(v=>
                typeof v==='string'&&v.trim()))),
        members:array(g.curricularSubjects).map(m=>({
          id:String(m.id||''),name:String(m.name||''),component:'FG',
          area,year:Number(g.level)||quarterYear(start),hours:m.hours??null
        })),
        origin:'legacy'
      });
    }
  }
  // La matriz histórica genérica siempre trae 10 plantillas Naturales.
  // En la orientación Ciencias Naturales corresponden solo ocho C1-C8.
  // Omitimos de la VISTA exclusivamente las plantillas originales vacías
  // de C9-C10; cualquier trabajo histórico o personalización se conserva.
  if(orientationId==='ciencias_naturales'){
    return groups.filter(g=>{
      if(g.area!=='Ciencias Naturales'||![9,10].includes(g.startTerm))return true;
      const isEmptyFactoryTemplate=
        g.id==='ciencias-naturales-laboratory-'+g.startTerm&&
        g.name==='Laboratorio '+g.startTerm&&
        !g.hasWork&&!g.members.length;
      return !isEmptyFactoryTemplate;
    });
  }
  return groups;
}
/**
 * La FG previa no se modifica: se crea una sombra en la construcción del PCI,
 * usando el ID histórico para reconciliar con su copia pedagógica en Fase 2.
 */
export function promoteHistoricGroup(data,source){
 const draft=guardComposition(data);
 if(!source||source.origin!=='legacy'||!source.id||!source.area)
  throw Error('El agrupamiento histórico no pertenece a esta escuela.');
 if(source.hasWork)
  throw Error('Este espacio contiene contenidos o planes trabajados. Primero debe conciliarse con el original; no se modifica por arrastre.');
 if(draft.groups.some(g=>String(g.id)===String(source.id)))return draft;
 const kind={trunk:'troncal',laboratory:'laboratorio',workshop:'taller',
  other:'otro'}[source.kind];
 if(!kind)throw Error('El formato histórico requiere revisión antes de modificarlo.');
 const promoted={
  id:String(source.id),name:String(source.name),kind,
  area:String(source.area),year:Number(source.level),
  term:Number(source.startTerm),endTerm:Number(source.endTerm),
  row:String(source.row),members:clone(array(source.members)),
  source:'historical-copy',legacyGroupId:String(source.id),pairedId:null
 };
 if(promoted.year!==quarterYear(promoted.term)||
    promoted.year!==quarterYear(promoted.endTerm))
  throw Error('El agrupamiento histórico está fuera del nivel que corresponde.');
 draft.groups.push(promoted);
 return draft;
}
export function blankComposition(identity){
  return {
    schema:COMPOSITION_VERSION,
    schoolId:Number(identity.schoolId),pciId:String(identity.pciId),
    orientationId:String(identity.orientationId),
    groups:[],socialOption:null,draft:true
  };
}
export function compositionFor(workspace,pci){
  const data=workspace?.orientations?.[pci.orientation_id]?.fo?.composicionFgV2;
  const identity={schoolId:pci.school_id,pciId:pci.pci_id,orientationId:pci.orientation_id};
  if(!data)return blankComposition(identity);
  if(data.schema!==COMPOSITION_VERSION||Number(data.schoolId)!==Number(identity.schoolId)||
     data.pciId!==identity.pciId||data.orientationId!==identity.orientationId||
     !Array.isArray(data.groups))
    throw Error('La propuesta FG–FO guardada pertenece a otro PCI o versión. No se cargó.');
  return clone(data);
}
function guardComposition(data){
  if(!data||data.schema!==COMPOSITION_VERSION||!Array.isArray(data.groups))
    throw Error('Propuesta de composición inválida.');
  return clone(data);
}
export function withComposition(workspace,pci,data){
  const original=workspace?.orientations?.[pci.orientation_id]?.fo;
  if(!original||!Array.isArray(original.spaces))
    throw Error('Este PCI no tiene un documento de oferta válido.');
  if(data.pciId!==pci.pci_id||Number(data.schoolId)!==Number(pci.school_id)||
     data.orientationId!==pci.orientation_id)
    throw Error('No se puede guardar una propuesta en otro PCI u orientación.');
  const result=clone(workspace);
  result.orientations[pci.orientation_id].fo.composicionFgV2=guardComposition(data);
  return result;
}
function expectedFormat(area){
 const name=norm(area);
 if(['matematica','lengua y literatura','lenguas adicionales'].includes(name))return 'troncal';
 if(['ciencias naturales','ciencias sociales'].includes(name))return 'laboratorio';
 if(['artes','tecnologias','educacion fisica'].includes(name))return 'taller';
 return null;
}
function approvedSingleGroup(group){
 return group.kind==='laboratorio'&&(
  (norm(group.area)==='ciencias naturales'&&[1,2,4,5].includes(Number(group.year)))||
  (norm(group.area)==='ciencias sociales'&&Number(group.year)===5)
 );
}
function groupHours(group){const parts=array(group.members);if(!parts.length)return 0;
 if(parts.some(x=>x.hours===null||x.hours===undefined||
  !Number.isFinite(Number(x.hours))))return null;
 return parts.reduce((sum,x)=>sum+Number(x.hours),0);
}
function permittedArea(area,kind){
  if(kind==='integrado')return /sociales|naturales/i.test(area);
  return true;
}
export function createGrouping(data,{year,term,kind,area,name,replicate=true}){
  const draft=guardComposition(data);
  const t=Number(term),level=Number(year),k=String(kind);
  if(!TYPES.includes(k)||!Number.isInteger(t)||t<1||t>10||
    level!==quarterYear(t)||!String(area||'').trim()||
    !String(name||'').trim())
    throw Error('Indicá formato, nombre, área y cuatrimestre del nivel.');
  if(!permittedArea(area,k))throw Error('La articulación FG–FO solo se ofrece en laboratorios de Naturales o Sociales.');
  const expected=expectedFormat(area);
  if(expected&&k!=='integrado'&&k!==expected)
    throw Error('Acción no permitida: '+area+' se organiza como '+expected+
      '. Elegí el formato prescripto por PCI V2 antes de crear el espacio.');
  if(k==='integrado'&&expected!=='laboratorio')
    throw Error('Acción no permitida: la integración FG–FO solo corresponde a Naturales o Sociales.');
  if(k==='integrado'&&level<3)
    throw Error('Las articulaciones FG–FO requieren Formación Orientada desde 3.º año.');
  // Anexo II 17/11/2026: la orientación Ciencias Naturales conserva
  // ocho laboratorios de FG (C1-C8), no diez. Las otras orientaciones
  // mantienen diez (C1-C10). No se modifica ni excluye ningún histórico.
  if(draft.orientationId==='ciencias_naturales'&&area==='Ciencias Naturales'&&
     k==='laboratorio'&&level===5)
    throw Error('Ciencias Naturales orientada tiene ocho laboratorios FG, de C1 a C8. No se agrega un laboratorio FG en C9 o C10; los talleres FO pertenecen a otra fila.');
  const row=k==='integrado'?'Integración FG–FO':mapRow(area,k);
  const id='borrador-'+(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2));
  const main={id,name:String(name).trim(),kind:k,area:String(area).trim(),
    year:level,term:t,endTerm:k==='troncal'?pairedTerm(t):t,
    row,members:[],source:'propuesta',pairedId:null};
  if(k==='troncal'){
    main.term=level*2-1;main.endTerm=level*2;
  }
  const equivalent=draft.groups.filter(g=>g.year===level&&g.area===area&&g.kind===k);
  if(k==='troncal'&&equivalent.length)
    throw Error('Acción no permitida: '+area+' ya tiene un espacio troncal anual en este nivel.');
  if(area==='Ciencias Sociales'&&level===3&&k==='laboratorio'&&
     equivalent.filter(g=>g.term===t).length>=2)
    throw Error('Acción no permitida: Sociales de 3.º admite un laboratorio por cuatrimestre o dos agrupamientos de dos materias; no tres.');
  draft.groups.push(main);
  if(replicate&&['laboratorio','taller','integrado'].includes(k)){
    const twin={...clone(main),id:id+'-par',term:pairedTerm(t),endTerm:pairedTerm(t),pairedId:id};
    main.pairedId=twin.id;draft.groups.push(twin);
  }
  return draft;
}
export function placeSubject(data,{groupId,subject}){
  const draft=guardComposition(data),group=draft.groups.find(g=>g.id===groupId);
  if(!group)throw Error('Agrupamiento de trabajo inexistente.');
  if(!subject||!['FG','FO'].includes(subject.component)||!subject.id)
    throw Error('La materia no pertenece a la bolsa curricular.');
  if(Number(subject.year)!==Number(group.year))
    throw Error('No se pueden ubicar materias de otro año en este agrupamiento.');
  if(subject.component==='FO'&&!(group.kind==='integrado'&&group.year>=3))
    throw Error('Las materias FO se asignan a espacios de FO o a laboratorios FG–FO habilitados.');
  if(group.kind==='integrado'&&subject.component==='FG'&&
     mapRow(subject.area)!==mapRow(group.area))
    throw Error('La materia FG no corresponde al área del laboratorio integrado.');
  if(group.kind!=='integrado'&&subject.component==='FG'&&mapRow(subject.area)!==mapRow(group.area)&&
    group.row!=='Otros formatos'&&group.row!=='Otros espacios FG')
    throw Error('Esta materia FG no corresponde al área del agrupamiento.');
  if(group.kind==='troncal'&&subject.component==='FG'&&group.members.length>0&&
    !group.members.some(s=>s.id===subject.id))
    throw Error('Un espacio troncal anual no debe mezclar materias diferentes.');
  // PCI V2: una materia no se duplica en el MISMO cuatrimestre,
  // aunque el agrupamiento destino tenga otro formato o área.
  const targetTerms=group.kind==='troncal'?
   [group.year*2-1,group.year*2]:
   [group.term,...(group.pairedId?[pairedTerm(group.term)]:[])];
  for(const g of draft.groups.filter(g=>g.year===group.year)){
    if(g.id===group.id||g.id===group.pairedId)continue;
    if(g.members.some(s=>s.id===subject.id)&&targetTerms.some(term=>
      Number(g.term)<=term&&Number(g.endTerm)>=term))
      throw Error('Acción no permitida: '+subject.name+
       ' ya figura en C'+g.term+'. Revisá su agrupamiento anterior antes de asignarla de nuevo.');
  }
  if(['laboratorio','integrado'].includes(group.kind)){
    const hours=groupHours(group);
    if(hours!==null&&subject.hours!=null&&hours+Number(subject.hours)>9)
      throw Error('Acción no permitida: el laboratorio superaría las 9 horas cátedra semanales. Elegí otro agrupamiento válido.');
  }
  for(const id of [group.id,group.pairedId].filter(Boolean)){
    const target=draft.groups.find(g=>g.id===id);
    if(target&&!target.members.some(s=>s.id===subject.id))
      target.members.push({id:subject.id,name:subject.name,component:subject.component,
        area:subject.area,year:subject.year,hours:subject.hours??null});
  }
  return draft;
}
export function removeSubject(data,{groupId,subjectId}){
  const draft=guardComposition(data),group=draft.groups.find(g=>g.id===groupId);
  if(!group)throw Error('Agrupamiento inexistente.');
  for(const id of [group.id,group.pairedId].filter(Boolean)){
    const target=draft.groups.find(g=>g.id===id);
    if(target)target.members=target.members.filter(s=>s.id!==subjectId);
  }
  return draft;
}
export function removeGrouping(data,groupId){
  const draft=guardComposition(data),group=draft.groups.find(g=>g.id===groupId);
  if(!group)throw Error('Agrupamiento inexistente.');
  draft.groups=draft.groups.filter(g=>g.id!==group.id&&g.id!==group.pairedId);
  return draft;
}
export function arrangementWarnings(data){
  const draft=guardComposition(data),warnings=[];
  for(const g of draft.groups){
    if(!g.members.length)warnings.push(g.name+' (C'+g.term+'): sin materias');
    if(['laboratorio','integrado'].includes(g.kind)&&g.members.length===1&&
      !approvedSingleGroup(g))
      warnings.push(g.name+' (C'+g.term+'): no alcanza el mínimo de dos materias, salvo excepción normativa V2.');
    if(['laboratorio','integrado'].includes(g.kind)&&groupHours(g)>9)
      warnings.push(g.name+' (C'+g.term+'): supera las 9 horas cátedra.');
    if(g.kind==='troncal'&&g.members.length!==1)
      warnings.push(g.name+' (C'+g.term+'): troncal anual con una materia del nivel.');
    if(g.kind==='integrado'&&!g.members.some(m=>m.component==='FG'))
      warnings.push(g.name+': articulación sin Formación General');
    if(g.kind==='integrado'&&!g.members.some(m=>m.component==='FO'))
      warnings.push(g.name+': articulación sin Formación Orientada');
  }
  return warnings;
}
