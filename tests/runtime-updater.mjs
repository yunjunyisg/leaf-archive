import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
async function fixture(){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'leaf-updater-'));const source=path.join(directory,'update'),app=path.join(directory,'app'),mock=path.join(directory,'bin');
 for(const folder of [source+'/standalone',source+'/deploy',source+'/dist/server/assets',app+'/standalone',app+'/dist/server',directory+'/data',mock])await fs.mkdir(folder,{recursive:true});
 const installer=await fs.readFile('deploy/apply-standalone-update.sh','utf8'),names=/for name in (.*?); do/.exec(installer)[1].split(' ');
 for(const name of names)await fs.writeFile(source+'/standalone/'+name,name.endsWith('.html')?'new page':'globalThis.newRuntime=true;');
 await fs.mkdir(source+'/standalone/boundary-data');await fs.writeFile(source+'/standalone/boundary-data/catalog.json','{}');await fs.writeFile(source+'/standalone/boundary-data/AU-ADM2.json.gz','new boundary');
 const assetBytes=Buffer.from('new public file'),assetHash=createHash('sha256').update(assetBytes).digest('hex'),assetFile=assetHash+'.webp';await fs.writeFile(source+'/dist/server/assets/'+assetFile,assetBytes);
 await fs.writeFile(source+'/dist/server/index.js','export const version="new-core";');await fs.writeFile(app+'/dist/server/index.js','export const version="old-core";');await fs.writeFile(app+'/standalone/server.mjs','globalThis.oldRuntime=true;');
 await fs.writeFile(source+'/dist/server/assets/manifest.json',JSON.stringify({entrySha256:createHash('sha256').update(await fs.readFile(source+'/dist/server/index.js')).digest('hex'),files:{[assetFile]:{sha256:assetHash,size:assetBytes.length}}}));
 await fs.writeFile(directory+'/data/archive.sqlite','private-db-sentinel');
 for(const [name,body] of [['id','if [ "$1" = "-u" ]; then echo 0; fi\nexit 0'],['systemctl','exit 0'],['chown','exit 0'],['curl','if [ "${FAIL_HEALTH:-0}" = "1" ]; then exit 1; fi\nprintf \'{"status":"ok"}\'']]){await fs.writeFile(mock+'/'+name,'#!/bin/sh\n'+body+'\n');await fs.chmod(mock+'/'+name,0o700)}
 const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
 const script=installer.replaceAll('/opt/leaf-archive',app).replaceAll('/var/lib/leaf-archive',directory+'/data').replaceAll('/root/leaf-migration',directory+'/backups').replaceAll('/usr/bin/node',quote(process.execPath));
 await fs.writeFile(source+'/deploy/apply-standalone-update.sh',script);
 return {directory,app,source,assetFile,run(fail){return spawnSync('bash',[source+'/deploy/apply-standalone-update.sh'],{encoding:'utf8',env:{...process.env,PATH:mock+path.delimiter+process.env.PATH,FAIL_HEALTH:fail?'1':'0'}})},async close(){await fs.rm(directory,{recursive:true,force:true})}};
}
test('runtime updater installs the compiled service with runtime files while preserving the data directory',async()=>{
 const f=await fixture();try{const result=f.run(false);assert.equal(result.status,0,result.stderr);assert.match(await fs.readFile(f.app+'/dist/server/index.js','utf8'),/new-core/);assert.match(await fs.readFile(f.app+'/standalone/server.mjs','utf8'),/newRuntime/);assert.equal(await fs.readFile(f.app+'/standalone/boundary-data/AU-ADM2.json.gz','utf8'),'new boundary');assert.equal(await fs.readFile(f.directory+'/data/archive.sqlite','utf8'),'private-db-sentinel')}finally{await f.close()}
});
test('failed health checks restore both old compiled service and runtime without rolling back user data',async()=>{
 const f=await fixture();try{const result=f.run(true);assert.notEqual(result.status,0);assert.match(await fs.readFile(f.app+'/dist/server/index.js','utf8'),/old-core/);assert.match(await fs.readFile(f.app+'/standalone/server.mjs','utf8'),/oldRuntime/);assert.equal(await fs.readFile(f.directory+'/data/archive.sqlite','utf8'),'private-db-sentinel');assert.deepEqual(await fs.readdir(f.app+'/standalone'),['server.mjs']);await assert.rejects(fs.stat(f.app+'/dist/server/assets'),{code:'ENOENT'})}finally{await f.close()}
});

