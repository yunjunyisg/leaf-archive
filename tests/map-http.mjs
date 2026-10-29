import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('real Worker HTTP transport delivers boundary JSON after one browser-compatible decompression',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:new URL('../dist/server/index.js',import.meta.url).pathname,compatibilityDate:'2026-09-01',host:'127.0.0.1',port:0,cf:false}));
 try{
  const base=await mf.ready;
  for(const [path,type,count] of [['admin1','FeatureCollection',4584],['AU-admin2','FeatureCollection',547],['US-counties','Topology',null],['admin1/AU','FeatureCollection',12],['admin1/US','FeatureCollection',51]]){
   const response=await fetch(new URL('/map-boundaries/'+path+'.json?v=encoding-2',base),{headers:{'Accept-Encoding':'gzip'}});
   assert.equal(response.status,200);const body=await response.json();assert.equal(body.type,type);if(count)assert.equal(body.features.length,count);else assert.ok(body.objects.counties.geometries.length>3000);
  }
 }finally{await mf.dispose()}
});
