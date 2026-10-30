import {readFileSync} from 'node:fs';
import {readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {isAdmin,dayInChina} from './access.mjs';
const page=readFileSync(new URL('./admin-page.html',import.meta.url),'utf8'),client=readFileSync(new URL('./admin-client.js',import.meta.url),'utf8');
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff'};
const json=(body,status=200)=>Response.json(body,{status,headers});
const number=(sql,query,...values)=>Number(sql.prepare(query).get(...values)?.n||0);
function pagination(url){const raw=Number(url.searchParams.get('page')||1),page=Number.isSafeInteger(raw)&&raw>0&&raw<=100000?raw:1;return {page,pageSize:30,offset:(page-1)*30};}
async function diskUsage(directory){
 let photos=0,database=0;
 for(const name of ['archive.sqlite','archive.sqlite-wal','archive.sqlite-shm'])try{database+=(await stat(path.join(directory,name))).size}catch(e){if(e.code!=='ENOENT')throw e}
 try{for(const item of await readdir(path.join(directory,'objects'),{withFileTypes:true}))if(item.isFile()&&/^[a-f0-9]{64}$/.test(item.name))photos+=(await stat(path.join(directory,'objects',item.name))).size}catch(e){if(e.code!=='ENOENT')throw e}
 return {photoBytes:photos,databaseBytes:database};
}
export async function adminRoutes(request,{sql,bucket,dataDirectory,session}){
 const url=new URL(request.url),route=url.pathname,isApi=route.startsWith('/api/admin/');
 if(route!=='/admin'&&!route.startsWith('/admin/')&&!isApi)return null;
 if(!session){return isApi?json({error:'请先登录管理员账号'},401):new Response(null,{status:303,headers:{...headers,Location:'/auth/local'}})}
 if(!isAdmin(sql,session.owner))return isApi?json({error:'仅管理员可以访问'},403):new Response('<!doctype html><meta charset="utf-8"><p>仅管理员可以访问此页面。</p><a href="/">返回我的收藏</a>',{status:403,headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
 if(request.method!=='GET'&&request.method!=='HEAD')return json({error:'此后台仅提供数据查看'},405);
 if(route==='/admin'||route==='/admin/')return new Response(request.method==='HEAD'?null:page,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"}});
 if(route==='/admin/app.js')return new Response(request.method==='HEAD'?null:client,{headers:{...headers,'Content-Type':'text/javascript; charset=utf-8'}});
 if(route==='/api/admin/stats'){
  const now=Date.now(),today=dayInChina(now),sevenDays=dayInChina(now-6*86400000),days=[],startedAt=sql.prepare('SELECT value FROM activity_meta WHERE key=?').get('started_at').value,startedDay=dayInChina(startedAt);
  for(let i=13;i>=0;i--){const day=dayInChina(now-i*86400000);days.push({day,users:day<startedDay?null:number(sql,'SELECT count(*) AS n FROM activity_days WHERE day=?',day)})}
  const users=number(sql,'SELECT count(*) AS n FROM local_accounts'),admins=number(sql,'SELECT count(*) AS n FROM local_admins');
  return json({users,administrators:admins,ordinaryUsers:users-admins,plants:number(sql,'SELECT count(*) AS n FROM plants'),images:number(sql,'SELECT count(*) AS n FROM images'),taxa:number(sql,'SELECT count(*) AS n FROM taxa'),activeToday:number(sql,'SELECT count(*) AS n FROM activity_days WHERE day=?',today),activeSevenDays:number(sql,'SELECT count(DISTINCT owner) AS n FROM activity_days WHERE day>=?',sevenDays),activeFiveMinutes:number(sql,'SELECT count(*) AS n FROM account_activity WHERE last_seen>=?',now-300000),trackingStartedAt:startedAt,days,storage:await diskUsage(dataDirectory)});
 }
 if(route==='/api/admin/users'){
  const {page,pageSize,offset}=pagination(url),q=(url.searchParams.get('q')||'').trim().slice(0,100),condition='instr(lower(a.username),lower(?))>0 OR instr(lower(a.nickname),lower(?))>0';
  const users=sql.prepare(`SELECT a.username,a.owner,a.nickname,CASE WHEN m.owner IS NULL THEN 'user' ELSE 'admin' END AS role,t.registered_at AS registeredAt,t.last_login AS lastLogin,t.last_seen AS lastSeen,
   (SELECT count(*) FROM plants p WHERE p.owner=a.owner) AS plantCount,(SELECT count(*) FROM images i WHERE i.owner=a.owner) AS imageCount,(SELECT count(*) FROM taxa x WHERE x.owner=a.owner) AS taxonCount
   FROM local_accounts a LEFT JOIN local_admins m ON m.owner=a.owner LEFT JOIN account_activity t ON t.owner=a.owner WHERE ${condition} ORDER BY a.username COLLATE NOCASE LIMIT ? OFFSET ?`).all(q,q,pageSize,offset);
  return json({users,total:number(sql,'SELECT count(*) AS n FROM local_accounts a WHERE '+condition,q,q),page,pageSize});
 }
 if(route==='/api/admin/plants'){
  const {page,pageSize,offset}=pagination(url),owner=(url.searchParams.get('owner')||'').slice(0,512),where=owner?' WHERE p.owner=?':'',args=owner?[owner]:[];
  const rows=sql.prepare('SELECT p.id,p.owner,p.number,p.created,p.data,a.username FROM plants p LEFT JOIN local_accounts a ON a.owner=p.owner'+where+' ORDER BY p.created DESC LIMIT ? OFFSET ?').all(...args,pageSize,offset);
  const plants=rows.map(row=>{const p=JSON.parse(row.data);return {id:row.id,owner:row.owner,username:row.username||'未绑定登录账号的历史归属',number:row.number,name:p.name||'',latin:p.latin||'',family:p.family||'',genus:p.genus||'',status:p.status||'',origin:p.origin||'',photoCount:p.photos?.length||0,created:row.created}});
  return json({plants,total:number(sql,'SELECT count(*) AS n FROM plants p'+where,...args),page,pageSize});
 }
 const detail=/^\/api\/admin\/plants\/([^/]+)$/.exec(route);
 if(detail){const row=sql.prepare('SELECT id,owner,data FROM plants WHERE id=?').get(decodeURIComponent(detail[1]));if(!row)return json({error:'档案不存在'},404);return json({...JSON.parse(row.data),id:row.id,owner:row.owner})}
 const image=/^\/api\/admin\/images\/([a-f0-9-]{36})$/.exec(route);
 if(image){const row=sql.prepare('SELECT owner,mime FROM images WHERE id=?').get(image[1]);if(!row)return json({error:'照片不存在'},404);const object=await bucket.get(row.owner+'/'+image[1]);if(!object)return json({error:'照片不存在'},404);return new Response(request.method==='HEAD'?null:object.body,{headers:{...headers,'Content-Type':row.mime}})}
 return json({error:'未找到此后台页面'},404);
}
