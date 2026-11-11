import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../preview-v2-real/src/institucion-pci-demo.js',import.meta.url),'utf8');
const html=await readFile(new URL('../preview-v2-real/institucion.html',import.meta.url),'utf8');
const DB='pci-v2-escuelas-alta-demo-20261111-v1';
const PREFIX='pci-v2-institucional-demo-20261111-v1';

function page(initialUrl,storage=new Map()){
  const elements=new Map();
  const el=(tag='div')=>({
    tagName:tag,children:[],hidden:false,value:'',checked:false,style:{},textContent:'',
    append(...children){this.children.push(...children)},
    appendChild(child){this.children.push(child);return child},
    replaceChildren(...children){this.children=[...children]},
    setAttribute(){},focus(){},reset(){},scrollIntoView(){}
  });
  const doc={
    getElementById(id){if(!elements.has(id))elements.set(id,el());return elements.get(id);},
    createElement:el
  };
  const url=new URL(initialUrl);
  let assigned=null;
  const loc={href:url.href,search:url.search,
    assign(value){assigned=value},reload(){assigned='RELOAD'}
  };
  let number=0;
  const window={scrollTo(){}};
  const localStorage={
    getItem(k){return storage.has(k)?storage.get(k):null},
    setItem(k,v){storage.set(k,String(v))},
    removeItem(k){storage.delete(k)}
  };
  const ctx={document:doc,window,localStorage,URL,URLSearchParams,location:loc,
    crypto:{randomUUID(){return '10000000-0000-4000-8000-'+String(++number).padStart(12,'0')}},
    JSON,Number,String,Array,Math,Date,Set,console,confirm:()=>true,alert:()=>{}};
  vm.runInNewContext(source,ctx);
  return {get:id=>doc.getElementById(id),state:()=>window.__PCIDEMO__.getState(),
    storage,assigned:()=>assigned};
}

test('la vista reproduce la pantalla administrativa y el formulario de alta',()=>{
  assert.match(html,/id="openAdmin"/);
  assert.match(html,/id="schoolAdmin"/);
  assert.match(html,/id="newSchoolForm"/);
  assert.match(html,/id="adminSchoolName"/);
  assert.match(html,/id="adminSchoolCue"/);
  assert.match(html,/id="adminSchoolEmail"/);
  assert.match(html,/id="adminSchoolYear"/);
  const p=page('https://example.test/preview-v2-real/institucion.html?panel=alta');
  assert.equal(p.get('schoolAdmin').hidden,false);
  assert.equal(p.get('institutionSetup').hidden,true);
  assert.equal(p.get('newSchoolForm').hidden,false);
});

test('el formulario de prueba guarda una escuela nueva sin alterar el PCI previo',()=>{
  const p=page('https://example.test/preview-v2-real/institucion.html?panel=alta');
  const original=p.storage.get(PREFIX);
  p.get('adminSchoolName').value='Colegio Ficticio Río';
  p.get('adminSchoolCue').value='DEMO-042';
  p.get('adminSchoolEmail').value='escuela@ejemplo.test';
  p.get('adminSchoolYear').value='2026';
  p.get('newSchoolForm').onsubmit({preventDefault(){}});
  const schools=JSON.parse(p.storage.get(DB));
  assert.equal(schools.length,2);
  assert.equal(schools[1].cue,'DEMO-042');
  assert.equal(schools[1].name,'Colegio Ficticio Río');
  assert.equal(p.storage.get(PREFIX),original,'El PCI original se modificó al dar de alta otra escuela');
  assert.match(p.get('adminFeedback').textContent,/Ningún registro real fue modificado/);
  const row=p.get('demoSchools').children.at(-1);
  const open=row.children.at(-1);
  open.onclick();
  const target=new URL(p.assigned());
  assert.equal(target.searchParams.get('escuelaDemo'),schools[1].id);
  assert.equal(target.searchParams.has('panel'),false);
  const next=page(p.assigned(),p.storage);
  assert.equal(next.state().school,'Colegio Ficticio Río');
  assert.ok(p.storage.has(PREFIX+':school:'+schools[1].id));
  assert.ok(p.storage.has(PREFIX),'Se perdió la configuración anterior');
});

test('rechaza códigos duplicados y muestra la escuela original',()=>{
  const p=page('https://example.test/preview-v2-real/institucion.html?panel=alta');
  p.get('adminSchoolName').value='Instituto repetido';
  p.get('adminSchoolCue').value='demo-001';
  p.get('adminSchoolYear').value='2027';
  p.get('newSchoolForm').onsubmit({preventDefault(){}});
  assert.equal(JSON.parse(p.storage.get(DB)).length,1);
  assert.match(p.get('adminFeedback').textContent,/Ese código ya figura/);
});

test('el simulador no dispone de red, claves ni operaciones reales en Supabase',()=>{
  assert.doesNotMatch(source,/\bfetch\s*\(/);
  assert.doesNotMatch(source,/supabase\.co/);
  assert.doesNotMatch(source,/service_role|api_key|secret_key/i);
  assert.match(source,/localStorage\.setItem\(ADMIN_KEY/);
});
