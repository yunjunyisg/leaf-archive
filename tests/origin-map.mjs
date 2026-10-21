import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {validOriginLocation,filterByArea,groupByLocation,distanceKm} from '../shared/geography.js';
import worker from '../dist/server/index.js';

function setup(){
 const sql=new DatabaseSync(':memory:');for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));
 const DB={prepare(query){return {bind(...args){return {async all(){return {results:sql.prepare(query).all(...args)}},async first(){return sql.prepare(query).get(...args)||null},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}}}}}}}};
 const call=(method,path,body,revision,user='owner')=>worker.fetch(new Request('https://example.test'+path,{method,headers:{Origin:'https://example.test',...(user?{'oai-authenticated-user-id':user}:{}),...(body?{'Content-Type':'application/json'}:{}),...(revision?{'If-Match':'"'+revision+'"'}:{})},body:body?JSON.stringify(body):undefined}),{DB,TRUST_SITES_IDENTITY:'true'});
 return {sql,call};
}
const location={lat:0,lon:0,countryCode:'GH',country:'加纳',state:'测试省',county:'测试县',city:'测试市',district:'',label:'示例地',precision:'county',source:'manual'};
test('origin coordinates persist with ownership and revision checks; legacy text and explicit removal survive',async()=>{
 const {sql,call}=setup();try{
  const created=await call('POST','/api/plants',{name:'测试植物',number:'MAP-1',origin:'原始产地文字',originLocation:location});assert.equal(created.status,201);const p=await created.json();assert.deepEqual(p.originLocation,location);
  const read=await (await call('GET','/api/plants')).json();assert.equal(read[0].origin,'原始产地文字');assert.equal(read[0].originLocation.lat,0);
  assert.deepEqual(await (await call('GET','/api/plants',null,null,'other')).json(),[]);
  assert.equal((await call('PUT','/api/plants/'+p.id,p,p._revision,'other')).status,404);
  const oldClient={...p,notes:'普通编辑'};delete oldClient.originLocation;
  const changed=await (await call('PUT','/api/plants/'+p.id,oldClient,p._revision)).json();assert.deepEqual(changed.originLocation,location);
  assert.equal((await call('PUT','/api/plants/'+p.id,{...p,originLocation:null},p._revision)).status,409);
  const removed=await (await call('PUT','/api/plants/'+p.id,{...changed,originLocation:null},changed._revision)).json();assert.equal(removed.originLocation,null);assert.equal(removed.origin,'原始产地文字');
  for(const bad of [{...location,lat:91},{...location,lon:'0'},{...location,precision:'invented'},{...location,countryCode:'XYZ'},[]])assert.equal((await call('POST','/api/plants',{name:'错误位置',number:'BAD',originLocation:bad})).status,400);
 }finally{sql.close()}
});
test('geographic grouping distinguishes countries and keeps valid zero coordinates',()=>{
 const a={id:'a',originLocation:location},b={id:'b',originLocation:{...location,countryCode:'US'}},c={id:'c',origin:'没有坐标'};
 assert.equal(validOriginLocation(location).lat,0);assert.equal(filterByArea([a,b,c],{countryCode:'GH',county:'测试县'}).length,1);
 assert.equal(groupByLocation([a,b,c])[0].plants.length,2);assert.ok(distanceKm({lat:0,lon:179.9},{lat:0,lon:-179.9})<23);
 assert.throws(()=>validOriginLocation({...location,lat:null}));
});
test('geocoding requires authentication, caches identical requests and applies a shared throttle',async()=>{
 const {sql,call}=setup(),originalFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=async url=>{calls++;assert.equal(new URL(url).hostname,'photon.komoot.io');return Response.json({features:[{type:'Feature',geometry:{type:'Point',coordinates:[0,0]},properties:{name:'Place',country:'Ghana',countrycode:'gh',state:'Region',county:'County',type:'county'}}]})};
 try{
  assert.equal((await call('GET','/api/map/geocode?q=Place',null,null,null)).status,401);assert.equal(calls,0);
  assert.equal((await call('GET','/api/map/geocode?mode=reverse&lat=&lon=0')).status,400);
  const first=await call('GET','/api/map/geocode?q=Place');assert.equal(first.status,200);const body=await first.json();assert.equal(body.results[0].countryCode,'GH');assert.equal(body.results[0].precision,'county');
  assert.equal((await call('GET','/api/map/geocode?q=Place')).status,200);assert.equal(calls,1);
  sql.prepare('UPDATE map_cache SET expires=? WHERE key=?').run(Date.now()+10000,'photon:gate');
  assert.equal((await call('GET','/api/map/geocode?q=Another')).status,429);assert.equal(calls,1);
  sql.prepare('UPDATE map_cache SET expires=0 WHERE key=?').run('photon:gate');globalThis.fetch=async()=>{throw Error('offline')};
  assert.equal((await call('GET','/api/map/geocode?q=Another')).status,503);
 }finally{globalThis.fetch=originalFetch;sql.close()}
});
test('origin page and locally bundled map assets are available without exposing personal records',async()=>{
 const {sql,call}=setup();try{
  for(const path of ['/origins','/origin-map.js','/origin-map.css','/leaflet.css','/geography.js'])assert.equal((await call('GET',path,null,null,null)).status,200);
  const html=await (await call('GET','/origins',null,null,null)).text();assert.ok(html.includes('id="originMapPanel"'));assert.ok(html.includes('id="originPicker"'));assert.ok(!html.includes('welcomeSplash'));
 }finally{sql.close()}
});

