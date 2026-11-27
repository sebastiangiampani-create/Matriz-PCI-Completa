import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parsePciRoute,pciRouteHref,samePciRoute} from '../src/pci-router.mjs';
import {normalizeCue,validateSchoolDraft} from '../src/admin-escuelas-panel.mjs';
const uuid='00000000-0000-4000-8000-000000000001';
test('El historial mantiene la escuela, PCI y fase, sin tokens',()=>{
 const initial='https://ejemplo.org/Matriz-PCI-Completa/pci-orientaciones.html?school=1017&from=panel-general';
 const next=pciRouteHref(initial,{schoolId:1017,pciId:uuid,view:'oferta'});
 assert.equal(next,'/Matriz-PCI-Completa/pci-orientaciones.html?school=1017&from=panel-general&pci='+uuid+'&view=oferta');
 assert.deepEqual(parsePciRoute(next),{schoolId:1017,pciId:uuid,view:'oferta'});
 const develop=pciRouteHref(next,{schoolId:1017,pciId:uuid,view:'fg'});
 assert.equal(parsePciRoute(develop).view,'fg');
 assert.equal(samePciRoute(parsePciRoute(develop),{schoolId:1017,pciId:uuid,view:'fg'}),true);
 const home=pciRouteHref(develop,{schoolId:1017,pciId:null});
 assert.deepEqual(parsePciRoute(home),{schoolId:1017,pciId:null,view:'oferta'});
 assert.match(home,/from=panel-general/);
 assert.ok(!home.includes('pci='));
});
test('No se permite forzar rutas que cambien el PCI por parámetros arbitrarios',()=>{
 const invalid=parsePciRoute('/pci-orientaciones.html?school=1017&pci=otro-pci&view=fo');
 assert.equal(invalid.pciId,null);
 assert.equal(invalid.view,'oferta');
 assert.equal(parsePciRoute('/pci-orientaciones.html?school=0&pci='+uuid).schoolId,null);
 assert.equal(parsePciRoute('/pci-orientaciones.html?school=1017&pci='+uuid+'&view=inyeccion').view,'oferta');
});
test('Alta administrativa valida CUE y detecta duplicados antes de escribir',()=>{
 const existing=[{cue:'A-290M',name:'Instituto Cabrini'}];
 assert.equal(normalizeCue(' a-290m '),'A-290M');
 assert.throws(()=>validateSchoolDraft({name:'Instituto nuevo',cue:'a-290m',year:2026,email:''},existing),/ya pertenece/);
 assert.throws(()=>validateSchoolDraft({name:'Escuela',cue:'?',year:2026,email:''},[]),/válido/);
 assert.throws(()=>validateSchoolDraft({name:'Escuela',cue:'CUE-123',year:2019,email:''},[]),/año/);
 const row=validateSchoolDraft({name:'  Escuela  Nueva  ',cue:'b-101',year:'2026',email:'Institucional@Escuela.edu.ar'},[]);
 assert.deepEqual(row,{name:'Escuela Nueva',cue:'B-101',email:'institucional@escuela.edu.ar',year:2026});
});
test('Los archivos históricos y el constructor no almacenan claves de Supabase en enlaces',()=>{
 const route=pciRouteHref('https://escuela.example/pci-orientaciones.html?from=panel-escuela',{schoolId:1017,pciId:uuid,view:'fo'});
 assert.ok(!/token|secret|service_role|apikey/i.test(route));
});

test('La portada indica Panel institucional DIR para configurar las tres modalidades y no ofrece demos públicas',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const card=index.match(/<aside class="card"><h2>Modelos curriculares<\/h2>([\s\S]*?)<\/aside>/);
 assert.ok(card,'La portada debe conservar el recuadro de modelos curriculares');
 assert.match(card[1],/Cada escuela deberá ingresar al Panel institucional · DIR/);
 assert.doesNotMatch(card[1],/href="panel-escuela.html"/);
 const belowCard=index.slice(index.indexOf('</aside>',index.indexOf('<aside class="card"><h2>Modelos curriculares')));
 assert.match(belowCard,/href="panel-escuela.html">Panel institucional · DIR<\/a>/);
 const header=index.match(/<header class="site-top">([\s\S]*?)<\/header>/)?.[1]||'';
 const footer=index.match(/<footer class="site-footer">([\s\S]*?)<\/footer>/)?.[1]||'';
 assert.doesNotMatch(header,/panel-general\.html|panel-escuela\.html/);
 assert.match(footer,/class="admin-muted" href="panel-general.html">Administración general/);
 for(const nombre of ['Secundaria Común (Media)','Secundaria Técnica','BA+15'])
   assert.ok(card[1].includes(nombre),nombre+' no figura como modelo curricular');
 assert.doesNotMatch(card[1],/modelo-comun\.html|modelo-tecnica\.html|modelos-v2\.html|modelo-ba15\.html/);
 assert.match(index,/function schoolDestination/);
 assert.match(index,/pci-orientaciones\.html\?school=/);
});
