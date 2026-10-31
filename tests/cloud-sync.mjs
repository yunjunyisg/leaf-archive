import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import vm from 'node:vm';
import worker from '../dist/worker/index.js';
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

test('status changes from the detail form and archive editor create durable timeline events',async()=>{
 const {DB,sql}=database();
 const plant=await (await call(DB,'POST','/api/plants',{name:'银叶茅膏菜',number:'STATUS-1',status:'生长中',logs:[{id:'observation',date:'2026-10-01',type:'观察',text:'新叶展开',photos:[]}]})).json();
 assert.equal(plant.logs.length,1);
 const changed=await call(DB,'PUT','/api/plants/'+plant.id,{...plant,status:'休眠中',statusChange:{date:'2026-10-02',note:'减少浇水'}},plant._revision);
 assert.equal(changed.status,200);const dormant=await changed.json();
 assert.equal(dormant.status,'休眠中');const event=dormant.logs.find(l=>l.type==='状态变更');
 assert.equal(event.date,'2026-10-02');assert.equal(event.fromStatus,'生长中');assert.equal(event.toStatus,'休眠中');assert.equal(event.text,'生长中 → 休眠中\n减少浇水');
 const editor=await call(DB,'PUT','/api/plants/'+plant.id,{...dormant,status:'需关注'},dormant._revision);
 assert.equal(editor.status,200);const attention=await editor.json();
 assert.equal(attention.logs.filter(l=>l.type==='状态变更').length,2);
 assert.equal(attention.logs.at(-1).date,new Date().toISOString().slice(0,10));
 assert.deepEqual(attention.logs.find(l=>l.id===event.id),event);
 const unchanged=await call(DB,'PUT','/api/plants/'+plant.id,{...attention,notes:'普通编辑',logs:attention.logs.filter(l=>l.type!=='状态变更')},attention._revision);
 assert.equal(unchanged.status,200);const latest=await unchanged.json();
 assert.equal(latest.logs.filter(l=>l.type==='状态变更').length,2);
 assert.equal(latest.logs.find(l=>l.id==='observation').text,'新叶展开');
 const reloaded=(await (await call(DB,'GET','/api/plants')).json())[0];assert.equal(reloaded.status,'需关注');assert.deepEqual(reloaded.logs,latest.logs);
 assert.equal((await call(DB,'PUT','/api/plants/'+plant.id,{...dormant,status:'已死亡'},dormant._revision)).status,409);
 assert.equal((await call(DB,'PUT','/api/plants/'+plant.id,{...latest,status:'已死亡'},latest._revision,'other-account')).status,404);
 assert.equal((await call(DB,'PUT','/api/plants/'+plant.id,{...latest,status:'已死亡',statusChange:{date:'2026-02-30'}},latest._revision)).status,400);
 assert.equal((await call(DB,'PUT','/api/plants/'+plant.id,{...latest,status:'无效状态'},latest._revision)).status,400);
 assert.equal((await (await call(DB,'GET','/api/plants')).json())[0].status,'需关注');sql.close();
});
test('automatic status history respects the record limit without partially updating the status',async()=>{
 const {DB,sql}=database();
 const logs=Array.from({length:300},(_,i)=>({id:'log-'+i,date:'2026-10-01',type:'观察',text:'观察',photos:[]}));
 const plant=await (await call(DB,'POST','/api/plants',{name:'测试',number:'STATUS-2',status:'生长中',logs})).json();
 assert.equal((await call(DB,'PUT','/api/plants/'+plant.id,{...plant,status:'休眠中'},plant._revision)).status,400);
 const latest=(await (await call(DB,'GET','/api/plants')).json())[0];assert.equal(latest.status,'生长中');assert.equal(latest.logs.length,300);sql.close();
});
