import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
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
 function seed(username,scientificName='Rosa chinensis'){
  const owner=app.sql.prepare('SELECT id FROM users WHERE username=?').get(username).id;
  const threadId=randomUUID(),turnId=randomUUID(),created=Date.now();
  app.sql.prepare('INSERT INTO threads VALUES (?,?,?,?,?)').run(threadId,owner,'测试记录',created,created);
  app.sql.prepare('INSERT INTO turns VALUES (?,?,?,?,?,?)').run(turnId,threadId,owner,'私有原描述',
   JSON.stringify({summary:'测试记录摘要',candidates:[{scientificName}]}),created);
  return {threadId,turnId};
 }
 return {get app(){return app},dir,post,login,seed,restart(){app.close();app=createPlantId(options)},close:async()=>{app.close();await rm(dir,{recursive:true,force:true})}};
}

test('web questions require individual credentials and use the same public catalogue as the plugin',async()=>{
 let request;
 const f=await appFixture(async input=>{request=input;return {text:'可对比叶片和捕虫夹。',model:'deepseek-v4-flash',truncated:false}});
 const apiKey='sk-personal-key-in-test-1234';
 const body={apiKey,question:'捕蝇草怎么鉴别？',history:[{question:'第一问',answer:'第一答'}]};
 try{
  assert.equal((await f.post('api/ask',body)).status,401);
  const cookie=await f.login('answer_user');
  const other=await f.login('unrelated_user');
  const missing=await f.post('api/ask',body,{cookie});
  assert.equal(missing.status,400);
  assert.equal((await missing.json()).code,'ask_record_required');
  Object.assign(body,f.seed('answer_user','Dionaea corymbosa'));
  const foreign=await f.post('api/ask',body,{cookie:other});
  assert.equal(foreign.status,404);
  assert.equal((await foreign.json()).code,'ask_record_missing');
  assert.equal(request,undefined);
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
  assert.deepEqual(request.record,{summary:'测试记录摘要',candidates:['Dionaea corymbosa']});
  assert.equal((await f.post('api/ask',{...body,candidateIndex:12},{cookie})).status,400);
  assert.equal(request.knowledge[0].name,'Dionaea muscipula');
  assert.deepEqual(request.history,body.history);
  assert.doesNotMatch(JSON.stringify(result),/sk-personal|server-vision-key/);
  assert.equal(f.app.sql.prepare('SELECT count(*) n FROM turns').get().n,1);
  f.app.sql.prepare('DELETE FROM threads WHERE id=?').run(body.threadId);
  assert.equal((await f.post('api/ask',body,{cookie})).status,404);
 }finally{await f.close()}
});

