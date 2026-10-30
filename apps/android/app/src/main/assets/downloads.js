(()=>{
 if(window.__leafDownloadsInstalled)return;window.__leafDownloadsInstalled=true;
 function send(anchor){
  const href=anchor.href;if(!href.startsWith('blob:https://gloriouscarnivorousplants.top/'))return false;
  fetch(href).then(r=>r.blob()).then(blob=>{
   if(blob.size>24*1024*1024)throw Error('文件较大，请在浏览器中导出');
   const reader=new FileReader();reader.onload=()=>LeafDownloads.postMessage(JSON.stringify({name:anchor.download||'植藏文件',mime:blob.type,data:String(reader.result).split(',')[1]}));reader.readAsDataURL(blob);
  }).catch(()=>alert('文件保存失败，请重试或在浏览器中下载。'));return true;
 }
 const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(!send(this))return click.apply(this,arguments)};
 document.addEventListener('click',event=>{const anchor=event.target.closest?.('a');if(anchor&&anchor.href.startsWith('blob:')){event.preventDefault();send(anchor)}},true);
})();
