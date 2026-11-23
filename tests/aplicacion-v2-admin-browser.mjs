/**
 * Regresión del acceso administrativo en la distribución publicada real.
 * Exclusivo de CI: no inicia navegador fuera de ese entorno. Las credenciales,
 * la escuela y el PCI son simulados. Toda petición externa queda interceptada.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {resolve,join,relative,sep,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

assert.equal(process.env.CI,'true','El navegador de esta prueba se ejecuta exclusivamente en CI.');
const {chromium}=await import('playwright');
const root=process.cwd();
const artifacts=resolve(process.env.PCI_NATIVE_ARTIFACTS||'test-artifacts/aplicacion-v2-integrada','admin');
await mkdir(artifacts,{recursive:true});
const temporary=await mkdtemp(join(tmpdir(),'pci-admin-ci-'));
const distribution=join(temporary,'publicado');
const simulatedToken='token-admin-exclusivo-de-ci';
const simulatedUser='admin_simulado_ci';
const simulatedPassword='clave-administrativa-simulada-ci';
const invalidMessage='Credenciales de prueba inválidas.';
const school={school_id:1709,name:'Escuela simulada · Acceso administrativo',cue:'SIM-ADMIN-1709',model:'comun',
  progress:{total_spaces:4,edited_spaces:1,assigned_contents:2},
  audit:{total_events:0,participant_count:0,last_activity:null},last_editor:null};
const session={role:'admin',username:simulatedUser,user:simulatedUser,profile_label:'Administración simulada',
  permissions:[],all_schools:true,school_ids:[],
  identity:{first_name:'Administración',last_name:'Simulada',email:'admin@escuela.example'}};
const legacy={areas:{}};
const pci={pci_id:'17171717-1111-4111-8111-000000000009',school_id:school.school_id,model:'comun',
  orientation_id:'economia_administracion',shift_id:'manana',title:'PCI simulado · Administración',
  status:'borrador',process_id:'proceso-simulado-admin-2026',legacy_state:legacy,
  legacy_sha256:createHash('sha256').update(JSON.stringify(legacy)).digest('hex')};
const fixtureBefore=JSON.stringify({school,session,pci});
const report={fecha:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  alcance:'Paquete real del preparador; datos y credenciales simulados; sin servicios remotos reales.',
  casos:[],acciones:[],externosBloqueados:[],capturas:[],fallos:[]};
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript',
  '.json':'application/json','.txt':'text/plain','.csv':'text/csv','.svg':'image/svg+xml',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
let origin='',server,browser;

async function installMocks(page,record){
  page.on('pageerror',error=>record.errores.push(error.message));
  page.on('response',response=>{
    if(response.url().startsWith(origin)&&response.status()>=400)
      record.recursosFallidos.push({url:response.url(),status:response.status()});
  });
  page.on('dialog',dialog=>{
    record.dialogos.push({tipo:dialog.type(),mensaje:dialog.message()});void dialog.dismiss();
  });
  await page.addInitScript(()=>{
    window.__adminCi={iniciosAcceso:0};
    addEventListener('pci-access-changed',()=>{
      if(/\bat start\s*\(/.test(new Error().stack||''))window.__adminCi.iniciosAcceso++;
    });
  });
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===origin)return route.continue();
    if(['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname))
      return route.fulfill({status:200,contentType:'text/css',body:''});
    if(!/supabase/i.test(url.hostname)){
      report.externosBloqueados.push(url.href);return route.abort('blockedbyclient');
    }
    let data;try{data=request.postDataJSON();}catch{data=null;}
    // El registro nunca incluye contraseñas, tokens ni cuerpos completos.
    const log={dispositivo:record.dispositivo,endpoint:url.pathname,action:data?.action,
      school_id:data?.school_id,pci_id:data?.pci_id};
    report.acciones.push(log);
    const send=(body,status=200)=>{
      log.status=status;return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    };
    if(request.method()!=='POST'||!data)return send({error:'Solicitud simulada inválida.'},400);
    const access=url.pathname==='/functions/v1/pci-access';
    const multi=url.pathname==='/functions/v1/pci-multipci';
    if(access&&data.action==='public-catalog')return send({schools:[school]});
    if(access&&data.action==='admin-login'){
      if(data.username===simulatedUser&&data.password===simulatedPassword)
        return send({...session,token:simulatedToken});
      return send({error:invalidMessage},401);
    }
    if((access||multi)&&data.token===simulatedToken){
      if(data.action==='session-info')return send(session);
      if(data.action==='list-schools')return send({schools:[school]});
      if(Number(data.school_id)===school.school_id){
        if(access&&data.action==='get-school-dashboard')return send({school,progress:school.progress,audit:school.audit});
        if(access&&data.action==='get-audit')return send({events:[]});
        if(multi&&data.action==='list-school-pcis'){
          const {legacy_state,...metadata}=pci;return send({pcis:[metadata]});
        }
        if(multi&&data.action==='get-school-legacy-links')
          return send({exists:false,revision:0,document:null,rows:[],source_model:'comun',source_updated_at:'2026-11-21T12:00:00.000Z'});
        if(multi&&data.pci_id===pci.pci_id&&data.action==='get-school-pci')return send({pci});
        if(multi&&data.pci_id===pci.pci_id&&data.action==='get-school-pci-unit')
          return send({error:'Unidad y modalidad incompatibles.'},400);
      }
    }
    record.accionesInesperadas.push(log);
    return send({error:'La prueba bloqueó una operación no autorizada.'},403);
  });
}

async function capture(page,record,name){
  const file=record.dispositivo+'-'+name+'.png';
  await page.screenshot({path:join(artifacts,file),fullPage:false});report.capturas.push(file);
}

async function exercise(page,record){
  await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
  await page.locator('header a[href="panel-general.html"]').click();
  await page.waitForURL(url=>url.pathname==='/panel-general.html');
  await page.locator('#login').waitFor({state:'visible'});
  await page.locator('#user').fill(simulatedUser);
  await page.locator('#pass').fill('clave-incorrecta-simulada-ci');
  await page.locator('#loginBtn').click();
  await page.waitForFunction(message=>document.getElementById('loginMsg')?.textContent===message,invalidMessage);
  assert.equal(await page.locator('#dashboard').isVisible(),false,'Una clave inválida no abre el tablero.');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('pci_admin_monitor_session')),null,
    'Un ingreso rechazado no deja sesión administrativa.');
  await capture(page,record,'clave-invalida');

  await page.locator('#pass').fill(simulatedPassword);await page.locator('#loginBtn').click();
  await page.locator('#dashboard').waitFor({state:'visible'});
  await page.locator('#rows tr').first().waitFor();
  assert.equal(await page.locator('#rows tr').count(),1);
  assert.match(await page.locator('#rows').innerText(),/Escuela simulada · Acceso administrativo/);
  assert.match(await page.locator('#sessionLabel').innerText(),/Administración simulada/);
  assert.equal(await page.locator('#login').isVisible(),false);
  await capture(page,record,'tablero');

  // También debe existir la segunda página que faltaba en la distribución.
  await page.locator('#rows a[href^="panel-escuela.html"]').click();
  await page.waitForURL(url=>url.pathname==='/panel-escuela.html'&&url.searchParams.get('admin')==='1');
  await page.locator('#dashboard').waitFor({state:'visible'});
  assert.match(await page.locator('#schoolTitle').innerText(),/Escuela simulada · Acceso administrativo/);
  assert.equal(await page.locator('#openPci').isVisible(),true);
  assert.match(await page.locator('#openPci').getAttribute('href'),/pci-orientaciones\.html\?school=1709&from=panel-general/);
  await capture(page,record,'panel-institucional');
  await page.locator('#backAdmin').click();
  await page.waitForURL(url=>url.pathname==='/panel-general.html');
  await page.locator('#dashboard').waitFor({state:'visible'});
  assert.equal(await page.locator('#login').isVisible(),false,'El retorno conserva la sesión administrativa válida.');

  // Recorrido directo de uso cotidiano desde la fila de la escuela.
  await page.locator('#rows').getByRole('link',{name:'Organización curricular',exact:true}).click();
  await page.waitForURL(url=>url.pathname==='/pci-orientaciones.html'&&url.searchParams.get('school')===String(school.school_id));
  await page.locator('#schoolPciCards .school-offer-card').waitFor();
  assert.equal(await page.locator('#schoolOverviewName').innerText(),school.name);
  assert.equal(await page.locator('#adminPanelLink').isVisible(),true);
  await capture(page,record,'organizacion');
  await page.locator('#schoolPciCards a[href*="pci='+pci.pci_id+'"][href*="view=oferta"]').click();
  await page.waitForFunction(()=>document.body.dataset.pciV2Ready==='true',null,{timeout:45000});
  await page.waitForFunction(()=>window.__adminCi.iniciosAcceso>=2,null,{timeout:15000});
  assert.equal(await page.locator('iframe').count(),0,'El PCI se abre como aplicación nativa.');
  assert.equal(page.frames().length,1);
  assert.equal(await page.locator('header.top').count(),1);
  assert.equal(await page.locator('#v85AccessPanel,[data-v85-role]').count(),0);
  assert.equal(await page.locator('#matrix .grid.levels .level').count(),5);
  const identity=await page.evaluate(()=>({school:PCIAplicacionV2.contexto.school.id,
    pci:PCIAplicacionV2.contexto.pci.pci_id,editable:PCIAplicacionV2.contexto.permissions.puedeEditar,
    role:PCIAplicacionV2.contexto.session.role}));
  assert.deepEqual(identity,{school:school.school_id,pci:pci.pci_id,editable:true,role:'admin'});
  assert.equal(await page.locator('#pciGlobalDock [data-dock="institutional"]').isVisible(),true);
  assert.match(await page.locator('#pciV2ContextNotice').innerText(),/Borrador local/);
  await capture(page,record,'pci-nativo');
  const logins=report.acciones.filter(action=>action.dispositivo===record.dispositivo&&action.action==='admin-login');
  assert.deepEqual(logins.map(action=>action.status),[401,200]);
  assert.deepEqual(record.errores,[],'Sin excepciones de JavaScript.');
  assert.deepEqual(record.recursosFallidos,[],'El paquete contiene todos los recursos solicitados.');
  assert.deepEqual(record.accionesInesperadas,[],'El recorrido sólo pide autenticación y lecturas previstas.');
  assert.deepEqual(record.dialogos,[],'No se activan confirmaciones ni acciones de regeneración.');
  record.resultado='aprobado';
}

try{
  const preparation=execFileSync(process.execPath,['scripts/preparar-publicacion-aplicacion-v2.mjs','--out',distribution],
    {cwd:root,encoding:'utf8'});
  report.distribucion=JSON.parse(preparation);
  for(const file of ['index.html','panel-general.html','panel-escuela.html','panel-usuarios.html','panel-accesos.html',
    'pci-orientaciones.html','src/admin-escuelas-panel.mjs','src/aplicacion-v2/entrada.mjs'])
    assert.ok((await readFile(join(distribution,file))).length,'El paquete debe incluir '+file);
  server=createServer(async(req,res)=>{
    try{
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
      const pathname=new URL(req.url,'http://127.0.0.1').pathname;
      const file=resolve(distribution,'.'+decodeURIComponent(pathname));
      const rel=relative(distribution,file);
      if(rel==='..'||rel.startsWith('..'+sep))throw Error('Ruta fuera de la distribución.');
      const bytes=await readFile(file);
      res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
      res.end(req.method==='HEAD'?undefined:bytes);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
  report.navegador=browser.version();
  for(const device of [
    {name:'escritorio',viewport:{width:1440,height:1000},isMobile:false,hasTouch:false},
    {name:'celular',viewport:{width:390,height:844},isMobile:true,hasTouch:true}
  ]){
    const record={dispositivo:device.name,errores:[],recursosFallidos:[],accionesInesperadas:[],dialogos:[]};
    report.casos.push(record);console.log('Acceso administrativo en paquete publicado: '+device.name);
    const context=await browser.newContext({viewport:device.viewport,isMobile:device.isMobile,hasTouch:device.hasTouch,
      deviceScaleFactor:1,serviceWorkers:'block'});
    const page=await context.newPage();page.setDefaultTimeout(18000);
    await installMocks(page,record);
    try{await exercise(page,record);}
    catch(error){
      record.resultado='fallido';record.error=error.stack||String(error);
      record.diagnostico=await page.evaluate(()=>({url:location.href,title:document.title,
        login:document.querySelector('#loginMsg')?.textContent,fatal:document.querySelector('#fatal')?.textContent,
        ready:document.body.dataset.pciV2Ready,body:document.body.textContent.slice(-1800)})).catch(e=>({error:e.message}));
      report.fallos.push({dispositivo:device.name,error:record.error});
      await page.screenshot({path:join(artifacts,device.name+'-error.png'),fullPage:false}).catch(()=>{});
      console.error(record.error);
    }finally{await context.close();}
  }
}catch(error){report.fallos.push({fase:'preparacion',error:error.stack||String(error)});}
finally{
  if(browser)await browser.close();if(server)await new Promise(done=>server.close(done));
  report.escrituras=report.acciones.filter(action=>/^(?:create|save|reset|bulk|delete|update|set)-/.test(action.action||''));
  report.fixturesInalteradas=JSON.stringify({school,session,pci})===fixtureBefore;
  await writeFile(join(artifacts,'resultado-admin.json'),JSON.stringify(report,null,2));
  await rm(temporary,{recursive:true,force:true});
}
assert.equal(report.fallos.length,0,JSON.stringify(report.fallos,null,2));
assert.deepEqual(report.escrituras,[],'No se crean, guardan, eliminan ni regeneran datos.');
assert.deepEqual(report.externosBloqueados,[],'Los recursos requeridos se sirven desde el paquete.');
assert.equal(report.fixturesInalteradas,true);
console.log(JSON.stringify({resultado:'aprobado',dispositivos:report.casos.length,paqueteReal:true,
  capturas:report.capturas.length,escrituras:report.escrituras.length,
  informe:relative(root,join(artifacts,'resultado-admin.json'))}));
