import {chromium} from 'playwright';
const repo='sebastiangiampani-create/Matriz-PCI-Completa',ref='619b9e59835ba116b0a74729aad3f3a755321c09';
const routes=[
 ['ENLACE_ENTREGADO',`https://raw.githack.com/${repo}/fix/rescate-constructor-v2-reglas-20261119/revision-v2-portal-real.html?school=1001`],
 ['ENLACE_COMMIT',`https://raw.githack.com/${repo}/${ref}/revision-v2-portal-real.html?school=1001`],
 ['PAGES_ACTUAL',`https://sebastiangiampani-create.github.io/Matriz-PCI-Completa/revision-v2-portal-real.html?school=1001`]
];
const browser=await chromium.launch(process.env.CHROME_BIN?{headless:true,executablePath:process.env.CHROME_BIN}:{headless:true});
const results=[];
for(const [name,url] of routes){
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage();const errors=[],net=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('requestfailed',r=>net.push({url:r.url().slice(0,175),error:r.failure()?.errorText||'?'}));
 let status=null,finalUrl='';
 try{const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});status=response?.status()||null;
 await page.waitForTimeout(5500);finalUrl=page.url();
 }catch(e){errors.push(String(e.message).slice(0,250))}
 const body=await page.locator('body').textContent().catch(()=>'');
 const cards=await page.locator('.school-offer-card').count().catch(()=>0);
 const openers=await page.locator('.school-offer-card button[aria-label^="Abrir Mapa de la Oferta"]').count().catch(()=>0);
 const summary={name,status,finalUrl,bodyHead:body?.trim().slice(0,600),cards,openers,errors:errors.slice(0,6),networkErrors:net.slice(0,5)};
 results.push(summary);console.log('PREVIEW_REMOTE_DIAG '+JSON.stringify(summary));
 await context.close();
}
await browser.close();
const ready=results.find(r=>r.name==='ENLACE_ENTREGADO');
if(!ready||ready.cards<3){console.error('FALLO_PUBLICACION: el enlace entregado no muestra las tres tarjetas de PCI. Las pruebas locales no acreditan esta URL.');process.exitCode=1;}
