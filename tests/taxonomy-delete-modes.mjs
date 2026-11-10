import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';
import {createApp} from '../standalone/server.mjs';import {setAccount} from '../standalone/local-auth.mjs';import {validPath,pathKey,storagePathKey,plantPath,buildTree} from '../shared/taxonomy.js';
const origin='https://gloriouscarnivorousplants.top';
const path=validPath([{rank:'kingdom',nameZh:'植物界',nameEn:'Plantae'},{rank:'family',nameZh:'测试科',nameEn:'Exampleaceae'},{rank:'genus',nameZh:'测试属',nameEn:'Examplea'},{rank:'species',nameZh:'测试种',nameEn:'Examplea sample'}]);
async function fixture(system='apg4'){
 const directory=await fs.mkdtemp(os.tmpdir()+'/leaf-delete-modes-'),app=createApp({dataDirectory:directory,origin}),cookies={};
 for(const owner of ['delete-user','delete-other']){await setAccount(app.database.sql,{username:owner,password:'delete-mode-test-pass',owner});const r=await app.fetch(new Request(origin+'/auth/local',{method:'POST',headers:{Origin:origin},body:new URLSearchParams({username:owner,password:'delete-mode-test-pass'})}));cookies[owner]=r.headers.getSetCookie()[0].split(';')[0]}
 const otherSystem=system==='apg4'?'itis':'apg4',picture='/images/'+crypto.randomUUID();app.database.sql.prepare('INSERT INTO images VALUES (?,?,?)').run(picture.split('/').pop(),'delete-user','image/jpeg');await app.BUCKET.put('delete-user/'+picture.split('/').pop(),new Uint8Array([255,216,255,217]));
 const sql=app.database.sql;
 const f={app,system,otherSystem,picture,cookies,async call(method,url,body,revision,owner='delete-user',headers={}){return app.fetch(new Request(origin+url,{method,headers:{Cookie:cookies[owner]||'',Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(revision?{'If-Match':'"'+revision+'"'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})}))},async inspect(p=path.slice(0,2),owner='delete-user'){const r=await this.call('GET','/api/taxonomy/branch?system='+system+'&path='+encodeURIComponent(pathKey(p)),null,null,owner);assert.equal(r.status,200);return r.json()},async remove(p,mode,revision,extra={},owner='delete-user'){return this.call('DELETE','/api/taxonomy/branch',{system,path:p,deleteMode:mode,confirmation:'删除分类',...extra},revision,owner)},dump(owner='delete-user'){return {plants:sql.prepare('SELECT * FROM plants WHERE owner=? ORDER BY id').all(owner),taxa:sql.prepare('SELECT * FROM taxa WHERE owner=? ORDER BY id').all(owner)}},seedTaxon(id,p,owner='delete-user',references=[]){sql.prepare('INSERT INTO taxa VALUES (?,?,?,?,?)').run(id,owner,storagePathKey(p,system),JSON.stringify({path:p,system,references,_revision:'taxon-'+id}),'2026-01-01')},seedPlant(id,p,owner='delete-user'){
  const value={name:id,number:id,taxonomyPaths:{[system]:p,[otherSystem]:validPath([{rank:'genus',nameZh:'另一体系属',nameEn:'Othergenus'}])},photos:owner==='delete-user'?[picture]:[],photoDates:owner==='delete-user'?{[picture]:'2026-01-01'}:{},logs:[],notes:'保留备注',price:'12.50',originLocation:{lat:12.123456789012,lon:123.987654321098,countryCode:'CN',precision:'point',source:'manual'},_revision:'plant-'+id};sql.prepare('INSERT INTO plants VALUES (?,?,?,?,?)').run(id,owner,id,JSON.stringify(value),'2026-01-01');return value
 },async close(){app.close();await fs.rm(directory,{recursive:true,force:true})}};
 for(const owner of ['delete-user','delete-other']){f.seedTaxon(owner+'-selected',path.slice(0,2),owner);f.seedTaxon(owner+'-child',path.slice(0,3),owner);f.seedTaxon(owner+'-leaf',path,owner,owner==='delete-user'?[picture]:[]);f.seedPlant(owner+'-direct',path.slice(0,2),owner);f.seedPlant(owner+'-descendant',path,owner)}
 return f;
}
for(const system of ['apg4','itis'])test(system+': node-only deletion promotes descendants and direct plants while preserving the other system and files',async()=>{
 const f=await fixture(system);try{const foreign=f.dump('delete-other'),before=f.dump(),snapshot=await f.inspect();assert.equal(snapshot.directPlantCount,1);assert.equal(snapshot.nodeCount,3);
 const r=await f.remove(path.slice(0,2),'node',snapshot.revision);assert.equal(r.status,200);const data=await r.json(),promoted=[path[0],path[2],path[3]];
 assert.ok(!data.taxa.some(t=>t.id==='delete-user-selected'));assert.deepEqual(data.taxa.find(t=>t.id==='delete-user-leaf').path,promoted);assert.deepEqual(data.taxa.find(t=>t.id==='delete-user-leaf').references,[f.picture]);assert.notEqual(data.taxa.find(t=>t.id==='delete-user-child')._revision,'taxon-delete-user-child');
 for(const p of data.plants){const previous=JSON.parse(before.plants.find(row=>row.id===p.id).data);assert.deepEqual(plantPath(p,system),p.id.endsWith('direct')?path.slice(0,1):promoted);assert.deepEqual(plantPath(p,f.otherSystem),plantPath(previous,f.otherSystem));for(const field of ['name','number','photos','photoDates','logs','notes','price','originLocation'])assert.deepEqual(p[field],previous[field]);assert.notEqual(p._revision,previous._revision)}
 assert.equal(buildTree(data.plants,data.taxa,system).nodes.size,3);assert.deepEqual(f.dump('delete-other'),foreign);assert.ok(await f.app.BUCKET.get('delete-user/'+f.picture.split('/').pop()));assert.equal(f.app.database.sql.prepare('SELECT count(*) AS n FROM images').get().n,1);
 }finally{await f.close()}
});
test('branch deletion removes descendants, clears only the selected system and retains an implicit ancestor',async()=>{
 const f=await fixture();try{const snap=await f.inspect(),r=await f.remove(path.slice(0,2),'branch',snap.revision);assert.equal(r.status,200);const data=await r.json();assert.equal(data.taxa.length,1);assert.deepEqual(data.taxa[0].path,path.slice(0,1));for(const p of data.plants){assert.deepEqual(plantPath(p,'apg4'),[]);assert.equal(plantPath(p,'itis').length,1);assert.deepEqual(p.photos,[f.picture])}assert.equal(buildTree(data.plants,data.taxa).nodes.size,1)}finally{await f.close()}
});
test('removing a root promotes children to roots and detaches plants attached directly to it',async()=>{
 const f=await fixture();try{f.seedPlant('direct-root',path.slice(0,1));const snap=await f.inspect(path.slice(0,1)),r=await f.remove(path.slice(0,1),'node',snap.revision);assert.equal(r.status,200);const data=await r.json();assert.deepEqual(plantPath(data.plants.find(p=>p.id==='direct-root')),[]);assert.equal(plantPath(data.plants.find(p=>p.id==='delete-user-descendant'))[0].rank,'family');assert.equal(buildTree(data.plants,data.taxa).roots[0].rank,'family')}finally{await f.close()}
});
test('deleting a childless manual node does not accidentally remove its implicit ancestors or image files',async()=>{
 const f=await fixture();try{f.app.database.sql.prepare('DELETE FROM plants WHERE owner=?').run('delete-user');f.app.database.sql.prepare('DELETE FROM taxa WHERE owner=?').run('delete-user');f.seedTaxon('only-leaf',path,undefined,[f.picture]);const snap=await f.inspect(path),r=await f.remove(path,'node',snap.revision);assert.equal(r.status,200);const data=await r.json();assert.equal(data.taxa.length,1);assert.deepEqual(data.taxa[0].path,path.slice(0,-1));assert.deepEqual(data.taxa[0].references,[]);assert.equal(buildTree([],data.taxa).nodes.size,3);assert.ok(await f.app.BUCKET.get('delete-user/'+f.picture.split('/').pop()))}finally{await f.close()}
});
test('missing qualifier parents fail atomically; the user may then choose branch deletion',async()=>{
 const f=await fixture();try{let before,snap,r;const qualified=validPath([...path,{rank:'aff',name:'Examplea aff. sample'}]);f.seedTaxon('qualifier',qualified);f.seedPlant('qualifier-plant',qualified);before=f.dump();snap=await f.inspect(path);r=await f.remove(path,'node',snap.revision);assert.equal(r.status,400);assert.match((await r.json()).error,/必要的上级/);assert.deepEqual(f.dump(),before);assert.equal((await f.remove(path,'branch',snap.revision)).status,200);
 }finally{await f.close()}
});
test('a mid-update failure restores deleted nodes, descendant paths, revisions and references',async()=>{
 const f=await fixture();try{const before=f.dump(),snap=await f.inspect();f.app.database.sql.exec("CREATE TRIGGER reject_promoted_plant BEFORE UPDATE ON plants WHEN OLD.id='delete-user-descendant' BEGIN SELECT RAISE(ABORT,'simulated promotion failure'); END;");assert.equal((await f.remove(path.slice(0,2),'node',snap.revision)).status,500);assert.deepEqual(f.dump(),before)}finally{await f.close()}
});
test('deletion modes preserve version, origin and owner guards; unknown modes do not mutate data',async()=>{
 const f=await fixture();try{const before=f.dump(),snap=await f.inspect();assert.equal((await f.remove(path.slice(0,2),'unknown',snap.revision)).status,400);assert.equal((await f.remove(path.slice(0,2),null,snap.revision)).status,400);assert.equal((await f.call('DELETE','/api/taxonomy/branch',{system:'apg4',path:path.slice(0,2),deleteMode:'node',confirmation:'删除分类'},snap.revision,'delete-user',{Origin:'null'})).status,403);assert.equal((await f.remove(path.slice(0,2),'node',snap.revision,{confirmation:''})).status,400);assert.equal((await f.remove(path.slice(0,2),'node',null)).status,428);assert.deepEqual(f.dump(),before);
 f.app.database.sql.prepare("UPDATE plants SET data=json_set(data,'$.notes','other device') WHERE id='delete-user-direct'").run();const changed=f.dump();assert.equal((await f.remove(path.slice(0,2),'node',snap.revision)).status,409);assert.deepEqual(f.dump(),changed);
 const foreign=await f.inspect(path.slice(0,2),'delete-other');assert.equal((await f.remove(path.slice(0,2),'node',foreign.revision,{owner:'delete-user'},'delete-other')).status,200);assert.deepEqual(f.dump(),changed);
 }finally{await f.close()}
});

for(const system of ['apg4','itis'])test(system+': legacy duplicate names at different parents never block node-only deletion',async()=>{
 const f=await fixture(system);try{
  // Same family exists as a root and below a class: reproduces the screenshot.
  const duplicate=validPath([{rank:'className',nameZh:'木兰纲',nameEn:'Magnoliopsida'},...path.slice(1)],system);
  f.seedTaxon('legacy-duplicate',duplicate,undefined,[f.picture]);f.seedPlant('legacy-duplicate-plant',duplicate);
  const before=JSON.parse(f.dump().plants.find(p=>p.id==='legacy-duplicate-plant').data),foreign=f.dump('delete-other');
  const snap=await f.inspect(path.slice(0,1)),r=await f.remove(path.slice(0,1),'node',snap.revision);assert.equal(r.status,200,JSON.stringify(await r.clone().json()));
  const data=await r.json();assert.deepEqual(plantPath(data.plants.find(p=>p.id==='delete-user-descendant'),system),path.slice(1));
  assert.deepEqual(data.plants.find(p=>p.id==='legacy-duplicate-plant'),{id:'legacy-duplicate-plant',...before});
  assert.ok(data.taxa.find(t=>t.id==='legacy-duplicate'));assert.deepEqual(f.dump('delete-other'),foreign);
  assert.equal((await f.remove(path.slice(1,2),'branch',(await f.inspect(path.slice(1,2))).revision)).status,200);
  assert.deepEqual(JSON.parse(f.dump().plants.find(p=>p.id==='legacy-duplicate-plant').data),before);
 }finally{await f.close()}
});
test('promotion into identical full paths combines manual records and retains reference images and all plants',async()=>{
 const f=await fixture();try{
  const otherPicture='/images/'+crypto.randomUUID();f.app.database.sql.prepare('INSERT INTO images VALUES (?,?,?)').run(otherPicture.split('/').pop(),'delete-user','image/jpeg');await f.app.BUCKET.put('delete-user/'+otherPicture.split('/').pop(),new Uint8Array([255,216,255,217]));
  const promoted=[path[0],path[2],path[3]];f.seedTaxon('destination',promoted,undefined,[otherPicture]);f.seedPlant('existing-plant',promoted);
  const snap=await f.inspect(),r=await f.remove(path.slice(0,2),'node',snap.revision);assert.equal(r.status,200,JSON.stringify(await r.clone().json()));const data=await r.json();
  const rows=data.taxa.filter(t=>pathKey(t.path)===pathKey(promoted));assert.equal(rows.length,1);assert.equal(rows[0].id,'destination');assert.deepEqual(new Set(rows[0].references),new Set([f.picture,otherPicture]));
  assert.ok(!data.taxa.find(t=>t.id==='delete-user-leaf'));for(const id of ['delete-user-descendant','existing-plant']){const p=data.plants.find(p=>p.id===id);assert.deepEqual(plantPath(p),promoted);assert.equal(plantPath(p,'itis').length,1);assert.deepEqual(p.photos,[f.picture])}
  for(const picture of [f.picture,otherPicture])assert.ok(await f.app.BUCKET.get('delete-user/'+picture.split('/').pop()));
  // A later deletion of this shared node is also possible without duplicate rows.
  assert.equal((await f.remove(promoted,'node',(await f.inspect(promoted)).revision)).status,200);
 }finally{await f.close()}
});
test('legacy duplicate cleanup rolls back combined references, deleted rows and promoted plants on failure',async()=>{
 const f=await fixture();try{f.seedTaxon('destination',[path[0],path[2],path[3]],undefined,[f.picture]);const before=f.dump(),snap=await f.inspect();f.app.database.sql.exec("CREATE TRIGGER reject_legacy_cleanup BEFORE UPDATE ON plants WHEN OLD.id='delete-user-descendant' BEGIN SELECT RAISE(ABORT,'simulated cleanup failure'); END;");assert.equal((await f.remove(path.slice(0,2),'node',snap.revision)).status,500);assert.deepEqual(f.dump(),before)}finally{await f.close()}
});
