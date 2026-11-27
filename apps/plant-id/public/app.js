import {createPlantQuestion} from '/plant-id/ask.js';
const $=selector=>document.querySelector(selector),state={user:null,configured:false,registration:true,photos:[],threadId:'',busy:false,preparing:0,epoch:0,photoEpoch:0,mode:'login',controller:null};
const api=async(path,options={})=>{const token=state.epoch,response=await fetch('/plant-id/api/'+path,{credentials:'same-origin',...options});let data;try{data=await response.json()}catch{throw Error('服务器暂时不可用，请稍后重试')}if(!response.ok){if(response.status===401&&token===state.epoch&&!['login','register'].includes(path)){clearPrivate();showAuth()}throw Object.assign(Error(data.error||'操作未完成，请重试'),{code:data.code})}return data};
let historyRequest=0;
const notice=text=>{$('#notice').textContent=text};
function el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node}
function clearPhotos(){state.photoEpoch++;for(const photo of state.photos)URL.revokeObjectURL(photo.url);state.photos=[];$('#photos').value='';$('#previews').replaceChildren();$('#photo-note').hidden=true;$('#large-photo').removeAttribute('src');$('#photo-dialog').close()}
const plantQuestion=createPlantQuestion({api,isLoggedIn:()=>Boolean(state.user),showAuth});
const viewingHistory=document.body.dataset.view==='history';
const resumeLink=$('#resume-identification');
const pageUrl=new URL(location.href);
if(!viewingHistory&&pageUrl.hash==='#history-list')location.replace('/plant-id/history');
function clearPrivate(){plantQuestion.close();plantQuestion.configure([],[]);state.epoch++;historyRequest++;state.controller?.abort();state.controller=null;state.user=null;state.threadId='';state.openingRecord=null;resumeLink.hidden=true;state.busy=false;clearPhotos();$('#results').replaceChildren();$('#description').value='';$('#plantName').value='';$('#consent').checked=false;$('#history-list').replaceChildren(el('p','登录后查看自己的记录。','muted'));$('#account-dialog').close();$('#account').textContent='登录 / 注册';$('#quota').textContent='识别结果是参考线索，不能替代实物核对。';setBusy(false)}
async function session(){const token=state.epoch,data=await api('session');if(token!==state.epoch)return data;if(state.user&&data.user?.id!==state.user.id)clearPrivate();state.user=data.user;plantQuestion.configure(data.askProviders||[],data.savedAskProviders||[]);savedResultLimit=data.historyLimit??10;state.configured=data.configured;state.registration=data.registration;$('#consent-label').textContent='同意将本轮照片、名称、描述及当前记录的上一轮结果发送至'+data.provider+'中国内地视觉服务。填写的中文名称可能用于查询 iNaturalist 俗名。';$('#account').textContent=data.user?data.user.username:'登录 / 注册';$('#model-status').textContent=data.configured?'视觉服务：'+data.provider+' · '+data.model+' · 中国内地接口':'视觉服务尚未开通，暂不能识别；管理员配置后即可使用。';$('#quota').textContent=data.user?'站内不限每日识别次数，仍受模型服务额度和并发限制。':'登录后可保存自己的识别文字记录。';return data}
function setBusy(busy){state.busy=busy;$('#submit').disabled=busy||state.preparing>0;$('#submit').textContent=busy?'正在观察与比较…':state.threadId?'更新识别':'开始识别';$('#cancel').hidden=!busy;for(const button of document.querySelectorAll('#history-list button'))button.disabled=busy;$('#results').setAttribute('aria-busy',String(busy))}
function showAuth(){state.mode='login';renderAuth();if(!$('#auth').open)$('#auth').showModal()}
function renderAuth(){$('#auth-title').textContent=state.mode==='login'?'登录识植助手':'注册识植助手';$('#auth-submit').textContent=state.mode==='login'?'登录':'注册并登录';$('#auth-toggle').hidden=!state.registration;$('#auth-toggle').textContent=state.mode==='login'?'没有识植助手账号？注册':'已有账号？登录';$('#password').autocomplete=state.mode==='login'?'current-password':'new-password';$('#auth-error').textContent=''}
$('#account').onclick=()=>{if(!state.user)return showAuth();$('#account-name').textContent='当前账号：'+state.user.username;$('#logout-error').textContent='';$('#account-dialog').showModal()};$('#account-close').onclick=()=>$('#account-dialog').close();$('#auth-close').onclick=()=>$('#auth').close();$('#auth').addEventListener('close',()=>{$('#password').value=''});$('#auth-toggle').onclick=()=>{state.mode=state.mode==='login'?'register':'login';renderAuth()};
$('#auth-form').onsubmit=async event=>{event.preventDefault();const token=state.epoch;$('#auth-submit').disabled=true;$('#auth-toggle').disabled=true;try{const data=await api(state.mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('#username').value,password:$('#password').value})});if(token!==state.epoch)return;state.epoch++;state.user=data.user;$('#auth').close();await loadPage()}catch(error){$('#auth-error').textContent=error.message}finally{$('#auth-submit').disabled=false;$('#auth-toggle').disabled=false}};
$('#logout').onclick=async()=>{$('#logout').disabled=true;try{await api('logout',{method:'POST'});clearPrivate();notice('已退出识植助手。')}catch(error){$('#logout-error').textContent=error.message}finally{$('#logout').disabled=false}};
function renderPhotos(){const box=$('#previews');box.replaceChildren();for(const [index,photo]of state.photos.entries()){const wrap=el('div',undefined,'preview'),button=el('button'),img=el('img');button.type='button';button.setAttribute('aria-label','预览第 '+(index+1)+' 张照片');img.src=photo.url;img.alt='待识别植物照片 '+(index+1);button.append(img);button.onclick=()=>{$('#large-photo').src=photo.url;$('#photo-dialog').showModal()};const remove=el('button','移除照片 '+(index+1),'remove');remove.type='button';remove.onclick=()=>{URL.revokeObjectURL(photo.url);state.photos.splice(index,1);renderPhotos()};wrap.append(button,remove);box.append(wrap)}$('#photo-note').hidden=!state.photos.length}
async function preparePhotos(files){const token=state.photoEpoch;if(state.preparing)return notice('照片正在处理，请稍等。');const incoming=[...files];if(state.photos.length+incoming.length>3)return notice('每轮最多选择三张照片，请先移除不需要的照片。');if(incoming.some(f=>!/^image\/(jpeg|png|webp)$/.test(f.type)||f.size>20*1024*1024))return notice('请选择 JPG、PNG 或 WebP，原图单张不超过 20 MiB。');state.preparing++;setBusy(state.busy);notice('正在本机准备识别副本…');try{const prepared=[];try{for(const file of incoming){const bitmap=await createImageBitmap(file);try{const scale=Math.min(1,2048/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));if(!blob||blob.size>5*1024*1024)throw Error('识别副本仍然过大，请换一张照片。');prepared.push({blob,url:URL.createObjectURL(blob)})}finally{bitmap.close()}}}catch(error){for(const photo of prepared)URL.revokeObjectURL(photo.url);throw error}if(token!==state.photoEpoch){for(const photo of prepared)URL.revokeObjectURL(photo.url);return}state.photos.push(...prepared);renderPhotos();notice('照片已就绪，可以补充描述后开始识别。')}catch(error){if(token===state.photoEpoch)notice(error.message||'无法读取照片，请换成 JPG 或 PNG。')}finally{state.preparing--;$('#photos').value='';setBusy(state.busy)}}
$('#photos').onchange=()=>preparePhotos($('#photos').files);const drop=$('#dropzone');for(const name of ['dragenter','dragover'])drop.addEventListener(name,event=>{event.preventDefault();drop.classList.add('dragover')});for(const name of ['dragleave','drop'])drop.addEventListener(name,event=>{event.preventDefault();drop.classList.remove('dragover')});drop.addEventListener('drop',event=>preparePhotos(event.dataTransfer.files));$('#photo-close').onclick=()=>$('#photo-dialog').close();$('#photo-dialog').addEventListener('close',()=>$('#large-photo').removeAttribute('src'));
function appendList(parent,items){if(!items.length)return parent.append(el('p','待确认'));const list=el('ul');for(const text of items)list.append(el('li',text));parent.append(list)}
const referenceQueue=[];
let savedResultLimit=10;
let activeReferences=0;
function loadReferences(){
 while(activeReferences<3&&referenceQueue.length){
  const {figure,name,rank}=referenceQueue.shift();
  if(!figure.isConnected)continue;
  activeReferences++;
  const showStatus=text=>figure.replaceChildren(el('p',text,'muted'));
  api('reference?'+new URLSearchParams({name,rank})).then(({photo,reading})=>{
   if(!figure.isConnected)return;
   if(reading){
    const details=el('details',undefined,'candidate-knowledge');
    const source=el('a','维基百科作者及原文'),license=el('a','CC BY-SA 4.0');
    source.href=reading.url;source.target='_blank';source.rel='noopener noreferrer';
    license.href=reading.licenseUrl;license.target='_blank';license.rel='noopener noreferrer';
    const credits=el('p');credits.append(source,' · ',license);
    details.append(el('summary','公开植物描述（原文节选）'),el('p',reading.text),credits);
    figure.after(details);
   }
   if(!photo)return showStatus('暂无可核对的参考图。');
   const link=el('a'),image=el('img'),caption=el('figcaption');
   link.href=photo.source;
   link.target='_blank';
   link.rel='noopener noreferrer';
   image.alt=photo.scientificName+' 参考图';
   image.loading='lazy';
   image.addEventListener('error',()=>{image.remove();caption.prepend('图片暂时无法加载。 ')},{once:true});
   image.src='/plant-id/api/reference-image/'+encodeURIComponent(photo.id);
   link.append(image);
   const source=el('a','查看 iNaturalist 原始观察');
   source.href=photo.source;source.target='_blank';source.rel='noopener noreferrer';
   const license=el('a',photo.license);
   license.href=photo.licenseUrl;license.target='_blank';license.rel='noopener noreferrer';
   caption.append('参考图 · '+photo.scientificName+' · '+photo.attribution+' · ',license,' · ',source);
   figure.replaceChildren(link,caption);
  }).catch(()=>{if(figure.isConnected)showStatus('参考图暂时无法加载。')})
    .finally(()=>{activeReferences--;loadReferences()});
 }
}

