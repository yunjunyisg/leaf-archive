// Bundled into dist/server/index.js. Only build-generated public tokens resolve to this directory.
import {publicFileResponse,verifiedFileBody} from './file-response.mjs';
import {createHash} from 'node:crypto';
const versions=new Map();
function file(content){if(!content||typeof content!=='object'||!/^([a-f0-9]{64})\.[a-z0-9]+$/.test(content.file)||!/^([a-f0-9]{64})$/.test(content.sha256))throw Error('invalid public file descriptor');return new URL('./assets/'+content.file,import.meta.url)}
export function binaryBody(content){if(typeof content==='object')return verifiedFileBody(file(content),content.sha256);const decoded=Buffer.from(content.slice(content.indexOf(',')+1),'base64');return new Blob([decoded]).stream()}
export async function publicBinary(request,content,mime,headers={}){
 try{
  if(typeof content==='object')return await publicFileResponse(request,file(content),{sha256:content.sha256,mime,headers});
  return new Response(request.method==='HEAD'?null:Buffer.from(content.slice(content.indexOf(',')+1),'base64'),{headers:{'Content-Type':mime,...headers}});
 }catch{return new Response('公共资源缺失或校验失败，请重新安装更新包。',{status:503,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}})}
}
export async function publicAsset(request,content,mime,binary=false){
 if(binary&&typeof content==='object')return publicBinary(request,content,mime);
 const key=new URL(request.url).pathname;let etag=versions.get(key);if(!etag){etag='"'+createHash('sha256').update(content).digest('hex')+'"';if(versions.size>=128)versions.delete(versions.keys().next().value);versions.set(key,etag)}
 const headers={'Content-Type':mime,'Cache-Control':binary?'public, max-age=86400':'public, max-age=0, must-revalidate',ETag:etag,'X-Content-Type-Options':'nosniff'};
 if((request.headers.get('If-None-Match')||'').split(',').some(v=>v.trim().replace(/^W\//,'')===etag||v.trim()==='*'))return new Response(null,{status:304,headers});
 return new Response(request.method==='HEAD'?null:binary?Buffer.from(content.slice(content.indexOf(',')+1),'base64'):content,{headers});
}
