import fs from 'node:fs/promises';import {build} from 'esbuild';
await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});await fs.mkdir('dist/drizzle',{recursive:true});
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');await fs.cp('drizzle','dist/drizzle',{recursive:true});
await build({entryPoints:['worker/index.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',loader:{'.html':'text','.css':'text'},plugins:[{name:'client-script',setup(b){b.onLoad({filter:/public\/app\.js$/},async a=>({contents:await fs.readFile(a.path,'utf8'),loader:'text'}))}}],outfile:'dist/server/index.js'});
