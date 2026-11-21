import http from 'node:http';
import {Readable} from 'node:stream';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,chmodSync,realpathSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {randomBytes,randomUUID,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {identify,recognizeText,modelConfiguration} from './model.mjs';
import {enrichIdentification,knowledgeContext,reviewPlantNames} from './knowledge.mjs';
import {createReferences} from './references.mjs';
import {createDshAnswer} from './dsh/ask.mjs';
import {knowledgeMcp,plantKnowledge} from './dsh/mcp.mjs';
const scrypt=promisify(scryptCallback),hash=value=>createHash('sha256').update(value).digest('hex'),base='/plant-id/';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const positive=(value,fallback)=>{const n=Number(value??fallback);if(!Number.isInteger(n)||n<1||n>100000)throw Error('识别限额配置无效');return n};
async function body(request,limit){const reader=request.body?.getReader();if(!reader)return new Uint8Array();let size=0,parts=[];try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw fail('提交内容过大，请减少照片或文字',413)}parts.push(value)}}finally{reader.releaseLock()}return Buffer.concat(parts)}
function imageMime(bytes){if(bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';if(bytes.length>12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';return null}
export function createPlantId({dataDirectory,origin='https://gloriouscarnivorousplants.top',env=process.env,fetchImpl=fetch,referenceFetch=fetch,now=Date.now,dshAnswer}={}){
 const site=new URL(origin);if(site.origin!==origin||!['https:','http:'].includes(site.protocol)||site.protocol==='http:'&&!['localhost','127.0.0.1'].includes(site.hostname))throw Error('应用来源必须是 HTTPS 域名');
 const config=modelConfiguration(env),concurrency=positive(env.PLANT_ID_CONCURRENCY,2),secure=site.protocol==='https:',cookieName=secure?'__Secure-plant_id_session':'plant_id_session',cookie=value=>`${cookieName}=${value}; Path=${base}; HttpOnly; SameSite=Strict; ${secure?'Secure; ':''}Max-Age=${value?604800:0}`;
 if(!dataDirectory)throw Error('请配置独立应用的数据目录');mkdirSync(dataDirectory,{recursive:true,mode:0o700});chmodSync(dataDirectory,0o700);
 const sql=new DatabaseSync(join(dataDirectory,'plant-id.sqlite'));sql.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,password TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS session_owner ON sessions(owner);
 CREATE TABLE IF NOT EXISTS threads(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,title TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS thread_owner ON threads(owner,updated);
 CREATE TABLE IF NOT EXISTS turns(id TEXT PRIMARY KEY,thread TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,description TEXT NOT NULL,answer TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS turn_thread ON turns(owner,thread,created);
`);chmodSync(join(dataDirectory,'plant-id.sqlite'),0o600);
 const active=new Set(),rates=new Map();let authJobs=0;
 function limit(key,max,span){let entry=rates.get(key);if(!entry||entry.until<=now())entry={count:0,until:now()+span};entry.count++;rates.delete(key);rates.set(key,entry);if(rates.size>2000)rates.delete(rates.keys().next().value);if(entry.count>max)throw fail('操作过于频繁，请稍后重试',429)}
 const references=createReferences(referenceFetch);
 const dshDirectory=env.PLANT_ID_DSH_RUNTIME||'/opt/plant-id/dsh-runtime';
 const askDsh=dshAnswer||createDshAnswer(dshDirectory);
 const dshAvailable=Boolean(dshAnswer)||existsSync(join(dshDirectory,'node_modules/@deepseek-ai/dsh-sdk-client/package.json'));
 let asking=false;
 const historyLimit=10;
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
 const files=new Map([['', ['index.html','text/html; charset=utf-8']],['app.js',['app.js','text/javascript; charset=utf-8']],['style.css',['style.css','text/css; charset=utf-8']],['icon.svg',['icon.svg','image/svg+xml']],['apps',['apps.html','text/html; charset=utf-8']],['ocr',['ocr.html','text/html; charset=utf-8']],['ocr.js',['ocr.js','text/javascript; charset=utf-8']],['ask.js',['ask.js','text/javascript; charset=utf-8']]]);
 async function route(request,{ip='local'}={}){
  const url=new URL(request.url);if(url.origin!==origin)return json({error:'请求来源无效'},403);
  if(url.pathname==='/plant-id')return new Response(null,{status:308,headers:{Location:base}});
  if(!url.pathname.startsWith(base))return json({error:'页面不存在'},404);
  const path=url.pathname.slice(base.length);
  if(request.method==='GET'&&files.has(path)){const [file,type]=files.get(path);return new Response(readFileSync(new URL('./public/'+file,import.meta.url)),{headers:{'Content-Type':type,'Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}})}
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
  if(path==='api/session'&&request.method==='GET'){const user=account(request);return json({user,configured:Boolean(config.key),model:config.model,provider:config.providerName,dshAvailable,historyLimit,registration:env.PLANT_ID_REGISTRATION!=='false'})}
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
    const {apiKey,question,plant='',history=[]}=input;
    if(typeof apiKey!=='string'||!/^sk-[A-Za-z0-9_-]{16,157}$/.test(apiKey.trim()))throw fail('请填写 DeepSeek 开放平台 API Key');
    if(typeof question!=='string'||!question.trim()||question.length>2000||typeof plant!=='string'||plant.length>120)throw fail('问题最多 2000 字，植物名称最多 120 字');
    if(!Array.isArray(history)||history.length>4||history.some(item=>!item||
     typeof item.question!=='string'||item.question.length>2000||typeof item.answer!=='string'||item.answer.length>3000))throw fail('问答上下文过长或格式无效');
    const knowledge=await plantKnowledge(plant);
    const mentioned=await reviewPlantNames({name:'',description:question,commonSearch:async()=>[]});
    for(const hint of mentioned){
     if(!hint.name||knowledge.length>=5||knowledge.some(item=>item.name===hint.name))continue;
     const [entry]=await plantKnowledge(hint.name);
     if(entry)knowledge.push(entry);
    }
    const result=await askDsh({apiKey:apiKey.trim(),question:question.trim(),plant:plant.trim(),
     history:history.map(({question,answer})=>({question,answer})),knowledge,signal:request.signal});
    if(account(request)?.id!==user.id)throw fail('登录已失效，请重新登录',401);
    const sources=knowledge.flatMap(entry=>[
     {title:entry.name+' · '+entry.sourceName,url:entry.source},
     ...(entry.traits?[{title:entry.traits.sourceName,url:entry.traits.source}]:[]),
    ]).filter((item,index,all)=>all.findIndex(other=>other.url===item.url)===index);
    return json({text:result.text,model:result.model,truncated:result.truncated,sources});
   }finally{asking=false}
  }
  if(path==='api/reference'&&request.method==='GET'){
   limit('reference:'+user.id,120,60000);
   const name=url.searchParams.get('name')||'',rank=url.searchParams.get('rank')||'';
   if(rank.length>80)throw fail('分类层级过长');
   try{return json(await references.lookup(name,rank,request.signal))}
   catch{throw fail('参考图暂时无法加载',503)}
  }
  const referenceImage=/^api\/reference-image\/(\d{1,16})$/.exec(path);
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
    const images=[];let total=0;for(const file of form.getAll('images')){if(typeof file==='string'||file.size>5*1024*1024||!file.size)throw fail('识别副本单张不能超过 5 MiB');const bytes=Buffer.from(await file.arrayBuffer()),mime=imageMime(bytes);if(!mime||mime!==file.type||(ocr||config.provider==='bigmodel')&&mime==='image/webp')throw fail(ocr?'请选择有效的 JPG 或 PNG 图片':'请选择有效的 JPG、PNG 或 WebP 图片');total+=bytes.length;images.push({bytes,mime})}
    if(ocr&&(images.length!==1||text||name||threadId))throw fail('文字识别每次需要一张照片');
    if(images.length>3||total>10*1024*1024)throw fail('每轮最多三张识别副本，合计不超过 10 MiB');if(!images.length&&!text.trim()&&!name.trim())throw fail('请上传照片，或填写植物名称与特征');
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
    const id=thread?.id||randomUUID(),created=now();sql.exec('BEGIN IMMEDIATE');try{if(thread){if(!sql.prepare('SELECT id FROM threads WHERE id=? AND owner=?').get(id,user.id))throw fail('记录已删除，未恢复记录',409)}else sql.prepare('INSERT INTO threads VALUES (?,?,?,?,?)').run(id,user.id,text.trim().slice(0,40)||'照片识别',created,created);sql.prepare('INSERT INTO turns VALUES (?,?,?,?,?,?)').run(randomUUID(),id,user.id,text,JSON.stringify(answer),created);sql.prepare('UPDATE threads SET updated=? WHERE id=? AND owner=?').run(created,id,user.id);pruneOwner.run(user.id,historyLimit);removeEmpty.run(user.id);refreshOwnerTitles.run(user.id);sql.exec('COMMIT')}catch(error){sql.exec('ROLLBACK');throw error}
    return json({threadId:id,answer:enrichIdentification(answer)});
   }finally{active.delete(user.id)}
  }
  return json({error:'接口不存在'},404);
 }
 return {sql,async fetch(request,options){try{return await route(request,options)}catch(error){return json({error:error.status?error.message:'服务暂时无法完成操作，请稍后重试'},error.status||500)}},close(){sql.close()}};
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
