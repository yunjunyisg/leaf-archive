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
  assert.equal((await call(app,'/api/plants',admin)).status,403);assert.equal((await (await call(app,'/api/plants',original)).json()).length,1);
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

test('admin reset revokes every session and forces a password change across pages, APIs and photos',async()=>{
 const f=await fixture(),{app}=f;
 try{
  await setAccount(app.database.sql,{username:'visitor',password,owner:'visitor-owner'});await provisionAdmin(app.database.sql,{username:'operator',password});
  const admin=cookie(await login(app,'operator')),old=cookie(await login(app,'visitor')),other=cookie(await login(app,'visitor'));
  const act=(session,body,options={})=>call(app,'/api/admin/users/reset-password',session,{method:'POST',body:JSON.stringify(body),...options});
  const target={owner:'visitor-owner',username:'visitor'};
  assert.equal((await act(old,target)).status,403);assert.equal((await act(null,target)).status,401);
  for(const Origin of ['null','https://foreign.example',''])assert.equal((await act(admin,target,{headers:{Origin}})).status,403);
  assert.equal((await act(admin,{...target,username:'wrong'})).status,404);
  assert.equal((await act(admin,target)).status,200);
  for(const s of [old,other])assert.equal((await call(app,'/api/admin/stats',s)).status,401);
  assert.equal(cookie(await login(app,'visitor',password)),undefined);
  const signIn=await login(app,'visitor','000000'),forced=cookie(signIn);assert.equal(signIn.headers.get('Location'),'/auth/change-password');
  for(const url of ['/','/admin','/admin/app.js'])assert.equal((await call(app,url,forced)).headers.get('Location'),'/auth/change-password');
  for(const url of ['/api/plants','/api/auth','/api/taxa','/images/00000000-0000-0000-0000-000000000000']){const response=await call(app,url,forced);assert.equal(response.status,403);assert.equal((await response.json()).code,'PASSWORD_CHANGE_REQUIRED')}
  const change=(currentPassword,newPassword,confirmPassword=newPassword,headers={})=>call(app,'/auth/change-password',forced,{method:'POST',body:new URLSearchParams({currentPassword,password:newPassword,confirmPassword}),headers});
  assert.equal((await call(app,'/auth/change-password',forced)).status,200);
  assert.equal((await change('000000','new-password','new-password',{Origin:'null'})).status,403);
  assert.equal((await change('incorrect','new-password')).status,400);
  assert.equal((await change('000000','000000')).status,400);
  assert.equal((await change('000000','short')).status,400);
  assert.equal((await change('000000','new-password','different')).status,400);
  const changed=await change('000000','new-password'),fresh=cookie(changed);assert.equal(changed.status,303);assert.equal(changed.headers.get('Location'),'/');assert.notEqual(fresh,forced);
  assert.equal((await call(app,'/auth/change-password',forced)).headers.get('Location'),'/auth/local');
  assert.equal((await call(app,'/api/plants',fresh)).status,200);
  assert.equal(cookie(await login(app,'visitor','000000')),undefined);
  assert.equal((await login(app,'visitor','new-password')).headers.get('Location'),'/');
  const audit=app.database.sql.prepare('SELECT * FROM admin_audit').all();assert.equal(audit.length,1);assert.equal(audit[0].action,'reset-password');assert.ok(!JSON.stringify(audit).includes('000000'));
 }finally{await f.close()}
});

