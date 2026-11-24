import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,relative,extname,sep} from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.txt':'text/plain','.png':'image/png'};
const server=createServer(async(req,res)=>{
 try{
  const full=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));
  const rel=relative(root,full);if(rel==='..'||rel.startsWith('..'+sep))throw Error('Ruta fuera del repositorio');
  const body=await readFile(full);res.writeHead(200,{'Content-Type':mime[extname(full)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 }catch(error){res.writeHead(404);res.end(error.message)}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(process.env.CHROME_BIN?{headless:true,executablePath:process.env.CHROME_BIN}:{headless:true});
await mkdir('test-artifacts/v2-modalidades',{recursive:true});
try{
 for(const [model,filter,levels,track] of [
  ['tecnica','specialty=computacion',6,'Computación'],
  ['ba15','orientation=economia_administracion',4,'Economía y Administración']
 ]){
  const page=await browser.newPage({viewport:{width:1600,height:1080}});
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)requests.push({url:r.url(),status:r.status()})});
  const id=model==='tecnica'?'v2-tecnica-computacion':'v2-ba15-economia';
  await page.goto(origin+'/revision-v2-modalidad.html?model='+model+'&'+filter+'&pci='+id+'&school=Escuela+de+prueba',{waitUntil:'domcontentloaded'});
  try{await page.locator('#offer.active').waitFor({timeout:16000})}
  catch(error){
    const diag=await page.evaluate(()=>({
      modal:window.__V2_MODAL?.model||null,level:window.__V2_MODAL?.levels,
      baseInit:typeof window.__pciBaseInit,screen:typeof window.screen,
      map:!!window.V2ModalMap,phase2:!!window.PCIPhase2V28,
      scripts:[...document.scripts].map(x=>({id:x.id,type:x.type,len:x.textContent?.length,head:x.textContent?.slice(0,100)})).slice(0,25),
      bodyTail:document.body?.textContent?.slice(-900)
    }));
    console.log('BOOT DIAGNOSTIC '+model,JSON.stringify({diag,errors,requests}));
    throw error;
  }
  assert.equal(await page.locator('#matrix .grid.levels .level').count(),levels,'V2 debe renderizar la cantidad de niveles de la modalidad');
  assert.equal(await page.locator('#matrix .term').count(),levels*2+1,'V2 debe renderizar la cantidad de cuatrimestres de la modalidad');
  const paridad=await page.evaluate(()=>window.__V2_PARIDAD);
  const manifiesto=JSON.parse(await readFile('src/v2-familia/manifiesto-paridad-v2.json','utf8'));
  const esperados=manifiesto.modulos.filter(m=>m.modulo!==manifiesto.fase2&&m.archivos).map(m=>m.archivos[model]);
  assert.deepEqual(paridad.cargados.map(x=>x.archivo),esperados,'La modalidad debe cargar la misma secuencia de módulos que V2');
  assert.equal(paridad.cargados.some(x=>x.estado==='pendiente-normativa'),false,'No cargar reglas de Media sin normativa');
  const filas=(await page.locator('#matrix .rowlabel').allTextContents()).join(' ');
  assert.equal(/Opción: 10 laboratorios|Opción: 12 laboratorios/.test(filas),false,'No mostrar la opción de Sociales de Media');
  const rows=await page.locator('#matrix .rowlabel').allTextContents();
  assert.ok(rows.some(t=>t.includes('Ciencias Naturales')),'Conservar la fila de Ciencias Naturales');
  if(model==='tecnica'){
    assert.ok(rows.some(t=>t.includes('Espacios de integración')),'Técnica usa Espacios de integración');
    assert.ok(rows.some(t=>t.includes('Espacios formativos')),'Técnica usa Espacios formativos');
    assert.equal(rows.some(t=>t.includes('Laboratorios · Ciencias Naturales')),false,'Técnica no debe copiar rótulo Laboratorio de Media');
  }
  if(model==='ba15'){
    const fg=await page.evaluate(async()=>{const p=window.PCIPhase2V28;await p.loadCurriculum();return p.getFGCatalog().length;});
    assert.ok(fg>=1126,'BA15 conserva los 1126 IDs FG originales y añade saberes desagregados');
  }
  const bank=page.locator('#bagContent [data-sub]');
  assert.ok(await bank.count()>2,'Bolsa V2 debe ofrecer materias del nivel');
  await page.evaluate(()=>{
   const from=document.querySelector('#bagContent [data-sub]'),id=from?.dataset.sub;
   const item=window.__V2_MODAL.subjects.find(x=>x.id===id);
   const rows=window.V2ModalMap.rowDefs();
   const row=rows.find(r=>{
    const slot=r.annual?r.k+'-n'+item.year:r.k+'-c'+(item.year*2-1);
    return window.V2ModalMap.canAssign(slot,item)[0]});
   if(!row)throw Error('No hay casillero compatible para '+item?.name);
   const slot=row.annual?row.k+'-n'+item.year:row.k+'-c'+(item.year*2-1);
   const target=document.querySelector('[data-slot="'+slot+'"]');
   const dt=new DataTransfer();
   from.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:dt}));
   target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
   target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
   if(!document.querySelector('[data-map-id="'+id+'"]'))throw Error('No se asignó la materia con drop V2');
  });
  assert.equal(await page.locator('#matrix [data-map-id]').count()>0,true);
  const foField=await page.evaluate(async()=>{
    const s=window.__V2_MODAL.subjects.find(x=>x.origin==='FO'&&x.year>=2);
    if(!s)throw Error('La bolsa FO de la modalidad está vacía');
    const row=window.V2ModalMap.rowDefs().find(r=>{
      const slot=r.k+(r.annual?'-n':'-c')+(r.annual?s.year:s.year*2-1);
      return window.V2ModalMap.canAssign(slot,s)[0]});
    if(!row)throw Error('No hay espacio FO compatible para '+s.name);
    const slot=row.k+(row.annual?'-n':'-c')+(row.annual?s.year:s.year*2-1);
    window.V2ModalMap.assign(slot,s.id);
    const p=window.PCIPhase2V28;
    await p.loadCurriculum();
    const g=p.gb(slot),pool=p.getPool(g.area).filter(c=>c.component==='FO');
    if(!pool.length)throw Error('El espacio FO no tiene contenidos de su base específica');
    if(pool.some(c=>c.area!==g.area))throw Error('Se mezclaron campos de contenidos FO');
    return {area:g.area,slot,contents:pool.length};
  });
  assert.ok(foField.contents>0,'El espacio FO debe seleccionar contenidos de su campo curricular');
  const phase2=await page.evaluate(async()=>{
   const p=window.PCIPhase2V28;
   if(!p)throw Error('No se instaló la Fase 2 V2');
   await p.loadCurriculum();
   return {groups:p.groups().length,fg:p.getFGCatalog().length,fo:p.getFOCatalog().length};
  });
  assert.ok(phase2.groups>15,'Fase 2 V2 debe generar agrupamientos desde el mapa del modelo');
  assert.ok(phase2.fg>0,'La Fase 2 debe tener contenidos FG');
  assert.ok(phase2.fo>0,'La Fase 2 debe tener contenidos específicos de la modalidad');
  if(model==='ba15'){
    const bags=await page.evaluate(async()=>{
      const p=window.PCIPhase2V28;
      await p.loadCurriculum();
      return {
        tecnologia:p.getAreaPool('Tecnologías').filter(x=>x.component==='FG').length,
        artes:p.getAreaPool('Artes').filter(x=>x.component==='FG').length,
        ef:p.getAreaPool('Educación Física').filter(x=>x.component==='FG').length,
        areas:window.V2ModalMap.rowDefs().map(x=>x.area)
      };
    });
    assert.ok(bags.tecnologia>0,'BA+15: la bolsa de Educación Tecnológica no debe quedar vacía');
    assert.ok(bags.artes>0,'BA+15: la bolsa de Artes no debe quedar vacía');
    assert.ok(bags.ef>0,'BA+15: la bolsa de Educación Física no debe quedar vacía');
    assert.ok(!bags.areas.includes('Talleres articulados'),'BA+15: no mostrar la categoría ambigua Talleres articulados');
    assert.ok(!bags.areas.includes('Formación General'),'BA+15: no mostrar Formación General como taller');
  }
  if(model==='tecnica'){
    const checked=await page.evaluate(async()=>{
      const p=window.PCIPhase2V28;
      await p.loadCurriculum();
      const areas=[...new Set(window.V2ModalMap.rowDefs().map(x=>x.area).filter(Boolean))];
      const found=[];
      for(const area of areas){
        const rows=p.getAreaPool(area),rebuilt=rows.filter(x=>x.documentallyVerified===true);
        if(!rebuilt.length)continue;
        const cv=p.getCoverage(area);
        const componentRows=rows.filter(x=>x.component===cv.component&&!x.documentalFragmentId);
        if(cv.total!==componentRows.length)
          throw Error('La cobertura de '+area+' no incluye los contenidos recuperados desde PDF oficial');
        found.push({area,reconstructed:rebuilt.length});
      }
      return found;
    });
    assert.ok(checked.length>0,'La Fase 2 Técnica debe cargar contenidos del banco reconstruido.');
    const representation=await page.evaluate(()=>{
      const p=window.PCIPhase2V28;
      return {
        subjects:window.__V2_MODAL.subjects.filter(x=>x.year===2&&/representaci[oó]n/i.test(x.name)).length,
        contents:p.getAreaPool('Tecnología de la Representación').filter(x=>Number(x.year)===2).length
      };
    });
    assert.ok(representation.subjects>0,'Técnica: falta la materia de Representación en Nivel 2');
    assert.ok(representation.contents>0,'Técnica: faltan contenidos priorizados de Representación en Nivel 2');
  
  }
  await page.screenshot({path:'test-artifacts/v2-modalidades/'+model+'-mapa.png',fullPage:true});
  // Fase 2 V2 real: elegir un contenido desde la bolsa, asignarlo al
  // agrupamiento derivado del mapa y completar un plan bimestral.
  const probe=await page.evaluate(()=>{
    const p=window.PCIPhase2V28;
    const g=p.groups().find(g=>g.subjectIds.length&&p.getPool(g.area).length);
    if(!g)throw Error('No hay agrupamiento con materias y bolsa de contenidos');
    return {gid:g.id,area:g.area,year:g.year,term:g.term};
  });
  await page.evaluate(()=>window.screen('proposal'));
  if(model==='tecnica'){
    // V2 ejecuta setTimeout(home,0) tras abrir la pantalla.
    // Evitar que ese render diferido oculte la matriz antes de volver.
    await page.locator('#v28home:not([hidden])').waitFor({state:'visible'});
    await page.waitForTimeout(200);
    await page.locator('#v28full').click();
    await page.locator('#v28matrix:not([hidden]) #v28mback').waitFor({state:'visible'});
    // Cambia únicamente el rótulo visible: códigos, áreas y reglas quedan intactos.
    const labels=await page.locator('#v28matrix .v28-mlabel').allTextContents();
    assert.ok(labels.some(label=>label.trim().startsWith('Especialidad')),
      'La matriz Técnica debe mostrar Especialidad como nombre comprensible del área');
    assert.ok(!labels.some(label=>label.includes('Formación Técnico-Específica')),
      'No mostrar el nombre normativo largo en el rótulo principal');
    assert.ok(await page.evaluate(()=>window.V2ModalMap.rowDefs()
      .filter(r=>['foTaller5','anualEsp','foN3'].includes(r.k))
      .every(r=>r.area==='Formación Técnico-Específica')),
      'La nomenclatura interna que usa la validación no debe cambiar');
    const terms=await page.locator('#v28matrix .v28-term').allTextContents();
    assert.equal(terms.length,12,'Fase 2 técnica debe mostrar sus doce cuatrimestres completos');
    assert.equal(terms[0],'C1');
    assert.equal(terms[11],'C12');
    await page.locator('#v28matrix #v28mback').evaluate(el=>el.click());
    await page.locator('#v28home:not([hidden])').waitFor({state:'visible',timeout:12000});
  }
  await page.locator('#v28home [data-area]').filter({hasText:probe.area}).first().click();
  await page.locator('#v28board:not([hidden])').waitFor({timeout:20000});
  const group=page.locator('#v28groups [data-g="'+probe.gid+'"]');
  await group.waitFor({timeout:12000});
  await group.evaluate(el=>el.click());
  await page.locator('#v28list [data-c]').first().evaluate(el=>el.click());
  await page.locator('#v28assign').evaluate(el=>el.click());
  const selected=await page.evaluate(id=>{
    const g=window.PCIPhase2V28.gb(id);
    return {assigned:g.data.contents.length,count:window.PCIPhase2V28.getPool(g.area).length};
  },probe.gid);
  assert.ok(selected.assigned>0,'El selector de contenidos de Fase 2 V2 debe asignar un contenido');
  await group.locator('.v38-actions [data-plans]').first().evaluate(el=>el.click());
  await page.locator('#v38modal:not([hidden])').waitFor({timeout:12000});
  const count=await page.locator('#v38shell [data-open]').count();
  assert.equal(count,probe.term.includes('-')?4:2,'La Fase 2 V2 conserva 4 o 2 planes según duración');
  await page.locator('#v38shell [data-open]').first().evaluate(el=>el.click());
  await page.locator('#v38plan [data-pfield="objectives"]').fill('Objetivo de aprendizaje curricular V2 · '+model);
  await page.locator('#v38plan [data-stage="punto_partida"][data-sfield="activities"]').fill('Consigna inicial: interpretar una situación de la especialidad');
  await page.locator('#v38plan [data-stage="indagacion"][data-sfield="activities"]').fill('Consigna: investigar contenidos del campo curricular');
  await page.locator('#v38plan [data-stage="produccion"][data-sfield="activities"]').fill('Consigna: producir una resolución fundamentada');
  await page.locator('#v38plan [data-stage="evaluacion"][data-sfield="activities"]').fill('Consigna: revisar y evaluar los aprendizajes');
  await page.locator('#v38plan button[type="submit"]').evaluate(el=>el.click());
  const plan=await page.evaluate(id=>window.PCIPhase2V28.gb(id).data.plansBimestrales[0],probe.gid);
  assert.equal(plan.objectives,'Objetivo de aprendizaje curricular V2 · '+model);
  assert.match(plan.stages.punto_partida.activities,/Consigna inicial/);
  assert.equal(Object.keys(plan.stages).length,4);
  assert.ok(plan.updatedAt,'El plan guarda metadatos de actualización');
  await page.screenshot({path:'test-artifacts/v2-modalidades/'+model+'-fase2-planes.png',fullPage:true});
  assert.deepEqual(errors,[],'Sin excepciones en motor V2 modal: '+model);
  assert.deepEqual(requests,[],'Sin recursos faltantes en motor V2 modal: '+model);
  console.log(JSON.stringify({model,track,levels,terms:levels*2,phase2}));
  await page.close();
 }
}finally{await browser.close();await new Promise(ok=>server.close(ok));}
