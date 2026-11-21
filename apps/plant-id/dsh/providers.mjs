import {isIP} from 'node:net';

const builtins=[
 {id:'deepseek',label:'DeepSeek',model:'deepseek-v4-flash',apiKeyEnv:'DEEPSEEK_API_KEY'},
 {id:'bigmodel',label:'智谱开放平台',model:'glm-4.7-flash',fallbackModel:'glm-4.5-flash',baseURL:'https://open.bigmodel.cn/api/paas/v4'},
 {id:'dashscope',label:'阿里云百炼（中国内地）',model:'qwen-plus',baseURL:'https://dashscope.aliyuncs.com/compatible-mode/v1'},
 {id:'siliconflow',label:'硅基流动（中国内地）',model:'Qwen/Qwen3-8B',baseURL:'https://api.siliconflow.cn/v1'},
 {id:'openai',label:'OpenAI',model:'gpt-4.1-mini',baseURL:'https://api.openai.com/v1'},
];

export const validModel=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9._:/@-]{0,127}$/i.test(value);
export const validApiKey=value=>typeof value==='string'&&/^[!-~]{8,512}$/.test(value.trim());

function gatewayURL(raw){
 const url=new URL(raw),host=url.hostname.replace(/^\[|\]$/g,'');
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.port||
    isIP(host)||!host.includes('.')||/\.(localhost|local|internal|invalid|test)$/.test(host)){
  throw Error('问答网关须使用管理员指定的 HTTPS 公网域名');
 }
 return url.href.replace(/\/$/,'');
}

export function askProviderRegistry(env){
 const providers=new Map(builtins.map(p=>[p.id,{...p,allowModel:Boolean(p.baseURL)}]));
 const raw=env.PLANT_ID_ASK_GATEWAYS;
 if(!raw)return providers;
 try{
  const config=JSON.parse(raw);
  if(!Array.isArray(config)||config.length>8)throw Error();
  const additions=new Map();
  for(const row of config){
   if(!row||typeof row.id!=='string'||!/^custom-[a-z0-9-]{1,25}$/.test(row.id)||additions.has(row.id)||
      typeof row.label!=='string'||!row.label.trim()||row.label.length>64||!validModel(row.model))throw Error();
   additions.set(row.id,{id:row.id,label:row.label.trim(),model:row.model,baseURL:gatewayURL(row.baseURL),allowModel:true});
  }
  for(const [id,provider] of additions)providers.set(id,provider);
 }catch{
  // A bad optional gateway must not take the existing website offline.
  console.warn('识植助手的自定义问答网关配置无效，已忽略该配置。');
 }
 return providers;
}

export function publicAskProviders(providers){
 return [...providers.values()].map(({id,label,model,allowModel})=>({id,label,model,allowModel}));
}

export function routeForQuestion(providers,providerId,requestedModel){
 if(typeof providerId!=='string'||typeof requestedModel!=='string')return null;
 const provider=providers.get(providerId);
 const model=requestedModel.trim()||provider?.model;
 if(!provider||!validModel(model)||(!provider.allowModel&&model!==provider.model))return null;
 return {...provider,model,fallbackModel:model===provider.model?provider.fallbackModel:undefined};
}

export function compatibleProviderPatch(route){
 const bigmodel=route.id==='bigmodel';
 return [{insert:[{
  id:'plant-id-ask-compatible-provider',
  name:'@deepseek-ai/dsh-llm-pi-ai',
  config:{providers:{'plant-id-compatible':{
   displayName:route.label,apiKeyEnv:'PLANT_ASK_API_KEY',
   api:'openai-completions',baseURL:route.baseURL,
   defaultContextWindow:32000,defaultMaxTokens:2200,
   retryPolicy:{mode:'normal',maxRetries:0},
   ...(bigmodel?{compat:{thinkingFormat:'zai',maxTokensField:'max_tokens',supportsStore:false,
    supportsDeveloperRole:false,supportsUsageInStreaming:false}}:{}),
   models:[{id:route.model,name:route.model,contextWindow:32000,maxTokens:2200,
    ...(bigmodel?{reasoningEfforts:{off:null,low:'low'}}:{})}],
  }}},
 }]}];
}
