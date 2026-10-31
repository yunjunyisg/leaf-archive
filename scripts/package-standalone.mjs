import {mkdtemp,cp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const target=path.resolve(process.argv[2]||'leaf-archive-aliyun.tar.gz'),temp=await mkdtemp(path.join(tmpdir(),'leaf-package-'));
try{
 for(const file of ['dist/server','standalone','drizzle','deploy','docs/aliyun-deployment.md']){await mkdir(path.dirname(path.join(temp,file)),{recursive:true});await cp(file,path.join(temp,file),{recursive:true})}
 await cp('data/boundaries/global',path.join(temp,'standalone/boundary-data'),{recursive:true});
 await writeFile(path.join(temp,'package.json'),JSON.stringify({private:true,type:'module',engines:{node:'>=24'},scripts:{start:'node standalone/server.mjs'}}));
 const r=spawnSync('tar',['-czf',target,'-C',temp,'.'],{stdio:'inherit'});if(r.status!==0)throw Error('打包失败');console.log(target);
}finally{await rm(temp,{recursive:true,force:true})}
