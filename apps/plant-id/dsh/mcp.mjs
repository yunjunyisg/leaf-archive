import {findKnowledge,reviewPlantNames} from '../knowledge.mjs';

const versions=new Set(['2025-03-26','2025-06-18','2025-11-25']);
const tool={
 name:'lookup_plant',
 description:'按学名、异名或本库收录的常见中文名查阅识植助手共享资料。返回接受名、科属资料和来源链接。',
 annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
 inputSchema:{type:'object',properties:{name:{type:'string',minLength:1,maxLength:120}},required:['name'],additionalProperties:false},
};
const response=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function plantKnowledge(name){
 const entry=findKnowledge(name);
 if(entry)return [entry];
 const reviews=await reviewPlantNames({name,description:'',commonSearch:async()=>[]});
 return reviews.flatMap(review=>{
  if(!review.name)return [];
  const match=findKnowledge(review.name,review.rank);
  return match?[{...match,lookup:review.kind,input:review.input}]:[];
 });
}

export async function knowledgeMcp(message){
 const id=message?.id??null;
 const ok=result=>response({jsonrpc:'2.0',id,result});
 const failed=(code,text)=>response({jsonrpc:'2.0',id,error:{code,message:text}},code===-32600?400:200);
 if(message?.jsonrpc!=='2.0'||typeof message.method!=='string'||
    !(id===null||typeof id==='string'||Number.isSafeInteger(id)))return failed(-32600,'Invalid Request');
 if(!Object.hasOwn(message,'id'))return new Response(null,{status:202});
 if(message.method==='initialize'){
  const requested=message.params?.protocolVersion;
  return ok({
   protocolVersion:versions.has(requested)?requested:'2025-11-25',capabilities:{tools:{}},
   serverInfo:{name:'Leaf Archive Plant Knowledge',version:'1.0.0'},
   instructions:'查阅植物前使用 lookup_plant 核对学名。找不到时保留不确定性。引用返回的原始出处。',
  });
 }
 if(message.method==='ping')return ok({});
 if(message.method==='tools/list')return ok({tools:[tool]});
 if(message.method==='tools/call'){
  const name=message.params?.arguments?.name;
  if(message.params?.name!==tool.name||typeof name!=='string'||!name.trim()||name.length>120)
   return failed(-32602,'Invalid lookup_plant input');
  const entries=await plantKnowledge(name);
  return ok({content:[{type:'text',text:JSON.stringify({entries})}],structuredContent:{entries}});
 }
 return failed(-32601,'Method not found');
}
