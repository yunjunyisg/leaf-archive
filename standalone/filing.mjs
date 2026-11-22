const filingFooter=`<footer class="site-filing" style="display:block;box-sizing:border-box;margin:0;padding:16px 14px;text-align:center;font-size:13px;color:#596e60">
  <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">蜀ICP备2026066760号</a>
</footer>`;
const filingStyles=`<style>
.leaf-native .site-filing{display:none!important}
@media(max-width:760px){body:has(>.sidebar)>.site-filing{padding-bottom:calc(68px + env(safe-area-inset-bottom))!important}}
</style>`;
const originalFooter=/<!--\s*备案号组件开始\s*-->[\s\S]*?<!--\s*备案号组件结束\s*-->/g;
const trailingBody=/<\/body>(?=\s*(?:<\/html>)?\s*$)/i;

export async function withFilingFooter(response,userAgent=''){
 if(!response.body||!response.headers.get('Content-Type')?.includes('text/html'))return response;
 const app=/\b(?:LeafArchiveClient|Electron)\/|; wv\)/.test(userAgent);
 const html=(await response.text()).replace(originalFooter,'');
 let document=html;
 if(!app){
  document=/<\/head>/i.test(html)?html.replace(/<\/head>/i,filingStyles+'</head>'):html;
  if(trailingBody.test(document))document=document.replace(trailingBody,filingFooter);
  else if(/<\/html>/i.test(document))document=document.replace(/<\/html>/i,filingFooter+'</html>');
  else document+=filingFooter;
 }else{
  document=document.replace(trailingBody,'');
 }
 // A terminal body end tag is optional in HTML. Omit it so an older reverse
 // proxy that appends its own filing number at that tag leaves this page alone.
 const headers=new Headers(response.headers);
 headers.delete('Content-Length');
 headers.delete('ETag');
 const vary=headers.get('Vary');
 if(vary!=='*'&&!vary?.split(',').some(name=>name.trim().toLowerCase()==='user-agent'))headers.append('Vary','User-Agent');
 return new Response(document,{status:response.status,statusText:response.statusText,headers});
}
