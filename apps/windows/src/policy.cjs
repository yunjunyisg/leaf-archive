const ORIGIN='https://gloriouscarnivorousplants.top';
function parsed(value){try{return new URL(value)}catch{return null}}
const isTrusted=value=>{const url=parsed(value);return Boolean(url&&url.origin===ORIGIN&&!url.username&&!url.password)};
const isExternal=value=>{const url=parsed(value);return Boolean(url&&url.protocol==='https:'&&!url.username&&!url.password&&!isTrusted(value))};
const isDownload=value=>{const url=parsed(value);return isTrusted(value)||Boolean(url&&url.protocol==='blob:'&&url.origin===ORIGIN)};
module.exports={ORIGIN,isTrusted,isExternal,isDownload};