test('deactivation is admin-only, preserves archives, blocks sessions and cannot be undone through registration or reset',async()=>{
 const f=await fixture(),{app}=f;
 try{
  await setAccount(app.database.sql,{username:'visitor',password,owner:'visitor-owner'});await provisionAdmin(app.database.sql,{username:'operator',password});
  const admin=cookie(await login(app,'operator')),visitor=cookie(await login(app,'visitor')),operator=app.database.sql.prepare('SELECT owner FROM local_admins').get().owner;
  app.database.sql.prepare('INSERT INTO plants VALUES (?,?,?,?,?)').run('preserved','visitor-owner','PL-1',JSON.stringify({name:'保留档案',photos:[]}),'2026-01-01');
  const action=(name,target,session=admin)=>call(app,'/api/admin/users/'+name,session,{method:'POST',body:JSON.stringify(target)});
  for(const name of ['deactivate','reset-password'])assert.equal((await action(name,{owner:operator,username:'operator'})).status,403);
  const target={owner:'visitor-owner',username:'visitor'};
  assert.equal((await action('deactivate',target,visitor)).status,403);assert.equal((await action('deactivate',target)).status,200);
  assert.equal(cookie(await login(app,'visitor')),undefined);assert.equal((await call(app,'/auth/change-password',visitor)).headers.get('Location'),'/auth/local');
  assert.equal(app.database.sql.prepare('SELECT count(*) AS n FROM auth_sessions WHERE owner=?').get(target.owner).n,0);
  assert.equal(app.database.sql.prepare('SELECT count(*) AS n FROM plants WHERE owner=?').get(target.owner).n,1);
  for(const name of ['deactivate','reset-password'])assert.equal((await action(name,target)).status,409);
  const registration=await call(app,'/auth/register',null,{method:'POST',body:new URLSearchParams({username:'VISITOR',password,confirmPassword:password})});assert.equal(registration.status,409);
  const list=await (await call(app,'/api/admin/users',admin)).json();assert.equal(list.users.find(u=>u.username==='visitor').disabled,1);
  assert.equal((await (await call(app,'/api/admin/plants?owner=visitor-owner',admin)).json()).total,1);
 }finally{await f.close()}
});

test('concurrent reset cannot issue a session authenticated by a stale password',async()=>{
 const f=await fixture(),{app}=f;
 try{
  await setAccount(app.database.sql,{username:'visitor',password,owner:'visitor-owner'});await provisionAdmin(app.database.sql,{username:'operator',password});const admin=cookie(await login(app,'operator'));
  const pending=login(app,'visitor');
  const reset=await call(app,'/api/admin/users/reset-password',admin,{method:'POST',body:JSON.stringify({owner:'visitor-owner',username:'visitor'})});assert.equal(reset.status,200);
  const response=await pending,old=cookie(response);if(old)assert.equal((await call(app,'/api/plants',old)).status,401);
  const forced=cookie(await login(app,'visitor','000000'));assert.equal((await call(app,'/api/plants',forced)).status,403);
 }finally{await f.close()}
});

test('forced password change and deactivation persist after reopening the database',async()=>{
 const f=await fixture();let app=f.app;
 try{
  await provisionAdmin(app.database.sql,{username:'operator',password});const admin=cookie(await login(app,'operator'));
  for(const username of ['resetuser','closeduser'])await setAccount(app.database.sql,{username,password,owner:username});
  for(const [username,action] of [['resetuser','reset-password'],['closeduser','deactivate']])assert.equal((await call(app,'/api/admin/users/'+action,admin,{method:'POST',body:JSON.stringify({owner:username,username})})).status,200);
  app.close();app=createApp({dataDirectory:f.directory,origin});
  assert.equal((await login(app,'resetuser','000000')).headers.get('Location'),'/auth/change-password');
  assert.equal(cookie(await login(app,'closeduser')),undefined);assert.equal(app.database.sql.prepare('SELECT count(*) AS n FROM admin_audit').get().n,2);
 }finally{app.close();await fs.rm(f.directory,{recursive:true,force:true})}
});

