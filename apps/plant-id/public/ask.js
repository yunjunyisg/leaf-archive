export function createPlantQuestion({api,isLoggedIn,showAuth}){
 const dialog=document.querySelector('#ask-dialog');
 const form=dialog.querySelector('form');
 const key=dialog.querySelector('#ask-key');
 const provider=dialog.querySelector('#ask-provider');
 const keyEntry=dialog.querySelector('#ask-key-entry');
 const savedKey=dialog.querySelector('#ask-saved-key');
 const changeKey=dialog.querySelector('#ask-change-key');
 const cancelKey=dialog.querySelector('#ask-cancel-key');
 const question=dialog.querySelector('#ask-question');
 const status=dialog.querySelector('#ask-status');
 const messages=dialog.querySelector('#ask-messages');
 const target=dialog.querySelector('#ask-target');
 const submit=dialog.querySelector('#ask-send');
 let record=null,history=[],pending=null,editing=false;
 let choices=new Map(),savedProviders=new Set();

 function updateProvider(){
  const available=choices.has(provider.value);
  const saved=savedProviders.has(provider.value);
  const showKey=available&&(!saved||editing);
  savedKey.hidden=!saved||editing;
  keyEntry.hidden=!showKey;
  key.required=showKey;
  key.disabled=!showKey||Boolean(pending);
  changeKey.disabled=cancelKey.disabled=provider.disabled=Boolean(pending);
  cancelKey.hidden=!saved;
  submit.disabled=!available||Boolean(pending);
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
 provider.addEventListener('change',()=>{
  key.value='';
  editing=false;
  history=[];
  messages.replaceChildren();
  status.textContent='';
  updateProvider();
 });
 changeKey.onclick=()=>{
  editing=true;
  status.textContent='';
  updateProvider();
  key.focus();
 };
 cancelKey.onclick=()=>{
  editing=false;
  key.value='';
  status.textContent='';
  updateProvider();
  changeKey.focus();
 };

 function close(){
  pending?.abort();
  pending=null;
  if(dialog.open)dialog.close();
  const selected=provider.value;
  form.reset();
  if(choices.has(selected))provider.value=selected;
  editing=false;
  history=[];
  record=null;
  status.textContent='';
  messages.replaceChildren();
  updateProvider();
 }
 function open({threadId,turnId,candidateIndex,label}){
  if(!isLoggedIn())return showAuth();
  if(!threadId)return;
  close();
  record={threadId,turnId,candidateIndex};
  target.textContent='关于 '+(label||'这条识别记录');
  dialog.showModal();
  if(!choices.size)status.textContent='问答服务商尚未加载，请刷新后再试。';
 }
 function message(title,text){
  const entry=document.createElement('section');
  entry.className='ask-message';
  const heading=document.createElement('strong'),description=document.createElement('p');
  heading.textContent=title;
  description.textContent=text;
  entry.append(heading,description);
  messages.append(entry);
  return entry;
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const choice=choices.get(provider.value);
  if(!record||!choice||pending||!question.value.trim())return;
  const current=new AbortController();
  pending=current;
  const input=question.value.trim();
  const submitted=key.required;
  const credential=submitted?{apiKey:key.value,rememberKey:true}:{};
  updateProvider();
  status.textContent='正在读取植物资料并调用 '+choice.label+'…';
  try{
   const reply=await api('ask',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({provider:choice.id,...credential,question:input,...record,history:history.slice(-4)}),
    signal:current.signal,
   });
   if(pending!==current||!dialog.open)return;
   if(reply.savedKey)savedProviders.add(choice.id);
   key.value='';
   editing=false;
   message('你',input);
   const entry=message((reply.provider||choice.label)+' · DSH',reply.text);
   if(reply.sources?.length){
    const details=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('ul');
    summary.textContent='本轮查到的植物资料';
    for(const source of reply.sources){
     const item=document.createElement('li'),link=document.createElement('a');
     link.textContent=source.title;link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';
     item.append(link);list.append(item);
    }
    details.append(summary,list);entry.append(details);
   }
   history=[...history,{question:input,answer:reply.text.slice(0,3000)}].slice(-4);
   while(messages.children.length>16)messages.firstElementChild.remove();
   question.value='';
   status.textContent=reply.truncated?'回答达到长度上限。可以继续追问。':'';
   messages.scrollTop=messages.scrollHeight;
  }catch(error){
   if(pending!==current)return;
   if(['ask_key_invalid','ask_key_required'].includes(error.code)){
    if(!submitted)savedProviders.delete(choice.id);
    key.value='';
   }
   status.textContent=error.message;
  }finally{
   if(pending===current){pending=null;updateProvider()}
  }
 });
 dialog.querySelector('#ask-close').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
 window.addEventListener('pagehide',close);
 return {open,close,configure};
}
