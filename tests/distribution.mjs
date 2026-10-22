import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {feature} from 'topojson-client';
import {taxonName,taxonColor,taxonGroups,regionIndex,regionFor,regionGroups,automaticDistributionLevel} from '../shared/distribution.js';
import worker from '../dist/server/index.js';
const data=name=>JSON.parse(gunzipSync(fs.readFileSync('data/boundaries/'+name+'.json.gz')));
const admin1=regionIndex(data('admin1').features),au=regionIndex(data('AU-admin2').features);
const usData=data('US-counties'),us=regionIndex(feature(usData,usData.objects.counties).features.map(f=>({...f,properties:{...f.properties,code:'US',aliases:[f.properties.name,f.properties.name+' County']}})));
test('taxonomy grouping retains genus, uncertain identifications and stable colors',()=>{
 const p={genus:'Sarracenia',species:'leucophylla'};assert.equal(taxonName(p),'Sarracenia leucophylla');assert.equal(taxonName({...p,species:'Sarracenia leucophylla'}),'Sarracenia leucophylla');assert.equal(taxonName(p,'genus'),'Sarracenia');
 assert.notEqual(taxonName({...p,identification:'cf',infraspecific:'alba'}),taxonName(p));assert.match(taxonName({...p,identification:'unresolved'}),/未定种/);
 const groups=taxonGroups([p,{...p},{...p,species:'flava'}]);assert.equal(groups.length,2);assert.equal(groups.find(g=>g.key==='Sarracenia leucophylla').plants.length,2);assert.equal(taxonColor('Sarracenia flava'),taxonGroups([{...p,species:'flava'}])[0].color);
});
test('real boundary snapshots resolve Florida and Kingston Rest without using country or state centers as counties',()=>{
 const florida={lat:30.45,lon:-84.28,countryCode:'US',state:'Florida',precision:'region'};
 assert.equal(regionFor(florida,admin1,'state').properties.name,'Florida');assert.equal(regionFor({...florida,state:'佛罗里达州'},admin1,'state').properties.name,'Florida');
 assert.equal(regionFor(florida,us,'county'),null);assert.equal(regionFor({...florida,precision:'country'},admin1,'state'),null);assert.equal(regionFor({...florida,precision:'city'},us,'county'),null);
 assert.equal(String(regionFor({...florida,precision:'point'},us,'county').id),'12073');
 const kingston={lat:-15.98111,lon:128.4178,countryCode:'AU',county:'Wyndham-East Kimberley',state:'Western Australia',precision:'locality'};
 assert.equal(regionFor(kingston,au,'county').properties.name,'Wyndham-East Kimberley');assert.equal(regionFor(kingston,admin1,'state').properties.name,'Western Australia');
 assert.equal(regionFor({...kingston,precision:'region'},au,'county'),null);assert.equal(regionFor({...kingston,county:'',precision:'point'},au,'county').properties.name,'Wyndham-East Kimberley');
 const result=regionGroups([{id:'1',originLocation:kingston},{id:'2',originLocation:{...kingston,precision:'country'}}],au,'county');assert.equal(result.groups.size,1);assert.equal(result.unmatched,1);
});
test('boundary routes serve only licensed public data as compressed lazy assets',async()=>{
 for(const path of ['/map-boundaries/admin1.json','/map-boundaries/US-counties.json','/map-boundaries/AU-admin2.json']){
  const r=await worker.fetch(new Request('https://example.test'+path),{});assert.equal(r.status,200);assert.equal(r.headers.get('Content-Encoding'),'gzip');const d=JSON.parse(gunzipSync(new Uint8Array(await r.arrayBuffer())));assert.ok(d.type==='Topology'||d.type==='FeatureCollection');assert.ok(!JSON.stringify(d).includes('qa-owner'));
 }
});

test('zooming narrows the same Kingston Rest record from Australia to Western Australia to its LGA and back',()=>{
 const p={id:'kingston',originLocation:{lat:-15.98111,lon:128.4178,countryCode:'AU',state:'Western Australia',county:'Wyndham-East Kimberley',precision:'locality'}};
 const countries=regionIndex([{type:'Feature',id:'AU',properties:{code:'AU',name:'Australia'},geometry:{type:'Polygon',coordinates:[[[110,-45],[155,-45],[155,-10],[110,-10],[110,-45]]]}}]);
 const layers={country:countries,state:admin1,county:au};
 const trace=[2,3.75,4,6.75,7,12,6,3].map(zoom=>{const level=automaticDistributionLevel(zoom,'AU'),result=regionGroups([p],layers[level],level);assert.equal(result.groups.size,1);assert.equal(result.unmatched,0);return [...result.groups.values()][0].feature.properties.name});
 assert.deepEqual(trace,['Australia','Australia','Western Australia','Western Australia','Wyndham-East Kimberley','Wyndham-East Kimberley','Western Australia','Australia']);
 assert.equal(automaticDistributionLevel(12,'CN'),'state');assert.equal(automaticDistributionLevel(7,'US'),'county');assert.equal(automaticDistributionLevel(2,'US'),'country');
});
