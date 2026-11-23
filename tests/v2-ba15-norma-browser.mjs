/**
 * BA +15 en el motor V2 aplica RES-1375-MEDGC-25, Anexo I (6.3 y 6.5):
 * materias por área y nivel, talleres, Tutoría en Nivel I y validación de la
 * estructura completa de 38 horas por nivel.
 */
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'};
const root=resolve('.');
const server=createServer(async(req,res)=>{
  try{
    const file=resolve(root+decodeURIComponent(new URL(req.url,'http://x').pathname));
    if(!file.startsWith(root))throw Error('fuera de raíz');
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(body);
  }catch{res.writeHead(404);res.end()}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/revision-v2-modalidad.html?model=ba15&orientation=economia_administracion&pci=pci-norma-ba15-economia&school=Escuela+de+prueba',{waitUntil:'domcontentloaded'});
  await page.locator('#offer.active').waitFor({timeout:30000});
  const checks=await page.evaluate(()=>{
    const M=window.V2ModalMap,S=window.__V2_MODAL.subjects;
    const by=(n,y)=>S.find(s=>s.name===n&&s.year===y&&s.origin==='FG');
    const ok=(slot,n,y)=>M.canAssign(slot,by(n,y))[0];
    return {
      efEnArtes:ok('artes-c1','Educación Física',1),efEnEF:ok('ef-c1','Educación Física',1),
      ticEnArtes:ok('artes-c5','Tecnologías de la Información',3),ticEnTalleres:ok('tecnologias-c3','Tecnologías de la Información',2),
      ticOrientadaEnTalleres:ok('tecnologias-c7','Tecnologías de la Información Orientada',4)===false&&ok('foN3-c7','Tecnologías de la Información Orientada',4),
      tutoriaNivel1:ok('otros-c1','Tutoría',1),fisicoquimica:ok('naturales-c3','Físico-Química',2),
      economiaSociales:ok('socialA-c3','Economía',2),filosofiaSociales:ok('socialA-c7','Filosofía',4)
    };
  });
  assert.deepEqual(checks,{efEnArtes:false,efEnEF:true,ticEnArtes:false,ticEnTalleres:true,ticOrientadaEnTalleres:true,
    tutoriaNivel1:true,fisicoquimica:true,economiaSociales:true,filosofiaSociales:true});
  await page.locator('#validateBtn').click();
  await page.locator('#validation .norma-list').waitFor({timeout:8000});
  assert.match(await page.locator('#validation').textContent(),/no cumple la norma RES-1375-MEDGC-25/);
  // Laboratorios y talleres BA +15 son cuatrimestrales: C1 no completa C2.
  const semesters=await page.evaluate(()=>{
    const M=window.V2ModalMap,S=window.__V2_MODAL.subjects;
    const bio=S.find(s=>s.name==='Biología'&&s.year===1);
    M.assign('naturales-c1',bio.id);
    const first=structuredClone(state.maps[state.active].placements);
    const unfinished=window.V2ModalNorma.evaluate().errors.map(e=>e.code);
    M.assign('naturales-c2',bio.id);
    M.remove('naturales-c1',bio.id);
    const afterRemove=structuredClone(state.maps[state.active].placements);
    M.assign('naturales-c1',bio.id);
    return {firstC1:first['naturales-c1']?.includes(bio.id),
      firstC2:first['naturales-c2']?.includes(bio.id)||false,
      c2SurvivesRemoval:afterRemove['naturales-c2']?.includes(bio.id)||false,
      incomplete:unfinished.some(code=>code==='BA_MISSING_1_C2')};
  });
  assert.deepEqual(semesters,{firstC1:true,firstC2:false,c2SurvivesRemoval:true,incomplete:true},
    'Las celdas cuatrimestrales deben ser independientes y conservar las existentes.');
  // Estructura completa: cada materia en su área de C impar y de C par; las troncales son anuales.
  const result=await page.evaluate(()=>{
    const M=window.V2ModalMap,S=window.__V2_MODAL.subjects,rows=M.rowDefs();
    for(const s of S.filter(x=>x.origin==='FG'||x.origin==='FO')){
      for(const r of rows){
        const slot=r.annual?r.k+'-n'+s.year:r.k+'-c'+(s.year*2-1);
        if((r.annual||r.a(s.year*2-1))&&M.canAssign(slot,s)[0]){
          M.assign(slot,s.id);
          if(!r.annual){
            const even=r.k+'-c'+(s.year*2);
            if(r.a(s.year*2)&&M.canAssign(even,s)[0])M.assign(even,s.id);
          }
          break;
        }
      }
    }
    const x=window.V2ModalNorma.evaluate();return {errors:x.errors.map(e=>e.message),warnings:x.warnings.map(e=>e.code),
      structurallyConsistent:x.structurallyConsistent,homologated:x.homologated};
  });
  assert.deepEqual(result.errors,[]);
  assert.equal(result.warnings.some(c=>c.startsWith('BA_HOURS_')),false,'El catálogo suma 38 horas por nivel');
  assert.equal(result.structurallyConsistent,true,'La estructura está completa en C1-C8.');
  assert.equal(result.homologated,false,'El motor no debe afirmar homologación pedagógica FO.');
  assert.ok(result.warnings.includes('BA_FO_REFERENCIA_PENDIENTE'),'Se declara el alcance documental FO.');
  await page.locator('#validateBtn').click();
  await page.waitForFunction(()=>/Estructura curricular consistente · RES-1375-MEDGC-25/.test(document.querySelector('#validation')?.textContent||''));
  assert.doesNotMatch(await page.locator('#validation').textContent(),/El mapa no cumple la norma/);
  assert.match(await page.locator('#validation').textContent(),/Falta contrastar las materias y los contenidos/);
  const audit=await page.evaluate(()=>{
    return structuredClone(state.maps[state.active].normaComposicion);
  });
  assert.equal(audit.estado,'estructura_consistente_pendiente_homologacion');
  assert.equal(audit.homologated,false);
  const rules=await page.locator('#rulesModal').textContent();
  assert.match(rules,/CCC acredita equivalencias/);
  assert.match(rules,/formatos cuatrimestrales se organizan por separado/);
  await mkdir('test-artifacts/v2-modalidades',{recursive:true});
  await page.screenshot({path:'test-artifacts/v2-modalidades/ba15-norma.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('BA+15 NORMA OK: áreas por nivel, talleres, Tutoría y estructura de 38 h (RES-1375-MEDGC-25).');
}finally{
  await browser.close();server.close();
}
