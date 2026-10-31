// Serve trusted public program files through small streams; never use for account photos.
import {open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
const verified=new Map();
const streamFile=handle=>Readable.toWeb(handle.createReadStream({start:0,autoClose:true,highWaterMark:65536}),{strategy:{highWaterMark:65536,size:chunk=>chunk.byteLength}});
async function openVerified(file,sha256){
 const handle=await open(file,'r');try{
  const stat=await handle.stat();if(!stat.isFile())throw Error('not a file');const key=String(file),signature=[stat.ino,stat.size,stat.mtimeMs,sha256].join(':');
  if(verified.get(key)!==signature){
   const hash=createHash('sha256');for await(const chunk of handle.createReadStream({autoClose:false,start:0,highWaterMark:65536}))hash.update(chunk);
   if(hash.digest('hex')!==sha256)throw Error('public file checksum mismatch');
   if(verified.size>=64)verified.delete(verified.keys().next().value);verified.set(key,signature);
  }
  return {handle,stat};
 }catch(error){await handle.close();throw error}
}
export async function verifiedFileBody(file,sha256){const {handle}=await openVerified(file,sha256);try{return streamFile(handle)}catch(error){await handle.close();throw error}}
export async function publicFileResponse(request,file,{sha256,mime,headers={}}){
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD','Cache-Control':'no-store'}});
 const {handle,stat}=await openVerified(file,sha256),etag='"'+sha256+'"',out={'Content-Type':mime,'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff',ETag:etag,...headers};
 const validators=(request.headers.get('If-None-Match')||'').split(',').map(v=>v.trim().replace(/^W\//,''));
 if(validators.includes('*')||validators.includes(etag)){await handle.close();return new Response(null,{status:304,headers:out})}
 out['Content-Length']=String(stat.size);if(request.method==='HEAD'){await handle.close();return new Response(null,{headers:out})}
 try{return new Response(streamFile(handle),{headers:out})}catch(error){await handle.close();throw error}
}
