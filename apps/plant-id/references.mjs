const apiHost='https://api.inaturalist.org';
const imageHost='https://inaturalist-open-data.s3.amazonaws.com';
const licenses=new Map([
 ['cc0',['CC0','https://creativecommons.org/publicdomain/zero/1.0/']],
 ['cc-by',['CC BY','https://creativecommons.org/licenses/by/4.0/']],
 ['cc-by-sa',['CC BY-SA','https://creativecommons.org/licenses/by-sa/4.0/']],
]);
const ranks=new Map([['种','species'],['属','genus'],['科','family']]);
const nameKey=name=>name.trim().replace(/\s+/g,' ').toLowerCase();

async function readLimited(response,limit){
 if(!response.body)throw Error('参考图源无响应');
 const reader=response.body.getReader();
 const chunks=[];
 let size=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)return Buffer.concat(chunks);
   size+=value.length;
   if(size>limit)throw Error('参考图源响应过大');
   chunks.push(value);
  }
 }finally{await reader.cancel()}
}

export function createReferences(fetchImpl=fetch){
 const photos=new Map(),cache=new Map();
 let active=0;
 const remember=(map,key,value)=>{
  map.delete(key);
  map.set(key,value);
  if(map.size>400)map.delete(map.keys().next().value);
 };
 async function upstream(url,signal){
  const response=await fetchImpl(url,{redirect:'error',signal,headers:{'User-Agent':'LeafArchive Plant-ID/1.0 (gloriouscarnivorousplants.top)'}});
  if(!response.ok){
   await response.body?.cancel();
   throw Error('参考图来源暂不可用');
  }
  return response;
 }
 async function records(path,params,signal){
  const body=await readLimited(await upstream(apiHost+path+'?'+new URLSearchParams(params),signal),512*1024);
  const results=JSON.parse(body).results;
  return Array.isArray(results)?results:[];
 }
 async function find(name,rank,signal){
  if(!/^[A-Za-z][A-Za-z .'-]{1,119}$/.test(name))return null;
  const expected=ranks.get(rank)||rank.toLowerCase();
  const key=nameKey(name)+'|'+expected;
  const cached=cache.get(key);
  if(cached&&cached.expires>Date.now()){
   if(cached.photo)remember(photos,cached.photo.id,cached.photo.path);
   return cached.photo;
  }
  const deadline=AbortSignal.any([signal,AbortSignal.timeout(7000)]);
  const taxa=await records('/v1/taxa/autocomplete',{q:name,per_page:'10',is_active:'true'},deadline);
  const matches=taxa.filter(t=>t.is_active!==false&&t.iconic_taxon_name==='Plantae'&&nameKey(t.name||'')===nameKey(name));
  const matchedRank=matches.filter(t=>t.rank===expected);
  const taxon=matchedRank.length===1?matchedRank[0]:!ranks.has(rank)&&!['species','genus','family'].includes(expected)&&matches.length===1?matches[0]:null;
  if(!Number.isSafeInteger(taxon?.id))return null;
  const observations=await records('/v1/observations',{
   taxon_id:String(taxon.id),quality_grade:'research',photos:'true',
   photo_license:[...licenses.keys()].join(','),per_page:'5',
  },deadline);
  for(const observation of observations){
   const observed=observation.taxon;
   if(!Number.isSafeInteger(observation.id)||typeof observed?.name!=='string'||!(observed.id===taxon.id||observed.ancestor_ids?.includes(taxon.id)))continue;
   for(const image of observation.photos||[]){
    const license=licenses.get(image.license_code);
    if(!license||typeof image.attribution!=='string'||!image.attribution.trim()||!Number.isSafeInteger(image.id))continue;
    const path=String(image.url||'').match(/^https:\/\/inaturalist-open-data\.s3\.amazonaws\.com\/photos\/(\d+)\/square\.(jpe?g|png)$/i);
    if(!path||path[1]!==String(image.id))continue;
    const id=String(image.id);
    const photo={id,path:'/photos/'+id+'/medium.'+path[2],scientificName:observed.name,attribution:image.attribution,license:license[0],licenseUrl:image.license_url&&/^https?:\/\/creativecommons\.org\/(?:licenses\/(?:by|by-sa)|publicdomain\/zero)\/\d\.\d\/?$/.test(image.license_url)?image.license_url:license[1],source:'https://www.inaturalist.org/observations/'+observation.id};
    remember(photos,id,photo.path);
    remember(cache,key,{photo,expires:Date.now()+30*60*1000});
    return photo;
   }
  }
  remember(cache,key,{photo:null,expires:Date.now()+5*60*1000});
  return null;
 }
 // Bound concurrent upstream lookups and images on the small production host.
 async function limited(action){
  if(active>=8)throw Error('参考图来源繁忙');
  active++;
  try{return await action()}finally{active--}
 }
 return {
  lookup(name,rank,signal){return limited(async ()=>{
   const result=await find(name,rank,signal);
   if(!result)return null;
   const {path:_,...photo}=result;
   return photo;
  })},
  image(id,signal){return limited(async ()=>{
   const path=photos.get(id);
   if(!path)return null;
   const response=await upstream(imageHost+path,AbortSignal.any([signal,AbortSignal.timeout(8000)]));
   const type=response.headers.get('Content-Type')?.split(';')[0];
   if(!['image/jpeg','image/png'].includes(type)){
    await response.body?.cancel();
    return null;
   }
   return {bytes:await readLimited(response,1024*1024),type};
  })},
 };
}