function candidateReference(candidate){
 const figure=el('figure',undefined,'candidate-reference');
 if(!candidate.scientificName){
  figure.append(el('p','暂无可用于匹配参考图的学名。','muted'));
  return figure;
 }
 figure.append(el('p','正在查找参考图…','muted'));
 referenceQueue.push({figure,name:candidate.knowledge?.name||candidate.scientificName,rank:candidate.rank});
 queueMicrotask(loadReferences);
 return figure;
}

function candidateKnowledge(entry){
 const details=el('details',undefined,'candidate-knowledge');
 details.append(el('summary','查阅植物资料'));
 const externalLink=(label,href)=>{
  const link=el('a',label);
  link.href=href;link.target='_blank';link.rel='noopener noreferrer';
  return link;
 };
 const taxonomy=el('p',entry.synonym?'名录接受学名 '+entry.name+'。':entry.name);
 if(entry.family)taxonomy.append(' · '+entry.family);
 taxonomy.append(' · ',externalLink((entry.sourceName||'GBIF')+' 分类记录',entry.source));
 if(entry.gbifSource)taxonomy.append(' · ',externalLink('GBIF 分类记录',entry.gbifSource));
 details.append(taxonomy);
 if(entry.traits){
  const traits=el('p',entry.traits.zh+'属级核对特征：'+entry.traits.traits);
  traits.append(' ',externalLink(entry.traits.sourceName,entry.traits.source));
  details.append(traits);
 }
 if(entry.observations.length){
  const items=el('ul');
  for(const observation of entry.observations){
   const item=el('li');
   item.append(externalLink(observation.platform+' 公开观察',observation.url));
   items.append(item);
  }
  details.append(items);
 }
 return details;
}
const nameReviewLabels={
 exact:'名录接受名',synonym:'异名对应的接受名',expanded:'按上下文展开缩写',
 spelling:'可能的拼写更正',common:'俗名线索',unmatched:'暂无明确的名录匹配',
};
const identificationRanks={species:'种',genus:'属',family:'科',undetermined:'待定'};
function appendNameReview(section,reviews){
 if(!reviews?.length)return;
 const block=el('section',undefined,'candidate-knowledge');
 block.append(el('h3','名称核对'));
 const list=el('ul');
 for(const review of reviews){
  const item=el('li');
  item.append(review.input+' · '+nameReviewLabels[review.kind]);
  if(review.name){
   const link=el('a',review.name);
   link.href=review.source;link.target='_blank';link.rel='noopener noreferrer';
   item.append(' · ',link,'（'+identificationRanks[review.rank]+'）');
  }
  list.append(item);
 }
 block.append(list,el('p','名称是线索，实际个体的判定还要看照片和特征。','muted'));
 section.append(block);
}
function recordQuestionButton(title,record,className='subtle'){
 const button=el('button',title,className);
 button.type='button';
 button.onclick=()=>plantQuestion.open(record);
 return button;
}
function renderAnswer(answer,description,{threadId,turnId}={}){const section=el('article',undefined,'result saved-result');if(description)section.append(el('p',description,'user-description'));section.append(el('span','观察结果 · 请继续核对','eyebrow'));const first=answer.candidates[0],uncertain=answer.otherProbability>(first?.probability||0);section.append(el('h2',uncertain?'目前无法确定。'+answer.summary:answer.summary));if(answer.resolution){const rank=identificationRanks[answer.resolution.rank];if(rank)section.append(el('p','当前判定层级：'+rank+'。'+answer.resolution.reason,'muted'))}appendNameReview(section,answer.nameReview);
 if(threadId&&turnId){
  const actions=el('div',undefined,'result-ask-row');
  actions.append(recordQuestionButton('植物养护助手',{threadId,turnId,label:answer.candidates[0]?.name}));
  section.append(actions);
 }
 for(const [candidateIndex,candidate] of answer.candidates.entries()){const card=el('div',undefined,'candidate'),head=el('div',undefined,'candidate-head'),name=el('div');name.append(el('h3',candidate.name),el('span',[candidate.knowledge?.name||candidate.scientificName,candidate.rank].filter(Boolean).join(' · '),'scientific'));head.append(name,el('span',candidate.probability+'%','probability'));const progress=el('progress');progress.max=100;progress.value=candidate.probability;progress.setAttribute('aria-label',candidate.name+'估计概率');const evidence=el('div',undefined,'evidence');for(const [title,items]of [['为什么可能',candidate.evidence],['怎么区分',candidate.distinguish]]){const column=el('div');column.append(el('h4',title));appendList(column,items);evidence.append(column)}card.append(head,progress);
 if(threadId&&turnId)card.append(recordQuestionButton('询问这株植物',{threadId,turnId,candidateIndex,label:candidate.name||candidate.scientificName}));if(candidate.description){const profile=el('div',undefined,'candidate-description');profile.append(el('h4','植物描述'),el('p',candidate.description),el('small','模型整理的典型特征'));card.append(profile)}card.append(candidateReference(candidate),evidence);if(candidate.knowledge)card.append(candidateKnowledge(candidate.knowledge));section.append(card)}const other=el('div',undefined,'other');other.append(el('span','其他可能 / 证据不足'),el('strong',answer.otherProbability+'%'));section.append(other);const details=el('details',undefined,'observations');details.append(el('summary','查看本轮观察与待确认特征'));for(const [title,items]of [['照片中可见',answer.observations.visible],['用户描述',answer.observations.described],['待确认',answer.observations.uncertain]]){details.append(el('strong',title));appendList(details,items)}section.append(details);if(answer.followUp.length){const follow=el('div',undefined,'follow-up');follow.append(el('h3','下一步，拍清这些特征'));appendList(follow,answer.followUp);section.append(follow)}section.append(el('p','百分比是当前证据下的粗略估计，会随补充信息变化。','muted'));$('#results').append(section);const saved=$('#results').querySelectorAll('.saved-result');for(const old of Array.from(saved).slice(0,-savedResultLimit))old.remove();return section}
