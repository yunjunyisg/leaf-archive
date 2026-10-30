import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {ranks,validPath,plantPath,buildTree,pathKey} from '../shared/taxonomy.js';
import {taxonName,taxonColor} from '../shared/distribution.js';
import worker from '../dist/server/index.js';
const path=[{rank:'genus',name:'茅膏菜属'},{rank:'species',name:'Drosera burmannii'}];
test('all ranks, optional ranks, species peers and qualifiers preserve their hierarchy',()=>{
 const full=ranks.filter(r=>!['unresolved','hybrid','aff','cf'].includes(r.key)).map(r=>({rank:r.key,name:r.label}));
 assert.deepEqual(validPath(full),full);
 assert.deepEqual(validPath([...path,{rank:'aff',name:'D. aff. burmannii'}]).at(-1).rank,'aff');
 assert.throws(()=>validPath([...path,{rank:'unresolved',name:'sp.'}]));
 assert.throws(()=>validPath([{rank:'aff',name:'aff.'}]));
 assert.throws(()=>validPath([{rank:'genus',name:'属'},{rank:'unresolved',name:'sp. 1'},{rank:'variety',name:'var.'}]));
 const plants=[{id:'1',genus:'茅膏菜属',name:'个体一',species:'Drosera burmannii'},{id:'2',genus:'茅膏菜属',name:'个体二',species:'Drosera burmannii'},{id:'3',genus:'茅膏菜属',name:'未鉴定',species:'Drosera sp. 1',identification:'unresolved'},{id:'4',genus:'茅膏菜属',name:'近缘',species:'Drosera burmannii',identification:'aff'}];
 const tree=buildTree(plants,[{id:'taxon',path,references:['/assets/example.jpg']}]);
 assert.equal(tree.nodes.get(pathKey(path)).plants.length,2);
 assert.equal(tree.roots[0].children.find(n=>n.rank==='unresolved').name,'Drosera sp. 1');
 assert.equal(tree.nodes.get(pathKey(path)).children[0].rank,'aff');
 assert.equal(tree.nodes.get(pathKey(path)).references.length,1);
 assert.equal(plantPath({name:'旧档案',family:'科',genus:'属'}).at(-1).name,'旧档案');
});
function setup(){
 const sql=new DatabaseSync(':memory:');for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));
 const DB={prepare(query){return {bind(...args){return {async all(){return {results:sql.prepare(query).all(...args)}},async first(){return sql.prepare(query).get(...args)||null},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}}}}}}}};
 async function call(method,url,body,revision,user='owner'){
  const headers={'Origin':'https://example.test','oai-authenticated-user-id':user};if(body)headers['Content-Type']='application/json';if(revision)headers['If-Match']='"'+revision+'"';
  return worker.fetch(new Request('https://example.test'+url,{method,headers,body:body?JSON.stringify(body):undefined}),{DB,TRUST_SITES_IDENTITY:'true'});
 }return {sql,call};
}
test('classification reference images persist independently, isolate accounts and reject stale edits',async()=>{
 const {sql,call}=setup();
 const photo='/images/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';sql.prepare('INSERT INTO images VALUES (?,?,?)').run(photo.split('/').pop(),'owner','image/png');
 const created=await call('POST','/api/taxa',{path,references:[photo]});assert.equal(created.status,201);const t=await created.json();
 assert.equal((await (await call('GET','/api/taxa')).json())[0].references[0],photo);
 assert.deepEqual(await (await call('GET','/api/taxa',null,null,'other')).json(),[]);
 assert.equal((await call('PUT','/api/taxa/'+t.id,t,t._revision,'other')).status,400);
 assert.equal((await call('POST','/api/taxa',{path,references:[photo]},null,'other')).status,400);
 const updated=await call('PUT','/api/taxa/'+t.id,{path,references:[]},t._revision);assert.equal(updated.status,200);
 assert.equal((await call('PUT','/api/taxa/'+t.id,t,t._revision)).status,409);
 assert.equal((await call('PUT','/api/taxa/'+t.id,t)).status,428);
 assert.equal((await call('POST','/api/taxa',{path,references:[]})).status,409);
 assert.equal((await call('POST','/api/taxa',{path:[{rank:'genus',name:'属'}],references:[photo]})).status,400);
 assert.equal((await call('POST','/api/taxa',{path:[{rank:'aff',name:'错误根节点'}],references:[]})).status,400);
 const p=await call('POST','/api/plants',{name:'测试',number:'TEST',kingdom:'植物界',genus:'茅膏菜属',species:'D. burmannii',identification:'cf',infraspecific:'D. cf. burmannii'});
 assert.equal(p.status,201);assert.equal((await p.json()).identification,'cf');
 assert.equal((await call('POST','/api/plants',{name:'缺少基础种名',number:'BAD-AFF',identification:'aff'})).status,400);
 assert.equal((await call('POST','/api/plants',{name:'错误',number:'BAD',identification:'unresolved',variety:'变种'})).status,400);
 sql.close();
});

