import {createReadStream,createWriteStream} from 'node:fs';
import {access,readFile,rename,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createGunzip} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {basename,join,resolve} from 'node:path';

const source=fileURLToPath(new URL('.',import.meta.url));
const exists=path=>access(path).then(()=>true,()=>false);

export async function prepareWorldFlora(directory=source){
 const target=join(directory,'world-flora.sqlite');
 const packed=join(source,'world-flora.sqlite.gz');
 if(!await exists(packed)){
  if(await exists(target))return;
  throw Error('World Flora source archive is missing');
 }
 const expected=JSON.parse(await readFile(join(source,'world-flora.json'),'utf8')).sha256;
 if(await exists(target)){
  const existing=createHash('sha256');
  for await(const chunk of createReadStream(target))existing.update(chunk);
  if(existing.digest('hex')===expected)return;
 }
 const temporary=join(directory,basename(target)+'.'+randomUUID()+'.tmp');
 const digest=createHash('sha256');
 try{
  await pipeline(createReadStream(packed),createGunzip(),new Transform({
   transform(chunk,_encoding,callback){digest.update(chunk);callback(null,chunk)},
  }),createWriteStream(temporary,{flags:'wx'}));
  if(digest.digest('hex')!==expected)throw Error('World Flora index checksum mismatch');
  await rename(temporary,target);
 }finally{await rm(temporary,{force:true})}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await prepareWorldFlora();
