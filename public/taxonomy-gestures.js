import {validPath,pathKey,partLabel} from '/taxonomy.js';
// Gesture-only controller: classification writes stay in the application/API.
export function installTaxonomyReparent({root,getNodes,getSystem,canStart,onBusy,onDrop,onError}){
 let drag=null,frame=0,marked=null;
 const rootDrop=document.createElement('div');rootDrop.className='taxonomy-root-drop';rootDrop.dataset.taxonomyRootDrop='true';rootDrop.textContent='拖到这里设为根节点';rootDrop.hidden=true;document.body.append(rootDrop);
 const status=document.createElement('p');status.className='taxonomy-drag-status';status.id='taxonomyDragStatus';status.setAttribute('role','status');root.before(status);
 function mark(target,state){if(marked)delete marked.dataset.dropState;marked=target;if(marked)marked.dataset.dropState=state}
 function destination(x,y){
  const hit=document.elementFromPoint(x,y);if(!hit)return {valid:false,reason:'拖到目标节点上，或拖到根节点区域。'};
  let target=null,element;if(hit.closest('[data-taxonomy-root-drop]'))element=rootDrop;else{element=hit.closest('.taxon-node[data-key]');if(!element||!root.contains(element))return {valid:false,reason:'拖到目标节点上，或拖到根节点区域。'};target=getNodes().get(element.dataset.key);if(!target)return {valid:false,reason:'目标分类已变更，请刷新。'}}
  const prefix=target?.path||[],source=drag.source;
  if(target&&(target.key===source.key||pathKey(prefix.slice(0,source.path.length))===source.key))return {valid:false,element,reason:'不能移到自己或自己的子节点下。'};
  let next;try{next=validPath([...prefix,source.path.at(-1)],drag.system)}catch{return {valid:false,element,reason:'该节点不能放到所选层级下，请选择更高的有效上级。'}}
  if(pathKey(next)===source.key)return {valid:false,element,reason:'该节点已经位于这个上级下。'};
  return {valid:true,element,target,reason:target?'松开后接入“'+partLabel(target)+'”分支。':'松开后设为根节点。'};
 }
 function update(){
  if(!drag?.active)return;
  const box=root.getBoundingClientRect(),inside=drag.x>=box.left&&drag.x<=box.right&&drag.y>=box.top&&drag.y<=box.bottom;
  if(inside){const edge=36,speed=12;root.scrollLeft+=drag.x<box.left+edge?-speed:drag.x>box.right-edge?speed:0;root.scrollTop+=drag.y<box.top+edge?-speed:drag.y>box.bottom-edge?speed:0}
  drag.ghost.style.left=Math.max(8,Math.min(innerWidth-228,drag.x+16))+'px';drag.ghost.style.top=Math.max(8,Math.min(innerHeight-80,drag.y+16))+'px';
  drag.destination=destination(drag.x,drag.y);mark(drag.destination.element,drag.destination.valid?'allowed':'blocked');const text=drag.destination.reason;if(status.textContent!==text)status.textContent=text;
  frame=requestAnimationFrame(update);
 }
 function cleanup(){
  if(!drag)return;const old=drag;drag=null;cancelAnimationFrame(frame);frame=0;mark(null);rootDrop.hidden=true;old.ghost?.remove();delete root.dataset.nodeDragging;status.textContent='';try{if(old.handle.hasPointerCapture(old.id))old.handle.releasePointerCapture(old.id)}catch{}onBusy(false);
 }
 root.addEventListener('pointerdown',event=>{
  const handle=event.target instanceof Element?event.target.closest('[data-tax-drag]'):null;if(!handle||event.button!==0||!canStart())return;
  const source=getNodes().get(handle.dataset.taxDrag);if(!source)return;event.preventDefault();event.stopPropagation();
  drag={id:event.pointerId,handle,source:{key:source.key,path:structuredClone(source.path),rank:source.rank,name:source.name,nameZh:source.nameZh,nameEn:source.nameEn},system:getSystem(),startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,active:false,ghost:null,destination:null};onBusy(true);handle.setPointerCapture(event.pointerId);
 });
 root.addEventListener('pointermove',event=>{
  if(!drag||drag.id!==event.pointerId)return;event.preventDefault();drag.x=event.clientX;drag.y=event.clientY;
  if(!drag.active&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>=7){drag.active=true;drag.ghost=document.createElement('div');drag.ghost.className='taxonomy-drag-ghost';drag.ghost.textContent=partLabel(drag.source);document.body.append(drag.ghost);rootDrop.hidden=false;root.dataset.nodeDragging='true';update()}
 });
 root.addEventListener('pointerup',event=>{
  if(!drag||drag.id!==event.pointerId)return;event.preventDefault();const source=drag.source,active=drag.active,result=active?destination(event.clientX,event.clientY):null;cleanup();if(!active)return;if(result.valid)onDrop(source,result.target);else onError(result.reason);
 });
 root.addEventListener('pointercancel',cleanup);root.addEventListener('lostpointercapture',()=>{if(drag)cleanup()});window.addEventListener('blur',cleanup);document.addEventListener('visibilitychange',()=>{if(document.hidden)cleanup()});document.addEventListener('keydown',event=>{if(drag&&event.key==='Escape'){event.preventDefault();event.stopPropagation();cleanup()}});
 return {cancel:cleanup,get dragging(){return Boolean(drag)}};
}
