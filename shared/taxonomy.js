// Optional ranks may be omitted; identification qualifiers stay below species.
export const ranks=[
 ['kingdom','界','kingdom / regnum',0],['division','门','division / phylum',1],
 ['className','纲','class / classis',2],['order','目','order / ordo',3],
 ['family','科','family / familia',4],['tribe','族','tribe / tribus',5],
 ['genus','属','genus',6],['section','组','section / sectio',7],
 ['series','系','series',8],['species','种','species',9],
 ['unresolved','未定种','sp.',9],['hybrid','杂交种','hybrid / ×',9],['variety','变种','var. / varietas',10],
 ['form','变型','f. / forma',11],['aff','近缘种','aff.',10],['cf','近似种','cf.',10]
].concat([['subkingdom','亚界','subkingdom',0.2],['infrakingdom','次界','infrakingdom',0.4],['superdivision','总门','superdivision',0.6],['infradivision','次门','infradivision',1.25],['clade4','演化支四','clade',1.84],['clade5','演化支五','clade',1.88],['clade6','演化支六','clade',1.92],['infraclass','次纲','infraclass',2.3],['infraorder','次目','infraorder',3.3],['superfamily','总科','superfamily',3.5],['subvariety','亚变种','subvariety',10.2],['subform','亚变型','subform',11.2],['subdivision','亚门','subdivision',1.2],['angiosperm','被子植物分支','angiosperms',1.3],['clade1','演化支一','clade',1.4],['clade2','演化支二','clade',1.6],['clade3','演化支三','clade',1.8],['subclass','亚纲','subclass',2.2],['superorder','总目','superorder',2.5],['suborder','亚目','suborder',3.2],['subfamily','亚科','subfamily',4.2],['subtribe','亚族','subtribe',5.2],['subgenus','亚属','subgenus',6.2],['subsection','亚组','subsection',7.2],['subseries','亚系','subseries',8.2],['subspecies','亚种','subspecies',9.5]]).sort((a,b)=>a[3]-b[3]).map(([key,label,latin,level])=>({key,label,latin,level}));
export const rankInfo=key=>ranks.find(r=>r.key===key);
export const referenceRank=key=>rankInfo(key)?.level>=9;
export const taxonomySystems=[{key:'apg4',label:'APG IV'},{key:'itis',label:'ITIS'}];
export function taxonomySystem(value){if(value===undefined||value===null)return 'apg4';if(!taxonomySystems.some(s=>s.key===value))throw Error('分类体系无效');return value}
const itisOnly=['subkingdom','infrakingdom','superdivision','subdivision','infradivision','infraclass','infraorder','superfamily','subvariety','subform'];
export const systemRanks=system=>ranks.filter(r=>taxonomySystem(system)==='itis'?r.key!=='angiosperm'&&!r.key.startsWith('clade'):!itisOnly.includes(r.key));
export function childRanks(path=[],system){
 const all=system===undefined?ranks:systemRanks(system),parent=path.at(-1)?.rank;
 if(['hybrid','unresolved','aff','cf','subform'].includes(parent))return [];
 const level=parent?rankInfo(parent)?.level:-1;
 return all.filter(r=>r.level>level&&(!['aff','cf'].includes(r.key)||parent==='species'));
}
export function validPath(path,system){
 if(!Array.isArray(path)||!path.length||path.length>40)throw Error('分类路径无效');
 const out=[];
 for(const part of path){
  const bilingual=Object.hasOwn(part||{},'nameZh')||Object.hasOwn(part||{},'nameEn');
  const nameZh=String(part?.nameZh??'').trim(),nameEn=String(part?.nameEn??'').trim();
  const name=bilingual?(nameEn||nameZh):(typeof part?.name==='string'?part.name.trim():'');
  if(!name||Math.max(name.length,nameZh.length,nameEn.length)>200||!childRanks(out,system).some(r=>r.key===part.rank))throw Error('分类层级无效，且每层中文或英文至少填写一项（最多 200 字）');
  out.push({rank:part.rank,name,...(bilingual?{nameZh,nameEn}:{})});
 }return out;
}
export const pathKey=path=>JSON.stringify(path.map(({rank,name})=>({rank,name})));
export const storagePathKey=(path,system)=>taxonomySystem(system)+':'+pathKey(path);
export const nameKey=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
export const partNames=part=>[part.name,part.nameZh,part.nameEn].filter(Boolean);
export const sameTaxon=(a,b)=>a.rank===b.rank&&partNames(a).some(n=>partNames(b).some(v=>nameKey(n)===nameKey(v)));
export const partLabel=part=>part.nameZh&&part.nameEn?part.nameZh+' / '+part.nameEn:part.nameZh||part.nameEn||part.name;
export function bilingualNames(part){return {nameZh:part.nameZh??(/\p{Script=Han}/u.test(part.name||'')?part.name:''),nameEn:part.nameEn??(/\p{Script=Han}/u.test(part.name||'')?'':part.name)}}
function legacyPlantPath(p){
 if(p.taxonomyDetached)return [];
 const path=[];
 for(const r of ranks.filter(r=>r.level<9))if(p[r.key]?.trim())path.push({rank:r.key,name:p[r.key].trim()});
 const rank=['unresolved','hybrid'].includes(p.identification)?p.identification:'species';
 path.push({rank,name:p.species?.trim()||p.latin?.trim()||p.name});
 if(rank==='species'){
  if(['aff','cf'].includes(p.identification))path.push({rank:p.identification,name:p.infraspecific?.trim()||p.name});
  else{if(p.variety?.trim())path.push({rank:'variety',name:p.variety.trim()});if(p.form?.trim())path.push({rank:'form',name:p.form.trim()})}
 }return path;
}
export function plantPath(p,system='apg4'){
 taxonomySystem(system);
 if(p.taxonomyPaths)return p.taxonomyPaths[system]||[];
 return system==='apg4'?legacyPlantPath(p):[];
}
export function validTaxonomyPaths(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!taxonomySystems.some(s=>s.key===k)))throw Error('分类路径数据无效');
 return Object.fromEntries(taxonomySystems.map(({key})=>{const path=value[key]??[];if(!Array.isArray(path))throw Error('分类路径数据无效');return [key,path.length?validPath(path,key):[]]}));
}
export function canonicalPath(path,tree){
 const out=[];
 for(const part of path){
  const matches=[...tree.nodes.values()].filter(n=>sameTaxon(n,part));
  const match=matches.find(n=>pathKey(n.path.slice(0,-1))===pathKey(out));
  if(matches.length&&!match)throw Object.assign(Error('相同层级与名称已存在于其他上级下，请复用或编辑已有分类：'+partLabel(matches[0])),{status:409});
  if(match){
   const known=bilingualNames(match);for(const key of ['nameZh','nameEn'])if(part[key]&&nameKey(part[key])!==nameKey(known[key]))throw Object.assign(Error('分类名称已存在，请在分类树中编辑中英文名称'),{status:409});
   out.push({rank:match.rank,name:match.name,...(match.nameZh!==undefined||match.nameEn!==undefined?{nameZh:match.nameZh||'',nameEn:match.nameEn||''}:{})});
  }else out.push(part);
 }return out;
}
export function buildTree(plants,taxa=[],system='apg4'){
 taxonomySystem(system);
 const roots=[],nodes=new Map();
 function add(path){let children=roots;let node;
  path.forEach((part,i)=>{const prefix=path.slice(0,i+1),key=pathKey(prefix);
   node=nodes.get(key);if(!node){node={...part,key,path:prefix,children:[],plants:[],references:[],record:null};nodes.set(key,node);children.push(node)}children=node.children;
  });return node;
 }
 for(const t of taxa){if(taxonomySystem(t.system)!==system)continue;const n=add(t.path);n.references=t.references||[];n.record=t;}
 for(const p of plants){const path=plantPath(p,system);if(path.length)add(path).plants.push(p);}
 function sort(children){children.sort((a,b)=>rankInfo(a.rank).level-rankInfo(b.rank).level||a.name.localeCompare(b.name,'zh'));children.forEach(n=>sort(n.children));}
 sort(roots);return {roots,nodes};
}

