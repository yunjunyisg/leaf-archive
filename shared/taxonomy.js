// Optional ranks may be omitted; identification qualifiers stay below species.
export const ranks=[
 ['kingdom','界','kingdom / regnum',0],['division','门','division / phylum',1],
 ['className','纲','class / classis',2],['order','目','order / ordo',3],
 ['family','科','family / familia',4],['tribe','族','tribe / tribus',5],
 ['genus','属','genus',6],['section','组','section / sectio',7],
 ['series','系','series',8],['species','种','species',9],
 ['unresolved','未定种','sp.',9],['hybrid','杂交种','hybrid / ×',9],['variety','变种','var. / varietas',10],
 ['form','变型','f. / forma',11],['aff','近缘种','aff.',10],['cf','近似种','cf.',10]
].map(([key,label,latin,level])=>({key,label,latin,level}));
export const rankInfo=key=>ranks.find(r=>r.key===key);
export const referenceRank=key=>rankInfo(key)?.level>=9;
export function childRanks(path=[]){
 const parent=path.at(-1)?.rank;
 if(!parent)return ranks.filter(r=>r.level<=9);
 const level=rankInfo(parent)?.level;
 if(parent==='species')return ranks.filter(r=>['variety','form','aff','cf'].includes(r.key));
 if(parent==='variety')return ranks.filter(r=>r.key==='form');
 return level<9?ranks.filter(r=>r.level>level&&r.level<=9):[];
}
export function validPath(path){
 if(!Array.isArray(path)||!path.length||path.length>12)throw new Error('分类路径无效');
 const out=[];
 for(const part of path){
  const name=typeof part?.name==='string'?part.name.trim():'';
  if(!name||name.length>200||!childRanks(out).some(r=>r.key===part.rank))throw new Error('分类层级或名称无效');
  out.push({rank:part.rank,name});
 }
 return out;
}
export const pathKey=path=>JSON.stringify(path);
export function plantPath(p){
 if(p.taxonomyDetached)return [];
 const path=[];
 for(const r of ranks.filter(r=>r.level<9))if(p[r.key]?.trim())path.push({rank:r.key,name:p[r.key].trim()});
 if(!path.length)path.push({rank:'family',name:'未填写科'});
 const rank=['unresolved','hybrid'].includes(p.identification)?p.identification:'species';
 path.push({rank,name:p.species?.trim()||p.latin?.trim()||p.name});
 if(rank==='species'){
  if(['aff','cf'].includes(p.identification))path.push({rank:p.identification,name:p.infraspecific?.trim()||p.name});
  else{
   if(p.variety?.trim())path.push({rank:'variety',name:p.variety.trim()});
   if(p.form?.trim())path.push({rank:'form',name:p.form.trim()});
  }
 }
 return path;
}
export function buildTree(plants,taxa=[]){
 const roots=[],nodes=new Map();
 function add(path){let children=roots;let node;
  path.forEach((part,i)=>{const prefix=path.slice(0,i+1),key=pathKey(prefix);
   node=nodes.get(key);if(!node){node={...part,key,path:prefix,children:[],plants:[],references:[],record:null};nodes.set(key,node);children.push(node)}children=node.children;
  });return node;
 }
 for(const t of taxa){const n=add(t.path);n.references=t.references||[];n.record=t;}
 for(const p of plants){const path=plantPath(p);if(path.length)add(path).plants.push(p);}
 function sort(children){children.sort((a,b)=>rankInfo(a.rank).level-rankInfo(b.rank).level||a.name.localeCompare(b.name,'zh'));children.forEach(n=>sort(n.children));}
 sort(roots);return {roots,nodes};
}

export function detachClassification(plant){
 const next={...plant,taxonomyDetached:true,identification:'species'};
 for(const key of [...ranks.filter(r=>r.level<9).map(r=>r.key),'species','variety','form','infraspecific'])next[key]='';
 return next;
}
export function applyClassificationPath(plant,path){
 const next=detachClassification(plant);delete next.taxonomyDetached;
 for(const part of validPath(path)){
  if(['species','hybrid','unresolved'].includes(part.rank)){next.species=part.name;next.identification=part.rank}
  else if(['aff','cf'].includes(part.rank)){next.identification=part.rank;next.infraspecific=part.name}
  else next[part.rank]=part.name;
 }
 return next;
}
