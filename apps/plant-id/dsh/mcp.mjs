import {readFileSync} from 'node:fs';
import {findKnowledge,reviewPlantNames} from '../knowledge.mjs';

const versions=new Set(['2025-03-26','2025-06-18','2025-11-25']);
const readOnly={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
const lookup={
 name:'lookup_plant',
 description:'按学名、异名或本库收录的常见中文名查阅识植助手共享资料。返回接受名、科属资料和来源链接。',
 annotations:readOnly,
 inputSchema:{type:'object',properties:{name:{type:'string',minLength:1,maxLength:120}},required:['name'],additionalProperties:false},
};
const agent={
 name:'plant_agent',
 title:'识植助手',
 description:'用户请求识别植物照片、按线索辨认植物或询问植物时调用。你负责读取对话中的图像，工具返回识植流程及候选学名的公开资料。只传候选名称，不传照片、聊天记录或密钥。',
 annotations:readOnly,
 inputSchema:{type:'object',properties:{
  task:{type:'string',enum:['identify','question']},
  names:{type:'array',maxItems:4,items:{type:'string',minLength:1,maxLength:120}},
 },required:['task'],additionalProperties:false},
};
const workflowStart='在当前 AI 对话中用用户上传的照片和描述完成任务。照片由当前客户端读取；如果你看不到图像，请请求直接上传到对话或补充描述。只向植物资料工具发送候选名称。';
const workflows={
 identify:{
  name:'identify_plant',title:'识别植物',
  description:'根据当前对话中的照片或描述识别植物，查询接受名，并给出候选、区分方法和补拍建议。',
  guide:workflowStart+'\n推测出候选后，用 lookup_plant 逐个核对。名录结果只用来核对分类和出处。\n'+
   readFileSync(new URL('../persona.txt',import.meta.url),'utf8'),
 },
 question:{
  name:'plant_question',title:'植物问答',
  description:'核对植物名称并基于公开资料回答鉴别、形态、生境或养护问题。',
  guide:workflowStart+'\n如果有明确植物名称，用 lookup_plant 核对接受名、异名、学名拼写与分类。区分有出处的名录事实、一般养护经验和仍需核对的判断。只引用工具实际返回的出处；查不到时明确说明。识别层级不足时先说明还需要核对的特征。照片识别不能确认食用或药用安全。',
 },
};
const publicPrompts=Object.values(workflows).map(({guide,...prompt})=>prompt);
const validName=value=>typeof value==='string'&&value.trim()&&value.length<=120;
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
   protocolVersion:versions.has(requested)?requested:'2025-11-25',capabilities:{tools:{},prompts:{}},
   serverInfo:{name:'Leaf Archive Plant Knowledge',title:'识植助手',version:'1.1.0'},
   instructions:'植物识别和问答使用 plant_agent，或选用 identify_plant / plant_question 提示。读取用户在本 AI 对话上传的照片，使用工具核对候选名称并引用原始出处。',
  });
 }
 if(message.method==='ping')return ok({});
 if(message.method==='prompts/list')return ok({prompts:publicPrompts});
 if(message.method==='prompts/get'){
  const prompt=Object.values(workflows).find(item=>item.name===message.params?.name);
  if(!prompt)return failed(-32602,'Unknown prompt');
  return ok({description:prompt.description,messages:[{role:'user',content:{type:'text',text:prompt.guide}}]});
 }
 if(message.method==='tools/list')return ok({tools:[lookup,agent]});
 if(message.method==='tools/call'){
  const args=message.params?.arguments;
  let result;
  if(message.params?.name===lookup.name&&validName(args?.name)&&Object.keys(args).length===1){
   result={entries:await plantKnowledge(args.name)};
  }else if(message.params?.name===agent.name){
   const {task,names=[]}=args??{};
   if((task!=='identify'&&task!=='question')||!Array.isArray(names)||names.length>4||
    !names.every(validName)||Object.keys(args).some(key=>key!=='task'&&key!=='names')){
    return failed(-32602,'Invalid plant_agent input');
   }
   const candidates=await Promise.all([...new Set(names.map(name=>name.trim()))].map(async name=>({
    name,entries:await plantKnowledge(name),
   })));
   result={instructions:workflows[task].guide,candidates};
  }else return failed(-32602,'Unknown tool or invalid arguments');
  return ok({content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result});
 }
 return failed(-32601,'Method not found');
}
