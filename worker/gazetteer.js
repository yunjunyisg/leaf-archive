import australianData from '../data/gazetteers/AU.ndjson.gz';
import metadata from '../data/gazetteers/AU-metadata.json';

export const foldPlace=s=>String(s||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const typeNames={HMSD:'宅地 / Homestead',FRM:'农场 / Farm',FRMS:'农场群',RNCH:'牧场',DAM:'水坝',LK:'湖泊',LKS:'湖群',STM:'河流',STMI:'间歇河流',MT:'山峰',MTS:'山地',HLL:'山丘',HLLS:'丘陵',HLLI:'孤丘',SPNG:'泉',WLL:'水井',RSV:'水库',PPL:'聚落',PPLL:'小型聚落',AREA:'地区',LCTY:'地方',NPK:'国家公园',PRK:'公园',RESN:'自然保护区'};
function queryWords(query){return foldPlace(query.replace(/澳大利亚/g,' australia ').replace(/金伯利(?:地区)?/g,' kimberley ').replace(/西澳(?:大利亚)?(?:州)?/g,' western australia ')).split(' ').filter(Boolean)}
const adminKeys=new Map();
function adminContext(state,county){const key=state+'.'+county;if(!adminKeys.has(key))adminKeys.set(key,foldPlace([metadata.admin1[state],metadata.admin2[key],'Australia AU 澳大利亚'].filter(Boolean).join(' ')));return adminKeys.get(key)}
export async function searchAustralianGazetteer(query,limit=12){
 const words=queryWords(query);if(!words.length)return [];
 const exact=foldPlace(query),compact=exact.replaceAll(' ',''),matches=[];
 const encoded=australianData.slice(australianData.indexOf(',')+1),decoded=atob(encoded),bytes=new Uint8Array(decoded.length);for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
 const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).pipeThrough(new TextDecoderStream()).getReader();let pending='';
 function consider(line){
  if(!line)return;const r=JSON.parse(line),key=r[7],nameCompact=r[1].toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const nameWords=words.filter(w=>key.includes(w)||nameCompact.includes(w));if(!nameWords.length)return;
  const context=adminContext(r[5],r[6]);if(!words.every(w=>key.includes(w)||nameCompact.includes(w)||context.includes(w)))return;
  const name=foldPlace(r[1]);let score=name===exact||nameCompact===compact?1000:nameWords.length===words.length?650:500;
  if(name.startsWith(exact))score+=100;if(['PPL','PPLL','HMSD','FRM','AREA','LCTY'].includes(r[4]))score+=10;
  if(matches.length>=limit&&score<matches.at(-1).score)return;
  matches.push({r,score});matches.sort((a,b)=>b.score-a.score||a.r[1].localeCompare(b.r[1]));if(matches.length>limit)matches.pop();
 }
 try{for(;;){const {value,done}=await reader.read();if(done)break;pending+=value;let end;while((end=pending.indexOf('\n'))!==-1){consider(pending.slice(0,end));pending=pending.slice(end+1)}}if(pending)consider(pending)}finally{reader.releaseLock()}
 return matches.map(({r,score})=>{const state=metadata.admin1[r[5]]||'',county=metadata.admin2[r[5]+'.'+r[6]]||'';return {lat:r[2],lon:r[3],countryCode:'AU',country:'Australia',state,county,city:'',district:'',locality:r[1],featureType:typeNames[r[4]]||r[4],source:'geonames',sourceId:String(r[0]),sourceUrl:'https://www.geonames.org/'+r[0]+'/',precision:r[4]==='ADM1'?'region':r[4]==='ADM2'?'county':'locality',label:[r[1],county,state,'Australia'].filter(Boolean).join(' / '),_score:score};});
}
