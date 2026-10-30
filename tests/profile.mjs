import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {createApp} from '../standalone/server.mjs';import {setAccount} from '../standalone/local-auth.mjs';import {provisionAdmin} from '../standalone/admin-account.mjs';
const origin='https://gloriouscarnivorousplants.top',password='profile-test-password',png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB9kAAAAASUVORK5CYII=','base64');
function call(app,url,session,options={}){return app.fetch(new Request(origin+url,{...options,headers:{...(session?{Cookie:session}:{}),...(options.method?{Origin:origin}:{}),...options.headers}}))}
const cookie=r=>r.headers.getSetCookie()[0]?.split(';')[0];
async function sign(app,name){return cookie(await call(app,'/auth/local',null,{method:'POST',body:new URLSearchParams({username:name,password})}))}
async function fixture(){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'leaf-profile-')),app=createApp({dataDirectory:directory,origin});return {directory,app,async close(){app.close();await fs.rm(directory,{recursive:true,force:true})}}}
async function seed(app){for(const username of ['visitor','another'])await setAccount(app.database.sql,{username,password,owner:username});return {user:await sign(app,'visitor'),other:await sign(app,'another')}}
test('profile summary is owner-scoped and totals monetary values without including other users',async()=>{
 const f=await fixture(),{app}=f;try{
  const {user}=await seed(app),insert=app.database.sql.prepare('INSERT INTO plants VALUES (?,?,?,?,?)');
  for(const [id,owner,price,family,genus] of [['a','visitor',.1,'茅膏菜科','茅膏菜属'],['b','visitor',.2,'茅膏菜科','捕蝇草属'],['c','another',999,'兰科','兰属'],['d','visitor','','','']])insert.run(id,owner,id,JSON.stringify({price,family,genus}),'2026-01-01');
  const response=await call(app,'/api/profile?owner=another',user),data=await response.json();assert.match(response.headers.get('Cache-Control'),/private, no-store/);assert.equal(data.username,'visitor');assert.equal(data.summary.purchaseTotal,'0.30');assert.equal(data.summary.plantCount,3);assert.equal(data.summary.familyCount,1);assert.equal(data.summary.genusCount,2);assert.equal(data.summary.unpriced,1);assert.ok(!JSON.stringify(data).includes('兰科'));
  assert.equal((await call(app,'/account')).headers.get('Location'),'/auth/local');assert.equal((await call(app,'/api/profile')).status,401);
 }finally{await f.close()}
});
test('display name updates all own sessions without changing login ID, role or another account',async()=>{
 const f=await fixture(),{app}=f;try{
  const {user,other}=await seed(app),second=await sign(app,'visitor');
  const update=(body,headers={})=>call(app,'/api/profile',user,{method:'PUT',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  assert.equal((await update({displayName:'新名字'},{Origin:'null'})).status,403);assert.equal((await update({displayName:''})).status,400);assert.equal((await update({displayName:'x'.repeat(51)})).status,400);
  const response=await update({displayName:'花园主人 🌿',owner:'another',username:'another',isAdmin:true});assert.equal(response.status,200);const data=await response.json();assert.equal(data.username,'visitor');assert.equal(data.isAdmin,false);assert.equal(data.displayName,'花园主人 🌿');
  assert.equal((await (await call(app,'/api/profile',other)).json()).displayName,'another');
  for(const session of [user,second])assert.equal((await (await call(app,'/api/auth',session)).json()).user.nickname,'花园主人 🌿');
  assert.equal((await call(app,'/api/admin/stats',user)).status,403);assert.ok(await sign(app,'visitor'));
 }finally{await f.close()}
});
test('avatars are private, validated, replaceable and removed with the account',async()=>{
 const f=await fixture(),{app}=f;try{
  const {user,other}=await seed(app),upload=(body,session=user)=>call(app,'/api/profile/avatar',session,{method:'POST',headers:{'Content-Type':'image/png'},body});
  assert.equal((await upload('<svg/>')).status,400);assert.equal((await upload(new Uint8Array(1024*1024+1))).status,413);assert.equal((await call(app,'/api/profile/avatar',other)).status,404);
  assert.equal((await upload(png)).status,200);const first=app.database.sql.prepare('SELECT avatar_key FROM user_profiles WHERE owner=?').get('visitor').avatar_key;
  const image=await call(app,'/api/profile/avatar',user);assert.match(image.headers.get('Cache-Control'),/private, no-store/);assert.equal(image.headers.get('Content-Type'),'image/png');assert.deepEqual(Buffer.from(await image.arrayBuffer()),png);
  assert.equal((await call(app,'/api/profile/avatar?owner=visitor',other)).status,404);
  assert.equal((await upload(png)).status,200);assert.equal(await app.BUCKET.get(first),null);
  assert.equal((await call(app,'/api/profile/avatar',user,{method:'DELETE'})).status,200);assert.equal((await call(app,'/api/profile/avatar',user)).status,404);
  await upload(png);const key=app.database.sql.prepare('SELECT avatar_key FROM user_profiles WHERE owner=?').get('visitor').avatar_key;
  const erased=await call(app,'/account/delete',user,{method:'POST',body:new URLSearchParams({username:'visitor',password,confirmation:'确认注销'})});assert.equal(erased.status,303);assert.equal(await app.BUCKET.get(key),null);assert.equal(app.database.sql.prepare('SELECT count(*) AS n FROM user_profiles WHERE owner=?').get('visitor').n,0);
 }finally{await f.close()}
});
test('administrator can edit profile while collection interfaces remain unavailable',async()=>{
 const f=await fixture(),{app}=f;try{
  await provisionAdmin(app.database.sql,{username:'operator',password});const admin=await sign(app,'operator');
  const data=await (await call(app,'/api/profile',admin)).json();assert.equal(data.isAdmin,true);assert.equal(data.summary,null);assert.equal((await call(app,'/account',admin)).status,200);
  assert.equal((await call(app,'/api/profile',admin,{method:'PUT',body:JSON.stringify({displayName:'园区管理'})})).status,200);
  assert.equal((await call(app,'/api/admin/stats',admin)).status,200);assert.equal((await call(app,'/api/plants',admin)).status,403);
 }finally{await f.close()}
});
test('cloud profile persists across restarts and forced password change cannot be bypassed via profile APIs',async()=>{
 const f=await fixture();let app=f.app;try{
  const {user}=await seed(app);await call(app,'/api/profile',user,{method:'PUT',body:JSON.stringify({displayName:'跨端保存'})});await call(app,'/api/profile/avatar',user,{method:'POST',body:png});
  app.close();app=createApp({dataDirectory:f.directory,origin});const restored=await (await call(app,'/api/profile',user)).json();assert.equal(restored.displayName,'跨端保存');assert.equal(restored.hasAvatar,true);
  app.database.sql.prepare('INSERT INTO account_security(owner,must_change) VALUES (?,1)').run('visitor');
  assert.equal((await call(app,'/account',user)).headers.get('Location'),'/auth/change-password');
  for(const endpoint of ['/api/profile','/api/profile/avatar'])assert.equal((await call(app,endpoint,user)).status,403);
 }finally{app.close();await fs.rm(f.directory,{recursive:true,force:true})}
});