test('reference image counts above twelve survive creation, update and reload',async()=>{
 const {sql,call}=setup();
 const references=Array.from({length:25},()=>'/images/'+crypto.randomUUID());
 for(const url of references)sql.prepare('INSERT INTO images VALUES (?,?,?)').run(url.split('/').pop(),'owner','image/png');
 const created=await call('POST','/api/taxa',{path,references:references.slice(0,13)});
 assert.equal(created.status,201);const taxon=await created.json();assert.equal(taxon.references.length,13);
 const saved=await call('PUT','/api/taxa/'+taxon.id,{path,references},taxon._revision);
 assert.equal(saved.status,200);assert.deepEqual((await saved.json()).references,references);
 const reloaded=await (await call('GET','/api/taxa')).json();assert.deepEqual(reloaded[0].references,references);
 assert.equal((await call('POST','/api/taxa',{path:[{rank:'species',name:'invalid'}],references:['https://example.test/image.png']})).status,400);
 sql.close();
});

test('hybrids are species-level peers, accept references and retain distinct distribution groups',async()=>{
 const hybridPath=[{rank:'genus',name:'猪笼草属'},{rank:'hybrid',name:'Nepenthes lowii × veitchii'}];
 assert.deepEqual(validPath(hybridPath),hybridPath);
 assert.throws(()=>validPath([...path,{rank:'hybrid',name:'不能放在种以下'}]));
 assert.throws(()=>validPath([...hybridPath,{rank:'variety',name:'种下节点'}]));
 const hybrid={id:'hybrid-a',name:'交种个体',genus:'猪笼草属',species:'Nepenthes lowii × veitchii',identification:'hybrid'};
 assert.equal(plantPath(hybrid).at(-1).rank,'hybrid');
 const natural={...hybrid,id:'natural-a',identification:'species'},tree=buildTree([hybrid,natural]);
 assert.equal(tree.roots[0].children.length,2);assert.notEqual(taxonName(hybrid),taxonName(natural));assert.equal(taxonColor(taxonName(hybrid)),taxonColor(taxonName({...hybrid})));
 const {sql,call}=setup();try{
  const photo='/images/'+crypto.randomUUID();sql.prepare('INSERT INTO images VALUES (?,?,?)').run(photo.split('/').pop(),'owner','image/png');
  const created=await call('POST','/api/taxa',{path:hybridPath,references:[photo]});assert.equal(created.status,201);
  const record=await call('POST','/api/plants',{...hybrid,number:'HYBRID-1'});assert.equal(record.status,201);const saved=await record.json();assert.equal(saved.identification,'hybrid');assert.equal(saved.species,hybrid.species);
  const loaded=(await (await call('GET','/api/plants')).json())[0];assert.equal(plantPath(loaded).at(-1).rank,'hybrid');assert.equal(loaded.species,hybrid.species);
  assert.equal((await call('POST','/api/plants',{name:'缺少名称',number:'HYBRID-2',identification:'hybrid'})).status,400);
  assert.equal((await call('POST','/api/plants',{...hybrid,number:'HYBRID-3',variety:'不支持'})).status,400);
  assert.deepEqual(await (await call('GET','/api/taxa',null,null,'another')).json(),[]);
 }finally{sql.close()}
});
