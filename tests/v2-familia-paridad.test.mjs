import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {construir,secuenciaV2,PERFILES} from '../scripts/derivar-v2-familia.mjs';

const leer=ruta=>readFile(new URL('../'+ruta,import.meta.url),'utf8');
const manifiesto=JSON.parse(await leer('src/v2-familia/manifiesto-paridad-v2.json'));
const sha=t=>createHash('sha256').update(t).digest('hex').slice(0,16);

test('el manifiesto recorre los 45 módulos de V2 en el mismo orden que app.html', async()=>{
  const secuencia=await secuenciaV2();
  assert.equal(secuencia.length,45);
  assert.deepEqual(manifiesto.modulos.map(m=>m.modulo),secuencia);
});

test('los derivados y el manifiesto están al día con el generador', async()=>{
  const archivos=await construir();
  for(const [ruta,contenido] of archivos){
    assert.equal(await leer(ruta),contenido,`${ruta} no coincide con el generador: ejecutar node scripts/derivar-v2-familia.mjs`);
  }
});

test('la copia del V2 original no fue modificada desde la generación', async()=>{
  for(const m of manifiesto.modulos){
    assert.equal(sha(await leer(m.original)),m.sha256Original,`${m.original} cambió respecto del V2 de referencia`);
  }
  assert.match(await leer('vendor/pci-sec-aprende-v2/SOURCE_SNAPSHOT.txt'),/883707e281894990b537032880922f4c078689ad/);
});

test('cada módulo tiene un estado y las reglas de Media no se cargan en otras modalidades', ()=>{
  const estados=new Set(['original','derivado','derivado-previo','pendiente-normativa']);
  for(const m of manifiesto.modulos){
    assert.ok(estados.has(m.estado),m.modulo);
    if(m.estado==='pendiente-normativa'){
      assert.equal(m.archivos,undefined,`${m.modulo} no debe cargarse sin normativa de la modalidad`);
      assert.ok(m.motivo);
      assert.ok(m.equivalentes?.tecnica&&m.equivalentes?.ba15,`${m.modulo}: falta indicar cómo se resuelve en cada modalidad`);
    }else{
      for(const perfil of Object.keys(PERFILES))assert.ok(m.archivos?.[perfil],`${m.modulo} sin archivo para ${perfil}`);
    }
    if(m.estado==='original'){
      for(const perfil of Object.keys(PERFILES))assert.equal(m.archivos[perfil],m.original);
    }
  }
});

test('los derivados solo cambian niveles, cuatrimestres, áreas o reglas de Media declaradas', async()=>{
  for(const m of manifiesto.modulos.filter(x=>x.estado==='derivado')){
    for(const [perfil,cambios] of Object.entries(m.cambios)){
      assert.ok(cambios.length>0,m.modulo);
      for(const c of cambios)assert.ok(c.motivo&&c.veces>0,`${m.modulo}/${perfil}: cambio sin motivo`);
      const texto=await leer(m.archivos[perfil]);
      assert.match(texto,/DERIVADO AUTOMÁTICO/);
    }
  }
  const t=await leer('src/v2-familia/derivados/tecnica/v93-curricular-coverage-dashboard.js');
  const b=await leer('src/v2-familia/derivados/ba15/v93-curricular-coverage-dashboard.js');
  assert.ok(t.includes('[1,2,3,4,5,6]')&&!t.includes('[1,2,3,4,5]'));
  assert.ok(b.includes('[1,2,3,4]')&&!b.includes('[1,2,3,4,5]'));
  const p=await leer('src/v2-familia/derivados/tecnica/v59-phase2-annual-matrix.js');
  assert.ok(p.includes(`cells.length!==${PERFILES.tecnica.cuatrimestres}`));
});
