import http from 'node:http';
import {Readable} from 'node:stream';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,chmodSync,realpathSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {randomBytes,randomUUID,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {identify,recognizeText,modelConfiguration} from './model.mjs';
import {enrichIdentification,findKnowledge,knowledgeContext,reviewPlantNames} from './knowledge.mjs';
import {createReferences} from './references.mjs';
import {createObservations,observationSubject} from './observations.mjs';
import {createPlantSources,localFacts,localPhotos,localPhotoFiles} from './plant-sources.mjs';
import {createDshAnswer} from './dsh/ask.mjs';
import {createAskCredentials} from './dsh/credentials.mjs';
import {askProviderRegistry,publicAskProviders,routeForQuestion,validApiKey} from './dsh/providers.mjs';
import {knowledgeMcp,plantKnowledge} from './dsh/mcp.mjs';
const scrypt=promisify(scryptCallback),hash=value=>createHash('sha256').update(value).digest('hex'),base='/plant-id/';
const fail=(message,status=400,code)=>Object.assign(Error(message),{status,code});
const positive=(value,fallback)=>{const n=Number(value??fallback);if(!Number.isInteger(n)||n<1||n>100000)throw Error('识别限额配置无效');return n};
async function body(request,limit){const reader=request.body?.getReader();if(!reader)return new Uint8Array();let size=0,parts=[];try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw fail('提交内容过大，请减少照片或文字',413)}parts.push(value)}}finally{reader.releaseLock()}return Buffer.concat(parts)}
function imageMime(bytes){if(bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';if(bytes.length>12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';return null}
const filingFooter='<footer class="site-filing"><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">蜀ICP备2026066760号</a></footer>';
export function createPlantId({dataDirectory,origin='https://gloriouscarnivorousplants.top',env=process.env,fetchImpl=fetch,referenceFetch=fetch,now=Date.now,dshAnswer}={}){
 const site=new URL(origin);if(site.origin!==origin||!['https:','http:'].includes(site.protocol)||site.protocol==='http:'&&!['localhost','127.0.0.1'].includes(site.hostname))throw Error('应用来源必须是 HTTPS 域名');
 const config=modelConfiguration(env),concurrency=positive(env.PLANT_ID_CONCURRENCY,2),secure=site.protocol==='https:',cookieName=secure?'__Secure-plant_id_session':'plant_id_session',cookie=value=>`${cookieName}=${value}; Path=${base}; HttpOnly; SameSite=Strict; ${secure?'Secure; ':''}Max-Age=${value?604800:0}`;
 if(!dataDirectory)throw Error('请配置独立应用的数据目录');mkdirSync(dataDirectory,{recursive:true,mode:0o700});chmodSync(dataDirectory,0o700);
 const sql=new DatabaseSync(join(dataDirectory,'plant-id.sqlite'));sql.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,password TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS session_owner ON sessions(owner);
 CREATE TABLE IF NOT EXISTS ask_credentials(owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,provider TEXT NOT NULL,sealed BLOB NOT NULL,PRIMARY KEY(owner,provider));
 CREATE TABLE IF NOT EXISTS threads(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,title TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS thread_owner ON threads(owner,updated);
 CREATE TABLE IF NOT EXISTS turns(id TEXT PRIMARY KEY,thread TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,description TEXT NOT NULL,answer TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS turn_thread ON turns(owner,thread,created);
 CREATE TABLE IF NOT EXISTS care_notes(
  id TEXT PRIMARY KEY, thread TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, subject TEXT NOT NULL,
  note TEXT NOT NULL, created INTEGER NOT NULL
 );
 CREATE INDEX IF NOT EXISTS care_note_scope ON care_notes(thread,owner,subject,created);
 CREATE UNIQUE INDEX IF NOT EXISTS care_note_unique ON care_notes(thread,owner,subject,note);
`);chmodSync(join(dataDirectory,'plant-id.sqlite'),0o600);
 const active=new Set(),rates=new Map();let authJobs=0;
 function limit(key,max,span){let entry=rates.get(key);if(!entry||entry.until<=now())entry={count:0,until:now()+span};entry.count++;rates.delete(key);rates.set(key,entry);if(rates.size>2000)rates.delete(rates.keys().next().value);if(entry.count>max)throw fail('操作过于频繁，请稍后重试',429)}
 const references=createReferences(referenceFetch);
 const plantSources=createPlantSources(referenceFetch,sql,now);
 const dshDirectory=env.PLANT_ID_DSH_RUNTIME||'/opt/plant-id/dsh-runtime';
 const askDsh=dshAnswer||createDshAnswer(dshDirectory);
 const askProviders=askProviderRegistry(env);
 const askCredentials=createAskCredentials(sql,dataDirectory);
 const dshAvailable=Boolean(dshAnswer)||existsSync(join(dshDirectory,'node_modules/@deepseek-ai/dsh-sdk-client/package.json'));
 let asking=false;
 const historyLimit=10;
 const askTurn=sql.prepare(`SELECT id,answer FROM turns
  WHERE thread=? AND owner=? AND (? IS NULL OR id=?)
  ORDER BY created DESC,rowid DESC LIMIT 1`);
 const recordId=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
 const observations=createObservations(sql,now);
 function questionRecord(owner,{threadId,turnId=null,candidateIndex}){
  if(!recordId(threadId))throw fail('请先保存一条识别记录，再从记录中提问',400,'ask_record_required');
  if(turnId!==null&&!recordId(turnId))throw fail('识别结果无效',400,'ask_record_required');
  const saved=askTurn.get(threadId,owner,turnId,turnId);
  if(!saved)throw fail('这条识别记录已不存在，请从现有记录中提问',404,'ask_record_missing');
  const answer=JSON.parse(saved.answer);
  const candidates=Array.isArray(answer.candidates)?answer.candidates.slice(0,4):[];
  if(candidateIndex!==undefined&&(!Number.isInteger(candidateIndex)||!candidates[candidateIndex]))throw fail('这条记录中没有该候选植物');
  const name=candidate=>String(candidate?.scientificName||candidate?.name||'').trim().slice(0,120);
  const candidate=candidates[candidateIndex??0],plant=name(candidate);
  const subject=observationSubject(plant,typeof candidate?.rank==='string'?candidate.rank:'',String(candidate?.name||'').slice(0,120),threadId);
  const record={summary:String(answer.summary||'').slice(0,1000),candidates:candidates.map(name).filter(Boolean)};
  return {saved,plant,rank:typeof candidate?.rank==='string'?candidate.rank:'',subject,record};
 }
 const pruneOwner=sql.prepare('DELETE FROM turns WHERE rowid IN (SELECT rowid FROM turns WHERE owner=? ORDER BY created DESC,rowid DESC LIMIT -1 OFFSET ?)');
 const removeEmpty=sql.prepare('DELETE FROM threads WHERE owner=? AND NOT EXISTS (SELECT 1 FROM turns WHERE thread=threads.id)');
 const refreshTitle=`UPDATE threads SET title=(
  SELECT coalesce(nullif(substr(trim(description),1,40),''),'照片识别')
  FROM turns WHERE thread=threads.id ORDER BY created,rowid LIMIT 1
 )`;
 const refreshOwnerTitles=sql.prepare(refreshTitle+' WHERE owner=?');
 sql.exec('BEGIN IMMEDIATE');
 try{
  sql.prepare(`DELETE FROM turns WHERE rowid IN (
   SELECT entry FROM (
    SELECT rowid AS entry, row_number() OVER (PARTITION BY owner ORDER BY created DESC,rowid DESC) AS position
    FROM turns
   ) WHERE position>?
  )`).run(historyLimit);
  sql.exec('DELETE FROM threads WHERE NOT EXISTS (SELECT 1 FROM turns WHERE thread=threads.id)');
  sql.exec(refreshTitle);
  sql.exec('COMMIT');
 }catch(error){sql.exec('ROLLBACK');sql.close();throw error}
 function account(request){const raw=request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);if(!raw||!/^[a-f0-9]{64}$/.test(raw))return null;return sql.prepare('SELECT users.id,users.username FROM sessions JOIN users ON users.id=sessions.owner WHERE sessions.token=? AND sessions.expires>?').get(hash(raw),now())||null}
 const json=(value,status=200,extra={})=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...extra}});
 const files=new Map([['', ['index.html','text/html; charset=utf-8']],['app.js',['app.js','text/javascript; charset=utf-8']],['style.css',['style.css','text/css; charset=utf-8']],['icon.svg',['icon.svg','image/svg+xml']],['apps',['apps.html','text/html; charset=utf-8']],['history',['index.html','text/html; charset=utf-8']],['ask.js',['ask.js','text/javascript; charset=utf-8']]]);
 for(const file of localPhotoFiles)files.set(file,[file,'image/jpeg']);
 const publicResources=new Map();
 async function plantGallery(name,rank,signal,timeout=3500){
  const local=localPhotos(name);
  const deadline=AbortSignal.any([signal,AbortSignal.timeout(timeout)]);
  try{
   const result=await references.gallery(name,rank,deadline);
   const pictures=new Map();
   for(const photo of [...local,...result.photos]){
    const key=/^\d+$/.test(photo.id||'')?photo.id:decodeURIComponent(photo.source);
    if(!pictures.has(key))pictures.set(key,photo);
   }
   return {photos:[...pictures.values()].slice(0,4),reading:result.reading,unavailable:false};
  }catch{return {photos:local,unavailable:!local.length}}
 }
 function selectionFrom(params){
  return {threadId:params.get('threadId'),turnId:params.get('turnId'),
   candidateIndex:params.has('candidateIndex')?Number(params.get('candidateIndex')):undefined};
 }
 function uniqueSources(facts){
  return [...new Map(facts.map(({title,url})=>[url,{title,url}])).values()];
 }
 function publicResponse(request,path){
  const [file,type]=files.get(path),html=type.startsWith('text/html');
  const app=html&&(/\bPlantIdClient\/|\bElectron\/|; wv\)/.test(request.headers.get('User-Agent')||''));
  const key=path+(app?':client':'');
  let resource=publicResources.get(key);
  if(!resource){
   let content=readFileSync(new URL('./public/'+file,import.meta.url),type==='image/jpeg'?null:'utf8');
   if(app)content=content.replace('class="id-app"','class="id-app id-native"');
   if(path==='history'){
    content=content.replace('data-view="identify"','data-view="history"')
     .replace('<title>植物识别','<title>识别记录')
     .replaceAll('href="/plant-id/" aria-current="page"','href="/plant-id/"')
     .replaceAll('class="id-nav-item" href="/plant-id/history"','class="id-nav-item" href="/plant-id/history" aria-current="page"')
     .replace('id="history" class="history" hidden','id="history" class="history"')
     .replace('id="identify-view"','id="identify-view" hidden');
   }
   // Avoid a duplicate from proxies configured to insert text before </body>.
   if(html)content=content.replace(/<\/body>(?=\s*(?:<\/html>)?\s*$)/i,app?'':filingFooter);
   resource={content,etag:'"'+hash(content)+'"'};
   publicResources.set(key,resource);
  }
  const headers={'Content-Type':type,'Cache-Control':'no-cache','ETag':resource.etag,'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...(html?{Vary:'User-Agent'}:{})};
  const validators=(request.headers.get('If-None-Match')||'').split(',').map(value=>value.trim().replace(/^W\//,''));
  if(validators.includes('*')||validators.includes(resource.etag))return new Response(null,{status:304,headers});
  return new Response(request.method==='HEAD'?null:resource.content,{headers});
 }
 async function route(request,{ip='local'}={}){
  const url=new URL(request.url);if(url.origin!==origin)return json({error:'请求来源无效'},403);
  if(url.pathname==='/plant-id')return new Response(null,{status:308,headers:{Location:base}});
  if(!url.pathname.startsWith(base))return json({error:'页面不存在'},404);
  const path=url.pathname.slice(base.length);
  if(request.method==='GET'&&['ocr','ocr/','history/'].includes(path)){
   return new Response(null,{status:302,headers:{Location:path==='history/'?base+'history':base,'Cache-Control':'no-store'}});
  }
  if((request.method==='GET'||request.method==='HEAD')&&files.has(path))return publicResponse(request,path);
  if(request.method==='GET'&&path==='healthz')return json({status:'ok'});
  if(path==='mcp'){
   const caller=request.headers.get('Origin');
   if(caller&&caller!==origin)return json({error:'请求来源无效'},403);
   if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
   limit('mcp:'+ip,90,60000);
   let message;
   try{message=JSON.parse((await body(request,8192)).toString())}
   catch(error){if(error.status)throw error;return json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}},400)}
   return knowledgeMcp(message);
  }
  if(!path.startsWith('api/'))return json({error:'页面不存在'},404);
  if(!['GET','POST','DELETE'].includes(request.method))return json({error:'不支持此操作'},405);
  if(request.method!=='GET'&&request.headers.get('Origin')!==origin)return json({error:'请求来源无效'},403);
  if(path==='api/session'&&request.method==='GET'){const user=account(request);return json({user,configured:Boolean(config.key),model:config.model,provider:config.providerName,dshAvailable,askProviders:publicAskProviders(askProviders),savedAskProviders:user?askCredentials.list(user.id):[],historyLimit,registration:env.PLANT_ID_REGISTRATION!=='false'})}
  if(['api/login','api/register'].includes(path)&&request.method==='POST'){
   limit('auth:'+ip,25,15*60000);if(authJobs>=4)throw fail('登录服务繁忙，请稍后重试',429);
   let input;try{input=JSON.parse((await body(request,8192)).toString())}catch(error){if(error.status)throw error;throw fail('账号格式无效')}
   const username=typeof input.username==='string'?input.username.trim().toLowerCase():'',password=input.password;
   if(!/^[a-z0-9_]{3,32}$/.test(username)||typeof password!=='string'||password.length<6||password.length>256)throw fail('账号需为 3 至 32 位字母、数字或下划线，密码需为 6 至 256 个字符');
   authJobs++;try{
    let user=sql.prepare('SELECT * FROM users WHERE username=?').get(username);
    if(path==='api/register'){
     if(env.PLANT_ID_REGISTRATION==='false')throw fail('暂未开放注册',403);limit('register:'+ip,5,86400000);if(user)throw fail('该账号已注册',409);
     const salt=randomBytes(16).toString('hex'),derived=await scrypt(password,salt,64);user={id:randomUUID(),username};
     try{sql.prepare('INSERT INTO users VALUES (?,?,?,?)').run(user.id,username,salt+':'+derived.toString('hex'),now())}catch{throw fail('该账号已注册',409)}
    }else{const [salt,expected]=(user?.password||'missing:'+Buffer.alloc(64).toString('hex')).split(':'),derived=await scrypt(password,salt,64);if(!user||!timingSafeEqual(derived,Buffer.from(expected,'hex')))throw fail('账号或密码错误',401)}
    sql.prepare('DELETE FROM sessions WHERE expires<=?').run(now());const token=randomBytes(32).toString('hex');sql.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(token),user.id,now()+604800000);return json({user:{id:user.id,username}},200,{'Set-Cookie':cookie(token)});
   }finally{authJobs--}
  }
  const user=account(request);if(!user)return json({error:'请先登录识植助手，植藏账号不能用于此应用'},401);
  if(path==='api/logout'&&request.method==='POST'){const raw=request.headers.get('Cookie').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'=')).slice(cookieName.length+1);sql.prepare('DELETE FROM sessions WHERE token=?').run(hash(raw));return json({ok:true},200,{'Set-Cookie':cookie('')})}
  if(path==='api/threads'&&request.method==='GET'){return json({threads:sql.prepare('SELECT id,title,created,updated FROM threads WHERE owner=? ORDER BY updated DESC,id').all(user.id)})}
  const match=/^api\/threads\/([a-f0-9-]{36})$/.exec(path);
  if(match){const thread=sql.prepare('SELECT * FROM threads WHERE id=? AND owner=?').get(match[1],user.id);if(!thread)throw fail('记录不存在',404);if(request.method==='DELETE'){sql.prepare('DELETE FROM threads WHERE id=? AND owner=?').run(thread.id,user.id);return json({ok:true})}if(request.method==='GET')return json({thread,turns:sql.prepare('SELECT id,description,answer,created FROM turns WHERE thread=? AND owner=? ORDER BY created,rowid').all(thread.id,user.id).map(t=>({...t,answer:enrichIdentification(JSON.parse(t.answer))}))})}
  if(path==='api/observation-library'&&request.method!=='POST'){
   if(request.method==='DELETE'){
    const id=url.searchParams.get('id');
    if(!recordId(id))throw fail('观察记忆无效');
    if(!observations.remove(user.id,id))throw fail('观察记忆不存在',404);
   }
   return json({notes:observations.all(user.id)});
  }
  if(path==='api/ask/memory'){
   const params=url.searchParams;
   const selection=selectionFrom(params);
   let edit;
   if(request.method==='POST'){
    limit('observation:'+user.id,30,60000);
    try{edit=JSON.parse((await body(request,4096)).toString())}
    catch(error){if(error.status)throw error;throw fail('观察记忆格式无效')}
    if(account(request)?.id!==user.id)throw fail('登录已失效，请重新登录',401);
   }
   const {saved,subject}=questionRecord(user.id,selection);
   if(request.method==='POST'){
    const note=typeof edit?.note==='string'?edit.note.trim():'',share=edit?.share??false;
    if(!note||note.length>300||typeof share!=='boolean')throw fail('每条观察记忆需填写 1 至 300 个字符');
    if(share&&!subject.canShare)throw fail('请先核对植物学名，再贡献到共享资料库');
    if(!observations.save(user.id,subject,note,share))throw fail('观察记忆已达上限，请先删除一条',409);
   }
   if(request.method==='DELETE'){
    const id=params.get('id');
    if(!recordId(id))throw fail('观察记忆无效');
    if(!observations.remove(user.id,id,subject.key))throw fail('观察记忆不存在',404);
   }
   return json({label:subject.label,canShare:subject.canShare,turnId:saved.id,notes:observations.list(user.id,subject.key)});
  }
  if(path==='api/ask/images'&&request.method==='GET'){
   limit('ask-images:'+user.id,20,60000);
   const {saved,plant,rank,subject}=questionRecord(user.id,selectionFrom(url.searchParams));
   const matched=findKnowledge(plant,rank),name=matched?.name||plant;
   const gallery=await plantGallery(name,matched?.rank||rank,request.signal,5500);
   if(account(request)?.id!==user.id)throw fail('登录已失效，请重新登录',401);
   const threadId=url.searchParams.get('threadId');
   if(!askTurn.get(threadId,user.id,saved.id,saved.id))throw fail('这条识别记录已不存在',404,'ask_record_missing');
   const text=gallery.photos.length?'找到 '+gallery.photos.length+' 张「'+subject.label+'」的参考图片。':gallery.unavailable?
    '图片来源暂时无法访问，请稍后重试。':'本次没有查到学名匹配、可在站内展示的公开图片。';
   return json({text,images:gallery.photos});
  }
  if(path==='api/ask'&&request.method==='POST'){
   if(!dshAvailable)throw fail('植物问答的 DSH 运行时尚未安装，请联系管理员',503);
   if(asking)throw fail('植物问答正在处理另一请求，请稍后再试',429);
   limit('dsh-question:'+user.id,10,60000);
   asking=true;
   try{
    let input;
    try{input=JSON.parse((await body(request,48*1024)).toString())}
    catch(error){if(error.status)throw error;throw fail('问答提交格式无效')}
    if(!input||typeof input!=='object')throw fail('问答提交格式无效');
    const {apiKey:submittedKey,rememberKey=false,provider='deepseek',model='',question,threadId,turnId=null,candidateIndex,history=[]}=input;
    const {saved,plant,rank,record,subject}=questionRecord(user.id,{threadId,turnId,candidateIndex});
    if(submittedKey!==undefined&&!validApiKey(submittedKey)||typeof rememberKey!=='boolean')throw fail('请填写所选平台的 API Key');
    if(['baseURL','endpoint','url'].some(field=>Object.hasOwn(input,field)))throw fail('请选择站点已配置的服务商');
    const route=routeForQuestion(askProviders,provider,model);
    if(!route)throw fail('请选择受支持的服务商和模型');
    if(typeof question!=='string'||!question.trim()||question.length>2000)throw fail('问题最多 2000 字');
    if(!Array.isArray(history)||history.length>4||history.some(item=>!item||
     typeof item.question!=='string'||item.question.length>2000||typeof item.answer!=='string'||item.answer.length>3000))throw fail('问答上下文过长或格式无效');
    const sealed=submittedKey===undefined?askCredentials.find(user.id,route):null;
    let apiKey=submittedKey?.trim();
    if(sealed){
     try{apiKey=askCredentials.open(user.id,route,sealed)}
     catch{
      throw fail('已保存的 API Key 无法读取，请重新填写',422,'ask_key_invalid');
     }
    }
    if(!apiKey)throw fail('请先填写所选平台的 API Key',400,'ask_key_required');
    const knowledge=await plantKnowledge(plant);
    const matched=findKnowledge(plant,rank);
    const taxonomyName=matched?.name||plant;
    const [fresh,gallery]=await Promise.all([
     plantSources(taxonomyName,request.signal),
     plantGallery(taxonomyName,matched?.rank||rank,request.signal),
    ]);
    const specific=localFacts(taxonomyName);
    const evidence=[...specific,...fresh.filter(item=>!specific.some(fact=>fact.kind===item.kind))];
    if(gallery.reading)evidence.push({kind:'overview',title:'维基百科 · 物种条目',url:gallery.reading.url,text:gallery.reading.text});
    const focus=/^(这个的外表|这株植物的外表)[？?。]?$/.test(question.trim())?'appearance':
     /^(这个的得名由来|这株植物的得名由来)[？?。]?$/.test(question.trim())?'etymology':'';
    const verified=evidence.find(item=>item.kind===focus);
    const mentioned=await reviewPlantNames({name:'',description:question,commonSearch:async()=>[]});
    for(const hint of mentioned){
     if(!hint.name||knowledge.length>=5||knowledge.some(item=>item.name===hint.name))continue;
     const [entry]=await plantKnowledge(hint.name);
     if(entry)knowledge.push(entry);
    }
    let result;
    try{
     result=verified?{text:verified.text,model:null,truncated:false}:await askDsh({apiKey,route,question:question.trim(),plant,record,
      history:history.map(({question,answer})=>({question,answer})),knowledge,observationNotes:observations.list(user.id,subject.key).slice(0,12).map(item=>item.note),
      communityObservations:observations.shared(user.id,subject),evidence,signal:request.signal});
    }catch(error){
     if(error.code==='ask_key_invalid'&&sealed)askCredentials.remove(user.id,route,sealed);
     throw error;
    }
    if(account(request)?.id!==user.id)throw fail('登录已失效，请重新登录',401);
    if(!askTurn.get(threadId,user.id,saved.id,saved.id))throw fail('这条识别记录已不存在，请从现有记录中提问',404,'ask_record_missing');
    if(!verified&&rememberKey&&submittedKey!==undefined&&!request.signal.aborted)askCredentials.save(user.id,route,apiKey);
    const sources=uniqueSources([...evidence,...knowledge.flatMap(entry=>[
     {title:entry.name+' · '+entry.sourceName,url:entry.source},
     ...(entry.traits?[{title:entry.traits.sourceName,url:entry.traits.source}]:[]),
    ])]);
    const denial=/^(?:抱歉[，。\s]*)?(?:(?:目前|本次|暂时|我)\s*){0,3}(?:没有|未能|未|没能)(?:查到|找到|检索到|获取到)(?:该植物|这种植物|这株植物)?(?:的)?(?:任何)?(?:相关)?资料(?:[，。；：\s]|$)/;
    const genericDenial=denial.test(result.text);
    const text=!genericDenial?result.text:evidence.length?
     '本次核对到的资料：\n'+evidence.map(item=>item.title+'：'+item.text).join('\n'):knowledge.length?
     '本次核对到的名录记录：'+knowledge.map(item=>item.name+(item.family?'（'+item.family+'）':'')).join('、')+'。专题资料仍待核对。':
     '本次未找到可核对的物种资料。';
    return json({text,model:result.model,provider:route.label,truncated:!genericDenial&&result.truncated,
     savedKey:Boolean(sealed||!verified&&rememberKey&&submittedKey!==undefined),sources,
     ...(focus==='appearance'?{images:gallery.photos}:{})});
   }finally{asking=false}
  }
  if(path==='api/reference'&&request.method==='GET'){
   limit('reference:'+user.id,120,60000);
   const name=url.searchParams.get('name')||'',rank=url.searchParams.get('rank')||'';
   if(rank.length>80)throw fail('分类层级过长');
   try{return json(await references.lookup(name,rank,request.signal))}
   catch{throw fail('参考图暂时无法加载',503)}
  }
  const referenceImage=/^api\/reference-image\/((?:wm-)?\d{1,16})$/.exec(path);
  if(referenceImage&&request.method==='GET'){
   limit('reference-image:'+user.id,120,60000);
   try{
    const photo=await references.image(referenceImage[1],request.signal);
    if(!photo)return json({error:'参考图不可用'},404);
    return new Response(photo.bytes,{headers:{'Content-Type':photo.type,'Cache-Control':'private, max-age=600','X-Content-Type-Options':'nosniff'}});
   }catch{throw fail('参考图暂时无法加载',503)}
  }
  if((path==='api/identify'||path==='api/ocr')&&request.method==='POST'){
   const ocr=path==='api/ocr';
   if(!config.key)throw fail('识别服务尚未配置，请联系网站管理员开通视觉模型',503);
   if(active.has(user.id)||active.size>=concurrency)throw fail('识别服务忙，请等待当前识别完成',429);
   active.add(user.id);try{
    const raw=await body(request,(ocr?6:11)*1024*1024);let form;try{form=await new Response(raw,{headers:{'Content-Type':request.headers.get('Content-Type')||''}}).formData()}catch{throw fail('照片提交格式无效')}
    const text=form.get('text')||'',name=form.get('plantName')||'',threadId=form.get('threadId')||'';if(typeof name!=='string'||name.length>120||typeof text!=='string'||text.length>6000||typeof threadId!=='string'||threadId&&!/^[a-f0-9-]{36}$/.test(threadId))throw fail('文字或记录格式无效');
    if(form.get('consent')!=='yes')throw fail('请先同意将本轮照片和描述发送给视觉模型');
    const photos=form.getAll('images');
    if(photos.length>3)throw fail('每轮最多三张识别副本，合计不超过 10 MiB');
    let total=0;
    for(const photo of photos){
     if(typeof photo==='string'||photo.size>5*1024*1024||!photo.size)throw fail('识别副本单张不能超过 5 MiB');
     total+=photo.size;
    }
    if(total>10*1024*1024)throw fail('每轮最多三张识别副本，合计不超过 10 MiB');
    if(ocr&&(photos.length!==1||text||name||threadId))throw fail('文字识别每次需要一张照片');
    if(!photos.length&&!text.trim()&&!name.trim())throw fail('请上传照片，或填写植物名称与特征');
    const images=[];
    for(const photo of photos){
     const bytes=Buffer.from(await photo.arrayBuffer()),mime=imageMime(bytes);
     if(!mime||mime!==photo.type||(ocr||config.provider==='bigmodel')&&mime==='image/webp')throw fail(ocr?'请选择有效的 JPG 或 PNG 图片':'请选择有效的 JPG、PNG 或 WebP 图片');
     images.push({bytes,mime});
    }
    const thread=threadId?sql.prepare('SELECT * FROM threads WHERE id=? AND owner=?').get(threadId,user.id):null;if(threadId&&!thread)throw fail('记录不存在',404);
    const previous=thread?JSON.parse(sql.prepare('SELECT answer FROM turns WHERE thread=? AND owner=? ORDER BY created DESC,rowid DESC LIMIT 1').get(threadId,user.id)?.answer||'null'):null;
    if(ocr){
     const result=await recognizeText({config,image:images[0],signal:request.signal,fetchImpl});
     if(account(request)?.id!==user.id)throw fail('登录已失效，请重新登录',401);
     return json(result);
    }
    const nameReview=await reviewPlantNames({name,description:text,previous,commonSearch:references.commonNames,signal:request.signal});
    const textWithoutLabel=text.trim().replace(/^(?:学名|名称)[：:]\s*/,'').replace(/[？?。]$/,'').trim();
    const nameOnly=!images.length&&!previous&&(Boolean(name.trim()&&!textWithoutLabel)||
     nameReview.some(review=>review.input===textWithoutLabel&&Boolean(textWithoutLabel)));
    const answer=await identify({config,images,text,plantName:name,nameOnly,previous,knowledge:knowledgeContext(text,previous,nameReview),signal:request.signal,fetchImpl});
    if(account(request)?.id!==user.id)throw fail('登录已失效，请重新登录',401);
    if(answer.fallback)return json({fallback:answer.fallback,...(nameReview.length?{nameReview}:{})});
    if(nameReview.length)answer.nameReview=nameReview;
    const id=thread?.id||randomUUID(),turnId=randomUUID(),created=now();sql.exec('BEGIN IMMEDIATE');try{if(thread){if(!sql.prepare('SELECT id FROM threads WHERE id=? AND owner=?').get(id,user.id))throw fail('记录已删除，未恢复记录',409)}else sql.prepare('INSERT INTO threads VALUES (?,?,?,?,?)').run(id,user.id,text.trim().slice(0,40)||'照片识别',created,created);sql.prepare('INSERT INTO turns VALUES (?,?,?,?,?,?)').run(turnId,id,user.id,text,JSON.stringify(answer),created);sql.prepare('UPDATE threads SET updated=? WHERE id=? AND owner=?').run(created,id,user.id);pruneOwner.run(user.id,historyLimit);removeEmpty.run(user.id);refreshOwnerTitles.run(user.id);sql.exec('COMMIT')}catch(error){sql.exec('ROLLBACK');throw error}
    return json({threadId:id,turnId,answer:enrichIdentification(answer)});
   }finally{active.delete(user.id)}
  }
  return json({error:'接口不存在'},404);
 }
 return {sql,async fetch(request,options){try{return await route(request,options)}catch(error){return json({error:error.status?error.message:'服务暂时无法完成操作，请稍后重试',...(error.status&&error.code?{code:error.code}:{})},error.status||500)}},close(){sql.close()}};
}
export function listen(app,{origin,port=3110,host='127.0.0.1'}={}){
 const server=http.createServer(async(req,res)=>{const abort=new AbortController();res.on('close',()=>{if(!res.writableEnded)abort.abort()});try{const request=new Request(new URL(req.url,origin),{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{}),signal:abort.signal});const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);const response=await app.fetch(request,{ip:local?(req.headers['x-real-ip']||req.socket.remoteAddress):req.socket.remoteAddress});res.writeHead(response.status,Object.fromEntries(response.headers));if(response.body)Readable.fromWeb(response.body).pipe(res);else res.end()}catch{res.writeHead(500);res.end('请求失败')}});server.requestTimeout=120000;server.headersTimeout=15000;server.listen(port,host);return server;
}
// Node resolves the release symlink in import.meta.url, but retains it in argv.
function isEntryPoint(){
 const entry=process.argv[1];
 if(!entry)return false;
 try{return realpathSync(entry)===fileURLToPath(import.meta.url)}
 catch(error){if(error.code==='ENOENT')return false;throw error}
}

if(isEntryPoint()){
 const origin=process.env.PLANT_ID_ORIGIN||'https://gloriouscarnivorousplants.top';
 const app=createPlantId({origin,dataDirectory:process.env.PLANT_ID_DATA_DIR||'/var/lib/plant-id'});
 const server=listen(app,{origin,port:Number(process.env.PLANT_ID_PORT||3110)});
 server.on('listening',()=>console.log('识植助手已在本机端口 '+server.address().port+' 启动'));
 for(const name of ['SIGTERM','SIGINT']){
  process.on(name,()=>server.close(()=>{app.close();process.exit(0)}));
 }
}
