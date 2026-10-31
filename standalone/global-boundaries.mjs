// Public snapshots only; no external requests or account-specific data in this route.
import {existsSync,readFileSync} from 'node:fs';
import {publicFileResponse} from './file-response.mjs';
const directory=existsSync(new URL('./boundary-data/catalog.json',import.meta.url))?new URL('./boundary-data/',import.meta.url):new URL('../data/boundaries/global/',import.meta.url);
const catalog=JSON.parse(readFileSync(new URL('catalog.json',directory),'utf8'));
const headers={'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'};
export async function globalBoundaryRoutes(request){
 const url=new URL(request.url);if(!url.pathname.startsWith('/map-boundaries/global/'))return null;
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
 if(url.pathname==='/map-boundaries/global/catalog.json')return new Response(request.method==='HEAD'?null:JSON.stringify(catalog),{headers:{...headers,'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=0, must-revalidate'}});
 const match=/^\/map-boundaries\/global\/([A-Z]{2})-(ADM[23])\.json$/.exec(url.pathname);
 if(!match||!catalog.countries[match[1]]?.[match[2]])return Response.json({error:'此地区暂未收录该级边界，请保留原始标点并查看覆盖说明。'},{status:404,headers});
 const metadata=catalog.countries[match[1]][match[2]],file=new URL(match[1]+'-'+match[2]+'.json.gz',directory);
 try{return await publicFileResponse(request,file,{sha256:metadata.sha256,mime:'application/json; charset=utf-8',headers:{...headers,'Content-Encoding':'gzip'}})}
 catch{return Response.json({error:'本地分区文件缺失或校验失败，请重新安装完整地图更新包。'},{status:503,headers:{...headers,'Cache-Control':'no-store'}})}
}
