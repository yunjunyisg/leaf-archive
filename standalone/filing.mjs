// 公共备案信息，不包含用户数据。
export const filingFooter=`<!-- 备案号组件开始 -->
<div style="text-align: center; padding: 20px 0; font-size: 14px; color: #666;">
    <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" style="color: #666; text-decoration: none;">
        蜀ICP备2026066760号
    </a>
</div>
<!-- 备案号组件结束 -->`;

// 同时适用于服务器已有的页面构建和登录、注册、管理员页面。
export async function withFilingFooter(response){
 if(!response.body||!response.headers.get('Content-Type')?.includes('text/html'))return response;
 const html=await response.text();
 const body=html.includes('<!-- 备案号组件开始 -->')?html:html.replace(/<\/body>/i,filingFooter+'</body>');
 // 部分登录页面省略 body 标签，仍在文档末尾展示备案信息。
 const output=body===html&&!html.includes('<!-- 备案号组件开始 -->')?(html.includes('</html>')?html.replace('</html>',filingFooter+'</html>'):html+filingFooter):body;
 const headers=new Headers(response.headers);headers.delete('Content-Length');headers.delete('ETag');
 return new Response(output,{status:response.status,statusText:response.statusText,headers});
}
