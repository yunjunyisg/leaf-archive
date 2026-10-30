import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {createApp} from '../standalone/server.mjs';import {setAccount} from '../standalone/local-auth.mjs';import {provisionAdmin} from '../standalone/admin-account.mjs';import {cleanupDeletedObjects,eraseAccount} from '../standalone/account-deletion.mjs';
const origin='https://gloriouscarnivorousplants.top',password='test-delete-password';
const cookie=r=>r.headers.getSetCookie()[0]?.split(';')[0];
function call(app,url,session,options={}){return app.fetch(new Request(origin+url,{...options,headers:{...(session?{Cookie:session}:{}),...(options.method?{Origin:origin}:{}),...options.headers}}))}
const login=(app,username)=>call(app,'/auth/local',null,{method:'POST',body:new URLSearchParams({username,password})});
async function fixture(){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'leaf-delete-')),app=createApp({dataDirectory:directory,origin});return {directory,app,async close(){app.close();await fs.rm(directory,{recursive:true,force:true})}}}
async function seed(app,owner){
 await setAccount(app.database.sql,{username:owner,password,owner});const image=randomUUID(),extra=randomUUID(),plant=randomUUID();
 app.database.sql.prepare('INSERT INTO plants VALUES (?,?,?,?,?)').run(plant,owner,'PL-1',JSON.stringify({name:'测试植物',photos:['/images/'+image],originLocation:{lat:0,lon:0,countryCode:'AU',precision:'point'}}),'2026-01-01');
 app.database.sql.prepare('INSERT INTO taxa VALUES (?,?,?,?,?)').run(owner+'-taxon',owner,'key',JSON.stringify({path:[]}),'2026-01-01');
 app.database.sql.prepare('INSERT INTO images VALUES (?,?,?)').run(image,owner,'image/png');
 await app.BUCKET.put(owner+'/'+image,new Uint8Array([137,80,78,71]));await app.BUCKET.put(owner+'/'+extra,new Uint8Array([9]));
 return {image,extra,plant};
}
test('self-deletion verifies password and explicit confirmation, erases own records and photos without affecting another user',async()=>{
 const f=await fixture(),{app}=f;try{
  const mine=await seed(app,'visitor'),theirs=await seed(app,'another');const user=cookie(await login(app,'visitor')),other=cookie(await login(app,'another'));
  assert.match(await (await call(app,'/',user)).text(),/href="\/account\/delete"/);
  assert.equal((await call(app,'/account/delete')).status,303);assert.equal((await call(app,'/account/delete',user)).status,200);
  const submit=(input={},headers={})=>call(app,'/account/delete',user,{method:'POST',headers,body:new URLSearchParams({username:'visitor',password,confirmation:'确认注销',owner:'another',...input})});
  assert.equal((await submit({}, {Origin:'null'})).status,403);assert.equal((await submit({password:'wrong'})).status,400);assert.equal((await submit({username:'another'})).status,400);assert.equal((await submit({confirmation:''})).status,400);
  assert.equal((await call(app,'/api/plants',user)).status,200);
  const result=await submit();assert.equal(result.status,303);assert.equal(result.headers.get('Location'),'/auth/local');assert.match(result.headers.get('Set-Cookie'),/Max-Age=0/);
  for(const table of ['plants','taxa','images','auth_sessions','account_activity','activity_days','local_accounts'])assert.equal(app.database.sql.prepare(`SELECT count(*) AS n FROM ${table} WHERE owner=?`).get('visitor').n,0,table);
  assert.equal(await app.BUCKET.get('visitor/'+mine.image),null);assert.equal(await app.BUCKET.get('visitor/'+mine.extra),null);
  assert.ok(await app.BUCKET.get('another/'+theirs.image));assert.equal((await (await call(app,'/api/plants',other)).json()).length,1);assert.equal((await call(app,'/api/plants',user)).status,401);
  assert.equal(cookie(await login(app,'visitor')),undefined);assert.equal(app.database.sql.prepare('SELECT action FROM admin_audit').get().action,'self-delete');
 }finally{await f.close()}
});
test('administrator deletion requires new explicit confirmation and removes the user from lists and aggregate map',async()=>{
 const f=await fixture(),{app}=f;try{
  await seed(app,'visitor');await provisionAdmin(app.database.sql,{username:'operator',password});const admin=cookie(await login(app,'operator'));
  assert.equal((await call(app,'/account/delete',admin)).status,403);
  const submit=confirmation=>call(app,'/api/admin/users/deactivate',admin,{method:'POST',body:JSON.stringify({owner:'visitor',username:'visitor',confirmation})});
  assert.equal((await submit(undefined)).status,400);assert.equal((await submit('确认注销')).status,200);
  assert.equal((await (await call(app,'/api/admin/map-plants',admin)).json()).plants.length,0);
  assert.equal((await (await call(app,'/api/admin/users',admin)).json()).total,1);
  const stats=await (await call(app,'/api/admin/stats',admin)).json();assert.equal(stats.plants,0);assert.equal(stats.images,0);assert.equal(stats.taxa,0);
 }finally{await f.close()}
});
test('failed photo cleanup is durable and can complete after a restart without restoring deleted records',async()=>{
 const f=await fixture();let app=f.app;try{
  const saved=await seed(app,'visitor');await provisionAdmin(app.database.sql,{username:'operator',password});const admin=cookie(await login(app,'operator'));
  app.BUCKET.delete=async()=>{throw Error('simulated disk error')};
  const result=await call(app,'/api/admin/users/deactivate',admin,{method:'POST',body:JSON.stringify({owner:'visitor',username:'visitor',confirmation:'确认注销'})});assert.equal(result.status,200);assert.ok((await result.json()).pendingPhotoCleanup>0);
  app.close();app=createApp({dataDirectory:f.directory,origin});assert.equal(app.database.sql.prepare('SELECT count(*) AS n FROM plants').get().n,0);assert.ok(await app.BUCKET.get('visitor/'+saved.image));
  assert.equal(await cleanupDeletedObjects(app.database.sql,app.BUCKET),0);assert.equal(await app.BUCKET.get('visitor/'+saved.image),null);assert.equal(await app.BUCKET.get('visitor/'+saved.extra),null);
 }finally{app.close();await fs.rm(f.directory,{recursive:true,force:true})}
});
test('deletion blocks stale writes and cleans an upload already in progress',async()=>{
 const f=await fixture(),{app}=f;try{
  await seed(app,'visitor');const id=randomUUID(),key='visitor/'+id,pending=app.BUCKET.put(key,new Uint8Array(1024)).then(()=>null,e=>e.message);
  assert.equal(app.BUCKET.isWriting(key),true);
  app.database.sql.exec('BEGIN');eraseAccount(app.database.sql,{owner:'visitor',actor:'visitor',action:'self-delete'});app.database.sql.exec('COMMIT');
  await cleanupDeletedObjects(app.database.sql,app.BUCKET);assert.equal(await pending,'account deleted');assert.equal(await cleanupDeletedObjects(app.database.sql,app.BUCKET),0);assert.equal(await app.BUCKET.get(key),null);
  assert.throws(()=>app.database.sql.prepare('INSERT INTO images VALUES (?,?,?)').run(id,'visitor','image/png'),/account deleted/);
  await assert.rejects(app.BUCKET.put(key,new Uint8Array([1])),/account deleted/);
  await assert.rejects(setAccount(app.database.sql,{username:'reclaim',owner:'visitor',password}),/account deleted/);
 }finally{await f.close()}
});
