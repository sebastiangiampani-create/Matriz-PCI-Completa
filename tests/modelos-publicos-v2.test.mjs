import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MODELOS_PUBLICOS_V2,opcionesConsultaV2,rutaConsultaV2} from '../src/modelos-consulta-v2.mjs';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('la portada ofrece Media, Técnica y BA+15 usando la selección curricular V2',async()=>{
 const html=await read('index.html');
 for(const m of MODELOS_PUBLICOS_V2){
   assert.match(html,new RegExp('href="modelos-v2\\.html\\?model='+m.id+'"'));
 }
 assert.doesNotMatch(html,/Matriz Técnica · en blanco|Matriz Común · en blanco/);
 assert.match(html,/Constructor curricular · clave PCI/);
 assert.match(html,/href="panel-escuela.html">Panel institucional · DIR/);
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
   assert.doesNotMatch(source,/location\\.replace\\(`?(?:app\\.html|tecnica\\/app\\.html)/);
 }
 const selector=await read('modelos-v2.html');
 assert.match(selector,/opcionesConsultaV2/);
 assert.match(selector,/rutaConsultaV2/);
 assert.match(selector,/no se guardan en el PCI institucional/);
});
