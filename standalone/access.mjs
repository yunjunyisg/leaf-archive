import {createHash} from 'node:crypto';
export function ensureAccessSchema(sql){
 sql.exec(`CREATE TABLE IF NOT EXISTS local_admins (owner TEXT PRIMARY KEY REFERENCES local_accounts(owner) ON DELETE CASCADE, granted_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS account_activity (owner TEXT PRIMARY KEY, registered_at INTEGER, last_login INTEGER, last_seen INTEGER);
 CREATE TABLE IF NOT EXISTS activity_days (owner TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY(owner,day));
 CREATE INDEX IF NOT EXISTS activity_days_day ON activity_days(day);
 CREATE TABLE IF NOT EXISTS account_security (owner TEXT PRIMARY KEY REFERENCES local_accounts(owner) ON DELETE CASCADE, disabled INTEGER NOT NULL DEFAULT 0, must_change INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS admin_audit (id INTEGER PRIMARY KEY, actor TEXT NOT NULL, target TEXT NOT NULL, action TEXT NOT NULL, created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS deleted_owners (owner TEXT PRIMARY KEY, deleted_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS account_objects (key TEXT PRIMARY KEY, owner TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS object_deletions (key TEXT PRIMARY KEY);
 CREATE TABLE IF NOT EXISTS activity_meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);`);
 for(const table of ['plants','taxa','images','auth_sessions','local_accounts','wechat_identities','account_activity','activity_days']){
  for(const operation of ['INSERT','UPDATE'])sql.exec(`CREATE TRIGGER IF NOT EXISTS deleted_owner_${table}_${operation} BEFORE ${operation} ON ${table} WHEN EXISTS(SELECT 1 FROM deleted_owners WHERE owner=NEW.owner) BEGIN SELECT RAISE(ABORT,'account deleted'); END;`);
 }

}
export const dayInChina=(now=Date.now())=>new Date(now+8*3600000).toISOString().slice(0,10);
export function sessionAccount(sql,request){
 const cookie=request.headers.get('Cookie')||'',token=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-leaf-session='))?.slice('__Host-leaf-session='.length);
 if(!/^[a-f0-9]{64}$/.test(token||''))return null;
 return sql.prepare('SELECT s.owner,s.nickname FROM auth_sessions s LEFT JOIN account_security a ON a.owner=s.owner WHERE token_hash=? AND expires>? AND COALESCE(a.disabled,0)=0').get(createHash('sha256').update(token).digest('hex'),Date.now())||null;
}
export function isAdmin(sql,owner){return Boolean(owner&&sql.prepare('SELECT owner FROM local_admins WHERE owner=?').get(owner));}
export function recordActivity(sql,owner,{registered=false,login=false,now=Date.now()}={}){
 if(sql.prepare('SELECT 1 FROM deleted_owners WHERE owner=?').get(owner))return;
 sql.prepare('INSERT INTO activity_meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=min(value,excluded.value)').run('started_at',now);
 const old=sql.prepare('SELECT last_seen FROM account_activity WHERE owner=?').get(owner);
 if(!registered&&!login&&old?.last_seen>now-60000&&dayInChina(old.last_seen)===dayInChina(now))return;
 sql.prepare(`INSERT INTO account_activity(owner,registered_at,last_login,last_seen) VALUES (?,?,?,?)
 ON CONFLICT(owner) DO UPDATE SET registered_at=COALESCE(account_activity.registered_at,excluded.registered_at),last_login=COALESCE(excluded.last_login,account_activity.last_login),last_seen=excluded.last_seen`).run(owner,registered?now:null,login?now:null,now);
 sql.prepare('INSERT OR IGNORE INTO activity_days(owner,day) VALUES (?,?)').run(owner,dayInChina(now));
}

export function accountSecurity(sql,owner){return sql.prepare('SELECT disabled,must_change FROM account_security WHERE owner=?').get(owner)||{disabled:0,must_change:0};}