test('failed map updates restore the exact previous snapshot directory including removed and added files',async()=>{
 const f=await fixture();try{
  await fs.mkdir(f.app+'/standalone/boundary-data');await fs.writeFile(f.app+'/standalone/boundary-data/old.json.gz','old boundary');await fs.writeFile(f.app+'/standalone/boundary-data/catalog.json','old catalog');
  const result=f.run(true);assert.notEqual(result.status,0);assert.deepEqual((await fs.readdir(f.app+'/standalone/boundary-data')).sort(),['catalog.json','old.json.gz']);assert.equal(await fs.readFile(f.app+'/standalone/boundary-data/catalog.json','utf8'),'old catalog');assert.equal(await fs.readFile(f.app+'/standalone/boundary-data/old.json.gz','utf8'),'old boundary');
 }finally{await f.close()}
});

async function compact(f){
 await fs.cp(f.source+'/standalone/boundary-data',f.app+'/standalone/boundary-data',{recursive:true});
 const files={};for(const name of ['catalog.json','AU-ADM2.json.gz'])files[name]=createHash('sha256').update(await fs.readFile(f.app+'/standalone/boundary-data/'+name)).digest('hex');
 await fs.writeFile(f.source+'/required-boundaries.json',JSON.stringify({files}));await fs.rm(f.source+'/standalone/boundary-data',{recursive:true});
}
test('compact program update verifies and reuses the installed boundary files',async()=>{
 const f=await fixture();try{await compact(f);const result=f.run(false);assert.equal(result.status,0,result.stderr);assert.match(await fs.readFile(f.app+'/dist/server/index.js','utf8'),/new-core/);assert.equal(await fs.readFile(f.app+'/standalone/boundary-data/AU-ADM2.json.gz','utf8'),'new boundary')}finally{await f.close()}
});
test('compact update refuses mismatched or missing boundaries before changing the service',async()=>{
 for(const missing of [false,true]){const f=await fixture();try{await compact(f);const file=f.app+'/standalone/boundary-data/AU-ADM2.json.gz';if(missing)await fs.unlink(file);else await fs.writeFile(file,'corrupt');const result=f.run(false);assert.notEqual(result.status,0);assert.match(await fs.readFile(f.app+'/dist/server/index.js','utf8'),/old-core/);assert.match(await fs.readFile(f.app+'/standalone/server.mjs','utf8'),/oldRuntime/)}finally{await f.close()}}
});

test('failed program upgrade restores old public assets and removes newly introduced assets',async()=>{
 const f=await fixture();try{
  await fs.mkdir(f.app+'/dist/server/assets');await fs.writeFile(f.app+'/dist/server/assets/old-file.webp','old public file');
  const result=f.run(true);assert.notEqual(result.status,0);assert.deepEqual(await fs.readdir(f.app+'/dist/server/assets'),['old-file.webp']);assert.equal(await fs.readFile(f.app+'/dist/server/assets/old-file.webp','utf8'),'old public file');
 }finally{await f.close()}
});
test('missing public assets stop an upgrade before any program or database changes',async()=>{
 const f=await fixture();try{await fs.unlink(f.source+'/dist/server/assets/manifest.json');const result=f.run(false);assert.notEqual(result.status,0);assert.match(await fs.readFile(f.app+'/dist/server/index.js','utf8'),/old-core/);assert.equal(await fs.readFile(f.directory+'/data/archive.sqlite','utf8'),'private-db-sentinel')}finally{await f.close()}
});

test('missing individual public assets are rejected before the service is replaced',async()=>{
 const f=await fixture();try{await fs.unlink(f.source+'/dist/server/assets/'+f.assetFile);const result=f.run(false);assert.notEqual(result.status,0);assert.match(await fs.readFile(f.app+'/dist/server/index.js','utf8'),/old-core/)}finally{await f.close()}
});
