import {taxonomySystems,systemRanks,plantPath,bilingualNames,validPath,partLabel,buildTree,pathKey} from '/taxonomy.js';
export function createTaxonomyEditor({form,getPlants,getTaxa,bindChoices,initialSystem='apg4'}){
 const root=document.createElement('div');root.id='dualTaxonomyEditor';root.className='dual-taxonomy-editor';
 root.innerHTML='<label>分类路径<select id="plantTaxonomySystem">'+taxonomySystems.map(s=>'<option value="'+s.key+'">'+s.label+'</option>').join('')+'</select></label><p class="taxonomy-help">两套路径分别保存。层级可跳过；填写的每层至少有中文或英文一项。中英文是同一节点的两个名称，可直接复用并补充缺少的一项；修改已有名称或移动分类，请在分类树编辑节点。</p><p id="legacyTaxonomyNotice" class="taxonomy-help" hidden>旧分类保留在 APG IV 路径下，未经自动校对；ITIS 路径独立填写。英文栏也可填写拉丁学名。</p><label class="taxonomy-all-ranks"><input type="checkbox" id="showAllTaxonomyRanks"> 显示所有可选层级</label>';
 const oldHeading=[...form.querySelectorAll('h3')].find(n=>n.textContent==='植物分类');oldHeading.after(root);
 for(const label of form.querySelectorAll('.form-grid>label')){const input=label.querySelector('input,select');if(input&&['kingdom','division','className','order','tribe','section','series','species','identification','variety','form','infraspecific','family','genus'].includes(input.name))label.classList.add('legacy-taxonomy-field')}
 for(let node=root.nextElementSibling;node&&node.tagName!=='H3';node=node.nextElementSibling)node.classList.add('legacy-taxonomy-field');
 const selector=root.querySelector('select'),all=root.querySelector('#showAllTaxonomyRanks'),grids=new Map(),inputs=new Map();selector.value=initialSystem;
 for(const system of taxonomySystems){
  const grid=document.createElement('div');grid.className='taxonomy-language-grid';grid.dataset.system=system.key;grids.set(system.key,grid);root.append(grid);
  for(const rank of systemRanks(system.key)){
   const row=document.createElement('div');row.className='taxonomy-language-row';row.dataset.rank=rank.key;
   const title=document.createElement('strong');title.textContent=rank.label+' · '+rank.latin;row.append(title);grid.append(row);
   for(const [language,text] of [['nameZh','中文名称'],['nameEn','英文 / 拉丁名称']]){
    const label=document.createElement('label');label.append(document.createTextNode(text));const input=document.createElement('input');input.type='text';input.maxLength=200;input.name='taxonomy_'+system.key+'_'+rank.key+'_'+language;input.dataset.taxonomyLanguage=language;input.dataset.taxonomyRank=rank.key;input.setAttribute('aria-label',system.label+' '+rank.label+' '+text);label.append(input);row.append(label);inputs.set(system.key+':'+rank.key+':'+language,input);bindChoices(input,()=>rank.key,{system:()=>system.key,language});
   }grid.append(row);
  }
 }
 function update(){
  for(const [system,grid]of grids){grid.hidden=system!==selector.value;for(const row of grid.children){const filled=[...row.querySelectorAll('input')].some(i=>i.value.trim()),common=['kingdom','order','family','genus','species',...(system==='apg4'?['angiosperm','clade1']:['division','className'])].includes(row.dataset.rank);row.hidden=!all.checked&&!filled&&!common}}
 }
 selector.onchange=()=>{form.dispatchEvent(new CustomEvent('taxonomy-system-change'));update()};all.onchange=update;
 return {root,get system(){return selector.value},open(plant,system=initialSystem){
  selector.value=system;all.checked=false;for(const input of inputs.values())input.value='';
  for(const s of taxonomySystems){const path=plant?plantPath(plant,s.key):[],tree=buildTree(getPlants(),getTaxa(),s.key);for(const [index,part]of path.entries()){const names=bilingualNames(part),node=tree.nodes.get(pathKey(path.slice(0,index+1))),known=node?bilingualNames(node):{};for(const language of ['nameZh','nameEn'])if(!names[language]&&known[language])names[language]=known[language];for(const language of ['nameZh','nameEn']){const input=inputs.get(s.key+':'+part.rank+':'+language);if(input)input.value=names[language]||''}}}
  root.querySelector('#legacyTaxonomyNotice').hidden=!plant||Boolean(plant.taxonomyPaths);update();
 },getPaths(){return Object.fromEntries(taxonomySystems.map(system=>{const path=[];for(const rank of systemRanks(system.key)){const nameZh=inputs.get(system.key+':'+rank.key+':nameZh').value.trim(),nameEn=inputs.get(system.key+':'+rank.key+':nameEn').value.trim();if(nameZh||nameEn)path.push({rank:rank.key,nameZh,nameEn})}return [system.key,path.length?validPath(path,system.key):[]]}))}};
}
