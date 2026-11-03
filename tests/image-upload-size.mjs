import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import {createApp,httpServer} from '../standalone/server.mjs';import {setAccount} from '../standalone/local-auth.mjs';
const origin='https://gloriouscarnivorousplants.top',mb=1024*1024;
const hash=b=>createHash('sha256').update(b).digest('hex');
function form(size){const bytes=Buffer.alloc(size,42);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);const body=new FormData();body.append('file',new Blob([bytes],{type:'image/png'}),'large.png');return {body,bytes}}
test('20 MiB image passes real HTTP multipart transport unchanged; larger images and other owners are refused',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'leaf-large-image-')),app=createApp({dataDirectory:dir,origin}),server=httpServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  const sessions={};for(const name of ['image-owner','image-other']){await setAccount(app.database.sql,{username:name,password:'upload-test-pass',owner:name});const r=await app.fetch(new Request(origin+'/auth/local',{method:'POST',headers:{Origin:origin},body:new URLSearchParams({username:name,password:'upload-test-pass'})}));sessions[name]=r.headers.getSetCookie()[0].split(';')[0]}
  const {body,bytes}=form(20*mb);const response=await fetch(base+'/api/images',{method:'POST',headers:{Origin:origin,Cookie:sessions['image-owner']},body});assert.equal(response.status,200);const {url}=await response.json();assert.ok(url);
  const image=await fetch(base+url,{headers:{Cookie:sessions['image-owner']}});assert.equal(image.status,200);assert.match(image.headers.get('Cache-Control'),/private, no-store/);const stored=Buffer.from(await image.arrayBuffer());assert.equal(stored.length,bytes.length);assert.equal(hash(stored),hash(bytes));
  const rows=()=>app.database.sql.prepare('SELECT count(*) AS n FROM images').get().n;assert.equal(rows(),1);
  const tooLarge=await fetch(base+'/api/images',{method:'POST',headers:{Origin:origin,Cookie:sessions['image-owner']},body:form(20*mb+1).body});assert.equal(tooLarge.status,400);assert.match((await tooLarge.json()).error,/20 MB/);assert.equal(rows(),1);
  assert.equal((await fetch(base+url,{headers:{Cookie:sessions['image-other']}})).status,404);assert.equal((await fetch(base+url)).status,401);
 }finally{await new Promise(r=>server.close(r));app.close();await fs.rm(dir,{recursive:true,force:true})}
});
test('only image multipart endpoint receives a larger transport envelope; oversized requests stop before application work',async()=>{
 let calls=0;const server=httpServer({origin,async fetch(){calls++;return new Response('ok')}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal((await fetch(base+'/api/images',{method:'POST',body:Buffer.alloc(21*mb)})).status,200);assert.equal(calls,1);
  assert.equal((await fetch(base+'/api/plants',{method:'POST',body:Buffer.alloc(10*mb+1)})).status,413);assert.equal(calls,1);
  assert.equal((await fetch(base+'/api/images',{method:'POST',body:Buffer.alloc(22*mb+1)})).status,413);assert.equal(calls,1);
 }finally{await new Promise(r=>server.close(r))}
});
