const $=id=>document.getElementById(id);
let state=null,busy=false;
$('avatarImage').onerror=()=>{$('avatarImage').hidden=true};
const message=text=>{$('message').textContent=text};
async function api(url,options={}){const r=await fetch(url,{cache:'no-store',...options}),data=await r.json();if(r.status===401){location.replace('/auth/local');throw Error('请重新登录')}if(data.code==='PASSWORD_CHANGE_REQUIRED'){location.replace('/auth/change-password');throw Error('请先修改密码')}if(!r.ok)throw Error(data.error||'操作失败，请稍后重试');return data}
function show(data){
 state=data;$('displayName').textContent=data.displayName;$('nameInput').value=data.displayName;$('loginAccount').textContent='登录账号：'+data.username;$('avatarInitial').textContent=Array.from(data.displayName)[0]||'植';$('avatarImage').hidden=!data.hasAvatar;
 if(data.hasAvatar)$('avatarImage').src='/api/profile/avatar?v='+Date.now();else $('avatarImage').removeAttribute('src');
 $('returnLink').textContent=data.isAdmin?'管理后台':'植物收藏';$('returnLink').href=data.isAdmin?'/admin':'/';$('deleteAccount').hidden=data.isAdmin;
 $('collectionSummary').hidden=data.isAdmin;$('classificationSection').hidden=data.isAdmin;
 if(data.summary){const s=data.summary;$('purchaseTotal').textContent='¥ '+s.purchaseTotal;$('plantCount').textContent=s.plantCount+' 株';$('familyCount').textContent=s.familyCount+' 科 / '+s.genusCount+' 属';$('priceNote').textContent='个人全部档案已填写购入价格的合计，不含示例。'+(s.unpriced?s.unpriced+' 份档案未填写价格。':'')+(s.invalidPrices?'部分价格超出统计范围，请检查档案。':'');$('classificationList').replaceChildren();for(const group of s.classification){const li=document.createElement('li'),title=document.createElement('strong'),small=document.createElement('small');title.textContent=group.family+' · '+group.count+' 株';small.textContent=group.genera.map(g=>g.name+' '+g.count+' 株').join(' / ')||'尚未填写属';li.append(title,small);$('classificationList').append(li)}if(!s.classification.length)$('classificationList').textContent='还没有植物档案，添加后会在这里显示。'}
}
async function action(fn){if(busy)return;busy=true;for(const b of document.querySelectorAll('button'))b.disabled=true;message('');try{await fn()}catch(e){message(e.message)}finally{busy=false;for(const b of document.querySelectorAll('button'))b.disabled=false}}
$('profileForm').onsubmit=event=>{event.preventDefault();action(async()=>{show(await api('/api/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:$('nameInput').value})}));message('资料已保存，两端都会使用新的用户名。')})};
$('chooseAvatar').onclick=()=>$('avatarFile').click();
$('avatarFile').onchange=()=>action(async()=>{const file=$('avatarFile').files[0];if(!file)return;if(file.size>20*1024*1024)throw Error('请选择小于二十兆字节的图片');let bitmap;try{bitmap=await createImageBitmap(file)}catch{throw Error('无法读取图片，请选择常见格式的照片')}
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d'),edge=Math.min(bitmap.width,bitmap.height);ctx.fillStyle='#eef3e7';ctx.fillRect(0,0,256,256);ctx.drawImage(bitmap,(bitmap.width-edge)/2,(bitmap.height-edge)/2,edge,edge,0,0,256,256);bitmap.close();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));if(!blob)throw Error('图片处理失败');show(await api('/api/profile/avatar',{method:'POST',headers:{'Content-Type':'image/jpeg'},body:blob}));$('avatarFile').value='';message('头像已保存。')});
$('clearAvatar').onclick=()=>action(async()=>{show(await api('/api/profile/avatar',{method:'DELETE'}));message('已恢复默认头像。')});
$('logout').onclick=()=>{if(confirm('退出当前账号？尚未保存的内容将丢失。'))action(async()=>{await api('/api/auth/logout',{method:'POST'});location.replace('/auth/local')})};
function appAvailable(){return Boolean(window.leafApp?.quit||window.LeafDownloads?.postMessage)}
function updateApp(){const available=appAvailable();$('quitApp').hidden=!available;$('browserExitNote').hidden=available}
$('quitApp').onclick=()=>{if(!confirm('退出植藏应用？当前账号会保持登录。'))return;if(window.leafApp?.quit)window.leafApp.quit();else window.LeafDownloads?.postMessage(JSON.stringify({type:'quit'}))};
updateApp();window.addEventListener('leaf-app-ready',updateApp);setTimeout(updateApp,500);
api('/api/profile').then(show).catch(e=>message(e.message));
