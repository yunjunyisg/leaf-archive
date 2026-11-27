export function createPlantQuestion({api,isLoggedIn,showAuth}){
 const dialog=document.querySelector('#ask-dialog');
 const $=id=>dialog.querySelector('#ask-'+id);
 const form=dialog.querySelector('form'),key=$('key'),provider=$('provider');
 const question=$('question'),status=$('status'),messages=$('messages'),quick=$('quick');
 const note=$('note'),saveNote=$('save-note'),memoryStatus=$('memory-status'),notes=$('notes');
 const scroller=dialog.querySelector('.ask-scroll'),share=$('share');
 let record=null,history=[],pending=null,memoryPending=null,editing=false,panel=null,greeting=null;
 let choices=new Map(),savedProviders=new Set();
 const viewport=window.visualViewport;
 const wantsImages=text=>/^(我想要更多图片|(?:请)?(?:给我|看看|我想看)(?:更多|几张|参考)?(?:这株植物的)?(?:图片|照片)|更多(?:参考)?(?:图片|照片))[？?。！!]?$/u.test(text.trim());

 function setPanel(next){
  panel=next;
  for(const [name,control] of [['provider','settings'],['memory','memory']]){
   $(name+'-panel').hidden=panel!==name;
   $(control).setAttribute('aria-expanded',String(panel===name));
  }
  if(next)scroller.scrollTop=0;
 }
 function resizeChat(){
  if(viewport?.scale!==1)return;
  dialog.style.setProperty('--ask-viewport',viewport.height+'px');
  dialog.style.setProperty('--ask-offset',viewport.offsetTop+'px');
 }
 function notify(text,waiting=false){
  status.textContent=text;
  status.toggleAttribute('data-waiting',waiting);
 }
 function updateProvider(){
  const available=choices.has(provider.value),saved=savedProviders.has(provider.value);
  const showKey=available&&(!saved||editing);
  $('saved-key').hidden=!saved||editing;
  $('key-entry').hidden=!showKey;
  key.disabled=!showKey||Boolean(pending);
  $('change-key').disabled=$('cancel-key').disabled=provider.disabled=Boolean(pending);
  $('cancel-key').hidden=!saved;
  question.disabled=Boolean(pending);
  $('send').disabled=(!available&&!wantsImages(question.value))||Boolean(pending)||Boolean(record&&!record.turnId&&memoryPending);
  for(const button of quick.querySelectorAll('button'))button.disabled=Boolean(pending);
 }
 function configure(options,saved){
  const selected=provider.value;
  choices=new Map(options.map(item=>[item.id,item]));
  savedProviders=new Set(saved.filter(id=>choices.has(id)));
  provider.replaceChildren(...options.map(item=>new Option(item.label,item.id)));
  if(choices.has(selected)&&(dialog.open||savedProviders.has(selected)))provider.value=selected;
  else if(savedProviders.size)provider.value=savedProviders.values().next().value;
  updateProvider();
 }
 provider.onchange=()=>{
  key.value='';
  editing=false;
  notify('');
  updateProvider();
 };
 $('settings').onclick=()=>setPanel(panel==='provider'?null:'provider');
 $('memory').onclick=()=>{
  if(panel==='memory')return setPanel(null);
  setPanel('memory');
  if(!memoryPending)void manageMemory();
 };
 $('change-key').onclick=()=>{
  editing=true;
  notify('');
  updateProvider();
  key.focus();
 };
 $('cancel-key').onclick=()=>{
  editing=false;
  key.value='';
  notify('');
  updateProvider();
  $('change-key').focus();
 };

 function renderNotes(items){
  notes.replaceChildren();
  for(const item of items){
   const row=document.createElement('li'),text=document.createElement('span'),remove=document.createElement('button');
   const details=[item.label,item.shared?'已贡献到共享总资料库':''].filter(Boolean);
   if(details.length){
    const label=document.createElement('small');
    label.textContent=details.join(' · ');
    text.append(label);
   }
   text.append(document.createTextNode(item.note));
   remove.type='button';
   remove.textContent='删除';
   remove.setAttribute('aria-label','删除观察记忆 '+item.note);
   remove.onclick=()=>manageMemory('DELETE',item.id);
   row.append(text,remove);
   notes.append(row);
  }
 }
 function updateMemory(){
  share.disabled=Boolean(memoryPending);
  saveNote.disabled=Boolean(memoryPending)||!note.value.trim();
  for(const button of notes.querySelectorAll('button'))button.disabled=Boolean(memoryPending);
 }
 async function manageMemory(method='GET',id){
  if(!record||memoryPending)return;
  const selection=record,controller=new AbortController(),draft=note.value.trim(),publish=share.checked;
  const params=new URLSearchParams(Object.entries(selection).filter(([,value])=>value!==undefined));
  if(id)params.set('id',id);
  memoryPending=controller;
  const timeout=setTimeout(()=>controller.abort(),15000);
  updateMemory();
  updateProvider();
  memoryStatus.textContent=method==='GET'?'正在读取记忆…':'正在更新记忆…';
  try{
   const endpoint=selection.threadId?'ask/memory':'observation-library';
   const data=await api(endpoint+'?'+params,{method,signal:controller.signal,...(method==='POST'?{
    headers:{'Content-Type':'application/json'},body:JSON.stringify({note:draft,share:publish}),
   }:{})});
   if(record!==selection)return;
   if(selection.threadId){
    record.turnId=data.turnId;
    $('share-option').hidden=!data.canShare;
    if(!data.canShare)share.checked=false;
    if(data.label)showPlant(data.label);
   }
   renderNotes(data.notes);
   if(method==='POST'&&note.value.trim()===draft){note.value='';share.checked=false}
   memoryStatus.textContent=method==='POST'?(publish?'观察已保存并贡献到共享总资料库。':'观察已保存到云端。'):method==='DELETE'?'观察记忆已删除。':data.notes.length?'':'还没有保存观察记忆。';
  }catch(error){
   if(record===selection)memoryStatus.textContent=controller.signal.aborted?'云端响应超时，请重新打开记忆面板确认状态。':error.message;
  }finally{
   clearTimeout(timeout);
   if(memoryPending===controller){memoryPending=null;updateMemory();updateProvider()}
  }
 }
 note.oninput=updateMemory;
 saveNote.onclick=()=>{if(note.value.trim())void manageMemory('POST')};

 function close(){
  pending?.abort();
  memoryPending?.abort();
  pending=memoryPending=null;
  viewport?.removeEventListener('resize',resizeChat);
  viewport?.removeEventListener('scroll',resizeChat);
  if(dialog.open)dialog.close();
  key.value=question.value=note.value='';
  share.checked=false;
  greeting=null;
  editing=false;
  history=[];
  record=null;
  notify('');
  memoryStatus.textContent='';
  messages.replaceChildren();
  notes.replaceChildren();
  setPanel(null);
  updateMemory();
  updateProvider();
 }
 function showPlant(name){
  $('target').textContent=name;
  const welcome='关于【'+name+'】，你还有哪些方面想要了解/补充？';
  if(greeting)greeting.querySelector('p').textContent=welcome;
  else greeting=message('植物养护助手',welcome);
 }
 function present(library){
  $('title').textContent=library?'观察记忆':'植物养护助手';
  $('target').textContent=library?'我的云端观察':'';
  $('settings').hidden=library;
  dialog.querySelector('.ask-toolbar').hidden=library;
  dialog.querySelector('.ask-compose').hidden=library;
  $('note-editor').hidden=library;
  $('share-option').hidden=true;
  messages.hidden=quick.hidden=library;
  dialog.showModal();
  resizeChat();
  viewport?.addEventListener('resize',resizeChat);
  viewport?.addEventListener('scroll',resizeChat);
  scroller.scrollTop=0;
 }
 function open({threadId,turnId,candidateIndex,label}){
  if(!isLoggedIn())return showAuth();
  if(!threadId)return;
  close();
  record={threadId,turnId,candidateIndex};
  present(false);
  if(label)showPlant(label);
  if(!choices.size)notify('问答服务商尚未加载，请刷新后再试。');
  void manageMemory();
 }
 function openLibrary(){
  if(!isLoggedIn())return showAuth();
  close();
  record={};
  present(true);
  setPanel('memory');
  void manageMemory();
 }
 function message(title,text,isUser=false){
  const entry=document.createElement('section');
  entry.className=isUser?'ask-message user':'ask-message';
  const heading=document.createElement('strong'),description=document.createElement('p');
  heading.textContent=title;
  description.textContent=text;
  entry.append(heading,description);
  messages.append(entry);
  return entry;
 }
 function scrollToReply(){scroller.scrollTop=scroller.scrollHeight}
 for(const button of quick.querySelectorAll('button'))button.onclick=()=>{
  question.value=button.textContent;
  updateProvider();
  question.focus();
 };
 question.addEventListener('input',updateProvider);
 function appendImages(entry,images){
  const gallery=document.createElement('div');
  gallery.className='ask-gallery';
  for(const photo of images){
   if(!/^\/plant-id\/(?:photos\/[a-z0-9-]+\.jpg|api\/reference-image\/(?:wm-)?\d+)$/.test(photo.src))continue;
   const figure=document.createElement('figure'),image=document.createElement('img');
   const caption=document.createElement('figcaption'),source=document.createElement('a'),license=document.createElement('a');
   image.src=photo.src;
   image.alt=photo.scientificName+' 参考图';
   image.loading='lazy';
   source.href=photo.source;
   source.textContent=photo.attribution;
   license.href=photo.licenseUrl;
   license.textContent=photo.license;
   for(const link of [source,license]){link.target='_blank';link.rel='noopener noreferrer'}
   caption.append(photo.scientificName+' · ',source,' · ',license,photo.changes?' · '+photo.changes:'');
   image.addEventListener('error',()=>{image.hidden=true;caption.prepend('图片暂时无法加载。')},{once:true});
   figure.append(image,caption);
   gallery.append(figure);
  }
  if(gallery.children.length)entry.append(gallery);
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const choice=choices.get(provider.value),input=question.value.trim(),imagesOnly=wantsImages(input);
  if(!record?.threadId||(!choice&&!imagesOnly)||pending||!record.turnId&&memoryPending)return;
  if(!input)return question.focus();
  const submitted=!imagesOnly&&(!savedProviders.has(choice.id)||editing);
  if(submitted&&!/^[!-~]{8,512}$/.test(key.value.trim())){
   setPanel('provider');
   notify('请填写所选服务商的 API Key。');
   key.focus();
   return;
  }
  const credential=submitted?{apiKey:key.value.trim(),rememberKey:true}:{};
  const current=new AbortController();
  pending=current;
  const userMessage=message('你',input,true);
  quick.hidden=true;
  question.value='';
  setPanel(null);
  updateProvider();
  notify(imagesOnly?'正在查找参考图片…':'正在生成回答…',true);
  scrollToReply();
  try{
   const params=new URLSearchParams(Object.entries(record).filter(([,value])=>value!==undefined));
   const reply=imagesOnly?await api('ask/images?'+params,{signal:current.signal}):await api('ask',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({provider:choice.id,...credential,question:input,...record,history}),
    signal:current.signal,
   });
   if(pending!==current)return;
   if(!imagesOnly){
    if(reply.savedKey)savedProviders.add(choice.id);
    key.value='';
    editing=false;
   }
   const entry=message('植物养护助手',reply.text);
   if(reply.images?.length)appendImages(entry,reply.images);
   if(reply.sources?.length){
    const details=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('ul');
    summary.textContent='参考资料';
    for(const source of reply.sources){
     const item=document.createElement('li'),link=document.createElement('a');
     link.textContent=source.title;link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';
     item.append(link);list.append(item);
    }
    details.append(summary,list);entry.append(details);
   }
   history=[...history,{question:input,answer:reply.text.slice(0,3000)}].slice(-4);
   while(messages.children.length>17)messages.children[1].remove();
   notify(reply.truncated?'回答达到长度上限，可以继续追问。':'');
   scrollToReply();
  }catch(error){
   if(pending!==current)return;
   userMessage.remove();
   question.value=input;
   quick.hidden=history.length>0;
   if(!imagesOnly&&['ask_key_invalid','ask_key_required'].includes(error.code)){
    if(!submitted)savedProviders.delete(choice.id);
    key.value='';
    setPanel('provider');
   }
   notify(error.message);
  }finally{
   if(pending===current){pending=null;updateProvider()}
  }
 });
 $('close').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
 window.addEventListener('pagehide',close);
 return {open,openLibrary,close,configure};
}
