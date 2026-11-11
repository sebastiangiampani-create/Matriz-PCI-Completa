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

test('una escuela puede tener orientaciones Media y especialidades Técnicas independientes',()=>{
  const p=page('https://example.test/preview-v2-real/institucion.html');
  const before=p.storage.get(PREFIX);
  const mediaId=p.state().pcis[0].id;
  p.get('technicalSpecialty').value='Programación';
  p.get('technicalShift').value='Tarde';
  p.get('technicalQuantity').value='2';
  p.get('technicalForm').onsubmit({preventDefault(){}});
  const data=p.state();
  assert.equal(data.technicalTracks.length,1);
  assert.equal(data.pcis.length,3);
  assert.equal(data.pcis[0].id,mediaId);
  assert.equal(data.pcis[0].model,undefined,'El PCI de Media histórico debe conservar su formato');
  const technical=data.pcis.filter(x=>x.model==='tecnica');
  assert.equal(technical.length,2);
  assert.ok(technical.every(x=>x.specialtyName==='Programación'&&x.shift==='Tarde'));
  assert.ok(technical.every(x=>x.curriculumStatus==='pending_rules'));
  assert.notEqual(technical[0].id,technical[1].id);
  assert.notEqual(p.storage.get(PREFIX),before,'La ampliación debe guardar la ficha técnica propia');
  assert.equal(p.get('pciList').children.filter(x=>x.tagName==='article').length,3);
});
test('reducir cantidad de PCI Técnicos conserva proyectos anteriores',()=>{
  const p=page('https://example.test/preview-v2-real/institucion.html');
  p.get('technicalSpecialty').value='Construcciones';
  p.get('technicalShift').value='Noche';
  p.get('technicalQuantity').value='3';
  p.get('technicalForm').onsubmit({preventDefault(){}});
  const old=p.state().pcis.filter(x=>x.model==='tecnica').map(x=>x.id);
  p.get('technicalSpecialty').value='Construcciones';
  p.get('technicalShift').value='Noche';
  p.get('technicalQuantity').value='1';
  p.get('technicalForm').onsubmit({preventDefault(){}});
  assert.equal(p.state().pcis.length,4);
  assert.deepEqual(p.state().pcis.filter(x=>x.model==='tecnica').map(x=>x.id),old);
  assert.match(p.get('totalPcis').textContent,/2 conservados/);
});
test('un PCI Técnico muestra ficha pendiente y nunca abre el editor C1-C10 de Media',()=>{
  const p=page('https://example.test/preview-v2-real/institucion.html');
  p.get('technicalSpecialty').value='Electromecánica';
  p.get('technicalShift').value='Vespertino';
  p.get('technicalQuantity').value='1';
  p.get('technicalForm').onsubmit({preventDefault(){}});
  const card=p.get('pciList').children.find(x=>x.children?.some(c=>c.textContent?.includes('Electromecánica')));
  assert.ok(card,'La ficha Técnica debe aparecer junto a los PCI de Media');
  card.children.at(-1).onclick();
  assert.equal(p.get('workspaceScreen').hidden,false);
  assert.equal(p.get('technicalPendingDemo').hidden,false);
  assert.equal(p.get('frame').hidden,true);
  assert.equal(p.get('frame').src,'about:blank');
  assert.match(p.get('technicalPendingName').textContent,/Electromecánica/);
});