async function openRecord(id){
 if(state.busy||!state.user)return;
 const token=++state.epoch;
 state.openingRecord=id;
 try{
  const data=await api('threads/'+id);
  if(token!==state.epoch)return;
  clearPhotos();
  $('#description').value='';
  $('#plantName').value='';
  $('#results').replaceChildren();
  state.threadId=id;
  for(const turn of data.turns)renderAnswer(turn.answer,turn.description,{threadId:id,turnId:turn.id});
  resumeLink.hidden=!viewingHistory;
  if(viewingHistory)resumeLink.href='/plant-id/?record='+encodeURIComponent(id);
  setBusy(false);
  notice(viewingHistory?'已打开历史文字记录。':'已打开记录，可添加照片或特征继续识别。');
  if(viewingHistory)$('#notice').scrollIntoView({behavior:'instant',block:'start'});
 }catch(error){if(token===state.epoch)notice(error.message)}
 finally{if(token===state.epoch)state.openingRecord=null}
}
async function history(){
 if(!viewingHistory||!state.user)return;
 const token=++historyRequest,owner=state.user;
 const data=await api('threads');
 if(token!==historyRequest||state.user?.id!==owner.id)return;
 const list=$('#history-list');
 list.replaceChildren();
 if(!data.threads.length)list.append(el('p','保存第一条识别结果后，可在此查看。','muted'));
 for(const thread of data.threads){
  const row=el('div',undefined,'history-item');
  const open=el('button',undefined,'history-open');
  open.append(el('span',thread.title),el('small',new Date(thread.updated).toLocaleDateString('zh-CN')));
  open.onclick=()=>openRecord(thread.id);
  const remove=el('button','删除','subtle');
  remove.setAttribute('aria-label','删除记录 '+thread.title);
  remove.onclick=async()=>{
   if(!confirm('删除这条识别文字记录？'))return;
   const owner=state.user;if(!owner)return;remove.disabled=true;
   try{
    await api('threads/'+thread.id,{method:'DELETE'});
    if(state.user?.id!==owner.id)return;
    if(state.openingRecord===thread.id){state.epoch++;state.openingRecord=null}
    if(state.threadId===thread.id){
     state.threadId='';
     resumeLink.hidden=true;
     $('#results').replaceChildren();
     notice('识别记录已删除。');
    }
    await history();
   }catch(error){if(state.user?.id===owner.id)notice(error.message)}
   finally{remove.disabled=state.busy}
  };
  row.append(open,recordQuestionButton('提问',{threadId:thread.id,label:thread.title},'subtle record-ask'),remove);
  list.append(row);
 }
}
async function loadPage(){
 await session();
 if(viewingHistory)return history();
 const id=pageUrl.searchParams.get('record')||'';
 if(/^[a-f0-9-]{36}$/.test(id)&&state.user&&!state.threadId)await openRecord(id);
}
$('#cancel').onclick=()=>{state.epoch++;state.controller?.abort();state.controller=null;setBusy(false);notice('已停止等待。已提交的请求仍可能产生模型用量。');session().catch(()=>{})};
function renderModelReply(fallback,nameReview){
 const section=el('article',undefined,'result');
 section.append(
  el('h2',fallback.truncated?'模型回复（部分）':'模型回复'),
  el('p','此回复无法整理成候选卡片，仅供核对，未保存到识别记录。','muted'),
  el('p',fallback.text,'user-description'),
 );
 appendNameReview(section,nameReview);
 $('#results').append(section);
 return section;
}
$('#identify-form').onsubmit=async event=>{event.preventDefault();if(state.busy||state.preparing)return;if(!state.user)return showAuth();if(!state.configured)return notice('识别服务尚未开通，请联系管理员配置视觉模型。');if(!state.photos.length&&!$('#description').value.trim()&&!$('#plantName').value.trim())return notice('请先选择照片，或填写植物的名称或特征。');if(!$('#consent').checked)return notice('请先勾选同意发送本轮照片和描述。');const token=++state.epoch,description=$('#description').value,plantName=$('#plantName').value,form=new FormData();form.set('text',description);form.set('plantName',plantName);form.set('consent','yes');if(state.threadId)form.set('threadId',state.threadId);for(const [i,photo]of state.photos.entries())form.append('images',photo.blob,'plant-'+i+'.jpg');state.controller=new AbortController();setBusy(true);notice('正在查看照片并比较候选，通常需要十几秒，请稍等。');try{const data=await api('identify',{method:'POST',body:form,signal:state.controller.signal});if(token!==state.epoch)return;if(data.fallback){const reply=renderModelReply(data.fallback,data.nameReview);notice(data.fallback.truncated?'回复被截断，可保留最清楚的一张照片再试。':'已显示模型回复，可核对文字或调整照片后再试。');reply.scrollIntoView({block:'start'});return}state.threadId=data.threadId;const result=renderAnswer(data.answer,description,{threadId:data.threadId,turnId:data.turnId});if($('#description').value===description)$('#description').value='';if($('#plantName').value===plantName)$('#plantName').value='';notice('识别已更新。可补拍照片或填写新的特征继续核对。');result.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})}catch(error){if(token===state.epoch)notice(error.name==='AbortError'?'已停止等待。':error.message)}finally{if(token===state.epoch){state.controller=null;setBusy(false)}}};
function resumePage(){loadPage().catch(error=>notice(error.message))}
window.addEventListener('pagehide',()=>{state.epoch++;historyRequest++;state.controller?.abort();state.controller=null;state.openingRecord=null;});
window.addEventListener('pageshow',event=>{if(event.persisted){setBusy(false);resumePage()}});
resumePage();
