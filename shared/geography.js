export const precisionLabels={country:'国家 / 地区',region:'省 / 州',city:'城市',county:'区 / 县',locality:'小地名 / 地区',point:'具体地点'};
export function validOriginLocation(value){
 if(value==null)return null;
 if(typeof value!=='object'||Array.isArray(value))throw new Error('产地位置无效');
 const {lat,lon}=value;
 if(typeof lat!=='number'||typeof lon!=='number'||!Number.isFinite(lat)||!Number.isFinite(lon)||lat< -90||lat>90||lon< -180||lon>180)throw new Error('产地经纬度无效');
 const out={lat,lon};
 for(const key of ['countryCode','country','state','county','city','district','label','source']){
  if(value[key]!=null&&typeof value[key]!=='string')throw new Error('产地位置无效');
  out[key]=String(value[key]||'').trim();if(out[key].length>(key==='label'?600:200))throw new Error('产地位置内容过长');
 }
 for(const key of ['locality','featureType','sourceId','sourceUrl']){if(value[key]!==undefined){if(typeof value[key]!=='string'||value[key].length>(key==='sourceUrl'?600:200))throw new Error('产地位置内容过长');out[key]=value[key].trim()}}
 if(out.sourceUrl){try{if(new URL(out.sourceUrl).protocol!=='https:')throw Error()}catch{throw new Error('产地来源链接无效')}}
 out.countryCode=out.countryCode.toUpperCase();
 if(out.countryCode&&!/^[A-Z]{2}$/.test(out.countryCode))throw new Error('产地国家代码无效');
 out.precision=value.precision||'point';if(!precisionLabels[out.precision])throw new Error('产地位置精度无效');
 return out;
}
export function locationPath(location){return [...new Set(['country','state','county','city','district','locality'].map(k=>location?.[k]).filter(Boolean))];}
export function locationLabel(location){return location?.label||locationPath(location).join(' / ')||(location?`${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}`:'未定位');}
export function locatedPlants(plants){return plants.filter(p=>{try{return Boolean(validOriginLocation(p.originLocation))}catch{return false}});}
export function filterByArea(plants,area={}){return plants.filter(p=>{const l=p.originLocation;return l&&['countryCode','state','county','city','district'].every(k=>!area[k]||l[k]===area[k]);});}
export function groupByLocation(plants){const groups=new Map();for(const p of locatedPlants(plants)){const l=p.originLocation,key=l.lat.toFixed(5)+','+l.lon.toFixed(5);if(!groups.has(key))groups.set(key,{key,location:l,plants:[]});groups.get(key).plants.push(p)}return [...groups.values()];}
export function distanceKm(a,b){const rad=x=>x*Math.PI/180,dlat=rad(b.lat-a.lat),dlon=rad(b.lon-a.lon),v=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;return 6371*2*Math.atan2(Math.sqrt(v),Math.sqrt(Math.max(0,1-v)));}
