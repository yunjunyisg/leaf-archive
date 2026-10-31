import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
import native from '../dist/server/index.js';import worker from '../dist/worker/index.js';import {publicFileResponse} from '../standalone/file-response.mjs';import {createApp} from '../standalone/server.mjs';import {setAccount} from '../standalone/local-auth.mjs';
const origin='https://gloriouscarnivorousplants.top';
test('native public files match Worker assets byte for byte and keep binary cache validators',async()=>{
 for(const route of ['/welcome/plant-74.webp','/map-relief.webp','/icons/icon-192.png','/downloads/leaf-archive-shortcuts.zip','/map-boundaries/admin1/AU.json','/map-boundaries/AU-admin2.json']){
  const r=await native.fetch(new Request(origin+route),{}),other=await worker.fetch(new Request(origin+route),{});assert.equal(r.status,200,route);assert.deepEqual(Buffer.from(await r.arrayBuffer()),Buffer.from(await other.arrayBuffer()),route);assert.equal(r.headers.get('Content-Type'),other.headers.get('Content-Type'));assert.equal(r.headers.get('Content-Encoding'),other.headers.get('Content-Encoding'));
 }
 const r=await native.fetch(new Request(origin+'/welcome/plant-74.webp'),{}),etag=r.headers.get('ETag');await r.body.cancel();const cached=await native.fetch(new Request(origin+'/welcome/plant-74.webp',{headers:{'If-None-Match':etag}}),{});assert.equal(cached.status,304);assert.equal(await cached.text(),'');
 const legacy=JSON.parse(await fs.readFile('public/assets.json','utf8')),route=Object.keys(legacy)[0],image=await native.fetch(new Request(origin+route),{});assert.deepEqual(Buffer.from(await image.arrayBuffer()),Buffer.from(legacy[route].slice(legacy[route].indexOf(',')+1),'base64'));
});
test('native service starts without embedding large binary literals in the executable',async()=>{
 const stat=await fs.stat('dist/server/index.js');assert.ok(stat.size<5*1024*1024);
 const script="await import('./standalone/server.mjs');console.log(process.memoryUsage().rss)";
 const r=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const bytes=Number(r.stdout.trim());assert.ok(bytes>0&&bytes<160*1024*1024,'startup RSS budget exceeded: '+bytes);
});
test('public file streaming verifies integrity, supports HEAD and cancellation, and rejects modified content',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'leaf-public-stream-'));try{
  const file=path.join(directory,'public.bin'),bytes=Buffer.alloc(4*1024*1024,73),sha256=createHash('sha256').update(bytes).digest('hex'),options={sha256,mime:'application/octet-stream'};await fs.writeFile(file,bytes);
  const head=await publicFileResponse(new Request(origin+'/public',{method:'HEAD'}),file,options);assert.equal(head.headers.get('Content-Length'),String(bytes.length));assert.equal(await head.text(),'');
  const response=await publicFileResponse(new Request(origin+'/public'),file,options),reader=response.body.getReader(),chunk=await reader.read();assert.ok(chunk.value.byteLength<=65536);await reader.cancel();
  await fs.writeFile(file,'modified');await assert.rejects(publicFileResponse(new Request(origin+'/public'),file,options),/checksum mismatch/);
 }finally{await fs.rm(directory,{recursive:true,force:true})}
});
test('streamed Australian gazetteer still locates Kingston Rest while native accounts remain isolated',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'leaf-native-search-')),app=createApp({dataDirectory:directory,origin});try{
  await setAccount(app.database.sql,{username:'reader',password:'test-only-password',owner:'native-reader'});
  const login=await app.fetch(new Request(origin+'/auth/local',{method:'POST',headers:{Origin:origin},body:new URLSearchParams({username:'reader',password:'test-only-password'})}),'native-test');const cookie=login.headers.getSetCookie()[0].split(';')[0];
  const response=await app.fetch(new Request(origin+'/api/map/geocode?q=Kingston%20Rest&country=AU',{headers:{Cookie:cookie}})),data=await response.json();assert.equal(response.status,200);const result=data.results.find(l=>l.sourceId==='8351675');assert.equal(result.locality,'Kingston Rest');assert.equal(result.lat,-15.98111);assert.equal(result.lon,128.4178);
  assert.equal((await app.fetch(new Request(origin+'/api/plants',{headers:{'oai-authenticated-user-id':'native-reader'}}))).status,401);
 }finally{app.close();await fs.rm(directory,{recursive:true,force:true})}
});
