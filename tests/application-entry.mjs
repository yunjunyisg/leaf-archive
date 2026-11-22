import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../standalone/server.mjs';

test('the web chooser and installed collection clients use separate entry points',async()=>{
 const dataDirectory=await mkdtemp(join(tmpdir(),'leaf-entries-'));
 const origin='https://gloriouscarnivorousplants.top';
 const app=createApp({dataDirectory,origin});
 const get=(path,agent='Mozilla/5.0')=>app.fetch(new Request(origin+path,{headers:{'User-Agent':agent}}));
 try{
  const response=await get('/');
  assert.equal(response.status,200);
  assert.match(response.headers.get('Vary'),/User-Agent/i);
  const home=await response.text();
  assert.match(home,/href="\/collection">打开植藏/);
  assert.match(home,/href="\/plant-id\/">打开识植助手/);
  const browserWebView=await get('/','Mozilla/5.0 (Linux; Android 15; wv)');
  assert.equal(browserWebView.status,200);
  for(const agent of ['Mozilla/5.0 Electron/45.1.0 LeafArchiveClient/1','Mozilla/5.0 (Linux; Android 15; wv) LeafArchiveClient/1']){
   const entry=await get('/',agent);
   assert.equal(entry.status,302);
   assert.equal(entry.headers.get('Location'),'/collection');
  }
  const collection=await (await get('/collection')).text();
  assert.match(collection,/brand-icon">✳/);
  assert.match(collection,/id="welcomePlant"/);
  assert.match(collection,/class="primary-nav"/);
  assert.equal((await get('/ui.css')).status,200);
  assert.equal((await get('/welcome/plant-0.webp')).status,200);
  const manifest=await (await get('/manifest.webmanifest')).json();
  assert.equal(manifest.id,'/');
  assert.equal(manifest.start_url,'/collection');
 }finally{
  app.close();
  await rm(dataDirectory,{recursive:true,force:true});
 }
});
