import defaultManifest from '../data/migration-downloads.json' with {type:'json'};
import {downloadsAvailable} from '../shared/migration-delivery.js';
import {identity} from './auth.js';
export function createMigrationDownloads(manifest){
const root='/migration-downloads',admin='/api/migration-downloads/';
const privateHeaders={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const key=(file,part)=>'temporary-migration-downloads/'+(file.storageVersion||manifest.version)+'/'+file.name+'/'+part;
const missing=()=>new Response('Not found',{status:404,headers:privateHeaders});
const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
async function uploadAuthorized(request,env){
 const expiry=Number(env.LEAF_DOWNLOAD_UPLOAD_EXPIRES),expected=env.LEAF_DOWNLOAD_UPLOAD_SHA256,token=request.headers.get('X-Leaf-Upload-Key')||'';
 if(!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+30*60000||!/^[a-f0-9]{64}$/.test(expected||'')||!/^[a-f0-9]{64}$/.test(token))return false;
 const actual=await sha256(new TextEncoder().encode(token));let different=0;for(let i=0;i<64;i++)different|=actual.charCodeAt(i)^expected.charCodeAt(i);return different===0;
}
function byteRange(header,size){
 if(!header)return {start:0,end:size-1,status:200};
 const m=/^bytes=(\d*)-(\d*)$/.exec(header);if(!m||(!m[1]&&!m[2]))return null;
 let start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2])),end=m[1]?(m[2]?Math.min(Number(m[2]),size-1):size-1):size-1;
 return Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&end>=start&&start<size?{start,end,status:206}:null;
}
async function download(request,bucket,file){
 if(!await bucket.head(key(file,'ready')))return new Response('文件正在准备，请稍后重试。',{status:503,headers:{...privateHeaders,'Retry-After':'15'}});
 const validator=request.headers.get('If-Range'),rangeHeader=validator&&validator!=='"'+file.sha256+'"'?null:request.headers.get('Range');
 const range=byteRange(rangeHeader,file.size);if(!range)return new Response(null,{status:416,headers:{...privateHeaders,'Content-Range':'bytes */'+file.size}});
 const headers={...privateHeaders,'Content-Type':'application/gzip','Content-Disposition':'attachment; filename="'+file.name+'"','Content-Length':String(range.end-range.start+1),'Accept-Ranges':'bytes','ETag':'"'+file.sha256+'"'};
 if(range.status===206)headers['Content-Range']='bytes '+range.start+'-'+range.end+'/'+file.size;
 if(request.method==='HEAD')return new Response(null,{status:range.status,headers});
 let part=Math.floor(range.start/manifest.chunkSize),reader=null,remaining=range.end-range.start+1;
 const body=new ReadableStream({async pull(controller){
  try{
   while(remaining>0){
    if(!reader){const offset=Math.max(0,range.start-part*manifest.chunkSize),length=Math.min(file.parts[part].size-offset,remaining),object=await bucket.get(key(file,part),{range:{offset,length}});if(!object)throw Error('Download chunk missing');reader=object.body.getReader()}
    const chunk=await reader.read();if(chunk.done){reader=null;part++;continue}
    if(chunk.value.byteLength>remaining)throw Error('Download chunk length invalid');remaining-=chunk.value.byteLength;controller.enqueue(chunk.value);if(!remaining){await reader.cancel();reader=null;controller.close()}return;
   }
   controller.close();
  }catch(e){await reader?.cancel().catch(()=>{});controller.error(e)}
 },async cancel(){await reader?.cancel()}});
 return new Response(body,{status:range.status,headers});
}
return async function migrationDownloads(request,env){
 const url=new URL(request.url),pathname=url.pathname;
 if(pathname!==root&&!pathname.startsWith(root+'/')&&!pathname.startsWith(admin))return null;
 if(!env.BUCKET)return missing();
 if(pathname.startsWith(admin)){
  if(!await uploadAuthorized(request,env))return missing();
  const pieces=pathname.slice(admin.length).split('/'),action=pieces[0],file=manifest.files.find(f=>f.name===pieces[1]);
  if(action==='cleanup'&&request.method==='DELETE'){
   for(const f of manifest.files)for(const part of [...f.parts.keys(),'ready'])await env.BUCKET.delete(key(f,part));
   return Response.json({removed:true},{headers:privateHeaders});
  }
  if(!file)return missing();
  if(action==='verify'&&request.method==='GET')return download(request,env.BUCKET,file);
  if(action==='upload'&&request.method==='PUT'){
   const index=Number(pieces[2]),part=file.parts[index];if(!/^\d+$/.test(pieces[2]||'')||!part)return missing();
   if(Number(request.headers.get('Content-Length'))!==part.size)return new Response('Unexpected size',{status:413,headers:privateHeaders});
   const bytes=await request.arrayBuffer();if(bytes.byteLength!==part.size||await sha256(bytes)!==part.sha256)return new Response('Checksum mismatch',{status:422,headers:privateHeaders});
   await env.BUCKET.put(key(file,index),bytes,{httpMetadata:{contentType:'application/octet-stream'},customMetadata:{sha256:part.sha256}});
   return Response.json({uploaded:true,index},{headers:privateHeaders});
  }
  if(action==='commit'&&request.method==='POST'){
   for(let index=0;index<file.parts.length;index++){const part=await env.BUCKET.head(key(file,index));if(!part||part.size!==file.parts[index].size||part.customMetadata?.sha256!==file.parts[index].sha256)return new Response('Parts incomplete',{status:409,headers:privateHeaders})}
   await env.BUCKET.put(key(file,'ready'),JSON.stringify({size:file.size,sha256:file.sha256}),{httpMetadata:{contentType:'application/json'}});
   return Response.json({ready:true,name:file.name},{headers:privateHeaders});
  }
  return missing();
 }
 const who=await identity(request,env);if(!who)return new Response('请先使用原网站账号登录后下载。',{status:401,headers:privateHeaders});
 if(!downloadsAvailable(env,who.owner))return missing();
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:privateHeaders});
 if(pathname===root||pathname===root+'/'){
  const available=await Promise.all(manifest.files.map(async f=>({...f,ready:Boolean(await env.BUCKET.head(key(f,'ready')))})));
  return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>迁移文件下载 · 植藏</title><style>body{font:16px system-ui;background:#f8f9f5;color:#244b39}main{max-width:700px;margin:8vh auto;padding:24px}article{background:white;border:1px solid #dce4d8;border-radius:12px;padding:22px;margin:20px 0}p{line-height:1.7}a{color:inherit}.download{display:inline-block;background:#244b39;color:white;padding:12px 18px;border-radius:8px;text-decoration:none}code{font-size:12px;overflow-wrap:anywhere}</style><main><a href="/">← 返回植物档案</a><h1>迁移文件下载</h1><p>这些附件仅用于服务器迁移和功能更新，不会作为新网站的内容迁入。私密备份含个人档案和照片，请保存在自己的设备或服务器私有目录。当前备份用于部署预演，正式切换前还需核对最新数据。</p>${available.map(f=>`<article><h2>${f.label}</h2><p>${f.name}<br>约 ${(f.size/1024/1024).toFixed(1)} MB</p>${f.ready?`<a class="download" href="${root}/${f.name}" download="${f.name}">下载${f.label}</a>`:'<p role="status">文件正在上传，请稍后刷新。</p>'}<p>SHA256：<code>${f.sha256}</code></p></article>`).join('')}<p>若下载中断，可使用同一原账号重新下载。文件访问仅向你的原账号开放。</p></main></html>`,{headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
 }
 const file=manifest.files.find(f=>pathname===root+'/'+f.name);return file?download(request,env.BUCKET,file):missing();
}

}
export const migrationDownloads=createMigrationDownloads(defaultManifest);
