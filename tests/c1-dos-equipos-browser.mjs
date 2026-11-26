// Prueba de regresión no destructiva C1: usa solo servidor HTTP y datos simulados.
// C1 ampliado: dos equipos, cambios pendientes, recuperación de ambas versiones.
// Datos 100 % simulados; ninguna conexión real a Supabase.
import {createServer} from 'node:http';import {readFile,mkdir} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const root=process.cwd(),out=resolve('test-artifacts/multipci-portal/c1');await mkdir(out,{recursive:true});
const sha=v=>createHash('sha256').update(v).digest('hex');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.txt':'text/plain','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.csv':'text/csv'};
const server=createServer(async(q,r)=>{try{const p=new URL(q.url,'http://x').pathname;const f=resolve(root,'.'+decodeURIComponent(p));if(relative(root,f).startsWith('..'))throw 0;const b=await readFile(f);r.writeHead(200,{'Content-Type':mime[extname(f)]||'application/octet-stream'});r.end(b)}catch{r.writeHead(404);r.end()}});
await new Promise(d=>server.listen(0,'127.0.0.1',d));const origin='http://127.0.0.1:'+server.address().port;
const legacy={profile:'comun',areas:{}};
const PCI={pci_id:'17171717-1111-4111-8111-000000000001',model:'comun',orientation_id:'economia_administracion',shift_id:'manana',title:'Media simulada',school_id:1701,status:'borrador',process_id:'proc-sim',legacy_sha256:sha(JSON.stringify(legacy)),legacy_state:legacy};
const TOKEN='tok-sim',school={school_id:1701,name:'Escuela simulada C1',cue:'SIM',model:'comun'};
let srv,red;
function reset(){srv={revision:0,document:null,history:[]};red={A:true,B:true}}
const marca=doc=>doc?.v2?.maps?.[doc.v2.active]?.teachers?.auditoria??null;
async function abrir(ctx,disp){
 const page=await ctx.newPage();page.on('dialog',d=>d.accept());const descargas=[];
 page.on('download',async d=>{const f=await d.path();descargas.push({nombre:d.suggestedFilename(),contenido:await readFile(f,'utf8')})});
 await page.route('**/*',async route=>{const rq=route.request(),u=new URL(rq.url());
  if(u.origin===origin)return route.continue();
  if(!/supabase/.test(u.hostname))return route.abort('blockedbyclient');
  let b=null;try{b=rq.postDataJSON()}catch{}
  const ok=(v,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(v)});
  if(u.pathname.endsWith('/pci-access'))return ok({schools:[school]});
  if(b?.token!==TOKEN)return ok({error:'Sesión inválida'},401);
  if(b.action==='save-school-pci-unit'&&!red[disp])return route.abort('internetdisconnected');
  switch(b.action){
   case 'session-info':return ok({role:'editor',permissions:[],school_ids:[],all_schools:false});
   case 'list-school-pcis':return ok({pcis:[(({legacy_state,...p})=>p)(PCI)]});
   case 'get-school-legacy-links':return ok({exists:false,revision:0,rows:[],document:null,source_updated_at:'2026-11-01T00:00:00Z',source_model:'comun'});
   case 'get-school-pci':return ok({pci:PCI});
   case 'get-school-pci-unit':return ok(srv.document?{exists:true,revision:srv.revision,base_version:'v2-original-embedded-v1',document:srv.document}:{exists:false,revision:0});
   case 'save-school-pci-unit':
    if(b.expected_revision!==srv.revision)return ok({ok:false,status:409,code:'stale_revision',current_revision:srv.revision},409);
    srv.revision++;srv.document=b.document;srv.history.push({revision:srv.revision,dispositivo:disp,marca:marca(b.document)});
    return ok({ok:true,revision:srv.revision,updated_at:new Date().toISOString()});
  }
  return ok({error:'bloqueado'},400);
 });
 await page.goto(origin+'/pci-orientaciones.html?school=1701&pci='+PCI.pci_id+'&view=oferta');
 await page.waitForFunction(()=>document.body.dataset.pciV2Ready==='true'||/No se pudo abrir/.test(document.body.innerText),null,{timeout:60000}).catch(()=>{});
 await page.waitForTimeout(2500);return {page,descargas};
}
const editar=(p,v)=>p.evaluate(async v=>{const s=PCIAplicacionV2.snapshot();const m=s.maps[s.active];m.teachers={...(m.teachers||{}),auditoria:v};try{await PCIAplicacionV2.applyDraft(s);return 'ok'}catch(e){return 'error: '+e.message}},v).then(async r=>{await p.waitForTimeout(1500);return r});
const estadoLocal=p=>p.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k.startsWith('pci-aplicacion-v2-'))continue;try{const r=JSON.parse(localStorage.getItem(k));o[k.startsWith('pci-aplicacion-v2-resguardo')?'resguardo':k.startsWith('pci-aplicacion-v2-borrador')?'borrador':'otro']=(o[k.startsWith('pci-aplicacion-v2-resguardo')?'resguardo':'x']||[]).concat([r?.v2?.maps?.[r.v2.active]?.teachers?.auditoria??r?.maps?.[r?.active]?.teachers?.auditoria??null])}catch{}}return o});
const marcaEnPantalla=p=>p.evaluate(()=>{const s=PCIAplicacionV2?.snapshot?.();return s?.maps?.[s.active]?.teachers?.auditoria??null}).catch(()=>null);
const bloqueado=p=>p.evaluate(()=>/No se pudo abrir/.test(document.body.innerText));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN});
const login=async c=>c.addInitScript(([t,s])=>sessionStorage.setItem('pci_access_session',JSON.stringify({token:t,role:'editor',school_id:s})),[TOKEN,1701]);
const nuevo=async()=>{const c=await browser.newContext({acceptDownloads:true});await login(c);return c};
const R={};const assert=(cond,msg)=>{(R.fallos??=[]);if(!cond)R.fallos.push(msg)};

