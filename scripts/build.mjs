import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {build,transform} from 'esbuild';import {gunzipSync,gzipSync} from 'node:zlib';
await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/worker',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});await fs.mkdir('dist/drizzle',{recursive:true});
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');await fs.cp('drizzle','dist/drizzle',{recursive:true});
await fs.rm('dist/server/assets',{recursive:true,force:true});await fs.mkdir('dist/server/assets');
const assets={};
async function binary(bytes,extension){const sha256=createHash('sha256').update(bytes).digest('hex'),file=sha256+'.'+extension;if(!assets[file]){assets[file]={sha256,size:bytes.length};await fs.writeFile('dist/server/assets/'+file,bytes)}return {file,sha256}}
const mapBuild=await build({entryPoints:['public/origin-map.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',charset:'utf8',minify:true,write:false});
function clientPlugin(native){return {name:'client-script',setup(b){
 if(native){
  b.onResolve({filter:/public-assets\.js$/},()=>({path:new URL('../standalone/native-assets.mjs',import.meta.url).pathname}));
  b.onLoad({filter:/\.(gz|png|webp|ico|zip)$/},async a=>({contents:'export default '+JSON.stringify(await binary(await fs.readFile(a.path),path.extname(a.path).slice(1))),loader:'js'}));
  b.onLoad({filter:/public\/assets\.json$/},async a=>{const all=JSON.parse(await fs.readFile(a.path,'utf8')),result={};for(const [key,value] of Object.entries(all))result[key]=await binary(Buffer.from(value.slice(value.indexOf(',')+1),'base64'),'jpg');return {contents:'export default '+JSON.stringify(result),loader:'js'}});
 }
 b.onResolve({filter:/^leaf:admin1-countries$/},()=>({path:'admin1-countries',namespace:'generated'}));
 b.onLoad({filter:/.*/,namespace:'generated'},async()=>{
  const all=JSON.parse(gunzipSync(await fs.readFile('data/boundaries/admin1.json.gz'))),groups={},encoded={};for(const f of all.features)(groups[f.properties.code]??=[]).push(f);
  for(const [code,features] of Object.entries(groups)){const bytes=gzipSync(JSON.stringify({type:'FeatureCollection',features}),{level:9});encoded[code]=native?await binary(bytes,'gz'):'data:application/gzip;base64,'+bytes.toString('base64')}
  return {contents:'export default '+JSON.stringify(encoded),loader:'js'};
 });
 b.onResolve({filter:/\?raw$/},a=>({path:new URL('../'+a.path.replace(/^\.\.\//,'').replace(/\?raw$/,''),import.meta.url).pathname,namespace:'raw'}));
 b.onLoad({filter:/.*/,namespace:'raw'},async a=>({contents:(await transform(await fs.readFile(a.path,'utf8'),{loader:'js',minify:true,target:'es2022',charset:'utf8'})).code,loader:'text'}));
 b.onLoad({filter:/public\/origin-map\.js$/},()=>({contents:mapBuild.outputFiles[0].text,loader:'text'}));
 b.onLoad({filter:/public\/.*\.css$/},async a=>({contents:(await transform(await fs.readFile(a.path,'utf8'),{loader:'css',minify:true})).code,loader:'text'}));
 b.onLoad({filter:/public\/(app|sw)\.js$/},async a=>({contents:(await transform(await fs.readFile(a.path,'utf8'),{loader:'js',minify:true,target:'es2022',charset:'utf8'})).code,loader:'text'}));
}}}
const common={entryPoints:['worker/index.js'],bundle:true,minify:true,format:'esm',charset:'utf8',loader:{'.gz':'dataurl','.txt':'text','.html':'text','.css':'text','.png':'dataurl','.webp':'dataurl','.ico':'dataurl','.zip':'dataurl'}};
await build({...common,platform:'browser',target:'es2022',plugins:[clientPlugin(false)],outfile:'dist/worker/index.js'});
await build({...common,platform:'node',target:'node24',plugins:[clientPlugin(true)],outfile:'dist/server/index.js'});
await fs.writeFile('dist/server/assets/manifest.json',JSON.stringify({entrySha256:createHash('sha256').update(await fs.readFile('dist/server/index.js')).digest('hex'),files:assets},null,2)+'\n');
