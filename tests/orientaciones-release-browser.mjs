/**
 * Prueba de navegador del módulo independiente de orientaciones.
 * TODAS las solicitudes al backend se interceptan con datos ficticios;
 * no se llama a Supabase ni se accede a ninguna escuela verdadera.
 */
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,normalize,join,resolve} from 'node:path';
import assert from 'node:assert/strict';

const root=resolve(process.cwd());
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8',
  '.png':'image/png','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  const path=normalize(decodeURIComponent(new URL(req.url,'http://localhost').pathname)).replace(/^\/+/, '');
  const file=resolve(join(root,path));
  if(!(file===root||file.startsWith(root+'/'))){res.writeHead(403).end();return;}
  try{
    const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(data);
  }catch{res.writeHead(404).end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
const url='http://127.0.0.1:'+port;
const pciId='11111111-1111-4111-8111-111111111111';
const sha='a'.repeat(64);
let projects=[],saves=[],stored=new Map();
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:850}});
  page.on('pageerror',error=>{console.error('PAGE ERROR',error.message)});
  await page.addInitScript(()=>{
    sessionStorage.setItem('pci_access_session',JSON.stringify({role:'admin',token:'TEST-SOLO-CI'}));
  });
  await page.route('https://agmebsotbuurbnldxewf.supabase.co/functions/v1/pci-access',async route=>{
    if(route.request().method()==='OPTIONS'){
      await route.fulfill({status:200,headers:{
        'Access-Control-Allow-Origin':'*',
        'Access-Control-Allow-Headers':'content-type',
        'Access-Control-Allow-Methods':'POST, OPTIONS'
      }});
      return;
    }
    const b=route.request().postDataJSON()||{};
    let data={};
    switch(b.action){
      case 'session-info':data={role:'admin',permissions:['pci.edit','pci.view'],all_schools:true};break;
      case 'list-schools':data={schools:[{school_id:1234,name:'Instituto ficticio para CI',cue:'TEST-414'}]};break;
      case 'list-school-pcis':data={school_id:1234,pcis:projects};break;
      case 'create-school-pci':
        projects.push({pci_id:pciId,school_id:1234,orientation_id:b.orientation_id,
          process_id:'process-test-1',title:b.title,status:'borrador'});
        data={ok:true,pci_id:pciId};break;
      case 'get-school-pci':
        data={pci:{...projects[0],legacy_sha256:sha,
          legacy_state:{schemaVersion:10,schoolName:'Instituto ficticio',areas:{},current:null}}};break;
      case 'get-school-pci-unit':{
        const key=[b.component,b.unit_kind,b.unit_id].join('|');
        const existing=stored.get(key);
        data=existing?{exists:true,revision:existing.revision,document:existing.document}:
          {exists:false,revision:0};break;
      }
      case 'save-school-pci-unit':{
        if(b.action==='save-state'||b.school_id!==1234||b.pci_id!==pciId)
          throw Error('Escritura fuera de la escuela y PCI ficticios');
        const key=[b.component,b.unit_kind,b.unit_id].join('|');
        const existing=stored.get(key);
        const current=existing?.revision||0;
        if(b.expected_revision!==current){
          await route.fulfill({status:409,contentType:'application/json',
            headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({error:'Conflicto'})});
          return;
        }
        stored.set(key,{revision:current+1,document:b.document});
        saves.push(b);data={ok:true,revision:current+1};break;
      }
      default:throw Error('La interfaz invocó una acción no autorizada en CI: '+b.action);
    }
    await route.fulfill({status:b.action==='create-school-pci'?201:200,contentType:'application/json',
      headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)});
  });

  await page.goto(url+'/pci-orientaciones.html?school=1234',{waitUntil:'domcontentloaded'});
  await page.locator('#app').waitFor({state:'visible',timeout:30000});
  assert.equal(await page.locator('#status').textContent(),'Conectado');
  await page.locator('#btnAddPci').click();
  await page.locator('#orientation').selectOption('economia_administracion');
  await page.locator('#pciTitleInput').fill('PCI Economía de prueba');
  await page.locator('#formCreatePci button[type="submit"]').click();
  await page.locator('#pciName').waitFor({state:'visible',timeout:30000});
  assert.match(await page.locator('#pciName').textContent(),/PCI Economía/);
  assert.match(await page.locator('#pciInfo').textContent(),/Plantilla nueva/);
  assert.ok(await page.locator('#areaList .areaItem').count()>0);
  await page.locator('#areaList .areaItem').first().click();
  await page.locator('#areaEditor .btn.primary').waitFor({state:'visible'});
  await page.locator('#areaEditor .btn.primary').click();
  await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('guardada en el PCI'));
  await page.locator('[data-tab="oferta"]').click();
  await page.locator('#mapBody tr').first().waitFor();
  await page.locator('#saveOffer').click();
  await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('Mapa FO guardado'));
  await page.locator('[data-tab="fo"]').click();
  await page.locator('#foSpaces .areaItem').first().click();
  await page.locator('#foEditor .btn.primary').waitFor({state:'visible'});
  await page.locator('#foEditor .btn.primary').click();
  await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('Planes FO guardados'));
  assert.deepEqual(new Set(saves.map(x=>x.component)),new Set(['fg','oferta','fo']));
  assert.ok(saves.every(x=>x.expected_revision===0));
  assert.ok(saves.every(x=>x.school_id===1234&&x.pci_id===pciId));
  assert.ok(saves.every(x=>x.action==='save-school-pci-unit'));
  console.log('Navegador: FG, mapa FO, planes FO, escritura separada y escuela ficticia OK');
}finally{
  if(browser)await browser.close();
  await new Promise(done=>server.close(done));
}
