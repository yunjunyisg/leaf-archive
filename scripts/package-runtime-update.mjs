import {mkdtemp,cp,mkdir,rm,writeFile,readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
const target=path.resolve(process.argv[2]||'leaf-archive-admin-update.tar.gz'),temp=await mkdtemp(path.join(os.tmpdir(),'leaf-runtime-package-'));
try{
 await cp('standalone',path.join(temp,'standalone'),{recursive:true});await mkdir(path.join(temp,'deploy'));
 await cp('deploy/apply-standalone-update.sh',path.join(temp,'deploy/apply-standalone-update.sh'));
 // Compatibility entry for an older registration-only installation command.
 await writeFile(path.join(temp,'apply-registration.sh'),'#!/usr/bin/env bash\nset -e\nroot=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)\nbash "$root/deploy/apply-standalone-update.sh"\n');
 const files=(await readdir(path.join(temp,'standalone'))).map(f=>'standalone/'+f).concat(['deploy/apply-standalone-update.sh','apply-registration.sh']).sort();
 const sums=[];for(const file of files)sums.push(createHash('sha256').update(await readFile(path.join(temp,file))).digest('hex')+'  '+file);
 await writeFile(path.join(temp,'SHA256SUMS'),sums.join('\n')+'\n');
 const result=spawnSync('tar',['-czf',target,'-C',temp,'.'],{stdio:'inherit'});if(result.status!==0)throw Error('更新包生成失败');console.log(target);
}finally{await rm(temp,{recursive:true,force:true})}
