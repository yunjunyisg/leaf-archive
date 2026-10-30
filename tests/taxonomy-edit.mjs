import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {createApp} from '../standalone/server.mjs';import {setAccount} from '../standalone/local-auth.mjs';import {provisionAdmin} from '../standalone/admin-account.mjs';import {buildTree,pathKey} from '../shared/taxonomy.js';
const origin='https://gloriouscarnivorousplants.top',password='taxonomy-edit-test';
const old=[{rank:'family',name:'输入错的科'}],species=[...old,{rank:'genus',name:'Drosera'},{rank:'species',name:'burmannii'}];
function call(app,url,cookie,options={}){return app.fetch(new Request(origin+url,{...options,headers:{...(cookie?{Cookie:cookie}:{}),...(options.method?{Origin:origin}:{}),...options.headers}}))}
async function sign(app,username){const r=await call(app,'/auth/local',null,{method:'POST',body:new URLSearchParams({username,password})});return r.headers.getSetCookie()[0].split(';')[0]}
async function fixture(){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'leaf-tax-edit-')),app=createApp({dataDirectory:directory,origin});for(const username of ['visitor','another'])await setAccount(app.database.sql,{username,password,owner:username});const user=await sign(app,'visitor'),other=await sign(app,'another');return {directory,app,user,other,async close(){app.close();await fs.rm(directory,{recursive:true,force:true})}}}
function seed(app){
 for(const owner of ['visitor','another']){
  for(const [suffix,p] of [['a',species],['b',[...old,{rank:'genus',name:'Drosera'}]]])app.database.sql.prepare('INSERT INTO taxa VALUES (?,?,?,?,?)').run(owner+suffix,owner,pathKey(p),JSON.stringify({path:p,references:[],_revision:owner+suffix}),'2026-01-01');
  for(const id of ['one','two']){const data={name:id,number:id,family:old[0].name,genus:'Drosera',species:'burmannii',identification:'species',notes:'保留备注',photos:[],logs:[],originLocation:{lat:-15.98111,lon:128.4178,countryCode:'AU',precision:'point'},price:'12.50',_revision:'old-'+id};app.database.sql.prepare('INSERT INTO plants VALUES (?,?,?,?,?)').run(owner+'-'+id,owner,id,JSON.stringify(data),'2026-01-01')}
 }
}
const inspect=(app,user,p=old)=>call(app,'/api/taxonomy/branch?path='+encodeURIComponent(pathKey(p)),user);
const change=(app,user,revision,method,body,headers={})=>call(app,'/api/taxonomy/branch',user,{method,headers:{'Content-Type':'application/json','If-Match':'"'+revision+'"',...headers},body:JSON.stringify(body)});
test('editing an implicit ancestor updates its descendants and linked plants atomically without altering another owner',async()=>{
 const f=await fixture(),{app,user}=f;try{seed(app);const sql=app.database.sql,foreign=sql.prepare('SELECT data FROM plants WHERE owner=? ORDER BY id').all('another'),state=await (await inspect(app,user)).json();
  assert.equal(state.nodeCount,3);assert.equal(state.plantCount,2);const next=[{rank:'family',name:'茅膏菜科'}];
  const r=await change(app,user,state.revision,'PUT',{path:old,newPath:next,references:[]});assert.equal(r.status,200);const data=await r.json();assert.equal(data.plants.length,2);
  for(const plant of data.plants){assert.equal(plant.family,'茅膏菜科');assert.equal(plant.genus,'Drosera');assert.equal(plant.species,'burmannii');assert.equal(plant.price,'12.50');assert.equal(plant.notes,'保留备注');assert.equal(plant.originLocation.lon,128.4178);assert.notEqual(plant._revision,'old-'+plant.number)}
  for(const taxon of data.taxa)assert.equal(taxon.path[0].name,'茅膏菜科');assert.deepEqual(sql.prepare('SELECT data FROM plants WHERE owner=? ORDER BY id').all('another'),foreign);
  assert.equal((await inspect(app,user)).status,404);assert.equal((await call(app,'/api/plants/visitor-one',user,{method:'PUT',headers:{'If-Match':'"old-one"'},body:JSON.stringify({name:'旧编辑',number:'one'})})).status,409);
 }finally{await f.close()}
});
test('deleting a classification detaches plants while keeping archives, images and later reclassification available',async()=>{
 const f=await fixture(),{app,user}=f;try{seed(app);const sql=app.database.sql,id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';sql.prepare('INSERT INTO images VALUES (?,?,?)').run(id,'visitor','image/png');await app.BUCKET.put('visitor/'+id,new Uint8Array([137,80,78,71]));
  let plant=JSON.parse(sql.prepare('SELECT data FROM plants WHERE id=?').get('visitor-one').data);plant.photos=['/images/'+id];sql.prepare('UPDATE plants SET data=? WHERE id=?').run(JSON.stringify(plant),'visitor-one');
  const state=await (await inspect(app,user)).json();assert.equal((await change(app,user,state.revision,'DELETE',{path:old})).status,400);
  const r=await change(app,user,state.revision,'DELETE',{path:old,confirmation:'删除分类'});assert.equal(r.status,200);const data=await r.json();assert.equal(data.plants.length,2);assert.equal(data.taxa.length,0);assert.equal(buildTree(data.plants,data.taxa).nodes.size,0);
  for(const p of data.plants){assert.equal(p.taxonomyDetached,true);assert.equal(p.family,'');assert.equal(p.notes,'保留备注');assert.equal(p.price,'12.50')}
  assert.ok(await app.BUCKET.get('visitor/'+id));plant=data.plants.find(p=>p.number==='one');assert.deepEqual(plant.photos,['/images/'+id]);
  const updated=await call(app,'/api/plants/'+plant.id,user,{method:'PUT',headers:{'If-Match':'"'+plant._revision+'"'},body:JSON.stringify({...plant,notes:'编辑备注'})});assert.equal(updated.status,200);let saved=await updated.json();assert.equal(saved.taxonomyDetached,true);
  const restored=await call(app,'/api/plants/'+plant.id,user,{method:'PUT',headers:{'If-Match':'"'+saved._revision+'"'},body:JSON.stringify({...saved,taxonomyDetached:false,family:'新科',species:'新种'})});assert.equal(restored.status,200);saved=await restored.json();assert.notEqual(saved.taxonomyDetached,true);assert.ok(buildTree([saved]).nodes.size>0);
 }finally{await f.close()}
});
test('stale snapshots and existing destinations reject the whole edit without partial updates',async()=>{
 const f=await fixture(),{app,user}=f;try{seed(app);let state=await (await inspect(app,user)).json();app.database.sql.prepare('UPDATE plants SET data=json_set(data,?,?) WHERE id=?').run('$.notes','来自其他设备','visitor-one');
  assert.equal((await change(app,user,state.revision,'PUT',{path:old,newPath:[{rank:'family',name:'新科'}],references:[]})).status,409);
  const target=[{rank:'family',name:'已有分类'}];app.database.sql.prepare('INSERT INTO taxa VALUES (?,?,?,?,?)').run('existing','visitor',pathKey(target),JSON.stringify({path:target,references:[],_revision:'existing'}),'2026-01-01');state=await (await inspect(app,user)).json();
  assert.equal((await change(app,user,state.revision,'PUT',{path:old,newPath:target,references:[]})).status,409);assert.equal(JSON.parse(app.database.sql.prepare('SELECT data FROM plants WHERE id=?').get('visitor-one').data).family,old[0].name);
 }finally{await f.close()}
});
test('a mid-operation database failure rolls back all descendant and plant changes',async()=>{
 const f=await fixture(),{app,user}=f;try{seed(app);const sql=app.database.sql,state=await (await inspect(app,user)).json(),before=sql.prepare('SELECT id,data FROM taxa WHERE owner=? ORDER BY id').all('visitor');
  sql.exec("CREATE TRIGGER reject_plant_change BEFORE UPDATE ON plants WHEN OLD.id='visitor-two' BEGIN SELECT RAISE(ABORT,'simulated failure'); END;");
  assert.equal((await change(app,user,state.revision,'PUT',{path:old,newPath:[{rank:'family',name:'新科'}],references:[]})).status,500);
  assert.deepEqual(sql.prepare('SELECT id,data FROM taxa WHERE owner=? ORDER BY id').all('visitor'),before);assert.equal((await (await inspect(app,user)).json()).revision,state.revision);
 }finally{await f.close()}
});
test('branch actions require the correct owner session and source and cannot turn another account into an editor',async()=>{
 const f=await fixture(),{app,user}=f;try{seed(app);await provisionAdmin(app.database.sql,{username:'operator',password});const admin=await sign(app,'operator'),state=await (await inspect(app,user)).json();
  assert.equal((await inspect(app,null)).status,401);assert.equal((await inspect(app,admin)).status,403);
  assert.equal((await change(app,user,state.revision,'DELETE',{path:old,confirmation:'删除分类'},{Origin:'null'})).status,403);
  assert.equal((await call(app,'/api/taxonomy/branch',user,{method:'DELETE',body:JSON.stringify({path:old,confirmation:'删除分类'})})).status,428);
  const r=await change(app,user,state.revision,'PUT',{owner:'another',path:old,newPath:[{rank:'family',name:'本人新科'}],references:['/images/ffffffff-ffff-ffff-ffff-ffffffffffff']});assert.equal(r.status,400);assert.equal((await inspect(app,user)).status,200);
 }finally{await f.close()}
});

test('an existing species node can be corrected to the peer hybrid rank while preserving its plants',async()=>{
 const f=await fixture(),{app,user}=f;try{seed(app);const state=await (await inspect(app,user,species)).json(),next=[...species.slice(0,-1),{rank:'hybrid',name:'Drosera A × B'}];
  const r=await change(app,user,state.revision,'PUT',{path:species,newPath:next,references:[]});assert.equal(r.status,200);const data=await r.json();for(const plant of data.plants){assert.equal(plant.identification,'hybrid');assert.equal(plant.species,'Drosera A × B')}
  assert.equal((await inspect(app,user,next)).status,200);assert.equal((await inspect(app,user,species)).status,404);
 }finally{await f.close()}
});