// E1 · Ambos en línea, edición cruzada con 409 y recuperación
reset();{const A=await nuevo(),B=await nuevo();let a=await abrir(A,'A'),b=await abrir(B,'B');
 await editar(a.page,'A-1');const b409=await editar(b.page,'B-1');
 const statusB=await b.page.locator('#pciV2DraftStatus').innerText().catch(()=>'');
 await b.page.reload();await b.page.waitForTimeout(6000);
 const aviso=await b.page.locator('#pciV2ContextNotice').innerText().catch(()=>'');
 const pantalla=await marcaEnPantalla(b.page);
 await b.page.locator('button.pci-v2-resguardo',{hasText:'guardado en línea'}).click();await b.page.locator('button.pci-v2-resguardo',{hasText:'mis cambios no confirmados'}).click();await b.page.waitForTimeout(1200);
 const dl=b.descargas.map(d=>({nombre:d.nombre.replace(/\d{10,}/,'…'),marca:marca(JSON.parse(d.contenido))}));
 await b.page.locator('button.pci-v2-resguardo-recuperar').click();await b.page.waitForTimeout(3000);
 R.E1={statusB_tras_409:statusB,bloqueado:await bloqueado(b.page),aviso:aviso.slice(0,120),pantalla_al_reabrir:pantalla,descargas:dl,servidor:srv.history,local_B:await estadoLocal(b.page)};
 assert(!R.E1.bloqueado,'E1: B bloqueado');assert(pantalla==='A-1','E1: B no abrió la versión del servidor');
 assert(dl.some(d=>d.marca==='A-1')&&dl.some(d=>d.marca==='B-1'),'E1: faltan descargas');
 assert(srv.history.at(-1)?.marca==='B-1'&&srv.history.some(h=>h.marca==='A-1'),'E1: recuperación no generó revisión nueva o se perdió A');
 await A.close();await B.close();}

// E2 · Equipo A sin conexión, B guarda, A reabre con conexión
reset();{const A=await nuevo(),B=await nuevo();let a=await abrir(A,'A');red.A=false;await editar(a.page,'A-offline');
 let b=await abrir(B,'B');await editar(b.page,'B-1');red.A=true;
 await a.page.reload();await a.page.waitForTimeout(6000);
 R.E2={bloqueado:await bloqueado(a.page),pantalla:await marcaEnPantalla(a.page),local_A:await estadoLocal(a.page),servidor:srv.history,botones:await a.page.locator('button.pci-v2-resguardo').allInnerTexts()};
 assert(!R.E2.bloqueado,'E2: A bloqueado');assert(R.E2.pantalla==='B-1','E2: A no abrió la versión del servidor');
 assert((R.E2.local_A.resguardo||[]).includes('A-offline'),'E2: cambios offline de A no resguardados');
 await a.page.screenshot({path:resolve(out,'c1-e2-recuperacion.png'),fullPage:false});
 await A.close();await B.close();}

// E3 · Cambios pendientes en la MISMA revisión: se suben al reabrir
reset();{const A=await nuevo();let a=await abrir(A,'A');await editar(a.page,'A-1');red.A=false;await editar(a.page,'A-2-offline');
 const rev=srv.revision;red.A=true;await a.page.reload();await a.page.waitForTimeout(7000);
 R.E3={rev_antes:rev,rev_despues:srv.revision,servidor:srv.history,pantalla:await marcaEnPantalla(a.page),estado:await a.page.locator('#pciV2DraftStatus').innerText().catch(()=>''),local_A:await estadoLocal(a.page)};
 assert(srv.history.at(-1)?.marca==='A-2-offline','E3: cambios pendientes no se subieron');
 await A.close();}

// E4 · Flujo normal: reabrir sin conflicto no muestra avisos ni crea resguardos
reset();{const A=await nuevo();let a=await abrir(A,'A');await editar(a.page,'A-1');await a.page.reload();await a.page.waitForTimeout(5000);
 R.E4={servidor:srv.history,pantalla:await marcaEnPantalla(a.page),local:await estadoLocal(a.page),aviso:await a.page.locator('#pciV2ContextNotice').count()};
 assert(!(R.E4.local.resguardo||[]).length,'E4: resguardo innecesario');assert(srv.history.length===1,'E4: escrituras de más');
 await A.close();}

console.log(JSON.stringify(R,null,1));await browser.close();server.close();
process.exit(R.fallos?.length?1:0);
