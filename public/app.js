import {locationLabel,precisionLabels} from '/geography.js';
import {ranks,rankInfo,childRanks,referenceRank,plantPath,pathKey,buildTree} from '/taxonomy.js';
(()=>{
 const splash=document.querySelector('#welcomeSplash');if(!splash?.showModal)return;
 const button=document.querySelector('#enterGarden'),plant=document.querySelector('#welcomePlant');let closing=false,autoTimer,fallbackTimer;
 const welcomePlants=[
 {src:'/welcome/plant-0.webp',alt:'白色绒毛宽叶与鲜红捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-1.webp',alt:'浅绿绒毛叶与黄绿色捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-2.webp',alt:'银白细叶与密集红色捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-3.webp',alt:'绿色匙形叶与橙红捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-4.webp',alt:'细长直立叶柄与浅绿捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-5.webp',alt:'卷曲银白绒毛叶与粉红捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-6.webp',alt:'银白绒毛细叶与橙红捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-8.webp',alt:'深红叶柄与卷曲鲜红捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-9.webp',alt:'三株银绿细叶与粉红触毛的卡通茅膏菜'},
 {src:'/welcome/plant-11.webp',alt:'宽叶银白绒毛与鲜红捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-13.webp',alt:'带卷曲花梗与红黄圆形捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-14.webp',alt:'酒红放射叶柄与卷曲玫红捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-15.webp',alt:'三株银绿色细叶与粉红触毛的卡通茅膏菜'},
 {src:'/welcome/plant-16.webp',alt:'三株红绿细叶与浅绿圆形捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-17.webp',alt:'高挑绿叶柄与红黄圆形捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-18.webp',alt:'银白绒毛放射细叶与弯曲红色捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-19.webp',alt:'紧凑直立银白宽叶与橙红捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-20.webp',alt:'银白下垂细叶与橙黄捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-21.webp',alt:'紧凑绿叶与密集红色圆形捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-22.webp',alt:'双株高挑分枝茎与小型圆形捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-23.webp',alt:'鲜绿匙形叶与浅粉捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-24.webp',alt:'银绿放射细叶与卷曲深红捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-25.webp',alt:'小型银白绒毛株与浅橙捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-26.webp',alt:'红绿纤细叶柄与鲜红捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-27.webp',alt:'小型鲜绿稀疏株与细小粉红捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-28.webp',alt:'四株红绿细叶与红黄捕虫叶组合的卡通茅膏菜'},
 {src:'/welcome/plant-29.webp',alt:'超宽银白绒毛叶与红色圆形捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-30.webp',alt:'深酒红密集放射株与露珠捕虫叶的卡通茅膏菜'},
 {src:'/welcome/plant-31.webp',alt:'带弯曲花梗的酒红尖叶捕虫堇手绘图标'},
 {src:'/welcome/plant-32.webp',alt:'银白斑纹与红色叶缘的尖叶捕虫堇手绘图标'},
 {src:'/welcome/plant-33.webp',alt:'深酒红尖叶与直立卷叶的捕虫堇手绘图标'},
 {src:'/welcome/plant-34.webp',alt:'酒红圆叶与黄绿中纹的茅膏菜手绘图标'},
 {src:'/welcome/plant-35.webp',alt:'银绿红背细长叶柄与露珠捕虫叶的茅膏菜手绘图标'},
 {src:'/welcome/plant-36.webp',alt:'银绿绒毛宽叶与橙红捕虫叶的茅膏菜手绘图标'},
 {src:'/welcome/plant-37.webp',alt:'银粉长叶与鲜红露珠捕虫叶的茅膏菜手绘图标'},
 {src:'/welcome/plant-38.webp',alt:'黄绿绒毛长叶与橙红捕虫叶的茅膏菜手绘图标'},
 {src:'/welcome/plant-39.webp',alt:'深酒红圆叶与粉红内叶的茅膏菜手绘图标'},
 {src:'/welcome/plant-40.webp',alt:'鲜绿纤细放射叶柄与金黄捕虫叶的茅膏菜手绘图标'},
 {src:'/welcome/plant-41.webp',alt:'银绿纤细放射叶柄与红金捕虫叶的茅膏菜手绘图标'},
 {src:'/welcome/plant-42.webp',alt:'双株红色分枝茎与白色小花的直立茅膏菜手绘图标'},
 {src:'/welcome/plant-43.webp',alt:'浅绿直立茎与粉红露珠捕虫叶的小型茅膏菜手绘图标'},
 {src:'/welcome/plant-44.webp',alt:'银白绒毛宽叶与粉红叶背红色捕虫叶的茅膏菜手绘图标'},
 {src:'/welcome/plant-45.webp',alt:'深酒红放射叶柄与圆形捕虫叶的茅膏菜手绘图标'},
 {src:'/welcome/plant-46.webp',alt:'红色绒毛叶冠与灰褐枯叶柱的茅膏菜手绘图标'},
 {src:'/welcome/plant-47.webp',alt:'深酒红宽圆捕虫叶与紫红尖叶的茅膏菜手绘图标'},
 {src:'/welcome/plant-48.webp',alt:'粉红尖叶与向上卷曲宽圆捕虫叶的茅膏菜手绘图标'},
 {src:'/welcome/plant-49.webp',alt:'双株鲜绿稀疏长叶与浅粉小捕虫叶的茅膏菜手绘图标'},
 {src:'/welcome/plant-50.webp',alt:'橙粉放射叶柄与橙心红缘椭圆捕虫叶的茅膏菜手绘图标'},
 {src:'/welcome/plant-51.webp',alt:'银白绒毛密集圆盘与深红捕虫叶的茅膏菜手绘图标'},
 {src:'/welcome/plant-52.webp',alt:'银白绒毛直立细叶与橙红捕虫叶的奥德茅膏菜手绘图标'},
 {src:'/welcome/plant-53.webp',alt:'多株深红叶冠与灰褐枯叶柱的茅膏菜手绘图标'},
 {src:'/welcome/plant-54.webp',alt:'铜红放射叶柄与弯曲花梗的茅膏菜手绘图标'},
 {src:'/welcome/plant-55.webp',alt:'四株黄绿叶心与鲜红捕虫叶的茅膏菜手绘图标'},
 {src:'/welcome/plant-56.webp',alt:'红色细叶冠与细长枯叶柱的茅膏菜手绘图标'},
 {src:'/welcome/plant-57.webp',alt:'黄绿红叶与淡粉花朵的茅膏菜手绘图标'},
 {src:'/welcome/plant-58.webp',alt:'紫红捕虫囊与条纹囊盖的土瓶草手绘图标'},
 {src:'/welcome/plant-59.webp',alt:'金黄叶盘与铜橙果序的茅膏菜手绘图标'},
 {src:'/welcome/plant-60.webp',alt:'粉色长腺毛与晶莹露珠的茅膏菜手绘图标'},
 {src:'/welcome/plant-61.webp',alt:'黄绿圆叶与弯曲花梗淡粉花的茅膏菜手绘图标'},
 {src:'/welcome/plant-62.webp',alt:'黄绿囊身与酒红斑纹的猪笼草手绘图标'},
 {src:'/welcome/plant-63.webp',alt:'金黄直立茎与放射细长腺毛叶的食虫植物手绘图标'},
 {src:'/welcome/plant-64.webp',alt:'珊瑚红宽圆叶盘与卷曲新叶的茅膏菜手绘图标'},
 {src:'/welcome/plant-65.webp',alt:'浅绿绒毛叶柄与粉红椭圆捕虫叶的茅膏菜手绘图标'},
 {src:'/welcome/plant-66.webp',alt:'黄绿绒毛叶柄与珊瑚粉露珠叶盘的茅膏菜手绘图标'},
 {src:'/welcome/plant-67.webp',alt:'红色细长叶柄与圆形露珠捕虫叶的茅膏菜手绘图标'},
 {src:'/welcome/plant-68.webp',alt:'浅粉瓶身与黄绿斑纹的太阳瓶子草手绘图标'},
 {src:'/welcome/plant-69.webp?v=dry-1',alt:'酒红网纹蛇首与分叉舌叶的眼镜蛇瓶子草手绘图标'},
 {src:'/welcome/plant-70.webp',alt:'粉色宽叶与三朵紫白花的捕虫堇手绘图标'},
 {src:'/welcome/plant-71.webp',alt:'黄绿直立筒状叶与深褐枯叶基部的食虫凤梨手绘图标'},
 {src:'/welcome/plant-72.webp',alt:'粉红圆囊与红黄条纹宽囊口的猪笼草手绘图标'},
 {src:'/welcome/plant-73.webp',alt:'橙红长囊与深红齿状囊口的猪笼草手绘图标'},
 {src:'/welcome/plant-74.webp',alt:'黄绿纤细放射腺毛叶的食虫植物手绘图标'},
 {src:'/welcome/plant-75.webp',alt:'粉红长囊与红白条纹宽囊口的猪笼草手绘图标'},
 {src:'/welcome/plant-76.webp',alt:'细长分枝腺毛叶与淡紫粉花的食虫植物手绘图标'},
 {src:'/welcome/plant-77.webp',alt:'黄绿高筒捕虫叶与红粉垂花的瓶子草手绘图标'},
 {src:'/welcome/plant-78.webp',alt:'圆绿叶与成串白花黄喉的狸藻手绘图标'},
 {src:'/welcome/plant-79.webp',alt:'银白细毛与密集尖叶莲座的虎耳草手绘图标'},
 {src:'/welcome/plant-80.webp',alt:'两株鲜绿杯状圆叶莲座组合手绘图标'},
 {src:'/welcome/plant-81.webp',alt:'红色枝茎与黄绿透明捕虫叶的水生食虫植物手绘图标'},
 {src:'/welcome/plant-82.webp',alt:'黄绿细分枝与浅粉透明捕虫囊的水生狸藻手绘图标'},
 {src:'/welcome/plant-83.webp',alt:'奶白卷边与粉红匙形叶莲座的捕虫堇手绘图标'},
 {src:'/welcome/plant-84.webp',alt:'鲜绿波浪齿缘杯状捕虫夹的捕蝇草手绘图标'},
 {src:'/welcome/plant-85.webp',alt:'鲜红夹面与黄绿长齿缘的捕蝇草手绘图标'}
 ];
 const chosen=welcomePlants[Math.floor(Math.random()*welcomePlants.length)];plant.alt=chosen.alt;plant.src=chosen.src;
 function dismiss(){if(closing)return;closing=true;clearTimeout(autoTimer);clearTimeout(fallbackTimer);splash.classList.add('welcome-leaving');const finish=()=>{splash.close();document.querySelector('#search')?.focus({preventScroll:true})};if(matchMedia('(prefers-reduced-motion: reduce)').matches)finish();else setTimeout(finish,320)}
 function schedule(){if(autoTimer||closing)return;splash.classList.add('welcome-ready');clearTimeout(fallbackTimer);autoTimer=setTimeout(dismiss,matchMedia('(prefers-reduced-motion: reduce)').matches?1600:3200)}
 splash.showModal();button.onclick=dismiss;splash.addEventListener('cancel',event=>{event.preventDefault();dismiss()});plant.addEventListener('load',schedule,{once:true});plant.addEventListener('error',()=>{if(plant.getAttribute('src')!=='/welcome/plant-0.webp'){plant.src='/welcome/plant-0.webp';plant.alt=welcomePlants[0].alt}else dismiss()},{once:false});fallbackTimer=setTimeout(dismiss,7000);if(plant.complete){if(plant.naturalWidth)schedule();else dismiss()}
})();
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const classificationPage=document.body.dataset.page==='classification';
const originsPage=document.body.dataset.page==='origins';
let originsController=null,originsLoading=false,originPicker=null,originDraft=null;
const originMapModule=()=>import('/origin-map.js');
function renderOriginDraft(){const readout=$('#originLocationReadout');if(!readout)return;readout.textContent=originDraft?locationLabel(originDraft)+'\n'+originDraft.lat.toFixed(5)+', '+originDraft.lon.toFixed(5)+' · '+precisionLabels[originDraft.precision||'point']:'尚未标注地图位置。原有产地文字会保留。';$('#clearOriginLocation').hidden=!originDraft;}
function renderOriginView(){if(!originsPage)return;if(originsController){originsController.update();return;}if(originsLoading)return;originsLoading=true;originMapModule().then(module=>{originsController=module.createOriginMap({root:$('#originMapPanel'),getPlants:data,canEdit:()=>Boolean(authState?.user),openPlant:openDetail,editPlant:id=>openEditor(records.find(p=>p.id===id)),api,isDemo:()=>$('#demo').checked});const id=new URL(location.href).searchParams.get('plant');if(id)originsController.focusPlant(data().find(p=>p.id===id));}).catch(()=>{$('#originMapPanel').textContent='地图加载失败，请刷新页面重试。';}).finally(()=>{originsLoading=false;});}
const plantStatuses=['生长中','需关注','休眠中','已赠出','已死亡'];
const today=()=>new Date().toLocaleDateString('en-CA');
const money=v=>Number(v||0).toLocaleString('zh-CN',{maximumFractionDigits:2});
const taxonomyFields=['kingdom','division','className','order','tribe','section','series','species','identification','variety','form','infraspecific'];
const fields=[...taxonomyFields,'name','latin','number','sourceNumber','source','family','genus','description','origin','individualInfo','price','date','location','status','light','water','substrate','notes','lastWater','nextWater'];
const exampleData=[['龟背竹','Monstera deliciosa','天南星科','龟背竹属',128,'南向阳台','青山植物工作室','2026-09-12','生长中','叶片随成熟逐渐开裂，攀援生长，喜欢温暖湿润的环境。'],['水晶花烛','Anthurium crystallinum','天南星科','花烛属',268,'客厅窗边','雨林植物园','2026-09-05','生长中','深绿色心形叶片带有醒目的银白色叶脉。'],['二歧鹿角蕨','Platycerium bifurcatum','水龙骨科','鹿角蕨属',156,'北向窗台','蕨类研究所','2026-08-26','生长中','附生蕨类，具有盾状营养叶与分叉的孢子叶。'],['玉露','Haworthia cooperi','阿福花科','十二卷属',45,'书房窗边','小森多肉','2026-08-18','需关注','小型多肉植物，肉质叶片顶端具有透光的窗。'],['竹节秋海棠','Begonia maculata','秋海棠科','秋海棠属',68,'客厅窗边','青山植物工作室','2026-08-09','生长中','叶面点缀银白色斑点，叶背呈红色。'],['光辉蔓绿绒','Philodendron gloriosum','天南星科','喜林芋属',198,'南向阳台','雨林植物园','2026-07-22','生长中','匍匐型喜林芋，绒面心形叶片具有清晰的白色叶脉。']];
const examples=exampleData.map((a,i)=>({id:'demo-'+i,name:a[0],latin:a[1],family:a[2],genus:a[3],price:a[4],location:a[5],source:a[6],date:a[7],status:a[8],description:a[9],number:'PL-'+String(i+1).padStart(3,'0'),sourceNumber:'SRC-'+String(i+1).padStart(3,'0'),light:'明亮散射光',water:'根据介质干湿情况浇水',substrate:'根据品种选择透气介质',notes:'示例记录：来源、价格及养护信息仅用于展示。',lastWater:'',nextWater:'',photos:['/assets/'+a[1].replaceAll(' ','_')+'.jpg'],logs:[],demo:true}));
const demoOrigins=[{lat:19.4,lon:-96.8,countryCode:'MX',country:'墨西哥',state:'韦拉克鲁斯州',city:'',county:'',district:''},{lat:9.9,lon:-84.2,countryCode:'CR',country:'哥斯达黎加',state:'',city:'',county:'',district:''},{lat:-27.3,lon:153,countryCode:'AU',country:'澳大利亚',state:'昆士兰州',city:'',county:'',district:''},{lat:-33,lon:26.3,countryCode:'ZA',country:'南非',state:'东开普省',city:'',county:'',district:''},{lat:-22,lon:-42,countryCode:'BR',country:'巴西',state:'里约热内卢州',city:'',county:'',district:''},{lat:4.3,lon:-74.2,countryCode:'CO',country:'哥伦比亚',state:'',city:'',county:'',district:''}];
examples.forEach((p,i)=>{p.originLocation={...demoOrigins[i],precision:'region',source:'demo',label:'示例代表位置 · '+demoOrigins[i].country};p.origin='示例分布地区：'+demoOrigins[i].country;p.notes+='地图为示例代表位置，不是精确采集点。';});
let records=[],loading=true,section='all',tab='all',classification=null,view='grid',editing=null,photoDraft=[],logDraft=[],photoDateDraft={},uploading=false,selected=null,deleteId=null,editingRevision=null,deleteRevision=null;
if(!classificationPage){const requestedSection=new URL(location.href).searchParams.get('section');if(['all','care','sources'].includes(requestedSection))section=requestedSection;}
let authState=null,taxa=[],taxonomyNodes=new Map(),taxonEditing=null,taxonReferences=[],taxonUploading=false;

