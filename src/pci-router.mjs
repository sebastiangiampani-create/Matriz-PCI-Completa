/** URL de navegación del PCI: escuela → orientación → fase. No almacena tokens. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const views=new Set(['oferta','desarrollo','fg','fo']);
export function parsePciRoute(href){
  const url=new URL(href,'https://pci.example.invalid');
  const raw=Number(url.searchParams.get('school'));
  const schoolId=Number.isSafeInteger(raw)&&raw>=1001?raw:null;
  const candidate=String(url.searchParams.get('pci')||'');
  const pciId=UUID.test(candidate)?candidate:null;
  const view=pciId&&views.has(url.searchParams.get('view'))?url.searchParams.get('view'):'oferta';
  return {schoolId,pciId,view};
}
export function pciRouteHref(href,{schoolId=null,pciId=null,view='oferta'}={}){
  const url=new URL(href,'https://pci.example.invalid');
  if(Number.isSafeInteger(Number(schoolId))&&Number(schoolId)>=1001)
    url.searchParams.set('school',String(schoolId));
  else url.searchParams.delete('school');
  if(pciId&&UUID.test(String(pciId))){
    url.searchParams.set('pci',pciId);
    url.searchParams.set('view',views.has(view)?view:'oferta');
  }else{
    url.searchParams.delete('pci');
    url.searchParams.delete('view');
  }
  return url.pathname+url.search+url.hash;
}
export function samePciRoute(a,b){
  return Number(a?.schoolId)===Number(b?.schoolId)&&
    String(a?.pciId||'')===String(b?.pciId||'')&&
    (a?.pciId?String(a?.view||'oferta')===String(b?.view||'oferta'):true);
}
