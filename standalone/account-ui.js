(()=>{
 const installed=()=>Boolean(window.leafApp||window.LeafDownloads||/\bElectron\/|; wv\)/.test(navigator.userAgent||'')||navigator.standalone===true||window.matchMedia?.('(display-mode: standalone)').matches);
 function hideInstall(){if(!installed())return;document.documentElement.classList.add('leaf-installed-app');let style=document.getElementById('leaf-installed-style');if(!style){style=document.createElement('style');style.id='leaf-installed-style';style.textContent='html.leaf-installed-app #installApp,html.leaf-installed-app #installDialog{display:none!important}';document.head.append(style)}const dialog=document.getElementById('installDialog');if(dialog?.open)dialog.close()}
 hideInstall();window.addEventListener('leaf-app-ready',hideInstall);setTimeout(hideInstall,500);setTimeout(hideInstall,1500);
 document.addEventListener('click',event=>{if(installed()&&event.target.closest?.('#installApp')){event.preventDefault();event.stopImmediatePropagation();hideInstall()}},true);
 document.addEventListener('click',event=>{if(event.target.closest?.('a.brand,[data-leaf-refresh]')){event.preventDefault();location.reload()}});
 const sidebar=document.querySelector('.sidebar');if(sidebar&&!sidebar.querySelector('a[href="/account"]')){const link=document.createElement('a');link.className='nav';link.href='/account';link.textContent='◉ 我的';const install=sidebar.querySelector('#installApp');if(install)install.before(link);else sidebar.append(link)}
 for(const id of ['statPrice','statFamilies']){const node=document.getElementById(id);if(node?.parentElement)node.parentElement.hidden=true}
 const stats=document.querySelector('.stats');if(stats)stats.style.gridTemplateColumns='repeat(2,minmax(0,1fr))';
 if(!sidebar)return;
 fetch('/api/profile?summary=0',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{
  if(!data)return;const name=document.getElementById('accountName');if(name)name.textContent=data.displayName;
  const avatar=sidebar.querySelector('.side-bottom .avatar');if(avatar){avatar.replaceChildren();if(data.hasAvatar){const img=document.createElement('img');img.src='/api/profile/avatar';img.alt='我的头像';img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:50%';avatar.append(img)}else avatar.textContent=Array.from(data.displayName)[0]||'植'}
  const label=sidebar.querySelector('.side-bottom div');if(label){label.replaceChildren();const title=document.createElement('strong'),small=document.createElement('small');title.textContent=data.displayName;small.textContent='个人资料与账号设置';label.append(title,small)}
 }).catch(()=>{});
})();
