import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';

const read=name=>JSON.parse(readFileSync(new URL('./knowledge/'+name+'.json',import.meta.url),'utf8'));
const normalize=text=>text.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const rankNames=new Map([['种','species'],['属','genus'],['科','family']]);
const supportedRanks=new Set(rankNames.values());
const worldFlora=read('world-flora');
const globalDatabase=new DatabaseSync(fileURLToPath(new URL('./knowledge/world-flora.sqlite',import.meta.url)),{readOnly:true});
globalDatabase.exec('PRAGMA cache_size=-2048; PRAGMA mmap_size=0;');
const globalLookup=globalDatabase.prepare(`SELECT taxa.*,names.synonym FROM names JOIN taxa USING(id)
 WHERE names.name=? AND (?='' OR taxa.rank=?) ORDER BY names.synonym LIMIT 3`);
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

function regionalMatch(key,expected){
 const entries=names.get(key)||[aliases.get(key)].filter(Boolean);
 const matches=expected?entries.filter(taxon=>taxon.rank===expected):entries;
 return matches.length===1?matches[0]:null;
}

export function findKnowledge(name,rank=''){
 if(typeof name!=='string'||!name.trim())return null;
 const key=normalize(name);
 const normalizedRank=rankNames.get(rank)||normalize(rank);
 const expected=supportedRanks.has(normalizedRank)?normalizedRank:'';
 const results=globalLookup.all(key,expected,expected);
 // Prefer an exact accepted name. Multiple equally plausible homonyms stay unresolved.
 const matches=results.filter(result=>result.synonym===results[0]?.synonym);
 if(matches.length>1)return null;
 const global=matches[0];
 const regional=regionalMatch(global?normalize(global.name):key,expected);
 const taxon=global||regional;
 if(!taxon)return null;
 return {
  name:taxon.name,rank:taxon.rank,family:taxon.family,order:regional?.order||'',
  synonym:key!==normalize(taxon.name),
  source:global?'https://www.worldfloraonline.org/taxon/wfo-'+String(global.id).padStart(10,'0'):'https://www.gbif.org/species/'+regional.id,
  sourceName:global?'World Flora Online':'GBIF',
  sourceVersion:global?worldFlora.release:dataset.date,
  gbifSource:global&&regional?'https://www.gbif.org/species/'+regional.id:'',
  traits:features.get(normalize(taxon.genus))||null,
  observations:observations.get(regional?.id)||[],
 };
}

export function knowledgeContext(description,previous){
 const text=normalize(description);
 const genusHints=diagnostics.map(item=>item.name+'（'+item.zh+'）：'+item.traits).join('\n');
 const mentionedTaxa=new Map();
 for(const candidate of previous?.candidates||[]){
  const entry=findKnowledge(candidate.scientificName,candidate.rank);
  if(entry)mentionedTaxa.set(entry.name,entry);
 }
 // Probe words and adjacent Latin binomials using the on-disk name index.
 const phrases=text.match(/[a-z][a-z'’.-]*(?:[ \t]+[a-z][a-z'’.-]*)*/g)||[];
 const probes=new Set();
 for(const phrase of phrases){
  const words=phrase.split(/\s+/);
  for(const [index,word] of words.entries()){
   if(words[index+1])probes.add(word+' '+words[index+1]);
   probes.add(word);
  }
 }
 for(const probe of [...probes].slice(0,64)){
  const entry=findKnowledge(probe);
  if(entry)mentionedTaxa.set(entry.name,entry);
 }
 const records=[...mentionedTaxa.values()].sort((a,b)=>Number(b.rank==='species')-Number(a.rank==='species')).slice(0,8).map(entry=>[entry.name,entry.rank,entry.family].filter(Boolean).join(' / ')).join('\n');
 return '名录与形态资料可用于核对，仍需以本轮可见证据判断。属级特征不能用来强行确认物种，不为这些属预设优先级。\n'+genusHints+
  (records?'\n用户提到或上一轮涉及的植物名录记录：\n'+records:'');
}

export function enrichIdentification(answer){
 if(!Array.isArray(answer?.candidates))return answer;
 return {...answer,candidates:answer.candidates.map(candidate=>{
  const match=findKnowledge(candidate.scientificName,candidate.rank);
  return match?{...candidate,knowledge:match}:candidate;
 })};
}
