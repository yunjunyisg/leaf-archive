import {readFileSync} from 'node:fs';

const read=name=>JSON.parse(readFileSync(new URL('./knowledge/'+name+'.json',import.meta.url),'utf8'));
const normalize=text=>text.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const rankNames=new Map([['种','species'],['属','genus']]);
const supportedRanks=new Set(['species','genus']);
const dataset=read('snapshot');
const {diagnostics}=read('seed');
const features=new Map(diagnostics.map(item=>[normalize(item.name),item]));
const taxa=new Map(dataset.taxa.map(taxon=>[taxon.id,taxon]));
const names=new Map();
for(const taxon of taxa.values()){
 const key=normalize(taxon.name);
 if(!names.has(key))names.set(key,[]);
 names.get(key).push(taxon);
}
const aliases=new Map(Object.entries(dataset.aliases).map(([name,id])=>[normalize(name),taxa.get(id)]));
const observations=new Map();
for(const row of dataset.observations){
 if(!observations.has(row.taxonId))observations.set(row.taxonId,[]);
 observations.get(row.taxonId).push({
  platform:row.platform,license:row.license,url:'https://www.gbif.org/occurrence/'+row.id,
 });
}

export function findKnowledge(name,rank=''){
 if(typeof name!=='string'||!name.trim())return null;
 const key=normalize(name);
 const expected=rankNames.get(rank)||normalize(rank);
 const entries=names.get(key)||[aliases.get(key)].filter(Boolean);
 const matches=supportedRanks.has(expected)?entries.filter(taxon=>taxon.rank===expected):entries;
 if(matches.length!==1)return null;
 const taxon=matches[0];
 return {
  name:taxon.name,rank:taxon.rank,family:taxon.family,order:taxon.order,
  synonym:key!==normalize(taxon.name),
  source:'https://www.gbif.org/species/'+taxon.id,
  traits:features.get(normalize(taxon.genus))||null,
  observations:observations.get(taxon.id)||[],
 };
}

export function knowledgeContext(description,previous){
 const text=normalize(description);
 const mentioned=new Set(text.match(/[a-z][a-z'’-]*/g)||[]);
 const genusHints=diagnostics.map(item=>item.name+'（'+item.zh+'）：'+item.traits).join('\n');
 const mentionedTaxa=new Map();
 for(const candidate of previous?.candidates||[]){
  const entry=findKnowledge(candidate.scientificName,candidate.rank);
  if(entry)mentionedTaxa.set(entry.name,entry);
 }
 if(text){
  for(const [name,entries] of names){
   const [genus]=name.split(' ');
   if(mentioned.has(genus)&&(name===genus||text.includes(name))){
    const entry=findKnowledge(entries[0].name);
    if(entry)mentionedTaxa.set(entry.name,entry);
   }
  }
  for(const [name,taxon] of aliases){
   if(mentioned.has(name.split(' ')[0])&&text.includes(name)&&taxon){
    const entry=findKnowledge(name);
    if(entry)mentionedTaxa.set(entry.name,entry);
   }
  }
 }
 const records=[...mentionedTaxa.values()].sort((a,b)=>Number(b.rank==='species')-Number(a.rank==='species')).slice(0,8).map(entry=>[entry.name,entry.rank,entry.family].filter(Boolean).join(' / ')).join('\n');
 return '名录与形态资料可用于核对，仍需以本轮可见证据判断。属级特征不能用来强行确认物种，不为这些属预设优先级。\n'+genusHints+
  (records?'\n用户提到或上一轮涉及的 GBIF 名录记录：\n'+records:'');
}

export function enrichIdentification(answer){
 if(!Array.isArray(answer?.candidates))return answer;
 return {...answer,candidates:answer.candidates.map(candidate=>{
  const match=findKnowledge(candidate.scientificName,candidate.rank);
  return match?{...candidate,knowledge:match}:candidate;
 })};
}
