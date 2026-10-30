import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url)),output=path.resolve(process.env.APP_OUTPUT_DIR||path.join(root,'out')),binary=process.env.LEAF_7ZIP_BINARY,sfx=process.env.LEAF_7ZIP_SFX,license=process.env.LEAF_7ZIP_LICENSE;
if(!binary||!sfx||!license)throw Error('请提供官方压缩工具、自解压模块和许可文件路径');
const archive=path.join(output,'LeafArchive-Windows-x64-1.0.0.7z'),target=path.join(output,'LeafArchive-Windows-x64-1.0.0.exe');
await fs.copyFile(license,path.join(output,'LeafArchive-win32-x64/7zip-LICENSE.txt'));await fs.rm(archive,{force:true});
const result=spawnSync(binary,['a','-t7z','-mx=9','-mmt=2',archive,'LeafArchive-win32-x64'],{cwd:output,stdio:'inherit'});if(result.status!==0)throw Error('压缩失败');
await fs.writeFile(target,Buffer.concat([await fs.readFile(sfx),await fs.readFile(archive)]));
if(spawnSync(binary,['t',target],{stdio:'inherit'}).status!==0)throw Error('自解压包检查失败');console.log(target);
