import test from 'node:test';import assert from 'node:assert/strict';
import native from '../dist/server/index.js';import worker from '../dist/worker/index.js';
const extract=html=>html.match(/<dialog id="editor"[\s\S]*?<\/dialog>/)?.[0];
test('collection, classification and origins serve the same complete plant editor in both builds',async()=>{
 for(const build of [native,worker]){
  let canonical;
  for(const path of ['/','/classification','/origins']){
   const response=await build.fetch(new Request('https://example.test'+path),{});assert.equal(response.status,200);const editor=extract(await response.text());assert.ok(editor,path);
   assert.match(editor,/id="speciesLabel"/);assert.match(editor,/<option value="hybrid">/);assert.match(editor,/id="savePlant"/);assert.match(editor,/id="chooseOriginLocation"/);
   if(!canonical)canonical=editor;else assert.equal(editor,canonical,path+' must not omit fields required by the shared editor script');
  }
 }
});
