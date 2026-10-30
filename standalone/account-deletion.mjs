import {isAdmin,sessionAccount} from './access.mjs';
import {verifyPassword} from './local-auth.mjs';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff'};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function cleanupDeletedObjects(sql,bucket){
 for(const {key} of sql.prepare('SELECT key FROM object_deletions LIMIT 500').all()){
  if(bucket.isWriting?.(key))continue;
  try{await bucket.delete(key);sql.prepare('DELETE FROM object_deletions WHERE key=?').run(key);sql.prepare('DELETE FROM account_objects WHERE key=?').run(key)}catch{ /* 保留任务，后台自动重试。 */ }
 }
 return Number(sql.prepare('SELECT count(*) AS n FROM object_deletions').get().n);
}
// 调用者必须在同一事务内先验证操作者和目标账号。
export function eraseAccount(sql,{owner,actor,action}){
 if(isAdmin(sql,owner))throw Error('不能注销管理员账号');
 sql.prepare('INSERT OR IGNORE INTO deleted_owners(owner,deleted_at) VALUES (?,?)').run(owner,Date.now());
 for(const {id} of sql.prepare('SELECT id FROM images WHERE owner=?').all(owner))sql.prepare('INSERT OR IGNORE INTO object_deletions(key) VALUES (?)').run(owner+'/'+id);
 sql.prepare('INSERT OR IGNORE INTO object_deletions(key) SELECT key FROM account_objects WHERE owner=?').run(owner);
 for(const table of ['plants','taxa','images','auth_sessions','wechat_identities','account_activity','activity_days'])sql.prepare(`DELETE FROM ${table} WHERE owner=?`).run(owner);
 const username=sql.prepare('SELECT username FROM local_accounts WHERE owner=?').get(owner)?.username;
 for(const key of ['change-owner:'+owner,'delete-owner:'+owner,...(username?['account:'+username.toLowerCase()]:[])])sql.prepare('DELETE FROM local_login_limits WHERE key=?').run(key);
 sql.prepare('DELETE FROM local_accounts WHERE owner=?').run(owner);
 sql.prepare('INSERT INTO admin_audit(actor,target,action,created) VALUES (?,?,?,?)').run(actor,owner,action,Date.now());
}
function page(username,error='',status=200){return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>注销账号 · 植藏</title><style>body{font:16px system-ui;background:#f8f9f5;color:#244b39}main{max-width:440px;margin:6vh auto;padding:24px}p{line-height:1.8}label{display:block;margin:18px 0}input,button{box-sizing:border-box;width:100%;font:inherit;padding:12px;border:1px solid #ccd7c8;border-radius:8px}button{background:#9f3428;color:white}a{color:inherit}.error{color:#9f3428}</style><main><h1>注销账号并删除数据</h1><p>当前账号：<strong>${escape(username)}</strong></p><p>注销后，该账号的全部植物档案、生长记录、分类、产地坐标和照片将被删除，所有登录立即失效。删除无法在网站内恢复。</p><form method="post" action="/account/delete"><label>当前密码<input name="password" type="password" autocomplete="current-password" maxlength="256" required></label><label>输入当前账号以确认<input name="username" autocomplete="off" maxlength="64" required></label><label>输入“确认注销”<input name="confirmation" autocomplete="off" required></label><p class="error" role="alert">${escape(error)}</p><button>永久注销账号并删除全部数据</button></form><p><a href="/">取消，返回我的收藏</a></p></main></html>`,{status,headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}})}
export async function accountDeletionRoutes(request,{sql,bucket,session}){
 if(new URL(request.url).pathname!=='/account/delete')return null;
 if(!session)return new Response(null,{status:303,headers:{...headers,Location:'/auth/local'}});
 if(isAdmin(sql,session.owner))return new Response('管理员账号不能自行注销',{status:403,headers});
 const row=sql.prepare('SELECT * FROM local_accounts WHERE owner=?').get(session.owner);if(!row)return new Response(null,{status:303,headers:{...headers,Location:'/auth/local'}});
 if(request.method==='GET')return page(row.username);
 if(request.method!=='POST')return new Response(null,{status:405,headers});
 if(request.headers.get('Origin')!==new URL(request.url).origin)return new Response('请求来源无效',{status:403,headers});
 const text=await request.text();if(text.length>2048)return page(row.username,'提交内容过长',413);
 const form=new URLSearchParams(text);
 if(form.get('username')!==row.username||form.get('confirmation')!=='确认注销')return page(row.username,'请输入正确账号及“确认注销”。',400);
 const key='delete-owner:'+session.owner,now=Date.now();sql.prepare('DELETE FROM local_login_limits WHERE expires<=?').run(now);
 if((sql.prepare('SELECT attempts FROM local_login_limits WHERE key=?').get(key)?.attempts||0)>=8)return page(row.username,'尝试过多，请十五分钟后重试。',429);
 sql.prepare('INSERT INTO local_login_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1').run(key,now+900000);
 if(!await verifyPassword(form.get('password'),row))return page(row.username,'当前密码不正确。',400);
 sql.exec('BEGIN IMMEDIATE');try{
  const current=sessionAccount(sql,request),fresh=sql.prepare('SELECT password_hash FROM local_accounts WHERE owner=?').get(row.owner);
  if(!current||current.owner!==row.owner||fresh?.password_hash!==row.password_hash){sql.exec('ROLLBACK');return page(row.username,'登录或账号状态已改变，请重新登录。',409)}
  eraseAccount(sql,{owner:row.owner,actor:row.owner,action:'self-delete'});sql.exec('COMMIT');
 }catch(e){sql.exec('ROLLBACK');throw e}
 await cleanupDeletedObjects(sql,bucket);
 return new Response(null,{status:303,headers:{...headers,Location:'/auth/local','Set-Cookie':'__Host-leaf-session=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0'}});
}
