import {downloadsAvailable} from '../shared/migration-delivery.js';
const SESSION_COOKIE='__Host-leaf-session';
const STATE_COOKIE='__Host-leaf-wechat-state';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const cookie=(name,value,maxAge)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
function cookies(request){const values={};for(const piece of (request.headers.get('Cookie')||'').split(';')){const i=piece.indexOf('=');if(i>0)values[piece.slice(0,i).trim()]=piece.slice(i+1).trim();}return values;}
function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');}
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
function config(env,mode){const prefix=mode==='web'?'WECHAT_WEB_':'WECHAT_MP_';return {appid:env[prefix+'APP_ID'],secret:env[prefix+'APP_SECRET'],mode};}
function available(env,mode){const c=config(env,mode);return Boolean(c.appid&&c.secret&&/^https:\/\//.test(env.WECHAT_REDIRECT_URI||''));}
function sameOrigin(request){return request.headers.get('Origin')===new URL(request.url).origin;}
export async function identity(request,env){
 const token=cookies(request)[SESSION_COOKIE];
 if(token&&/^[a-f0-9]{64}$/.test(token)&&env.DB){
  const session=await env.DB.prepare('SELECT owner, nickname FROM auth_sessions WHERE token_hash = ? AND expires > ?').bind(await hash(token),Date.now()).first();
  if(session)return {owner:session.owner,nickname:session.nickname||'微信用户',provider:'wechat'};
 }
 // Only Sites may supply this trusted header. Independently hosted builds default to ignoring it.
 if(env.TRUST_SITES_IDENTITY==='true'&&cookies(request)['__Host-leaf-logged-out']!=='1'){
  const who=request.headers.get('oai-authenticated-user-id');
  if(who)return {owner:who,nickname:'原网站账号',provider:'sites'};
 }
 return null;
}
function callbackResult(origin,error){return new Response(null,{status:303,headers:{Location:origin+'/?login='+error,'Cache-Control':'no-store','Set-Cookie':cookie(STATE_COOKIE,'',0)}});}
async function providerJSON(url){
 const response=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});
 if(!response.ok)throw new Error('provider');const data=await response.json();if(data.errcode)throw new Error('provider');return data;
}
async function accountOwner(env,appid,openid,unionid){
 const key=await hash(appid+':'+openid);
 const known=await env.DB.prepare('SELECT owner FROM wechat_identities WHERE identity_hash = ?').bind(key).first();
 const united=unionid?await env.DB.prepare('SELECT owner FROM wechat_identities WHERE union_id = ? LIMIT 1').bind(unionid).first():null;
 if(known){
  if(unionid&&(!united||united.owner===known.owner))await env.DB.prepare('UPDATE wechat_identities SET union_id = ? WHERE identity_hash = ?').bind(unionid,key).run();
  return known.owner;
 }
 const owner=united?.owner||'wechat:'+await hash(unionid?'union:'+unionid:'openid:'+appid+':'+openid);
 await env.DB.prepare('INSERT OR IGNORE INTO wechat_identities (identity_hash, owner, union_id) VALUES (?,?,?)').bind(key,owner,unionid||null).run();
 return (await env.DB.prepare('SELECT owner FROM wechat_identities WHERE identity_hash = ?').bind(key).first()).owner;
}
export async function authRoutes(request,env){
 const url=new URL(request.url);
 if(url.pathname==='/api/auth'&&request.method==='GET'){
  const user=await identity(request,env);
  return json({user:user?{id:user.owner,nickname:user.nickname,provider:user.provider}:null,wechat:{web:available(env,'web'),mp:available(env,'mp')},legacyLogin:env.TRUST_SITES_IDENTITY==='true',migrationDownloads:downloadsAvailable(env,user?.owner)});
 }
 if(url.pathname==='/api/auth/logout'&&request.method==='POST'){
  if(!sameOrigin(request))return json({error:'请求来源无效'},403);
  const token=cookies(request)[SESSION_COOKIE];if(token&&env.DB)await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(await hash(token)).run();
  const headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store'});headers.append('Set-Cookie',cookie(SESSION_COOKIE,'',0));headers.append('Set-Cookie',cookie('__Host-leaf-logged-out','1',30*24*60*60));return new Response(JSON.stringify({ok:true}),{headers});
 }
 if(url.pathname==='/auth/sites'&&request.method==='GET'&&env.TRUST_SITES_IDENTITY==='true')return new Response(null,{status:302,headers:{Location:url.origin+'/signin-with-chatgpt?return_to=/','Cache-Control':'no-store','Set-Cookie':cookie('__Host-leaf-logged-out','',0)}});
 if(url.pathname==='/auth/wechat'&&request.method==='GET'){
  const mode=url.searchParams.get('mode')==='mp'?'mp':'web';
  if(!available(env,mode)||!env.DB)return callbackResult(url.origin,'not-configured');
  const c=config(env,mode),redirect=new URL(env.WECHAT_REDIRECT_URI);
  if(redirect.origin!==url.origin||redirect.pathname!=='/auth/wechat/callback'||redirect.search||redirect.hash)return callbackResult(url.origin,'not-configured');
  await env.DB.prepare('DELETE FROM oauth_states WHERE expires <= ?').bind(Date.now()).run();
  const state=randomToken();
  await env.DB.prepare('INSERT INTO oauth_states (state_hash, mode, app_id, expires) VALUES (?,?,?,?)').bind(await hash(state),mode,c.appid,Date.now()+10*60*1000).run();
  const target=new URL(mode==='web'?'https://open.weixin.qq.com/connect/qrconnect':'https://open.weixin.qq.com/connect/oauth2/authorize');
  target.search=new URLSearchParams({appid:c.appid,redirect_uri:redirect.href,response_type:'code',scope:mode==='web'?'snsapi_login':'snsapi_userinfo',state}).toString();target.hash='wechat_redirect';
  return new Response(null,{status:302,headers:{Location:target.href,'Cache-Control':'no-store','Set-Cookie':cookie(STATE_COOKIE,state,600),'Referrer-Policy':'no-referrer'}});
 }
 if(url.pathname==='/auth/wechat/callback'&&request.method==='GET'){
  const state=url.searchParams.get('state'),code=url.searchParams.get('code');
  if(!state||!/^[a-f0-9]{64}$/.test(state)||state!==cookies(request)[STATE_COOKIE]||!code||code.length>256||!env.DB)return callbackResult(url.origin,'failed');
  const attempt=await env.DB.prepare('DELETE FROM oauth_states WHERE state_hash = ? AND expires > ? RETURNING mode, app_id').bind(await hash(state),Date.now()).first();
  if(!attempt)return callbackResult(url.origin,'failed');
  const c=config(env,attempt.mode);if(!available(env,attempt.mode)||c.appid!==attempt.app_id)return callbackResult(url.origin,'not-configured');
  try{
   const tokenURL=new URL('https://api.weixin.qq.com/sns/oauth2/access_token');tokenURL.search=new URLSearchParams({appid:c.appid,secret:c.secret,code,grant_type:'authorization_code'}).toString();
   const token=await providerJSON(tokenURL);if(typeof token.openid!=='string'||!token.openid||token.openid.length>128||!token.access_token)throw new Error('provider');
   let profile={};try{const profileURL=new URL('https://api.weixin.qq.com/sns/userinfo');profileURL.search=new URLSearchParams({access_token:token.access_token,openid:token.openid,lang:'zh_CN'}).toString();profile=await providerJSON(profileURL);}catch{/* OpenID from the successful token exchange still identifies the user. */}
   if(profile.openid&&profile.openid!==token.openid)throw new Error('provider');
   const union=profile.unionid||token.unionid;const owner=await accountOwner(env,c.appid,token.openid,typeof union==='string'&&union.length<=128?union:null);
   await env.DB.prepare('DELETE FROM auth_sessions WHERE expires <= ?').bind(Date.now()).run();
   const session=randomToken();await env.DB.prepare('INSERT INTO auth_sessions (token_hash, owner, nickname, expires) VALUES (?,?,?,?)').bind(await hash(session),owner,typeof profile.nickname==='string'?profile.nickname.slice(0,100):'微信用户',Date.now()+30*24*60*60*1000).run();
   const headers=new Headers({Location:url.origin+'/','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});headers.append('Set-Cookie',cookie(SESSION_COOKIE,session,30*24*60*60));headers.append('Set-Cookie',cookie(STATE_COOKIE,'',0));headers.append('Set-Cookie',cookie('__Host-leaf-logged-out','',0));
   return new Response(null,{status:303,headers});
  }catch{return callbackResult(url.origin,'failed');}
 }
 return null;
}
