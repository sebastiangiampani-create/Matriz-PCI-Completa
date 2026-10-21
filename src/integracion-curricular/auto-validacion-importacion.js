/**
 * Migración automática FG histórica -> FG V2, con cobertura sobre V2.
 *
 * Política institucional:
 *  1. Los contenidos ya ubicados se homologan automáticamente. No se obliga
 *     a la escuela a repetir una validación.
 *  2. Un contenido histórico puede convertirse en N referencias V2.
 *  3. Cada vínculo importado queda etiquetado "validado automáticamente
 *     desde la versión anterior · conviene revisar".
 *  4. El PCI vigente usa EXCLUSIVAMENTE IDs curriculares V2.
 *  5. El archivo exportado contiene un ARCHIVO ÍNTEGRO del PCI anterior
 *     (planes, secuencias, ubicaciones, contenidos sin equivalencia y texto).
 *  6. Las correcciones explícitas hechas luego tienen precedencia sobre la
 *     homologación automática: nunca se restaura silenciosamente lo corregido.
 *
 * Nada de esto accede a Supabase, realiza escrituras ni toca el estado fuente.
 */
import {
  analyzeAutomaticFgMatches,AUTO_FG_SOURCE,AUTO_FG_TARGET,AUTO_FG_METHOD
} from './auto-homologacion-fg.js';
import {mappingKey,approvedReferenceIds} from './homologaciones.js';

export const AUTO_VALIDATION_VERSION='fg-auto-import-v2/1';
export const AUTO_VALIDATION_LABEL='Importado y validado desde la versión anterior · Conviene revisar';

