import test from 'node:test';import assert from 'node:assert/strict';import {createHash,randomBytes} from 'node:crypto';
import {createMigrationDownloads} from '../worker/migration-downloads.js';
const sha=x=>createHash('sha256').update(x).digest('hex');
function fixture(){
 const data=Buffer.from('abcdefghijklm'),chunkSize=4,parts=[];for(let offset=0;offset<data.length;offset+=chunkSize){const bytes=data.subarray(offset,offset+chunkSize);parts.push({size:bytes.length,sha256:sha(bytes)})}
 const file={name:'fixture.tar.gz',label:'测试文件',size:data.length,sha256:sha(data),parts},manifest={version:'test',chunkSize,files:[file]},objects=new Map();
 const BUCKET={async put(key,value,options={}){objects.set(key,{bytes:Buffer.from(typeof value==='string'?value:new Uint8Array(value)),...options})},async head(key){const o=objects.get(key);return o?{size:o.bytes.length,customMetadata:o.customMetadata}:null},async get(key,options={}){const o=objects.get(key);if(!o)return null;const r=options.range,b=r?o.bytes.subarray(r.offset,r.offset+r.length):o.bytes;return {body:new Response(b).body}},async delete(key){objects.delete(key)}};
 const token=randomBytes(32).toString('hex'),env={BUCKET,TRUST_SITES_IDENTITY:'true',LEAF_DOWNLOAD_ENABLED:'true',LEAF_DOWNLOAD_OWNER:'owner',LEAF_DOWNLOAD_EXPIRES:String(Date.now()+3600000),LEAF_DOWNLOAD_UPLOAD_SHA256:sha(token),LEAF_DOWNLOAD_UPLOAD_EXPIRES:String(Date.now()+600000)};
 const run=createMigrationDownloads(manifest),call=(path,method='GET',body,headers={})=>run(new Request('https://test.local'+path,{method,headers,...(body===undefined?{}:{body})}),env);
 const admin={'X-Leaf-Upload-Key':token};return {data,file,objects,env,call,admin};
}
test('download page and both file paths are available only to the original verified account',async()=>{
 const f=fixture();assert.equal((await f.call('/migration-downloads')).status,401);
 assert.equal((await f.call('/migration-downloads','GET',undefined,{'oai-authenticated-user-id':'another'})).status,404);
 f.env.TRUST_SITES_IDENTITY='false';assert.equal((await f.call('/migration-downloads','GET',undefined,{'oai-authenticated-user-id':'owner'})).status,401);f.env.TRUST_SITES_IDENTITY='true';
 const page=await f.call('/migration-downloads','GET',undefined,{'oai-authenticated-user-id':'owner'});assert.equal(page.status,200);assert.match(page.headers.get('Cache-Control'),/private, no-store/);assert.ok((await page.text()).includes('文件正在上传'));
 f.env.LEAF_DOWNLOAD_EXPIRES='0';assert.equal((await f.call('/migration-downloads','GET',undefined,{'oai-authenticated-user-id':'owner'})).status,404);
});
test('pinned chunk uploads reject unknown tokens, corrupt data and incomplete commits; downloads stream and resume exactly',async()=>{
 const f=fixture(),prefix='/api/migration-downloads/';
 assert.equal((await f.call(prefix+'upload/fixture.tar.gz/0','PUT',Buffer.from('abcd'),{'Content-Length':'4'})).status,404);
 assert.equal((await f.call(prefix+'upload/fixture.tar.gz/0','PUT',Buffer.from('bad!'),{...f.admin,'Content-Length':'4'})).status,422);
 assert.equal((await f.call(prefix+'commit/fixture.tar.gz','POST',undefined,f.admin)).status,409);
 for(let i=0;i<f.file.parts.length;i++){const bytes=f.data.subarray(i*4,i*4+4);assert.equal((await f.call(prefix+'upload/fixture.tar.gz/'+i,'PUT',bytes,{...f.admin,'Content-Length':String(bytes.length)})).status,200)}
 assert.equal((await f.call(prefix+'commit/fixture.tar.gz','POST',undefined,f.admin)).status,200);
 const owner={'oai-authenticated-user-id':'owner'},route='/migration-downloads/fixture.tar.gz';
 const full=await f.call(route,'GET',undefined,owner);assert.equal(full.status,200);assert.match(full.headers.get('Content-Disposition'),/attachment/);assert.equal(full.headers.get('Content-Length'),'13');assert.deepEqual(Buffer.from(await full.arrayBuffer()),f.data);
 for(const [range,expected] of [['bytes=2-9','cdefghij'],['bytes=8-','ijklm'],['bytes=-3','klm']]){const r=await f.call(route,'GET',undefined,{...owner,Range:range});assert.equal(r.status,206);assert.equal(await r.text(),expected)}
 assert.equal((await f.call(route,'GET',undefined,{...owner,Range:'bytes=100-'})).status,416);assert.equal((await f.call(route,'HEAD',undefined,owner)).body,null);
 f.env.LEAF_DOWNLOAD_UPLOAD_EXPIRES='0';assert.equal((await f.call(prefix+'verify/fixture.tar.gz','GET',undefined,f.admin)).status,404);assert.equal((await f.call(route,'GET',undefined,owner)).status,200);
 f.env.LEAF_DOWNLOAD_UPLOAD_EXPIRES=String(Date.now()+60000);assert.equal((await f.call(prefix+'cleanup','DELETE',undefined,f.admin)).status,200);assert.equal(f.objects.size,0);
});
