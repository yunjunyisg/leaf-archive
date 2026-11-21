import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPlantId} from '../server.mjs';
import {askProviderRegistry,compatibleProviderPatch,routeForQuestion} from '../dsh/providers.mjs';

const origin='https://gloriouscarnivorousplants.top';
async function appFixture(dshAnswer,env={}){
 const dir=await mkdtemp(join(tmpdir(),'plant-ask-test-'));
 const options={dataDirectory:dir,origin,env:{PLANT_ID_API_KEY:'server-vision-key',...env},dshAnswer};
 let app=createPlantId(options);
 const post=(path,value,{cookie='',source=origin}={})=>app.fetch(new Request(origin+'/plant-id/'+path,{
  method:'POST',headers:{Cookie:cookie,Origin:source,'Content-Type':'application/json'},body:JSON.stringify(value),
 }));
 const login=async name=>{
  const response=await post('api/register',{username:name,password:'test-password'});
  assert.equal(response.status,200);
  return response.headers.get('Set-Cookie').split(';')[0];
 };
 return {get app(){return app},dir,post,login,restart(){app.close();app=createPlantId(options)},close:async()=>{app.close();await rm(dir,{recursive:true,force:true})}};
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

test('different user keys route only to selected trusted providers and models',async()=>{
 const calls=[];
 const f=await appFixture(async input=>{
  calls.push(input);
  return {text:'植物问答的测试答复。',model:input.route.model,truncated:false};
 },{PLANT_ID_ASK_GATEWAYS:JSON.stringify([{id:'custom-example',label:'示例网关',baseURL:'https://models.example.com/v1',model:'vendor/plant-chat'}])});
 try{
  const cookie=await f.login('gateway_user');
  const session=await(await f.app.fetch(new Request(origin+'/plant-id/api/session'))).json();
  assert.ok(session.askProviders.some(row=>row.id==='bigmodel'));
  assert.ok(session.askProviders.some(row=>row.id==='custom-example'));
  assert.ok(session.askProviders.every(row=>!Object.hasOwn(row,'baseURL')));
  const question={apiKey:'opaque123.example_Token',plant:'Rosa chinensis',question:'怎么和相似的植物区分？'};
  for(const invalid of [
   {provider:'unknown'},
   {provider:'deepseek',model:'arbitrary'},
   {provider:'bigmodel',model:'not a model'},
   {provider:'bigmodel',baseURL:'https://example.com/v1'},
   {provider:'bigmodel',apiKey:'Bearer token123'},
  ])assert.equal((await f.post('api/ask',{...question,...invalid},{cookie})).status,400);
  assert.equal(calls.length,0);
  const first=await f.post('api/ask',{...question,provider:'bigmodel',model:'glm-4.6v-flashx'},{cookie});
  assert.equal(first.status,200);
  const payload=await first.json();
  assert.equal(payload.provider,'智谱开放平台');
  assert.equal(payload.model,'glm-4.6v-flashx');
  assert.equal(calls[0].apiKey,question.apiKey);
  assert.equal(calls[0].route.baseURL,'https://open.bigmodel.cn/api/paas/v4');
  assert.equal(calls[0].knowledge[0].name,'Rosa chinensis');
  assert.doesNotMatch(JSON.stringify(payload),/opaque123|open\.bigmodel\.cn/);
  const second=await f.post('api/ask',{...question,provider:'custom-example',apiKey:'another_provider-token'},{cookie});
  assert.equal(second.status,200);
  assert.equal(calls[1].route.baseURL,'https://models.example.com/v1');
  assert.equal(calls[1].route.model,'vendor/plant-chat');
  assert.equal(calls[1].apiKey,'another_provider-token');
 }finally{await f.close()}
});


test('a saved question key survives reloads, is scoped to account and provider, and is replaced only on success',async()=>{
 const calls=[];
 const f=await appFixture(async input=>{
  calls.push(input);
  if(input.apiKey==='rejected-token'||input.question==='拒绝已保存的密钥')
   throw Object.assign(Error('服务商拒绝了该密钥'),{status:422,code:'ask_key_invalid'});
  if(input.question==='服务商暂时不可用')throw Object.assign(Error('暂时不可用'),{status:502});
  return {text:'结果',model:input.route.model};
 });
 const first='personal-original-key',second='personal-replacement-key';
 const body={provider:'bigmodel',question:'如何养护？'};
 try{
  const cookie=await f.login('credential_owner'),other=await f.login('another_owner');
  const session=async cookie=>await(await f.app.fetch(new Request(origin+'/plant-id/api/session',{headers:{Cookie:cookie}}))).json();
  const ask=(overrides={},c=cookie)=>f.post('api/ask',{...body,...overrides},{cookie:c});
  for(const response of [await ask(),await ask({},other)]){
   assert.equal(response.status,400);
   assert.equal((await response.json()).code,'ask_key_required');
  }
  assert.equal((await ask({apiKey:'rejected-token',rememberKey:true})).status,422);
  assert.deepEqual((await session(cookie)).savedAskProviders,[]);
  assert.equal((await(await ask({apiKey:first,rememberKey:true})).json()).savedKey,true);
  const {sealed}=f.app.sql.prepare('SELECT sealed FROM ask_credentials').get();
  assert.ok(!Buffer.from(sealed).includes(Buffer.from(first)));
  assert.equal((await stat(join(f.dir,'ask-credentials.key'))).mode&0o777,0o600);

  f.restart();
  const metadata=await session(cookie);
  assert.deepEqual(metadata.savedAskProviders,['bigmodel']);
  assert.deepEqual((await session(other)).savedAskProviders,[]);
  assert.doesNotMatch(JSON.stringify(metadata),/personal-original-key/);
  assert.equal((await ask()).status,200);
  assert.equal(calls.at(-1).apiKey,first);
  assert.equal(calls.at(-1).route.model,'glm-4.7-flash');
  assert.equal((await ask({provider:'dashscope'})).status,400);
  assert.equal((await ask({},other)).status,400);

  assert.equal((await ask({apiKey:'rejected-token',rememberKey:true})).status,422);
  assert.equal((await ask()).status,200);
  assert.equal(calls.at(-1).apiKey,first);
  assert.equal((await ask({apiKey:second,rememberKey:true})).status,200);
  assert.equal((await ask({question:'服务商暂时不可用'})).status,502);
  assert.equal((await ask()).status,200);
  assert.equal(calls.at(-1).apiKey,second);
  const revoked=await ask({question:'拒绝已保存的密钥'});
  assert.equal(revoked.status,422);
  assert.equal((await revoked.json()).code,'ask_key_invalid');
  assert.deepEqual((await session(cookie)).savedAskProviders,[]);
  assert.equal((await ask()).status,400);
 }finally{await f.close()}
});

test('Zhipu uses its thinking controls and only the default model can select a fallback',()=>{
 const providers=askProviderRegistry({});
 const route=routeForQuestion(providers,'bigmodel','');
 assert.equal(route.fallbackModel,'glm-4.5-flash');
 const [{insert:[plugin]}]=compatibleProviderPatch(route);
 const profile=plugin.config.providers['plant-id-compatible'];
 assert.equal(profile.compat.thinkingFormat,'zai');
 assert.equal(profile.compat.maxTokensField,'max_tokens');
 assert.equal(profile.compat.supportsUsageInStreaming,false);
 assert.equal(profile.models[0].reasoningEfforts.off,null);
 assert.equal(routeForQuestion(providers,'bigmodel','glm-4.6v-flashx').fallbackModel,undefined);
 assert.equal(routeForQuestion(providers,'dashscope','').fallbackModel,undefined);
});
