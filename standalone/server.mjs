import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createGzip} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import worker from '../dist/server/index.js';
import {openDatabase,diskBucket} from './storage.mjs';
import {createLocalAuth} from './local-auth.mjs';
export function createApp({dataDirectory,origin,env={}}){
 const site=new URL(origin);if(site.protocol!=='https:'||site.pathname!=='/'||site.search||site.hash)throw Error('SITE_ORIGIN 必须是 HTTPS 网站根地址');
 const database=openDatabase(dataDirectory),BUCKET=diskBucket(path.join(dataDirectory,'objects')),login=createLocalAuth(database.sql);
 // Ignore caller-supplied identity and runtime TRUST_SITES_IDENTITY, including forwarded headers.
 const bindings={...env,DB:database.DB,BUCKET,TRUST_SITES_IDENTITY:'false'};
 return {database,BUCKET,origin:site.origin,async fetch(request,ip){
  const headers=new Headers(request.headers);headers.delete('oai-authenticated-user-id');headers.delete('oai-authenticated-user-email');
  const url=new URL(request.url);if(url.origin!==site.origin)return new Response('Invalid site origin',{status:400});
  request=new Request(request,{headers});
  if(url.pathname==='/healthz')return Response.json({status:'ok'},{headers:{'Cache-Control':'no-store'}});
  if(!['GET','HEAD','OPTIONS'].includes(request.method)&&request.headers.get('Origin')!==site.origin)return new Response('请求来源无效',{status:403});
  const authenticated=await login(request,ip);if(authenticated)return authenticated;
  const response=await worker.fetch(request,bindings);
  if(url.pathname==='/api/auth'&&response.ok){const state=await response.json();return Response.json({...state,passwordLogin:true,legacyLogin:false},{headers:{'Cache-Control':'no-store'}})}
  return response;
 },close:()=>database.close()};
}
export function httpServer(app){
 return createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,app.origin);if(url.origin!==app.origin){res.writeHead(400);res.end();return}
   const chunks=[];let size=0;
   if(!['GET','HEAD'].includes(req.method))for await(const chunk of req){size+=chunk.length;if(size>10*1024*1024){res.writeHead(413);res.end('Request too large');return}chunks.push(chunk)}
   const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);
   const request=new Request(url,{method:req.method,headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})});
   // The application listens only on loopback; Nginx must overwrite X-Real-IP.
   const clientIp=String(req.headers['x-real-ip']||req.socket.remoteAddress).slice(0,128);
   const response=await app.fetch(request,clientIp);
   for(const [key,value] of response.headers)if(key.toLowerCase()!=='set-cookie')res.setHeader(key,value);
   if(response.headers.getSetCookie().length)res.setHeader('Set-Cookie',response.headers.getSetCookie());
   res.statusCode=response.status;
   if(req.method==='HEAD'||!response.body){res.end();return}
   const compress=/\bgzip\b/.test(req.headers['accept-encoding']||'')&&!response.headers.has('Content-Encoding')&&/^(text\/|application\/(javascript|json))/.test(response.headers.get('Content-Type')||'')&&!response.headers.get('Cache-Control')?.includes('no-transform');
   if(compress){res.setHeader('Content-Encoding','gzip');res.setHeader('Vary','Accept-Encoding');res.removeHeader('Content-Length');await pipeline(Readable.fromWeb(response.body),createGzip(),res)}else await pipeline(Readable.fromWeb(response.body),res);
  }catch{if(!res.headersSent){res.writeHead(500,{'Cache-Control':'no-store'});res.end('服务暂时不可用')}else res.destroy()}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 process.umask(0o077);
 const app=createApp({dataDirectory:process.env.LEAF_DATA_DIR||'/var/lib/leaf-archive',origin:process.env.SITE_ORIGIN||'https://gloriouscarnivorousplants.top',env:process.env});
 const server=httpServer(app),port=Number(process.env.PORT||3100);server.listen(port,'127.0.0.1',()=>console.log('Leaf Archive listening on 127.0.0.1:'+port));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close(()=>{app.close();process.exit(0)});setTimeout(()=>process.exit(1),10000).unref()});
}
