import {packager} from '@electron/packager';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url)),output=path.resolve(process.env.APP_OUTPUT_DIR||path.join(root,'out')),temp=await fs.mkdtemp(path.join(os.tmpdir(),'leaf-desktop-'));
try{
 const metadata=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
 delete metadata.devDependencies;delete metadata.scripts;
 await fs.writeFile(path.join(temp,'package.json'),JSON.stringify(metadata,null,2));
 for(const directory of ['src','assets'])await fs.cp(path.join(root,directory),path.join(temp,directory),{recursive:true});
 const results=await packager({dir:temp,name:'LeafArchive',platform:'win32',arch:'x64',electronVersion:'45.1.0',appVersion:metadata.version,buildVersion:metadata.version,appBundleId:'top.gloriouscarnivorousplants.leafarchive',win32metadata:{CompanyName:'植藏',FileDescription:'植藏植物档案',ProductName:'植藏'},icon:path.join(root,'assets/plant.ico'),out:output,overwrite:true,asar:true,prune:false});
 const directory=results[0];await fs.writeFile(path.join(directory,'使用说明.txt'),'植藏 Windows 版\r\n\r\n请完整解压后双击 LeafArchive.exe，使用网站账号登录。\r\n请保留同一文件夹中的全部文件。此应用连接 gloriouscarnivorousplants.top，需联网使用。\r\n账号、植物档案和照片仍由原网站保存；网站功能更新无需重新安装。\r\n支持 Windows 10/11 64 位。\r\n');
 const zip=path.join(output,'LeafArchive-Windows-x64-1.0.0.zip');await fs.rm(zip,{force:true});const result=process.platform==='win32'?spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','Compress-Archive -LiteralPath $env:LEAF_ZIP_SOURCE -DestinationPath $env:LEAF_ZIP_TARGET'],{env:{...process.env,LEAF_ZIP_SOURCE:directory,LEAF_ZIP_TARGET:zip},stdio:'inherit'}):spawnSync('python3',['-m','zipfile','-c',zip,path.basename(directory)],{cwd:output,stdio:'inherit'});if(result.status!==0)throw Error('Windows 压缩包生成失败');console.log(zip);
}finally{await fs.rm(temp,{recursive:true,force:true})}
