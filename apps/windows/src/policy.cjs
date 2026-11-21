const product=require('./product.cjs');
const ORIGIN=new URL(product.entry).origin;
function parsed(value){try{return new URL(value)}catch{return null}}
function isTrustedPage(url,prefix){
 return Boolean(url&&url.origin===ORIGIN&&!url.username&&!url.password&&
  (!prefix||url.pathname===prefix.slice(0,-1)||url.pathname.startsWith(prefix)));
}
const isTrusted=value=>isTrustedPage(parsed(value),product.pathPrefix);
const isExternal=value=>{const url=parsed(value);return Boolean(url&&url.protocol==='https:'&&!url.username&&!url.password&&!isTrusted(value))};
const isDownload=value=>{const url=parsed(value);return isTrusted(value)||Boolean(url&&url.protocol==='blob:'&&url.origin===ORIGIN)};
const isTrustedMainFrame=(frame,mainFrame)=>Boolean(frame&&frame===mainFrame&&isTrusted(frame.url));
module.exports={ORIGIN,isTrustedPage,isTrusted,isExternal,isDownload,isTrustedMainFrame};
