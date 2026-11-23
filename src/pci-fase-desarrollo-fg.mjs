/**
 * Herencia segura Fase 1 → Fase 2 para agrupamientos FG nuevos de Media.
 * Solamente agrega a la unidad FG DEL MISMO PCI los grupos aún ausentes.
 * No altera ni borra contenidos, grupos, secuencias o planes preexistentes.
 */
import {FG_UNIT_SCHEMA} from './orientaciones-release-core.mjs';
const copy=v=>JSON.parse(JSON.stringify(v));
const list=v=>Array.isArray(v)?v:[];
const STAGES=['punto_partida','indagacion','produccion','evaluacion'];
const makePlan=i=>({
 name:'Plan '+(i+1),synopsis:'',objectives:'',
 stages:Object.fromEntries(STAGES.map(x=>[x,{description:''}]))
});
export function proposedFgAreas(composition){
 return [...new Set(list(composition?.groups)
  .filter(g=>list(g.members).some(m=>m.component==='FG')&&g.area)
  .map(g=>String(g.area)))];
}
export function emptyFgAreaUnit(pci,area){
 if(!pci?.pci_id||!pci?.legacy_sha256||!pci?.orientation_id||!pci.school_id)
  throw Error('Falta la identidad del PCI para abrir su Desarrollo FG.');
 if(!String(area).trim())throw Error('El área del agrupamiento FG es obligatoria.');
 return {
  schema:FG_UNIT_SCHEMA,school_id:Number(pci.school_id),
  pci_id:pci.pci_id,orientation_id:pci.orientation_id,
  original_sha256:pci.legacy_sha256,area:String(area),
  originType:'area-propuesta-desde-constructor',groups:[],
  curriculumCatalog:'fg-sec-aprende-v2/1'
 };
}
export function inheritFgComposition({unit,composition,pci,area}){
 if(!unit||unit.schema!==FG_UNIT_SCHEMA||unit.pci_id!==pci.pci_id||
   Number(unit.school_id)!==Number(pci.school_id)||
   unit.original_sha256!==pci.legacy_sha256||unit.orientation_id!==pci.orientation_id||
   unit.area!==area||!Array.isArray(unit.groups))
   throw Error('No se puede heredar una composición FG de otro PCI o área.');
 if(composition?.pciId!==pci.pci_id||Number(composition?.schoolId)!==Number(pci.school_id)||
   composition?.orientationId!==pci.orientation_id)
   throw Error('La composición de la Fase 1 pertenece a otro PCI.');
 const next=copy(unit),historical=copy(unit.groups),added=[],updated=[],conflicts=[];
 const candidates=list(composition.groups).filter(g=>g.area===area&&
   list(g.members).some(m=>m.component==='FG'));
 for(const g of candidates){
  const same=next.groups.find(x=>String(x.id)===String(g.id));
  const members=list(g.members).map(m=>({
   id:String(m.id),name:String(m.name),component:String(m.component),
   year:Number(m.year),hours:m.hours??null
  }));
  if(same){
   // Solo completar la composición de una plantilla FG ya existente,
   // y solo si no contiene trabajo curricular. Nunca alterar planes.
   const previous=list(same.curricularSubjects);
   const old=JSON.stringify(previous.map(m=>m.id).sort());
   const current=JSON.stringify(members.map(m=>m.id).sort());
   if(old===current)continue;
   const noContents=list(same.items).length===0;
   const noTexts=!['objective','objectives','synopsis','context','practiceAxis','summary']
    .some(k=>typeof same[k]==='string'&&same[k].trim());
   const noPlanWork=list(same.plansBimestrales).every(p=>
    !['objectives','synopsis','context'].some(k=>typeof p?.[k]==='string'&&p[k].trim())&&
    !list(p?.contentIds).length &&
    !Object.values(p?.stages||{}).some(stage=>typeof stage==='string'?stage.trim():
     Object.values(stage||{}).some(value=>typeof value==='string'&&value.trim())));
   if(g.source==='historical-copy'&&String(g.legacyGroupId)===String(same.id)&&
     previous.length===0&&noContents&&noTexts&&noPlanWork){
    same.curricularSubjects=members;
    updated.push(String(g.name));
   }else{
    conflicts.push(String(g.name));
   }
   continue;
  }
  next.groups.push({
   id:String(g.id),name:String(g.name),kind:String(g.kind),
   level:Number(g.year),startTerm:Number(g.term),endTerm:Number(g.endTerm),
   area:String(area),items:[],curricularSubjects:members,
   sourcePhase:'constructor-curricular-v2',summary:'',synopsis:'',
   plansBimestrales:Array.from({length:4},(_,i)=>makePlan(i))
  });
  added.push(String(g.name));
 }
 // Importante: no quitar grupos existentes que ya no figuren en el mapa.
 if(next.groups.length<historical.length)throw Error('No se puede perder trabajo anterior.');
 return {unit:next,added,updated,conflicts,changed:added.length>0||updated.length>0};
}