test('Kingston Rest resolves from the Australian snapshot and keeps locality, category and provenance',async()=>{
 const {sql,call}=setup(),originalFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Online provider should not be needed for an Australian gazetteer match')};
 try{
  const response=await call('GET','/api/map/geocode?q=Kingston%20rest&country=AU');assert.equal(response.status,200);const body=await response.json();
  const l=body.results.find(x=>x.sourceId==='8351675');assert.ok(l);assert.equal(l.locality,'Kingston Rest');assert.equal(l.precision,'locality');assert.equal(l.lat,-15.98111);assert.equal(l.lon,128.4178);assert.equal(l.county,'Wyndham-East Kimberley');assert.equal(l.source,'geonames');assert.equal(l.sourceUrl,'https://www.geonames.org/8351675/');assert.match(l.featureType,/Homestead/);
  const created=await (await call('POST','/api/plants',{name:'小地名测试',number:'LOCALITY-1',origin:'Kingston Rest, Kimberley',originLocation:l})).json();assert.equal(created.originLocation.locality,'Kingston Rest');assert.equal(created.originLocation.sourceId,'8351675');assert.equal(created.originLocation.sourceUrl,l.sourceUrl);
  assert.ok((await (await call('GET','/api/plants')).json())[0].originLocation.label.includes('Kingston Rest'));
  assert.equal((await call('GET','/api/map/geocode?q=Kingston%20rest&country=AU')).status,200);
 }finally{globalThis.fetch=originalFetch;sql.close()}
});

test('Australian small place search handles administrative context and falls back when online search is unavailable',async()=>{
 const {sql,call}=setup(),originalFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('offline')};
 try{
  const r=await call('GET','/api/map/geocode?q='+encodeURIComponent('Kingston Rest, Kimberley, Australia'));
  assert.equal(r.status,200);const body=await r.json();assert.equal(body.results[0].locality,'Kingston Rest');assert.ok(body.warning);
  sql.prepare('UPDATE map_cache SET expires=0 WHERE key=?').run('photon:gate');
  assert.equal((await call('GET','/api/map/geocode?q=Kingston%20Rest&country=NZ')).status,503);
 }finally{globalThis.fetch=originalFetch;sql.close()}
});

test('coordinate searches remain exact and provenance links reject executable URLs',async()=>{
 const {sql,call}=setup(),originalFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Coordinates do not need an online lookup')};
 try{
  const response=await call('GET','/api/map/geocode?q='+encodeURIComponent('-15.98111, 128.4178'));assert.equal(response.status,200);const l=(await response.json()).results[0];assert.equal(l.lat,-15.98111);assert.equal(l.lon,128.4178);assert.equal(l.precision,'point');
  assert.throws(()=>validOriginLocation({...location,locality:'Kingston Rest',sourceUrl:'javascript:alert(1)'}));
 }finally{globalThis.fetch=originalFetch;sql.close()}
});