const list=x=>Array.isArray(x)?x:[];
const clone=x=>JSON.parse(JSON.stringify(x));
const clean=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const uniq=x=>[...new Set(list(x).map(String))];
const perYear=n=>Number.isInteger(Number(n))&&Number(n)>=1&&Number(n)<=5;
const localKey=(area,year,id)=>mappingKey(area,year,id);
function ensureValidInput({legacyState,orientationId,matrixRows,v2FgRows}){
  if(!legacyState||typeof legacyState!=='object'||!legacyState.areas||
      Array.isArray(legacyState.areas))throw new TypeError('Falta la Matriz histórica completa.');
  if(!orientationId||typeof orientationId!=='string')throw new TypeError('Falta la orientación.');
  if(!Array.isArray(matrixRows)||!Array.isArray(v2FgRows)||!v2FgRows.length)
    throw new TypeError('No se cargaron las dos bases curriculares.');
  const ids=new Set();
  for(const row of v2FgRows){
    const id=String(row.id||'');
    if(!id||ids.has(id)||!perYear(row.year))throw new Error('La referencia FG V2 tiene ID o año inválido.');
    ids.add(id);
  }
}
function validTarget(source,row,year){
  return !!source&&!!row&&Number(row.year)===Number(year)&&
    clean(source.area)===clean(row.area)&&clean(source.subject)===clean(row.subject);
}
function statusRow(original,source,rawRefs,existing,manual){
  return {
    legacyId:String(original.matrixId),year:Number(original.year),
    area:original.area,subject:source?.subject||'',
    inheritedStatus:original.status,
    selectedV2Ids:rawRefs,
    decision:existing?'existing-approved':manual?'corrected-manually':'auto-validated',
    reviewRecommended:!existing,
    label:AUTO_VALIDATION_LABEL
  };
}
function buildRecord(row,ids,source,reference,originalStatus){
  const r=ids.map(id=>reference.get(String(id)));
  if(!ids.length||r.some(x=>!validTarget(source,x,row.year)))
    throw new Error('No es válido importar contenidos de otra materia, área o año.');
  return {
    status:'approved',
    area:row.area,year:Number(row.year),matrixId:String(row.matrixId),
    referenceId:ids[0],referenceIds:ids,
    referenceVersion:AUTO_FG_TARGET,
    sourceVersion:AUTO_FG_SOURCE,
    sourceSubject:source.subject,targetSubject:r[0].subject,
    mappingType:ids.length>1?'one-to-many':'one-to-one',
    reviewer:'Validación automática institucional · importación Matriz PCI',
    reason:'Equivalencia importada automáticamente desde la Matriz anterior, tomando como referencia materia y año de ubicación. Revisión sugerida, no obligatoria.',
    validationMethod:AUTO_VALIDATION_VERSION,
    autoValidated:true,
    legacyValidated:true,
    reviewRecommended:true,
    label:AUTO_VALIDATION_LABEL,
    matchKind:originalStatus,
    provenance:{
      legacyContentId:String(row.matrixId),legacyArea:source.area,
      legacySubject:source.subject,referenceYear:Number(row.year),
      sourceVersion:AUTO_FG_SOURCE,targetVersion:AUTO_FG_TARGET,
      engineMethod:AUTO_FG_METHOD
    }
  };
}
function buildConvertedAreas({areas,approvedMappings,matrixRows,v2FgRows}){
  const source=new Map(matrixRows.map(r=>[String(r.id),r]));
  const reference=new Map(v2FgRows.map(r=>[String(r.id),r]));
  const result={},plansRetained=[];
  for(const [containerArea,block] of Object.entries(areas)){
    const groups=list(block?.groups).map(g=>{
      const year=Number(g.level),validated=new Set(),orphans=[];
      for(const id of uniq(g.items)){
        const old=source.get(id);
        const mapping=approvedMappings[localKey(old?.area||containerArea,year,id)];
        const ids=approvedReferenceIds(mapping);
        if(ids.length){
          for(const v of ids){
            const target=reference.get(v);
            if(validTarget(old,target,year))validated.add(v);
          }
        }else orphans.push(id);
      }
      for(const id of uniq(g.fgV2ContentIds)){
        const row=reference.get(id);
        if(row&&Number(row.year)===year)validated.add(id);
      }
      const plans=list(g.plansBimestrales).map(plan=>{
        const contentIds=new Set(),unconverted=[];
        for(const id of uniq(plan.contentIds)){
          const old=source.get(id);
          const mapping=approvedMappings[localKey(old?.area||containerArea,year,id)];
          const targets=approvedReferenceIds(mapping);
          if(!targets.length){unconverted.push(id);continue;}
          for(const v of targets){
            if(validTarget(old,reference.get(v),year))contentIds.add(v);
          }
        }
        // Preservar cada propiedad del plan: nombre, objetivos, etapas,
        // actividades, recursos, etc. Solo cambiar el campo curricular
        // activo a IDs V2; no tocar el plan histórico del respaldo.
        const out={...clone(plan),contentIds:[...contentIds],
          curriculumCatalog:AUTO_FG_TARGET,
          legacyConversion:{sourceVersion:AUTO_FG_SOURCE,
            automaticallyValidated:true,reviewRecommended:true,
            convertedReferenceCount:contentIds.size,
            unresolvedLegacyCount:unconverted.length,
            label:AUTO_VALIDATION_LABEL}};
        plansRetained.push({area:containerArea,groupId:String(g.id),planNumber:plan.number,
          originalPlan:clone(plan),convertedPlan:clone(out)});
        return out;
      });
      const group={...clone(g),
        items:[...validated],fgV2ContentIds:[...validated],
        plansBimestrales:plans,
        curriculumCatalog:AUTO_FG_TARGET,
        legacyConversion:{sourceVersion:AUTO_FG_SOURCE,
          originGroupId:String(g.id),originArea:containerArea,
          automaticallyValidated:true,reviewRecommended:true,
          matchedV2Count:validated.size,unresolvedLegacyCount:orphans.length,
          label:AUTO_VALIDATION_LABEL}};
      return group;
    });
    result[containerArea]={...clone(block),groups};
  }
  return {areas:result,plansRetained};
}
function coverageOfficial({areas,v2FgRows}){
  const idx=new Map();
  for(const row of v2FgRows){
    const key=JSON.stringify([clean(row.area),Number(row.year)]);
    if(!idx.has(key))idx.set(key,{area:row.area,year:Number(row.year),ids:new Set(),used:new Set()});
    idx.get(key).ids.add(String(row.id));
  }
  const ref=new Map(v2FgRows.map(row=>[String(row.id),row]));
  for(const block of Object.values(areas)){
    for(const g of list(block?.groups)){
      for(const id of uniq(g.items)){
        const row=ref.get(id);
        if(!row||Number(row.year)!==Number(g.level))continue;
        const key=JSON.stringify([clean(row.area),Number(row.year)]);
        idx.get(key)?.used.add(id);
      }
    }
  }
  return [...idx.values()].map(r=>({
    area:r.area,year:r.year,used:r.used.size,total:r.ids.size,
    percent:r.ids.size?Math.round(r.used.size/r.ids.size*1000)/10:null,
    referenceVersion:AUTO_FG_TARGET,
    basis:'Contenidos FG V2, únicos por área y año',
    displayStatus:AUTO_VALIDATION_LABEL
  })).sort((a,b)=>a.year-b.year||a.area.localeCompare(b.area,'es'));
}
/**
 * Correcciones institucionales posteriores, voluntarias:
 * manualOverrides[mappingKey] = {referenceIds:['v2-id',...]}.
 * Un array vacío excluye explícitamente la equivalencia: jamás vuelve sola.
 */