test('administrator has only data, management and aggregate map entry points while normal user collection stays available',async()=>{
 const f=await fixture(),{app}=f;
 try{
  await provisionAdmin(app.database.sql,{username:'operator',password});await setAccount(app.database.sql,{username:'visitor',password,owner:'visitor'});
  const admin=cookie(await login(app,'operator')),user=cookie(await login(app,'visitor'));
  for(const url of ['/','/origins','/origins/','/classification','/classification/','/auth/local','/auth/register']){
   assert.equal((await call(app,url,admin)).headers.get('Location'),'/admin');assert.equal((await call(app,url,user)).status,200);
  }
  for(const url of ['/api/plants','/api/taxa','/api/images'])for(const method of ['GET','POST'])assert.equal((await call(app,url,admin,{method,body:method==='POST'?'{}':undefined})).status,403);
  assert.equal((await call(app,'/api/plants',user)).status,200);assert.equal((await call(app,'/api/taxa',user)).status,200);
  const page=await call(app,'/admin',admin),html=await page.text();assert.ok(!html.includes('进入我的收藏'));
  for(const text of ['数据统计','账号管理','用户总植物地图','蜀ICP备2026066760号'])assert.ok(html.includes(text));
  assert.match(page.headers.get('Content-Security-Policy'),/style-src 'self'/);assert.match(page.headers.get('Content-Security-Policy'),/https:\/\/tile.openstreetmap.org/);
  assert.equal((await call(app,'/origin-map.js',admin)).status,200);assert.equal((await call(app,'/origin-map.css',admin)).status,200);
 }finally{await f.close()}
});

test('aggregate map includes every user and historical owner with precise locations and protected photo links',async()=>{
 const f=await fixture(),{app}=f;
 try{
  await provisionAdmin(app.database.sql,{username:'operator',password});await setAccount(app.database.sql,{username:'visitor',password,owner:'visitor'});
  const admin=cookie(await login(app,'operator')),user=cookie(await login(app,'visitor')),id=randomUUID();
  const location={lat:-15.98111,lon:128.4178,countryCode:'AU',state:'Western Australia',county:'Wyndham-East Kimberley',locality:'Kingston Rest',precision:'locality',source:'geonames'};
  for(const [key,owner,originLocation] of [['first','visitor',location],['second','historical-owner',location],['third','visitor',null]])app.database.sql.prepare('INSERT INTO plants VALUES (?,?,?,?,?)').run(key,owner,key,JSON.stringify({name:key,originLocation,species:'test',photos:['/images/'+id],notes:'private note excluded from map'}),'2026-01-01');
  assert.equal((await call(app,'/api/admin/map-plants')).status,401);assert.equal((await call(app,'/api/admin/map-plants',user)).status,403);
  const response=await call(app,'/api/admin/map-plants',admin);assert.match(response.headers.get('Cache-Control'),/private, no-store/);const data=await response.json();
  assert.equal(data.plants.length,3);assert.equal(data.nextCursor,null);assert.deepEqual(data.plants[0].originLocation,location);assert.equal(data.plants[0].photos[0],'/api/admin/images/'+id);assert.equal(data.plants[0].username,'visitor');assert.equal(data.plants[1].username,'历史归属');assert.equal(data.plants[2].originLocation,null);
  assert.ok(!JSON.stringify(data).includes('private note'));assert.equal((await (await call(app,'/api/admin/map-plants?owner=visitor',admin)).json()).plants.length,2);
  assert.equal((await (await call(app,'/api/plants',user)).json()).length,2);
 }finally{await f.close()}
});

test('aggregate map keyset pagination does not omit plants above the first 500 records',async()=>{
 const f=await fixture(),{app}=f;
 try{
  await provisionAdmin(app.database.sql,{username:'operator',password});const admin=cookie(await login(app,'operator'));
  const insert=app.database.sql.prepare('INSERT INTO plants VALUES (?,?,?,?,?)');app.database.sql.exec('BEGIN');
  for(let i=0;i<503;i++){const id=String(i).padStart(4,'0');insert.run(id,'history',id,JSON.stringify({name:id}),'2026-01-01')}app.database.sql.exec('COMMIT');
  const first=await (await call(app,'/api/admin/map-plants',admin)).json();assert.equal(first.plants.length,500);assert.equal(first.nextCursor,'0499');
  const second=await (await call(app,'/api/admin/map-plants?after='+first.nextCursor,admin)).json();assert.equal(second.plants.length,3);assert.equal(second.nextCursor,null);
  assert.equal(new Set([...first.plants,...second.plants].map(p=>p.id)).size,503);
 }finally{await f.close()}
});
