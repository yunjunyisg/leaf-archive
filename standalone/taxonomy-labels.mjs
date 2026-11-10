import {randomUUID} from 'node:crypto';
import {pathKey,storagePathKey,taxonomySystem,taxonomySystems,buildTree,bilingualNames,ranks} from '../dist/server/index.js';
const keys=[...new Set(['taxonomyPaths','taxonomyDetached','name','latin','identification','infraspecific',...ranks.map(r=>r.key)])];
const projection='SELECT json_extract(data,'+keys.map(key=>"'$."+key+"'").join(',')+') AS fields FROM plants WHERE owner=?';
// Only explicitly completed labels become shared node metadata. Ordinary plant
// names remain implicit and disappear with their last record as before.
function labelPlans(sql,owner,value,table){
 const paths=table==='plants'?value.taxonomyPaths:value.path?{[taxonomySystem(value.system)]:value.path}:null;
 if(!paths)return [];
 const plants=sql.prepare(projection).all(owner).map(row=>{const values=JSON.parse(row.fields);return Object.fromEntries(keys.map((key,i)=>[key,values[i]]))}),rows=sql.prepare("SELECT id,json_extract(data,'$.system') AS system,json_extract(data,'$.path') AS path FROM taxa WHERE owner=?").all(owner);
 const taxa=rows.map(row=>({system:taxonomySystem(row.system),path:JSON.parse(row.path)})),plans=[];
 for(const {key:system}of taxonomySystems){
  const tree=buildTree(plants,taxa,system);
  for(const [index,part]of (paths[system]||[]).entries()){
   const path=paths[system].slice(0,index+1),key=pathKey(path),node=tree.nodes.get(key);if(!node)continue;
   const known=bilingualNames(node),added=['nameZh','nameEn'].some(language=>part[language]&&!known[language]);if(!added)continue;
   const existing=rows.filter(row=>taxonomySystem(row.system)===system&&pathKey(JSON.parse(row.path))===key);if(existing.length>1)throw Object.assign(Error('已有重复分类节点，请在分类树核对'),{status:409});
   plans.push({system,path,existing:existing[0]});
  }
 }return plans;
}
function rememberLabels(sql,owner,plans,table,targetId){
 for(const {system,path,existing}of plans){
  if(existing){
   if(table==='taxa'&&existing.id===targetId)continue;
   sql.prepare("UPDATE taxa SET data=json_set(data,'$.path',json(?),'$.system',?,'$._revision',?) WHERE id=? AND owner=?").run(JSON.stringify(path),system,randomUUID(),existing.id,owner);
  }else{
   const id=randomUUID(),data={path,system,references:[],_revision:randomUUID()};sql.prepare('INSERT INTO taxa (id,owner,path_key,data,created) VALUES (?,?,?,?,?)').run(id,owner,storagePathKey(path,system),JSON.stringify(data),new Date().toISOString());
  }
 }
}
export function classificationWriteDatabase(database,owner){
 const {DB,sql}=database;
 return {prepare(query){const prepared=DB.prepare(query);return {...prepared,bind(...values){const bound=prepared.bind(...values);
  const insert=/^INSERT INTO (plants|taxa) /i.exec(query),updatePlant=/^UPDATE plants SET number = /i.test(query),updateTaxon=/^UPDATE taxa SET data = /i.test(query);
  if(!insert&&!updatePlant&&!updateTaxon)return bound;
  const table=insert?insert[1].toLowerCase():updatePlant?'plants':'taxa',id=values[insert?0:updatePlant?2:1],payload=values[insert?3:updatePlant?1:0];
  return {...bound,async run(){
   sql.exec('SAVEPOINT classification_labels');
   try{const plans=labelPlans(sql,owner,JSON.parse(payload),table),result=sql.prepare(query).run(...values);if(Number(result.changes))rememberLabels(sql,owner,plans,table,id);sql.exec('RELEASE classification_labels');return {meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}
   catch(error){sql.exec('ROLLBACK TO classification_labels');sql.exec('RELEASE classification_labels');throw error}
  }};
 }}}};
}
