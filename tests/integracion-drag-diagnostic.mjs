import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const launch=chromium.launch.bind(chromium);
chromium.launch=async options=>{
 const browser=await launch(options);
 const create=browser.newContext.bind(browser);
 browser.newContext=async settings=>{
  const context=await create(settings);
  await context.addInitScript(()=>{
   window.__dragEvents=[];
   const add=event=>{
    if(window.__dragEvents.length>80)window.__dragEvents.shift();
    const el=event.target instanceof Element?event.target:null;
    if(!el?.closest('#board,#pciNativeV2Coverage'))return;
    const rect=document.querySelector('#groups .assigned-list')?.getBoundingClientRect();
    window.__dragEvents.push({type:event.type,target:el.tagName+'.'+el.className,
     x:event.clientX,y:event.clientY,group:el.closest('[data-group-id]')?.dataset.groupId,
     content:el.closest('[data-content-id]')?.dataset.contentId,
     prevented:event.defaultPrevented,
     transfer:event.type==='drop'?event.dataTransfer?.getData('text/plain'):null,
     targetRect:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null,
     inline:window.PCIInlineCoverage?.diagnostics?.()});
   };
   for(const name of ['pointerdown','pointerup','pointercancel','dragstart','dragover','drop','dragend'])document.addEventListener(name,add,true);
  });
  return context;
 };
 const close=browser.close.bind(browser);
 browser.close=async()=>{
  await mkdir('test-artifacts/integracion-inline',{recursive:true});
  for(const [i,page] of browser.contexts().flatMap(c=>c.pages()).entries()){
   if(page.isClosed())continue;
   const debug=await page.evaluate(()=>({events:window.__dragEvents,
    inline:window.PCIInlineCoverage?.diagnostics?.(),
    scrollY,viewport:{width:innerWidth,height:innerHeight},
    content:document.querySelector('#contentList [data-content-id]')?.getBoundingClientRect().toJSON(),
    groups:[...document.querySelectorAll('#groups [data-group-id]')].slice(0,2).map(x=>({id:x.dataset.groupId,count:x.querySelectorAll('.assigned-item').length}))})).catch(()=>null);
   if(debug?.events?.length)console.log('DRAG_EVENTS',JSON.stringify(debug));
   await page.screenshot({path:'test-artifacts/integracion-inline/diagnostico-arrastre-'+i+'.png',fullPage:false}).catch(()=>{});
  }
  return close();
 };
 return browser;
};
await import('./integracion-matriz-integrada-browser.mjs');
