import {ensureAccessSchema} from './access.mjs';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export function openDatabase(directory,{migrations=new URL('../drizzle/',import.meta.url)}={}){
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const filename=path.join(directory,'archive.sqlite');const sql=new DatabaseSync(filename);fs.chmodSync(filename,0o600);
 sql.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 sql.exec('CREATE TABLE IF NOT EXISTS standalone_migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL)');
 for(const name of fs.readdirSync(migrations).filter(n=>n.endsWith('.sql')).sort()){
  const text=fs.readFileSync(new URL(name,new URL(migrations,'file:///')),'utf8'),hash=createHash('sha256').update(text).digest('hex');
  const saved=sql.prepare('SELECT hash FROM standalone_migrations WHERE name=?').get(name);
  if(saved){if(saved.hash!==hash)throw Error('Previously applied migration changed: '+name);continue;}
  sql.exec('BEGIN IMMEDIATE');try{sql.exec(text);sql.prepare('INSERT INTO standalone_migrations VALUES (?,?)').run(name,hash);sql.exec('COMMIT')}catch(e){sql.exec('ROLLBACK');sql.close();throw e}
 }
 sql.exec('CREATE TABLE IF NOT EXISTS local_accounts (username TEXT PRIMARY KEY, owner TEXT NOT NULL UNIQUE, nickname TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL); CREATE TABLE IF NOT EXISTS local_login_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires INTEGER NOT NULL)');
 ensureAccessSchema(sql);
 const DB={prepare(query){const statement=sql.prepare(query);const bind=(...args)=>({async all(){return {results:statement.all(...args)}},async first(){return statement.get(...args)||null},async run(){const r=statement.run(...args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}}});return {bind,...bind()}}};
 return {sql,DB,close:()=>sql.close()};
}
export function diskBucket(directory){
 const root=path.resolve(directory),file=key=>path.join(root,createHash('sha256').update(key).digest('hex'));
 return {async put(key,data){await mkdir(root,{recursive:true,mode:0o700});const target=file(key),temp=target+'.'+randomUUID()+'.tmp';try{await writeFile(temp,new Uint8Array(data),{mode:0o600,flag:'wx'});await rename(temp,target)}finally{await unlink(temp).catch(()=>{})}},async get(key){try{return {body:await readFile(file(key))}}catch(e){if(e.code==='ENOENT')return null;throw e}}};
}
