import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';
import {createApp} from '../standalone/server.mjs';import {setAccount} from '../standalone/local-auth.mjs';
import {validPath,pathKey,plantPath,buildTree,systemRanks,canonicalPath} from '../shared/taxonomy.js';
const origin='https://gloriouscarnivorousplants.top';
const node=(rank,nameZh='',nameEn='')=>({rank,nameZh,nameEn}),path=validPath([node('family','茅膏菜科','Droseraceae'),node('species','圆叶茅膏菜','Drosera rotundifolia')],'apg4');
async function fixture(){const directory=await fs.mkdtemp(os.tmpdir()+'/leaf-dual-'),app=createApp({dataDirectory:directory,origin});const cookies={};for(const owner of ['dual-user','dual-other']){await setAccount(app.database.sql,{username:owner,password:'dual-test-password',owner});const r=await app.fetch(new Request(origin+'/auth/local',{method:'POST',headers:{Origin:origin},body:new URLSearchParams({username:owner,password:'dual-test-password'})}));cookies[owner]=r.headers.getSetCookie()[0].split(';')[0]}return {app,async call(method,url,body,revision,owner='dual-user'){return app.fetch(new Request(origin+url,{method,headers:{Origin:origin,Cookie:cookies[owner],...(body?{'Content-Type':'application/json'}:{}),...(revision?{'If-Match':'"'+revision+'"'}:{})},...(body?{body:JSON.stringify(body)}:{})}))},async close(){app.close();await fs.rm(directory,{recursive:true,force:true})}}}
test('both systems allow omitted intermediate ranks and bilingual names; invalid ranks and empty names fail',()=>{
 assert.equal(validPath([node('family','科'),node('form','','forma alba')],'itis').length,2);
 assert.equal(validPath([node('genus','','Drosera')],'apg4')[0].name,'Drosera');
 assert.throws(()=>validPath([node('genus')],'apg4'));assert.throws(()=>validPath([node('species','种'),node('family','科')],'itis'));
 assert.throws(()=>validPath([node('clade1','真双子叶植物')],'itis'));assert.ok(systemRanks('apg4').some(r=>r.key==='clade1'));assert.ok(systemRanks('itis').some(r=>r.key==='subclass'));assert.ok(systemRanks('itis').some(r=>r.key==='infrakingdom'));assert.throws(()=>validPath([node('infrakingdom','次界')],'apg4'));
 const p={name:'旧档案',genus:'旧属'};assert.ok(plantPath(p,'apg4').length);assert.deepEqual(plantPath(p,'itis'),[]);
 const t=buildTree([],[{path,system:'apg4'}],'apg4');assert.equal(canonicalPath(validPath([node('family','','Droseraceae'),node('species','','Drosera rotundifolia')]),t)[0].nameZh,'茅膏菜科');
});
test('one plant saves independent paths, translations and precision; changing/deleting one branch preserves the other and photos',async()=>{
 const f=await fixture();try{
  const location={lat:-15.981112345678,lon:128.417812345678,countryCode:'AU',country:'澳大利亚',precision:'point',source:'manual',label:'Kingston Rest'};
  const r=await f.call('POST','/api/plants',{name:'双体系植物',number:'DUAL-1',taxonomyPaths:{apg4:path,itis:validPath([node('genus','','Drosera'),node('species','圆叶茅膏菜','Drosera rotundifolia')],'itis')},photos:[],originLocation:location});assert.equal(r.status,201);const plant=await r.json();assert.equal(plantPath(plant,'apg4').length,2);assert.equal(plantPath(plant,'itis')[0].rank,'genus');assert.equal(plantPath(plant,'apg4')[0].nameZh,'茅膏菜科');
  const branch='/api/taxonomy/branch?system=apg4&path='+encodeURIComponent(pathKey(path.slice(0,1)));const snapshot=await (await f.call('GET',branch)).json();
  const renamed=validPath([node('family','茅膏菜科（校对）','Droseraceae')],'apg4');const change=await f.call('PUT','/api/taxonomy/branch',{system:'apg4',path:path.slice(0,1),newPath:renamed,references:[]},snapshot.revision);assert.equal(change.status,200);let current=(await change.json()).plants[0];assert.equal(plantPath(current,'apg4')[0].nameZh,'茅膏菜科（校对）');assert.deepEqual(plantPath(current,'itis'),plantPath(plant,'itis'));assert.deepEqual(current.originLocation,plant.originLocation);assert.notEqual(current._revision,plant._revision);
  const newer=await (await f.call('GET','/api/taxonomy/branch?system=apg4&path='+encodeURIComponent(pathKey(renamed)))).json();const removed=await f.call('DELETE','/api/taxonomy/branch',{system:'apg4',path:renamed,confirmation:'删除分类'},newer.revision);assert.equal(removed.status,200);current=(await removed.json()).plants[0];assert.deepEqual(plantPath(current,'apg4'),[]);assert.deepEqual(plantPath(current,'itis'),plantPath(plant,'itis'));assert.deepEqual(current.originLocation,plant.originLocation);
  assert.deepEqual(await (await f.call('GET','/api/plants',null,null,'dual-other')).json(),[]);
 }finally{await f.close()}
});
test('duplicate rank and either language are owner/system scoped; aliases reuse nodes and concurrent creates cannot bypass checks',async()=>{
 const f=await fixture();try{
  let r=await f.call('POST','/api/taxa',{system:'apg4',path,references:[]});assert.equal(r.status,201);
  r=await f.call('POST','/api/taxa',{system:'itis',path,references:[]});assert.equal(r.status,201);
  r=await f.call('POST','/api/taxa',{system:'apg4',path:[node('genus','另一属'),node('species','','Ｄｒｏｓｅｒａ rotundifolia')],references:[]});assert.equal(r.status,409);
  r=await f.call('POST','/api/taxa',{system:'apg4',path:[node('genus','另一属'),node('species','圆叶茅膏菜')],references:[]});assert.equal(r.status,409);
  assert.equal((await f.call('POST','/api/taxa',{system:'apg4',path,references:[]},null,'dual-other')).status,201);
  r=await f.call('POST','/api/plants',{name:'复用节点',number:'REUSE',taxonomyPaths:{apg4:[node('family','','Droseraceae'),node('species','','Drosera rotundifolia')],itis:[]}});assert.equal(r.status,201);assert.equal((await r.json()).taxonomyPaths.apg4[1].nameZh,'圆叶茅膏菜');
  const create=(family,english)=>f.call('POST','/api/taxa',{system:'itis',path:[node('family',family),node('genus','并发同名属',english)],references:[]});const results=await Promise.all([create('甲科','RaceOne'),create('乙科','RaceTwo')]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  assert.equal((await f.call('POST','/api/plants',{name:'空名',number:'BAD',taxonomyPaths:{apg4:[node('family')],itis:[]}})).status,400);
  assert.equal((await f.call('POST','/api/plants',{name:'无效体系',number:'BAD-SYSTEM',taxonomyPaths:{apg4:[],itis:[],unknown:[]}})).status,400);
 }finally{await f.close()}
});
test('own collection images can be reused as references without new objects; foreign images are refused',async()=>{
 const f=await fixture();try{
  const image='/images/'+crypto.randomUUID(),foreign='/images/'+crypto.randomUUID();for(const [url,owner]of [[image,'dual-user'],[foreign,'dual-other']]){await f.app.BUCKET.put(owner+'/'+url.split('/').pop(),new Uint8Array([255,216,255,217]));f.app.database.sql.prepare('INSERT INTO images VALUES (?,?,?)').run(url.split('/').pop(),owner,'image/jpeg')}
  const created=await f.call('POST','/api/plants',{name:'收藏原图复用',number:'REUSE-PHOTO',photos:[image],taxonomyPaths:{apg4:path,itis:[]}});assert.equal(created.status,201);
  const snap=await (await f.call('GET','/api/taxonomy/branch?system=apg4&path='+encodeURIComponent(pathKey(path)))).json();const r=await f.call('PUT','/api/taxonomy/branch',{system:'apg4',path,newPath:path,references:[image]},snap.revision);assert.equal(r.status,200);const data=await r.json();assert.equal(data.taxa[0].references[0],image);assert.equal(data.plants[0].photos[0],image);assert.equal(f.app.database.sql.prepare('SELECT count(*) AS n FROM images').get().n,2);
  const snap2=await (await f.call('GET','/api/taxonomy/branch?system=apg4&path='+encodeURIComponent(pathKey(path)))).json();assert.equal((await f.call('PUT','/api/taxonomy/branch',{system:'apg4',path,newPath:path,references:[foreign]},snap2.revision)).status,400);assert.deepEqual((await (await f.call('GET','/api/taxa')).json())[0].references,[image]);
  const subpath=validPath([...path,node('subspecies','','subsp. example')],'apg4');assert.equal((await f.call('POST','/api/taxa',{system:'apg4',path:subpath,references:[]})).status,201);const sub=await (await f.call('GET','/api/taxonomy/branch?system=apg4&path='+encodeURIComponent(pathKey(subpath)))).json();assert.equal((await f.call('PUT','/api/taxonomy/branch',{system:'apg4',path:subpath,newPath:subpath,references:[image]},sub.revision)).status,200);
 }finally{await f.close()}
});

test('branch rename cannot merge into an implicit existing target via bilingual alias or case normalization',async()=>{
 const f=await fixture();try{
  const left=validPath([node('genus','甲属','Alpha')]),right=validPath([node('genus','乙属','Beta')]);
  for(const [number,p]of [['LEFT',left],['RIGHT',right]])assert.equal((await f.call('POST','/api/plants',{name:number,number,taxonomyPaths:{apg4:p,itis:[]}})).status,201);
  const snap=await (await f.call('GET','/api/taxonomy/branch?system=apg4&path='+encodeURIComponent(pathKey(left)))).json();
  const r=await f.call('PUT','/api/taxonomy/branch',{system:'apg4',path:left,newPath:[node('genus','','beta')],references:[]},snap.revision);assert.equal(r.status,409);
  const plants=await (await f.call('GET','/api/plants')).json();assert.equal(plants.find(p=>p.number==='LEFT').taxonomyPaths.apg4[0].name,'Alpha');assert.equal(plants.find(p=>p.number==='RIGHT').taxonomyPaths.apg4[0].name,'Beta');
 }finally{await f.close()}
});
