import {randomBytes,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt),SESSION='__Host-leaf-session';
const hash=x=>createHash('sha256').update(x).digest('hex');
const noStore={'Cache-Control':'no-store','Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff'};
export async function passwordRecord(password,salt=randomBytes(32).toString('hex')){
 if(typeof password!=='string'||password.length<6||password.length>256)throw Error('密码应为 6 至 256 个字符');
 return {salt,password_hash:Buffer.from(await derive(password,salt,64)).toString('hex')};
}
export async function setAccount(sql,{username,password,owner,nickname=username}){
 if(!/^[A-Za-z0-9_.-]{3,64}$/.test(username))throw Error('账号须为 3 至 64 位字母、数字、点、下划线或横线');
 if(typeof owner!=='string'||!owner||owner.length>512)throw Error('无效账号归属');
 const existing=sql.prepare('SELECT owner FROM local_accounts WHERE username=?').get(username);
 if(existing&&existing.owner!==owner)throw Error('不能更改已有账号的数据归属');
 const p=await passwordRecord(password);sql.exec('BEGIN IMMEDIATE');try{
 sql.prepare('INSERT INTO local_accounts VALUES (?,?,?,?,?) ON CONFLICT(username) DO UPDATE SET nickname=excluded.nickname,salt=excluded.salt,password_hash=excluded.password_hash').run(username,owner,nickname.slice(0,100),p.salt,p.password_hash);
 sql.prepare('DELETE FROM auth_sessions WHERE owner=?').run(owner);sql.exec('COMMIT');
 }catch(e){sql.exec('ROLLBACK');throw e}
}
function page(error=''){
 return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登录 · 植藏</title><style>body{font:16px system-ui;background:#f8f9f5;color:#244b39;margin:0}main{max-width:360px;margin:12vh auto;padding:28px}h1{font-size:30px}label{display:block;margin-top:22px}input,button{box-sizing:border-box;width:100%;padding:13px;border-radius:8px;font:inherit}input{border:1px solid #cdd7c8;margin-top:8px}button{border:0;background:#244b39;color:white;margin:24px 0}p{line-height:1.7}a{color:inherit}</style><main><p>LEAF ARCHIVE</p><h1>登录你的植物档案</h1><form method="post" action="/auth/local"><label>账号<input name="username" autocomplete="username" maxlength="64" required></label><label>密码<input type="password" name="password" autocomplete="current-password" maxlength="256" required></label><p role="alert">${error}</p><button>登录</button></form><a href="/">返回首页</a></main></html>`,{headers:{...noStore,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
}
export function createLocalAuth(sql){
 const dummy={salt:randomBytes(32).toString('hex'),password_hash:randomBytes(64).toString('hex')};
 return async function login(request,ip='loopback'){
  const url=new URL(request.url);if(url.pathname!=='/auth/local')return null;
  if(request.method==='GET')return page();
  if(request.method!=='POST')return new Response(null,{status:405,headers:noStore});
  if(request.headers.get('Origin')!==url.origin)return new Response('请求来源无效',{status:403,headers:noStore});
  const form=new URLSearchParams(await request.text()),username=form.get('username')||'',password=form.get('password')||'';
  if(username.length>64||password.length>256)return page('账号或密码不正确。');
  const now=Date.now(),keys=['ip:'+ip,'account:'+username.toLowerCase()];sql.prepare('DELETE FROM local_login_limits WHERE expires<=?').run(now);
  if(keys.some(key=>(sql.prepare('SELECT attempts FROM local_login_limits WHERE key=?').get(key)?.attempts||0)>=8))return new Response('登录尝试过多，请 15 分钟后重试。',{status:429,headers:{...noStore,'Retry-After':'900'}});
  for(const key of keys)sql.prepare('INSERT INTO local_login_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1').run(key,now+900000);
  const row=sql.prepare('SELECT * FROM local_accounts WHERE username=?').get(username),record=row||dummy;
  const actual=Buffer.from(await derive(password,record.salt,64)),valid=timingSafeEqual(actual,Buffer.from(record.password_hash,'hex'));
  if(!row||!valid)return page('账号或密码不正确。');
  const token=randomBytes(32).toString('hex');sql.exec('BEGIN IMMEDIATE');try{
   sql.prepare('DELETE FROM auth_sessions WHERE expires<=?').run(now);
   sql.prepare('INSERT INTO auth_sessions VALUES (?,?,?,?)').run(hash(token),row.owner,row.nickname,now+7*86400000);
   for(const key of keys)sql.prepare('DELETE FROM local_login_limits WHERE key=?').run(key);sql.exec('COMMIT');
  }catch(e){sql.exec('ROLLBACK');throw e}
  const headers=new Headers({...noStore,Location:'/'});headers.append('Set-Cookie',`${SESSION}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=604800`);headers.append('Set-Cookie','__Host-leaf-logged-out=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0');
  return new Response(null,{status:303,headers});
 };
}