let syncEpoch=0,syncWrites=0,syncRunning=false,autoDemo=false;
const syncChannel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('leaf-archive-cloud'):null;
const data=()=>$('#demo').checked?examples:records;
const isDue=p=>p.nextWater&&p.nextWater<=today()&&!['已赠出','已死亡'].includes(p.status);
const toast=t=>{const e=$('#toast');e.textContent=t;e.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.style.display='none',3000)};
function syncStatus(text){$('#cloudSync').textContent=text;}
async function api(url,options={}){
 const write=(url.startsWith('/api/plants')||url.startsWith('/api/taxa'))&&options.method&&options.method!=='GET';
 if(write){syncWrites++;syncEpoch++;syncStatus('正在保存到云端…');}
 try{
  const r=await fetch(url,{cache:'no-store',...options});let d;try{d=await r.json()}catch{throw new Error('服务暂时不可用，请稍后重试。')}
  if(!r.ok){if(r.status===401)clearPrivateView();throw new Error(d.error||'操作未完成');}
  if(write){syncChannel?.postMessage({type:'changed'});syncStatus('已保存到云端');}
  return d;
 }catch(error){if(write)syncStatus('保存未完成，请重试');throw error;}
 finally{if(write){syncWrites--;syncEpoch++;}}
}
function modal(id){$('#'+id).showModal()}
function close(id){$('#'+id).close()}
function renderStats(){const d=data();$('#statTotal').innerHTML=d.length+'<small>株</small>';$('#statFamilies').innerHTML=new Set(d.map(x=>x.family).filter(Boolean)).size+'<small>科</small>';$('#statPrice').innerHTML='¥ '+money(d.reduce((s,p)=>s+Number(p.price||0),0))+'<small>CNY</small>';$('#statCare').innerHTML=d.filter(p=>isDue(p)||p.status==='需关注').length+'<small>株</small>';$('#navcount').textContent=records.length;$('#allCount').textContent=d.length;$('#demoLabel').hidden=!$('#demo').checked}
function renderTree(){
 $('#filterLabel').textContent='';
 if(!classificationPage)return;
 const q=$('#search').value.trim().toLowerCase();
 const tree=buildTree(data(),$('#demo').checked?[]:taxa);taxonomyNodes=tree.nodes;
 $('#resultCount').textContent=loading?'正在读取分类…':'共 '+tree.nodes.size+' 个分类 · '+data().length+' 株植物';
 if(loading){$('#tree').innerHTML='<p class="classification-empty">正在读取植物分类…</p>';return;}
 const matches=n=>[...n.path.map(x=>x.name),rankInfo(n.rank).label,rankInfo(n.rank).latin,...n.plants.flatMap(p=>[p.name,p.latin,p.number])].join(' ').toLowerCase().includes(q);
 const visible=n=>!q||matches(n)||n.children.some(visible);
 const markup=n=>{
  const rank=rankInfo(n.rank),key=escape(n.key),editable=authState?.user&&!$('#demo').checked;
  return '<details class="taxon-node" data-key="'+key+'" open><summary><span class="rank-badge">'+rank.label+'</span><strong>'+escape(n.name)+'</strong><small>'+rank.latin+'</small></summary><div class="taxon-body">'+
   (editable?'<div class="taxon-actions">'+(childRanks(n.path).length?'<button type="button" data-child="'+key+'">＋ 添加下级</button>':'')+(referenceRank(n.rank)?'<button type="button" data-reference="'+key+'">参考图 · '+n.references.length+'</button>':'')+'</div>':'')+
   (n.references.length?'<div class="taxon-gallery">'+n.references.map(url=>'<a href="'+escape(url)+'" target="_blank" rel="noopener"><img src="'+escape(url)+'" loading="lazy" alt="'+escape(n.name)+'参考图"></a>').join('')+'</div>':'')+
   n.plants.map(p=>'<button class="taxonomy-plant" data-id="'+escape(p.id)+'"><span><strong>'+escape(p.name)+'</strong><i>'+escape(p.latin)+'</i></span><small>'+escape(p.number)+'</small></button>').join('')+
   n.children.filter(visible).map(markup).join('')+'</div></details>';
 };
 const openKeys=new Map($$('#tree details').map(d=>[d.dataset.key,d.open]));
 $('#tree').innerHTML=tree.roots.filter(visible).map(markup).join('')||'<p class="classification-empty">'+(q?'没有找到匹配的分类或植物。':'还没有分类。点击“添加分类”建立分类树，或新增植物填写分类信息。')+'</p>';
 if(!q)$$('#tree details').forEach(d=>{if(openKeys.has(d.dataset.key))d.open=openKeys.get(d.dataset.key)});
 bindCards();
 $$('[data-child]').forEach(b=>b.onclick=()=>openTaxon(taxonomyNodes.get(b.dataset.child).path));
 $$('[data-reference]').forEach(b=>b.onclick=()=>openTaxon([],taxonomyNodes.get(b.dataset.reference)));
}