test('remote plant agent supplies prompts and public read-only candidate lookup without an AI key',async()=>{
 const f=await appFixture();
 const rpc=(method,params,id=1)=>f.post('mcp',{jsonrpc:'2.0',method,params,id});
 try{
  const init=await(await rpc('initialize',{protocolVersion:'2025-06-18'})).json();
  assert.equal(init.result.protocolVersion,'2025-06-18');
  assert.deepEqual(init.result.capabilities,{tools:{},prompts:{}});
  assert.equal((await f.post('mcp',{jsonrpc:'2.0',method:'notifications/initialized'})).status,202);
  const list=await(await rpc('tools/list')).json();
  assert.deepEqual(list.result.tools.map(t=>t.name),['lookup_plant','plant_agent']);
  assert.ok(list.result.tools.every(t=>t.annotations.readOnlyHint&&!t.annotations.destructiveHint));
  const prompts=await(await rpc('prompts/list')).json();
  assert.deepEqual(prompts.result.prompts.map(p=>p.name),['identify_plant','plant_question']);
  const prompt=await(await rpc('prompts/get',{name:'identify_plant'})).json();
  assert.match(prompt.result.messages[0].content.text,/查看|照片/);
  assert.match(prompt.result.messages[0].content.text,/补拍/);
  const result=await(await rpc('tools/call',{name:'lookup_plant',arguments:{name:'月季'}})).json();
  assert.equal(result.result.structuredContent.entries[0].name,'Rosa chinensis');
  const run=async args=>(await(await rpc('tools/call',{name:'plant_agent',arguments:args})).json());
  const identification=await run({task:'identify',names:['月季','Dionaea corymbosa',' 月季 ']});
  assert.deepEqual(identification.result.structuredContent.candidates.map(it=>it.entries[0].name),['Rosa chinensis','Dionaea muscipula']);
  assert.match(identification.result.structuredContent.instructions,/不足/);
  const question=await run({task:'question'});
  assert.deepEqual(question.result.structuredContent.candidates,[]);
  assert.match(question.result.structuredContent.instructions,/一般养护经验/);
  for(const invalid of [{task:'write'},{task:'identify',names:null},{task:'identify',names:Array(5).fill('月季')},
   {task:'identify',names:['月季'],image:'private fixture'}]){
   assert.equal((await run(invalid)).error.code,-32602);
  }
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
  const question={...f.seed('gateway_user'),apiKey:'opaque123.example_Token',question:'怎么和相似的植物区分？'};
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
  Object.assign(body,f.seed('credential_owner'));
  const otherRecord=f.seed('another_owner');
  const session=async cookie=>await(await f.app.fetch(new Request(origin+'/plant-id/api/session',{headers:{Cookie:cookie}}))).json();
  const ask=(overrides={},c=cookie)=>f.post('api/ask',{...body,...overrides},{cookie:c});
  for(const response of [await ask(),await ask(otherRecord,other)]){
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
  assert.equal((await ask(otherRecord,other)).status,400);

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

test('the filing footer is added once for web pages and omitted by installed clients',async()=>{
 const f=await appFixture();
 try{
  for(const route of ['', 'history','apps']){
   const get=agent=>f.app.fetch(new Request(origin+'/plant-id/'+route,{headers:{'User-Agent':agent}}));
   const response=await get('Mozilla/5.0 Chrome/130');
   assert.equal(response.headers.get('Vary'),'User-Agent');
   const html=await response.text();
   assert.equal(html.split('蜀ICP备2026066760号').length,2);
   assert.match(html,/<footer class="site-filing">/);
   assert.doesNotMatch(html,/<\/body>/i);
   for(const agent of ['PlantIdClient/1','Electron/45.1.0','Mozilla/5.0 (Linux; Android 15; wv)']){
    const app=await(await get(agent)).text();
    assert.doesNotMatch(app,/蜀ICP备|<\/body>/i);
   }
  }
 }finally{await f.close()}
});

test('observations outlive recognition records and share only explicitly contributed material with the same species',async()=>{
 const calls=[];
 const f=await appFixture(async data=>{calls.push(data);return {text:'回答',model:'test',truncated:false}});
 try{
  const cookie=await f.login('care_owner'),other=await f.login('care_other');
  const record=f.seed('care_owner'),samePlant=f.seed('care_owner'),unrelated=f.seed('care_owner','Nepenthes alata');
  const otherPlant=f.seed('care_other'),otherSpecies=f.seed('care_other','Rosa multiflora');
  f.app.sql.prepare('UPDATE turns SET answer=? WHERE id=?').run(JSON.stringify({
   candidates:[{name:'月季',scientificName:'Rosa chinensis'},{name:'野蔷薇',scientificName:'Rosa multiflora'}],
  }),record.turnId);
  const request=(scope,{method='GET',note,share=false,id,session=cookie,source=origin}={})=>{
   const query=new URLSearchParams(scope);
   if(id)query.set('id',id);
   return f.app.fetch(new Request(origin+'/plant-id/api/ask/memory?'+query,{
    method,headers:{Cookie:session,Origin:source,'Content-Type':'application/json'},
    ...(method==='POST'?{body:JSON.stringify({note,share})}:{}),
   }));
  };
  const observation='东窗养护，换盆后用水苔栽培。';
  assert.equal((await request(record,{method:'POST',note:observation,session:other})).status,404);
  assert.equal((await request(record,{method:'POST',note:observation,source:'https://example.com'})).status,403);
  assert.equal((await request(record,{method:'POST',note:'x'.repeat(301)})).status,400);
  assert.equal((await request(record,{session:other})).status,404);
  const save=await request(record,{method:'POST',note:observation});
  assert.equal(save.status,200);
  const {notes:[saved],label}=await save.json();
  assert.equal(label,'月季');
  assert.equal(saved.note,observation);
  assert.equal((await (await request(record,{method:'POST',note:observation})).json()).notes.length,1);
  const secondDevice=await f.post('api/login',{username:'care_owner',password:'test-password'});
  assert.equal(secondDevice.status,200);
  const secondSession=secondDevice.headers.get('Set-Cookie').split(';')[0];
  assert.notEqual(secondSession,cookie);
  assert.equal((await (await request(record,{session:secondSession})).json()).notes[0].note,observation);
  assert.deepEqual((await (await request({...record,candidateIndex:1})).json()).notes,[]);
  assert.deepEqual((await (await request(unrelated)).json()).notes,[]);
  assert.equal((await (await request(samePlant)).json()).notes[0].id,saved.id);
  f.restart();
  assert.equal((await (await request(record)).json()).notes[0].id,saved.id);
  const ask=(scope,session=cookie)=>f.post('api/ask',{...scope,apiKey:'test-personal-care-key',question:'如何调整浇水？'},{cookie:session});
  assert.equal((await ask(record)).status,200);
  assert.deepEqual(calls.at(-1).observationNotes,[observation]);
  assert.equal((await ask({...record,candidateIndex:1})).status,200);
  assert.deepEqual(calls.at(-1).observationNotes,[]);
  assert.equal((await request(record,{method:'DELETE',id:saved.id,session:other})).status,404);
  assert.equal((await request(record,{method:'DELETE',id:saved.id})).status,200);
  assert.equal((await ask(record)).status,200);
  assert.deepEqual(calls.at(-1).observationNotes,[]);
  assert.equal((await request(record,{method:'POST',note:observation})).status,200);
  assert.equal((await ask(otherPlant,other)).status,200);
  assert.deepEqual(calls.at(-1).communityObservations,[]);
  const publish=await request(record,{method:'POST',note:observation,share:true});
  assert.equal(publish.status,200);
  const {notes:[contribution]}=await publish.json();
  assert.equal(contribution.shared,1);
  const deleteThread=await f.app.fetch(new Request(origin+'/plant-id/api/threads/'+record.threadId,{
   method:'DELETE',headers:{Cookie:cookie,Origin:origin},
  }));
  assert.equal(deleteThread.status,200);
  assert.equal((await request(record)).status,404);
  assert.equal((await ask(samePlant)).status,200);
  assert.deepEqual(calls.at(-1).observationNotes,[observation]);
  assert.equal((await ask(otherPlant,other)).status,200);
  assert.deepEqual(calls.at(-1).communityObservations,[observation]);
  assert.equal((await ask(otherSpecies,other)).status,200);
  assert.deepEqual(calls.at(-1).communityObservations,[]);
  const library=(session,method='GET')=>f.app.fetch(new Request(origin+'/plant-id/api/observation-library?id='+contribution.id,{
   method,headers:{Cookie:session,Origin:origin},
  }));
  assert.equal((await (await library(cookie)).json()).notes[0].id,contribution.id);
  assert.deepEqual((await (await library(other)).json()).notes,[]);
  assert.equal((await library(other,'DELETE')).status,404);
  assert.equal((await library(cookie,'DELETE')).status,200);
  assert.equal((await ask(otherPlant,other)).status,200);
  assert.deepEqual(calls.at(-1).communityObservations,[]);
 }finally{await f.close()}
});

test('legacy care notes migrate as private observations before history is pruned',async()=>{
 const f=await appFixture();
 try{
  const cookie=await f.login('legacy_observer'),record=f.seed('legacy_observer');
  const owner=f.app.sql.prepare('SELECT owner FROM threads WHERE id=?').get(record.threadId).owner;
  const id=randomUUID(),note='仅本人过去的观察';
  f.app.sql.prepare('INSERT INTO care_notes VALUES (?,?,?,?,?,?)').run(id,record.threadId,owner,'rosa chinensis',note,0);
  for(let index=0;index<10;index++)f.seed('legacy_observer');
  f.app.sql.prepare('UPDATE turns SET created=0 WHERE id=?').run(record.turnId);
  f.restart();
  assert.equal(f.app.sql.prepare('SELECT id FROM threads WHERE id=?').get(record.threadId),undefined);
  const read=()=>f.app.fetch(new Request(origin+'/plant-id/api/observation-library',{headers:{Cookie:cookie}}));
  const {notes}=await (await read()).json();
  assert.deepEqual(notes.map(({id,note,shared})=>({id,note,shared})),[{id,note,shared:0}]);
  const freshRecord=f.seed('legacy_observer');
  const freshId=randomUUID();
  f.app.sql.prepare('INSERT INTO care_notes VALUES (?,?,?,?,?,?)').run(freshId,freshRecord.threadId,owner,'rosa chinensis','可撤回的旧记忆',Date.now());
  f.restart();
  assert.equal((await (await read()).json()).notes.length,2);
  const remove=await f.app.fetch(new Request(origin+'/plant-id/api/observation-library?id='+freshId,{
   method:'DELETE',headers:{Cookie:cookie,Origin:origin},
  }));
  assert.equal(remove.status,200);
  f.restart();
  assert.deepEqual((await (await read()).json()).notes.map(item=>item.id),[id]);
 }finally{await f.close()}
});
