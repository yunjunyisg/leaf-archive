// Public, account-independent resources only. Personal records and photos never use this cache.
const versions=new Map();
export async function publicAsset(request,content,mime,binary=false){
 const path=new URL(request.url).pathname;
 let entry=versions.get(path);
 if(!entry){
  const promise=crypto.subtle.digest('SHA-256',new TextEncoder().encode(content)).then(hash=>'"'+Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('')+'"');
  entry={promise};versions.set(path,entry);
 }
 const etag=await entry.promise;
 const headers={'Content-Type':mime,'Cache-Control':binary?'public, max-age=86400':'public, max-age=0, must-revalidate','ETag':etag,'X-Content-Type-Options':'nosniff'};
 const validators=(request.headers.get('If-None-Match')||'').split(',').map(x=>x.trim().replace(/^W\//,''));
 if(validators.includes('*')||validators.includes(etag))return new Response(null,{status:304,headers});
 if(request.method==='HEAD')return new Response(null,{headers});
 if(!binary)return new Response(content,{headers});
 const decoded=atob(content.startsWith('data:')?content.slice(content.indexOf(',')+1):content),bytes=new Uint8Array(decoded.length);
 for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
 return new Response(bytes,{headers});
}