function clearFlat(plant){const next={...plant,identification:'species'};for(const r of ranks)next[r.key]='';next.infraspecific='';return next}
export function syncFlatClassification(plant){
 const next=clearFlat(plant),path=plantPath(plant,'apg4').length?plantPath(plant,'apg4'):plantPath(plant,'itis');
 for(const part of path){
  if(['species','hybrid','unresolved'].includes(part.rank)){next.species=part.name;next.identification=part.rank}
  else if(['aff','cf'].includes(part.rank)){next.identification=part.rank;next.infraspecific=part.name}
  else next[part.rank]=part.name;
 }return next;
}
export function detachClassification(plant,system){
 if(system==='apg4'&&!plant.taxonomyPaths)return detachClassification(plant);
 if(system!==undefined){const paths=Object.fromEntries(taxonomySystems.map(({key})=>[key,plantPath(plant,key)]));paths[taxonomySystem(system)]=[];return syncFlatClassification({...plant,taxonomyPaths:paths,taxonomyDetached:false})}
 const next=clearFlat(plant);next.taxonomyDetached=true;if(plant.taxonomyPaths)next.taxonomyPaths={apg4:[],itis:[]};return next;
}
export function applyClassificationPath(plant,path,system='apg4'){
 const paths=Object.fromEntries(taxonomySystems.map(({key})=>[key,plantPath(plant,key)]));paths[taxonomySystem(system)]=validPath(path,system);
 const next=syncFlatClassification({...plant,taxonomyPaths:paths});delete next.taxonomyDetached;return next;
}

