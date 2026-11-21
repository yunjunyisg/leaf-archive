import {createCipheriv,createDecipheriv,randomBytes,randomUUID} from 'node:crypto';
import {linkSync,readFileSync,unlinkSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

export function createAskCredentials(sql,dataDirectory){
 const keyPath=join(dataDirectory,'ask-credentials.key');
 let encryptionKey;
 function key(create=false){
  if(encryptionKey)return encryptionKey;
  try{encryptionKey=readFileSync(keyPath)}
  catch(error){
   if(!create||error.code!=='ENOENT')throw error;
   const temporary=join(dataDirectory,'.ask-credentials-'+randomUUID());
   writeFileSync(temporary,randomBytes(32),{mode:0o600,flag:'wx'});
   try{linkSync(temporary,keyPath)}
   catch(linkError){if(linkError.code!=='EEXIST')throw linkError}
   finally{unlinkSync(temporary)}
   encryptionKey=readFileSync(keyPath);
  }
  return encryptionKey;
 }

 const find=sql.prepare('SELECT sealed FROM ask_credentials WHERE owner=? AND provider=?');
 const list=sql.prepare('SELECT provider FROM ask_credentials WHERE owner=?');
 const upsert=sql.prepare(`INSERT INTO ask_credentials(owner,provider,sealed) VALUES (?,?,?)
  ON CONFLICT(owner,provider) DO UPDATE SET sealed=excluded.sealed`);
 const remove=sql.prepare('DELETE FROM ask_credentials WHERE owner=? AND provider=? AND sealed=?');
 const context=(owner,route)=>Buffer.from(JSON.stringify([owner,route.id,route.baseURL||'deepseek-official']));

 return {
  list(owner){return list.all(owner).map(row=>row.provider)},
  find(owner,route){return find.get(owner,route.id)?.sealed},
  open(owner,route,sealed){
   const value=Buffer.from(sealed),nonce=value.subarray(0,12);
   const decipher=createDecipheriv('aes-256-gcm',key(),nonce);
   decipher.setAAD(context(owner,route));
   decipher.setAuthTag(value.subarray(12,28));
   return Buffer.concat([decipher.update(value.subarray(28)),decipher.final()]).toString('utf8');
  },
  save(owner,route,apiKey){
   const nonce=randomBytes(12);
   const cipher=createCipheriv('aes-256-gcm',key(true),nonce);
   cipher.setAAD(context(owner,route));
   const encrypted=Buffer.concat([cipher.update(apiKey,'utf8'),cipher.final()]);
   upsert.run(owner,route.id,Buffer.concat([nonce,cipher.getAuthTag(),encrypted]));
  },
  remove(owner,route,sealed){remove.run(owner,route.id,sealed)},
 };
}
