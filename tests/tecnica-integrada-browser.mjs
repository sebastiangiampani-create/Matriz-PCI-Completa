/**
 * Prueba de flujo Técnico + Media en el MISMO editor institucional.
 * La API se intercepta 100%; únicamente escuelas, sesiones y datos ficticios.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=resolve(root,'.'+path);
  if(!file.startsWith(root+sep))throw Error('Fuera de repo');
  const body=await readFile(file);
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(body);
 }catch(e){res.writeHead(404);res.end('Not Found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port;
const pid='11111111-1111-4111-8111-111111111111';
const qid='22222222-2222-4222-8222-222222222222';
const mid='33333333-3333-4333-8333-333333333333';
const sha='a'.repeat(64);
const school=1234;
const projects=[
 {pci_id:mid,school_id:school,orientation_id:'economia_administracion',
  process_id:'media-p1',model:'comun',specialty_name:null,status:'borrador',
  title:'PCI Economía y Administración'},
 {pci_id:pid,school_id:school,orientation_id:'tecnica_abcabc',process_id:'tec-1',
  model:'tecnica',specialty_name:'Computación',curriculum_status:'pending_rules',
  shift_id:'tarde',status:'borrador',title:'PCI Computación'},
 {pci_id:qid,school_id:school,orientation_id:'tecnica_qwerty',process_id:'tec-2',
  model:'tecnica',specialty_name:'Química',curriculum_status:'pending_rules',
  shift_id:'manana',status:'borrador',title:'PCI Química'}
];
let browser;const units=new Map(),saves=[],requests=[],errors=[];
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:950},acceptDownloads:true});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.url().includes('supabase.co'))requests.push(r.url());});
 await page.addInitScript(()=>{
  sessionStorage.setItem('pci_access_session',JSON.stringify({role:'admin',token:'TEST-SOLO-CI'}));
 });
 await page.route('https://agmebsotbuurbnldxewf.supabase.co/functions/v1/pci-access',async route=>{
  const b=route.request().postDataJSON()||{};
  let data={},status=200;
  const key=[b.pci_id,b.component,b.unit_kind,b.unit_id].join('|');
  switch(b.action){
   case 'session-info':
    data={role:'admin',permissions:['pci.view','pci.edit'],all_schools:true};break;
   case 'list-schools':
    data={schools:[{school_id:school,name:'Escuela ficticia de prueba',cue:'TEST-1234'}]};break;
   case 'list-school-pcis':data={school_id:school,pcis:projects};break;
   case 'get-school-pci':{
    const p=projects.find(x=>x.pci_id===b.pci_id);
    data={pci:{...p,legacy_sha256:sha,legacy_state:{
     schoolName:'Escuela ficticia',schemaVersion:10,profile:p.model==='tecnica'?'tecnica':'comun',
     areas:p.model==='tecnica'?{
      'Ciencias Sociales':{groups:[{id:'antiguo-1',name:'Historia 2º',
       level:2,items:['legacy-2026'],plansBimestrales:[{stages:{punto_partida:'Original'}}]}]}
     }:{},current:null
    }}};break;
   }
   case 'get-school-pci-unit':{
    const val=units.get(key);
    data=val?{exists:true,revision:val.revision,document:val.document}:
     {exists:false,revision:0};
    break;
   }
   case 'save-school-pci-unit':{
    const p=projects.find(x=>x.pci_id===b.pci_id);
    if(b.school_id!==school||!p)throw Error('Intento de guardar fuera de la escuela ficticia');
    if(p.model==='tecnica'&&
      !['oferta-tecnica-v1','fo-tecnica-v1'].includes(b.base_version))
      throw Error('Se quiso guardar un documento de Media en Técnica');
    const current=units.get(key)?.revision||0;
    if(current!==b.expected_revision){
     data={error:'Conflicto de revisión'};status=409;break;
    }
    units.set(key,{revision:current+1,document:b.document});
    saves.push(b);data={ok:true,revision:current+1};
    break;
   }
   default:throw Error('Acción inesperada en la prueba: '+b.action);
  }
  await route.fulfill({status,contentType:'application/json',
    headers:{'Access-Control-Allow-Origin':'*'},
    body:JSON.stringify(data)});
 });
 await page.goto(base+'/pci-orientaciones.html?school='+school,{waitUntil:'domcontentloaded'});
 await page.locator('#app').waitFor({state:'visible',timeout:30000});
 assert.equal(await page.locator('#pciList .pciItem').count(),3);
 const tech=page.locator('#pciList .pciItem').filter({hasText:'PCI Computación'});
 await tech.click();
 await page.waitForFunction(()=>document.querySelector('#pciName')?.textContent==='PCI Computación',null,{timeout:30000});
 assert.equal(await page.locator('#editor').isVisible(),true,'Técnica usa #editor original de Media');
 assert.equal(await page.locator('#technicalPending').isVisible(),false);
 assert.equal(await page.locator('[data-tab="fo"]').textContent(),'Formación Técnico-Específica');
 assert.match(await page.locator('#pciInfo').textContent(),/C1–C12/);
 assert.equal(await page.locator('#areaList .areaItem').count(),10);
 await page.locator('#areaList .areaItem').filter({hasText:'Ciencias Sociales'}).click();
 assert.match(await page.locator('#areaEditor').textContent(),/Resguardo de agrupamientos históricos/);
 await page.locator('[data-tab="oferta"]').click();
 assert.equal(await page.locator('#mapHead tr').count(),2);
 assert.equal(await page.locator('#mapHead tr').last().locator('th').count(),12);
 assert.ok(await page.locator('#mapBody tr').count()>=14);
 const firstAnnual=page.locator('#mapBody tr').first().locator('td').first();
 assert.equal(await firstAnnual.getAttribute('colspan'),'2','Troncales anuales ocupan C1 y C2');
 // Seleccionar matemática del primer año y vincular una referencia oficial.
 await firstAnnual.locator('button').first().click();
 await page.waitForFunction(()=>document.querySelector('#offerGrid')?.textContent?.includes('Vincular contenido'));
 const select=page.locator('#offerGrid select[aria-label="Referencias de contenidos priorizados"]');
 const options=await select.locator('option').allTextContents();
 const mathIdx=options.findIndex(x=>/Matemática/.test(x));
 assert.ok(mathIdx>0,'Debe ofrecer referencias originales de Matemática año 1');
 await select.selectOption({index:mathIdx});
 await page.getByRole('button',{name:'Vincular contenido del documento'}).click();
 assert.match(await page.locator('#offerValidation').textContent(),/referencias documentales distribuidas/);
 await page.locator('#saveOffer').click();
 await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('Mapa de la Oferta Técnica guardado'));
 assert.equal(saves.length,1);
 assert.equal(saves[0].component,'oferta');
 assert.equal(saves[0].document.model,'tecnica');
 assert.equal(saves[0].document.spaces.length>50,true);
 await mkdir('test-artifacts/tecnica-integrada',{recursive:true});
 await page.screenshot({path:'test-artifacts/tecnica-integrada/01-mapa-tecnico-c1-c12.png',fullPage:true});
 await page.getByRole('button',{name:'Abrir planes del espacio'}).click();
 await page.waitForFunction(()=>document.querySelector('#foEditor')?.textContent?.includes('Plan 1'),null,{timeout:30000});
 const objective=page.locator('#foEditor').getByText('Objetivo general',{exact:true}).locator('..').locator('textarea');
 await objective.fill('Diseñar algoritmos y comunicar su funcionamiento');
 await objective.dispatchEvent('change');
 await page.locator('#foEditor .btn.primary').click();
 await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('Cuatro planes técnicos guardados'));
 assert.equal(saves.length,2);
 assert.deepEqual(saves.map(x=>x.component),['oferta','fo']);
 assert.equal(saves[1].document.plansBimestrales.length,4);
 await page.screenshot({path:'test-artifacts/tecnica-integrada/02-planes-tecnicos.png',fullPage:true});
 // La segunda especialidad no debe heredar mapa, fuentes ni planes de Computación.
 await page.locator('#pciList .pciItem').filter({hasText:'PCI Química'}).click();
 await page.waitForFunction(()=>document.querySelector('#pciName')?.textContent==='PCI Química');
 await page.locator('[data-tab="oferta"]').click();
 await page.locator('#mapBody tr').first().waitFor();
 assert.notEqual(await page.locator('#offerValidation').textContent(),
    'Mapa de la Oferta Técnica guardado');
 assert.equal(await page.locator('#pciName').textContent(),'PCI Química');
 await page.screenshot({path:'test-artifacts/tecnica-integrada/03-especialidad-independiente.png',fullPage:true});
 // Volver a Media: sin sobrescribir sus etiquetas, dimensiones ni diseño.
 await page.locator('#pciList .pciItem').filter({hasText:'PCI Economía'}).click();
 await page.waitForFunction(()=>document.querySelector('#pciName')?.textContent==='PCI Economía y Administración',null,{timeout:30000});
 assert.equal(await page.locator('[data-tab="fo"]').textContent(),'Formación Orientada');
 await page.locator('[data-tab="oferta"]').click();
 assert.match(await page.locator('#offerPane .topline h3').textContent(),/C1 a C10/);
 await page.screenshot({path:'test-artifacts/tecnica-integrada/04-media-sin-alterar.png',fullPage:true});
 assert.deepEqual(errors,[]);
 assert.equal(requests.every(x=>x.includes('/pci-access')),true,
  'Se usó exclusivamente la API institucional de prueba interceptada');
 assert.ok(saves.every(x=>x.school_id===school&&x.pci_id===pid));
 console.log('PCI V2 integrado: Media intacta; Técnica C1-C12, áreas, oferta, contenido, 4 planes, revisión y especialidades independientes OK.');
}finally{
 if(browser)await browser.close();
 await new Promise(done=>server.close(done));
}
