import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../../preview-multipci.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const KEY='pci-multipci-ui-preview-ficticio-v1';

function fakeElement(tag='div'){
  return {
    tagName:tag,children:[],value:'',hidden:false,textContent:'',className:'',
    append(...elements){this.children.push(...elements);},
    appendChild(element){this.children.push(element);return element;},
    replaceChildren(...elements){this.children=[...elements];},
    scrollIntoView(){},click(){},reset(){},setAttribute(){},
    data:{}
  };
}
function openPreview(){
  const elements=new Map(),storage=new Map();
  const document={
    getElementById(id){if(!elements.has(id))elements.set(id,fakeElement());return elements.get(id);},
    createElement(tag){return fakeElement(tag);}
  };
  class MockFormData{constructor(form){this.data=form.data;}get(k){return this.data[k];}}
  const sessionStorage={
    getItem(k){return storage.has(k)?storage.get(k):null;},
    setItem(k,v){storage.set(k,String(v));}
  };
  vm.runInNewContext(script,{
    document,sessionStorage,FormData:MockFormData,
    crypto:{randomUUID:()=>'test-uuid-'+String(storage.size)},
    setTimeout,Date,Math,JSON,console
  },{filename:'preview-multipci.html'});
  return {
    element:id=>document.getElementById(id),
    state:()=>JSON.parse(sessionStorage.getItem(KEY)),
    submit:(name,data)=>{
      const form=document.getElementById(name);
      form.data=data;
      form.onsubmit({preventDefault(){},currentTarget:form});
    }
  };
}

test('vista aislada sin llamadas HTTP ni escrituras a Supabase',()=>{
  assert.ok(script,'El HTML debe tener un script embebido');
  assert.doesNotThrow(()=>new vm.Script(script));
  assert.doesNotMatch(script,/\bfetch\s*\(/);
  assert.doesNotMatch(script,/\bXMLHttpRequest\b/);
  assert.doesNotMatch(script,/\bindexedDB\b/);
  assert.match(html,/datos ficticios/i);
  assert.match(html,/no se conecta a Supabase/i);
});

test('cada orientación y turno tiene un PCI separado con FG copiada',()=>{
  const ui=openPreview();
  const legacy=ui.state()?.schools?.[0]?.legacy || {
    schoolName:'Escuela Modelo A (ficticia)',schemaVersion:10,areas:{
      'Ciencias Sociales':{groups:[{id:'social-demo',items:['simulado-1']}]}}
  };
  ui.submit('pciCreate',{orientation:'economia_administracion',title:'Economía · Segundo PCI'});
  const one=ui.state(),two=one.pcis.filter(p=>p.schoolId==='demo-01');
  assert.equal(two.length,2);
  assert.notEqual(two[0].id,two[1].id);
  assert.equal(two[0].orientationId,two[1].orientationId);
  assert.equal(JSON.stringify(two[1].sourceLegacy),JSON.stringify(legacy));
  assert.equal(two[0].synopsis,'Ejemplo para explorar la interfaz');
  ui.element('synopsis').value='Nueva secuencia de prueba';
  ui.element('saveDetailBtn').onclick();
  const updated=ui.state();
  assert.equal(updated.pcis[1].revision,2);
  assert.equal(updated.pcis[0].revision,1);
  assert.equal(updated.pcis[0].synopsis,'Ejemplo para explorar la interfaz');
  assert.equal(JSON.stringify(updated.schools[0].legacy),JSON.stringify(legacy));
});

test('crear una escuela agrega un registro sin sobrescribir otras escuelas',()=>{
  const ui=openPreview();
  ui.submit('schoolCreate',{name:'Escuela Agregada',cue:'TEST-003',email:'escuela@ejemplo.test',year:'2027'});
  let d=ui.state();
  assert.equal(d.schools.length,3);
  assert.equal(d.schools[0].cue,'TEST-001');
  assert.equal(d.schools[1].cue,'TEST-002');
  assert.equal(d.schools[2].cue,'TEST-003');
  ui.submit('pciCreate',{orientation:'ciencias_naturales',title:'PCI Ciencias Naturales'});
  d=ui.state();
  const nuevo=d.pcis.find(p=>p.title==='PCI Ciencias Naturales');
  assert.ok(nuevo);
  assert.equal(nuevo.schoolId,d.schools[2].id);
  assert.deepEqual(Object.keys(nuevo.sourceLegacy.areas),[]);
  assert.equal(d.pcis.filter(p=>p.schoolId==='demo-01').length,1);
});
