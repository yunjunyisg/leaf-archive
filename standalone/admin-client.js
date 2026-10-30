const $=id=>document.getElementById(id);
let userPage=1,plantPage=1,owner='',ownerName='',epoch=0,usersEpoch=0,plantsEpoch=0,detailEpoch=0;
const date=value=>value?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'未记录';
const bytes=value=>value<1024?value+' 字节':value<1024*1024?(value/1024).toFixed(1)+' 千字节':(value/1024/1024).toFixed(1)+' 兆字节';
function cell(row,text){const td=document.createElement('td');td.textContent=text;row.append(td);return td}
function button(parent,text,handler){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=handler;parent.append(b);return b}
async function api(url,options={}){
 const response=await fetch(url,{cache:'no-store',...options});if(response.status===401){location.href='/auth/local';throw Error('登录已过期，请重新登录')}
 const data=await response.json();if(!response.ok)throw Error(data.error||'后台暂时不可用');return data;
}
const showError=error=>{$('message').textContent=error.message||'数据读取失败，请稍后刷新。'};
function pager(kind,data){$(kind+'Page').textContent='第 '+data.page+' 页';$(kind+'Prev').disabled=data.page<=1;$(kind+'Next').disabled=data.page*data.pageSize>=data.total}
async function stats(){
 const attempt=++epoch,data=await api('/api/admin/stats');if(attempt!==epoch)return;
 const pairs=[['注册账号',data.users],['普通用户',data.ordinaryUsers],['管理员',data.administrators],['近五分钟活跃',data.activeFiveMinutes],['今日活跃账号',data.activeToday],['近七日活跃账号',data.activeSevenDays],['植物档案',data.plants],['照片',data.images]];
 $('metrics').replaceChildren();for(const [label,value] of pairs){const card=document.createElement('div');card.className='card';const small=document.createElement('small'),strong=document.createElement('strong');small.textContent=label;strong.textContent=value;card.append(small,strong);$('metrics').append(card)}
 $('trend').replaceChildren();const maximum=Math.max(1,...data.days.map(d=>d.users||0));for(const d of data.days){const bar=document.createElement('div');bar.className='bar';bar.title=d.day+'：'+(d.users===null?'未记录':d.users+' 个账号');const count=document.createElement('b'),fill=document.createElement('i'),label=document.createElement('span');count.textContent=d.users===null?'—':d.users;fill.style.height=Math.max(2,(d.users||0)/maximum*120)+'px';if(d.users===null)fill.style.background='#dce4d6';label.textContent=d.day.slice(5);bar.append(count,fill,label);$('trend').append(bar)}
 $('trackingNote').textContent='活跃人数按登录账号去重，按北京时间统计。开始记录时间：'+date(data.trackingStartedAt)+'；此前未记录时段不代表零人使用。';
 $('storage').replaceChildren();for(const text of ['图片目录占用：'+bytes(data.storage.photoBytes),'数据库占用：'+bytes(data.storage.databaseBytes),'分类节点：'+data.taxa]){const p=document.createElement('p');p.textContent=text;$('storage').append(p)}
}
async function users(){
 const attempt=++usersEpoch,data=await api('/api/admin/users?page='+userPage+'&q='+encodeURIComponent($('userQuery').value.trim()));if(attempt!==usersEpoch)return;
 $('userCount').textContent='共 '+data.total+' 个账号';$('users').replaceChildren();for(const u of data.users){const tr=document.createElement('tr');cell(tr,u.username).append(Object.assign(document.createElement('small'),{textContent:u.nickname}));cell(tr,u.disabled?'已注销':u.mustChange?'待修改密码':u.role==='admin'?'管理员':'普通账号');cell(tr,u.plantCount+' / '+u.imageCount+' / '+u.taxonCount);cell(tr,date(u.registeredAt));cell(tr,date(u.lastLogin));cell(tr,date(u.lastSeen));button(cell(tr,''),'查看档案',()=>{owner=u.owner;ownerName=u.username;plantPage=1;plants().catch(showError);$('plantsTitle').scrollIntoView({behavior:'smooth',block:'start'})});if(u.role!=='admin'&&!u.disabled){button(tr.lastElementChild,'重置密码',()=>manageUser(u,'reset-password').catch(showError));button(tr.lastElementChild,'注销账号',()=>manageUser(u,'deactivate').catch(showError));}$('users').append(tr)}pager('users',data);
}
let managing=false;
async function manageUser(user,action){
 if(managing)return;
 const reset=action==='reset-password',question=reset?'将账号 '+user.username+' 的密码重置为 000000？现有登录将失效，用户必须修改密码后才能使用网站。':'确定注销账号 '+user.username+'？该账号将无法登录，现有登录立即失效；植物档案和照片保留。';
 if(!confirm(question))return;
 managing=true;
 try{const data=await api('/api/admin/users/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:user.owner,username:user.username})});await Promise.all([users(),stats()]);$('message').textContent=data.message}finally{managing=false}
}
async function plants(){
 const attempt=++plantsEpoch,data=await api('/api/admin/plants?page='+plantPage+(owner?'&owner='+encodeURIComponent(owner):''));if(attempt!==plantsEpoch)return;
 $('plantsTitle').textContent=owner?'用户 '+ownerName+' 的植物档案':'全部植物档案';$('clearOwner').hidden=!owner;$('plantCount').textContent='共 '+data.total+' 份档案';$('plants').replaceChildren();
 for(const p of data.plants){const tr=document.createElement('tr');cell(tr,p.name).append(Object.assign(document.createElement('small'),{textContent:p.number+(p.latin?' · '+p.latin:'')}));cell(tr,p.username);cell(tr,p.status);cell(tr,p.origin||'未填写');cell(tr,p.photoCount);button(cell(tr,''),'查看详情',()=>detail(p.id).catch(showError));$('plants').append(tr)}pager('plants',data);
}
async function detail(id){
 const attempt=++detailEpoch,p=await api('/api/admin/plants/'+encodeURIComponent(id));if(attempt!==detailEpoch)return;
 $('detailTitle').textContent=p.name||'植物档案';const pairs=[['收藏编号',p.number],['学名',p.latin],['科',p.family],['属',p.genus],['状态',p.status],['产地',p.origin],['位置',p.location],['简介',p.description],['个体信息',p.individualInfo],['备注',p.notes]];
 $('detailText').textContent=pairs.filter(([,v])=>v).map(([k,v])=>k+'：'+v).join('\n');$('detailPhotos').replaceChildren();const photos=[...new Set([...(p.photos||[]),...(p.logs||[]).flatMap(log=>log.photos||[])])];
 for(const url of photos){const personal=/^\/images\/[a-f0-9-]{36}$/.test(url),example=/^\/assets\/[A-Za-z0-9_]+\.jpg$/.test(url);if(!personal&&!example)continue;const image=document.createElement('img');image.src=personal?'/api/admin'+url:url;image.alt=p.name||'植物照片';image.loading='lazy';image.decoding='async';$('detailPhotos').append(image)}
 if(!$('detail').open)$('detail').showModal();
}
async function refresh(){const b=$('refresh');b.disabled=true;$('message').textContent='';try{await Promise.all([stats(),users(),plants()])}catch(e){showError(e)}finally{b.disabled=false}}
$('refresh').onclick=refresh;$('userSearch').onsubmit=event=>{event.preventDefault();userPage=1;users().catch(showError)};
for(const [id,change,fn] of [['usersPrev',()=>userPage--,users],['usersNext',()=>userPage++,users],['plantsPrev',()=>plantPage--,plants],['plantsNext',()=>plantPage++,plants]])$(id).onclick=()=>{change();fn().catch(showError)};
$('clearOwner').onclick=()=>{owner='';ownerName='';plantPage=1;plants().catch(showError)};
$('closeDetail').onclick=()=>{detailEpoch++;$('detail').close();$('detailPhotos').replaceChildren()};
$('logout').onclick=async()=>{try{await api('/api/auth/logout',{method:'POST'});location.href='/auth/local'}catch(e){showError(e)}};
refresh();
