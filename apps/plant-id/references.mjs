const apiHost='https://api.inaturalist.org';
const imageHost='https://inaturalist-open-data.s3.amazonaws.com';
const licenses=new Map([
 ['cc0',['CC0','https://creativecommons.org/publicdomain/zero/1.0/']],
 ['cc-by',['CC BY','https://creativecommons.org/licenses/by/4.0/']],
 ['cc-by-sa',['CC BY-SA','https://creativecommons.org/licenses/by-sa/4.0/']],
]);
const ranks=new Map([['种','species'],['属','genus'],['科','family']]);
const nameKey=name=>name.trim().replace(/\s+/g,' ').toLowerCase();
const validName=name=>/^[A-Za-z][A-Za-z .'-]{1,119}$/.test(name);

function wikipediaLink(value){
 try{
  const url=new URL(value);
  if(!/^[a-z][a-z0-9-]{1,12}\.wikipedia\.org$/.test(url.hostname)||!url.pathname.startsWith('/wiki/')||
     !['http:','https:'].includes(url.protocol)||url.username||url.password||url.port)return null;
  url.protocol='https:';
  return url.href;
 }catch{return null}
}

function readingFrom(taxon,requested){
 if(taxon?.id!==requested.id||nameKey(taxon.name||'')!==nameKey(requested.name))return null;
 const url=wikipediaLink(taxon.wikipedia_url);
 if(!url||typeof taxon.wikipedia_summary!=='string')return null;
 const text=taxon.wikipedia_summary.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ')
  .replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"')
  .replace(/\s+([,.;:])/g,'$1').replace(/\s+/g,' ').trim();
 if(!text)return null;
 const short=text.length>480?text.slice(0,480).replace(/\s+\S*$/,'')+'…':text;
 return {text:short,url,licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/'};
}

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
 const photos=new Map(),cache=new Map(),commonCache=new Map(),commonsCache=new Map();
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
 async function json(host,path,params,signal,max=512*1024){
  const body=await readLimited(await upstream(host+path+'?'+new URLSearchParams(params),signal),max);
  return JSON.parse(body);
 }
 async function records(path,params,signal,max){
  const results=(await json(apiHost,path,params,signal,max)).results;
  return Array.isArray(results)?results:[];
 }
 async function commonsPhoto(name,signal){
  const wiki=await json('https://en.wikipedia.org','/w/api.php',{
   action:'query',prop:'pageimages',piprop:'name',titles:name,format:'json',formatversion:'2',
  },signal);
  const article=wiki.query?.pages?.[0];
  if(nameKey(article?.title||'')!==nameKey(name)||typeof article.pageimage!=='string'||!/\.(jpe?g|png)$/i.test(article.pageimage))return null;
  const commons='https://commons.wikimedia.org';
  const files=await json(commons,'/w/api.php',{
   action:'query',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'480',
   iimetadataversion:'latest',titles:'File:'+article.pageimage,format:'json',formatversion:'2',
  },signal);
  const file=files.query?.pages?.[0],item=file?.imageinfo?.[0],metadata=item?.extmetadata;
  if(!Number.isSafeInteger(file?.pageid)||file.imagerepository!=='local'||!item)return null;
  const thumb=new URL(item.thumburl),license=metadata?.LicenseShortName?.value;
  const licenseUrl=String(metadata?.LicenseUrl?.value||'').replace(/^http:/,'https:');
  const attribution=String(metadata?.Artist?.value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,240);
  if(!['thumb.wikimedia.org','upload.wikimedia.org'].includes(thumb.hostname)||thumb.username||thumb.password||thumb.port||
   thumb.protocol!=='https:'||!thumb.pathname.startsWith('/wikipedia/commons/')||!attribution||
   !/^(?:CC0|CC BY(?:-SA)? \d\.\d)$/.test(license||'')||
   !/^https:\/\/creativecommons\.org\/(?:licenses\/(?:by|by-sa)|publicdomain\/zero)\/\d\.\d\/(?:[a-z-]+\/)?$/.test(licenseUrl))return null;
  thumb.search='';
  return {id:'wm-'+file.pageid,path:thumb.href,scientificName:name,attribution,license,licenseUrl,
   source:commons+'/wiki/'+encodeURIComponent(file.title.replaceAll(' ','_'))};
 }
 async function find(name,rank,signal){
  if(!validName(name))return null;
  const expected=ranks.get(rank)||rank.toLowerCase();
  const key=nameKey(name)+'|'+expected;
  const cached=cache.get(key);
  if(cached&&cached.expires>Date.now()){
   for(const photo of cached.photos)remember(photos,photo.id,photo.path);
   return cached;
  }
  const deadline=AbortSignal.any([signal,AbortSignal.timeout(7000)]);
  const taxa=await records('/v1/taxa/autocomplete',{q:name,per_page:'10',is_active:'true'},deadline);
  const matches=taxa.filter(t=>t.is_active!==false&&t.iconic_taxon_name==='Plantae'&&nameKey(t.name||'')===nameKey(name));
  const matchedRank=matches.filter(t=>t.rank===expected);
  const taxon=matchedRank.length===1?matchedRank[0]:!ranks.has(rank)&&!['species','genus','family'].includes(expected)&&matches.length===1?matches[0]:null;
  if(!Number.isSafeInteger(taxon?.id))return null;
  const [observations,reading]=await Promise.all([
   records('/v1/observations',{
    taxon_id:String(taxon.id),quality_grade:'research',photos:'true',
    photo_license:[...licenses.keys()].join(','),per_page:'8',
   },deadline,1536*1024),
   wikipediaLink(taxon.wikipedia_url)
    ?records('/v1/taxa/'+taxon.id,{},deadline).then(rows=>readingFrom(rows[0],taxon)).catch(()=>null)
    :null,
  ]);
  const collected=new Map();
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
    if(!collected.has(id)&&collected.size<4)collected.set(id,photo);
   }
  }
  const gallery=[...collected.values()];
  for(const photo of gallery)remember(photos,photo.id,photo.path);
  const entry={photos:gallery,reading,expires:Date.now()+(gallery.length?30:5)*60*1000};
  remember(cache,key,entry);
  return entry;
 }
 // Bound concurrent upstream lookups and images on the small production host.
 async function limited(action){
  if(active>=8)throw Error('参考图来源繁忙');
  active++;
  try{return await action()}finally{active--}
 }
 const publicPhoto=({path,...photo})=>photo;
 return {
  commonNames(name,signal){return limited(async ()=>{
   const cached=commonCache.get(name);
   if(cached&&cached.expires>Date.now())return cached.matches;
   const rows=await records('/v1/taxa/autocomplete',{q:name,locale:'zh-CN',per_page:'10',is_active:'true'},AbortSignal.any([signal,AbortSignal.timeout(2500)]));
   const matches=rows.filter(row=>row.is_active!==false&&row.iconic_taxon_name==='Plantae'&&
    ['species','genus','family'].includes(row.rank)&&typeof row.name==='string'&&
    [row.preferred_common_name,row.matched_term].includes(name)).slice(0,3).map(row=>({name:row.name,rank:row.rank}));
   remember(commonCache,name,{matches,expires:Date.now()+30*60*1000});
   return matches;
  })},
  lookup(name,rank,signal){return limited(async ()=>{
   const result=await find(name,rank,signal);
   if(!result)return {photo:null};
   const photo=result.photos[0];
   return {photo:photo?publicPhoto(photo):null,...(result.reading?{reading:result.reading}:{})};
  })},
  gallery(name,rank,signal){return limited(async()=>{
   if(!validName(name))return {photos:[]};
   let primaryFailed=false,fallbackFailed=false;
   const result=await find(name,rank,signal).catch(()=>{primaryFailed=true;return null});
   let gallery=result?.photos||[];
   if(!gallery.length){
    const key=nameKey(name),cached=commonsCache.get(key);
    const fallback=cached?.expires>Date.now()?cached.photo:await commonsPhoto(name,signal).then(photo=>{
     remember(commonsCache,key,{photo,expires:Date.now()+(photo?30:5)*60000});
     return photo;
    }).catch(()=>{fallbackFailed=true;return null});
    if(fallback){remember(photos,fallback.id,fallback.path);gallery=[fallback]}
   }
   if(primaryFailed&&fallbackFailed)throw Error('参考图库未能核对');
   return {photos:gallery.map(photo=>({...publicPhoto(photo),src:'/plant-id/api/reference-image/'+photo.id})),reading:result?.reading};
  })},
  image(id,signal){return limited(async ()=>{
   const path=photos.get(id);
   if(!path)return null;
   const response=await upstream(path.startsWith('/')?imageHost+path:path,AbortSignal.any([signal,AbortSignal.timeout(8000)]));
   const type=response.headers.get('Content-Type')?.split(';')[0];
   if(!['image/jpeg','image/png'].includes(type)){
    await response.body?.cancel();
    return null;
   }
   return {bytes:await readLimited(response,1024*1024),type};
  })},
 };
}
