import {validPath,referenceRank,pathKey,plantPath} from '../shared/taxonomy.js';
import taxonomyJs from '../shared/taxonomy.js?raw';
import {authRoutes, identity} from './auth.js';
import html from '../public/index.html';
import classificationHtml from '../public/classification.html';
import welcomePlant0 from '../public/welcome/plant-0.webp';
import welcomePlant1 from '../public/welcome/plant-1.webp';
import welcomePlant2 from '../public/welcome/plant-2.webp';
import welcomePlant3 from '../public/welcome/plant-3.webp';
import welcomePlant4 from '../public/welcome/plant-4.webp';
import welcomePlant5 from '../public/welcome/plant-5.webp';
import welcomePlant6 from '../public/welcome/plant-6.webp';
import welcomePlant8 from '../public/welcome/plant-8.webp';
import welcomePlant9 from '../public/welcome/plant-9.webp';
import welcomePlant11 from '../public/welcome/plant-11.webp';
import welcomePlant13 from '../public/welcome/plant-13.webp';
import welcomePlant14 from '../public/welcome/plant-14.webp';
import welcomePlant15 from '../public/welcome/plant-15.webp';
import welcomePlant16 from '../public/welcome/plant-16.webp';
import welcomePlant17 from '../public/welcome/plant-17.webp';
import welcomePlant18 from '../public/welcome/plant-18.webp';
import welcomePlant19 from '../public/welcome/plant-19.webp';
import welcomePlant20 from '../public/welcome/plant-20.webp';
import welcomePlant21 from '../public/welcome/plant-21.webp';
import welcomePlant22 from '../public/welcome/plant-22.webp';
import welcomePlant23 from '../public/welcome/plant-23.webp';
import welcomePlant24 from '../public/welcome/plant-24.webp';
import welcomePlant25 from '../public/welcome/plant-25.webp';
import welcomePlant26 from '../public/welcome/plant-26.webp';
import welcomePlant27 from '../public/welcome/plant-27.webp';
import welcomePlant28 from '../public/welcome/plant-28.webp';
import welcomePlant29 from '../public/welcome/plant-29.webp';
import welcomePlant30 from '../public/welcome/plant-30.webp';
import welcomePlant31 from '../public/welcome/plant-31.webp';
import welcomePlant32 from '../public/welcome/plant-32.webp';
import welcomePlant33 from '../public/welcome/plant-33.webp';
import welcomePlant34 from '../public/welcome/plant-34.webp';
import welcomePlant35 from '../public/welcome/plant-35.webp';
import welcomePlant36 from '../public/welcome/plant-36.webp';
import welcomePlant37 from '../public/welcome/plant-37.webp';
import welcomePlant38 from '../public/welcome/plant-38.webp';
import welcomePlant39 from '../public/welcome/plant-39.webp';
import welcomePlant40 from '../public/welcome/plant-40.webp';
import welcomePlant41 from '../public/welcome/plant-41.webp';
import welcomePlant42 from '../public/welcome/plant-42.webp';
import welcomePlant43 from '../public/welcome/plant-43.webp';
import welcomePlant44 from '../public/welcome/plant-44.webp';
import welcomePlant45 from '../public/welcome/plant-45.webp';
import welcomePlant46 from '../public/welcome/plant-46.webp';
import welcomePlant47 from '../public/welcome/plant-47.webp';
import welcomePlant48 from '../public/welcome/plant-48.webp';
import welcomePlant49 from '../public/welcome/plant-49.webp';
import welcomePlant50 from '../public/welcome/plant-50.webp';
import welcomePlant51 from '../public/welcome/plant-51.webp';
import welcomePlant52 from '../public/welcome/plant-52.webp';
import welcomePlant53 from '../public/welcome/plant-53.webp';
import welcomePlant54 from '../public/welcome/plant-54.webp';
import welcomePlant55 from '../public/welcome/plant-55.webp';
import welcomePlant56 from '../public/welcome/plant-56.webp';
import welcomePlant57 from '../public/welcome/plant-57.webp';
import welcomePlant58 from '../public/welcome/plant-58.webp';
import welcomePlant59 from '../public/welcome/plant-59.webp';
import welcomePlant60 from '../public/welcome/plant-60.webp';
import welcomePlant61 from '../public/welcome/plant-61.webp';
import welcomePlant62 from '../public/welcome/plant-62.webp';
import welcomePlant63 from '../public/welcome/plant-63.webp';
import welcomePlant64 from '../public/welcome/plant-64.webp';
import welcomePlant65 from '../public/welcome/plant-65.webp';
import welcomePlant66 from '../public/welcome/plant-66.webp';
import welcomePlant67 from '../public/welcome/plant-67.webp';
import welcomePlant68 from '../public/welcome/plant-68.webp';
// plant-69: dry cobra lily surfaces; revised from reference 15089.
import welcomePlant69 from '../public/welcome/plant-69.webp';
import welcomePlant70 from '../public/welcome/plant-70.webp';
import css from '../public/style.css';
import js from '../public/app.js';
import assets from '../public/assets.json';
const welcomeIcons={'/welcome/plant-0.webp':welcomePlant0,'/welcome/plant-1.webp':welcomePlant1,'/welcome/plant-2.webp':welcomePlant2,'/welcome/plant-3.webp':welcomePlant3,'/welcome/plant-4.webp':welcomePlant4,'/welcome/plant-5.webp':welcomePlant5,'/welcome/plant-6.webp':welcomePlant6,'/welcome/plant-8.webp':welcomePlant8,'/welcome/plant-9.webp':welcomePlant9,'/welcome/plant-11.webp':welcomePlant11,'/welcome/plant-13.webp':welcomePlant13,'/welcome/plant-14.webp':welcomePlant14,'/welcome/plant-15.webp':welcomePlant15,'/welcome/plant-16.webp':welcomePlant16,'/welcome/plant-17.webp':welcomePlant17,'/welcome/plant-18.webp':welcomePlant18,'/welcome/plant-19.webp':welcomePlant19,'/welcome/plant-20.webp':welcomePlant20,'/welcome/plant-21.webp':welcomePlant21,'/welcome/plant-22.webp':welcomePlant22,'/welcome/plant-23.webp':welcomePlant23,'/welcome/plant-24.webp':welcomePlant24,'/welcome/plant-25.webp':welcomePlant25,'/welcome/plant-26.webp':welcomePlant26,'/welcome/plant-27.webp':welcomePlant27,'/welcome/plant-28.webp':welcomePlant28,'/welcome/plant-29.webp':welcomePlant29,'/welcome/plant-30.webp':welcomePlant30,'/welcome/plant-31.webp':welcomePlant31,'/welcome/plant-32.webp':welcomePlant32,'/welcome/plant-33.webp':welcomePlant33,'/welcome/plant-34.webp':welcomePlant34,'/welcome/plant-35.webp':welcomePlant35,'/welcome/plant-36.webp':welcomePlant36,'/welcome/plant-37.webp':welcomePlant37,'/welcome/plant-38.webp':welcomePlant38,'/welcome/plant-39.webp':welcomePlant39,'/welcome/plant-40.webp':welcomePlant40,'/welcome/plant-41.webp':welcomePlant41,'/welcome/plant-42.webp':welcomePlant42,'/welcome/plant-43.webp':welcomePlant43,'/welcome/plant-44.webp':welcomePlant44,'/welcome/plant-45.webp':welcomePlant45,'/welcome/plant-46.webp':welcomePlant46,'/welcome/plant-47.webp':welcomePlant47,'/welcome/plant-48.webp':welcomePlant48,'/welcome/plant-49.webp':welcomePlant49,'/welcome/plant-50.webp':welcomePlant50,'/welcome/plant-51.webp':welcomePlant51,'/welcome/plant-52.webp':welcomePlant52,'/welcome/plant-53.webp':welcomePlant53,'/welcome/plant-54.webp':welcomePlant54,'/welcome/plant-55.webp':welcomePlant55,'/welcome/plant-56.webp':welcomePlant56,'/welcome/plant-57.webp':welcomePlant57,'/welcome/plant-58.webp':welcomePlant58,'/welcome/plant-59.webp':welcomePlant59,'/welcome/plant-60.webp':welcomePlant60,'/welcome/plant-61.webp':welcomePlant61,'/welcome/plant-62.webp':welcomePlant62,'/welcome/plant-63.webp':welcomePlant63,'/welcome/plant-64.webp':welcomePlant64,'/welcome/plant-65.webp':welcomePlant65,'/welcome/plant-66.webp':welcomePlant66,'/welcome/plant-67.webp':welcomePlant67,'/welcome/plant-68.webp':welcomePlant68,'/welcome/plant-69.webp':welcomePlant69,'/welcome/plant-70.webp':welcomePlant70};
import manifest from '../public/manifest.json';
import serviceWorker from '../public/sw.js';
import offline from '../public/offline.html';
import appIcon192 from '../public/icons/icon-192.png';
import appIcon512 from '../public/icons/icon-512.png';
import appIconMaskable from '../public/icons/icon-maskable-512.png';
import appIconApple from '../public/icons/apple-touch-icon.png';
import appIconIco from '../public/icons/plant.ico';
import shortcuts from '../public/downloads/leaf-archive-shortcuts.zip';
const desktopAssets={'/icons/icon-192.png':[appIcon192,'image/png'],'/icons/icon-512.png':[appIcon512,'image/png'],'/icons/icon-maskable-512.png':[appIconMaskable,'image/png'],'/icons/apple-touch-icon.png':[appIconApple,'image/png'],'/icons/plant.ico':[appIconIco,'image/x-icon'],'/downloads/leaf-archive-shortcuts.zip':[shortcuts,'application/zip']};
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const db=env=>{if(!env.DB)throw new Error('档案存储暂时不可用');return env.DB};
const photoPath=x=>typeof x==='string'&&/^\/(images\/[a-f0-9-]+|assets\/[A-Za-z0-9_]+\.jpg)$/.test(x);
const plantStatuses=['生长中','需关注','休眠中','已赠出','已死亡'];
const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
function valid(p){
 if(!p||typeof p!=='object')throw new Error('无效的档案');const out={};
 const fields=['name','latin','number','sourceNumber','source','family','genus','kingdom','division','className','order','tribe','section','series','species','identification','variety','form','infraspecific','description','origin','individualInfo','price','date','location','status','light','water','substrate','notes','lastWater','nextWater'];
 for(const f of fields){out[f]=String(p[f]??'').trim();if(out[f].length>10000)throw new Error('内容过长')}
 if(out.status&&!plantStatuses.includes(out.status))throw new Error('植物状态无效');
 if(!out.name||!out.number)throw new Error('请填写中文名和收藏编号');
 if(out.price!==''&&(!Number.isFinite(Number(out.price))||Number(out.price)<0))throw new Error('价格应为非负数字');
 if(!['','species','unresolved','aff','cf'].includes(out.identification))throw new Error('鉴定类别无效');
 if(out.identification==='unresolved'&&(out.variety||out.form||out.infraspecific))throw new Error('未定种不能添加种下分类');
 if(['aff','cf'].includes(out.identification)&&(out.variety||out.form))throw new Error('aff. 和 cf. 不能同时填写变种或变型');
 if(['aff','cf'].includes(out.identification)&&!out.species)throw new Error('aff. 和 cf. 请填写基础种名');
 if(plantPath(out).some(p=>p.name.length>200))throw new Error('分类名称最多 200 字');
 out.photos=Array.isArray(p.photos)?p.photos.filter(photoPath).slice(0,12):[];
 out.photoDates={};for(const url of out.photos){const date=p.photoDates?.[url];if(date){if(!validDate(date))throw new Error('照片日期无效');out.photoDates[url]=date}}
 const logs=Array.isArray(p.logs)?p.logs:[];if(logs.length>300)throw new Error('每株植物最多保存 300 条生长记录');
 out.logs=logs.filter(x=>typeof x?.text==='string'&&typeof x?.date==='string').map(x=>{
  if(x.date&&!validDate(x.date))throw new Error('生长记录日期无效');
  const photos=Array.isArray(x.photos)?x.photos.filter(photoPath).slice(0,6):[];
  return {id:typeof x.id==='string'?x.id.slice(0,80):crypto.randomUUID(),date:x.date,type:String(x.type||'观察').slice(0,20),text:x.text.slice(0,3000),photos};
 });return out;
}
// Generate status history atomically with the archive write, including editor saves.
function recordStatusChange(p,current,change={}){
 const history=new Map((current.logs||[]).filter(l=>l.type==='状态变更').map(l=>[l.id,l]));
 p.logs=p.logs.flatMap(l=>l.type==='状态变更'?(history.has(l.id)?[history.get(l.id)]:[]):[l]);
 for(const [id,entry] of history)if(!p.logs.some(l=>l.id===id))p.logs.push(entry);
 if(p.status!==(current.status||'')){
  const date=change?.date||new Date().toISOString().slice(0,10);
  if(!validDate(date))throw new Error('状态变更日期无效');
  const note=typeof change?.note==='string'?change.note.trim():'';
  if(note.length>3000)throw new Error('状态变更备注最多 3000 字');
  const fromStatus=current.status||'',toStatus=p.status;
  p.logs.push({id:crypto.randomUUID(),date,type:'状态变更',fromStatus,toStatus,text:(fromStatus||'未填写')+' → '+(toStatus||'未填写')+(note?'\n'+note:''),photos:[]});
 }
 if(p.logs.length>300)throw new Error('每株植物最多保存 300 条生长记录');
}
export default {async fetch(request,env){const u=new URL(request.url);try{
const authResponse=await authRoutes(request,env);if(authResponse)return authResponse;
if(u.pathname==='/manifest.webmanifest')return new Response(JSON.stringify(manifest),{headers:{'Content-Type':'application/manifest+json; charset=utf-8','Cache-Control':'no-cache'}});
if(u.pathname==='/sw.js')return new Response(serviceWorker,{headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-cache','Service-Worker-Allowed':'/'}});
if(u.pathname==='/offline.html')return new Response(offline,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'}});
if(desktopAssets[u.pathname]){const [data,mime]=desktopAssets[u.pathname];const headers={'Content-Type':mime,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'};if(mime==='application/zip')headers['Content-Disposition']='attachment; filename="leaf-archive-shortcuts.zip"';return new Response(Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0)),{headers})}
if(u.pathname==='/classification'||u.pathname==='/classification/')return new Response(classificationHtml,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
if(u.pathname==='/')return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
if(welcomeIcons[u.pathname])return new Response(Uint8Array.from(atob(welcomeIcons[u.pathname].split(',')[1]),c=>c.charCodeAt(0)),{headers:{'Content-Type':'image/webp','Cache-Control':'public, max-age=86400'}});
if(u.pathname==='/style.css')return new Response(css,{headers:{'Content-Type':'text/css'}});
if(u.pathname==='/taxonomy.js')return new Response(taxonomyJs,{headers:{'Content-Type':'text/javascript','Cache-Control':'no-cache'}});
if(u.pathname==='/app.js')return new Response(js,{headers:{'Content-Type':'text/javascript'}});
if(assets[u.pathname]){const a=assets[u.pathname];return new Response(Uint8Array.from(atob(a),c=>c.charCodeAt(0)),{headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=86400'}})}
if(!u.pathname.startsWith('/api/')&&!u.pathname.startsWith('/images/'))return new Response('Not found',{status:404});
const who=(await identity(request,env))?.owner;if(!who)return json({error:'请先登录，再访问你的植物档案。'},401);
if(request.method!=='GET'){const origin=request.headers.get('Origin');if(origin&&origin!==u.origin)return json({error:'请求来源无效'},403)}
if(u.pathname==='/api/taxa'&&request.method==='GET'){
 const r=await db(env).prepare('SELECT id, data FROM taxa WHERE owner = ? ORDER BY created').bind(who).all();return json(r.results.map(x=>({id:x.id,...JSON.parse(x.data)})));
}
if((u.pathname==='/api/taxa'&&request.method==='POST')||(u.pathname.startsWith('/api/taxa/')&&request.method==='PUT')){
 const input=await request.json();const path=validPath(input.path);
 if(!Array.isArray(input.references)||!input.references.every(photoPath))return json({error:'参考图无效'},400);
 if(input.references.length&&!referenceRank(path.at(-1).rank))return json({error:'仅种级及以下分类可导入参考图'},400);
 for(const url of input.references.filter(x=>x.startsWith('/images/'))){
  if(!await db(env).prepare('SELECT id FROM images WHERE id = ? AND owner = ?').bind(url.split('/').pop(),who).first())return json({error:'参考图不存在或不属于当前账号'},400);
 }
 const p={path,references:[...new Set(input.references)],_revision:crypto.randomUUID()};
 if(request.method==='POST'){
  const id=crypto.randomUUID();await db(env).prepare('INSERT INTO taxa (id,owner,path_key,data,created) VALUES (?,?,?,?,?)').bind(id,who,pathKey(path),JSON.stringify(p),new Date().toISOString()).run();return json({id,...p},201);
 }
 const id=u.pathname.split('/').pop();const row=await db(env).prepare('SELECT id, data FROM taxa WHERE id = ? AND owner = ?').bind(id,who).first();
 if(!row)return json({error:'分类不存在'},404);
 const current=JSON.parse(row.data);
 if(!request.headers.get('If-Match'))return json({error:'请重新打开分类后保存'},428);
 if(request.headers.get('If-Match')!=='"'+current._revision+'"')return json({error:'分类已在其他设备修改，请关闭后重新打开'},409);
 if(pathKey(current.path)!==pathKey(path))return json({error:'参考图管理不能修改分类路径'},400);
 const r=await db(env).prepare('UPDATE taxa SET data = ? WHERE id = ? AND owner = ? AND data = ?').bind(JSON.stringify(p),id,who,row.data).run();
 if(!r.meta?.changes)return json({error:'分类刚刚在其他设备更新，请重新打开'},409);
 return json({id,...p});
}
if(u.pathname==='/api/plants'&&request.method==='GET'){const r=await db(env).prepare('SELECT id, data FROM plants WHERE owner = ? ORDER BY created DESC').bind(who).all();return json(r.results.map(x=>{const p=JSON.parse(x.data);return {id:x.id,...p,_revision:p._revision||'legacy'}}))}
if(u.pathname==='/api/plants'&&request.method==='POST'){const p={...valid(await request.json()),_revision:crypto.randomUUID()};p.logs=p.logs.filter(l=>l.type!=='状态变更');const id=crypto.randomUUID();await db(env).prepare('INSERT INTO plants (id,owner,number,data,created) VALUES (?,?,?,?,?)').bind(id,who,p.number,JSON.stringify(p),new Date().toISOString()).run();return json({id,...p},201)}
if(u.pathname.startsWith('/api/plants/')&&['PUT','DELETE'].includes(request.method)){
 const id=u.pathname.split('/').pop();const row=await db(env).prepare('SELECT id, data FROM plants WHERE id = ? AND owner = ?').bind(id,who).first();
 if(!row)return json({error:'档案不存在，可能已在其他窗口删除。'},404);
 const current=JSON.parse(row.data),revision=current._revision||'legacy';
 const expected=request.headers.get('If-Match');
 if(!expected)return json({error:'请刷新页面后重试，以读取最新的云端档案。'},428);
 if(expected!=='"'+revision+'"')return json({error:'档案已在其他窗口或设备修改。当前输入已保留，请复制需要的内容，再关闭并重新打开档案。'},409);
 if(request.method==='DELETE'){
  const result=await db(env).prepare('DELETE FROM plants WHERE id = ? AND owner = ? AND data = ?').bind(id,who,row.data).run();
  if(!result.meta?.changes)return json({error:'档案刚刚在其他窗口更新，请重新打开后再操作。'},409);
  return json({ok:true});
 }
 const input=await request.json();const p={...valid(input),_revision:crypto.randomUUID()};
 recordStatusChange(p,current,input.statusChange);
 const result=await db(env).prepare('UPDATE plants SET number = ?, data = ? WHERE id = ? AND owner = ? AND data = ?').bind(p.number,JSON.stringify(p),id,who,row.data).run();
 if(!result.meta?.changes)return json({error:'档案刚刚在其他窗口更新。当前输入已保留，请复制需要的内容，再重新打开档案。'},409);
 return json({id,...p});
}
if(u.pathname==='/api/images'&&request.method==='POST'){const f=await request.formData();const file=f.get('file');if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))return json({error:'请选择 JPG、PNG 或 WebP 图片'},400);if(file.size>8*1024*1024)return json({error:'每张图片请小于 8 MB'},400);if(!env.BUCKET)throw new Error('图片存储暂时不可用');const bytes=await file.arrayBuffer();const b=new Uint8Array(bytes);const magic=(file.type==='image/jpeg'&&b[0]===255&&b[1]===216)||(file.type==='image/png'&&b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71)||(file.type==='image/webp'&&new TextDecoder().decode(b.slice(0,4))==='RIFF'&&new TextDecoder().decode(b.slice(8,12))==='WEBP');if(!magic)return json({error:'图片格式不匹配'},400);const id=crypto.randomUUID();await env.BUCKET.put(who+'/'+id,bytes,{httpMetadata:{contentType:file.type}});await db(env).prepare('INSERT INTO images (id,owner,mime) VALUES (?,?,?)').bind(id,who,file.type).run();return json({url:'/images/'+id})}
if(u.pathname.startsWith('/images/')&&request.method==='GET'){const id=u.pathname.split('/').pop();const row=await db(env).prepare('SELECT mime FROM images WHERE id = ? AND owner = ?').bind(id,who).first();if(!row)return new Response('Not found',{status:404});const object=await env.BUCKET.get(who+'/'+id);if(!object)return new Response('Not found',{status:404});return new Response(object.body,{headers:{'Content-Type':row.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
return json({error:'未找到此操作'},404);
}catch(e){console.error(e);if(['植物状态无效','状态变更日期无效','状态变更备注最多 3000 字','aff. 和 cf. 请填写基础种名','分类路径无效','分类层级或名称无效','鉴定类别无效','未定种不能添加种下分类','aff. 和 cf. 不能同时填写变种或变型','分类名称最多 200 字','照片日期无效','生长记录日期无效','每株植物最多保存 300 条生长记录'].includes(e.message))return json({error:e.message},400);const duplicate=String(e).includes('UNIQUE');return json({error:duplicate?(u.pathname.startsWith('/api/taxa')?'该分类已存在，请在分类树中管理参考图。':'收藏编号已存在，请使用其他编号。'):e.message==='档案存储暂时不可用'||e.message==='图片存储暂时不可用'?e.message:'操作未完成，请检查填写内容后重试。'},duplicate?409:500)}}};
