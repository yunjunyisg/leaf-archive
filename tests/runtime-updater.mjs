import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
async function fixture(){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'leaf-updater-'));const source=path.join(directory,'update'),app=path.join(directory,'app'),mock=path.join(directory,'bin');
 for(const folder of [source+'/standalone',source+'/deploy',source+'/dist/server',app+'/standalone',app+'/dist/server',directory+'/data',mock])await fs.mkdir(folder,{recursive:true});
 const installer=await fs.readFile('deploy/apply-standalone-update.sh','utf8'),names=/for name in (.*?); do/.exec(installer)[1].split(' ');
 for(const name of names)await fs.writeFile(source+'/standalone/'+name,name.endsWith('.html')?'new page':'globalThis.newRuntime=true;');
 await fs.writeFile(source+'/dist/server/index.js','export const version="new-core";');await fs.writeFile(app+'/dist/server/index.js','export const version="old-core";');await fs.writeFile(app+'/standalone/server.mjs','globalThis.oldRuntime=true;');
 await fs.writeFile(directory+'/data/archive.sqlite','private-db-sentinel');
 for(const [name,body] of [['id','if [ "$1" = "-u" ]; then echo 0; fi\nexit 0'],['systemctl','exit 0'],['chown','exit 0'],['curl','if [ "${FAIL_HEALTH:-0}" = "1" ]; then exit 1; fi\nprintf \'{"status":"ok"}\'']]){await fs.writeFile(mock+'/'+name,'#!/bin/sh\n'+body+'\n');await fs.chmod(mock+'/'+name,0o700)}
 const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
 const script=installer.replaceAll('/opt/leaf-archive',app).replaceAll('/var/lib/leaf-archive',directory+'/data').replaceAll('/root/leaf-migration',directory+'/backups').replaceAll('/usr/bin/node',quote(process.execPath));
 await fs.writeFile(source+'/deploy/apply-standalone-update.sh',script);
 return {directory,app,run(fail){return spawnSync('bash',[source+'/deploy/apply-standalone-update.sh'],{encoding:'utf8',env:{...process.env,PATH:mock+path.delimiter+process.env.PATH,FAIL_HEALTH:fail?'1':'0'}})},async close(){await fs.rm(directory,{recursive:true,force:true})}};
}
test('runtime updater installs the compiled service with runtime files while preserving the data directory',async()=>{
 const f=await fixture();try{const result=f.run(false);assert.equal(result.status,0,result.stderr);assert.match(await fs.readFile(f.app+'/dist/server/index.js','utf8'),/new-core/);assert.match(await fs.readFile(f.app+'/standalone/server.mjs','utf8'),/newRuntime/);assert.equal(await fs.readFile(f.directory+'/data/archive.sqlite','utf8'),'private-db-sentinel')}finally{await f.close()}
});
test('failed health checks restore both old compiled service and runtime without rolling back user data',async()=>{
 const f=await fixture();try{const result=f.run(true);assert.notEqual(result.status,0);assert.match(await fs.readFile(f.app+'/dist/server/index.js','utf8'),/old-core/);assert.match(await fs.readFile(f.app+'/standalone/server.mjs','utf8'),/oldRuntime/);assert.equal(await fs.readFile(f.directory+'/data/archive.sqlite','utf8'),'private-db-sentinel');assert.deepEqual(await fs.readdir(f.app+'/standalone'),['server.mjs'])}finally{await f.close()}
});
