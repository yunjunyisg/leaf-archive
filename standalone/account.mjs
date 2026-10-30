import {createInterface} from 'node:readline/promises';
import {randomUUID} from 'node:crypto';
import {openDatabase} from './storage.mjs';
import {setAccount} from './local-auth.mjs';
function hidden(question){
 if(!process.stdin.isTTY)throw Error('请在交互终端运行，密码不会回显');
 process.stdout.write(question);process.stdin.setRawMode(true);process.stdin.resume();
 return new Promise((resolve,reject)=>{let value='';const read=chunk=>{for(const c of chunk.toString()){
  if(c==='\r'||c==='\n'){end();resolve(value);return}
  if(c==='\u0003'){end();reject(Error('已取消'));return}
  if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else if(c>=' ')value+=c;
 }};function end(){process.stdin.off('data',read);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n')}process.stdin.on('data',read)});
}
process.umask(0o077);const db=openDatabase(process.env.LEAF_DATA_DIR||'/var/lib/leaf-archive');
try{
 const owners=db.sql.prepare('SELECT owner,count(*) AS plants FROM plants GROUP BY owner UNION SELECT owner,0 AS plants FROM taxa WHERE owner NOT IN (SELECT owner FROM plants) GROUP BY owner').all();
 const rl=createInterface({input:process.stdin,output:process.stdout});
 const username=(await rl.question('网站登录账号（3 至 64 位英文或数字）：')).trim();let owner;
 if(owners.length){
  console.log('请选择要绑定的原档案账号：');owners.forEach((o,i)=>console.log((i+1)+'. '+o.owner+' · '+o.plants+' 株植物'));
  const answer=await rl.question('输入序号；如要建立全新空账号，输入 new：');
  if(answer==='new')owner='local:'+randomUUID();else{const i=Number(answer)-1;if(!Number.isInteger(i)||!owners[i])throw Error('归属选择无效');owner=owners[i].owner}
 }else owner='local:'+randomUUID();
 rl.close();const password=await hidden('设置网站密码（至少 6 个字符，不显示）：'),again=await hidden('再次输入：');if(password!==again)throw Error('两次密码不一致');
 await setAccount(db.sql,{username,password,owner});console.log('网站账号已配置，未更改原档案归属。');
}finally{db.close()}
