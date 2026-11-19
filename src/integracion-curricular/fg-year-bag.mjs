/**
 * Bolsa FG con procedencia explícita: se distingue el catálogo histórico
 * (sin año por fila) de los contenidos priorizados FG v103 (1.º a 5.º).
 *
 * Los IDs v103 se guardan en group.fgV2ContentIds, NO en group.items.
 * Esto permite que ambos procesos convivan sin reinterpretar la Matriz vieja.
 * Una ubicación fuera del año de origen se permite pedagógicamente, pero
 * NO suma a la cobertura oficial del nivel de destino.
 */
export const FG_YEARS=Object.freeze([1,2,3,4,5]);
const clean=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const list=x=>Array.isArray(x)?x:[];
const uniq=x=>[...new Set(list(x).map(String))];

export function officialFgRowsFor({rows,area,year=0,query='',subject='',axis=''}) {
  const y=Number(year);
  if (!Number.isInteger(y) || (y!==0&&!FG_YEARS.includes(y)))
    throw new RangeError('Año FG inválido');
  const a=clean(area),q=clean(query);
  return list(rows).filter(row=>
    Number.isInteger(Number(row?.year)) && FG_YEARS.includes(Number(row.year)) &&
    clean(row.area)===a &&
    (y===0||Number(row.year)===y) &&
    (!subject||row.subject===subject) && (!axis||row.axis===axis) &&
    (!q||clean([row.subject,row.axis,row.subaxis,row.text].join(' ')).includes(q))
  );
}

export function officialIdsInGroup(group) {
  return uniq(group?.fgV2ContentIds);
}

/**
 * Actualiza únicamente el borrador paralelo v103. No elimina contenidos
 * de otra tarjeta ni cambia los IDs históricos de la Matriz PCI.
 */
export function stageOfficialFgInGroup(group,ids,rows,area) {
  if (!group || typeof group!=='object' || !Array.isArray(group.items))
    throw new Error('Agrupamiento FG inválido.');
  const byId=new Map(officialFgRowsFor({rows,area}).map(row=>[String(row.id),row]));
  const next=uniq(ids);
  if (!next.length || next.some(id=>!byId.has(id)))
    throw new Error('Los contenidos seleccionados no pertenecen a esta Formación General oficial.');
  const old=officialIdsInGroup(group);
  group.fgV2ContentIds=uniq([...old,...next]);
  return {added:group.fgV2ContentIds.length-old.length,total:group.fgV2ContentIds.length};
}

export function removeOfficialFgFromGroup(group,id) {
  if (!group || typeof group!=='object') throw new Error('Agrupamiento FG inválido.');
  group.fgV2ContentIds=officialIdsInGroup(group).filter(x=>x!==String(id));
  return group.fgV2ContentIds.length;
}

/**
 * El denominador es el catálogo oficial del área+NIVEL.
 * Se cuentan IDs únicos ubicados en agrupamientos del nivel. Contenidos
 * de otro año pueden estar en la tarjeta, pero NO cuentan para este nivel.
 * Esta es una vista del borrador v103, no una migración de cobertura histórica.
 */
export function officialFgCoverageAtYear({areas,rows,area,year}) {
  const y=Number(year);
  if (!FG_YEARS.includes(y)) throw new RangeError('Nivel FG inválido');
  const universe=officialFgRowsFor({rows,area,year:y});
  const ids=new Set(universe.map(x=>String(x.id)));
  const used=new Set();
  const otherYears=new Set();
  for(const group of list(areas?.[area]?.groups)) {
    if(Number(group?.level)!==y)continue;
    for(const id of officialIdsInGroup(group)) {
      if(ids.has(id))used.add(id);
      else otherYears.add(id);
    }
  }
  return {
    year:y,used:used.size,total:universe.length,
    percent:universe.length?Math.round(used.size*1000/universe.length)/10:null,
    placedFromOtherYears:otherYears.size,
    source:'fg-sec-aprende-v2/1'
  };
}