export function automaticallyValidateImportedFg({
  legacyState,orientationId,matrixRows,v2FgRows,
  existingApprovals={},manualOverrides={}
}){
  ensureValidInput({legacyState,orientationId,matrixRows,v2FgRows});
  const initial=clone(legacyState);
  const source=new Map(matrixRows.map(r=>[String(r.id),r]));
  const reference=new Map(v2FgRows.map(r=>[String(r.id),r]));
  const review=analyzeAutomaticFgMatches({
    areas:initial.areas,matrixRows,v2FgRows,orientationId,
    approvedMappings:existingApprovals,maxReferences:4
  });
  const mappings={},decisions=[],unresolved=[];
  for(const row of review.rows){
    const sourceRow=source.get(row.matrixId);
    const key=localKey(row.area,row.year,row.matrixId);
    const existing=existingApprovals[key];
    const overridden=Object.hasOwn(manualOverrides,key);
    let ids=overridden?uniq(manualOverrides[key]?.referenceIds):
      existing?approvedReferenceIds(existing):uniq(row.references.map(r=>r.id));
    // En relaciones de texto exacto con 2+ destinos también se importan
    // todas las referencias válidas, sin obligar a la escuela a decidir.
    if(!sourceRow){
      unresolved.push({key,reason:'Contenido histórico no encontrado',matrixId:row.matrixId});
      continue;
    }
    ids=ids.filter(id=>validTarget(sourceRow,reference.get(id),row.year));
    // Corrección explícita con referencia inválida: detener en vez de
    // perder silenciosamente una decisión escolar.
    if(overridden&&ids.length!==uniq(manualOverrides[key]?.referenceIds).length)
      throw new Error('Corrección institucional con IDs ajenos al año, área o materia.');
    if(existing&&ids.length!==approvedReferenceIds(existing).length&&!overridden)
      throw new Error('Homologación previa invalidada: requiere conservar el registro original.');
    if(ids.length){
      mappings[key]=existing&&!overridden?clone(existing):
        buildRecord(row,ids,sourceRow,reference,row.status);
    }else{
      unresolved.push({key,matrixId:row.matrixId,year:row.year,area:row.area,
        source:clone(sourceRow),reason:overridden?
          'Equivalencia excluida por corrección institucional':
          'Sin equivalencia V2 segura: se conserva en el archivo histórico'});
    }
    decisions.push(statusRow(row,sourceRow,ids,!!existing,!overridden?false:overridden));
  }
  const converted=buildConvertedAreas({
    areas:initial.areas,approvedMappings:mappings,matrixRows,v2FgRows
  });
  const coverage=coverageOfficial({areas:converted.areas,v2FgRows});
  const summary={
    legacyContentsAnalyzed:review.summary.placedOriginals,
    autoValidated:decisions.filter(x=>x.decision==='auto-validated'&&x.selectedV2Ids.length>0).length,
    existingValidated:decisions.filter(x=>x.decision==='existing-approved').length,
    manuallyCorrected:decisions.filter(x=>x.decision==='corrected-manually').length,
    oneToMany:decisions.filter(x=>x.selectedV2Ids.length>1).length,
    withoutV2Match:unresolved.length,
    curriculumV2Unique:coverage.reduce((n,r)=>n+r.used,0),
    curriculumV2Prescribed:coverage.reduce((n,r)=>n+r.total,0),
    plansPreserved:converted.plansRetained.length,
    autoValidationRequiresUserApproval:false
  };
  return {
    validationVersion:AUTO_VALIDATION_VERSION,
    schoolName:initial.schoolName||'',
    orientationId,
    status:'automatically-validated-with-optional-review',
    notice:AUTO_VALIDATION_LABEL,
    sourceVersion:AUTO_FG_SOURCE,targetVersion:AUTO_FG_TARGET,
    summary,
    approvedMappings:mappings,
    decisions,unresolved,
    coverageOnV2:coverage,
    currentFg:{
      curriculumCatalog:AUTO_FG_TARGET,
      schoolName:initial.schoolName||'',
      orientation:orientationId,
      areas:converted.areas
    },
    // El archivo fuente y el catálogo textual se guardan tal cual.
    // Así exportar el currículo NUEVO no descarta ningún trabajo
    // anterior, aunque un texto antiguo no tenga equivalencia.
    originalArchive:{
      sourceVersion:AUTO_FG_SOURCE,
      sourceSchemaVersion:initial.schemaVersion??null,
      originalState:initial,
      originalCatalog:clone(matrixRows),
      missingMappings:clone(unresolved)
    }
  };
}
/**
 * Exportación INTEGRAL, sin fugas de IDs históricos al catálogo V2 activo.
 * Incluye dos secciones explícitas: PCI NUEVO y RESGUARDO ANTERIOR.
 */
export function exportValidatedFgV2(validated){
  if(validated?.validationVersion!==AUTO_VALIDATION_VERSION ||
     validated?.currentFg?.curriculumCatalog!==AUTO_FG_TARGET ||
     !validated.originalArchive?.originalState)
    throw new TypeError('La validación automática no está completa.');
  return clone({
    exportFormat:'pci-matriz-v2-con-resguardo-original/1',
    validationVersion:AUTO_VALIDATION_VERSION,
    validationNotice:AUTO_VALIDATION_LABEL,
    coverageCatalog:AUTO_FG_TARGET,
    schoolName:validated.schoolName,orientationId:validated.orientationId,
    summary:validated.summary,
    coverageOnV2:validated.coverageOnV2,
    currentCurriculumV2:validated.currentFg,
    correspondenceAudit:{
      approvedMappings:validated.approvedMappings,
      decisions:validated.decisions,unresolved:validated.unresolved
    },
    historicalArchiveFull:validated.originalArchive
  });
}
