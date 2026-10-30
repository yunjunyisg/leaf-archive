const test=require('node:test'),assert=require('node:assert/strict');const {isTrusted,isExternal,isDownload}=require('../src/policy.cjs');
test('only the canonical HTTPS origin can load inside the application',()=>{
 for(const url of ['https://gloriouscarnivorousplants.top/','https://gloriouscarnivorousplants.top/admin','https://gloriouscarnivorousplants.top/auth/local'])assert.equal(isTrusted(url),true);
 for(const url of ['http://gloriouscarnivorousplants.top','https://gloriouscarnivorousplants.top.evil.example','https://evil.example/?next=https://gloriouscarnivorousplants.top','https://user@gloriouscarnivorousplants.top','file:///etc/passwd','javascript:alert(1)'])assert.equal(isTrusted(url),false);
});
test('external navigation permits HTTPS only and downloads stay on the site',()=>{
 assert.equal(isExternal('https://beian.miit.gov.cn/'),true);assert.equal(isExternal('file:///tmp/test'),false);assert.equal(isExternal('https://gloriouscarnivorousplants.top'),false);
 assert.equal(isDownload('blob:https://gloriouscarnivorousplants.top/uuid'),true);assert.equal(isDownload('https://gloriouscarnivorousplants.top/images/uuid'),true);assert.equal(isDownload('blob:https://evil.example/uuid'),false);
});
