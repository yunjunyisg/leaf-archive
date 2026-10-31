import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import worker from '../dist/server/index.js';
const request=(path,headers={})=>worker.fetch(new Request('https://example.test'+path,{headers}),{});
test('per-country boundaries preserve full geometry and reduce the Australia download',async()=>{
 const global=JSON.parse(gunzipSync(fs.readFileSync('data/boundaries/admin1.json.gz')));
 for(const code of ['AU','US','CN']){
  const response=await request('/map-boundaries/admin1/'+code+'.json');assert.equal(response.status,200);
  assert.equal(response.headers.get('Content-Encoding'),'gzip');
  const bytes=new Uint8Array(await response.arrayBuffer());const body=JSON.parse(gunzipSync(bytes));
  assert.deepEqual(body.features,global.features.filter(f=>f.properties.code===code));
  if(code==='AU')assert.ok(bytes.length<fs.statSync('data/boundaries/admin1.json.gz').size/10);
 }
 assert.equal((await request('/map-boundaries/admin1/ZZ.json')).status,404);
});
test('public assets revalidate without retransmitting bytes and never cache personal photos',async()=>{
 for(const path of ['/app.js','/style.css','/origin-map.js','/welcome/plant-74.webp']){
  const first=await request(path);assert.equal(first.status,200);const etag=first.headers.get('ETag');assert.ok(etag);
  const cached=await request(path,{'If-None-Match':etag});assert.equal(cached.status,304);assert.equal((await cached.arrayBuffer()).byteLength,0);
  assert.equal((await request(path,{'If-None-Match':'"old-version"'})).status,200);
 }
 assert.equal((await request('/images/123',{'If-None-Match':'*'})).status,401);
 const style=await (await request('/style.css')).text();assert.ok(!style.includes('fonts.googleapis.com'));
 const app=await (await request('/app.js')).text();assert.ok(Buffer.byteLength(app)<fs.statSync('public/app.js').size);
});
test('welcome runs once per session and does not block maps or classification navigation',()=>{
 const code=fs.readFileSync('public/app.js','utf8').split('(()=>{')[1].split('})();')[0];
 for(const page of ['origins','classification','home']){
  let queries=0;const splash={showModal(){}};
  const context={document:{body:{dataset:{page}},querySelector(){queries++;return splash}},sessionStorage:{getItem(){return '1'}}};
  vm.runInNewContext('(()=>{'+code+'})();',context);assert.equal(queries,1);
 }
});

