import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {openDatabase,diskBucket} from './storage.mjs';
const columns={plants:['id','owner','number','data','created'],taxa:['id','owner','path_key','data','created'],images:['id','owner','mime'],wechat_identities:['identity_hash','owner','union_id']};
const digest=data=>createHash('sha256').update(data).digest('hex');
export async function importSnapshot({sql,bucket,directory,sourceProjectId='appgprj_6ac08e02db408191a652b1bc36ea38cd'}){
 const snapshot=JSON.parse(await fs.readFile(path.join(directory,'database.json'),'utf8'));
 if(snapshot.sourceProjectId!==sourceProjectId)throw Error('备份来源网站不匹配');
 for(const [table,fields] of Object.entries(columns)){
  const entry=snapshot.tables?.[table];if(!Array.isArray(entry?.rows)||!fields.every(f=>entry.columns?.includes(f)))throw Error('备份缺少表或列：'+table);
  if(sql.prepare('SELECT count(*) AS n FROM '+table).get().n)throw Error('目标数据库已有数据，拒绝覆盖：'+table);
  for(const row of entry.rows)if(!fields.every(f=>Object.hasOwn(row,f)))throw Error('备份行缺少列：'+table);
 }
 if(sql.prepare('SELECT count(*) AS n FROM local_accounts').get().n)throw Error('请先导入备份，再绑定网站账号');
 const objects=JSON.parse(await fs.readFile(path.join(directory,'objects.json'),'utf8'));
 if(!Array.isArray(objects))throw Error('图片对象清单无效');
 const manifest=new Map(objects.map(o=>[o.key,o]));
 if(manifest.size!==objects.length)throw Error('图片清单含重复对象');
 const images=snapshot.tables.images.rows,expected=new Set(images.map(i=>i.owner+'/'+i.id));
 if(manifest.size!==expected.size||[...manifest.keys()].some(key=>!expected.has(key)))throw Error('图片清单与数据库不一致');
 const uploads=[];
 for(const row of images){
  const key=row.owner+'/'+row.id,entry=manifest.get(key);
  if(!entry||!/^[a-f0-9]{64}$/.test(entry.sha256)||!Number.isSafeInteger(entry.size)||entry.size<1||entry.size>8*1024*1024)throw Error('图片对象未完整导出');
  const bytes=await fs.readFile(path.join(directory,'objects',digest(key)));
  if(bytes.length!==entry.size||digest(bytes)!==entry.sha256)throw Error('图片大小或 SHA256 校验失败');
  uploads.push({key,file:path.join(directory,'objects',digest(key)),sha256:entry.sha256});
 }
 // Never make records visible before every object has been verified and stored.
 for(const o of uploads){const bytes=await fs.readFile(o.file);if(digest(bytes)!==o.sha256)throw Error('图片在校验后发生变化');await bucket.put(o.key,bytes);}
 sql.exec('BEGIN IMMEDIATE');try{
  for(const [table,fields] of Object.entries(columns)){
   const insert=sql.prepare('INSERT INTO '+table+' ('+fields.join(',')+') VALUES ('+fields.map(()=>'?').join(',')+')');
   for(const row of snapshot.tables[table].rows)insert.run(...fields.map(f=>row[f]));
  }
  sql.exec('COMMIT');
 }catch(e){sql.exec('ROLLBACK');throw e}
 return Object.fromEntries(Object.keys(columns).map(t=>[t,snapshot.tables[t].rows.length]));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 process.umask(0o077);if(!process.argv[2])throw Error('用法：node standalone/import.mjs /非网站公开目录/完整备份');
 const directory=process.env.LEAF_DATA_DIR||'/var/lib/leaf-archive',db=openDatabase(directory);
 try{console.log(await importSnapshot({sql:db.sql,bucket:diskBucket(path.join(directory,'objects')),directory:process.argv[2]}))}finally{db.close()}
}