function renderOptions(){const values=f=>[...new Set(records.map(p=>p[f]).filter(Boolean))];for(const [f,id]of[['family','families'],['genus','genera'],['source','sources'],['location','locations']])$('#'+id).innerHTML=values(f).map(x=>'<option value="'+escape(x)+'">').join('');const old=$('#locationFilter').value;const locations=[...new Set(data().map(x=>x.location).filter(Boolean))];$('#locationFilter').innerHTML='<option value="">所有位置</option>'+locations.map(x=>'<option>'+escape(x)+'</option>').join('');if(locations.includes(old))$('#locationFilter').value=old}
function filtered(){const q=$('#search').value.trim().toLowerCase(),loc=$('#locationFilter').value;let d=data().filter(p=>(!q||[p.name,p.latin,p.number,p.source,p.sourceNumber,p.description,p.origin,p.individualInfo,p.family,p.genus].join(' ').toLowerCase().includes(q))&&(!loc||p.location===loc)&&(!classification||(p.family||'未分类')===classification.family&&(!classification.genus||(p.genus||'未填写属')===classification.genus))&&(tab!=='healthy'||p.status==='生长中')&&(tab!=='attention'||p.status==='需关注'||isDue(p)));const sort=$('#sort').value;return d.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'zh'):sort==='price'?Number(b.price||0)-Number(a.price||0):(b.date||'').localeCompare(a.date||''))}
function photo(p,cls=''){return p.photos?.[0]?'<img class="'+cls+'" src="'+escape(p.photos[0])+'" alt="'+escape(p.name)+'" loading="lazy">':'<div class="photo-empty"><span>✳</span><div>等待一张生长的照片</div></div>'}
function empty(title,text){return '<div class="empty"><h2>'+title+'</h2><p>'+text+'</p>'+(!records.length&&!$('#demo').checked?'<button class="primary" id="firstPlant">＋ 新增第一株植物</button>':'')+'</div>'}
function renderContent(){if(originsPage){renderOriginView();return}if(classificationPage){renderTree();return}const d=filtered();$('#resultCount').textContent=loading?'正在读取档案…':'共 '+d.length+' 株植物';if(loading){$('#content').innerHTML=empty('正在打开你的花园','读取植物档案中…');return}if(section==='sources'){const map={};for(const p of d){const s=p.source||'未填写来源';(map[s]??=[]).push(p)}$('#resultCount').textContent='共 '+Object.keys(map).length+' 个来源';$('#content').innerHTML=Object.entries(map).map(([s,plants])=>'<article class="source-row"><div><h3>'+escape(s)+'</h3><p>'+plants.length+' 株植物 · 购入总额 ¥ '+money(plants.reduce((sum,p)=>sum+Number(p.price||0),0))+'</p></div><button class="secondary" data-source="'+escape(s)+'">查看植物</button></article>').join('')||empty('还没有购入来源','新增植物时，记录它来自哪里。');for(const b of $$('[data-source]'))b.onclick=()=>{section='all';classification=null;$('#search').value=b.dataset.source==='未填写来源'?'':b.dataset.source;render()};return}
if(section==='care'){const care=d.filter(p=>!['已赠出','已死亡'].includes(p.status)).sort((a,b)=>Number(isDue(b))-Number(isDue(a))||(a.nextWater||'9999').localeCompare(b.nextWater||'9999'));$('#content').innerHTML=care.map(p=>'<article class="care-row"><div><h3>'+escape(p.name)+' <span class="pill">'+escape(p.number)+'</span></h3><p class="'+(isDue(p)?'due':'')+'">'+(p.nextWater?'下次养护：'+escape(p.nextWater)+(isDue(p)?' · 已到期':''):'尚未设置养护日期')+' · '+escape(p.location||'未设置位置')+'</p></div><button class="secondary" data-id="'+escape(p.id)+'">记录养护</button></article>').join('')||empty('暂无养护记录','在植物档案中添加养护日期与生长记录。');bindCards();return}
if(!d.length){$('#content').innerHTML=empty(data().length?'没有找到匹配的植物':'你的收藏，从这里开始',data().length?'试试其他关键词，或清除分类与位置筛选。':'点击“新增植物”，导入照片并建立第一份档案。');$('#firstPlant')?.addEventListener('click',()=>openEditor());return}
if(view==='grid'){$('#content').innerHTML='<div class="cards">'+d.map(p=>'<article class="plant-card" tabindex="0" role="button" aria-label="查看'+escape(p.name)+'档案" data-id="'+escape(p.id)+'"><div class="card-photo">'+photo(p)+'<span class="badge '+((p.status==='需关注'||isDue(p))?'attention':'')+'">'+escape(p.status||'生长中')+'</span><span class="photo-number">'+escape(p.number)+'</span></div><div class="card-body"><div class="card-top"><h2>'+escape(p.name)+'</h2><span class="card-family">'+escape(p.family||'未分类')+'</span></div><div class="latin">'+escape(p.latin||'尚未填写学名')+'</div><div class="card-meta"><span>⌖ '+escape(p.location||'未设置位置')+'</span><strong>'+(p.price===''?'未记录价格':'¥ '+money(p.price))+'</strong></div><div class="card-bottom"><span>'+escape(p.source||'未填写来源')+'</span><span>'+escape(p.date||'未记录日期')+'</span><b>⋯</b></div></div></article>').join('')+'</div>'}else{$('#content').innerHTML='<div class="table-wrap"><table><thead><tr><th>植物</th><th>收藏编号</th><th>科 / 属</th><th>来源 / 来源编号</th><th>产地</th><th>位置</th><th>价格</th><th>状态</th></tr></thead><tbody>'+d.map(p=>'<tr tabindex="0" data-id="'+escape(p.id)+'"><td>'+escape(p.name)+'<small><i>'+escape(p.latin)+'</i></small></td><td>'+escape(p.number)+'</td><td>'+escape(p.family||'未分类')+'<small>'+escape(p.genus)+'</small></td><td>'+escape(p.source||'未填写')+'<small>'+escape(p.sourceNumber)+'</small></td><td>'+escape(p.origin||'未填写')+'</td><td>'+escape(p.location)+'</td><td>¥ '+money(p.price)+'</td><td>'+escape(p.status)+'</td></tr>').join('')+'</tbody></table></div>'}bindCards()}
function bindCards(){for(const el of $$('[data-id]')){el.onclick=()=>openDetail(el.dataset.id);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDetail(el.dataset.id)}}}}
function render(){renderStats();renderTree();renderOptions();for(const n of $$('.nav'))n.classList.toggle('active',!classificationPage&&!originsPage&&n.dataset.section===section);$('[data-page-link=classification]').classList.toggle('active',classificationPage);$('[data-page-link=origins]').classList.toggle('active',originsPage);const title=originsPage?'产地地图':classificationPage?'分类树':{all:'植物收藏',care:'养护记录',sources:'购入来源'}[section];$('#pageTitle').innerHTML=title+'<span class="title-dot">.</span>';$('#crumb').textContent=title;$('#pageSubtitle').textContent=originsPage?'从世界到城市与区县，查看植物的原生地。':classificationPage?'从界到种及种下分类，整理参考图与植物档案。':{all:'从第一片新叶开始，记录与你一起生长的植物。',care:'记下浇水、换盆与新叶，照顾每一个生长阶段。',sources:'把植物的来处，留在它的档案里。'}[section];renderContent()}
function clearPrivateView(){
 records=[];taxa=[];selected=null;editing=null;photoDraft=[];logDraft=[];photoDateDraft={};originDraft=null;originsController?.reset();
 for(const id of ['editor','detail','confirm','taxonEditor','originPicker'])if($('#'+id)?.open)close(id);
 $('#demo').checked=true;render();
}
function showAccount(state){
 authState=state;const user=state.user;
 $('#accountName').textContent=user?user.nickname:'未登录';
 $('#wechatLogin').hidden=true;$('#logout').hidden=!user;
 $('#newPlant').disabled=!user;if($('#newTaxon'))$('#newTaxon').disabled=!user;
 const notice=$('#authNotice');notice.hidden=Boolean(user);
 if(!user){
  notice.textContent='登录后查看自己的植物档案。你也可以先浏览示例。';
  if(state.legacyLogin)notice.innerHTML+=' <a href="/auth/sites">原网站账号登录</a>';
  $('#wechatLogin').disabled=true;
 }
}
async function load(){
 try{
  const state=await api('/api/auth');showAccount(state);$('#error').hidden=true;
  if(state.user){records=await api('/api/plants');if(classificationPage)taxa=await api('/api/taxa');autoDemo=false;$('#demo').checked=false;syncStatus('云端已同步');}
  else{clearPrivateView();autoDemo=false;syncStatus('登录后同步个人档案');}
 }catch(e){syncStatus('未连接云端');$('#error').hidden=false;$('#error').textContent=e.message;$('#demo').checked=true;}
 if(originsPage&&new URL(location.href).searchParams.get('demo')==='1')$('#demo').checked=true;loading=false;render();
 const login=new URL(location.href).searchParams.get('login');
 if(login){toast(login==='not-configured'?'微信登录暂未开放':'微信授权未完成，请重新登录');const url=new URL(location.href);url.searchParams.delete('login');history.replaceState(null,'',url);}
}
$('#wechatLogin').onclick=()=>{
 const modes=authState?.wechat;if(!modes)return;
 const insideWechat=/MicroMessenger/i.test(navigator.userAgent);
 const mode=insideWechat&&modes.mp?'mp':modes.web?'web':'mp';
 if(mode==='mp'&&!insideWechat){toast('请在微信中打开本网站，再点击微信登录');return;}
 location.href='/auth/wechat?mode='+mode;
};
$('#logout').onclick=async()=>{
 if(uploading||taxonUploading||growthBusy||$('#editor').open||$('#taxonEditor')?.open){toast('请先保存或关闭编辑，再退出登录');return;}
 try{await api('/api/auth/logout',{method:'POST'});syncEpoch++;clearPrivateView();syncChannel?.postMessage({type:'auth-changed'});await load();}catch(error){toast(error.message);}
};
function renderPhotos(){
 $('#photoPreview').innerHTML=photoDraft.map((url,i)=>'<div><img src="'+escape(url)+'" alt="已导入的植物照片"><button type="button" data-remove-photo="'+i+'" aria-label="移除第'+(i+1)+'张照片">×</button><label>照片日期<input type="date" data-photo-date="'+i+'" value="'+escape(photoDateDraft[url]||'')+'" aria-label="第'+(i+1)+'张照片的拍摄日期"></label></div>').join('');
 for(const b of $$('[data-remove-photo]'))b.onclick=()=>{if(uploading)return;delete photoDateDraft[photoDraft[Number(b.dataset.removePhoto)]];photoDraft.splice(Number(b.dataset.removePhoto),1);renderPhotos()};
 for(const input of $$('[data-photo-date]'))input.onchange=()=>{photoDateDraft[photoDraft[Number(input.dataset.photoDate)]]=input.value};
}
function openEditor(p=null){if(!authState?.user){toast('请先登录，再建立自己的植物档案');return;}editingRevision=p?._revision||'legacy';editing=p?.demo?null:p?.id||null;$('#plantForm').reset();$('#formError').textContent='';$('#uploadStatus').textContent='';$('#editorTitle').textContent=editing?'编辑植物档案':p?.demo?'用此示例新建档案':'新增植物';for(const f of fields)$('#plantForm').elements[f].value=(f==='identification'?(p?.[f]||'species'):p?.[f])??(f==='identification'?'species':f==='status'?'生长中':f==='date'?today():'');if(!p){let n=records.length+1;while(records.some(x=>x.number==='PL-'+String(n).padStart(3,'0')))n++;$('#plantForm').elements.number.value='PL-'+String(n).padStart(3,'0')}updateIdentification();photoDraft=[...(p?.photos||[])];logDraft=[...(p?.logs||[])];photoDateDraft={...(p?.photoDates||{})};originDraft=p?.originLocation?structuredClone(p.originLocation):null;renderOriginDraft();renderPhotos();modal('editor')}
$('#photos').onchange=async e=>{const files=[...e.target.files];e.target.value='';if(photoDraft.length+files.length>12){$('#uploadStatus').textContent='每份档案最多添加 12 张照片。';return}uploading=true;$('#savePlant').disabled=true;$('#photos').disabled=true;for(let i=0;i<files.length;i++){const file=files[i];$('#uploadStatus').textContent='正在导入 '+(i+1)+' / '+files.length+' 张照片…';try{if(file.size>8*1024*1024)throw new Error('图片超过 8 MB：'+file.name);const f=new FormData();f.append('file',file);const d=await api('/api/images',{method:'POST',body:f});photoDraft.push(d.url);renderPhotos()}catch(err){$('#uploadStatus').textContent=err.message;break}}uploading=false;$('#savePlant').disabled=false;$('#photos').disabled=false;if(photoDraft.length&&$('#uploadStatus').textContent.startsWith('正在'))$('#uploadStatus').textContent='照片已导入，保存档案后完成。'};
$('#plantForm').onsubmit=async e=>{e.preventDefault();if(uploading)return;const form=$('#plantForm');const p=Object.fromEntries(fields.map(f=>[f,form.elements[f].value]));if(p.identification==='unresolved'){p.variety='';p.form='';p.infraspecific=''}else if(['aff','cf'].includes(p.identification)){p.variety='';p.form=''}else p.infraspecific='';p.photos=photoDraft;p.logs=logDraft;p.photoDates=photoDateDraft;p.originLocation=originDraft;$('#savePlant').disabled=true;$('#savePlant').textContent='正在保存…';try{const saved=await api('/api/plants'+(editing?'/'+editing:''),{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json',...(editing?{'If-Match':'"'+editingRevision+'"'}:{})},body:JSON.stringify(p)});if(editing)records=records.map(x=>x.id===editing?saved:x);else records.unshift(saved);$('#demo').checked=false;autoDemo=false;classification=null;$('#search').value='';$('#locationFilter').value='';tab='all';$$('[data-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.tab==='all'));render();close('editor');if($('#detail').open){close('detail');openDetail(saved.id)}toast('植物档案已保存')}catch(err){$('#formError').textContent=err.message}finally{$('#savePlant').disabled=false;$('#savePlant').textContent='保存档案'}};
function openDetail(id){
 const p=[...records,...examples].find(x=>x.id===id);if(!p)return;selected=p;
 const pairs=[['收藏编号',p.number],['来源编号',p.sourceNumber],['购入价格',p.price===''?'未填写':'¥ '+money(p.price)],['科',p.family],['属',p.genus],...ranks.filter(r=>!['family','genus','aff','cf','unresolved'].includes(r.key)).map(r=>[r.label,p[r.key]]),['鉴定类别',rankInfo(p.identification||'species')?.label],['aff. / cf. 名称',p.infraspecific],['购入日期',p.date],['购入来源',p.source],['产地',p.origin],...(p.originLocation?[['地图位置',locationLabel(p.originLocation)],['位置精度',precisionLabels[p.originLocation.precision||'point']]]:[]),['摆放位置',p.location],['生长状态',p.status],['光照需求',p.light],['浇水建议',p.water],['栽培介质',p.substrate],['上次浇水',p.lastWater],['下次养护',p.nextWater]];
 $('#detailContent').innerHTML='<div class="detail-top">'+(p.photos?.length?'<img class="detail-image" id="bigPhoto" src="'+escape(p.photos[0])+'" alt="'+escape(p.name)+'">':'')+'<button class="icon-button detail-close" id="closeDetail" aria-label="关闭">×</button></div><div class="detail-body"><div class="detail-heading"><div><div class="eyebrow">'+(p.demo?'EXAMPLE PROFILE':'PLANT PROFILE')+'</div><h2>'+escape(p.name)+'</h2><div class="latin">'+escape(p.latin)+'</div></div><button class="primary" id="editDetail">'+(p.demo?'用此示例新建':'编辑档案')+'</button></div>'+(p.photos?.length>1?'<div class="gallery">'+p.photos.map(url=>'<button data-photo="'+escape(url)+'" aria-label="查看植物照片"><img src="'+escape(url)+'" alt="'+escape(p.name)+'"></button>').join('')+'</div>':'')+'<p class="detail-description">'+escape(p.description||'尚未填写简介。')+'</p><dl class="detail-fields">'+pairs.map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+escape(v||'未填写')+'</dd></div>').join('')+'</dl>'+(p.originLocation?'<a class="origin-detail-link" href="/origins?plant='+encodeURIComponent(p.id)+(p.demo?'&demo=1':'')+'">在产地地图中查看</a>':'')+'<h3>个体信息</h3><p class="detail-description individual-info">'+escape(p.individualInfo||'尚未填写个体信息。')+'</p>'+(p.notes?'<h3>备注</h3><p class="detail-description">'+escape(p.notes)+'</p>':'')+statusMarkup(p)+growthMarkup(p)+(!p.demo?'<div class="detail-actions"><button class="secondary" id="waterToday">记录今天浇水</button><button class="danger-text" id="deletePlant">删除档案</button></div>':'<p class="detail-description">这是示例档案。点击“用此示例新建”可保存到自己的收藏中。</p>')+'</div>';
 if(!$('#detail').open)modal('detail');$('#closeDetail').onclick=()=>{if(growthBusy){toast('请等待生长记录保存完成');return}close('detail')};$('#editDetail').onclick=()=>openEditor(records.find(x=>x.id===p.id)||p);$$('[data-photo]').forEach(b=>b.onclick=()=>$('#bigPhoto').src=b.dataset.photo);
 bindGrowth(p);bindStatus(p);if(p.demo)return;
 $('#waterToday').onclick=async()=>{if(hasStatusDraft(p)){toast('请先保存正在填写的状态变更');return;}setGrowthBusy(true);try{await saveDetail({...p,lastWater:today(),nextWater:p.nextWater&&p.nextWater<=today()?'':p.nextWater,logs:[...(p.logs||[]),{id:crypto.randomUUID(),date:today(),type:'浇水',text:'完成浇水。',photos:[]}]});toast('已记录今天浇水，可设置下次养护日期')}catch(err){toast(err.message)}finally{setGrowthBusy(false)}};
 $('#deletePlant').onclick=()=>{deleteId=p.id;deleteRevision=p._revision||'legacy';modal('confirm')};
}
async function saveDetail(p){const statusDraft=!p.statusChange&&hasStatusDraft(p)?{value:$('#statusValue').value,date:$('#statusDate').value,note:$('#statusNote').value}:null;const saved=await api('/api/plants/'+p.id,{method:'PUT',headers:{'Content-Type':'application/json','If-Match':'"'+(p._revision||'legacy')+'"'},body:JSON.stringify(p)});records=records.map(x=>x.id===p.id?saved:x);render();openDetail(p.id);if(statusDraft){$('#statusValue').value=statusDraft.value;$('#statusDate').value=statusDraft.date;$('#statusNote').value=statusDraft.note}}
$('#confirmDelete').onclick=async()=>{$('#confirmDelete').disabled=true;try{await api('/api/plants/'+deleteId,{method:'DELETE',headers:{'If-Match':'"'+deleteRevision+'"'}});records=records.filter(p=>p.id!==deleteId);close('confirm');close('detail');render();toast('档案已删除')}catch(err){toast(err.message)}finally{$('#confirmDelete').disabled=false}};
$$('[data-close]').forEach(b=>b.onclick=()=>{if((b.dataset.close==='editor'&&uploading)||(b.dataset.close==='taxonEditor'&&taxonUploading)){toast('请等待照片导入完成');return}close(b.dataset.close)});$('#editor').addEventListener('cancel',e=>{if(uploading)e.preventDefault()});$('#newPlant').onclick=()=>openEditor();$$('.nav[data-section]').forEach(n=>n.onclick=()=>{if(classificationPage||originsPage){location.href='/?section='+n.dataset.section;return}section=n.dataset.section;render()});$$('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;$$('[data-tab]').forEach(x=>x.classList.toggle('selected',x===b));renderContent()});$('#search').oninput=renderContent;$('#locationFilter').onchange=renderContent;$('#sort').onchange=renderContent;$('#demo').onchange=()=>{originsController?.reset();autoDemo=false;classification=null;$('#search').value='';render()};$('#expandTree')?.addEventListener('click',()=>$$('#tree details').forEach(d=>d.open=true));$('#collapseTree')?.addEventListener('click',()=>$$('#tree details').forEach(d=>d.open=false));$('#gridView').onclick=()=>{view='grid';$('#gridView').classList.add('on');$('#listView').classList.remove('on');renderContent()};$('#listView').onclick=()=>{view='list';$('#listView').classList.add('on');$('#gridView').classList.remove('on');renderContent()};document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)&&!$$('dialog').some(d=>d.open)){e.preventDefault();$('#search').focus()}});
$('#export').onclick=()=>{const d=$('#demo').checked?examples:records;if(!d.length){toast('没有可导出的档案');return}const blob=new Blob([JSON.stringify({title:'植藏植物档案',exportedAt:new Date().toISOString(),isExample:$('#demo').checked,plants:d},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='植藏档案-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('档案已导出（含照片链接）')};
const imageCredits=[{"name": "1 Haworthia cooperi - Kirstenbosch.jpg", "source": "https://commons.wikimedia.org/wiki/File:1_Haworthia_cooperi_-_Kirstenbosch.jpg", "author": "Abu Shawka", "license": "CC0", "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en"}, {"name": "Alismatales - Anthurium crystallinum 2.jpg", "source": "https://commons.wikimedia.org/wiki/File:Alismatales_-_Anthurium_crystallinum_2.jpg", "author": "Emőke Dénes", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"}, {"name": "Begonia maculata3073316230.jpg", "source": "https://commons.wikimedia.org/wiki/File:Begonia_maculata3073316230.jpg", "author": "Cliff from I now live in Arlington, VA (Outside Washington DC), USA", "license": "CC BY 2.0", "licenseUrl": "https://creativecommons.org/licenses/by/2.0"}, {"name": "Monstera deliciosa2.jpg", "source": "https://commons.wikimedia.org/wiki/File:Monstera_deliciosa2.jpg", "author": "原文件页署名", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/"}, {"name": "Philodendron gloriosum (29587099650).jpg", "source": "https://commons.wikimedia.org/wiki/File:Philodendron_gloriosum_(29587099650).jpg", "author": "Dick Culbert from Gibsons, B.C., Canada", "license": "CC BY 2.0", "licenseUrl": "https://creativecommons.org/licenses/by/2.0"}, {"name": "Platycerium bifurcatum 612351086.jpg", "source": "https://commons.wikimedia.org/wiki/File:Platycerium_bifurcatum_612351086.jpg", "author": "themaskedlapwing", "license": "CC0", "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en"}];
$('#credits').onclick=()=>{modal('creditDialog');$('#creditContent').innerHTML=imageCredits.map(p=>'<div class="credit-row"><a href="'+escape(p.source)+'" target="_blank" rel="noopener">'+escape(p.name)+'</a><br>摄影：'+escape(p.author)+' · <a href="'+escape(p.licenseUrl)+'" target="_blank" rel="noopener">'+escape(p.license)+'</a> · 使用缩略图，未修改原照片</div>').join('')};
if(document.modelContext?.registerTool){const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});try{Promise.resolve(document.modelContext.registerTool({name:'search_plants',description:'Search the currently displayed plant collection and update the visible search results.',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(typeof input?.query!=='string')throw new Error('query must be a string');section='all';$('#search').value=input.query;render();return {count:filtered().length,plants:filtered().map(p=>({id:p.id,name:p.name,number:p.number}))}}},{signal:lifecycle.signal})).catch(()=>{});Promise.resolve(document.modelContext.registerTool({name:'start_plant_creation',description:'Open the new plant form; this does not save a record.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(input&&Object.keys(input).length)throw new Error('No parameters accepted');openEditor();return {formOpened:true}}},{signal:lifecycle.signal})).catch(()=>{})}catch{}}
let growthBusy=false;
const growthPhotos=p=>{
 const all=(p.photos||[]).map((url,i)=>({url,date:p.photoDates?.[url]||'',label:'档案照片 '+(i+1)}));
 for(const [index,l] of (p.logs||[]).entries())for(const [i,url] of (l.photos||[]).entries())all.push({url,date:l.date||'',label:(l.type||'观察')+' · 照片 '+(i+1),key:l.id||'log-'+index});
 return all.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
};
function statusMarkup(p){
 if(p.demo)return '';
 return '<form id="statusForm" class="growth-form status-form"><h4>变更植物状态 <span class="pill">当前：'+escape(p.status||'未填写')+'</span></h4><div class="growth-inputs"><label>新状态<select id="statusValue">'+plantStatuses.map(status=>'<option'+(status===p.status?' selected':'')+'>'+status+'</option>').join('')+'</select></label><label>变更日期<input id="statusDate" type="date" required value="'+today()+'"></label></div><label class="growth-text-label">变更备注（选填）<textarea id="statusNote" maxlength="3000" rows="2" placeholder="如：进入休眠期，减少浇水。"></textarea></label><div class="growth-form-bottom"><button id="saveStatus" class="primary" type="submit">保存状态变更</button><span id="statusError" role="alert"></span></div><p class="growth-hint">保存后会自动记录在下方的生长时间线中。</p></form>';
}
function hasStatusDraft(p){return Boolean($('#statusNote')?.value.trim()||$('#statusValue')&&$('#statusValue').value!==(p.status||'生长中')||$('#statusDate')&&$('#statusDate').value!==today())}
function bindStatus(p){
 if(p.demo)return;
 $('#statusForm').onsubmit=async e=>{
  e.preventDefault();if(growthBusy)return;
  const status=$('#statusValue').value;
  if(status===(p.status||'')){$('#statusError').textContent='请选择与当前不同的状态。';return;}
  const date=$('#statusDate').value,note=$('#statusNote').value.trim();
  if(!date){$('#statusError').textContent='请选择变更日期。';return;}
  if($('#logText')?.value.trim()||$('#growthPhotoPreview')?.children.length){$('#statusError').textContent='请先保存下方正在填写的生长记录。';return;}
  $('#statusError').textContent='';setGrowthBusy(true);
  try{await saveDetail({...p,status,statusChange:{date,note}});toast('状态已更新，并记录在生长时间线中');}
  catch(error){$('#statusError').textContent=error.message;}
  finally{setGrowthBusy(false);}
 };
}
function growthMarkup(p){
 const entries=growthPhotos(p),enough=new Set(entries.map(x=>x.url)).size>=2;
 return '<div class="growth-heading"><div><h3>生长时间线</h3><p>按日期留住每一次变化</p></div><label>排序<select id="timelineSort" aria-label="生长时间线排序"><option value="asc">从早到晚</option><option value="desc">从晚到早</option></select></label></div><div id="logs" class="growth-timeline"></div>'+(!p.demo?'<form class="growth-form" id="logForm"><h4>添加生长记录</h4><div class="growth-inputs"><label>记录日期<input id="logDate" type="date" required value="'+today()+'"></label><label>记录类型<select id="logType"><option>观察</option><option>浇水</option><option>施肥</option><option>换盆</option><option>病虫害</option><option>繁殖</option></select></label></div><label class="growth-text-label">记录内容<textarea id="logText" maxlength="3000" placeholder="如：新叶展开，株高增加到 15 cm。可只上传照片。"></textarea></label><label class="growth-photo-label" for="growthPhotoFiles">＋ 添加当天照片 <small>最多 6 张 · 每张不超过 8 MB</small></label><input id="growthPhotoFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden><div id="growthPhotoPreview" class="growth-photo-preview"></div><p id="growthUploadStatus" class="growth-hint" role="status"></p><div class="growth-form-bottom"><button class="primary" type="submit" id="saveLog">保存生长记录</button><span id="logError" role="alert"></span></div></form>':'')+'<h3>生长对比图</h3>'+(enough?'<p class="detail-description">选择两张照片，生成带日期的对比图。照片将完整显示。</p><div class="compare-pickers"><label>照片 A<select id="compareA"></select></label><label>照片 B<select id="compareB"></select></label></div><div id="comparePreview" class="compare-preview"></div><button class="primary" id="generateComparison">生成对比图</button><span id="compareError" role="alert"></span><div id="comparisonResult" hidden><img id="comparisonImage" alt="植物生长对比图"><a class="secondary" id="downloadComparison" download>下载 PNG 对比图</a></div>':'<p class="comparison-empty">需要至少两张照片才能生成对比图。添加不同日期的生长照片，或在“编辑档案”中为已有照片补填日期。</p>');
}
function renderTimeline(p){
 const items=[];
 if(p.date)items.push({date:p.date,type:'购入收藏',text:p.source?'购入来源：'+p.source:'加入植物收藏',photos:[]});
 for(const l of p.logs||[])items.push({...l,photos:l.photos||[]});
 const grouped={};for(const photo of (p.photos||[])){const date=p.photoDates?.[photo]||'';(grouped[date]??=[]).push(photo)}
 for(const [date,photos]of Object.entries(grouped))items.push({date,type:'档案照片',text:date?'':'尚未标注拍摄日期，可在编辑档案中补填。',photos});
 const direction=$('#timelineSort').value==='desc'?-1:1;
 items.sort((a,b)=>!a.date?(!b.date?0:1):!b.date?-1:direction*a.date.localeCompare(b.date));
 $('#logs').innerHTML=items.length?items.map(l=>'<article class="growth-event'+(l.type==='状态变更'?' status-event':'')+'"><div class="growth-event-date">'+(l.date?'<time datetime="'+escape(l.date)+'">'+escape(l.date)+'</time>':'未标注日期')+'<span>'+escape(l.type||'观察')+'</span></div>'+(l.text?'<p>'+escape(l.text)+'</p>':'')+(l.photos?.length?'<div class="growth-event-photos">'+l.photos.map(url=>'<a href="'+escape(url)+'" target="_blank" rel="noopener" aria-label="查看'+escape(l.date||'未标日期')+'的植物照片"><img src="'+escape(url)+'" alt="'+escape(p.name)+' · '+escape(l.date||'未标日期')+'" loading="lazy"></a>').join('')+'</div>':'')+'</article>').join(''):'<p class="detail-description">还没有生长记录，添加第一张照片或一次观察吧。</p>';
}
function setGrowthBusy(value){growthBusy=value;for(const selector of ['#growthPhotoFiles','#saveLog','#editDetail','#waterToday','#deletePlant','#saveStatus','#statusValue','#statusDate','#statusNote']){const el=$(selector);if(el)el.disabled=value}}
function bindGrowth(p){
 renderTimeline(p);$('#timelineSort').onchange=()=>renderTimeline(p);bindComparison(p);
 if(p.demo)return;let draft=[];
 function preview(){$('#growthPhotoPreview').innerHTML=draft.map((url,i)=>'<div><img src="'+escape(url)+'" alt="待保存的生长照片"><button type="button" data-growth-remove="'+i+'" aria-label="移除第'+(i+1)+'张生长照片">×</button></div>').join('');$$('[data-growth-remove]').forEach(b=>b.onclick=()=>{if(growthBusy)return;draft.splice(Number(b.dataset.growthRemove),1);preview()})}
 $('#growthPhotoFiles').onchange=async e=>{
  const files=[...e.target.files];e.target.value='';if(draft.length+files.length>6){$('#growthUploadStatus').textContent='每条记录最多 6 张照片。';return}setGrowthBusy(true);let failed=false;
  try{for(let i=0;i<files.length;i++){const file=files[i];if(file.size>8*1024*1024)throw new Error('图片超过 8 MB：'+file.name);$('#growthUploadStatus').textContent='正在导入 '+(i+1)+' / '+files.length+' 张照片…';const form=new FormData();form.append('file',file);const result=await api('/api/images',{method:'POST',body:form});draft.push(result.url);preview()}}
  catch(err){failed=true;$('#growthUploadStatus').textContent=err.message}
  finally{setGrowthBusy(false);if(!failed)$('#growthUploadStatus').textContent='照片已导入，点击“保存生长记录”完成。'}
 };
 $('#logForm').onsubmit=async e=>{
  e.preventDefault();if(growthBusy)return;const text=$('#logText').value.trim();if(!text&&!draft.length){$('#logError').textContent='请填写记录内容或添加照片。';return}
  const date=$('#logDate').value;if(!date){$('#logError').textContent='请选择记录日期。';return}
  const next={...p,logs:[...(p.logs||[]),{id:crypto.randomUUID(),date,type:$('#logType').value,text,photos:[...draft]}]};
  if($('#logType').value==='浇水')next.lastWater=date;$('#logError').textContent='';setGrowthBusy(true);
  try{await saveDetail(next);toast('生长记录已保存')}catch(err){$('#logError').textContent=err.message}finally{setGrowthBusy(false)}
 };
}
let comparisonObjectUrl=null;
function bindComparison(p){
 if(comparisonObjectUrl){URL.revokeObjectURL(comparisonObjectUrl);comparisonObjectUrl=null}
 if(!$('#compareA'))return;const photos=growthPhotos(p);
 const options=photos.map((item,i)=>'<option value="'+i+'">'+escape(item.date||'未标注日期')+' · '+escape(item.label)+'</option>').join('');$('#compareA').innerHTML=options;$('#compareB').innerHTML=options;
 $('#compareB').value=String(photos.findLastIndex(x=>x.url!==photos[0].url));
 function update(){const a=photos[Number($('#compareA').value)],b=photos[Number($('#compareB').value)];$('#comparePreview').innerHTML=[a,b].map(x=>'<figure><img src="'+escape(x.url)+'" alt="'+escape(p.name)+' '+escape(x.date||'未标日期')+'"><figcaption>'+escape(x.date||'未标注日期')+'</figcaption></figure>').join('');$('#comparisonResult').hidden=true;$('#compareError').textContent='';$('#generateComparison').disabled=a.url===b.url;if(a.url===b.url)$('#compareError').textContent='请选择两张不同的照片。'}
 $('#compareA').onchange=update;$('#compareB').onchange=update;update();
 $('#generateComparison').onclick=async()=>{
  const button=$('#generateComparison'),result=$('#comparisonResult');button.disabled=true;button.textContent='正在生成…';$('#compareA').disabled=true;$('#compareB').disabled=true;$('#compareError').textContent='';
  let pair=[photos[Number($('#compareA').value)],photos[Number($('#compareB').value)]];if(pair.every(x=>x.date))pair.sort((a,b)=>a.date.localeCompare(b.date));
  try{
   const images=await Promise.all(pair.map(x=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('照片读取失败，请刷新页面后重试。'));image.src=x.url})));
   const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1180;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('浏览器暂不支持生成对比图。');
   ctx.fillStyle='#f8f9f5';ctx.fillRect(0,0,1600,1180);ctx.fillStyle='#244b39';ctx.fillRect(0,0,1600,220);
   ctx.fillStyle='#dce8b9';ctx.font='22px "Noto Sans SC", sans-serif';ctx.fillText('植藏 / 生长对比',54,48);
   ctx.fillStyle='#ffffff';ctx.font='bold 42px "Noto Sans SC", sans-serif';drawWrappedText(ctx,p.name,54,110,1492,52,2);
   ctx.fillStyle='#dce8b9';ctx.font='23px "Noto Sans SC", sans-serif';ctx.fillText('收藏编号：'+p.number,54,194);
   for(let i=0;i<2;i++){const image=images[i],x=54+i*774,y=250,w=718,h=740;ctx.fillStyle='#e8ede1';ctx.fillRect(x,y,w,h);const scale=Math.min(w/image.naturalWidth,h/image.naturalHeight);const iw=image.naturalWidth*scale,ih=image.naturalHeight*scale;ctx.drawImage(image,x+(w-iw)/2,y+(h-ih)/2,iw,ih);ctx.fillStyle='#244b39';ctx.font='bold 30px "Noto Sans SC", sans-serif';ctx.fillText(pair[i].date||'未标注日期',x,1045);ctx.font='21px "Noto Sans SC", sans-serif';drawWrappedText(ctx,pair[i].label,x,1081,w,28,1)}
   ctx.fillStyle='#6d8062';ctx.font='22px "Noto Sans SC", sans-serif';const days=pair.every(x=>x.date)?Math.abs(Math.round((Date.parse(pair[1].date)-Date.parse(pair[0].date))/86400000)):null;ctx.fillText(days===null?'请为照片补填日期以计算生长间隔':'生长间隔 '+days+' 天',54,1140);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('对比图生成失败，请重试。');if(!button.isConnected||!$('#detail').open||selected?.id!==p.id)return;
   if(comparisonObjectUrl)URL.revokeObjectURL(comparisonObjectUrl);comparisonObjectUrl=URL.createObjectURL(blob);$('#comparisonImage').src=comparisonObjectUrl;$('#downloadComparison').href=comparisonObjectUrl;$('#downloadComparison').download=(p.name+'-'+p.number+'-'+(pair[0].date||'未标日期')+'_'+(pair[1].date||'未标日期')+'.png').replace(/[\\/:*?"<>|]/g,'_');result.hidden=false;toast('对比图已生成，可下载保存');
  }catch(err){if($('#compareError'))$('#compareError').textContent=err.message}finally{if(button.isConnected){button.textContent='生成对比图';button.disabled=false;$('#compareA').disabled=false;$('#compareB').disabled=false}}
 };
}
function drawWrappedText(ctx,text,x,y,width,lineHeight,maxLines){let line='',lines=0;for(const char of String(text)){if(ctx.measureText(line+char).width>width&&line){ctx.fillText(line,x,y+lines*lineHeight);lines++;line='';if(lines>=maxLines)return}line+=char}if(line&&lines<maxLines)ctx.fillText(line,x,y+lines*lineHeight)}
$('#detail').addEventListener('cancel',e=>{if(growthBusy)e.preventDefault()});

function updateIdentification(){
 const kind=$('#plantForm').elements.identification.value;
 $('#plantForm').elements.species.required=['aff','cf'].includes(kind);
 $$('[data-infra]').forEach(label=>{const enabled=label.dataset.infra==='infraspecific'?['aff','cf'].includes(kind):kind==='species';label.hidden=!enabled;label.querySelector('input').disabled=!enabled;});
}
$('#plantForm').elements.identification.onchange=updateIdentification;
function renderReferences(){
 $('#referencePreview').innerHTML=taxonReferences.map((url,i)=>'<div><img src="'+escape(url)+'" alt="参考图 '+(i+1)+'"><button type="button" data-remove-reference="'+i+'" aria-label="移除参考图 '+(i+1)+'">×</button></div>').join('');
 $$('[data-remove-reference]').forEach(b=>{b.disabled=taxonUploading;b.onclick=()=>{taxonReferences.splice(Number(b.dataset.removeReference),1);renderReferences()}});
}
function updateTaxonRanks(){
 const parent=JSON.parse($('#taxonParent').value||'[]');
 $('#taxonRank').innerHTML=childRanks(parent).map(r=>'<option value="'+r.key+'">'+r.label+' ('+r.latin+')</option>').join('');
 updateReferenceBox();
}
function updateReferenceBox(){
 const rank=taxonEditing?.rank||$('#taxonRank').value;
 $('#taxonReferenceBox').hidden=!referenceRank(rank);
 $('#taxonPath').textContent=taxonEditing?taxonEditing.path.map(p=>rankInfo(p.rank).label+'：'+p.name).join(' / '):'';
}
function openTaxon(parent=[],node=null){
 if(!authState?.user||$('#demo').checked){toast('请登录并切换到个人档案后添加分类');return;}
 taxonEditing=node?{...node,record:node.record?{...node.record}:null}:null;
 taxonReferences=[...(node?.references||[])];taxonUploading=false;
 $('#taxonError').textContent='';$('#referenceStatus').textContent='';$('#referenceFiles').value='';
 $('#taxonIdentity').hidden=Boolean(node);$('#taxonName').required=!node;
 $('#taxonTitle').textContent=node?'管理参考图 · '+node.name:'添加分类';
 $('#taxonParent').innerHTML='<option value="[]">无上级（根分类）</option>'+[...taxonomyNodes.values()].filter(n=>childRanks(n.path).length).map(n=>'<option value="'+escape(n.key)+'">'+escape(n.path.map(p=>p.name).join(' / '))+'</option>').join('');
 $('#taxonParent').value=pathKey(parent);$('#taxonName').value='';updateTaxonRanks();renderReferences();modal('taxonEditor');
}
if(classificationPage){
 $('#newTaxon').onclick=()=>openTaxon();$('#taxonParent').onchange=updateTaxonRanks;$('#taxonRank').onchange=updateReferenceBox;
 const busy=value=>{taxonUploading=value;$('#saveTaxon').disabled=value;$('#referenceFiles').disabled=value;$('#taxonParent').disabled=value;$('#taxonRank').disabled=value;renderReferences()};
 $('#referenceFiles').onchange=async e=>{
  const files=[...e.target.files];e.target.value='';
  busy(true);
  try{for(const [i,file] of files.entries()){
   if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('请选择不超过 8 MB 的 JPG、PNG 或 WebP：'+file.name);
   $('#referenceStatus').textContent='正在导入 '+(i+1)+' / '+files.length+' 张参考图…';
   const body=new FormData();body.append('file',file);const result=await api('/api/images',{method:'POST',body});
   taxonReferences.push(result.url);renderReferences();
  }$('#referenceStatus').textContent='已导入，点击“保存分类”完成。';}catch(error){$('#referenceStatus').textContent=error.message}finally{busy(false)}
 };
 $('#taxonForm').onsubmit=async e=>{
  e.preventDefault();if(taxonUploading)return;
  const path=taxonEditing?.path||[...JSON.parse($('#taxonParent').value),{rank:$('#taxonRank').value,name:$('#taxonName').value.trim()}];
  const references=referenceRank(path.at(-1).rank)?taxonReferences:[];
  const existing=taxonEditing?.record;
  busy(true);$('#taxonError').textContent='';
  try{
   const saved=await api('/api/taxa'+(existing?'/'+existing.id:''),{method:existing?'PUT':'POST',headers:{'Content-Type':'application/json',...(existing?{'If-Match':'"'+existing._revision+'"'}:{})},body:JSON.stringify({path,references})});
   taxa=existing?taxa.map(t=>t.id===saved.id?saved:t):[...taxa,saved];renderTree();close('taxonEditor');toast('分类与参考图已保存到云端');
  }catch(error){$('#taxonError').textContent=error.message}finally{busy(false)}
 };
 $('#taxonEditor').addEventListener('cancel',e=>{if(taxonUploading)e.preventDefault()});
}

load();

// Desktop installation uses the existing signed-in website and cloud records.
(()=>{
 let prompt=null;
 const button=$('#installApp'),install=$('#installNow');
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const refresh=()=>{button.hidden=standalone();install.hidden=!prompt;};
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();prompt=e;refresh();});
 window.addEventListener('appinstalled',()=>{prompt=null;refresh();close('installDialog');toast('植藏已添加到桌面');});
 button.onclick=()=>{
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const android=/Android/.test(navigator.userAgent);
  $('#installGuide').textContent=prompt?'点击“安装植藏”，即可使用植物图标从桌面打开。':ios?'请用 Safari 打开本站，点击“分享”，选择“添加到主屏幕”。':android?'请用 Chrome 打开本站，在右上角菜单选择“安装应用”或“添加到主屏幕”。':'请用 Chrome 或 Edge 打开本站，在地址栏或浏览器菜单选择“安装植藏”或“将此站点安装为应用”。';
  refresh();modal('installDialog');
 };
 install.onclick=async()=>{if(!prompt)return;const pending=prompt;prompt=null;refresh();try{await pending.prompt();await pending.userChoice;}catch{toast('请通过浏览器菜单添加到桌面');}};
 if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});
 refresh();
})();

async function refreshCloud(){
 if(loading||syncRunning||syncWrites||document.hidden||!navigator.onLine)return;
 syncRunning=true;const epoch=syncEpoch;
 try{
  const state=await api('/api/auth');
  if(epoch!==syncEpoch)return;
  if(state.user?.id!==authState?.user?.id){syncEpoch++;clearPrivateView();await load();return;}
  if(!state.user){showAccount(state);return;}
  const latest=await api('/api/plants');
  if(epoch!==syncEpoch)return;
  const latestTaxa=typeof classificationPage!=='undefined'&&classificationPage?await api('/api/taxa'):null;
  if(epoch!==syncEpoch)return;
  const changed=JSON.stringify(latest)!==JSON.stringify(records)||(latestTaxa&&JSON.stringify(latestTaxa)!==JSON.stringify(taxa));
  if(latestTaxa)taxa=latestTaxa;
  records=latest;$('#error').hidden=true;
  if(autoDemo&&records.length){$('#demo').checked=false;autoDemo=false;}
  if(changed){
   render();
   if($('#detail').open&&!selected?.demo){
    if(!$('#editor').open&&!$('#confirm').open&&!growthBusy&&!$('#logText')?.value&&!$('#growthPhotoPreview')?.children.length&&!$('#statusNote')?.value&&!($('#statusValue')&&$('#statusValue').value!==(selected?.status||'生长中'))&&!($('#statusDate')&&$('#statusDate').value!==today())){
     const p=records.find(x=>x.id===selected.id);if(p)openDetail(p.id);else{close('detail');toast('该档案已在其他窗口删除');}
    }else syncStatus('云端有更新，关闭档案后可读取');
   }
  }
  if(!changed||!$('#editor').open&&!$('#detail').open)syncStatus('云端已同步');
 }catch(error){syncStatus(navigator.onLine?'同步暂未完成，将自动重试':'离线，连接网络后自动同步');}
 finally{syncRunning=false;}
}
setInterval(refreshCloud,15000);
window.addEventListener('focus',refreshCloud);
window.addEventListener('online',refreshCloud);
window.addEventListener('offline',()=>syncStatus('离线，连接网络后自动同步'));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCloud();});
for(const dialog of $$('dialog'))dialog.addEventListener('close',refreshCloud);
if(syncChannel)syncChannel.onmessage=event=>{if(event.data?.type==='changed')refreshCloud();if(event.data?.type==='auth-changed'){syncEpoch++;clearPrivateView();load();}};

$('#chooseOriginLocation').onclick=async()=>{const button=$('#chooseOriginLocation');button.disabled=true;try{const module=await originMapModule();if(!originPicker)originPicker=module.createOriginPicker({dialog:$('#originPicker'),api,canEdit:()=>Boolean(authState?.user),onConfirm(location){originDraft=location;if(!$('#plantForm').elements.origin.value.trim())$('#plantForm').elements.origin.value=locationLabel(location);renderOriginDraft();}});originPicker.open(originDraft,$('#plantForm').elements.origin.value);}catch{toast('地图加载失败，请稍后重试。')}finally{button.disabled=false}};
$('#clearOriginLocation').onclick=()=>{originDraft=null;renderOriginDraft()};
