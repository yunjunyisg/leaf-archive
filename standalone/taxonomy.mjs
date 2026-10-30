import {createHash,randomUUID} from 'node:crypto';
import {validPath,pathKey,plantPath,buildTree,detachClassification,applyClassificationPath} from '../dist/server/index.js';
import {sessionAccount,isAdmin} from './access.mjs';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json=(data,status=200)=>Response.json(data,{status,headers});
const prefix=(path,head)=>path.length>=head.length&&head.every((p,i)=>path[i].rank===p.rank&&path[i].name===p.name);
function snapshot(sql,owner){
 const plants=sql.prepare('SELECT id,data FROM plants WHERE owner=? ORDER BY id').all(owner),taxa=sql.prepare('SELECT id,data FROM taxa WHERE owner=? ORDER BY id').all(owner);
 const revision=createHash('sha256').update(JSON.stringify([plants,taxa])).digest('hex');
 return {plants:plants.map(r=>({...r,value:JSON.parse(r.data)})),taxa:taxa.map(r=>({...r,value:JSON.parse(r.data)})),revision};
}
function branch(state,path){return {plants:state.plants.filter(r=>prefix(plantPath(r.value),path)),taxa:state.taxa.filter(r=>prefix(r.value.path,path))}}
const fail=(message,status=400)=>Object.assign(Error(message),{status});
export async function taxonomyRoutes(request,{sql,session}){
 const url=new URL(request.url);if(url.pathname!=='/api/taxonomy/branch')return null;
 if(!session)return json({error:'请先登录'},401);if(isAdmin(sql,session.owner))return json({error:'管理员不提供个人分类编辑'},403);
 if(request.method==='GET'){
  let path;try{path=validPath(JSON.parse(url.searchParams.get('path')||'null'))}catch{return json({error:'分类路径无效'},400)}
  const state=snapshot(sql,session.owner),found=branch(state,path),tree=buildTree(state.plants.map(r=>r.value),state.taxa.map(r=>r.value));
  if(!tree.nodes.has(pathKey(path)))return json({error:'分类不存在，请刷新分类树'},404);
  const selected=found.taxa.find(r=>pathKey(r.value.path)===pathKey(path));
  return json({revision:state.revision,plantCount:found.plants.length,taxonCount:found.taxa.length,nodeCount:[...tree.nodes.values()].filter(n=>prefix(n.path,path)).length,references:selected?.value.references||[]});
 }
 if(!['PUT','DELETE'].includes(request.method))return json({error:'不支持此操作'},405);
 if(request.headers.get('Origin')!==url.origin)return json({error:'请求来源无效'},403);
 const text=await request.text();if(text.length>1024*1024)return json({error:'分类内容过长'},413);
 let input,oldPath,newPath;try{input=JSON.parse(text);oldPath=validPath(input.path);if(request.method==='PUT')newPath=validPath(input.newPath)}catch{return json({error:'分类路径无效'},400)}
 if(!request.headers.get('If-Match'))return json({error:'请重新打开分类后操作'},428);
 if(request.method==='DELETE'&&input.confirmation!=='删除分类')return json({error:'请明确确认删除分类及其下级'},400);
 sql.exec('BEGIN IMMEDIATE');try{
  if(sessionAccount(sql,request)?.owner!==session.owner)throw fail('登录已失效',401);
  const state=snapshot(sql,session.owner),tree=buildTree(state.plants.map(r=>r.value),state.taxa.map(r=>r.value)),oldKey=pathKey(oldPath),found=branch(state,oldPath);
  if(request.headers.get('If-Match')!=='"'+state.revision+'"')throw fail('分类或档案已在其他设备更新，请刷新后重新编辑',409);
  if(!tree.nodes.has(oldKey))throw fail('分类不存在，请刷新分类树',404);
  if(request.method==='DELETE'){
   for(const row of found.taxa)sql.prepare('DELETE FROM taxa WHERE id=? AND owner=?').run(row.id,session.owner);
   for(const row of found.plants){const next={...detachClassification(row.value),_revision:randomUUID()};sql.prepare('UPDATE plants SET data=? WHERE id=? AND owner=?').run(JSON.stringify(next),row.id,session.owner)}
  }else{
   const newKey=pathKey(newPath),changed=newKey!==oldKey;
   if(changed&&prefix(newPath,oldPath))throw fail('不能把分类移到自己的下级');
   if(changed&&tree.nodes.has(newKey))throw fail('目标分类已存在，请选择其他名称或上级',409);
   const refs=input.references;
   if(!Array.isArray(refs)||!refs.every(x=>typeof x==='string'&&/^\/(images\/[a-f0-9-]+|assets\/[A-Za-z0-9_]+\.jpg)$/.test(x)))throw fail('参考图无效');
   if(refs.length&&!['species','hybrid','unresolved','variety','form','aff','cf'].includes(newPath.at(-1).rank))throw fail('仅种级及以下分类可导入参考图');
   for(const ref of refs.filter(x=>x.startsWith('/images/')))if(!sql.prepare('SELECT id FROM images WHERE owner=? AND id=?').get(session.owner,ref.split('/').pop()))throw fail('参考图不存在或不属于当前账号');
   const plans=[];
   for(const row of found.taxa){let path;try{path=validPath([...newPath,...row.value.path.slice(oldPath.length)])}catch{throw fail('下级分类与新层级不兼容，请先处理下级分类')}
    const selected=pathKey(row.value.path)===oldKey,next={...row.value,path,references:selected?[...new Set(refs)]:row.value.references};
    if(changed||selected)plans.push({row,next:{...next,_revision:randomUUID()}});
   }
   const plantPlans=[];
   if(changed)for(const row of found.plants){let path;try{path=validPath([...newPath,...plantPath(row.value).slice(oldPath.length)])}catch{throw fail('关联植物的种下分类与新层级不兼容，请先编辑这些植物')}
    plantPlans.push({row,next:{...applyClassificationPath(row.value,path),_revision:randomUUID()}});
   }
   for(const {row,next} of plans)sql.prepare('UPDATE taxa SET path_key=?,data=? WHERE id=? AND owner=?').run(pathKey(next.path),JSON.stringify(next),row.id,session.owner);
   if(!found.taxa.some(r=>pathKey(r.value.path)===oldKey)){
    const id=randomUUID(),value={path:newPath,references:[...new Set(refs)],_revision:randomUUID()};sql.prepare('INSERT INTO taxa VALUES (?,?,?,?,?)').run(id,session.owner,newKey,JSON.stringify(value),new Date().toISOString());
   }
   for(const {row,next} of plantPlans)sql.prepare('UPDATE plants SET data=? WHERE id=? AND owner=?').run(JSON.stringify(next),row.id,session.owner);
  }
  const latest=snapshot(sql,session.owner);
  const response=json({plants:latest.plants.map(r=>({id:r.id,...r.value})),taxa:latest.taxa.map(r=>({id:r.id,...r.value})),plantCount:found.plants.length,taxonCount:found.taxa.length});sql.exec('COMMIT');return response;
 }catch(error){sql.exec('ROLLBACK');return json({error:error.status?error.message:'分类修改失败，未更改任何数据'},error.status||500)}
}
