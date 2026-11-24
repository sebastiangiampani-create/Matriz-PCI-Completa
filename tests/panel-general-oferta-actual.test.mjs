import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const file=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const panel=await file('panel-general.html');
const edge=await file('supabase/functions/pci-multipci/index.ts');
const sql=await file('supabase/sql/pci_workspace_portfolio_summary_v1.sql');
const a=panel.indexOf('const OFFER_NAMES='),b=panel.indexOf('async function loadCurrentOffers()',a);
const c=panel.indexOf('function filtered()',b),d=panel.indexOf('function renderStats(',c);
assert.ok(a>=0&&b>a&&c>b&&d>c,'El panel publica los cálculos de modalidad actual.');
const selects={
 q:{value:''},model:{value:''},origin:{value:''},
 activity:{value:''},progressFilter:{value:''}
};
const schools=[
 {school_id:1001,name:'Escuela sin nuevo PCI',cue:'A-1001',model:'comun',currentOffers:[],currentPciCount:0,audit:{}},
 {school_id:1002,name:'Escuela mixta',cue:'A-1002',model:'comun',
  currentOffers:[{model:'comun',count:2},{model:'tecnica',count:1},{model:'ba15',count:1}],currentPciCount:4,audit:{}},
 {school_id:1003,name:'Escuela técnica',cue:'A-1003',model:'tecnica',
  currentOffers:[{model:'tecnica',count:1}],currentPciCount:1,audit:{}}
];
const context={
 offerInventoryReady:true,schools,
 $:id=>selects[id],editor:()=>'',daysAgo:()=>Infinity,pct:()=>0,
 esc:x=>String(x),Number,Math
};
const {offerSummary,offerBadges,hasCurrentOffer,offerCount,filtered}=vm.runInNewContext(
 panel.slice(a,b)+'\n'+panel.slice(c,d)+'\n({offerSummary,offerBadges,hasCurrentOffer,offerCount,filtered})',context
);

test('una escuela histórica Común puede tener simultáneamente Media, Técnica y BA+15',()=>{
 assert.match(offerSummary(schools[1]),/Media \(2\)/);
 assert.match(offerSummary(schools[1]),/Técnica \(1\)/);
 assert.match(offerSummary(schools[1]),/BA \+15 \(1\)/);
 assert.equal(offerCount(schools[1]),4);
 assert.equal(hasCurrentOffer(schools[1],'tecnica'),true);
 assert.match(offerBadges(schools[1]),/4 PCI creado/);
 assert.equal(schools[1].model,'comun','El modelo de origen NO se cambia.');
});

test('una escuela que todavía no declaró su oferta se identifica como pendiente, no como Media',()=>{
 assert.equal(offerSummary(schools[0]),'Sin PCI definido');
 assert.equal(hasCurrentOffer(schools[0],'comun'),false);
 assert.match(offerBadges(schools[0]),/Sin PCI definido/);
 context.offerInventoryReady=false;
 assert.match(offerSummary(schools[0]),/Datos de oferta no disponibles/);
 assert.match(offerBadges(schools[0]),/Oferta no disponible/);
 context.offerInventoryReady=true;
});

test('filtros de oferta actual y matriz histórica son independientes',()=>{
 const ids=()=>filtered().map(s=>s.school_id).join(',');
 selects.model.value='comun';
 assert.equal(ids(),'1002','No inferir Media por matriz Común.');
 selects.model.value='tecnica';
 assert.equal(ids(),'1002,1003');
 selects.model.value='ba15';
 assert.equal(ids(),'1002');
 selects.model.value='none';
 assert.equal(ids(),'1001');
 selects.model.value='';
 selects.origin.value='comun';
 assert.equal(ids(),'1001,1002','Origen histórico: escuelas diferentes según su oferta nueva.');
 selects.origin.value='tecnica';
 assert.equal(ids(),'1003');
 selects.origin.value='';
});

test('la función SQL agrupa las ofertas nuevas sin actualizar matriz histórica',()=>{
 assert.match(sql,/FROM pci_workspace\.pcis/);
 assert.match(sql,/GROUP BY school_id, model/);
 assert.match(sql,/SECURITY INVOKER/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
 assert.match(sql,/service_role/);
 assert.doesNotMatch(sql,/\b(UPDATE|DELETE|TRUNCATE)\s+(pci_proposals|pci_workspace)/i);
 assert.doesNotMatch(sql.split('  SELECT COALESCE(')[1],/pci_proposals\.data/,'La consulta SQL no debe leer la matriz histórica.');
});

test('solo una sesión administrativa con alcance escolar obtiene el inventario actual',()=>{
 const i=edge.indexOf("if(action==='list-school-offer-summary')");
 assert.ok(i>0,'Falta ruta de resumen de ofertas.');
 const action=edge.slice(i,edge.indexOf("if(action==='create-school-v2')",i));
 assert.match(action,/dashboard\.view/);
 assert.match(action,/isScoped\(s,Number\(row\.school_id\)\)/);
 assert.match(action,/pci_workspace_portfolio_summary_v1/);
 assert.doesNotMatch(action,/\.update\(|\.insert\(|\.delete\(/);
 assert.match(panel,/id="model" disabled/);
 assert.match(panel,/id="origin"/);
 assert.match(panel,/#?offerInventoryStatus/);
 assert.match(panel,/action:'list-school-offer-summary'/);
});
)[1],/pci_proposals\.data/,'La consulta SQL no debe leer ni alterar el modelo histórico.');
});

test('solo una sesión administrativa con alcance escolar obtiene el inventario actual',()=>{
 const i=edge.indexOf("if(action==='list-school-offer-summary')");
 assert.ok(i>0,'Falta ruta de resumen de ofertas.');
 const action=edge.slice(i,edge.indexOf("if(action==='create-school-v2')",i));
 assert.match(action,/dashboard\.view/);
 assert.match(action,/isScoped\(s,Number\(row\.school_id\)\)/);
 assert.match(action,/pci_workspace_portfolio_summary_v1/);
 assert.doesNotMatch(action,/\.update\(|\.insert\(|\.delete\(/);
 assert.match(panel,/id="model" disabled/);
 assert.match(panel,/id="origin"/);
 assert.match(panel,/#?offerInventoryStatus/);
 assert.match(panel,/action:'list-school-offer-summary'/);
});
