(()=>{
  'use strict';

  const frame=()=>document.getElementById('pci');
  let installedFor=null;

  function install(){
    const f=frame(),w=f?.contentWindow;
    if(!w||installedFor===w)return;
    try{
      w.eval(`(()=>{
        const expose=(name,getter,setter)=>{
          try{Object.defineProperty(window,name,{configurable:true,enumerable:false,get:getter,set:setter})}
          catch(error){console.warn('PCI bridge:',name,error)}
        };
        expose('app',()=>app,value=>{app=value});
        expose('DATA',()=>DATA,value=>{DATA=value});
        expose('CFG',()=>CFG);
        expose('selected',()=>selected,value=>{selected=Number(value)||0});
        window.PCI_API={
          getApp:()=>app,
          setApp:value=>{app=value;localStorage.setItem('pciAppV2',JSON.stringify(app));return app},
          getData:()=>DATA,
          setData:value=>{DATA=Array.isArray(value)?value:[];return DATA},
          getConfig:()=>CFG,
          save:feedback=>save(feedback||0),
          renderAreas:()=>renderAreas(),
          renderBoard:()=>renderBoard(),
          renderGroups:()=>renderGroups(),
          openArea:name=>openArea(name),
          show:id=>show(id)
        };
        window.dispatchEvent(new CustomEvent('pci-core-ready'));
      })()`);
      installedFor=w;
      window.dispatchEvent(new CustomEvent('pci-frame-ready'));
    }catch(error){
      installedFor=null;
      console.error('No se pudo instalar el puente PCI:',error);
    }
  }

  frame()?.addEventListener('load',()=>setTimeout(install,0));
  setInterval(()=>{try{if(!frame()?.contentWindow?.PCI_API)install()}catch{}},400);
  install();
})();