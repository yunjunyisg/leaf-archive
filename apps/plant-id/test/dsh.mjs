import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPlantId} from '../server.mjs';

const origin='https://gloriouscarnivorousplants.top';
async function appFixture(dshAnswer){
 const dir=await mkdtemp(join(tmpdir(),'plant-ask-test-'));
 const app=createPlantId({dataDirectory:dir,origin,env:{PLANT_ID_API_KEY:'server-vision-key'},dshAnswer});
 const post=(path,value,{cookie='',source=origin}={})=>app.fetch(new Request(origin+'/plant-id/'+path,{
  method:'POST',headers:{Cookie:cookie,Origin:source,'Content-Type':'application/json'},body:JSON.stringify(value),
 }));
 const login=async name=>{
  const response=await post('api/register',{username:name,password:'test-password'});
  assert.equal(response.status,200);
  return response.headers.get('Set-Cookie').split(';')[0];
 };
 return {app,post,login,close:async()=>{app.close();await rm(dir,{recursive:true,force:true})}};
}

test('web questions require individual credentials and use the same public catalogue as the plugin',async()=>{
 let request;
 const f=await appFixture(async input=>{request=input;return {text:'可对比叶片和捕虫夹。',model:'deepseek-v4-flash',truncated:false}});
 const apiKey='sk-personal-key-in-test-1234';
 const body={apiKey,question:'捕蝇草怎么鉴别？',plant:'Dionaea corymbosa',history:[{question:'第一问',answer:'第一答'}]};
 try{
  assert.equal((await f.post('api/ask',body)).status,401);
  const cookie=await f.login('answer_user');
  assert.equal((await f.post('api/ask',body,{cookie,source:'https://example.com'})).status,403);
  assert.equal((await f.post('api/ask',{...body,apiKey:''},{cookie})).status,400);
  assert.equal((await f.post('api/ask',{...body,question:''},{cookie})).status,400);
  assert.equal((await f.post('api/ask',{...body,history:Array(5).fill({question:'x',answer:'y'})},{cookie})).status,400);
  assert.equal(request,undefined);
  const response=await f.post('api/ask',body,{cookie});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.text,'可对比叶片和捕虫夹。');
  assert.equal(result.sources[0].url,'https://www.worldfloraonline.org/taxon/wfo-0000943687');
  assert.equal(request.apiKey,apiKey);
  assert.equal(request.knowledge[0].name,'Dionaea muscipula');
  assert.deepEqual(request.history,body.history);
  assert.doesNotMatch(JSON.stringify(result),/sk-personal|server-vision-key/);
  assert.equal(f.app.sql.prepare('SELECT count(*) n FROM turns').get().n,0);
 }finally{await f.close()}
});

test('remote knowledge plugin exposes only public read-only lookup without an AI key',async()=>{
 const f=await appFixture();
 const rpc=(method,params,id=1)=>f.post('mcp',{jsonrpc:'2.0',method,params,id});
 try{
  const init=await(await rpc('initialize',{protocolVersion:'2025-06-18'})).json();
  assert.equal(init.result.protocolVersion,'2025-06-18');
  assert.equal((await f.post('mcp',{jsonrpc:'2.0',method:'notifications/initialized'})).status,202);
  const list=await(await rpc('tools/list')).json();
  assert.deepEqual(list.result.tools.map(t=>t.name),['lookup_plant']);
  const result=await(await rpc('tools/call',{name:'lookup_plant',arguments:{name:'月季'}})).json();
  assert.equal(result.result.structuredContent.entries[0].name,'Rosa chinensis');
  const rejected=await(await rpc('tools/call',{name:'write',arguments:{name:'任意植物'}})).json();
  assert.equal(rejected.error.code,-32602);
  assert.equal((await f.post('mcp',{jsonrpc:'2.0',id:1,method:'tools/list'},{source:'https://example.com'})).status,403);
 }finally{await f.close()}
});
