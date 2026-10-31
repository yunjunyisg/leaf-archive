import {mkdtemp,cp,mkdir,rm,writeFile,readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
const target=path.resolve(process.argv[2]||'leaf-archive-runtime-update.tar.gz'),temp=await mkdtemp(path.join(os.tmpdir(),'leaf-runtime-package-'));
const withCore=process.argv.includes('--with-core'),reuseBoundaries=process.argv.includes('--reuse-boundaries');
try{
 await cp('standalone',path.join(temp,'standalone'),{recursive:true});if(reuseBoundaries){const catalogBytes=await readFile('data/boundaries/global/catalog.json'),catalog=JSON.parse(catalogBytes),files={'catalog.json':createHash('sha256').update(catalogBytes).digest('hex')};for(const [code,levels] of Object.entries(catalog.countries))for(const [level,value] of Object.entries(levels))files[code+'-'+level+'.json.gz']=value.sha256;await writeFile(path.join(temp,'required-boundaries.json'),JSON.stringify({files})+'\n')}else await cp('data/boundaries/global',path.join(temp,'standalone/boundary-data'),{recursive:true});await mkdir(path.join(temp,'deploy'));
 if(withCore){await mkdir(path.join(temp,'dist/server'),{recursive:true});await cp('dist/server/index.js',path.join(temp,'dist/server/index.js'))}
 await cp('deploy/apply-standalone-update.sh',path.join(temp,'deploy/apply-standalone-update.sh'));
 // Compatibility entry for an older registration-only installation command.
 await writeFile(path.join(temp,'apply-registration.sh'),'#!/usr/bin/env bash\nset -e\nroot=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)\nbash "$root/deploy/apply-standalone-update.sh"\n');
 async function list(directory){const all=[];for(const item of await readdir(path.join(temp,directory),{withFileTypes:true})){const file=directory+'/'+item.name;all.push(...(item.isDirectory()?await list(file):[file]))}return all}
 const files=(await list('standalone')).concat(['deploy/apply-standalone-update.sh','apply-registration.sh',...(reuseBoundaries?['required-boundaries.json']:[]),...(withCore?['dist/server/index.js']:[])]).sort();
 const sums=[];for(const file of files)sums.push(createHash('sha256').update(await readFile(path.join(temp,file))).digest('hex')+'  '+file);
 await writeFile(path.join(temp,'SHA256SUMS'),sums.join('\n')+'\n');
 const result=spawnSync('tar',['-czf',target,'-C',temp,'.'],{stdio:'inherit'});if(result.status!==0)throw Error('更新包生成失败');console.log(target);
}finally{await rm(temp,{recursive:true,force:true})}
