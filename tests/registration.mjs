import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {createApp,httpServer} from '../standalone/server.mjs';import {setAccount} from '../standalone/local-auth.mjs';
const origin='https://gloriouscarnivorousplants.top',password='A1b2c3';
async function fixture(){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'leaf-register-')),app=createApp({dataDirectory:directory,origin});return {app,async close(){app.close();await fs.rm(directory,{recursive:true,force:true})}}}
const form=(route,fields,headers={})=>new Request(origin+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded',...headers},body:new URLSearchParams(fields)});
const cookie=response=>response.headers.getSetCookie()[0]?.split(';')[0];
const get=(app,url,session)=>app.fetch(new Request(origin+url,{headers:session?{Cookie:session}:{}}));
const signup=(app,username,extra={},ip=username)=>app.fetch(form('/auth/register',{username,password,confirmPassword:password,...extra}),ip);
test('registration creates independent empty accounts, ignores supplied ownership and protects old records and photos',async()=>{
 const f=await fixture(),{app}=f;
 try{
  await setAccount(app.database.sql,{username:'original',password,owner:'original-owner'});
  const oldSession=cookie(await app.fetch(form('/auth/local',{username:'original',password}),'old-ip'));
  const original=await (await app.fetch(new Request(origin+'/api/plants',{method:'POST',headers:{Cookie:oldSession,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'原档案',number:'ORIGINAL-1',photos:[],logs:[]})}))).json();
  app.database.sql.prepare('INSERT INTO images VALUES (?,?,?)').run('private-image','original-owner','image/png');await app.BUCKET.put('original-owner/private-image',new Uint8Array([137,80,78,71]));
  const alice=await signup(app,'Alice',{owner:'original-owner',nickname:'original',isAdmin:'true'}),bob=await signup(app,'bob');assert.equal(alice.status,303);assert.equal(bob.status,303);
  const a=cookie(alice),b=cookie(bob);assert.match(alice.headers.getSetCookie()[0],/Secure; HttpOnly; SameSite=Lax/);
  const whoA=(await (await get(app,'/api/auth',a)).json()).user,whoB=(await (await get(app,'/api/auth',b)).json()).user;
  assert.match(whoA.id,/^local:/);assert.notEqual(whoA.id,'original-owner');assert.notEqual(whoA.id,whoB.id);
  assert.deepEqual(await (await get(app,'/api/plants',a)).json(),[]);assert.deepEqual(await (await get(app,'/api/taxa',b)).json(),[]);
  assert.equal((await get(app,'/images/private-image',a)).status,404);assert.equal((await get(app,'/images/private-image',oldSession)).status,200);
  for(const method of ['PUT','DELETE'])assert.equal((await app.fetch(new Request(origin+'/api/plants/'+original.id,{method,headers:{Cookie:a,Origin:origin,'If-Match':'"'+original._revision+'"','Content-Type':'application/json'},...(method==='PUT'?{body:JSON.stringify({...original,name:'不能改'})}:{})}))).status,404);
  const saved=await (await app.fetch(new Request(origin+'/api/plants',{method:'POST',headers:{Cookie:a,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'新用户植物',number:'ALICE-1',photos:[],logs:[]})}))).json();assert.ok(saved.id);
  assert.deepEqual(await (await get(app,'/api/plants',b)).json(),[]);assert.equal((await (await get(app,'/api/plants',oldSession)).json())[0].name,'原档案');
  const login=await app.fetch(form('/auth/local',{username:'aLiCe',password}),'login-ip');assert.equal(login.status,303);assert.equal((await (await get(app,'/api/auth',cookie(login))).json()).user.id,whoA.id);
 }finally{await f.close()}
});
test('invalid registrations and duplicate names never change an existing password or data binding',async()=>{
 const f=await fixture(),{app}=f;
 try{
  await setAccount(app.database.sql,{username:'Existing',password,owner:'kept-owner'});const before=app.database.sql.prepare('SELECT * FROM local_accounts WHERE owner=?').get('kept-owner');
  for(const [name,fields] of [['ab',{}],['<script>',{}],['valid',{password:'12345',confirmPassword:'12345'}],['valid',{confirmPassword:'different'}]])assert.equal((await signup(app,name,fields,'invalid-'+name)).status,400);
  assert.equal(app.database.sql.prepare('SELECT count(*) AS n FROM local_accounts').get().n,1);
  assert.equal((await signup(app,'EXISTING',{password:'new123',confirmPassword:'new123'})).status,409);
  assert.deepEqual(app.database.sql.prepare('SELECT * FROM local_accounts WHERE owner=?').get('kept-owner'),before);
  assert.equal((await app.fetch(form('/auth/local',{username:'existing',password}),'old-login')).status,303);
  const malicious=await app.fetch(form('/auth/register',{username:'new-user',password,confirmPassword:password},{Origin:'https://attacker.test'}));assert.equal(malicious.status,403);
  assert.equal((await app.fetch(form('/auth/register',{username:'new-user',password,confirmPassword:password},{Origin:'null'}))).status,403);
 }finally{await f.close()}
});
test('concurrent same-name registrations create one account without overwriting the winner',async()=>{
 const f=await fixture(),{app}=f;
 try{
  const attempts=await Promise.all([signup(app,'orchid',{password:'first1',confirmPassword:'first1'},'race-a'),signup(app,'ORCHID',{password:'second2',confirmPassword:'second2'},'race-b')]);
  assert.deepEqual(attempts.map(r=>r.status).sort(),[303,409]);assert.equal(app.database.sql.prepare('SELECT count(*) AS n FROM local_accounts').get().n,1);
  const winner=attempts[0].status===303?'first1':'second2',session=await app.fetch(form('/auth/local',{username:'Orchid',password:winner}),'winner-ip');assert.equal(session.status,303);
  assert.equal(app.database.sql.prepare('SELECT count(*) AS n FROM auth_sessions').get().n,2);
 }finally{await f.close()}
});
test('registration is rate limited and both pages retain same-origin policy and navigation',async()=>{
 const f=await fixture(),{app}=f;
 try{
  const login=await get(app,'/auth/local');assert.ok((await login.text()).includes('/auth/register'));
  const register=await get(app,'/auth/register');assert.equal(register.headers.get('Referrer-Policy'),'same-origin');const html=await register.text();assert.ok(html.includes('name="confirmPassword"'));assert.ok(html.includes('minlength="6"'));assert.ok(html.includes('/auth/local'));
  for(let i=0;i<10;i++)assert.equal((await signup(app,'bad name',{},'shared-ip')).status,400);
  const blocked=await signup(app,'valid-name',{},'shared-ip');assert.equal(blocked.status,429);assert.equal(blocked.headers.get('Retry-After'),'900');
  assert.equal((await signup(app,'another-user',{},'another-ip')).status,303);
 }finally{await f.close()}
});
test('registration works through real HTTP and survives process restart',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'leaf-register-http-'));let app=createApp({dataDirectory:directory,origin}),server=httpServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const page=await fetch(base+'/auth/register');assert.equal(page.status,200);assert.equal(page.headers.get('Referrer-Policy'),'same-origin');
  const r=await fetch(base+'/auth/register',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'new-person',password,confirmPassword:password})});assert.equal(r.status,303);assert.equal(r.headers.getSetCookie().length,2);const session=cookie(r);
  await new Promise(resolve=>server.close(resolve));server=null;app.close();app=createApp({dataDirectory:directory,origin});
  assert.equal((await (await get(app,'/api/auth',session)).json()).user.nickname,'new-person');assert.equal((await app.fetch(form('/auth/local',{username:'NEW-PERSON',password}))).status,303);
 }finally{if(server)await new Promise(r=>server.close(r));app.close();await fs.rm(directory,{recursive:true,force:true})}
});
