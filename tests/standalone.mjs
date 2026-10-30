import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createApp,httpServer} from '../standalone/server.mjs';
import {setAccount} from '../standalone/local-auth.mjs';
import {openDatabase,diskBucket} from '../standalone/storage.mjs';
import {importSnapshot} from '../standalone/import.mjs';
const origin='https://gloriouscarnivorousplants.top',password='test-only-password-2026';
const req=(route,{method='GET',cookie,body,headers={}}={})=>new Request(origin+route,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method!=='GET'?{Origin:origin}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
async function signIn(app,username,passwordValue=password){const r=await app.fetch(req('/auth/local',{method:'POST',body:new URLSearchParams({username,password:passwordValue}).toString(),headers:{'Content-Type':'application/x-www-form-urlencoded'}}),'test-address');return {response:r,cookie:r.headers.getSetCookie()[0]?.split(';')[0]}}
test('standalone password sessions persist archives and isolate accounts; forged Sites headers never authenticate',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'leaf-standalone-'));let app=createApp({dataDirectory:dir,origin,env:{TRUST_SITES_IDENTITY:'true'}});
 try{
  for(const username of ['alice','bob'])await setAccount(app.database.sql,{username,password,owner:username});
  assert.equal((await app.fetch(req('/api/plants',{headers:{'oai-authenticated-user-id':'alice'}}))).status,401);
  assert.equal((await app.fetch(req('/api/auth'))).status,200);assert.equal((await (await app.fetch(req('/api/auth'))).json()).passwordLogin,true);
  assert.equal((await signIn(app,'alice','wrong')).response.status,200);
  const a=await signIn(app,'alice'),b=await signIn(app,'bob');assert.equal(a.response.status,303);assert.match(a.response.headers.getSetCookie()[0],/Secure; HttpOnly; SameSite=Lax/);
  assert.equal((await app.fetch(req('/auth/local',{method:'POST',body:'username=alice&password='+password,headers:{Origin:'https://attacker.test'}}))).status,403);
  const saved=await (await app.fetch(req('/api/plants',{method:'POST',cookie:a.cookie,body:{name:'迁移测试',number:'TEST-1',photos:[],logs:[]}}))).json();assert.ok(saved.id);
  assert.deepEqual(await (await app.fetch(req('/api/plants',{cookie:b.cookie}))).json(),[]);
  assert.equal((await app.fetch(req('/api/plants/'+saved.id,{method:'PUT',cookie:b.cookie,body:saved,headers:{'If-Match':'"'+saved._revision+'"'}}))).status,404);
  app.close();app=createApp({dataDirectory:dir,origin});const archive=await (await app.fetch(req('/api/plants',{cookie:a.cookie}))).json();assert.equal(archive[0].name,'迁移测试');
  const first=await app.fetch(req('/api/plants/'+saved.id,{method:'PUT',cookie:a.cookie,body:{...saved,notes:'更新'},headers:{'If-Match':'"'+saved._revision+'"'}}));assert.equal(first.status,200);
  assert.equal((await app.fetch(req('/api/plants/'+saved.id,{method:'PUT',cookie:a.cookie,body:saved,headers:{'If-Match':'"'+saved._revision+'"'}}))).status,409);
  await setAccount(app.database.sql,{username:'alice',password:password+'new',owner:'alice'});assert.equal((await app.fetch(req('/api/plants',{cookie:a.cookie}))).status,401);
  const fresh=await signIn(app,'alice',password+'new');assert.equal((await app.fetch(req('/api/auth/logout',{method:'POST',cookie:fresh.cookie}))).status,200);assert.equal((await app.fetch(req('/api/plants',{cookie:fresh.cookie}))).status,401);
 }finally{app.close();await fs.rm(dir,{recursive:true,force:true})}
});
test('standalone image store preserves ownership, private responses and bytes; login attempts are rate limited',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'leaf-images-')),app=createApp({dataDirectory:dir,origin});
 try{
  for(const username of ['alice','bob'])await setAccount(app.database.sql,{username,password,owner:username});
  const a=await signIn(app,'alice'),b=await signIn(app,'bob');
  const form=new FormData(),bytes=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3]);form.append('file',new File([bytes],'test.png',{type:'image/png'}));
  const uploaded=await (await app.fetch(new Request(origin+'/api/images',{method:'POST',headers:{Cookie:a.cookie,Origin:origin},body:form}))).json();assert.ok(uploaded.url);
  const photo=await app.fetch(req(uploaded.url,{cookie:a.cookie}));assert.equal(photo.headers.get('Cache-Control'),'private, no-store');assert.deepEqual(new Uint8Array(await photo.arrayBuffer()),bytes);
  assert.equal((await app.fetch(req(uploaded.url,{cookie:b.cookie}))).status,404);assert.equal((await app.fetch(req(uploaded.url))).status,401);
  for(let i=0;i<8;i++)await signIn(app,'missing','wrong');assert.equal((await signIn(app,'missing','wrong')).response.status,429);
 }finally{app.close();await fs.rm(dir,{recursive:true,force:true})}
});
test('standalone HTTP proxy preserves cookies, gzip boundaries and origin checks',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'leaf-http-')),app=createApp({dataDirectory:dir,origin}),server=httpServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  await setAccount(app.database.sql,{username:'alice',password,owner:'alice'});
  const login=await fetch(base+'/auth/local',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'alice',password})});assert.equal(login.status,303);assert.equal(login.headers.getSetCookie().length,2);
  const cookie=login.headers.getSetCookie()[0].split(';')[0];assert.equal((await (await fetch(base+'/api/auth',{headers:{Cookie:cookie}})).json()).user.id,'alice');
  const country=await fetch(base+'/map-boundaries/admin1/AU.json');assert.equal((await country.json()).features.length,12);
  const js=await fetch(base+'/app.js');assert.ok((await js.text()).includes('passwordLogin'));
  assert.equal((await fetch(base+'/api/plants',{method:'POST',headers:{Cookie:cookie,Origin:'https://attacker.test'}})).status,403);
  assert.equal((await fetch(base+'/api/plants',{headers:{'oai-authenticated-user-id':'alice'}})).status,401);
 }finally{await new Promise(resolve=>server.close(resolve));app.close();await fs.rm(dir,{recursive:true,force:true})}
});
test('snapshot import preserves original owners and revisions, validates photos and refuses replacement',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'leaf-import-')),dir=path.join(root,'backup'),store=path.join(root,'data');await fs.mkdir(path.join(dir,'objects'),{recursive:true});
 const db=openDatabase(store),bucket=diskBucket(path.join(store,'objects')),sha=x=>createHash('sha256').update(x).digest('hex'),bytes=Buffer.from('fixture-photo'),key='old-owner/image-1';
 const snapshot={sourceProjectId:'appgprj_6ac08e02db408191a652b1bc36ea38cd',tables:{plants:{columns:['id','owner','number','data','created'],rows:[{id:'p1',owner:'old-owner',number:'PL-1',data:JSON.stringify({name:'旧档案',_revision:'original-revision',photos:['/images/image-1']}),created:'2026-01-01'}]},images:{columns:['id','owner','mime'],rows:[{id:'image-1',owner:'old-owner',mime:'image/jpeg'}]},taxa:{columns:['id','owner','path_key','data','created'],rows:[]},wechat_identities:{columns:['identity_hash','owner','union_id'],rows:[]}}};
 await fs.writeFile(path.join(dir,'database.json'),JSON.stringify(snapshot));await fs.writeFile(path.join(dir,'objects.json'),JSON.stringify([{key,sha256:sha(bytes),size:bytes.length}]));
 try{
  await assert.rejects(importSnapshot({sql:db.sql,bucket,directory:dir}));assert.equal(db.sql.prepare('SELECT count(*) AS n FROM plants').get().n,0);
  await fs.writeFile(path.join(dir,'objects',sha(key)),bytes);const report=await importSnapshot({sql:db.sql,bucket,directory:dir});assert.equal(report.images,1);
  const p=db.sql.prepare('SELECT owner,data FROM plants').get();assert.equal(p.owner,'old-owner');assert.equal(JSON.parse(p.data)._revision,'original-revision');assert.deepEqual((await bucket.get(key)).body,bytes);
  await assert.rejects(importSnapshot({sql:db.sql,bucket,directory:dir}),/拒绝覆盖/);
 }finally{db.close();await fs.rm(root,{recursive:true,force:true})}
});
