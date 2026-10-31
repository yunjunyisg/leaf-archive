import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import fsp from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';import {gunzipSync} from 'node:zlib';
import {automaticDistributionLevel,regionFor,regionIndex,regionGroups} from '../shared/distribution.js';
import {globalBoundaryRoutes} from '../standalone/global-boundaries.mjs';import {createApp,httpServer} from '../standalone/server.mjs';
const coverage=JSON.parse(fs.readFileSync('shared/boundary-coverage.json')),catalog=JSON.parse(fs.readFileSync('data/boundaries/global/catalog.json'));
const read=(code,level)=>JSON.parse(gunzipSync(fs.readFileSync(`data/boundaries/global/${code}-ADM${level}.json.gz`)));
test('global boundary coverage is backed by complete checksummed public snapshots and attribution',()=>{
 assert.ok(Object.values(coverage).filter(c=>c.ADM2).length>=179);assert.ok(Object.values(coverage).filter(c=>c.ADM3).length>=81);assert.deepEqual(catalog.failed,[]);
 for(const [code,levels] of Object.entries(catalog.countries))for(const [level,meta] of Object.entries(levels)){
  const bytes=fs.readFileSync(`data/boundaries/global/${code}-${level}.json.gz`);assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.sha256);assert.equal(bytes.length,meta.bytes);assert.equal(coverage[code][level].features,meta.features);assert.ok(meta.boundaryLicense);assert.ok(meta.boundarySource);assert.ok(meta.url.startsWith('https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/'));
 }
});
test('countries outside AU and US zoom into real second and third administrative divisions without changing coordinates or colors',()=>{
 for(const [code,lat,lon,name] of [['CN',25.04,102.71,'Kunmingshi'],['JP',35.01,135.77,'Kyoto'],['MY',1.55,110.35,'Kuching'],['BR',-3.10,-60.02,'Manaus'],['ZA',-33.92,18.42,'City of Cape Town'],['IN',26.14,91.74,'Kamrup Metropolitan']]){
  const index=regionIndex(read(code,2).features),location={countryCode:code,lat,lon,precision:'point'},snapshot=JSON.stringify(location);
  assert.equal(regionFor(location,index,'county').properties.name,name);
  for(const precision of ['country','region','city'])assert.equal(regionFor({...location,precision},index,'county'),null);
  assert.equal(automaticDistributionLevel(2,code,coverage),'country');assert.equal(automaticDistributionLevel(5,code,coverage),'state');assert.equal(automaticDistributionLevel(8,code,coverage),'county');assert.equal(automaticDistributionLevel(12,code,coverage),coverage[code].ADM3?'district':'county');assert.equal(automaticDistributionLevel(3,code,coverage),'country');
  assert.equal(JSON.stringify(location),snapshot);
 }
 const index=regionIndex(read('CN',3).features),location={countryCode:'CN',lat:25.04,lon:102.71,precision:'point'};
 assert.equal(regionFor(location,index,'district').properties.name,'Wuhua District');assert.equal(regionFor({...location,precision:'county'},index,'district'),null);assert.equal(regionFor({...location,precision:'county',county:'Wuhua District'},index,'district').properties.name,'Wuhua District');
 const result=regionGroups([{id:'one',originLocation:location},{id:'two',originLocation:{...location,precision:'region'}}],index,'district');assert.equal(result.groups.size,1);assert.equal(result.unmatched,1);
 assert.equal(automaticDistributionLevel(12,'XX',coverage),'state');
});
test('global snapshot routes have bounded paths, private-data-free metadata, validators and correct gzip over real HTTP',async()=>{
 const root='https://gloriouscarnivorousplants.top';
 for(const route of ['/map-boundaries/global/XX-ADM2.json','/map-boundaries/global/CN-ADM9.json','/map-boundaries/global/not-a-file'])assert.equal((await globalBoundaryRoutes(new Request(root+route))).status,404);
 assert.equal((await globalBoundaryRoutes(new Request(root+'/map-boundaries/global/CN-ADM2.json',{method:'POST'}))).status,405);
 const route=root+'/map-boundaries/global/JP-ADM2.json',response=await globalBoundaryRoutes(new Request(route));assert.equal(response.headers.get('Content-Encoding'),'gzip');assert.equal(JSON.parse(gunzipSync(new Uint8Array(await response.arrayBuffer()))).features.length,coverage.JP.ADM2.features);
 const head=await globalBoundaryRoutes(new Request(route,{method:'HEAD'}));assert.equal(await head.text(),'');assert.equal((await globalBoundaryRoutes(new Request(route,{headers:{'If-None-Match':head.headers.get('ETag')}}))).status,304);
 const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'leaf-global-http-')),app=createApp({dataDirectory:directory,origin:root}),server=httpServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const r=await fetch(base+'/map-boundaries/global/JP-ADM2.json');assert.equal(r.status,200);assert.equal(r.headers.get('Content-Encoding'),'gzip');assert.equal((await r.json()).features.length,coverage.JP.ADM2.features);
  const metadata=await (await fetch(base+'/map-boundaries/global/catalog.json')).json();assert.equal(metadata.countries.JP.ADM2.sha256,catalog.countries.JP.ADM2.sha256);assert.ok(!JSON.stringify(metadata).includes('password_hash'));
 }finally{await new Promise(r=>server.close(r));app.close();await fsp.rm(directory,{recursive:true,force:true})}
});
