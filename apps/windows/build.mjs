import {packager} from '@electron/packager';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url)),output=path.resolve(process.env.APP_OUTPUT_DIR||path.join(root,'out')),temp=await fs.mkdtemp(path.join(os.tmpdir(),'leaf-desktop-'));
const plantId=process.argv.includes('--plant-id');
const product=plantId?{
 name:'PlantId',title:'识植助手',description:'识植助手植物识别与问答',version:'1.0.1',
 identifier:'top.gloriouscarnivorousplants.plantid',icon:'plant-id.ico',
}:{
 name:'LeafArchive',title:'植藏',description:'植藏植物档案',
 identifier:'top.gloriouscarnivorousplants.leafarchive',icon:'plant.ico',
};
try{
 const metadata=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
 if(plantId){
  metadata.name='plant-id-desktop';
  metadata.productName=product.title;
  metadata.version=product.version;
  metadata.description=product.description;
  metadata.plantId=true;
 }
 delete metadata.devDependencies;delete metadata.scripts;
 await fs.writeFile(path.join(temp,'package.json'),JSON.stringify(metadata,null,2));
 for(const directory of ['src','assets'])await fs.cp(path.join(root,directory),path.join(temp,directory),{recursive:true});
 const results=await packager({dir:temp,name:product.name,platform:'win32',arch:'x64',electronVersion:'45.1.0',appVersion:metadata.version,buildVersion:metadata.version,appBundleId:product.identifier,win32metadata:{CompanyName:'植藏',FileDescription:product.description,ProductName:product.title},icon:path.join(root,'assets',product.icon),out:output,overwrite:true,asar:true,prune:false});
 const directory=results[0];
 if(plantId)console.log(directory);
 else{
  await fs.writeFile(path.join(directory,'使用说明.txt'),'植藏 Windows 版\r\n\r\n请完整解压后双击 LeafArchive.exe，使用网站账号登录。\r\n请保留同一文件夹中的全部文件。此应用连接 gloriouscarnivorousplants.top，需联网使用。\r\n账号、植物档案和照片仍由原网站保存；网站功能更新无需重新安装。\r\n支持 Windows 10/11 64 位。\r\n');
  const zip=path.join(output,'LeafArchive-Windows-x64-1.1.0.zip');await fs.rm(zip,{force:true});const result=process.platform==='win32'?spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','Compress-Archive -LiteralPath $env:LEAF_ZIP_SOURCE -DestinationPath $env:LEAF_ZIP_TARGET'],{env:{...process.env,LEAF_ZIP_SOURCE:directory,LEAF_ZIP_TARGET:zip},stdio:'inherit'}):spawnSync('python3',['-m','zipfile','-c',zip,path.basename(directory)],{cwd:output,stdio:'inherit'});if(result.status!==0)throw Error('Windows 压缩包生成失败');console.log(zip);
 }
}finally{await fs.rm(temp,{recursive:true,force:true})}
