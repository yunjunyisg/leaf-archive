import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {createApp,httpServer} from '../standalone/server.mjs';import {setAccount} from '../standalone/local-auth.mjs';import {provisionAdmin} from '../standalone/admin-account.mjs';import {recordActivity,dayInChina} from '../standalone/access.mjs';
const origin='https://gloriouscarnivorousplants.top',password='test-only-admin-password';
async function fixture(){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'leaf-admin-')),app=createApp({dataDirectory:directory,origin});return {directory,app,async close(){app.close();await fs.rm(directory,{recursive:true,force:true})}}}
const login=(app,name,pwd=password)=>app.fetch(new Request(origin+'/auth/local',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:name,password:pwd})}),name+'-ip');
const cookie=response=>response.headers.getSetCookie()[0]?.split(';')[0];
function call(app,url,session,options={}){return app.fetch(new Request(origin+url,{...options,headers:{...(session?{Cookie:session}:{}),...(options.method?{Origin:origin}:{}),...options.headers}}))}
test('admin authorization requires a persisted role and a real session; ordinary users and forged headers cannot read data',async()=>{
 const f=await fixture(),{app}=f;
 try{
  await setAccount(app.database.sql,{username:'ordinary',password,owner:'user-owner'});await provisionAdmin(app.database.sql,{username:'operator',password});
  const normal=cookie(await login(app,'ordinary')),r=await login(app,'operator'),admin=cookie(r);assert.equal(r.headers.get('Location'),'/admin');
  assert.equal((await call(app,'/admin')).status,303);assert.equal((await call(app,'/api/admin/stats')).status,401);
  for(const url of ['/admin','/admin/app.js','/api/admin/stats','/api/admin/users','/api/admin/plants'])assert.equal((await call(app,url,normal)).status,403);
  assert.equal((await call(app,'/api/admin/stats',null,{headers:{'oai-authenticated-user-id':'operator','X-Admin':'true'}})).status,401);
  const page=await call(app,'/admin',admin);assert.equal(page.status,200);assert.match(page.headers.get('Cache-Control'),/private, no-store/);assert.ok((await page.text()).includes('管理后台'));
  assert.equal((await call(app,'/api/admin/users',admin,{method:'POST'})).status,405);
  const self=await (await call(app,'/api/auth',admin)).json();assert.equal(self.isAdmin,true);assert.equal((await (await call(app,'/api/auth',normal)).json()).isAdmin,false);
  app.database.sql.prepare('DELETE FROM local_admins').run();assert.equal((await call(app,'/api/admin/stats',admin)).status,403);
 }finally{await f.close()}
});
test('admin statistics count distinct active accounts and expose no authentication secrets',async()=>{
 const f=await fixture(),{app}=f;
 try{
  for(const username of ['first','second'])await setAccount(app.database.sql,{username,password,owner:username+'-owner'});
  await provisionAdmin(app.database.sql,{username:'operator',password});const admin=cookie(await login(app,'operator'));await login(app,'first');
  recordActivity(app.database.sql,'first-owner');recordActivity(app.database.sql,'first-owner');
  const otherDay=Date.now()-2*86400000;recordActivity(app.database.sql,'second-owner',{login:true,now:otherDay});
  app.database.sql.prepare('INSERT INTO plants VALUES (?,?,?,?,?)').run('one','first-owner','PL-1',JSON.stringify({name:'测试植物',photos:[]}),'2026-01-01');
  const r=await call(app,'/api/admin/stats',admin),stats=await r.json();assert.equal(stats.users,3);assert.equal(stats.administrators,1);assert.equal(stats.ordinaryUsers,2);assert.equal(stats.plants,1);assert.equal(stats.activeToday,2);assert.equal(stats.activeSevenDays,3);assert.equal(stats.activeFiveMinutes,2);
  assert.equal(stats.days.at(-1).day,dayInChina());assert.equal(stats.days.at(-1).users,2);assert.equal(stats.days[0].users,null);assert.ok(stats.storage.databaseBytes>0);
  const users=await (await call(app,'/api/admin/users',admin)).json(),text=JSON.stringify(users);assert.equal(users.total,3);assert.ok(!text.includes('password_hash'));assert.ok(!text.includes('salt'));assert.ok(!text.includes('token_hash'));
  assert.equal(users.users.find(u=>u.username==='first').registeredAt,null);assert.equal(users.users.find(u=>u.username==='first').plantCount,1);
 }finally{await f.close()}
});
test('admin can inspect records and photos while ordinary APIs keep original ownership',async()=>{
 const f=await fixture(),{app}=f;
 try{
  await setAccount(app.database.sql,{username:'original',password,owner:'original-owner'});await provisionAdmin(app.database.sql,{username:'operator',password});const original=cookie(await login(app,'original')),admin=cookie(await login(app,'operator')),id=randomUUID();
  app.database.sql.prepare('INSERT INTO plants VALUES (?,?,?,?,?)').run('plant-a','original-owner','PL-1',JSON.stringify({name:'<img src=x onerror=alert(1)>',photos:['/images/'+id],notes:'原记录'}),'2026-01-01');
  const bytes=new Uint8Array([137,80,78,71]);app.database.sql.prepare('INSERT INTO images VALUES (?,?,?)').run(id,'original-owner','image/png');await app.BUCKET.put('original-owner/'+id,bytes);
  const plants=await (await call(app,'/api/admin/plants?owner=original-owner',admin)).json();assert.equal(plants.total,1);assert.equal(plants.plants[0].username,'original');
  assert.equal((await (await call(app,'/api/admin/plants/plant-a',admin)).json()).notes,'原记录');
  const photo=await call(app,'/api/admin/images/'+id,admin);assert.equal(photo.status,200);assert.match(photo.headers.get('Cache-Control'),/private, no-store/);assert.deepEqual(new Uint8Array(await photo.arrayBuffer()),bytes);
  assert.equal((await call(app,'/api/admin/images/'+id,original)).status,403);assert.equal((await call(app,'/images/'+id,admin)).status,404);assert.equal((await call(app,'/images/'+id,original)).status,200);
  assert.deepEqual(await (await call(app,'/api/plants',admin)).json(),[]);assert.equal((await (await call(app,'/api/plants',original)).json()).length,1);
  assert.equal((await call(app,'/api/admin/images/not-a-real-id',admin)).status,404);
 }finally{await f.close()}
});
test('public registration cannot request admin permissions or collide with the provisioned administrator',async()=>{
 const f=await fixture(),{app}=f;
 try{
  await provisionAdmin(app.database.sql,{username:'operator',password});const before=app.database.sql.prepare('SELECT * FROM local_accounts WHERE username=?').get('operator');
  const register=(username,extra={})=>app.fetch(new Request(origin+'/auth/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username,password,confirmPassword:password,role:'admin',isAdmin:'true',owner:before.owner,...extra})}),username+'-ip');
  const registered=await register('visitor');assert.equal(registered.status,303);const session=cookie(registered);assert.equal((await call(app,'/api/admin/stats',session)).status,403);assert.equal((await (await call(app,'/api/auth',session)).json()).isAdmin,false);
  assert.equal((await register('OPERATOR')).status,409);assert.deepEqual(app.database.sql.prepare('SELECT * FROM local_accounts WHERE username=?').get('operator'),before);
  await assert.rejects(provisionAdmin(app.database.sql,{username:'visitor',password}),/不是管理员/);assert.equal(app.database.sql.prepare('SELECT count(*) AS n FROM local_admins').get().n,1);
 }finally{await f.close()}
});
test('administrator password reset revokes old sessions and the role survives a restart',async()=>{
 const f=await fixture();let app=f.app;
 try{
  const first=await provisionAdmin(app.database.sql,{username:'operator',password}),session=cookie(await login(app,'operator'));
  await provisionAdmin(app.database.sql,{username:'OPERATOR',password:password+'-changed'});assert.equal((await call(app,'/api/admin/stats',session)).status,401);
  app.close();app=createApp({dataDirectory:f.directory,origin});f.app=app;
  const signed=await login(app,'operator',password+'-changed');assert.equal(signed.headers.get('Location'),'/admin');assert.equal((await call(app,'/api/admin/stats',cookie(signed))).status,200);assert.equal(app.database.sql.prepare('SELECT owner FROM local_admins').get().owner,first.owner);
 }finally{app.close();await fs.rm(f.directory,{recursive:true,force:true})}
});
test('admin login, assets and metrics work through the real HTTP transport',async()=>{
 const f=await fixture(),{app}=f;await provisionAdmin(app.database.sql,{username:'operator',password});const server=httpServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{
  const r=await fetch(base+'/auth/local',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'operator',password})});assert.equal(r.status,303);assert.equal(r.headers.get('Location'),'/admin');const token=cookie(r);
  const page=await fetch(base+'/admin',{headers:{Cookie:token}});assert.equal(page.status,200);assert.match(page.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
  const script=await fetch(base+'/admin/app.js',{headers:{Cookie:token}});assert.equal(script.status,200);assert.ok((await script.text()).includes('textContent'));
  assert.equal((await (await fetch(base+'/api/admin/stats',{headers:{Cookie:token}})).json()).administrators,1);
 }finally{await new Promise(resolve=>server.close(resolve));await f.close()}
});

test('activity tracking records a new Beijing day even inside the one-minute throttle',async()=>{
 const f=await fixture();try{
  const before=Date.UTC(2026,9,30,15,59,59);recordActivity(f.app.database.sql,'midnight-user',{now:before});recordActivity(f.app.database.sql,'midnight-user',{now:before+2000});
  const days=f.app.database.sql.prepare('SELECT day FROM activity_days WHERE owner=? ORDER BY day').all('midnight-user');assert.deepEqual(days.map(row=>row.day),['2026-10-30','2026-10-31']);
 }finally{await f.close()}
});
