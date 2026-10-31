// Public snapshots only; no external requests or account-specific data in this route.
import {existsSync,readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const directory=existsSync(new URL('./boundary-data/catalog.json',import.meta.url))?new URL('./boundary-data/',import.meta.url):new URL('../data/boundaries/global/',import.meta.url);
const catalog=JSON.parse(readFileSync(new URL('catalog.json',directory),'utf8'));
const cache=new Map();
const headers={'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'};
export async function globalBoundaryRoutes(request){
 const url=new URL(request.url);if(!url.pathname.startsWith('/map-boundaries/global/'))return null;
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
 if(url.pathname==='/map-boundaries/global/catalog.json')return new Response(request.method==='HEAD'?null:JSON.stringify(catalog),{headers:{...headers,'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=0, must-revalidate'}});
 const match=/^\/map-boundaries\/global\/([A-Z]{2})-(ADM[23])\.json$/.exec(url.pathname);
 if(!match||!catalog.countries[match[1]]?.[match[2]])return Response.json({error:'此地区暂未收录该级边界，请保留原始标点并查看覆盖说明。'},{status:404,headers});
 const file=match[1]+'-'+match[2]+'.json.gz';let entry=cache.get(file);
 if(!entry){
  try{const bytes=await readFile(new URL(file,directory));const hash=createHash('sha256').update(bytes).digest('hex');if(hash!==catalog.countries[match[1]][match[2]].sha256)throw Error('snapshot checksum mismatch');entry={bytes,etag:'"'+hash+'"'};if(cache.size>=3)cache.delete(cache.keys().next().value);cache.set(file,entry)}
  catch{return Response.json({error:'本地分区文件缺失或校验失败，请重新安装完整地图更新包。'},{status:503,headers:{...headers,'Cache-Control':'no-store'}})}
 }
 const responseHeaders={...headers,'Content-Type':'application/json; charset=utf-8','Content-Encoding':'gzip',ETag:entry.etag};
 if((request.headers.get('If-None-Match')||'').split(',').some(v=>v.trim().replace(/^W\//,'')===entry.etag||v.trim()==='*'))return new Response(null,{status:304,headers:responseHeaders});
 return new Response(request.method==='HEAD'?null:entry.bytes,{headers:responseHeaders});
}
