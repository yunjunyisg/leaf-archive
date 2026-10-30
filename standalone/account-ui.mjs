import {readFileSync} from 'node:fs';
export const accountUiClient=readFileSync(new URL('./account-ui.js',import.meta.url),'utf8');
const css=`@media(max-width:760px){.main>header{display:none!important}}.account-controls #logout,.account-controls #deleteAccount{display:none!important}.stats>[hidden]{display:none!important}a.side-bottom{text-decoration:none}.nav[href="/account"]{min-height:44px}`;
export async function withAccountUi(response){
 if(!response.body||!response.headers.get('Content-Type')?.includes('text/html'))return response;
 let html=await response.text();if(html.includes('class="sidebar"')){
  html=html.replace('</head>','<style id="account-navigation">'+css+'</style></head>');
  if(!html.includes('src="/account-ui.js"'))html=html.replace('</body>','<script src="/account-ui.js" defer></script></body>');
 }
 const headers=new Headers(response.headers);headers.delete('Content-Length');headers.delete('ETag');return new Response(html,{status:response.status,statusText:response.statusText,headers});
}
