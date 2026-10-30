import {randomUUID} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {pathToFileURL} from 'node:url';
import {passwordRecord} from './local-auth.mjs';
import {openDatabase} from './storage.mjs';
import {isAdmin} from './access.mjs';
export async function provisionAdmin(sql,{username,password}){
 if(!/^[A-Za-z0-9_.-]{3,64}$/.test(username))throw Error('管理员账号格式无效');
 const p=await passwordRecord(password);sql.exec('BEGIN IMMEDIATE');try{
  const current=sql.prepare('SELECT username,owner FROM local_accounts WHERE username=? COLLATE NOCASE').get(username);
  if(current&&!isAdmin(sql,current.owner))throw Error('该账号已存在且不是管理员，已停止；原账号、密码和档案未被更改。');
  const owner=current?.owner||'admin:'+randomUUID(),name=current?.username||username;
  sql.prepare('INSERT INTO local_accounts VALUES (?,?,?,?,?) ON CONFLICT(username) DO UPDATE SET salt=excluded.salt,password_hash=excluded.password_hash').run(name,owner,'管理员',p.salt,p.password_hash);
  sql.prepare('INSERT OR IGNORE INTO local_admins VALUES (?,?)').run(owner,Date.now());
  sql.prepare('DELETE FROM auth_sessions WHERE owner=?').run(owner);
  if(!current)sql.prepare('INSERT INTO account_activity(owner,registered_at) VALUES (?,?)').run(owner,Date.now());sql.exec('COMMIT');return {username:name,owner};
 }catch(e){sql.exec('ROLLBACK');throw e}
}
function hidden(question){
 if(!process.stdin.isTTY)throw Error('请在交互终端运行，密码不会回显');
 process.stdout.write(question);process.stdin.setRawMode(true);process.stdin.resume();
 return new Promise((resolve,reject)=>{let value='';const read=chunk=>{for(const c of chunk.toString()){
  if(c==='\r'||c==='\n'){end();resolve(value);return}if(c==='\u0003'){end();reject(Error('已取消'));return}
  if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else if(c>=' ')value+=c;
 }};function end(){process.stdin.off('data',read);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n')}process.stdin.on('data',read)});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 process.umask(0o077);let db;
 try{
  const rl=createInterface({input:process.stdin,output:process.stdout});const username=(await rl.question('管理员账号：')).trim();rl.close();
  const password=await hidden('管理员密码（不显示）：'),confirmation=await hidden('再次输入密码：');if(password!==confirmation)throw Error('两次密码不一致');
  db=openDatabase(process.env.LEAF_DATA_DIR||'/var/lib/leaf-archive');const result=await provisionAdmin(db.sql,{username,password});
  console.log('管理员账号已配置。');console.log('登录后将进入管理后台：https://gloriouscarnivorousplants.top/admin');
 }catch(e){console.error(e.message);process.exitCode=1}finally{db?.close()}
}
