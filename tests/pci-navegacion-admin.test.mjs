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

test('La portada distingue modelos de consulta de constructores institucionales y no anuncia modalidades activas como Próximamente',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(index,/Educación Técnica y BA\+15/);
 assert.match(index,/Modelos de consulta, sin clave/);
 assert.doesNotMatch(index,/Bachilleratos NES<span class="tag">Próximamente/);
 assert.doesNotMatch(index,/DET<span class="tag">Próximamente/);
 assert.match(index,/function schoolDestination/);
 assert.match(index,/pci-orientaciones\.html\?school=/);
});
