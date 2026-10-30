import {isAdmin,recordActivity,sessionAccount,accountSecurity} from './access.mjs';
import {randomBytes,randomUUID,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt),SESSION='__Host-leaf-session';
const hash=x=>createHash('sha256').update(x).digest('hex');
const noStore={'Cache-Control':'no-store','Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff'};
const validUsername=name=>/^[A-Za-z0-9_.-]{3,64}$/.test(name);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function passwordRecord(password,salt=randomBytes(32).toString('hex')){
 if(typeof password!=='string'||password.length<6||password.length>256)throw Error('密码应为 6 至 256 个字符');
 return {salt,password_hash:Buffer.from(await derive(password,salt,64)).toString('hex')};
}
export async function setAccount(sql,{username,password,owner,nickname=username}){
 if(!validUsername(username))throw Error('账号须为 3 至 64 位字母、数字、点、下划线或横线');
 if(typeof owner!=='string'||!owner||owner.length>512)throw Error('无效账号归属');
 const p=await passwordRecord(password);sql.exec('BEGIN IMMEDIATE');try{
  // Recheck after hashing, within the same transaction as the write.
  const existing=sql.prepare('SELECT username,owner FROM local_accounts WHERE username=? COLLATE NOCASE').get(username);
  if(existing&&existing.owner!==owner)throw Error('不能更改已有账号的数据归属');
  sql.prepare('INSERT INTO local_accounts VALUES (?,?,?,?,?) ON CONFLICT(username) DO UPDATE SET nickname=excluded.nickname,salt=excluded.salt,password_hash=excluded.password_hash').run(existing?.username||username,owner,nickname.slice(0,100),p.salt,p.password_hash);
  sql.prepare('DELETE FROM auth_sessions WHERE owner=?').run(owner);sql.exec('COMMIT');
 }catch(e){sql.exec('ROLLBACK');throw e}
}
function page(error='',{register=false,username='',status=200}={}){
 const title=register?'创建你的植物档案账号':'登录你的植物档案',route=register?'/auth/register':'/auth/local';
 return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${register?'注册':'登录'} · 植藏</title><style>body{font:16px system-ui;background:#f8f9f5;color:#244b39;margin:0}main{max-width:380px;margin:8vh auto;padding:28px}h1{font-size:28px}label{display:block;margin-top:20px}input,button{box-sizing:border-box;width:100%;padding:13px;border-radius:8px;font:inherit}input{border:1px solid #cdd7c8;margin-top:8px}button{border:0;background:#244b39;color:white;margin:24px 0 12px}p{line-height:1.7}.hint{font-size:14px;color:#687666}.error{color:#9f3428}a{color:inherit}.links{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}</style><main><p>植藏 · 植物档案</p><h1>${title}</h1>${register?'<p class="hint">注册后将创建属于你的空白收藏，记录自己的植物和照片。</p>':''}<form method="post" action="${route}"><label>账号<input name="username" autocomplete="username" minlength="3" maxlength="64" value="${escape(username)}" required></label>${register?'<p class="hint">三至六十四位，可用英文字母、数字、点、下划线和横线。账号不区分英文字母大小写。</p>':''}<label>密码<input type="password" name="password" autocomplete="${register?'new-password':'current-password'}" ${register?'minlength="6" ':''}maxlength="256" required></label>${register?'<p class="hint">至少六位。</p><label>再次输入密码<input type="password" name="confirmPassword" autocomplete="new-password" minlength="6" maxlength="256" required></label>':''}<p class="error" role="alert">${escape(error)}</p><button>${register?'注册并进入我的收藏':'登录'}</button></form><p class="links">${register?'<a href="/auth/local">已有账号，前往登录</a>':'<a href="/auth/register">注册新账号</a>'}<a href="/">返回首页</a></p></main></html>`,{status,headers:{...noStore,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
}
function sessionResponse(token,{admin=false,mustChange=false}={}){
 const headers=new Headers({...noStore,Location:mustChange?'/auth/change-password':admin?'/admin':'/'});headers.append('Set-Cookie',`${SESSION}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=604800`);headers.append('Set-Cookie','__Host-leaf-logged-out=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0');
 return new Response(null,{status:303,headers});
}
export function createLocalAuth(sql){
 const dummy={salt:randomBytes(32).toString('hex'),password_hash:randomBytes(64).toString('hex')};
 function attempt(keys,limit,now=Date.now()){
  sql.prepare('DELETE FROM local_login_limits WHERE expires<=?').run(now);
  if(keys.some(key=>(sql.prepare('SELECT attempts FROM local_login_limits WHERE key=?').get(key)?.attempts||0)>=limit))return false;
  for(const key of keys)sql.prepare('INSERT INTO local_login_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1').run(key,now+900000);
  return true;
 }
 const limited=message=>new Response(message,{status:429,headers:{...noStore,'Retry-After':'900'}});
 function saveSession(owner,nickname,token,now){
  sql.prepare('DELETE FROM auth_sessions WHERE expires<=?').run(now);
  sql.prepare('INSERT INTO auth_sessions VALUES (?,?,?,?)').run(hash(token),owner,nickname,now+7*86400000);
 }
 return async function login(request,ip='loopback'){
  const url=new URL(request.url);if(url.pathname==='/auth/change-password')return changePassword(request,sql,ip,attempt,saveSession);const register=url.pathname==='/auth/register';if(!register&&url.pathname!=='/auth/local')return null;
  if(request.method==='GET')return page('',{register});
  if(request.method!=='POST')return new Response(null,{status:405,headers:noStore});
  if(request.headers.get('Origin')!==url.origin)return new Response('请求来源无效',{status:403,headers:noStore});
  if(register&&!attempt(['register-ip:'+ip],10))return limited('注册尝试过多，请十五分钟后重试。');
  const text=await request.text();if(text.length>8192)return new Response('提交内容过长',{status:413,headers:noStore});
  const form=new URLSearchParams(text),username=(form.get('username')||'').trim(),password=form.get('password')||'';
  if(register){
   const error=message=>page(message,{register:true,username:username.slice(0,64),status:400});
   if(!validUsername(username))return error('账号须为三至六十四位字母、数字、点、下划线或横线。');
   if(password.length<6||password.length>256)return error('密码应为六至二百五十六个字符。');
   if(password!==(form.get('confirmPassword')||''))return error('两次输入的密码不一致。');
   const name=username.toLowerCase(),exists=()=>sql.prepare('SELECT username FROM local_accounts WHERE username=? COLLATE NOCASE').get(name);
   if(exists())return page('该账号已被使用，请换一个账号。',{register:true,username,status:409});
   const p=await passwordRecord(password),owner='local:'+randomUUID(),token=randomBytes(32).toString('hex'),now=Date.now();
   // Public registration is insert-only. Never use the administrator's account upsert.
   sql.exec('BEGIN IMMEDIATE');try{
    if(exists()){sql.exec('ROLLBACK');return page('该账号已被使用，请换一个账号。',{register:true,username,status:409})}
    sql.prepare('INSERT INTO local_accounts VALUES (?,?,?,?,?)').run(name,owner,username,p.salt,p.password_hash);
    saveSession(owner,username,token,now);recordActivity(sql,owner,{registered:true,login:true,now});sql.exec('COMMIT');
   }catch(e){sql.exec('ROLLBACK');throw e}
   return sessionResponse(token);
  }
  if(username.length>64||password.length>256)return page('账号或密码不正确。');
  const now=Date.now(),keys=['ip:'+ip,'account:'+username.toLowerCase()];
  if(!attempt(keys,8,now))return limited('登录尝试过多，请十五分钟后重试。');
  const row=sql.prepare('SELECT * FROM local_accounts WHERE username=? COLLATE NOCASE').get(username),record=row||dummy;
  const actual=Buffer.from(await derive(password,record.salt,64)),valid=timingSafeEqual(actual,Buffer.from(record.password_hash,'hex'));
  if(!row||!valid||accountSecurity(sql,row.owner).disabled)return page('账号或密码不正确。');
  const token=randomBytes(32).toString('hex');sql.exec('BEGIN IMMEDIATE');try{
   const fresh=sql.prepare('SELECT password_hash FROM local_accounts WHERE owner=?').get(row.owner);
   if(fresh?.password_hash!==row.password_hash||accountSecurity(sql,row.owner).disabled){sql.exec('ROLLBACK');return page('账号状态已改变，请重新登录。')}
   saveSession(row.owner,row.nickname,token,now);recordActivity(sql,row.owner,{login:true,now});
   for(const key of keys)sql.prepare('DELETE FROM local_login_limits WHERE key=?').run(key);sql.exec('COMMIT');
  }catch(e){sql.exec('ROLLBACK');throw e}
  return sessionResponse(token,{admin:isAdmin(sql,row.owner),mustChange:Boolean(accountSecurity(sql,row.owner).must_change)});
 };
}

function changePage(error='',status=200){
 return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>修改密码 · 植藏</title><style>body{font:16px system-ui;background:#f8f9f5;color:#244b39}main{max-width:380px;margin:8vh auto;padding:28px}label{display:block;margin-top:20px}input,button{box-sizing:border-box;width:100%;padding:13px;margin-top:8px;font:inherit;border:1px solid #cdd7c8;border-radius:8px}button{background:#244b39;color:white;margin-top:24px}p{line-height:1.7}.error{color:#9f3428}a{color:inherit}</style><main><h1>请先修改密码</h1><p>管理员重置了你的密码。请设置新的密码后继续使用网站，至少六位，不能使用默认密码。</p><form method="post" action="/auth/change-password"><label>当前密码<input name="currentPassword" type="password" autocomplete="current-password" maxlength="256" required></label><label>新密码<input name="password" type="password" autocomplete="new-password" minlength="6" maxlength="256" required></label><label>再次输入新密码<input name="confirmPassword" type="password" autocomplete="new-password" minlength="6" maxlength="256" required></label><p class="error" role="alert">${escape(error)}</p><button>修改密码并继续</button></form><p><a href="/auth/local">返回登录</a></p></main></html>`,{status,headers:{...noStore,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
}
async function changePassword(request,sql,ip,attempt,saveSession){
 const session=sessionAccount(sql,request),url=new URL(request.url);
 if(!session)return new Response(null,{status:303,headers:{...noStore,Location:'/auth/local'}});
 if(request.method==='GET')return changePage();
 if(request.method!=='POST')return new Response(null,{status:405,headers:noStore});
 if(request.headers.get('Origin')!==url.origin)return new Response('请求来源无效',{status:403,headers:noStore});
 if(!attempt(['change-ip:'+ip,'change-owner:'+session.owner],8))return changePage('尝试过多，请十五分钟后重试。',429);
 const text=await request.text();if(text.length>8192)return changePage('提交内容过长',413);
 const form=new URLSearchParams(text),password=form.get('password')||'',current=form.get('currentPassword')||'';
 if(password.length<6||password.length>256)return changePage('新密码应为六至二百五十六个字符。',400);
 if(password==='000000'||password===current)return changePage('请使用不同的新密码，不能使用默认密码。',400);
 if(password!==form.get('confirmPassword'))return changePage('两次输入的新密码不一致。',400);
 if(current.length>256)return changePage('当前密码不正确。',400);
 const row=sql.prepare('SELECT * FROM local_accounts WHERE owner=?').get(session.owner);
 if(!row||!timingSafeEqual(Buffer.from(await derive(current,row.salt,64)),Buffer.from(row.password_hash,'hex')))return changePage('当前密码不正确。',400);
 const p=await passwordRecord(password),token=randomBytes(32).toString('hex');
 sql.exec('BEGIN IMMEDIATE');try{
  const fresh=sql.prepare('SELECT password_hash FROM local_accounts WHERE owner=?').get(session.owner);
  if(!sessionAccount(sql,request)||fresh?.password_hash!==row.password_hash){sql.exec('ROLLBACK');return changePage('账号状态已改变，请重新登录。',409)}
  sql.prepare('UPDATE local_accounts SET salt=?,password_hash=? WHERE owner=?').run(p.salt,p.password_hash,session.owner);
  sql.prepare('UPDATE account_security SET must_change=0 WHERE owner=?').run(session.owner);
  sql.prepare('DELETE FROM auth_sessions WHERE owner=?').run(session.owner);
  saveSession(row.owner,row.nickname,token,Date.now());sql.exec('COMMIT');
 }catch(e){sql.exec('ROLLBACK');throw e}
 return sessionResponse(token,{admin:isAdmin(sql,row.owner)});
}
