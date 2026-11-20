import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,relative,sep,extname} from 'node:path';
import {chromium} from 'playwright';

const root=process.cwd();
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.txt':'text/plain'};
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const full=resolve(root,'.'+path),rel=relative(root,full);
    if(rel==='..'||rel.startsWith('..'+sep))throw Error('Fuera de raíz');
    const buffer=await readFile(full);
    res.writeHead(200,{'Content-Type':types[extname(full)]||'application/octet-stream'});
    res.end(buffer);
  }catch(error){res.writeHead(404);res.end(String(error.message||error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
let browser;
try{
  browser=await chromium.launch(process.env.CHROME_BIN?
    {headless:true,executablePath:process.env.CHROME_BIN}:{headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  const network=[],errors=[];
  page.on('request',request=>{
    if(request.url().includes('supabase.co'))network.push(request.url());
  });
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+port+'/revision-pr47.html?school=1001',{waitUntil:'domcontentloaded'});
  await page.locator('#app:not([hidden])').waitFor({timeout:45000});
  await page.waitForFunction(()=>document.querySelectorAll('.school-offer-card').length===3,null,{timeout:20000});
  assert.match(await page.locator('#pciCounts').textContent(),/3 PCI/);
  for(const title of ['Comunicación','Computación','Economía y Administración']){
    assert.ok(await page.locator('.school-offer-card').filter({hasText:title}).count(),'Falta '+title);
  }
  assert.equal(await page.evaluate(()=>window.__pciPreviewPr47?.isolated),true);
  await page.screenshot({path:'test-artifacts/multipci-portal/pr47-inicio-3-modalidades.png',fullPage:true});
  const api='https://agmebsotbuurbnldxewf.supabase.co/functions/v1/pci-multipci';
  const id='00000000-0000-4000-8000-000000000001';
  const unit={action:'save-school-pci-unit',school_id:1001,pci_id:id,component:'oferta',
    unit_kind:'map',unit_id:'revision-pr47-prueba',base_version:'preview-only',
    expected_revision:0,document:{notice:'sin Supabase',plans:[{name:'Plan 1',objectives:'Objetivo guardado'}]}};
  const save=await page.evaluate(async ({api,unit})=>{
    const r=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(unit)});
    return r.json();
  },{api,unit});
  assert.equal(save.revision,1);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#app:not([hidden])').waitFor({timeout:45000});
  const remote=await page.evaluate(async ({api,unit})=>{
    const req={action:'get-school-pci-unit',school_id:unit.school_id,pci_id:unit.pci_id,
      component:unit.component,unit_kind:unit.unit_kind,unit_id:unit.unit_id};
    return (await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(req)})).json();
  },{api,unit});
  assert.equal(remote.document.plans[0].objectives,'Objetivo guardado');
  assert.equal(remote.revision,1);
  for(const {name,visible} of [
    {name:'Comunicación',visible:'#offerPane:not([hidden])'},
    {name:'Computación',visible:'#editor.technical-editor:not([hidden])'},
    {name:'Economía y Administración',visible:'#ba15Pending:not([hidden])'}]){
    const card=page.locator('.school-offer-card').filter({hasText:name});
    await card.locator('button[aria-label^="Abrir Mapa de la Oferta"]').click();
    await page.locator(visible).waitFor({timeout:30000});
    if(name==='Comunicación'){
      assert.equal(await page.locator('#mapHead tr').count(),2,
        'Media recupera cabecera de niveles y cuatrimestres V2.');
      assert.equal(await page.locator('#mapBody tr').count(),14,
        'Media conserva todas las filas de FG y FO.');
      assert.equal(await page.locator('#mapBody [data-pci-annual=true]').count(),15,
        'Las tres troncales de Media ocupan cinco pares anuales.');
    }
    if(name==='Computación'){
      assert.equal(await page.locator('#mapHead tr').count(),2,
        'Técnica conserva seis niveles con C1–C12.');
      assert.equal(await page.locator('#mapHead tr').last().locator('th').count(),12);
      assert.ok(await page.locator('#mapBody [data-pci-annual=true]').count()>0,
        'Técnica representa espacios anuales que ocupan ambos cuatrimestres.');
    }
    if(name==='Economía y Administración'){
      assert.equal(await page.locator('#ba15Builder .mapTable thead tr').count(),2,
        'BA +15 muestra nivel y cuatrimestre por separado.');
      assert.equal(await page.locator('#ba15Builder .mapTable tbody tr').count(),8,
        'BA +15 diferencia troncales, ciencias, talleres y FO.');
      assert.equal(await page.locator('#ba15Builder .mapTable [data-pci-annual=true]').count(),12,
        'Las troncales BA +15 ocupan cuatro pares anuales cada una.');
    }
    await page.screenshot({path:'test-artifacts/multipci-portal/pr47-'+
      (name==='Comunicación'?'media':name==='Computación'?'tecnica':'ba15')+'.png',fullPage:true});
    await page.locator('#schoolHomeLink').click();
    await page.locator('.school-offer-card').first().waitFor();
  }
  assert.deepEqual(network,[],'La revisión no debe enviar solicitudes a Supabase');
  assert.deepEqual(errors,[],'Errores JavaScript en la revisión: '+errors.join('; '));
  // Confirmar también que la URL pública de revisión sirve el archivo de ESTA rama.
  const external='https://raw.githack.com/sebastiangiampani-create/Matriz-PCI-Completa/fix/rescate-constructor-v2-reglas-20261119/revision-pr47.html';
  const publicResponse=await fetch(external,{signal:AbortSignal.timeout(20000)});
  assert.equal(publicResponse.status,200,'El enlace externo de revisión debe devolver HTTP 200');
  const publicHtml=await publicResponse.text();
  assert.match(publicHtml,/src\/preview-pr47-mock\.js/,'El enlace debe servir la vista aislada, no producción');
  console.log('PR47 aislado: tres PCI, guardado simulado, cero requests Supabase y enlace externo disponible.');
}finally{
  await browser?.close();
  server.close();
}
