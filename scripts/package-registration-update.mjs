import {readFile,mkdtemp,mkdir,copyFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
const target=path.resolve(process.argv[2]||'leaf-archive-registration-update.tar.gz'),moduleBytes=await readFile('standalone/local-auth.mjs'),digest=createHash('sha256').update(moduleBytes).digest('hex');
if(!(await readFile('deploy/apply-registration.sh','utf8')).includes(digest))throw Error('请先同步安装脚本中的登录模块校验值');
const temp=await mkdtemp(path.join(os.tmpdir(),'leaf-registration-package-'));
try{
 await mkdir(path.join(temp,'standalone'));await copyFile('standalone/local-auth.mjs',path.join(temp,'standalone/local-auth.mjs'));
 await copyFile('deploy/apply-registration.sh',path.join(temp,'apply-registration.sh'));await copyFile('docs/aliyun-deployment.md',path.join(temp,'部署说明.md'));
 const result=spawnSync('tar',['-czf',target,'-C',temp,'.'],{stdio:'inherit'});if(result.status!==0)throw Error('注册更新包打包失败');console.log(target);
}finally{await rm(temp,{recursive:true,force:true})}
