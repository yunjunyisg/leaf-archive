// Disabled by default. Short-lived, secret-authenticated export for a verified server migration.
export async function migrationPhoto(request,env){
 const match=/^\/api\/migration-photos\/([a-f0-9-]{36})$/.exec(new URL(request.url).pathname);
 if(!match)return null;
 const deny=()=>new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}}),now=Date.now(),expiry=Number(env.LEAF_EXPORT_EXPIRES);
 if(request.method!=='GET'||!env.LEAF_EXPORT_SHA256||!Number.isFinite(expiry)||expiry<=now||expiry>now+30*60000)return deny();
 const token=request.headers.get('X-Leaf-Export-Key')||'';
 if(!/^[a-f0-9]{64}$/.test(token)||!/^[a-f0-9]{64}$/.test(env.LEAF_EXPORT_SHA256))return deny();
 const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
 let mismatch=0;for(let i=0;i<64;i++)mismatch|=actual.charCodeAt(i)^env.LEAF_EXPORT_SHA256.charCodeAt(i);if(mismatch)return deny();
 let owners;try{owners=JSON.parse(env.LEAF_EXPORT_OWNERS)}catch{return deny()}
 if(!Array.isArray(owners)||!owners.length||!owners.every(x=>typeof x==='string'))return deny();
 const row=await env.DB.prepare('SELECT owner, mime FROM images WHERE id = ?').bind(match[1]).first();
 if(!row||!owners.includes(row.owner))return deny();
 const object=await env.BUCKET.get(row.owner+'/'+match[1]);if(!object)return deny();
 return new Response(object.body,{headers:{'Content-Type':row.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
