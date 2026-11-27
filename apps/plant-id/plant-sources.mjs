import {readFileSync} from 'node:fs';

const entries=JSON.parse(readFileSync(new URL('./knowledge/species-notes.json',import.meta.url),'utf8'));
const normalize=s=>typeof s==='string'?s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' '):'';
const localEntry=name=>Object.hasOwn(entries,normalize(name))?entries[normalize(name)]:null;
export const localFacts=name=>localEntry(name)?.facts||[];
export const localPhotos=name=>(localEntry(name)?.images||[]).map(({file,...photo})=>({
 ...photo,src:'/plant-id/photos/'+file,scientificName:name,
}));
export const localPhotoFiles=Object.values(entries).flatMap(entry=>(entry.images||[]).map(photo=>'photos/'+photo.file));

const agent='LeafArchive Plant-ID/1.0 (https://gloriouscarnivorousplants.top; reference lookups)';
const kew='https://powo.science.kew.org';
const iplant='https://www.iplant.cn';
const compact=(value,max)=>typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,max):'';

async function read(fetchImpl,url,signal,max){
 const response=await fetchImpl(url,{headers:{'User-Agent':agent},redirect:'error',signal});
 if(!response.ok||!response.body){await response.body?.cancel();return null;}
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let text='',size=0;
 try{
  while(true){
   const {value,done}=await reader.read();
   if(done)return text+decoder.decode();
   size+=value.length;
   if(size>max)return null;
   text+=decoder.decode(value,{stream:true});
  }
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
}

async function kewFacts(fetchImpl,name,signal){
 const raw=await read(fetchImpl,kew+'/api/2/search?'+new URLSearchParams({q:name,perPage:'10'}),signal,256*1024);
 if(!raw)return [];
 const results=JSON.parse(raw).results;
 const matches=(Array.isArray(results)?results:[]).filter(row=>row.accepted===true&&row.kingdom==='Plantae'&&normalize(row.name)===normalize(name)&&/^urn:lsid:ipni\.org:names:\d+-\d+$/.test(row.fqId));
 if(matches.length!==1)return [];
 const {fqId}=matches[0],path='/taxon/'+fqId,url=kew+path;
 const body=await read(fetchImpl,kew+'/api/2'+path,signal,512*1024);
 const detail=body?JSON.parse(body):null;
 if(detail?.fqId!==fqId||detail.taxonomicStatus!=='Accepted'||normalize(detail.name)!==normalize(name))return [];
 const result=[],range=compact(detail.taxonRemarks,330),reference=compact(detail.reference,140),author=compact(detail.authors,90);
 if(range)result.push({kind:'distribution',title:'邱园 POWO · 物种备注',url,text:range});
 if(author||reference)result.push({kind:'nomenclature',title:'邱园 POWO · 学名发表记录',url,text:[detail.name,author,reference].filter(Boolean).join(' · ')});
 return result;
}

async function chinaFacts(fetchImpl,name,signal){
 const url=iplant+'/info/'+encodeURIComponent(name);
 const html=await read(fetchImpl,url,signal,512*1024);
 const latin=html?.match(/<div\s+id="sptitlel"[^>]*>\s*([^<>]+?)\s*<\/div>/i)?.[1];
 const chinese=html?.match(/<span\s+class="infocname"[^>]*>\s*([^<>]+?)\s*<\/span>/i)?.[1];
 if(!latin||normalize(latin)!==normalize(name)||!chinese||!/^[\p{Script=Han}·\s（）()]{1,50}$/u.test(chinese))return [];
 return [{kind:'nomenclature',title:'中国科学院植物研究所 · 植物智',url,text:'中文名：'+chinese.trim()+'；学名：'+latin.trim()+'。'}];
}

export function createPlantSources(fetchImpl=fetch,sql,now=Date.now){
 const cache=new Map();
 sql.exec(`CREATE TABLE IF NOT EXISTS plant_source_cache(name TEXT PRIMARY KEY,facts TEXT NOT NULL,verified INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS plant_source_cache_verified ON plant_source_cache(verified DESC)`);
 const previous=sql.prepare('SELECT facts,verified FROM plant_source_cache WHERE name=?');
 const save=sql.prepare('INSERT INTO plant_source_cache VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET facts=excluded.facts,verified=excluded.verified');
 const cap=sql.prepare('DELETE FROM plant_source_cache WHERE rowid IN (SELECT rowid FROM plant_source_cache ORDER BY verified DESC LIMIT -1 OFFSET 12000)');
 let saved=0;
 return async function sources(name,signal){
  if(typeof name!=='string'||!(/^[A-Za-z][A-Za-z .'-]{1,119}$/).test(name))return [];
  const key=normalize(name),cached=cache.get(key);
  const time=now();
  if(cached?.expires>time)return cached.facts;
  const stored=previous.get(key),week=7*86400000;
  if(stored?.verified>time-week)return JSON.parse(stored.facts);
  const deadline=AbortSignal.any([signal,AbortSignal.timeout(2800)]);
  const replies=await Promise.allSettled([kewFacts(fetchImpl,name,deadline),chinaFacts(fetchImpl,name,deadline)]);
  const fresh=replies.flatMap(reply=>reply.status==='fulfilled'?reply.value:[]);
  if(fresh.length){
   save.run(key,JSON.stringify(fresh),time);
   if(saved++%64===0)cap.run();
  }
  const facts=fresh.length?fresh:stored?.verified>time-90*86400000?JSON.parse(stored.facts):[];
  cache.set(key,{facts,expires:time+(fresh.length?60:3)*60000});
  if(cache.size>400)cache.delete(cache.keys().next().value);
  return facts;
 };
}
