import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
const metric=()=>Object.fromEntries(['rss','heapUsed','external'].map(k=>[k,Math.round(process.memoryUsage()[k]/1024/1024)]));
const {createApp}=await import('../standalone/server.mjs');const directory=await fs.mkdtemp(path.join(os.tmpdir(),'leaf-memory-')),app=createApp({dataDirectory:directory,origin:'https://gloriouscarnivorousplants.top'});
const startup=metric();let total=0;
for(const route of ['/welcome/plant-74.webp','/map-relief.webp','/map-boundaries/global/CN-ADM3.json','/map-boundaries/global/IN-ADM3.json','/map-boundaries/global/CA-ADM3.json']){const response=await app.fetch(new Request(app.origin+route));if(!response.ok)throw Error(route+':'+response.status);for await(const chunk of response.body)total+=chunk.byteLength;}
await new Promise(r=>setTimeout(r,100));console.log(JSON.stringify({startup,afterMapRequests:metric(),bytesServed:total}));app.close();await fs.rm(directory,{recursive:true,force:true});
