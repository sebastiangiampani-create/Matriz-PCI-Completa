import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function scripts(path) {
  const source=readFileSync(new URL('../'+path, import.meta.url),'utf8');
  const blocks=[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1].trim()).filter(Boolean);
  assert.ok(blocks.length>0, path+' must contain client JavaScript');
  for(const block of blocks) assert.doesNotThrow(()=>new vm.Script(block,{filename:path}));
  return blocks.join('\n');
}

test('institutional entrance parses and prefers a limited public database catalog',()=>{
  const source=scripts('index.html');
  const endpoint=source.indexOf("action:'public-catalog'");
  const csv=source.indexOf("fetch('schools-catalog.csv");
  assert.ok(endpoint>=0, 'missing public-catalog request');
  assert.ok(csv>endpoint, 'CSV must be a fallback only');
  assert.match(source, /model:s\.model==='tecnica'/);
  assert.match(source, /if\(s\?\.model==='tecnica'\)return true/);
  assert.match(source, /action:'school-login'/);
  assert.match(source, /action:'admin-login'/);
});

test('school administration selector parses and prefers database catalog',()=>{
  const source=scripts('panel-escuela.html');
  const endpoint=source.indexOf("action:'public-catalog'");
  const csv=source.indexOf("fetch('schools-catalog.csv");
  assert.ok(endpoint>=0, 'missing public-catalog request');
  assert.ok(csv>endpoint, 'CSV must be a fallback only');
  assert.match(source, /action:'school-admin-login'/);
  assert.match(source, /action:'get-school-dashboard'/);
});

test('existing CSV catalog remains intact as compatibility fallback',()=>{
  const text=readFileSync(new URL('../schools-catalog.csv',import.meta.url),'utf8').replace(/^\uFEFF/,'');
  assert.match(text.split(/\r?\n/)[0], /^id,name,cue,email,entry_year/);
  // One quoted school name legitimately contains a newline.
  // Count records outside quoted CSV cells, not physical lines.
  let insideQuotes=false,recordCount=0,recordHasText=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='\"'){
      if(insideQuotes&&text[i+1]==='\"')i++;
      else insideQuotes=!insideQuotes;
    }else if((c==='\n'||c==='\r')&&!insideQuotes){
      if(c==='\r'&&text[i+1]==='\n')i++;
      if(recordHasText)recordCount++;
      recordHasText=false;
    }else{
      recordHasText=true;
    }
  }
  if(recordHasText)recordCount++;
  assert.equal(recordCount-1,233);
});
