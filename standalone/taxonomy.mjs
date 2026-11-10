import {createHash,randomUUID} from 'node:crypto';
import {validPath,pathKey,plantPath,buildTree,detachClassification,applyClassificationPath,taxonomySystem,storagePathKey,canonicalPath,referenceRank} from '../dist/server/index.js';
import {sessionAccount,isAdmin} from './access.mjs';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json=(data,status=200)=>Response.json(data,{status,headers});
const prefix=(path,head)=>path.length>=head.length&&head.every((p,i)=>path[i].rank===p.rank&&path[i].name===p.name);
function snapshot(sql,owner){
 const plants=sql.prepare('SELECT id,data FROM plants WHERE owner=? ORDER BY id').all(owner),taxa=sql.prepare('SELECT id,data FROM taxa WHERE owner=? ORDER BY id').all(owner);
 const revision=createHash('sha256').update(JSON.stringify([plants,taxa])).digest('hex');
 return {plants:plants.map(r=>({...r,value:JSON.parse(r.data)})),taxa:taxa.map(r=>({...r,value:JSON.parse(r.data)})),revision};
}
function branch(state,path,system){return {plants:state.plants.filter(r=>prefix(plantPath(r.value,system),path)),taxa:state.taxa.filter(r=>taxonomySystem(r.value.system)===system&&prefix(r.value.path,path))}}
const fail=(message,status=400)=>Object.assign(Error(message),{status});
export async function taxonomyRoutes(request,{sql,session}){
 const url=new URL(request.url);let system;try{system=taxonomySystem(url.searchParams.get('system')??undefined)}catch{return json({error:'分类体系无效'},400)}if(!['/api/taxonomy/branch','/api/taxonomy/assign'].includes(url.pathname))return null;
 if(!session)return json({error:'请先登录'},401);if(isAdmin(sql,session.owner))return json({error:'管理员不提供个人分类编辑'},403);
 if(url.pathname==='/api/taxonomy/assign'){
  if(request.method!=='POST')return json({error:'此操作需要提交归类选择'},405);
  if(request.headers.get('Origin')!==url.origin)return json({error:'请求来源无效'},403);
  const text=await request.text();if(text.length>1024*1024)return json({error:'分类内容过长'},413);
  let input,path;try{input=JSON.parse(text);system=taxonomySystem(input.system);path=validPath(input.path,input.system);if(typeof input.plantId!=='string'||!input.plantId||input.plantId.length>200)throw Error()}catch{return json({error:'请选择植物和有效的目标分支'},400)}
  if(!request.headers.get('If-Match')||typeof input.plantRevision!=='string'||!input.plantRevision)return json({error:'请刷新植物与分类后重新选择'},428);
  sql.exec('BEGIN IMMEDIATE');try{
   if(sessionAccount(sql,request)?.owner!==session.owner)throw fail('登录已失效',401);
   const state=snapshot(sql,session.owner),row=state.plants.find(r=>r.id===input.plantId);
   if(!row)throw fail('植物不存在或不属于当前账号',404);
   if(request.headers.get('If-Match')!=='"'+state.revision+'"'||input.plantRevision!==(row.value._revision||'legacy'))throw fail('植物或分类已在其他设备更新，请刷新后重新选择',409);
   const tree=buildTree(state.plants.map(r=>r.value),state.taxa.map(r=>r.value),system),target=tree.nodes.get(pathKey(path));if(!target)throw fail('目标分支已变更，请刷新后重新选择',409);
   const next={...applyClassificationPath(row.value,target.path,system),_revision:randomUUID()};sql.prepare('UPDATE plants SET data=? WHERE id=? AND owner=?').run(JSON.stringify(next),row.id,session.owner);
   const latest=snapshot(sql,session.owner),response=json({plants:latest.plants.map(r=>({id:r.id,...r.value})),taxa:latest.taxa.map(r=>({id:r.id,...r.value})),assignedPlantId:row.id});sql.exec('COMMIT');return response;
  }catch(error){sql.exec('ROLLBACK');return json({error:error.status?error.message:'重新归类失败，未更改任何数据'},error.status||500)}
 }
 if(request.method==='GET'){
  let path;try{path=validPath(JSON.parse(url.searchParams.get('path')||'null'),url.searchParams.has('system')?system:undefined)}catch{return json({error:'分类路径无效'},400)}
  const state=snapshot(sql,session.owner),found=branch(state,path,system),tree=buildTree(state.plants.map(r=>r.value),state.taxa.map(r=>r.value),system);
  if(!tree.nodes.has(pathKey(path)))return json({error:'分类不存在，请刷新分类树'},404);
  const selected=found.taxa.find(r=>pathKey(r.value.path)===pathKey(path));
  return json({revision:state.revision,directPlantCount:found.plants.filter(r=>plantPath(r.value,system).length===path.length).length,plantCount:found.plants.length,taxonCount:found.taxa.length,nodeCount:[...tree.nodes.values()].filter(n=>prefix(n.path,path)).length,references:selected?.value.references||[],path:tree.nodes.get(pathKey(path)).path,system});
 }
 if(!['PUT','DELETE'].includes(request.method))return json({error:'不支持此操作'},405);
 if(request.headers.get('Origin')!==url.origin)return json({error:'请求来源无效'},403);
 const text=await request.text();if(text.length>1024*1024)return json({error:'分类内容过长'},413);
 let input,oldPath,newPath;try{input=JSON.parse(text);system=taxonomySystem(input.system);oldPath=validPath(input.path,input.system);if(request.method==='PUT')newPath=validPath(input.newPath,input.system)}catch{return json({error:'分类路径无效'},400)}
 if(!request.headers.get('If-Match'))return json({error:'请重新打开分类后操作'},428);
 const deleteMode=Object.hasOwn(input,'deleteMode')?input.deleteMode:'branch';
 if(request.method==='DELETE'&&!['node','branch'].includes(deleteMode))return json({error:'请选择只删除当前节点或同时删除所有子节点'},400);
 if(request.method==='DELETE'&&input.confirmation!=='删除分类')return json({error:'请明确确认所选删除方式'},400);
 sql.exec('BEGIN IMMEDIATE');try{
  if(sessionAccount(sql,request)?.owner!==session.owner)throw fail('登录已失效',401);
  const state=snapshot(sql,session.owner),tree=buildTree(state.plants.map(r=>r.value),state.taxa.map(r=>r.value),system),oldKey=pathKey(oldPath),found=branch(state,oldPath,system);
  if(request.headers.get('If-Match')!=='"'+state.revision+'"')throw fail('分类或档案已在其他设备更新，请刷新后重新编辑',409);
  if(!tree.nodes.has(oldKey))throw fail('分类不存在，请刷新分类树',404);
  if(request.method==='DELETE'){
   if(deleteMode==='branch'){
    for(const row of found.taxa)sql.prepare('DELETE FROM taxa WHERE id=? AND owner=?').run(row.id,session.owner);
    for(const row of found.plants){const next={...detachClassification(row.value,system),_revision:randomUUID()};sql.prepare('UPDATE plants SET data=? WHERE id=? AND owner=?').run(JSON.stringify(next),row.id,session.owner)}
   }else{
    const removeNode=path=>{const next=[...path.slice(0,oldPath.length-1),...path.slice(oldPath.length)];if(!next.length)return [];try{return validPath(next,system)}catch{throw fail('只删除此节点后，下级分类将失去必要的上级（例如 aff. / cf. 需要基础种）；请先调整下级或选择同时删除所有子节点')}};
    // Deletion is scoped by full path. Legacy same-name nodes elsewhere must
    // not veto cleanup; only structural validity matters when promoting children.
    for(const node of tree.nodes.values())if(prefix(node.path,oldPath)&&node.path.length>oldPath.length)removeNode(node.path);
    const taxonPlans=found.taxa.filter(row=>pathKey(row.value.path)!==oldKey).map(row=>({row,path:removeNode(row.value.path)}));
    const plantPlans=found.plants.map(row=>({row,path:removeNode(plantPath(row.value,system))}));
    for(const row of found.taxa.filter(row=>pathKey(row.value.path)===oldKey))sql.prepare('DELETE FROM taxa WHERE id=? AND owner=?').run(row.id,session.owner);
    // If promotion lands on an identical full path, keep one manual record
    // and all reference images. Same names under different parents stay separate.
    const destinations=new Map(),touched=new Map();
    for(const row of state.taxa)if(taxonomySystem(row.value.system)===system&&!prefix(row.value.path,oldPath)){
     const key=pathKey(row.value.path),existing=destinations.get(key);if(existing){existing.duplicates.push(row);existing.references=[...new Set([...existing.references,...(row.value.references||[])])]}else destinations.set(key,{row,path:structuredClone(row.value.path),references:[...(row.value.references||[])],duplicates:[]});
    }
    for(const {row,path}of taxonPlans){
     const key=pathKey(path),existing=destinations.get(key);
     if(existing){
      for(const [i,part]of path.entries())for(const language of ['nameZh','nameEn'])if(!existing.path[i][language]&&part[language])existing.path[i][language]=part[language];
      existing.references=[...new Set([...existing.references,...(row.value.references||[])])];
      sql.prepare('DELETE FROM taxa WHERE id=? AND owner=?').run(row.id,session.owner);touched.set(key,existing);
     }else{const target={row,path,references:[...(row.value.references||[])],duplicates:[]};destinations.set(key,target);touched.set(key,target)}
    }
    for(const {row,path,references,duplicates}of touched.values()){for(const duplicate of duplicates)sql.prepare('DELETE FROM taxa WHERE id=? AND owner=?').run(duplicate.id,session.owner);const next={...row.value,path,system,references,_revision:randomUUID()};sql.prepare('UPDATE taxa SET path_key=?,data=? WHERE id=? AND owner=?').run(storagePathKey(path,system),JSON.stringify(next),row.id,session.owner)}
    for(const {row,path}of plantPlans){const next={...(path.length?applyClassificationPath(row.value,path,system):detachClassification(row.value,system)),_revision:randomUUID()};sql.prepare('UPDATE plants SET data=? WHERE id=? AND owner=?').run(JSON.stringify(next),row.id,session.owner)}
   }
  }else{
   const parent=newPath.slice(0,-1);if(input.requireExistingParent===true&&parent.length&&!tree.nodes.has(pathKey(parent)))throw fail('目标分支已变更，请刷新后重新拖动',409);
   const outside={nodes:new Map([...tree.nodes].filter(([,n])=>!prefix(n.path,oldPath)))};
   newPath=canonicalPath(newPath,outside);
   const newKey=pathKey(newPath),changed=JSON.stringify(newPath)!==JSON.stringify(oldPath);
   if(changed&&newKey!==oldKey&&prefix(newPath,oldPath))throw fail('不能把分类移到自己的下级');
   if(changed&&newKey!==oldKey&&tree.nodes.has(newKey))throw fail('目标分类已存在，请选择其他名称或上级',409);
   const refs=input.references;
   if(!Array.isArray(refs)||!refs.every(x=>typeof x==='string'&&/^\/(images\/[a-f0-9-]+|assets\/[A-Za-z0-9_]+\.jpg)$/.test(x)))throw fail('参考图无效');
   if(refs.length&&!referenceRank(newPath.at(-1).rank))throw fail('仅种级及以下分类可导入参考图');
   for(const ref of refs.filter(x=>x.startsWith('/images/')))if(!sql.prepare('SELECT id FROM images WHERE owner=? AND id=?').get(session.owner,ref.split('/').pop()))throw fail('参考图不存在或不属于当前账号');
   const plans=[];
   for(const row of found.taxa){let path;try{path=validPath([...newPath,...row.value.path.slice(oldPath.length)],system)}catch{throw fail('下级分类与新层级不兼容，请先处理下级分类')}
    canonicalPath(path,outside);const selected=pathKey(row.value.path)===oldKey,next={...row.value,path,system,references:selected?[...new Set(refs)]:row.value.references};
    if(changed||selected)plans.push({row,next:{...next,_revision:randomUUID()}});
   }
   const plantPlans=[];
   if(changed)for(const row of found.plants){let path;try{path=validPath([...newPath,...plantPath(row.value,system).slice(oldPath.length)],system)}catch{throw fail('关联植物的种下分类与新层级不兼容，请先编辑这些植物')}
    canonicalPath(path,outside);plantPlans.push({row,next:{...applyClassificationPath(row.value,path,system),_revision:randomUUID()}});
   }
   for(const {row,next} of plans)sql.prepare('UPDATE taxa SET path_key=?,data=? WHERE id=? AND owner=?').run(storagePathKey(next.path,system),JSON.stringify(next),row.id,session.owner);
   if(!found.taxa.some(r=>pathKey(r.value.path)===oldKey)){
    const id=randomUUID(),value={path:newPath,system,references:[...new Set(refs)],_revision:randomUUID()};sql.prepare('INSERT INTO taxa VALUES (?,?,?,?,?)').run(id,session.owner,storagePathKey(newPath,system),JSON.stringify(value),new Date().toISOString());
   }
   for(const {row,next} of plantPlans)sql.prepare('UPDATE plants SET data=? WHERE id=? AND owner=?').run(JSON.stringify(next),row.id,session.owner);
  }
  let latest=snapshot(sql,session.owner);
  // Deleting or moving the last child must not remove its implicit ancestors.
  const parent=oldPath.slice(0,-1);if(parent.length){const remaining=buildTree(latest.plants.map(r=>r.value),latest.taxa.map(r=>r.value),system);if(!remaining.nodes.has(pathKey(parent))){const path=tree.nodes.get(pathKey(parent)).path,id=randomUUID(),value={path,system,references:[],_revision:randomUUID()};sql.prepare('INSERT INTO taxa VALUES (?,?,?,?,?)').run(id,session.owner,storagePathKey(path,system),JSON.stringify(value),new Date().toISOString());latest=snapshot(sql,session.owner)}}
  const response=json({plants:latest.plants.map(r=>({id:r.id,...r.value})),taxa:latest.taxa.map(r=>({id:r.id,...r.value})),plantCount:found.plants.length,taxonCount:found.taxa.length});sql.exec('COMMIT');return response;
 }catch(error){sql.exec('ROLLBACK');return json({error:error.status?error.message:'分类修改失败，未更改任何数据'},error.status||500)}
}