test('automatic zoom still colors Australia, Western Australia and Kimberley; hover restores only one region',async()=>{
 const {regionIndex,regionGroups,regionFor,taxonName,taxonColor,taxonGroups,automaticDistributionLevel,pointInFeature}=await import('../shared/distribution.js');
 const {locatedPlants}=await import('../shared/geography.js');
 const nodes=new Map(),node=selector=>{if(!nodes.has(selector))nodes.set(selector,{dataset:{},value:'',innerHTML:'',textContent:'',setAttribute(){},before(){},prepend(){},remove(){},querySelectorAll(){return []}});return nodes.get(selector)};
 const root={querySelector:node},painted=[],handlers=new Map();let zoom=2,controller,bounds=[110,-45,155,-10],fetches=0;let releaseState,releaseCounty;const stateGate=new Promise(r=>releaseState=r),countyGate=new Promise(r=>releaseCounty=r);
 const map={getZoom:()=>zoom,getBounds:()=>({contains:()=>true,getWest:()=>bounds[0],getSouth:()=>bounds[1],getEast:()=>bounds[2],getNorth:()=>bounds[3]}),on(events,callback){for(const event of events.split(' ')){if(!handlers.has(event))handlers.set(event,[]);handlers.get(event).push(callback)}},off(){}};
 const L={DomEvent:{stopPropagation(){}},geoJSON(data,options){const group={layers:[],addData(data){for(const feature of data.features){const layer={feature,options:{},handlers:{},styles:0,on(event,handler){this.handlers[event]=handler;return this},getElement(){return null},bindTooltip(){return this},setStyle(style){this.style={...this.style,...style};this.styles++}};options.onEachFeature(feature,layer);this.layers.push(layer)}return this},addTo(){painted.push(this);return this},eachLayer(fn){this.layers.forEach(fn)},remove(){this.removed=true}};group.addData(data);return group}};
 const plant={id:'kingston',genus:'Drosera',species:'indica',originLocation:{lat:-15.98111,lon:128.4178,countryCode:'AU',state:'Western Australia',county:'Wyndham-East Kimberley',precision:'locality'}};
 const countries={type:'FeatureCollection',features:[{type:'Feature',id:'AU',properties:{code:'AU',name:'Australia'},geometry:{type:'Polygon',coordinates:[[[110,-45],[155,-45],[155,-10],[110,-10],[110,-45]]]}}]};
 const boundaryCoverage=JSON.parse(fs.readFileSync('shared/boundary-coverage.json'));
 const context={boundaryCoverage,pointInFeature,document:{createElement:()=>node('created-'+nodes.size)},root,map,L,feature(){},locatedPlants,regionIndex,regionGroups,regionFor,taxonName,taxonColor,taxonGroups,automaticDistributionLevel,URL,WeakMap,Map,JSON,setTimeout,clearTimeout,fetch:async path=>{fetches++;const name=path.startsWith('/map-boundaries/admin1/')?'admin1':'AU-admin2';await(name==='admin1'?stateGate:countyGate);const d=JSON.parse(gunzipSync(fs.readFileSync('data/boundaries/'+name+'.json.gz')));if(name==='admin1')d.features=d.features.filter(f=>f.properties.code==='AU');return {ok:true,json:async()=>d}}};
 const source=fs.readFileSync('public/distribution-map.js','utf8').replace(/^import .*;\n/gm,'').replace('export function createDistributionMap','function createDistributionMap');
 vm.createContext(context);vm.runInContext(source,context);
 controller=context.createDistributionMap({root,map,countryFeatures:countries,getPlants:()=>[plant],getViewCountry:()=>'AU',onChange:()=>controller?.refresh(),onRegion(){}});
 const settle=async()=>{controller.refresh();for(let i=0;i<500&&node('#worldMap').dataset.distributionState==='loading';i++)await new Promise(resolve=>setTimeout(resolve,5));assert.equal(node('#worldMap').dataset.distributionState,'ready');controller.refresh()};
 await settle();let active=painted.at(-1).layers.filter(l=>l.style.fillOpacity===.85);assert.equal(active[0].feature.properties.name,'Australia');const color=active[0].style.fillColor;
 for(const [nextZoom,name] of [[5,'Western Australia'],[10,'Wyndham-East Kimberley'],[2,'Australia']]){
  zoom=nextZoom;for(const fn of handlers.get('zoomend'))fn();const previous=painted.at(-1);controller.refresh();
  if(nextZoom===5){assert.equal(previous.removed,undefined);assert.equal(node('#worldMap').dataset.distributionState,'loading');releaseState()}
  if(nextZoom===10){assert.equal(previous.removed,undefined);zoom=2;await settle();releaseCounty();await new Promise(resolve=>setTimeout(resolve,10));assert.equal(node('#worldMap').dataset.distributionLevel,'country');zoom=10;bounds=[128,-17,129,-15];controller.refresh()}
  await settle();
  active=painted.at(-1).layers.filter(l=>l.style.fillOpacity===.85);assert.equal(active.length,1);assert.equal(active[0].feature.properties.name,name);assert.equal(active[0].style.fillColor,color);
  if(nextZoom===10)assert.ok(painted.at(-1).layers.length<100,'only viewport regions should be drawn, without dropping the full data index');
  const current=painted.at(-1),before=current.layers.map(l=>l.styles);active[0].handlers.mouseover();active[0].handlers.mouseout();
  assert.equal(current.layers.reduce((n,l,i)=>n+l.styles-before[i],0),2);
 }
 zoom=10;bounds=[128,-17,129,-15];await settle();const originalCount=fetches;
 bounds=[135,-35,137,-33];await settle();bounds=[128,-17,129,-15];await settle();assert.equal(fetches,originalCount,'viewport redraw should reuse parsed boundaries');assert.equal(painted.at(-1).layers.filter(l=>l.style.fillOpacity===.85)[0].feature.properties.name,'Wyndham-East Kimberley');
 controller.destroy();
});

test('terrain relief is served locally with validators and the map no longer depends on overseas raster tiles',async()=>{
 const meta=JSON.parse(fs.readFileSync('data/map-relief-metadata.json')),response=await request('/map-relief.webp');assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/webp');
 const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');assert.deepEqual(bytes,fs.readFileSync('public/map-relief.webp'));assert.equal((await request('/map-relief.webp',{'If-None-Match':response.headers.get('ETag')})).status,304);assert.equal(meta.projection,'EPSG:3857');assert.equal(meta.license,'Public Domain');
 const client=await (await request('/origin-map.js')).text();assert.ok(client.includes('/map-relief.webp'));assert.ok(!client.includes('tile.openstreetmap.org'));
});
