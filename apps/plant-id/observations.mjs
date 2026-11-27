import {randomUUID} from 'node:crypto';
import {findKnowledge} from './knowledge.mjs';

const normalize=name=>name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');

export function observationSubject(name,rank,label,thread){
 const entry=findKnowledge(name,rank);
 const sharedKey=entry?`${entry.rank}:${normalize(entry.name)}`:'';
 return {key:sharedKey||(name?'name:'+normalize(name):'record:'+thread),
  label:label||entry?.name||name||'未确定的植物',canShare:Boolean(sharedKey)};
}

export function createObservations(sql,now){
 sql.exec(`CREATE TABLE IF NOT EXISTS plant_observations(
  id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL, label TEXT NOT NULL, note TEXT NOT NULL,
  shared INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, UNIQUE(owner,subject,note)
 );
 CREATE INDEX IF NOT EXISTS plant_observations_shared ON plant_observations(subject,created DESC) WHERE shared=1;`);
 // Keep the legacy rows available to the previous program during a rollback.
 const copy=sql.prepare('INSERT OR IGNORE INTO plant_observations VALUES (?,?,?,?,?,0,?)');
 sql.exec('BEGIN IMMEDIATE');
 try{
  const before=sql.prepare(`SELECT legacy.* FROM care_notes legacy LEFT JOIN plant_observations archive ON archive.id=legacy.id
   WHERE archive.id IS NULL ORDER BY legacy.created,legacy.id`);
  for(const row of before.iterate()){
   const subject=observationSubject(row.subject,'','',row.thread);
   copy.run(row.id,row.owner,subject.key,subject.label,row.note,row.created);
  }
  sql.exec('COMMIT');
 }catch(error){sql.exec('ROLLBACK');throw error}

 const list=sql.prepare('SELECT id,note,shared,created FROM plant_observations WHERE owner=? AND subject=? ORDER BY created DESC,id');
 const all=sql.prepare('SELECT id,label,note,shared,created FROM plant_observations WHERE owner=? ORDER BY created DESC,id LIMIT 240');
 const find=sql.prepare('SELECT id,shared FROM plant_observations WHERE owner=? AND subject=? AND note=?');
 const promote=sql.prepare('UPDATE plant_observations SET shared=1 WHERE owner=? AND id=?');
 const add=sql.prepare(`INSERT INTO plant_observations(id,owner,subject,label,note,shared,created)
  SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM plant_observations WHERE owner=? AND subject=?)<12
  AND (SELECT count(*) FROM plant_observations WHERE owner=?)<240`);
 const get=sql.prepare('SELECT subject,note FROM plant_observations WHERE owner=? AND id=?');
 const remove=sql.prepare('DELETE FROM plant_observations WHERE owner=? AND id=?');
 const legacyNotes=sql.prepare('SELECT id,subject,thread FROM care_notes WHERE owner=? AND note=?');
 const removeLegacy=sql.prepare('DELETE FROM care_notes WHERE id=?');
 const shared=sql.prepare(`SELECT note FROM plant_observations WHERE subject=? AND shared=1 AND owner<>?
  GROUP BY note ORDER BY max(created) DESC,note LIMIT 6`);
 return {
  list:(owner,key)=>list.all(owner,key),
  all:owner=>all.all(owner),
  save(owner,subject,note,publish){
   const existing=find.get(owner,subject.key,note);
   if(existing){
    if(publish&&!existing.shared)promote.run(owner,existing.id);
    return true;
   }
   return Boolean(add.run(randomUUID(),owner,subject.key,subject.label,note,Number(publish),now(),owner,subject.key,owner).changes);
  },
  remove(owner,id,key){
   const row=get.get(owner,id);
   if(!row||(key&&row.subject!==key))return false;
   sql.exec('BEGIN IMMEDIATE');
   try{
    // Delete equivalent legacy copies so a later upgrade cannot restore a withdrawn observation.
    for(const old of legacyNotes.all(owner,row.note)){
     if(observationSubject(old.subject,'','',old.thread).key===row.subject)removeLegacy.run(old.id);
    }
    remove.run(owner,id);
    sql.exec('COMMIT');
    return true;
   }catch(error){sql.exec('ROLLBACK');throw error}
  },
  shared:(owner,subject)=>subject.canShare?shared.all(subject.key,owner).map(row=>row.note):[],
 };
}