// Suggest only explicitly saved names. Do not turn plant nicknames or missing-rank placeholders into taxonomy.
export function taxonomySuggestions(plants=[],taxa=[],rank,query='',system,language){
 if(!rankInfo(rank))return [];
 if(system!==undefined){const names=new Map();for(const p of plants)if(!p.demo)for(const part of plantPath(p,system))if(part.rank===rank){const value=language?bilingualNames(part)[language]:part.name;if(value)names.set(nameKey(value),value)}for(const t of taxa)if(taxonomySystem(t.system)===system)for(const part of t.path||[])if(part.rank===rank){const value=language?bilingualNames(part)[language]:part.name;if(value)names.set(nameKey(value),value)}const fold=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().trim(),q=fold(query);return [...names.values()].filter(n=>fold(n).includes(q)).sort((a,b)=>Number(fold(b).startsWith(q))-Number(fold(a).startsWith(q))||a.localeCompare(b,'zh-CN'))}

 const names=new Map(),add=value=>{if(typeof value!=='string')return;const name=value.trim();if(!name)return;const key=name.normalize('NFKC').toLocaleLowerCase();if(!names.has(key))names.set(key,name)};
 for(const p of plants){
  if(p.demo||p.taxonomyDetached)continue;
  const kind=p.identification||'species';
  if(['species','hybrid','unresolved'].includes(rank)){if(rank===(['hybrid','unresolved'].includes(kind)?kind:'species'))add(p.species)}
  else if(['aff','cf'].includes(rank)){if(kind===rank)add(p.infraspecific)}
  else if(['variety','form'].includes(rank)){if(kind==='species')add(p[rank])}
  else add(p[rank]);
 }
 for(const taxon of taxa)for(const part of taxon.path||[])if(part.rank===rank)add(part.name);
 const fold=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().trim(),q=fold(query);
 return [...names.values()].filter(name=>!q||fold(name).includes(q)).sort((a,b)=>Number(fold(b).startsWith(q))-Number(fold(a).startsWith(q))||a.localeCompare(b,'zh-CN'));
}
