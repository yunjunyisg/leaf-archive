import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import vm from 'node:vm';
import worker from '../dist/server/index.js';
function database(){
 const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync(new URL('../drizzle/0000_harsh_ben_parker.sql',import.meta.url),'utf8'));
 return {sql,DB:{prepare(query){return {bind(...args){return {async all(){return {results:sql.prepare(query).all(...args)}},async first(){return sql.prepare(query).get(...args)||null},async run(){const result=sql.prepare(query).run(...args);return {meta:{changes:Number(result.changes)}}}}}}}}};
}
function call(DB,method,path,body,revision,user='same-account'){
 const headers={'oai-authenticated-user-id':user,'Origin':'https://example.test'};
 if(body)headers['Content-Type']='application/json';if(revision)headers['If-Match']='"'+revision+'"';
 return worker.fetch(new Request('https://example.test'+path,{method,headers,body:body?JSON.stringify(body):undefined}),{DB,TRUST_SITES_IDENTITY:'true'});
}
test('devices share records for the same account; stale edits and deletes do not overwrite them',async()=>{
 const {DB,sql}=database();
 const a=await call(DB,'POST','/api/plants',{name:'银叶茅膏菜',number:'PL-100',logs:[]});assert.equal(a.status,201);const original=await a.json();
 const secondDevice=await (await call(DB,'GET','/api/plants')).json();assert.equal(secondDevice[0].id,original.id);
 assert.deepEqual(await (await call(DB,'GET','/api/plants',null,null,'another-account')).json(),[]);
 const saved=await call(DB,'PUT','/api/plants/'+original.id,{...original,name:'已在手机修改'},original._revision);assert.equal(saved.status,200);const newest=await saved.json();
 assert.notEqual(newest._revision,original._revision);
 assert.equal((await call(DB,'PUT','/api/plants/'+original.id,{...original,name:'电脑旧内容'},original._revision)).status,409);
 assert.equal((await call(DB,'DELETE','/api/plants/'+original.id,null,original._revision)).status,409);
 assert.equal((await call(DB,'PUT','/api/plants/'+original.id,original)).status,428);
 assert.equal((await (await call(DB,'GET','/api/plants')).json())[0].name,'已在手机修改');
 assert.equal((await call(DB,'DELETE','/api/plants/'+original.id,null,newest._revision)).status,200);
 assert.deepEqual(await (await call(DB,'GET','/api/plants')).json(),[]);sql.close();
});
test('existing archives without a revision migrate on their first successful save',async()=>{
 const {DB,sql}=database();sql.prepare('INSERT INTO plants (id,owner,number,data,created) VALUES (?,?,?,?,?)').run('old','same-account','PL-001',JSON.stringify({name:'旧档案',number:'PL-001'}),'2026-01-01');
 const p=(await (await call(DB,'GET','/api/plants')).json())[0];assert.equal(p._revision,'legacy');
 const saved=await call(DB,'PUT','/api/plants/old',{...p,notes:'更新'},p._revision);assert.equal(saved.status,200);assert.notEqual((await saved.json())._revision,'legacy');sql.close();
});
test('conditional database update rejects a write that races after the initial read',async()=>{
 const {DB,sql}=database();const original=await (await call(DB,'POST','/api/plants',{name:'原始',number:'PL-002'})).json();
 const racing={prepare(query){const statement=DB.prepare(query);return {bind(...args){const bound=statement.bind(...args);if(query.startsWith('UPDATE plants SET'))return {...bound,async run(){sql.prepare('UPDATE plants SET data=? WHERE id=?').run(JSON.stringify({...original,name:'另一设备已保存',_revision:'racing'}),original.id);return bound.run()}};return bound}}}};
 const response=await call(racing,'PUT','/api/plants/'+original.id,{...original,name:'不应覆盖'},original._revision);assert.equal(response.status,409);
 assert.equal((await (await call(DB,'GET','/api/plants')).json())[0].name,'另一设备已保存');sql.close();
});
const refreshSource=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8').split('async function refreshCloud(){')[1].split('setInterval(refreshCloud,15000);')[0];
function client(){
 const elements={'#error':{hidden:false},'#demo':{checked:false},'#detail':{open:false},'#editor':{open:false},'#confirm':{open:false},'#logText':{value:''},'#growthPhotoPreview':{children:[]}};
 const ctx={authState:{user:{id:'same-account'}},loading:false,syncRunning:false,syncWrites:0,syncEpoch:0,autoDemo:false,records:[],document:{hidden:false},navigator:{onLine:true},selected:null,growthBusy:false,$:id=>elements[id],render(){ctx.renders++},syncStatus(text){ctx.status=text},renders:0,async api(url){return url==='/api/auth'?{user:{id:'same-account'}}:[{id:'new',name:'手机新记录'}]}};
 vm.createContext(ctx);vm.runInContext('async function refreshCloud(){'+refreshSource,ctx);return {ctx,elements};
}
test('background refresh receives another device record while preserving open editor',async()=>{
 const {ctx,elements}=client();elements['#editor'].open=true;ctx.autoDemo=true;elements['#demo'].checked=true;
 await ctx.refreshCloud();assert.equal(ctx.records[0].name,'手机新记录');assert.equal(elements['#editor'].open,true);assert.equal(elements['#demo'].checked,false);assert.equal(ctx.renders,1);
});
test('a response started before a local save cannot replace newer local state',async()=>{
 const {ctx}=client();let finish;ctx.api=()=>new Promise(resolve=>finish=resolve);const pending=ctx.refreshCloud();ctx.syncEpoch++;ctx.records=[{id:'local',name:'刚保存'}];finish([{id:'stale'}]);await pending;assert.equal(ctx.records[0].id,'local');assert.equal(ctx.renders,0);
});
