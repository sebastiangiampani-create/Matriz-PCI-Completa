import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const demos=['demo-integracion-curricular.html','demo-mapa-oferta-curricular.html'];
for(const path of demos){
  test('la vista '+path+' compila sin APIs remotas de escuelas',()=>{
    const html=readFileSync(path,'utf8');
    const scripts=[...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length,1);
    const js=scripts[0][1];
    const check=spawnSync(process.execPath,['--input-type=module','--check'],
      {input:js,encoding:'utf8'});
    assert.equal(check.status,0,check.stderr||'JavaScript del simulador inválido.');
    assert.ok(!html.includes('functions/v1/'));
    assert.ok(!html.includes('supabase.co/'));
    assert.ok(!html.includes('service_role'));
    assert.ok(!html.includes('localStorage.setItem'));
    assert.ok(!html.includes('sessionStorage.setItem'));
  });
}
test('la nueva vista importa composición, banco Matriz y cobertura sin tocar la app original',()=>{
  const html=readFileSync('demo-mapa-oferta-curricular.html','utf8');
  assert.ok(html.includes('loadMatrixContents'));
  assert.ok(html.includes('seedOfferStructure'));
  assert.ok(html.includes('assignFoSubject'));
  assert.ok(html.includes('appendFgContent'));
  assert.ok(html.includes('foTrajectoryCoverage'));
  assert.ok(html.includes('curriculumTracking'));
  assert.ok(html.includes('moveFoSpace'));
  assert.ok(html.includes('dragstart'));
  assert.ok(html.includes('Revisar laboratorio'));
});
