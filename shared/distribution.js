// Distribution is derived only from the current account's confirmed origin records.
export const foldRegion=s=>String(s||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function taxonName(p,rank='species'){
 if(p.taxonomyDetached)return rank==='genus'?'未分类':(p.name||'未命名植物')+' · 未分类';
 const genus=p.genus?.trim();if(rank==='genus')return genus||'未填写属';
 const kind=p.identification||'species';if(kind==='unresolved')return (genus||'植物')+' · 未定种';
 let name=p.species?.trim()||p.latin?.trim()||p.name?.trim()||'未命名植物';
 if(p.species&&genus&&!foldRegion(name).startsWith(foldRegion(genus)))name=genus+' '+name;
 if(kind==='hybrid')return name+' · 杂交种';
 return ['aff','cf'].includes(kind)?name+' '+kind+'. '+(p.infraspecific||'待核实'):name;
}
export function taxonColor(key){let hash=2166136261;for(const c of key)hash=Math.imul(hash^c.codePointAt(0),16777619);const hue=(hash>>>0)%360,saturation=.42+((hash>>>10)%12)/100,light=.44+((hash>>>16)%7)/100,a=saturation*Math.min(light,1-light);const channel=n=>{const k=(n+hue/30)%12;return Math.round(255*(light-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0')};return '#'+channel(0)+channel(8)+channel(4)}
export function taxonGroups(plants,rank){const groups=new Map();for(const p of plants){const key=taxonName(p,rank);if(!groups.has(key))groups.set(key,{key,color:taxonColor(key),plants:[]});groups.get(key).plants.push(p)}return [...groups.values()].sort((a,b)=>a.key.localeCompare(b.key,'zh-CN'))}
export function pointInFeature(location,f){
 const x=location.lon,y=location.lat;
 function ringContains(ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){let ax=ring[i][0],bx=ring[j][0];while(ax-x>180)ax-=360;while(ax-x< -180)ax+=360;while(bx-ax>180)bx-=360;while(bx-ax< -180)bx+=360;const ay=ring[i][1],by=ring[j][1];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside}return inside}
 const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
 return polygons.some(rings=>ringContains(rings[0])&&!rings.slice(1).some(ringContains));
}
export function regionIndex(features){return features.map(feature=>{const coordinates=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;let west=180,east=-180,south=90,north=-90;for(const polygon of coordinates)for(const ring of polygon)for(const [x,y] of ring){west=Math.min(west,x);east=Math.max(east,x);south=Math.min(south,y);north=Math.max(north,y)}return {feature,bounds:[west,south,east,north]}})}
export function regionFor(location,index,level){
 if(!location?.countryCode)return null;
 if(level==='country')return index.find(r=>r.feature.properties.code===location.countryCode)?.feature||null;
 if(location.precision==='country'||level==='county'&&location.precision==='region')return null;
 const pool=index.filter(r=>r.feature.properties.code===location.countryCode),name=level==='state'?location.state:location.county;
 const names=new Set([name,level==='county'?name?.replace(/\s+(County|Parish|Borough|Municipality)$/i,''):''].filter(Boolean).map(foldRegion));
 const named=pool.filter(r=>(r.feature.properties.aliases||[r.feature.properties.name]).some(a=>names.has(foldRegion(a))));
 if(named.length===1)return named[0].feature;
 // A city/region representative must never be used to invent a more precise county.
 const exact=level==='state'?['region','county','city','locality','point']:['county','locality','point'];
 if(!exact.includes(location.precision||'point'))return null;
 const candidates=named.length?named:pool;
 return candidates.find(r=>{const [w,s,e,n]=r.bounds;return location.lon>=w&&location.lon<=e&&location.lat>=s&&location.lat<=n&&pointInFeature(location,r.feature)})?.feature||null;
}
export function regionGroups(plants,index,level){const groups=new Map();let unmatched=0;for(const p of plants){const f=regionFor(p.originLocation,index,level);if(!f){unmatched++;continue}const id=String(f.id);if(!groups.has(id))groups.set(id,{feature:f,plants:[]});groups.get(id).plants.push(p)}return {groups,unmatched}}
// Leaflet zoom levels: continent/country overview, state overview, local detail.
export function automaticDistributionLevel(zoom,countryCode=''){
 if(zoom<4)return 'country';
 if(zoom>=7&&['US','AU'].includes(countryCode))return 'county';
 return 'state';
}
