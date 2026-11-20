import {chromium} from 'playwright';
const repo='sebastiangiampani-create/Matriz-PCI-Completa';
const branch='feature/tres-entornos-v2-paralelos-20261120';
const urls=[
 ['githack-cdn','https://rawcdn.githack.com/'+repo+'/'+branch+'/experiencias-v2/index.html'],
 ['githack','https://raw.githack.com/'+repo+'/'+branch+'/experiencias-v2/index.html'],
 ['statically','https://cdn.statically.io/gh/'+repo+'/'+branch+'/experiencias-v2/index.html'],
 ['github-pages','https://sebastiangiampani-create.github.io/Matriz-PCI-Completa/experiencias-v2/index.html']
];
const browser=await chromium.launch(process.env.CHROME_BIN?{headless:true,executablePath:process.env.CHROME_BIN}:{headless:true});
let success=[];
for(const [name,url] of urls){
 const p=await browser.newPage({viewport:{width:1300,height:850}});
 let status=null,error=null,count=0,contentType=null;
 try{
   const response=await p.goto(url,{waitUntil:'domcontentloaded',timeout:18000});
   status=response?.status()||null;contentType=response?.headers()?.['content-type']||null;
   await p.waitForTimeout(800);
   count=await p.locator('.card').count();
   if(count===3&&name!=='github-pages'){
     await p.locator('a[href="media.html"]').first().click();
     await p.waitForTimeout(500);
     if(!p.url().includes('media.html')){count=0;error='Los enlaces internos no abren en el CDN.'}
   }
 }catch(e){error=String(e.message||e).slice(0,250)}
 console.log('URL_EXTERNA '+JSON.stringify({name,url,status,contentType,count,error,finalUrl:p.url(),text:(await p.locator('body').textContent().catch(()=>''))?.trim().slice(0,170)}));
 if(count===3&&status===200)success.push({name,url});
 await p.close();
}
console.log('URL_PUBLICA_OPERATIVA '+JSON.stringify(success));
await browser.close();
if(!success.length)console.log('SIN_PUBLICACION: los motores son correctos en servidor local, pero no hay URL pública verificada.');
