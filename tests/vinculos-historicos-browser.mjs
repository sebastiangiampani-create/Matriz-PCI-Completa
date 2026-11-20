import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,relative,sep} from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd(),schoolId=1017;
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
 try{
  const full=resolve(root,'.'+decodeURIComponent(new URL(req.url||'/','http://localhost').pathname));
  const rel=relative(root,full);if(rel==='..'||rel.startsWith('..'+sep))throw Error('Fuera del proyecto');
  const data=await readFile(full);
  res.writeHead(200,{'Content-Type':types[extname(full)]||'application/octet-stream'});res.end(data);
 }catch(e){res.writeHead(404);res.end(String(e.message||e))}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port;
const browser=await chromium.launch(process.env.CHROME_BIN?{headless:true,executablePath:process.env.CHROME_BIN}:{headless:true});
const ids=['00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000103'];
const historical={schemaVersion:10,schoolName:'Instituto de prueba',profile:'comun',areas:{
 'Lengua y Literatura':{groups:[{id:'l1',name:'Lengua trabajada',items:[101,102],plansBimestrales:[{name:'Plan 1',synopsis:'Trabajo de comprensión lectora',objectives:'Lectura crítica'}]}]},
 'Otros formatos pedagógicos':{groups:[{id:'f1',name:'Comunicación y medios',items:[201],plansBimestrales:[{name:'Plan FO',synopsis:'Taller de medios de comunicación'}]}]},
 'Científico-Tecnológica':{groups:[{id:'t1',name:'Robótica de Taller',items:[301],plansBimestrales:[{name:'Plan de taller',synopsis:'Robótica técnica por especialidad'}]}]}
}};
const original=JSON.stringify(historical),revHash='a'.repeat(64);
const pcis=[
 {pci_id:ids[0],school_id:schoolId,orientation_id:'comunicacion',process_id:'process-a',title:'Comunicación Mañana',model:'comun',shift_id:'manana',status:'borrador',legacy_sha256:revHash,legacy_state:historical},
 {pci_id:ids[1],school_id:schoolId,orientation_id:'economia_administracion',process_id:'process-b',title:'Economía Tarde',model:'comun',shift_id:'tarde',status:'borrador',legacy_sha256:revHash,legacy_state:historical},
 {pci_id:ids[2],school_id:schoolId,orientation_id:'tecnica_mecanica',process_id:'process-c',title:'Técnica Mecánica Noche',model:'tecnica',shift_id:'noche',specialty_name:'Mecánica',status:'borrador',legacy_sha256:revHash,legacy_state:historical}
];
const rows=[
 {area:'Lengua y Literatura',id:'l1',name:'Lengua trabajada',contents:2,plans:1,hasWork:true},
 {area:'Otros formatos pedagógicos',id:'f1',name:'Comunicación y medios',contents:1,plans:1,hasWork:true},
 {area:'Científico-Tecnológica',id:'t1',name:'Robótica de Taller',contents:1,plans:1,hasWork:true}
];
let saved=null,revision=0,writes=0;
const pageErrors=[];
try{
 const page=await browser.newPage({viewport:{width:1400,height:950}});
 page.on('pageerror',e=>pageErrors.push(e.message));
 await page.addInitScript(()=>sessionStorage.setItem('pci_access_session',JSON.stringify({token:'legacy-e2e',role:'admin'})));
 await page.route('https://agmebsotbuurbnldxewf.supabase.co/functions/v1/pci-multipci',async route=>{
  const body=JSON.parse(route.request().postData()||'{}'),action=body.action;
  let out={},code=200;
  if(action==='session-info')out={role:'admin',permissions:['pci.view','pci.edit'],all_schools:true};
  else if(action==='list-schools')out={schools:[{school_id:schoolId,name:'Instituto de prueba',cue:'CUE-E2E'}]};
  else if(action==='list-school-pcis')out={pcis};
  else if(action==='get-school-pci')out={pci:pcis.find(p=>p.pci_id===body.pci_id)};
  else if(action==='get-school-pci-unit')out={exists:false,revision:0};
  else if(action==='get-school-legacy-links')out={source_updated_at:'2026-11-19T17:00:00Z',source_model:'comun',rows,document:saved,revision,exists:!!saved};
  else if(action==='save-school-legacy-links'){
   if(Number(body.expected_revision)!==revision){code=409;out={code:'stale_revision',current_revision:revision};}
   else{saved=structuredClone(body.document);revision++;writes++;out={ok:true,revision};}
  }else{code=404;out={error:'Acción no simulada: '+action};}
  await route.fulfill({status:code,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(out)});
 });
 await page.goto('http://127.0.0.1:'+port+'/pci-orientaciones.html?school=1017',{waitUntil:'domcontentloaded'});
 await page.locator('#app:not([hidden])').waitFor({timeout:30000});
 await page.locator('#historicAssignmentSection:not([hidden])').waitFor({timeout:20000});
 await page.locator('#editHistoricLinks').click();
 await page.locator('#historicAssignmentEditor:not([hidden])').waitFor();
 const group=name=>page.locator('.legacy-group-card').filter({hasText:name}).first();
 await group('Lengua trabajada').locator('.all-targets input').check();
 await group('Comunicación y medios').locator('select').selectOption('orientada');
 await group('Comunicación y medios').locator('input[value="'+ids[0]+'"]').check();
 await group('Robótica de Taller').locator('select').selectOption('tecnica');
 await group('Robótica de Taller').locator('input[value="'+ids[2]+'"]').check();
 await page.locator('#saveHistoricLinks').click();
 await page.waitForFunction(()=>document.getElementById('historicAssignmentSummary')?.textContent?.includes('3 agrupamientos'),null,{timeout:15000});
 assert.equal(writes,1,'La asignación debe guardarse de forma única con revisión');
 assert.equal(revision,1);
 assert.equal(saved.assignments.find(a=>a.id==='l1').mode,'all');
 assert.deepEqual(saved.assignments.find(a=>a.id==='f1').pci_ids,[ids[0]]);
 assert.deepEqual(saved.assignments.find(a=>a.id==='t1').pci_ids,[ids[2]]);
 assert.equal(JSON.stringify(historical),original,'El histórico nunca se modifica');
 await page.screenshot({path:'test-artifacts/multipci-portal/asignacion-fg-a-varios-y-especificas.png',fullPage:true});
 await page.locator('.school-offer-card').filter({hasText:'Comunicación Mañana'}).locator('button[aria-label^="Abrir Mapa de la Oferta"]').click();
 await page.locator('#v2OriginalPane:not([hidden])').waitFor({timeout:20000});
 const preview=page.locator('#pciHistoricLinks');
 assert.match(await preview.textContent(),/3 contenidos y 2 planes|3 contenidos y 2 planes/);
 await preview.locator('summary').first().evaluate(el=>el.click());
 await preview.getByText('Comunicación y medios').waitFor();
 assert.equal(await page.locator('#areaList').getByText('Otros formatos pedagógicos').count(),0,'El FO específico no se convierte automáticamente en FG');
 assert.match(await preview.textContent(),/Trabajo de comprensión lectora|Lengua trabajada/);
 await page.locator('#editor [data-back-to-school]').click();
 await page.locator('#empty:not([hidden])').waitFor();
 await page.locator('.school-offer-card').filter({hasText:'Economía Tarde'}).locator('button[aria-label^="Abrir Mapa de la Oferta"]').click();
 await page.locator('#v2OriginalPane:not([hidden])').waitFor({timeout:20000});
 const econ=await page.locator('#pciHistoricLinks').textContent();
 assert.match(econ,/Lengua trabajada|2 contenidos y 1 planes/);
 assert.doesNotMatch(econ,/Comunicación y medios|Robótica de Taller/);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#v2OriginalPane:not([hidden])').waitFor({timeout:20000});
 assert.equal(revision,1,'Volver al PCI no agrega guardados');
 assert.equal(JSON.stringify(historical),original);
 assert.deepEqual(pageErrors,[],'No deben aparecer errores JS en el recorrido: '+pageErrors.join(' | '));
 console.log('E2E OK: FG a TODOS, orientada a Comunicación y técnica a Mecánica, persistencia y resguardo histórico.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
