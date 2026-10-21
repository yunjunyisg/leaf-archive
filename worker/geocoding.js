import {searchAustralianGazetteer,foldPlace} from './gazetteer.js';
import {validOriginLocation,distanceKm} from '../shared/geography.js';
const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
const text=(x,max=200)=>typeof x==='string'?x.slice(0,max):'';
function normalize(feature){
 const p=feature?.properties||{},c=feature?.geometry?.coordinates;
 if(feature?.geometry?.type!=='Point'||!Array.isArray(c))return null;
 const kind=p.type||p.osm_value;
 const types={country:'country',state:'region',province:'region',county:'county',city:'city',town:'city',village:'locality',district:'county',suburb:'locality'};
 const location={lat:c[1],lon:c[0],countryCode:text(p.countrycode),country:text(p.country),state:text(p.state),county:text(p.county),city:text(p.city),district:text(p.district),label:'',source:'photon',precision:types[kind]||'point'};
 if(!['country','state','province','county','city','town'].includes(kind))location.locality=text(p.name);
 location.featureType=text(p.osm_value||kind);
 if(/^[NWR]$/.test(p.osm_type)&&/^\d+$/.test(String(p.osm_id))){location.sourceId=p.osm_type+':'+p.osm_id;location.sourceUrl='https://www.openstreetmap.org/'+({N:'node',W:'way',R:'relation'}[p.osm_type])+'/'+p.osm_id;}
 if(kind==='country'){location.country=location.country||text(p.name)}
 if(['state','province'].includes(kind))location.state=location.state||text(p.name);
 if(kind==='county')location.county=location.county||text(p.name);
 if(['city','town'].includes(kind))location.city=location.city||text(p.name);
 location.label=[...new Set([text(p.name),location.district,location.city,location.county,location.state,location.country].filter(Boolean))].join(' / ').slice(0,600);
 try{const result=validOriginLocation(location);result._name=text(p.name);if(Array.isArray(p.extent)&&p.extent.length===4&&p.extent.every(Number.isFinite))result.bounds=p.extent;return result}catch{return null}
}
export async function geocodingRoute(request,env){
 const u=new URL(request.url);if(request.method!=='GET')return json({error:'仅支持地点查询'},405);
 const mode=u.searchParams.get('mode')==='reverse'?'reverse':'search';
 const base=env.MAP_GEOCODER_URL||'https://photon.komoot.io/';let endpoint;
 try{endpoint=new URL(mode==='reverse'?'reverse':'api/',base.endsWith('/')?base:base+'/');if(endpoint.protocol!=='https:')throw Error()}catch{return json({error:'地点服务暂不可用，可手动填写经纬度'},503)}
 endpoint.searchParams.set('limit',mode==='reverse'?'1':'8');endpoint.searchParams.set('lang','en');
 if(mode==='search'){
  const q=(u.searchParams.get('q')||'').trim();if(q.length<2||q.length>160)return json({error:'请输入 2–160 字的地名'},400);endpoint.searchParams.set('q',q);
  const code=u.searchParams.get('country')||'';if(code&&!/^[A-Za-z]{2}$/.test(code))return json({error:'国家代码无效'},400);if(code)endpoint.searchParams.set('countrycode',code.toLowerCase());
 }else{
  const rawLat=u.searchParams.get('lat'),rawLon=u.searchParams.get('lon'),lat=Number(rawLat),lon=Number(rawLon);
  if(!rawLat?.trim()||!rawLon?.trim()||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return json({error:'产地经纬度无效'},400);
  endpoint.searchParams.set('lat',lat.toFixed(5));endpoint.searchParams.set('lon',lon.toFixed(5));endpoint.searchParams.set('radius','50');
 }
 if(!env.DB)return json({error:'地点服务暂不可用，可手动标点'},503);
 const now=Date.now(),key='origin-geocode:v2:'+endpoint.href;
 const cached=await env.DB.prepare('SELECT value FROM map_cache WHERE key = ? AND expires > ?').bind(key,now).first();
 if(cached){try{return json(JSON.parse(cached.value))}catch{/* Rebuild a damaged cache entry. */}}
 const gate=await env.DB.prepare('INSERT INTO map_cache (key,value,expires) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET expires=excluded.expires WHERE map_cache.expires <= ? RETURNING key').bind('photon:gate','{}',now+1100,now).first();
 if(!gate)return json({error:'地点查询较频繁，请稍后重试'},429,{'Retry-After':'2'});
 const query=endpoint.searchParams.get('q')||'',country=(endpoint.searchParams.get('countrycode')||'').toUpperCase();
 if(mode==='search'){
  const pair=query.match(/^([+-]?\d+(?:\.\d+)?)\s*[,;]\s*([+-]?\d+(?:\.\d+)?)$/);
  if(pair){const lat=Number(pair[1]),lon=Number(pair[2]);if(Math.abs(lat)>90||Math.abs(lon)>180)return json({error:'产地经纬度无效'},400);return json({results:[{lat,lon,countryCode:country,country:'',state:'',county:'',city:'',district:'',locality:'',label:'坐标点 '+lat+', '+lon,precision:'point',source:'manual'}],provider:'手动坐标'});}
 }
 let local=[];if(mode==='search'&&(!country||country==='AU')){try{local=await searchAustralianGazetteer(query)}catch{/* Online search remains available if the snapshot cannot be read. */}}
 let remote=[],remoteFailed=false;
 // A country-restricted gazetteer match needs no online geocoding request.
 if(!(country==='AU'&&local.length)){
  try{
   const response=await fetch(endpoint,{headers:{'User-Agent':'LeafArchive-OriginMap/1.1','Accept':'application/json'},signal:AbortSignal.timeout(local.length?4500:12000)});
   if(!response.ok)remoteFailed=true;
   else{const data=await response.json();remote=(Array.isArray(data.features)?data.features:[]).map(normalize).filter(Boolean).filter(l=>!country||l.countryCode===country);}
  }catch{remoteFailed=true;}
 }
 if(mode==='reverse')remote=remote.filter(l=>distanceKm(l,{lat:Number(endpoint.searchParams.get('lat')),lon:Number(endpoint.searchParams.get('lon'))})<=50);
 const rank=l=>{const name=foldPlace(l._name||l.locality||l.city||l.county||l.state||l.country);return name===foldPlace(query)?1100:name.includes(foldPlace(query))?700:300};
 const ranked=[...local,...remote.map(l=>({...l,_score:rank(l)}))].sort((a,b)=>b._score-a._score),results=[];
 for(const candidate of ranked){if(results.some(l=>foldPlace(l.locality||l.label)===foldPlace(candidate.locality||candidate.label)&&distanceKm(l,candidate)<.1))continue;const {_score,_name,...l}=candidate;results.push(l);if(results.length===12)break;}
 if(remoteFailed&&!results.length)return json({error:'在线地点服务暂不可用，可搜索澳大利亚小地名或手动标点'},503);
 const body={results,provider:local.length?'GeoNames / Photon / OpenStreetMap':'Photon / OpenStreetMap',...(remoteFailed?{warning:'在线搜索暂不可用，当前显示本地地名库匹配。'}:{})};
 await env.DB.prepare('DELETE FROM map_cache WHERE expires < ?').bind(now-86400000).run();
 await env.DB.prepare('INSERT INTO map_cache (key,value,expires) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, expires=excluded.expires').bind(key,JSON.stringify(body),now+(remoteFailed?300000:7*86400000)).run();
 return json(body);
}
