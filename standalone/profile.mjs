import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {isAdmin,sessionAccount} from './access.mjs';
import {cleanupDeletedObjects} from './account-deletion.mjs';
const page=readFileSync(new URL('./profile-page.html',import.meta.url),'utf8'),client=readFileSync(new URL('./profile-client.js',import.meta.url),'utf8');
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff'};
const json=(data,status=200)=>Response.json(data,{status,headers});
function summary(sql,owner){
 const rows=sql.prepare('SELECT data FROM plants WHERE owner=?').all(owner),families=new Map(),genera=new Set();let cents=0n,unpriced=0,invalidPrices=0;
 for(const row of rows){const p=JSON.parse(row.data),family=String(p.family||'').trim(),genus=String(p.genus||'').trim();
  const key=family||'未分类';if(!families.has(key))families.set(key,{family:key,count:0,genera:new Map()});const group=families.get(key);group.count++;if(genus){genera.add(genus);group.genera.set(genus,(group.genera.get(genus)||0)+1)}
  if(p.price===''||p.price==null){unpriced++;continue}
  const value=Number(p.price);if(!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER/100){invalidPrices++;continue}cents+=BigInt(Math.round(value*100));
 }
 return {plantCount:rows.length,familyCount:[...families.keys()].filter(x=>x!=='未分类').length,genusCount:genera.size,purchaseTotal:(cents/100n).toString()+'.'+(cents%100n).toString().padStart(2,'0'),unpriced,invalidPrices,classification:[...families.values()].map(g=>({...g,genera:[...g.genera].map(([name,count])=>({name,count}))})).sort((a,b)=>a.family.localeCompare(b.family,'zh-CN'))};
}
function profile(sql,owner,includeSummary=true){const row=sql.prepare('SELECT username,nickname FROM local_accounts WHERE owner=?').get(owner),p=sql.prepare('SELECT avatar_key FROM user_profiles WHERE owner=?').get(owner),admin=isAdmin(sql,owner);return {username:row.username,displayName:row.nickname,hasAvatar:Boolean(p?.avatar_key),isAdmin:admin,summary:admin||!includeSummary?null:summary(sql,owner)}}
export async function profileRoutes(request,{sql,bucket,session}){
 const url=new URL(request.url),route=url.pathname;
 if(route!=='/account'&&route!=='/account/'&&route!=='/api/profile'&&route!=='/api/profile/avatar'&&route!=='/profile-client.js')return null;
 if(!session)return route.startsWith('/api/')?json({error:'请先登录'},401):new Response(null,{status:303,headers:{...headers,Location:'/auth/local'}});
 if(!sql.prepare('SELECT owner FROM local_accounts WHERE owner=?').get(session.owner))return json({error:'账号不存在'},401);
 if(route==='/account'||route==='/account/')return request.method==='GET'||request.method==='HEAD'?new Response(request.method==='HEAD'?null:page,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' blob: data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}}):json({error:'不支持此操作'},405);
 if(route==='/profile-client.js')return new Response(client,{headers:{...headers,'Content-Type':'text/javascript; charset=utf-8'}});
 if(route==='/api/profile'&&request.method==='GET')return json(profile(sql,session.owner,url.searchParams.get('summary')!=='0'));
 if(route==='/api/profile/avatar'&&(request.method==='GET'||request.method==='HEAD')){
  const row=sql.prepare('SELECT avatar_key,avatar_mime FROM user_profiles WHERE owner=?').get(session.owner);if(!row?.avatar_key)return json({error:'尚未设置头像'},404);
  const object=await bucket.get(row.avatar_key);if(!object)return json({error:'头像不存在'},404);return new Response(request.method==='HEAD'?null:object.body,{headers:{...headers,'Content-Type':row.avatar_mime}});
 }
 if(request.headers.get('Origin')!==url.origin)return json({error:'请求来源无效'},403);
 if(route==='/api/profile'&&request.method==='PUT'){
  const text=await request.text();if(text.length>2048)return json({error:'资料内容过长'},413);let input;try{input=JSON.parse(text)}catch{return json({error:'资料格式无效'},400)}
  const name=typeof input?.displayName==='string'?input.displayName.trim().normalize('NFC'):'';if(!name||name.length>50||/[\u0000-\u001f\u007f]/.test(name))return json({error:'用户名应为一至五十个字符'},400);
  sql.exec('BEGIN IMMEDIATE');try{
   if(sessionAccount(sql,request)?.owner!==session.owner){sql.exec('ROLLBACK');return json({error:'登录已失效'},401)}
   sql.prepare('UPDATE local_accounts SET nickname=? WHERE owner=?').run(name,session.owner);sql.prepare('UPDATE auth_sessions SET nickname=? WHERE owner=?').run(name,session.owner);sql.exec('COMMIT');
  }catch(e){sql.exec('ROLLBACK');throw e}
  return json(profile(sql,session.owner));
 }
 if(route==='/api/profile/avatar'&&['POST','DELETE'].includes(request.method)){
  let key=null,mime=null;
  if(request.method==='POST'){
   const bytes=new Uint8Array(await request.arrayBuffer());if(!bytes.length||bytes.length>1024*1024)return json({error:'头像应小于一兆字节'},413);
   const png=[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b),jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,webp=Buffer.from(bytes.slice(0,4)).toString()==='RIFF'&&Buffer.from(bytes.slice(8,12)).toString()==='WEBP';
   mime=png?'image/png':jpg?'image/jpeg':webp?'image/webp':null;if(!mime)return json({error:'仅支持常见图片格式'},400);
   if(sessionAccount(sql,request)?.owner!==session.owner)return json({error:'登录已失效'},401);
   key=session.owner+'/avatar-'+randomUUID();await bucket.put(key,bytes);
  }
  sql.exec('BEGIN IMMEDIATE');try{
   if(sessionAccount(sql,request)?.owner!==session.owner){if(key)sql.prepare('INSERT OR IGNORE INTO object_deletions VALUES (?)').run(key);sql.exec('COMMIT');return json({error:'登录已失效'},401)}
   const old=sql.prepare('SELECT avatar_key FROM user_profiles WHERE owner=?').get(session.owner)?.avatar_key;
   sql.prepare('INSERT INTO user_profiles(owner,avatar_key,avatar_mime) VALUES (?,?,?) ON CONFLICT(owner) DO UPDATE SET avatar_key=excluded.avatar_key,avatar_mime=excluded.avatar_mime').run(session.owner,key,mime);
   if(old)sql.prepare('INSERT OR IGNORE INTO object_deletions VALUES (?)').run(old);sql.exec('COMMIT');
  }catch(e){sql.exec('ROLLBACK');if(key)sql.prepare('INSERT OR IGNORE INTO object_deletions VALUES (?)').run(key);throw e}
  await cleanupDeletedObjects(sql,bucket);return json(profile(sql,session.owner));
 }
 return json({error:'不支持此操作'},405);
}
