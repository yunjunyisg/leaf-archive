export function createPlantQuestion({api,isLoggedIn,showAuth}){
 const dialog=document.querySelector('#ask-dialog');
 const form=dialog.querySelector('form');
 const key=dialog.querySelector('#ask-key');
 const question=dialog.querySelector('#ask-question');
 const status=dialog.querySelector('#ask-status');
 const messages=dialog.querySelector('#ask-messages');
 const target=dialog.querySelector('#ask-target');
 const submit=dialog.querySelector('#ask-send');
 let plant='',history=[],pending=null;

 function close(){
  pending?.abort();
  pending=null;
  if(dialog.open)dialog.close();
  form.reset();
  history=[];
  plant='';
  status.textContent='';
  messages.replaceChildren();
  submit.disabled=false;
 }
 function open(name=''){
  if(!isLoggedIn())return showAuth();
  close();
  plant=String(name).slice(0,120);
  target.textContent=plant?'关于 '+plant:'可以询问鉴别、形态、生境或养护。';
  dialog.showModal();
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
  if(pending||!question.value.trim())return;
  const current=new AbortController();
  pending=current;
  const input=question.value.trim();
  submit.disabled=true;
  status.textContent='正在读取植物资料并调用 DeepSeek…';
  try{
   const reply=await api('ask',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({apiKey:key.value,question:input,plant,history:history.slice(-4)}),
    signal:current.signal,
   });
   if(pending!==current||!dialog.open)return;
   message('你',input);
   const entry=message('DeepSeek · DSH',reply.text);
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
   if(pending===current)status.textContent=error.message;
  }finally{
   if(pending===current){pending=null;submit.disabled=false}
  }
 });
 dialog.querySelector('#ask-close').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
 window.addEventListener('pagehide',close);
 return {open,close};
}
