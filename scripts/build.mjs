import fs from 'node:fs/promises';import {build,transform} from 'esbuild';import {gunzipSync,gzipSync} from 'node:zlib';
await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});await fs.mkdir('dist/drizzle',{recursive:true});
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');await fs.cp('drizzle','dist/drizzle',{recursive:true});
const mapBuild=await build({entryPoints:['public/origin-map.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',charset:'utf8',minify:true,write:false});
await build({entryPoints:['worker/index.js'],bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',charset:'utf8',loader:{'.gz':'dataurl','.txt':'text','.html':'text','.css':'text','.png':'dataurl','.webp':'dataurl','.ico':'dataurl','.zip':'dataurl'},plugins:[{name:'client-script',setup(b){
b.onResolve({filter:/^leaf:admin1-countries$/},()=>({path:'admin1-countries',namespace:'generated'}));
b.onLoad({filter:/.*/,namespace:'generated'},async()=>{
 const all=JSON.parse(gunzipSync(await fs.readFile('data/boundaries/admin1.json.gz'))),groups={};
 for(const f of all.features)(groups[f.properties.code]??=[]).push(f);
 const encoded=Object.fromEntries(Object.entries(groups).map(([code,features])=>[code,'data:application/gzip;base64,'+gzipSync(JSON.stringify({type:'FeatureCollection',features}),{level:9}).toString('base64')]));
 return {contents:'export default '+JSON.stringify(encoded),loader:'js'};
});
b.onResolve({filter:/\?raw$/},a=>({path:new URL('../'+a.path.replace(/^\.\.\//,'').replace(/\?raw$/,''),import.meta.url).pathname,namespace:'raw'}));b.onLoad({filter:/.*/,namespace:'raw'},async a=>({contents:(await transform(await fs.readFile(a.path,'utf8'),{loader:'js',minify:true,target:'es2022',charset:'utf8'})).code,loader:'text'}));b.onLoad({filter:/public\/origin-map\.js$/},()=>({contents:mapBuild.outputFiles[0].text,loader:'text'}));b.onLoad({filter:/public\/.*\.css$/},async a=>({contents:(await transform(await fs.readFile(a.path,'utf8'),{loader:'css',minify:true})).code,loader:'text'}));b.onLoad({filter:/public\/(app|sw)\.js$/},async a=>({contents:(await transform(await fs.readFile(a.path,'utf8'),{loader:'js',minify:true,target:'es2022',charset:'utf8'})).code,loader:'text'}))}}],outfile:'dist/server/index.js'});
