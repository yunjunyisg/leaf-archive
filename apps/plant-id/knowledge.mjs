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
const nearbySpecies=globalDatabase.prepare(`SELECT names.name,taxa.id FROM names JOIN taxa USING(id)
 WHERE names.name>=? AND names.name<? AND taxa.rank='species' AND names.synonym=0 LIMIT 4001`);
const chineseNames=Object.entries(read('chinese-names')).sort((a,b)=>b[0].length-a[0].length);
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

function oneEdit(left,right){
 if(left===right||Math.abs(left.length-right.length)>1)return false;
 const [a,b]=left.length<=right.length?[left,right]:[right,left];
 let index=0;
 while(index<a.length&&a[index]===b[index])index++;
 if(a.length!==b.length)return a.slice(index)===b.slice(index+1);
 return a.slice(index+1)===b.slice(index+1)||
  (a[index]===b[index+1]&&a[index+1]===b[index]&&a.slice(index+2)===b.slice(index+2));
}

function latinHint(raw,context,explicit){
 const query=raw.trim();
 const exact=findKnowledge(query);
 if(exact)return {entry:exact,kind:exact.synonym?'synonym':'exact'};
 const abbreviation=query.match(/^([a-z])\.\s*([a-z-]+)$/i);
 if(abbreviation){
  const genera=new Set(context.filter(genus=>genus[0].toLowerCase()===abbreviation[1].toLowerCase()));
  if(genera.size===1){
   const resolved=findKnowledge([...genera][0]+' '+abbreviation[2],'种');
   if(resolved)return {entry:resolved,kind:'expanded'};
  }
  return null;
 }
 if(!explicit)return null;
 const parts=query.match(/^([a-z]+)\s+([a-z-]+)(?:\s+([A-Z].*))?$/i);
 if(!parts)return null;
 const [,genus,epithet,author]=parts;
 if(author){
  if(!/^[A-Z]/.test(author))return null;
  const authored=findKnowledge(genus+' '+epithet,'种');
  return authored?{entry:authored,kind:authored.synonym?'synonym':'exact'}:null;
 }
 if(epithet.length<5||!findKnowledge(genus,'属'))return null;
 const prefix=normalize(genus)+' ', spelling=normalize(epithet);
 const possible=nearbySpecies.all(prefix,prefix+'\uffff');
 if(possible.length>4000)return null;
 const guesses=possible.filter(row=>oneEdit(spelling,row.name.slice(prefix.length)));
 if(guesses.length!==1)return null;
 const result=findKnowledge(guesses[0].name,'种');
 return result?{entry:result,kind:'spelling'}:null;
}

const genusOf=entry=>['genus','species'].includes(entry?.rank)?entry.name.split(' ')[0]:null;
const publicHint=(input,entry,kind)=>({input,name:entry.name,rank:entry.rank,source:entry.source,sourceName:entry.sourceName,kind});

export async function reviewPlantNames({name,description,previous,commonSearch,signal}){
 const text=description.normalize('NFKC');
 const prior=(previous?.candidates||[]).map(c=>findKnowledge(c.scientificName,c.rank));
 const hints=[];
 const add=(input,entry,kind)=>{
  if(hints.length<9&&!hints.some(hint=>hint.input===input&&hint.name===entry.name))hints.push(publicHint(input,entry,kind));
 };
 const knownCommon=query=>{
  const found=chineseNames.find(([label])=>label===query);
  return found?findKnowledge(found[1]):null;
 };
 let remainder=text;
 for(const [label,latin] of chineseNames){
  if(!remainder.includes(label))continue;
  const entry=findKnowledge(latin);
  if(entry)add(label,entry,'common');
  remainder=remainder.replaceAll(label,' ');
 }
 const fullNames=[...text.matchAll(/(?=\b([a-z][a-z-]{2,}\s+[a-z][a-z-]{2,})\b)/gi)];
 for(const [,query] of fullNames.slice(0,24)){
  const match=latinHint(query,[],false);
  if(match)add(query,match.entry,match.kind);
 }
 const context=[...hints.map(genusOf),...prior.map(genusOf)].filter(Boolean);
 for(const query of (text.match(/\b[A-Z]\.\s*[a-z-]{3,}/gi)||[]).slice(0,3)){
  const match=latinHint(query,context,false);
  if(match)add(query,match.entry,match.kind);
 }
 const explicit=name.split(/[，,、；;]+/).map(part=>part.trim()).filter(Boolean).slice(0,3);
 const labels=[...explicit];
 const embedded=text.match(/(?:学名|名称)[：:]\s*([^，,。；;\n]{2,120})/);
 if(embedded&&labels.length<3)labels.push(embedded[1].trim());
 for(const query of labels){
  const common=knownCommon(query);
  if(common){add(query,common,'common');continue}
  const match=latinHint(query,context,true);
  if(match){
   add(query,match.entry,match.kind);
   const genus=genusOf(match.entry);
   if(genus&&['exact','synonym'].includes(match.kind))context.push(genus);
   continue;
  }
  // Only an explicitly entered name can leave the server for a common-name search.
  const matches=explicit.includes(query)&&/^[\p{Script=Han}]{2,20}$/u.test(query)
   ?await commonSearch(query,signal).catch(()=>[]):[];
  for(const item of matches){
   const entry=findKnowledge(item.name,item.rank);
   if(entry)add(query,entry,'common');
  }
  if(hints.length<9&&!hints.some(hint=>hint.input===query))hints.push({input:query,kind:'unmatched'});
 }
 return hints;
}

export function knowledgeContext(description,previous,reviews=[]){
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
 const checks=reviews.map(hint=>hint.name?[hint.input,hint.name,hint.rank,hint.kind].join(' → '):hint.input+' → 未核对到唯一名称').join('\n');
 const records=[...mentionedTaxa.values()].sort((a,b)=>Number(b.rank==='species')-Number(a.rank==='species')).slice(0,8).map(entry=>[entry.name,entry.rank,entry.family].filter(Boolean).join(' / ')).join('\n');
 return '名录与形态资料可用于核对，仍需以本轮可见证据判断。属级特征不能用来强行确认物种，不为这些属预设优先级。\n'+genusHints+
  (records?'\n用户提到或上一轮涉及的植物名录记录：\n'+records:'')+
  (checks?'\n本轮名称核对（exact=接受名，synonym=异名，expanded=有上下文缩写，spelling=可能的拼写更正，common=俗名线索）。这些只核对名称，需要和观察交叉验证：\n'+checks:'');
}

export function enrichIdentification(answer){
 if(!Array.isArray(answer?.candidates))return answer;
 return {...answer,candidates:answer.candidates.map(candidate=>{
  const match=findKnowledge(candidate.scientificName,candidate.rank);
  return match?{...candidate,knowledge:match}:candidate;
 })};
}
