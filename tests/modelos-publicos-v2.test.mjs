import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MODELOS_PUBLICOS_V2,opcionesConsultaV2,rutaConsultaV2} from '../src/modelos-consulta-v2.mjs';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('la portada informa los tres modelos y dirige al Panel institucional DIR sin enlaces de consulta',async()=>{
 const html=await read('index.html');
 const aside=html.slice(html.indexOf('<aside class="card"><h2>Modelos curriculares</h2>'),html.indexOf('</aside>')+8);
 assert.ok(aside.length>80);
 for(const n of ['Secundaria Común (Media)','Secundaria Técnica','BA+15'])
   assert.ok(aside.includes(n),'Falta el modelo '+n);
 assert.match(html,/class="btn primary dir-access" href="panel-escuela.html">Panel institucional · DIR/);
 assert.doesNotMatch(aside,/href="panel-escuela.html"/);
 assert.doesNotMatch(aside,/href="modelos-v2\.html|href="modelo-comun\.html|href="modelo-tecnica\.html|href="modelo-ba15\.html/);
 assert.match(html,/Constructor curricular · clave PCI/);
});
test('los tres modelos usan reglas de 10, 12 y 8 cuatrimestres y catálogos completos',()=>{
 assert.deepEqual(MODELOS_PUBLICOS_V2.map(x=>x.cuatrimestres),[10,12,8]);
 assert.ok(opcionesConsultaV2('comun').length>=16);
 assert.ok(opcionesConsultaV2('tecnica').length>=26);
 assert.ok(opcionesConsultaV2('ba15').length>=16);
});
test('la consulta de Media sigue usando el V2 original y no el app.html histórico',()=>{
 const url=new URL(rutaConsultaV2('comun','comunicacion'),'https://pci.example/');
 assert.equal(url.pathname,'/revision-v2-embed.html');
 assert.equal(url.searchParams.get('orientation'),'Comunicación');
 assert.equal(url.searchParams.get('pci'),'modelo-v2-comun-comunicacion');
 assert.ok(!url.searchParams.has('token'));
});
test('Técnica y BA+15 abren el motor V2 derivado, sin credenciales ni escuelas reales',()=>{
 for(const [model,param,selected] of [['tecnica','specialty','computacion'],['ba15','orientation','economia_administracion']]){
   const url=new URL(rutaConsultaV2(model,selected),'https://pci.example/');
   assert.equal(url.pathname,'/revision-v2-modalidad.html');
   assert.equal(url.searchParams.get('model'),model);
   assert.equal(url.searchParams.get(param),selected);
   assert.equal(url.searchParams.get('pci'),'modelo-v2-'+model+'-'+selected);
   assert.equal(url.searchParams.has('school_id'),false);
   assert.equal(url.searchParams.has('token'),false);
 }
 assert.throws(()=>rutaConsultaV2('tecnica','no-existe'),/catálogo V2/);
 assert.throws(()=>rutaConsultaV2('ba15','inexistente'),/catálogo V2/);
});
test('rutas anteriores redirigen al motor V2 sin borrar almacenamientos históricos',async()=>{
 for(const [path,model] of [['modelo-comun.html','comun'],['modelo-tecnica.html','tecnica'],['modelo-ba15.html','ba15']]){
   const source=await read(path);
   assert.match(source,new RegExp("rutaConsultaV2\\('"+model+"'"));
   assert.doesNotMatch(source,/localStorage\\.(setItem|removeItem|clear)/);
   assert.equal(source.includes('app.html?v=modelo-'),false);
 }
 const selector=await read('modelos-v2.html');
 assert.match(selector,/opcionesConsultaV2/);
 assert.match(selector,/rutaConsultaV2/);
 assert.match(selector,/no se guardan en el PCI institucional/);
});
