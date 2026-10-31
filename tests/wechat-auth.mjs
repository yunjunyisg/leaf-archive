import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';
import worker from '../dist/worker/index.js';
function setup(){const sql=new DatabaseSync(':memory:');for(const file of ['0000_harsh_ben_parker.sql','0001_polite_tarantula.sql'])sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));const objects=new Map();return {sql,env:{WECHAT_WEB_APP_ID:'test-web',WECHAT_WEB_APP_SECRET:'test-secret',WECHAT_REDIRECT_URI:'https://example.test/auth/wechat/callback',DB:{prepare(query){return {bind(...args){return {async all(){return {results:sql.prepare(query).all(...args)}},async first(){return sql.prepare(query).get(...args)||null},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}}}}}}}},BUCKET:{async put(key,bytes){objects.set(key,bytes)},async get(key){const body=objects.get(key);return body?{body}:null}}}}}
const req=(path,options={})=>new Request('https://example.test'+path,options);
const call=(env,path,options)=>worker.fetch(req(path,options),env);
function sessionCookie(response){return response.headers.getSetCookie().find(x=>x.startsWith('__Host-leaf-session=')).split(';')[0];}
async function login(env,openid,unionid){
 const start=await call(env,'/auth/wechat?mode=web');assert.equal(start.status,302);const state=new URL(start.headers.get('Location')).searchParams.get('state');const stateCookie=start.headers.get('Set-Cookie').split(';')[0];
 const original=globalThis.fetch;globalThis.fetch=async url=>new URL(url).pathname.endsWith('access_token')?Response.json({openid,access_token:'test-access-token',unionid}):Response.json({openid,nickname:'测试微信用户',unionid});
 try{const response=await call(env,'/auth/wechat/callback?code=valid-code&state='+state,{headers:{Cookie:stateCookie}});assert.equal(response.status,303);assert.equal(response.headers.get('Location'),'https://example.test/');return {cookie:sessionCookie(response),state,stateCookie};}finally{globalThis.fetch=original;}
}
const headers=(cookie,revision)=>({Cookie:cookie,Origin:'https://example.test','Content-Type':'application/json',...(revision?{'If-Match':'"'+revision+'"'}:{})});
test('verified WeChat accounts have independent plants, modifications, deletions, and photos',async()=>{
 const {env,sql}=setup();const a=await login(env,'openid-a');const b=await login(env,'openid-b');
 const create=await call(env,'/api/plants',{method:'POST',headers:headers(a.cookie),body:JSON.stringify({name:'用户A植物',number:'PL-001'})});const plant=await create.json();assert.equal(create.status,201);
 const otherCreate=await call(env,'/api/plants',{method:'POST',headers:headers(b.cookie),body:JSON.stringify({name:'用户B植物',number:'PL-001'})});assert.equal(otherCreate.status,201);
 const mine=await (await call(env,'/api/plants',{headers:headers(a.cookie)})).json();const theirs=await (await call(env,'/api/plants',{headers:headers(b.cookie)})).json();assert.equal(mine[0].name,'用户A植物');assert.equal(theirs[0].name,'用户B植物');
 for(const method of ['PUT','DELETE'])assert.equal((await call(env,'/api/plants/'+plant.id,{method,headers:headers(b.cookie,plant._revision),...(method==='PUT'?{body:JSON.stringify(plant)}:{})})).status,404);
 const data=new FormData();data.append('file',new Blob([Uint8Array.from([137,80,78,71,0,0])],{type:'image/png'}),'plant.png');const photo=await (await call(env,'/api/images',{method:'POST',headers:{Cookie:a.cookie,Origin:'https://example.test'},body:data})).json();
 const image=await call(env,photo.url,{headers:{Cookie:a.cookie}});assert.equal(image.status,200);assert.equal(image.headers.get('Cache-Control'),'private, no-store');assert.equal((await call(env,photo.url,{headers:{Cookie:b.cookie}})).status,404);assert.equal((await call(env,photo.url)).status,401);
 const again=await login(env,'openid-a');assert.equal((await (await call(env,'/api/plants',{headers:headers(again.cookie)})).json())[0].id,plant.id);sql.close();
});
test('state must match the browser, be fresh, and be consumed only once',async()=>{
 const {env,sql}=setup();const user=await login(env,'openid-a');assert.equal((await call(env,'/auth/wechat/callback?code=replay&state='+user.state,{headers:{Cookie:user.stateCookie}})).headers.get('Location'),'https://example.test/?login=failed');
 const start=await call(env,'/auth/wechat');const state=new URL(start.headers.get('Location')).searchParams.get('state');assert.equal((await call(env,'/auth/wechat/callback?code=test&state='+state)).headers.get('Location'),'https://example.test/?login=failed');
 sql.prepare('UPDATE oauth_states SET expires=0').run();assert.equal((await call(env,'/auth/wechat/callback?code=test&state='+state,{headers:{Cookie:start.headers.get('Set-Cookie').split(';')[0]}})).headers.get('Location'),'https://example.test/?login=failed');sql.close();
});
test('forged headers, altered cookies, expired sessions, and logged-out sessions cannot access archives',async()=>{
 const {env,sql}=setup();assert.equal((await call(env,'/api/plants',{headers:{'oai-authenticated-user-id':'pretend-owner'}})).status,401);
 const user=await login(env,'openid-a');assert.equal((await call(env,'/api/plants',{headers:{Cookie:user.cookie.slice(0,-1)+(user.cookie.endsWith('a')?'b':'a')}})).status,401);
 assert.equal((await call(env,'/api/auth/logout',{method:'POST',headers:{Cookie:user.cookie,Origin:'https://evil.test'}})).status,403);
 assert.equal((await call(env,'/api/auth/logout',{method:'POST',headers:headers(user.cookie)})).status,200);assert.equal((await call(env,'/api/plants',{headers:headers(user.cookie)})).status,401);
 const next=await login(env,'openid-a');sql.prepare('UPDATE auth_sessions SET expires=0').run();assert.equal((await call(env,'/api/plants',{headers:headers(next.cookie)})).status,401);sql.close();
});
test('UnionID links configured WeChat apps while missing configuration never fakes login',async()=>{
 const {env,sql}=setup();const a=await login(env,'app-one-openid','same-union');env.WECHAT_WEB_APP_ID='app-two';const b=await login(env,'app-two-openid','same-union');
 const userA=(await (await call(env,'/api/auth',{headers:{Cookie:a.cookie}})).json()).user;const userB=(await (await call(env,'/api/auth',{headers:{Cookie:b.cookie}})).json()).user;assert.equal(userA.id,userB.id);
 const state=await (await call({...env,WECHAT_WEB_APP_SECRET:''},'/api/auth')).json();assert.equal(state.wechat.web,false);assert.equal((await call({...env,WECHAT_WEB_APP_SECRET:''},'/auth/wechat')).headers.get('Location'),'https://example.test/?login=not-configured');sql.close();
});
