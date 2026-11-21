import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm,readdir} from 'node:fs/promises';import os from 'node:os';
import {createPlantId,listen} from '../server.mjs';import {modelConfiguration,validateAnswer} from '../model.mjs';
const origin='https://gloriouscarnivorousplants.top',answer={summary:'可能是蒲公英属，需要核对叶片。',observations:{visible:['黄色头状花序'],described:[],uncertain:['叶片未拍清']},candidates:[{name:'蒲公英属',scientificName:'Taraxacum',rank:'属',probability:65,evidence:['黄色花序'],distinguish:['核对叶片和总苞']}],otherProbability:35,followUp:['补拍基生叶与总苞的近照']},image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=','base64');
async function fixture(overrides={}){const directory=await mkdtemp(os.tmpdir()+'/plant-id-test-'),calls=[],env={PLANT_ID_API_KEY:'test-only-not-a-real-key',...overrides.env};let time=Date.now();const app=createPlantId({dataDirectory:directory,origin,env,referenceFetch:overrides.referenceFetch,now:()=>time,fetchImpl:overrides.fetchImpl||(async(url,options)=>{calls.push({url,options,body:JSON.parse(options.body)});return Response.json({choices:[{message:{content:JSON.stringify(answer)}}]})})});const f={app,directory,calls,async request(path,{method='GET',cookie,body,headers={}}={}){return app.fetch(new Request(origin+'/plant-id/'+path,{method,headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...headers},...(body?{body}: {})}))},async register(name='first_user'){const r=await this.request('api/register',{method:'POST',body:JSON.stringify({username:name,password:'test-password-123'}),headers:{'Content-Type':'application/json'}});assert.equal(r.status,200);return {cookie:r.headers.get('Set-Cookie').split(';')[0],user:(await r.json()).user}},form({threadId='',text='在成都拍摄',images=[image],consent='yes'}={}){const form=new FormData();form.set('text',text);form.set('consent',consent);if(threadId)form.set('threadId',threadId);for(const bytes of images)form.append('images',new Blob([bytes],{type:'image/png'}),'leaf.png');return form},advance(ms){time+=ms},async close(){app.close();await rm(directory,{recursive:true,force:true})}};return f}
test('independent accounts, scoped sessions and separate history; actual image bytes reach the mainland vision endpoint',async()=>{const f=await fixture();try{const a=await f.register(),b=await f.register('second_user');const r=await f.request('api/identify',{method:'POST',cookie:a.cookie,body:f.form()});assert.equal(r.status,200);const data=await r.json();assert.equal(data.answer.candidates[0].name,'蒲公英属');assert.equal(data.remaining,undefined);assert.equal(f.calls[0].url,'https://open.bigmodel.cn/api/paas/v4/chat/completions');assert.equal(f.calls[0].body.model,'glm-4.6v-flash');assert.deepEqual(f.calls[0].body.messages[1].content[1].image_url,{url:'data:image/png;base64,'+image.toString('base64')});assert.equal(f.calls[0].body.thinking.type,'disabled');assert.deepEqual((await (await f.request('api/threads',{cookie:b.cookie})).json()).threads,[]);for(const method of ['GET','DELETE'])assert.equal((await f.request('api/threads/'+data.threadId,{method,cookie:b.cookie})).status,404);assert.equal((await f.request('api/threads',{cookie:'leaf_session=forged'})).status,401);assert.ok((await readdir(f.directory)).every(name=>name.startsWith('plant-id.sqlite')));const session=await f.request('api/session',{cookie:a.cookie});assert.equal((await session.json()).provider,'智谱开放平台');const logout=await f.request('api/logout',{method:'POST',cookie:a.cookie});assert.match(logout.headers.get('Set-Cookie'),/Path=\/plant-id\/; HttpOnly; SameSite=Strict; Secure/);assert.equal((await f.request('api/threads',{cookie:a.cookie})).status,401)}finally{await f.close()}});
test('follow-up uses only the selected owner history; deleting a thread does not delete another app or other accounts',async()=>{const f=await fixture();try{const a=await f.register(),b=await f.register('second_user');const data=await(await f.request('api/identify',{method:'POST',cookie:a.cookie,body:f.form()})).json();assert.equal((await f.request('api/identify',{method:'POST',cookie:b.cookie,body:f.form({threadId:data.threadId})})).status,404);const next=await f.request('api/identify',{method:'POST',cookie:a.cookie,body:f.form({threadId:data.threadId,text:'叶缘有锯齿',images:[]})});assert.equal(next.status,200);assert.match(f.calls[1].body.messages[1].content[0].text,/蒲公英属/);assert.equal(f.calls[1].body.messages[1].content.length,1);const turns=(await(await f.request('api/threads/'+data.threadId,{cookie:a.cookie})).json()).turns;assert.equal(turns.length,2);assert.equal((await f.request('api/threads/'+data.threadId,{method:'DELETE',cookie:a.cookie})).status,200);assert.equal(f.app.sql.prepare('SELECT count(*) n FROM turns').get().n,0);assert.equal(f.app.sql.prepare('SELECT count(*) n FROM users').get().n,2)}finally{await f.close()}});
test('origin, consent, malformed images and empty input fail before any paid request',async()=>{const f=await fixture();try{const a=await f.register();assert.equal((await f.request('api/identify',{method:'POST',cookie:a.cookie,body:f.form(),headers:{Origin:'https://other.example'}})).status,403);for(const form of [f.form({consent:'no'}),f.form({images:[Buffer.from('not an image')]}),f.form({images:[],text:''}),f.form({images:[image,image,image,image]})])assert.equal((await f.request('api/identify',{method:'POST',cookie:a.cookie,body:form})).status,400);assert.equal(f.calls.length,0)}finally{await f.close()}});
test('keeps only ten results per account across sessions; old daily limits never block calls',async()=>{
 const f=await fixture({env:{PLANT_ID_DAILY_LIMIT:'1',PLANT_ID_GLOBAL_DAILY_LIMIT:'1'}});
 try{
  const a=await f.register(),b=await f.register('second_user');
  const identify=(user,text,threadId)=>f.request('api/identify',{method:'POST',cookie:user.cookie,body:f.form({text,threadId})});
  const first=await(await identify(a,'最早旧记录')).json(),second=await(await identify(a,'会话旧标题')).json();
  assert.equal((await identify(b,'其他账号结果')).status,200);
  for(let index=0;index<10;index++)assert.equal((await identify(a,'新结果'+index,second.threadId)).status,200);
  assert.equal((await f.request('api/threads/'+first.threadId,{cookie:a.cookie})).status,404);
  const {thread,turns}=await(await f.request('api/threads/'+second.threadId,{cookie:a.cookie})).json();
  assert.equal(thread.title,'新结果0');
  assert.deepEqual(turns.map(turn=>turn.description),Array.from({length:10},(_,i)=>'新结果'+i));
  assert.equal(f.app.sql.prepare('SELECT count(*) n FROM turns WHERE owner=?').get(b.user.id).n,1);
  assert.equal(f.calls.length,13);
 }finally{await f.close()}
});
test('unconfigured service is explicit and cannot fabricate results or leak server keys',async()=>{const f=await fixture({env:{PLANT_ID_API_KEY:''}});try{const a=await f.register();assert.equal((await(await f.request('api/session',{cookie:a.cookie})).json()).configured,false);const r=await f.request('api/identify',{method:'POST',cookie:a.cookie,body:f.form()});assert.equal(r.status,503);assert.equal(f.calls.length,0);assert.equal(f.app.sql.prepare('SELECT count(*) n FROM threads').get().n,0);assert.equal((await f.request('persona.txt')).status,404);assert.equal((await f.request('server.mjs')).status,404)}finally{await f.close()}});
test('upstream errors are sanitized, invalid model output never becomes a history entry',async()=>{for(const type of ['authorization','bad-answer','transport']){const f=await fixture({fetchImpl:async()=>{if(type==='transport')throw Error('test-only-not-a-real-key');if(type==='authorization')return new Response('test-only-not-a-real-key',{status:401});return Response.json({choices:[{message:{content:'   '}}]})}});try{const a=await f.register(),r=await f.request('api/identify',{method:'POST',cookie:a.cookie,body:f.form()});assert.ok(r.status>=500);assert.ok(!(await r.text()).includes('test-only-not-a-real-key'));assert.equal(f.app.sql.prepare('SELECT count(*) n FROM threads').get().n,0)}finally{await f.close()}}});
test('in-flight concurrency limits and session revocation prevent late private writes',async()=>{let release;const f=await fixture({env:{PLANT_ID_CONCURRENCY:'1'},fetchImpl:()=>new Promise(resolve=>release=()=>resolve(Response.json({choices:[{message:{content:JSON.stringify(answer)}}]})))});try{const a=await f.register(),b=await f.register('second_user');const pending=f.request('api/identify',{method:'POST',cookie:a.cookie,body:f.form()});while(!release)await new Promise(resolve=>setImmediate(resolve));assert.equal((await f.request('api/identify',{method:'POST',cookie:b.cookie,body:f.form()})).status,429);await f.request('api/logout',{method:'POST',cookie:a.cookie});release();assert.equal((await pending).status,401);assert.equal(f.app.sql.prepare('SELECT count(*) n FROM threads').get().n,0)}finally{await f.close()}});
test('model configuration cannot send secrets to overseas, arbitrary or mismatched endpoints',()=>{for(const input of [{PLANT_ID_BASE_URL:'https://evil.example/api/paas/v4'},{PLANT_ID_BASE_URL:'https://open.bigmodel.cn@evil.example/api/paas/v4'},{PLANT_ID_BASE_URL:'http://open.bigmodel.cn/api/paas/v4'},{PLANT_ID_PROVIDER:'dashscope',PLANT_ID_BASE_URL:'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'},{PLANT_ID_MODEL:'glm-4-flash'},{PLANT_ID_MODEL:'glm-4v-flash'}])assert.throws(()=>modelConfiguration(input));const qwen=modelConfiguration({PLANT_ID_PROVIDER:'dashscope',PLANT_ID_BASE_URL:'https://workspace-test.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',DASHSCOPE_API_KEY:'test'});assert.equal(qwen.key,'test');assert.equal(qwen.providerName,'阿里云百炼');assert.throws(()=>validateAnswer({...answer,otherProbability:90}));assert.deepEqual(validateAnswer(answer),answer)});
test('native HTTP serves a CSP-protected independent page, registration and real multipart transport',async()=>{const f=await fixture(),server=listen(f.app,{origin,port:0});try{await new Promise(resolve=>server.once('listening',resolve));const url='http://127.0.0.1:'+server.address().port;const page=await fetch(url+'/plant-id/');assert.equal(page.status,200);assert.match(page.headers.get('Content-Security-Policy'),/script-src 'self'/);assert.match(await page.text(),/识植助手/);const r=await fetch(url+'/plant-id/api/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'http_user',password:'test-password-123'})});assert.equal(r.status,200);const cookie=r.headers.get('Set-Cookie').split(';')[0],result=await fetch(url+'/plant-id/api/identify',{method:'POST',headers:{Origin:origin,Cookie:cookie},body:f.form()});assert.equal(result.status,200);assert.equal((await result.json()).answer.otherProbability,35)}finally{await new Promise(resolve=>server.close(resolve));await f.close()}});
test('reopening prunes legacy histories and keeps sessions and recent results',async()=>{
 const f=await fixture();
 let reopened;
 try{
  const a=await f.register(),sql=f.app.sql;
  for(let index=0;index<13;index++){
   const id=crypto.randomUUID();
   sql.prepare('INSERT INTO threads VALUES (?,?,?,?,?)').run(id,a.user.id,'旧记录'+index,index,index);
   sql.prepare('INSERT INTO turns VALUES (?,?,?,?,?,?)').run(crypto.randomUUID(),id,a.user.id,'结果'+index,JSON.stringify(answer),index);
  }
  assert.ok(!sql.prepare('SELECT password FROM users').get().password.includes('test-password-123'));
  f.app.close();
  reopened=createPlantId({dataDirectory:f.directory,origin,env:{PLANT_ID_API_KEY:'test'}});
  const get=path=>reopened.fetch(new Request(origin+'/plant-id/api/'+path,{headers:{Cookie:a.cookie}}));
  const data=await(await get('session')).json();
  assert.equal(data.user.username,'first_user');
  assert.equal(data.historyLimit,10);
  const {threads}=await(await get('threads')).json();
  assert.deepEqual(threads.map(t=>t.title),Array.from({length:10},(_,i)=>'结果'+(12-i)));
  assert.equal(reopened.sql.prepare('SELECT count(*) n FROM turns').get().n,10);
 }finally{if(reopened)reopened.close();await rm(f.directory,{recursive:true,force:true})}
});
test('login checks passwords, registration can be disabled, and oversized bodies cannot invoke vision',async()=>{const f=await fixture();try{const a=await f.register();const wrong=await f.request('api/login',{method:'POST',body:JSON.stringify({username:'first_user',password:'wrong-password'})});assert.equal(wrong.status,401);const login=await f.request('api/login',{method:'POST',body:JSON.stringify({username:'first_user',password:'test-password-123'})});assert.equal(login.status,200);const large=new Uint8Array(11*1024*1024+1);assert.equal((await f.request('api/identify',{method:'POST',cookie:a.cookie,body:large,headers:{'Content-Type':'multipart/form-data; boundary=test'}})).status,413);assert.equal(f.calls.length,0)}finally{await f.close()}const disabled=await fixture({env:{PLANT_ID_REGISTRATION:'false'}});try{assert.equal((await disabled.request('api/register',{method:'POST',body:JSON.stringify({username:'blocked_user',password:'test-password-123'})})).status,403)}finally{await disabled.close()}});

test('OCR returns plain transcription, ignores old daily quotas and creates no plant history', async () => {
 const original = '捕蝇草 A-17\nDionaea muscipula';
 const calls = [];
 const f = await fixture({env:{PLANT_ID_DAILY_LIMIT:'1'},fetchImpl:async (url,options) => {
  calls.push({url,body:JSON.parse(options.body)});
  return Response.json({choices:[{finish_reason:'stop',message:{content:original}}]});
 }});
 try{
  const {cookie} = await f.register();
  const body = () => f.form({text:''});
  assert.equal((await f.request('ocr')).status,200);
  assert.equal((await f.request('ocr.js')).status,200);
  assert.equal((await f.request('api/ocr',{method:'POST',body:body()})).status,401);
  assert.equal((await f.request('api/ocr',{method:'POST',cookie,body:f.form({text:'',consent:'no'})})).status,400);
  assert.equal((await f.request('api/ocr',{method:'POST',cookie,body:f.form({text:'',images:[image,image]})})).status,400);
  const response = await f.request('api/ocr',{method:'POST',cookie,body:body()});
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{text:original,truncated:false});
  assert.equal(calls.length,1);
  assert.equal(calls[0].body.model,'glm-4.6v-flash');
  assert.equal(calls[0].body.messages[0].content[1].image_url.url,'data:image/png;base64,'+image.toString('base64'));
  assert.deepEqual((await (await f.request('api/threads',{cookie})).json()).threads,[]);
  assert.equal((await f.request('api/ocr',{method:'POST',cookie,body:body()})).status,200);
 }finally{await f.close()}
});

test('recognition accepts wrapped JSON, integer percent strings and omitted optional notes', async () => {
 const payload={
  summary:answer.summary,
  candidates:[{name:'蒲公英属',probability:'６５％',evidence:'黄色花序'}],
  otherProbability:'35%',
 };
 const f=await fixture({fetchImpl:async (_url,options)=>{
  const request=JSON.parse(options.body);
  assert.match(request.messages[0].content,/只输出一个简短的 JSON/);
  assert.doesNotMatch(request.messages[0].content,/\| 排名 \|/);
  return Response.json({choices:[{finish_reason:'stop',message:{content:'识别如下：\n```json\n'+JSON.stringify(payload)+'\n```'}}]});
 }});
 try{
  const {cookie}=await f.register();
  const response=await f.request('api/identify',{method:'POST',cookie,body:f.form()});
  assert.equal(response.status,200);
  const result=(await response.json()).answer;
  assert.equal(result.candidates[0].probability,65);
  assert.deepEqual(result.candidates[0].evidence,['黄色花序']);
  assert.deepEqual(result.followUp,[]);
  assert.equal(result.otherProbability,35);
 }finally{await f.close()}
});

test('readable replies use a transient plain text response when structured validation fails', async () => {
 const replies=[
  {finish_reason:'stop',message:{content:'可能是蒲公英属。请核对基生叶。<script>alert(1)</script>'}},
  {finish_reason:'length',message:{content:'{"summary":"可能是蒲公英属","candidates":['}},
  {finish_reason:'stop',message:{content:JSON.stringify({...answer,otherProbability:90})}},
  {finish_reason:'sensitive'},
 ];
 let calls=0;
 const f=await fixture({fetchImpl:async ()=>Response.json({choices:[replies[calls++]]})});
 try{
  const {cookie}=await f.register();
  for(const reply of replies.slice(0,3)){
   const response=await f.request('api/identify',{method:'POST',cookie,body:f.form()});
   assert.equal(response.status,200);
   assert.equal(response.headers.get('Cache-Control'),'private, no-store');
   assert.deepEqual(await response.json(),{
    fallback:{text:reply.message.content,truncated:reply.finish_reason==='length'},
   });
  }
  const blocked=await f.request('api/identify',{method:'POST',cookie,body:f.form()});
  assert.equal(blocked.status,502);
  assert.match((await blocked.json()).error,/未能处理本次内容/);
  assert.equal(calls,replies.length);
  assert.equal(f.app.sql.prepare('SELECT count(*) n FROM threads').get().n,0);
 }finally{await f.close()}
});

test('reference photos require exact plant taxon matches, suitable licenses and authenticated same-origin delivery',async()=>{
 const calls=[];
 const f=await fixture({referenceFetch:async (input,options)=>{
  const url=new URL(input);
  calls.push(url);
  assert.equal(options.redirect,'error');
  assert.equal(options.headers.Authorization,undefined);
  if(url.pathname.includes('autocomplete'))return Response.json({results:[
   {id:1,name:'Taraxacum officinale',iconic_taxon_name:'Plantae',rank:'species'},
   {id:42,name:'Taraxacum',iconic_taxon_name:'Plantae',rank:'genus'},
  ]});
  if(url.pathname==='/v1/observations'){
   assert.equal(url.searchParams.get('taxon_id'),'42');
   return Response.json({results:[{id:12,taxon:{id:1,name:'Taraxacum officinale',ancestor_ids:[42]},photos:[
    {id:7,license_code:'cc-by-nc',attribution:'A',url:'https://inaturalist-open-data.s3.amazonaws.com/photos/7/square.jpg'},
    {id:8,license_code:'cc-by',attribution:'B',url:'https://example.com/photos/8/square.png'},
    {id:9,license_code:'cc-by',attribution:'C',url:'https://inaturalist-open-data.s3.amazonaws.com/photos/9/square.png'},
   ]}]});
  }
  assert.equal(url.href,'https://inaturalist-open-data.s3.amazonaws.com/photos/9/medium.png');
  return new Response(image,{headers:{'Content-Type':'image/png'}});
 }});
 try{
  const {cookie}=await f.register(),lookup='api/reference?name=Taraxacum&rank='+encodeURIComponent('属');
  assert.equal((await f.request(lookup)).status,401);
  assert.equal((await f.request('api/reference-image/9',{cookie})).status,404);
  const {photo}=await(await f.request(lookup,{cookie})).json();
  assert.deepEqual(photo,{id:'9',scientificName:'Taraxacum officinale',attribution:'C',license:'CC BY',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',source:'https://www.inaturalist.org/observations/12'});
  assert.equal((await f.request('api/reference-image/8',{cookie})).status,404);
  const response=await f.request('api/reference-image/9',{cookie});
  assert.equal(response.headers.get('Content-Type'),'image/png');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),image);
  assert.deepEqual((await(await f.request('api/reference?name=Unknown',{cookie})).json()),{photo:null});
  assert.equal(calls.length,4);
 }finally{await f.close()}
});

test('local botanical knowledge grounds vision requests and annotates new and historical candidates',async()=>{
 const candidate={...answer.candidates[0],name:'捕蝇草',scientificName:'Dionaea corymbosa',rank:'种'};
 let context;
 const f=await fixture({fetchImpl:async (_url,options)=>{
  const request=JSON.parse(options.body);
  context=request.messages[0].content;
  assert.equal(request.messages[1].content[1].type,'image_url');
  return Response.json({choices:[{message:{content:JSON.stringify({...answer,candidates:[candidate]})}}]});
 }});
 try{
  const {cookie}=await f.register();
  const response=await f.request('api/identify',{method:'POST',cookie,body:f.form({text:'Dionaea muscipula？'})});
  assert.equal(response.status,200);
  assert.match(context,/Dionaea muscipula \/ species \/ Droseraceae/);
  assert.match(context,/触毛/);
  const data=await response.json();
  const entry=data.answer.candidates[0].knowledge;
  assert.equal(entry.source,'https://www.gbif.org/species/5421410');
  assert.equal(entry.family,'Droseraceae');
  assert.equal(entry.name,'Dionaea muscipula');
  assert.equal(entry.synonym,true);
  assert.deepEqual(new Set(entry.observations.map(row=>row.platform)),new Set(['iNaturalist','Pl@ntNet']));
  assert.equal(entry.traits.name,'Dionaea');
  assert.equal(data.answer.candidates[0].probability,candidate.probability);
  const history=await(await f.request('api/threads/'+data.threadId,{cookie})).json();
  assert.deepEqual(history.turns[0].answer.candidates[0].knowledge,entry);
  assert.ok(!f.app.sql.prepare('SELECT answer FROM turns').get().answer.includes('"knowledge"'));
 }finally{await f.close()}
});
