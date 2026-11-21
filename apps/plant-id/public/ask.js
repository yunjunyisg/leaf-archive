export function createPlantQuestion({api,isLoggedIn,showAuth}){
 const dialog=document.querySelector('#ask-dialog');
 const form=dialog.querySelector('form');
 const key=dialog.querySelector('#ask-key');
 const provider=dialog.querySelector('#ask-provider');
 const model=dialog.querySelector('#ask-model');
 const question=dialog.querySelector('#ask-question');
 const status=dialog.querySelector('#ask-status');
 const messages=dialog.querySelector('#ask-messages');
 const target=dialog.querySelector('#ask-target');
 const submit=dialog.querySelector('#ask-send');
 let plant='',history=[],pending=null;
 let choices=new Map();

 function updateProvider(){
  const choice=choices.get(provider.value);
  model.value=choice?.model||'';
  model.readOnly=!choice?.allowModel;
  model.disabled=!choice;
  submit.disabled=!choice||Boolean(pending);
 }
 function configure(options){
  const selected=provider.value;
  choices=new Map(options.map(item=>[item.id,item]));
  provider.replaceChildren(...options.map(item=>new Option(item.label,item.id)));
  if(choices.has(selected))provider.value=selected;
  if(!dialog.open||!choices.has(selected))updateProvider();
 }
 provider.addEventListener('change',()=>{
  key.value='';
  history=[];
  messages.replaceChildren();
  updateProvider();
  status.textContent='请输入新服务商的 API Key。';
 });

 function close(){
  pending?.abort();
  pending=null;
  if(dialog.open)dialog.close();
  form.reset();
  history=[];
  plant='';
  status.textContent='';
  messages.replaceChildren();
  provider.disabled=false;
  model.disabled=false;
  updateProvider();
 }
 function open(name=''){
  if(!isLoggedIn())return showAuth();
  close();
  plant=String(name).slice(0,120);
  target.textContent=plant?'关于 '+plant:'可以询问鉴别、形态、生境或养护。';
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
  if(!choice||pending||!question.value.trim())return;
  const current=new AbortController();
  pending=current;
  const input=question.value.trim();
  submit.disabled=true;
  provider.disabled=model.disabled=true;
  status.textContent='正在读取植物资料并调用 '+choice.label+'…';
  try{
   const reply=await api('ask',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({provider:choice.id,model:model.value,apiKey:key.value,question:input,plant,history:history.slice(-4)}),
    signal:current.signal,
   });
   if(pending!==current||!dialog.open)return;
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
   if(pending===current)status.textContent=error.message;
  }finally{
   if(pending===current){pending=null;provider.disabled=false;model.disabled=false;submit.disabled=false}
  }
 });
 dialog.querySelector('#ask-close').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
 window.addEventListener('pagehide',close);
 return {open,close,configure};
}
