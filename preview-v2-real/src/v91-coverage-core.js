(() => {
  let rows=null,loading=null;

  const norm=v=>String(v??'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

  const subjectAliases=new Map([
    ['formacion etica ciudadana','formacion etica y ciudadana'],
    ['educacion artistica artes visuales','artes visuales'],
    ['tecnologia de la informacion','tecnologias de la informacion'],
    ['lengua adicional','lenguas adicionales'],
    ['lenguas adicional','lenguas adicionales']
  ]);
  const subjectKey=v=>{
    const k=norm(v).replace(/\by\b/g,' y ').replace(/\s+/g,' ').trim();
    return subjectAliases.get(k)||k;
  };
  const areaKey=v=>norm(v);
  const uniqueRows=list=>[...new Map((list||[]).filter(Boolean).map(x=>[String(x.id),x])).values()];
  const ratio=(used,total)=>Number(total)?Math.round(Number(used||0)/Number(total)*1000)/10:null;

  async function load(){
    if(rows)return rows;
    if(loading)return loading;
    loading=(async()=>{
      const p=phase();
      if(!p?.loadCurriculum)throw new Error('No está disponible la nueva base curricular V96.');
      await p.loadCurriculum();
      const data=p.getFGCatalog?.()||[];
      rows=data.map(x=>({
        ...x,
        year:Number(x.year)||0,
        _area:areaKey(x.area),
        _subject:subjectKey(x.subject),
        _text:norm(x.text)
      }));
      return rows;
    })().finally(()=>{loading=null});
    return loading;
  }

  function phase(){return window.PCIPhase2V28}
  function memberRows(group){return phase()?.members?.(group)||[]}
  function memberSubjects(group){
    return [...new Set(memberRows(group).map(x=>String(x?.name||'').trim()).filter(Boolean))];
  }
  function areaForGroup(group){return String(group?.area||'').trim()}

  function universeForLevel(area,year){
    if(!rows)return[];
    const ak=areaKey(area);
    return rows.filter(x=>x.year===Number(year)&&x._area===ak);
  }

  function rowsForMember(group,member,levelUniverse){
    const key=subjectKey(member?.name);
    if(!key)return[];
    const exact=levelUniverse.filter(x=>x._subject===key);
    if(exact.length)return exact;

    // Algunos mapas expresan una familia curricular como una sola materia
    // (por ejemplo "Artes"). En ese caso, si no existe una materia exacta
    // en la base, se usa el universo del área de ese nivel.
    if(key==='artes'||areaKey(member?.name)===areaKey(group?.area))return levelUniverse;
    return[];
  }

  // V97: el universo de un agrupamiento se define por las materias FG que
  // efectivamente lo conforman en el Mapa de la Oferta y por el nivel.
  function universeForGroup(group){
    if(!group)return[];
    if(areaForGroup(group)==='Formación Orientada')return foLevelUniverse(group);
    const levelUniverse=universeForLevel(areaForGroup(group),group.year);
    const fgMembers=memberRows(group).filter(x=>x?.origin==='FG');
    if(!fgMembers.length)return levelUniverse;
    const selected=uniqueRows(fgMembers.flatMap(member=>rowsForMember(group,member,levelUniverse)));
    return selected.length?selected:levelUniverse;
  }

  function universeForGroups(groups=[]){
    return uniqueRows((groups||[]).flatMap(g=>universeForGroup(g)));
  }

  function matchesContent(content,candidate){
    if(!content||!candidate)return false;
    if(subjectKey(content.subject)!==candidate._subject)return false;
    const text=norm(content.text);
    if(!text||!candidate._text)return false;
    if(text===candidate._text)return true;
    if(text.length>=18&&candidate._text.includes(text))return true;
    if(candidate._text.length>=18&&text.includes(candidate._text))return true;
    return false;
  }

  function canonicalForContent(content,year=null){
    if(!rows||!content||content.component!=='FG')return[];
    const direct=rows.find(x=>String(x.id)===String(content.id));
    if(direct&&(!year||direct.year===Number(year)))return[direct];
    const subset=rows.filter(x=>(!year||x.year===Number(year))&&subjectKey(content.subject)===x._subject);
    return subset.filter(x=>matchesContent(content,x));
  }

  function foPool(){
    try{return phase()?.getAreaPool?.('Formación Orientada')||[]}
    catch{return[]}
  }
  function explicitYear(v){const n=Number(v);return n>=1&&n<=5?n:0}
  function foHasYear(){return foPool().some(x=>explicitYear(x?.year))}
  function foLevelUniverse(group){
    const pool=foPool();
    if(!pool.length||!foHasYear())return[];
    return pool.filter(x=>explicitYear(x?.year)===Number(group?.year));
  }
  function foKind(label){
    return /historia.*orientad|tecnolog/i.test(String(label||''))?'Materia':'Bloque';
  }
  function foBreakdown(universe,usedIds){
    const map=new Map();
    for(const row of universe){
      const label=String(row.subject||row.block||'Formación Orientada').replace(/^Bloque:\s*/i,'').trim()||'Formación Orientada';
      if(!map.has(label))map.set(label,{label,kind:foKind(label),total:0,used:0,percent:0,axes:new Map()});
      const item=map.get(label);item.total++;
      if(usedIds.has(String(row.id)))item.used++;
      const axis=String(row.axis||'').replace(/^Eje:\s*/i,'').trim();
      if(axis){
        if(!item.axes.has(axis))item.axes.set(axis,{axis,total:0,used:0,percent:0});
        const a=item.axes.get(axis);a.total++;if(usedIds.has(String(row.id)))a.used++;
      }
    }
    return [...map.values()].map(x=>{
      x.percent=x.total?ratio(x.used,x.total):0;
      x.axes=[...x.axes.values()].map(a=>({...a,percent:a.total?ratio(a.used,a.total):0}))
        .sort((a,b)=>a.axis.localeCompare(b.axis,'es'));
      return x;
    }).sort((a,b)=>a.label.localeCompare(b.label,'es'));
  }

  function fgCoverageAgainstUniverse(group,ids=[],universe=[]){
    universe=uniqueRows(universe);
    const universeIds=new Set(universe.map(x=>String(x.id)));
    const used=new Map(),offLevel=new Set(),unmatched=new Set();

    for(const id of [...new Set((ids||[]).map(String))]){
      const content=phase()?.findContent?.(id);
      if(!content||content.component!=='FG')continue;
      const target=canonicalForContent(content,group?.year).filter(x=>universeIds.has(String(x.id)));
      if(target.length){target.forEach(x=>used.set(String(x.id),x));continue}
      const other=canonicalForContent(content,null).filter(x=>x.year!==Number(group?.year));
      if(other.length)offLevel.add(id);else unmatched.add(id);
    }

    const bySubject={};
    for(const row of universe){
      const key=row.subject;
      bySubject[key]=bySubject[key]||{subject:key,total:0,used:0,percent:0};
      bySubject[key].total++;
    }
    for(const row of used.values()){const x=bySubject[row.subject];if(x)x.used++}
    for(const x of Object.values(bySubject))x.percent=x.total?ratio(x.used,x.total):0;

    return {
      basis:'level',component:'FG',area:areaForGroup(group),year:Number(group?.year)||0,
      total:universe.length,used:used.size,
      percent:universe.length?ratio(used.size,universe.length):0,
      bySubject:Object.values(bySubject).sort((a,b)=>a.subject.localeCompare(b.subject,'es')),
      byComponent:[],offLevel:offLevel.size,unmatched:unmatched.size,
      universe,usedRows:[...used.values()]
    };
  }

  function fgCoverageForIds(group,ids=[]){
    return fgCoverageAgainstUniverse(group,ids,universeForGroup(group));
  }

  function foCoverageForIds(group,ids=[]){
    const pool=foPool(),hasYear=foHasYear();
    const levelUniverse=hasYear?foLevelUniverse(group):[];
    const levelIds=new Set(levelUniverse.map(x=>String(x.id)));
    const poolIds=new Set(pool.map(x=>String(x.id)));
    const requested=[...new Set(ids||[])].map(String);
    const usedPool=new Set(requested.filter(id=>poolIds.has(id)));

    if(!hasYear){
      return {
        basis:'trajectory',component:'FO',area:'Formación Orientada',year:Number(group?.year)||0,
        total:0,used:usedPool.size,percent:null,bySubject:[],
        byComponent:foBreakdown(pool,usedPool),offLevel:0,unmatched:requested.filter(id=>!poolIds.has(id)).length,
        universe:[],usedRows:[],
        trajectoryTotal:pool.length,trajectoryUsed:usedPool.size,
        trajectoryPercent:pool.length?ratio(usedPool.size,pool.length):0,
        levelBasisAvailable:false
      };
    }

    const used=new Set(requested.filter(id=>levelIds.has(id)));
    const offLevel=new Set(requested.filter(id=>poolIds.has(id)&&!levelIds.has(id)));
    return {
      basis:'level',component:'FO',area:'Formación Orientada',year:Number(group?.year)||0,
      total:levelUniverse.length,used:used.size,
      percent:levelUniverse.length?ratio(used.size,levelUniverse.length):0,
      bySubject:[],byComponent:foBreakdown(levelUniverse,used),
      offLevel:offLevel.size,unmatched:requested.filter(id=>!poolIds.has(id)).length,
      universe:levelUniverse,usedRows:levelUniverse.filter(x=>used.has(String(x.id))),
      levelBasisAvailable:true
    };
  }

  function coverageForIds(group,ids=[]){
    return areaForGroup(group)==='Formación Orientada'?foCoverageForIds(group,ids):fgCoverageForIds(group,ids);
  }

  const unionIds=groups=>[...new Set((groups||[]).flatMap(g=>g?.data?.contents||[]).map(String))];

  function coverageForGroups(group,groups=[]){
    if(areaForGroup(group)==='Formación Orientada')return coverageForIds(group,unionIds(groups));
    return fgCoverageAgainstUniverse(group,unionIds(groups),universeForGroups(groups));
  }

  // Cobertura anual por materia y nivel. La unión evita contar dos veces un
  // contenido que aparezca en C1/C2, en varios laboratorios o en varios planes.
  function groupingLevelCoverage(group,allGroups=[]){
    const relevant=(allGroups||[]).filter(g=>g&&g.area===group?.area&&Number(g.year)===Number(group?.year));
    return coverageForGroups(group,relevant);
  }

  function formatTypeCoverage(group,allGroups=[]){
    const relevant=(allGroups||[]).filter(g=>g&&g.area===group?.area&&Number(g.year)===Number(group?.year)&&g.type===group?.type);
    return coverageForGroups(group,relevant);
  }

  function trajectoryCoverage(area,allGroups=[]){
    const relevant=(allGroups||[]).filter(g=>g?.area===area);
    if(area==='Formación Orientada'){
      const pool=foPool(),used=new Set(unionIds(relevant).map(String).filter(id=>pool.some(x=>String(x.id)===id)));
      return {
        basis:'trajectory',component:'FO',area,total:pool.length,used:used.size,
        percent:pool.length?ratio(used.size,pool.length):0,
        bySubject:[],byComponent:foBreakdown(pool,used)
      };
    }
    const universe=(rows||[]).filter(x=>x._area===areaKey(area));
    const used=new Map();
    for(const g of relevant){
      for(const id of [...new Set(g?.data?.contents||[])]){
        const content=phase()?.findContent?.(id);
        if(!content||content.component!=='FG')continue;
        canonicalForContent(content,g.year).filter(x=>x._area===areaKey(area)).forEach(x=>used.set(String(x.id),x));
      }
    }
    const bySubject={};
    for(const row of universe){
      bySubject[row.subject]=bySubject[row.subject]||{subject:row.subject,total:0,used:0,percent:0};
      bySubject[row.subject].total++;
    }
    for(const row of used.values()){if(bySubject[row.subject])bySubject[row.subject].used++}
    for(const x of Object.values(bySubject))x.percent=x.total?ratio(x.used,x.total):0;
    return {
      basis:'trajectory',component:'FG',area,total:universe.length,used:used.size,
      percent:universe.length?ratio(used.size,universe.length):0,
      bySubject:Object.values(bySubject).sort((a,b)=>a.subject.localeCompare(b.subject,'es')),byComponent:[]
    };
  }

  function formatCoverage(group){return coverageForIds(group,group?.data?.contents||[])}

  function planCoverage(group,ids=[]){
    const annual=coverageForIds(group,ids);
    const grouping=formatCoverage(group);
    const dual=['laboratorio','taller'].includes(String(group?.type||'').toLowerCase());
    const basisLabel=annual?.basis==='trajectory'?'Trayectoria':`Nivel ${Number(group?.year)||''}`;

    const groupingSubjects=new Map((grouping.bySubject||[]).map(x=>[subjectKey(x.subject),x]));
    const subjectRows=(annual.bySubject||[]).map(x=>{
      const g=groupingSubjects.get(subjectKey(x.subject))||{used:0};
      const groupingTotal=Number(g.used||0);
      return {
        label:x.subject,kind:'Materia',
        planUsed:Number(x.used||0),
        annualTotal:Number(x.total||0),
        annualPercent:Number(x.percent||0),
        groupingTotal,
        groupingPercent:groupingTotal?ratio(x.used,groupingTotal):null,
        axes:[]
      };
    });

    const groupingComponents=new Map((grouping.byComponent||[]).map(x=>[String(x.label),x]));
    const componentRows=(annual.byComponent||[]).map(x=>{
      const g=groupingComponents.get(String(x.label))||{used:0,axes:[]};
      const groupingTotal=Number(g.used||0);
      const gAxes=new Map((g.axes||[]).map(a=>[String(a.axis),a]));
      return {
        label:x.label,kind:x.kind||'Componente',
        planUsed:Number(x.used||0),
        annualTotal:Number(x.total||0),
        annualPercent:Number(x.percent||0),
        groupingTotal,
        groupingPercent:groupingTotal?ratio(x.used,groupingTotal):null,
        axes:(x.axes||[]).map(a=>{
          const ga=gAxes.get(String(a.axis))||{used:0};
          const gt=Number(ga.used||0);
          return {
            label:a.axis,planUsed:Number(a.used||0),annualTotal:Number(a.total||0),
            annualPercent:Number(a.percent||0),groupingTotal:gt,
            groupingPercent:gt?ratio(a.used,gt):null
          };
        })
      };
    });

    return {
      annual,grouping,dual,basisLabel,
      rows:subjectRows.length?subjectRows:componentRows,
      bySubject:subjectRows,byComponent:componentRows,
      level:annual,space:grouping,
      levelUsed:Number(annual.total)?Number(annual.used||0):Number(annual.trajectoryUsed||annual.used||0),
      levelTotal:Number(annual.total)||Number(annual.trajectoryTotal||0),
      spaceUsed:Number(grouping.used||0)
    };
  }

  async function ready(){await load();return api}

  const api={
    ready,load,rows:()=>rows||[],normalize:norm,subjectKey,memberSubjects,areaForGroup,
    universeForLevel,universeForGroup,universeForGroups,canonicalForContent,coverageForIds,formatCoverage,
    groupingLevelCoverage,formatTypeCoverage,trajectoryCoverage,planCoverage,
    foHasYear,foPool,foBreakdown
  };
  window.PCICoverageV91=api;
  window.addEventListener('pci-app-ready',()=>ready().catch(e=>console.error('[V97 coverage]',e)));
})();
