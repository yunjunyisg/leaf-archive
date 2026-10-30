import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {migrationPhoto} from '../worker/migration-photos.js';
test('temporary photo export is disabled by default, expires, authenticates and limits original ownership',async()=>{
 const token=randomBytes(32).toString('hex'),digest=createHash('sha256').update(token).digest('hex'),id='12345678-1234-1234-1234-123456789abc';let reads=0;
 const DB={prepare(){return {bind(){return {first:async()=>({owner:'original-owner',mime:'image/jpeg'})}}}}},BUCKET={get:async key=>{reads++;assert.equal(key,'original-owner/'+id);return {body:new Uint8Array([255,216,255])}}};
 const env={DB,BUCKET,LEAF_EXPORT_SHA256:digest,LEAF_EXPORT_EXPIRES:String(Date.now()+60000),LEAF_EXPORT_OWNERS:JSON.stringify(['original-owner'])};
 const request=(key=token)=>new Request('https://test.local/api/migration-photos/'+id,{headers:{'X-Leaf-Export-Key':key}});
 assert.equal((await migrationPhoto(request(),{})).status,404);
 assert.equal((await migrationPhoto(request('0'.repeat(64)),env)).status,404);
 assert.equal((await migrationPhoto(request(),{...env,LEAF_EXPORT_EXPIRES:String(Date.now()-1)})).status,404);
 assert.equal((await migrationPhoto(request(),{...env,LEAF_EXPORT_OWNERS:'["another-owner"]'})).status,404);assert.equal(reads,0);
 const r=await migrationPhoto(request(),env);assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.deepEqual(new Uint8Array(await r.arrayBuffer()),new Uint8Array([255,216,255]));
});
