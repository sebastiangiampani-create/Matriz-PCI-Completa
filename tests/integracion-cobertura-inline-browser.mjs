import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const root=process.cwd(),artifacts=resolve(root,'test-artifacts/integracion-inline');
await mkdir(artifacts,{recursive:true});
for(const [path,expected] of [
 ['preview-v2-real/src/v91-coverage-core.js','b945fa465c962979881f63419c9fcfa3edc664c6'],
 ['preview-v2-real/src/v91-plans-coverage.js','73e7e0bff742586b09cfb51ec473fb880f2b162a'],
 ['preview-v2-real/src/v38-phase2-workspace.js','884b3ae5e8cc07053de94b3abb4af756f0374077']
]){
 const data=await readFile(path);
 assert.equal(createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex'),expected,path);
}
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
  const file=resolve(root,'.'+(pathname==='/'?'/app.html':pathname));
  if(!file.startsWith(root+sep))throw Error('Ruta inválida');
  const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'text/plain'});res.end(body);
 }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
const errors=[],network=[],consoleErrors=[];
let page;
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)+' | '+String(e.stack||'sin pila').slice(0,900)));
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 page.on('request',r=>{if(/supabase\.(co|com)/.test(r.url()))network.push(r.url());});
 await page.goto(base+'/app.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.PCIApp?.ready&&window.PCIV2OriginalCoverage,null,{timeout:60000});
 const originBefore=await page.evaluate(()=>localStorage.getItem('pciAppV2'));
 await page.locator('#pciImportOpen').click();await page.locator('#pciImportPrepare').click();
 await page.locator('#pciImportReviewed').check();await page.locator('#pciImportApprove').click();
 await page.locator('#areaGrid [data-area="Matemática"]').click();
 await page.locator('#groups .v97-group-coverage').first().waitFor({timeout:60000});
 assert.equal(await page.locator('#board [data-pci-inline="area"] .v100-level-card').count(),5);
 assert.match(await page.locator('#groups .v97-group-coverage').first().innerText(),/Cobertura anual del espacio/i);
 assert.equal(await page.locator('#board > .coverage-card').isVisible(),false);
 const parity=await page.evaluate(()=>{
  const result=window.PCIInlineCoverage.getLastResult(),el=document.querySelector('#groups [data-group-id]');
  const expected=result.groups.find(g=>g.id===el.dataset.groupId&&g.area==='Matemática');
  return {actual:el.querySelector('.v97-group-coverage').outerHTML,expected:expected.html};
 });
 assert.equal(parity.actual,parity.expected,'HTML visible idéntico al renderizador original');
 await page.locator('#board [data-pci-inline="area"] summary').click();
 await page.screenshot({path:artifacts+'/fg-niveles-y-agrupamientos.png',fullPage:true});
 await page.locator('#groups .pci-plan-entry button').first().click();
 await page.locator('#pciPlansShell .pci-plan-card .v95-coverage-table').first().waitFor({timeout:30000});
 assert.equal(await page.locator('#pciPlansShell .pci-plan-card .v95-coverage-table').count(),4);
 await page.locator('#pciPlansShell [data-open-plan]').first().click();
 await page.locator('#pciPlanForm [data-pci-inline="plan-current"] .v94-coverage').waitFor({timeout:30000});
 await page.locator('#pciPlansShell [data-plans-close]').click();
 await page.locator('#backOverview').click();
 await page.evaluate(()=>{
  const key='pci-matriz-fg-v2-original-preview-20261009',s=JSON.parse(localStorage.getItem(key)||'{}');
  s.maps??={};s.maps['Economía y Administración']??={placements:{}};
  s.maps['Economía y Administración'].foTypes={'3':{'5':'lab','6':'taller'},'4':{'7':'lab','8':'taller'}};
  localStorage.setItem(key,JSON.stringify(s));
 });
 await page.locator('#pciDemoFoCards [data-pci-fo-format="laboratorios"]').click();
 await page.locator('#pciFoGroupCards .v97-group-coverage').first().waitFor({timeout:30000});
 assert.equal(await page.locator('#pciFoGroupCards .v97-group-coverage').count(),4);
 assert.match(await page.locator('#pciFoGroupCards .v97-group-coverage').first().innerText(),/Cobertura del agrupamiento/i);
 assert.match(await page.locator('#pciFoGroupCards .v97-group-pending').first().innerText(),/todavía no permite calcular cobertura anual por nivel/);
 await page.locator('#pciFoGroupCards [data-edit-group]').first().click();
 await page.locator('#pciFoDetails .pci-inline-plan-grid .v95-coverage-table').first().waitFor({timeout:30000});
 assert.equal(await page.locator('#pciFoDetails .pci-inline-plan-grid .v95-coverage-table').count(),2);
 assert.ok(await page.locator('#pciFoDetails .pci-inline-plan-grid .v95-coverage-line.axis').count()>0);
 assert.match(await page.locator('#pciFoDetails .pci-inline-plan-grid .v95-coverage-head').first().innerText(),/Del anual.*Trayectoria/is);
 assert.match(await page.locator('#pciFoDetails .pci-inline-plan-grid').innerText(),/Historia orientada/i);
 assert.match(await page.locator('#pciFoDetails .pci-inline-plan-grid').innerText(),/Tecnolog.*Informaci/i);
 await page.locator('#pciFoContentList [data-fo-component="eje"]').first().dragTo(page.locator('#pciFoGroupCards .pci-fo-group-assigned').first());
 await page.waitForFunction(()=>window.PCIInlineCoverage.getLastResult()?.area==='Formación Orientada'&&window.PCIInlineCoverage.getLastResult().trajectory.used===1,null,{timeout:30000});
 await page.locator('#pciFoPlanContents [data-plan-content]').first().check();
 await page.waitForFunction(()=>document.querySelector('#pciFoDetails [data-pci-inline="plan-current"] .v95-coverage-line b')?.textContent.startsWith('1/'),null,{timeout:30000});
 await page.screenshot({path:artifacts+'/fo-planes-y-ejes.png',fullPage:true});
 assert.equal(await page.evaluate(()=>localStorage.getItem('pciAppV2')),originBefore);
 const audit=await page.locator('#pciNativeV2CoverageFrame').evaluate(async frame=>{
  const w=frame.contentWindow,core=w.PCICoverageV91,row=core.rows().find(r=>r.area==='Matemática'&&r.year===1);
  const g=id=>({id,area:'Matemática',year:1,type:'laboratorio',term:1,members:[{origin:'FG',name:'Matemática'}],data:{name:id,contents:[row.id,row.id],plansBimestrales:[{number:1,name:'Plan 1',contentIds:[row.id]},{number:2,name:'Plan 2',contentIds:[row.id]}]}});
  const payload={orientation:'Economía y Administración',school:'Prueba',fg:{groups:[g('test-a'),g('test-b')],rows:[row]},fo:{groups:[]}};
  const original=JSON.stringify(payload);await w.PCIInlineV2.render(payload,'Matemática');
  const all=w.PCIPhase2V28.groups(),level=core.groupingLevelCoverage(all[0],all),plan=core.planCoverage(all[0],[row.id,row.id]);
  return {same:JSON.stringify(payload)===original,levelUsed:level.used,planUsed:plan.rows[0].planUsed,groupTotal:plan.rows[0].groupingTotal,groupPercent:plan.rows[0].groupingPercent};
 });
 assert.deepEqual(audit,{same:true,levelUsed:1,planUsed:1,groupTotal:1,groupPercent:100});
 assert.deepEqual(network,[]);
 const storage=await context.storageState();
 const mobile=await browser.newContext({viewport:{width:390,height:844},storageState:storage});
 const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(String(e)));
 await phone.goto(base+'/app.html',{waitUntil:'domcontentloaded'});
 await phone.waitForFunction(()=>window.PCIApp?.ready&&window.PCIFoDesarrollo,null,{timeout:60000});
 await phone.locator('#pciDemoFoCards [data-pci-fo-format="talleres"]').click();
 await phone.locator('#pciFoGroupCards .v97-group-coverage').first().waitFor({timeout:60000});
 assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 await phone.locator('#pciFoGroupCards [data-edit-group]').first().click();
 await phone.locator('#pciFoDetails .pci-inline-plan-grid .v95-coverage-table').first().waitFor({timeout:30000});
 assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 await phone.screenshot({path:artifacts+'/movil-cobertura-inline.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Cobertura inline V2: nivel, espacio, planes, unión, origen intacto y móvil OK.');
}catch(error){
 if(page){
  const debug=await page.evaluate(()=>{
   const f=document.getElementById('pciNativeV2CoverageFrame'),w=f?.contentWindow;
   return {diagnostics:window.PCIInlineCoverage?.diagnostics?.(),
    board:document.getElementById('board')?.className,
    title:document.getElementById('boardTitle')?.textContent,
    areaNodes:document.querySelectorAll('[data-pci-inline="area"]').length,
    groupNodes:document.querySelectorAll('[data-pci-inline="group"]').length,
    originalMarkup:document.querySelector('[data-pci-inline="group"]')?.innerHTML?.slice(0,500),
    iframeSrc:f?.getAttribute('src'),frameApi:!!w?.PCIInlineV2,
    frameGroupCount:w?.PCIPhase2V28?.groups()?.length,
    frameArea:w?.PCIPhase2V28?.getActiveArea?.(),
    frameStage:w?.document.getElementById('pciInlineRenderStage')?.innerHTML?.slice(0,500),
    originalApi:!!w?.PCIPlanCoverageV94};
  });
  console.error('INLINE DIAGNOSTIC',JSON.stringify({debug,errors,consoleErrors:consoleErrors.slice(-10)}));
  await page.screenshot({path:artifacts+'/fallo-inline.png',fullPage:true}).catch(()=>{});
 }
 throw error;
}finally{await browser.close();await new Promise(done=>server.close(done));}
