/**
 * Técnica en el motor V2 aplica IF-2026-51169092-GCABA-SSPIE (págs. 13–18):
 * ubicaciones por nivel, formatos anuales/cuatrimestrales y validación de
 * cantidades con el validador puro src/normativa/composicion-pci-20261117.mjs.
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
  await page.goto(origin+'/revision-v2-modalidad.html?model=tecnica&specialty=computacion&pci=pci-norma-tecnica-computacion&school=Escuela+de+prueba',{waitUntil:'domcontentloaded'});
  await page.locator('#offer.active').waitFor({timeout:30000});

  const rows=await page.locator('#matrix .rowlabel').allTextContents();
  for(const label of ['Taller de la Especialidad (anual)','Espacios de integración de la Especialidad','Espacio anual de la especialidad','Taller del 1.er ciclo (anual)'])
    assert.ok(rows.includes(label),'Falta la fila '+label);

  const checks=await page.evaluate(()=>{
    const M=window.V2ModalMap,S=window.__V2_MODAL.subjects;
    const by=(n,y)=>S.find(s=>s.name===n&&s.year===y);
    const ok=(slot,n,y)=>M.canAssign(slot,by(n,y))[0];
    return {
      matematicaTroncal:ok('matematica-n1','Matemática',1),
      matematicaSextoComputacion:ok('matematica-n6','Matemática',6),
      fisicaEnNaturales:ok('naturales-c5','Física',3),
      naturalesFueraDeTercero:window.V2ModalMap.rowDefs().find(r=>r.k==='naturales').a(7),
      historiaCuartoComputacion:ok('socialA-c7','Historia',4),
      ciudadaniaSexto:ok('socialA-c11','Ciudadanía y Trabajo',6),
      ciudadaniaConEspecialidad:ok('foN3-c11','Ciudadanía y Trabajo',6),
      tallerTerceroEsEspecialidad:ok('foTaller5-n3','Taller',3),
      tallerPrimerCicloEnTercero:ok('taller1-n3','Taller',3),
      integracionEspecialidadCuarto:ok('foN3-c7','Base de Datos',4),
      integracionEspecialidadEnTercero:window.V2ModalMap.rowDefs().find(r=>r.k==='foN3').a(5),
      practicasEnQuinto:window.V2ModalMap.rowDefs().find(r=>r.k==='practicas').allowedYears.join(',')
    };
  });
  assert.deepEqual(checks,{
    matematicaTroncal:true,matematicaSextoComputacion:true,fisicaEnNaturales:true,naturalesFueraDeTercero:false,
    historiaCuartoComputacion:true,ciudadaniaSexto:true,ciudadaniaConEspecialidad:true,
    tallerTerceroEsEspecialidad:true,tallerPrimerCicloEnTercero:false,
    integracionEspecialidadCuarto:true,integracionEspecialidadEnTercero:false,practicasEnQuinto:'5,6'
  });

  // Mapa vacío: la norma bloquea la validación y lo informa con página.
  await page.locator('#validateBtn').click();
  await page.locator('#validation .norma-list').waitFor({timeout:8000});
  const text=await page.locator('#validation').textContent();
  assert.match(text,/no cumple la norma IF-2026-51169092-GCABA-SSPIE/);
  assert.match(text,/pág\. 13/);
  const state=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>localStorage.getItem(k)?.includes('normaComposicion'))||'null')||'null');return JSON.stringify(s||{}).includes('pci-anexo-ii-2026-11-17/1')});
  assert.equal(state,true,'El resultado de la norma queda registrado en el borrador');

  // Física sigue disponible en Fase 2 con sus contenidos (área Ciencias Naturales).
  const fase2=await page.evaluate(async()=>{
    const S=window.__V2_MODAL.subjects,s=S.find(x=>x.name==='Física'&&x.year===2);
    window.V2ModalMap.assign('naturales-c3',s.id);
    const p=window.PCIPhase2V28;await p.loadCurriculum();
    const g=p.gb('naturales-c3');
    return {area:g.area,pool:p.getPool(g.area).filter(c=>c.subject==='Física').length};
  });
  assert.equal(fase2.area,'Ciencias Naturales');
  assert.ok(fase2.pool>0,'Los contenidos de Física deben estar en la bolsa de Ciencias Naturales');

  await mkdir('test-artifacts/v2-modalidades',{recursive:true});
  await page.screenshot({path:'test-artifacts/v2-modalidades/tecnica-norma.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('TÉCNICA NORMA OK: ubicaciones por nivel, formatos y validación IF-2026-51169092-GCABA-SSPIE.');
}finally{
  await browser.close();server.close();
}
