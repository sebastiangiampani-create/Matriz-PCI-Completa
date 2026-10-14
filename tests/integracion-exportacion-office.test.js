import test from 'node:test';
import assert from 'node:assert/strict';
import {exportReviewXlsx,exportReviewDocx} from '../src/integracion-curricular/exportacion-revision-office.js';
import {prepareReview} from '../src/integracion-curricular/revision-importacion-original.js';
const data={
 schoolName:'Escuela López & Gómez',schemaVersion:10,infoDesconocido:{creado:'inicial'},
 areas:{
  'Ciencias Sociales':{groups:[{
    id:'social-1',name:'Laboratorio Historia',kind:'laboratory',level:3,startTerm:5,endTerm:5,
    objective:'Interrogar fuentes',synopsis:'Texto <prueba> & revisión',
    items:['historia-1', '=HYPERLINK("http://suspicious","FALSO")'],
    plansBimestrales:[{
      number:1,name:'Primer bimestre',objectives:'Comprender la época',
      synopsis:'Producto final',contentIds:['historia-1'],
      stages:{
        punto_partida:{description:'Problema inicial',duration:'60',resources:['imágenes']},
        indagacion:{description:'Investigación'},
        produccion:{description:'Relato histórico'},
        evaluacion:{description:'Rúbrica final',evidence:'Texto'}
      },
      otherPlanAttribute:{custom:true}
    }],
    unusedNewField:{mustKeep:true}
  }]}
 }
};
function readZipEntries(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let offset=0;const result=new Map();const decoder=new TextDecoder();
  while(offset+4<bytes.byteLength&&view.getUint32(offset,true)===0x04034b50){
    const length=view.getUint32(offset+18,true),namelen=view.getUint16(offset+26,true),
      extra=view.getUint16(offset+28,true);
    const name=decoder.decode(bytes.slice(offset+30,offset+30+namelen));
    const start=offset+30+namelen+extra;
    result.set(name,decoder.decode(bytes.slice(start,start+length)));
    offset=start+length;
  }
  assert.ok(view.getUint32(offset,true)===0x02014b50,'Debe existir directorio central válido');
  return result;
}
test('Excel verdadero contiene inventario, planes, contenidos, secuencias y campos completos',async()=>{
 const source=structuredClone(data);
 const review=prepareReview(source,'Economía y Administración',{socialOption:'A'});
 const before=JSON.stringify(source);
 const file=await exportReviewXlsx(review);
 assert.match(file.type,/spreadsheetml.sheet/);
 const bytes=new Uint8Array(await file.arrayBuffer());
 assert.equal(new TextDecoder().decode(bytes.slice(0,2)),'PK');
 const entries=readZipEntries(bytes);
 assert.ok(entries.has('xl/workbook.xml'));
 assert.ok(entries.has('xl/styles.xml'));
 assert.ok(entries.has('xl/worksheets/sheet7.xml'));
 const names=entries.get('xl/workbook.xml');
 for(const title of ['Resumen','Agrupamientos','Contenidos','Planes','Secuencias','Observaciones','Datos completos'])
   assert.ok(names.includes(title),title);
 assert.match(entries.get('xl/worksheets/sheet5.xml'),/Rúbrica final/);
 assert.match(entries.get('xl/worksheets/sheet2.xml'),/Interrogar fuentes/);
 assert.match(entries.get('xl/worksheets/sheet7.xml'),/mustKeep/);
 assert.match(entries.get('xl/worksheets/sheet2.xml'),/&lt;prueba&gt; &amp; revisión/);
 assert.ok(!entries.get('xl/worksheets/sheet3.xml').includes('<f>'), 'Nunca insertar fórmulas evaluables');
 assert.equal(JSON.stringify(source),before);
});
test('Word verdadero incluye cuatro etapas y anexo íntegro sin tocar la fuente',async()=>{
 const review=prepareReview(data,'Matemática y Física',{socialOption:'B'});
 const before=JSON.stringify(data);
 const file=await exportReviewDocx(review);
 assert.match(file.type,/wordprocessingml.document/);
 const entries=readZipEntries(new Uint8Array(await file.arrayBuffer()));
 assert.ok(entries.has('word/document.xml'));
 assert.ok(entries.has('word/styles.xml'));
 const text=entries.get('word/document.xml');
 assert.match(text,/Problema inicial/);
 assert.match(text,/Investigación/);
 assert.match(text,/Relato histórico/);
 assert.match(text,/Rúbrica final/);
 assert.match(text,/infoDesconocido/);
 assert.match(text,/López &amp; Gómez/);
 assert.equal(JSON.stringify(data),before);
});
test('No exporta antes de preparar la copia de revisión',async()=>{
 await assert.rejects(()=>exportReviewXlsx(null),/Primero prepará/);
 await assert.rejects(()=>exportReviewDocx({}),/Primero prepará/);
});
