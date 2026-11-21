const test=require('node:test'),assert=require('node:assert/strict');const {isTrusted,isExternal,isDownload}=require('../src/policy.cjs');
test('only the canonical HTTPS origin can load inside the application',()=>{
 for(const url of ['https://gloriouscarnivorousplants.top/','https://gloriouscarnivorousplants.top/admin','https://gloriouscarnivorousplants.top/auth/local'])assert.equal(isTrusted(url),true);
 for(const url of ['http://gloriouscarnivorousplants.top','https://gloriouscarnivorousplants.top.evil.example','https://evil.example/?next=https://gloriouscarnivorousplants.top','https://user@gloriouscarnivorousplants.top','file:///etc/passwd','javascript:alert(1)'])assert.equal(isTrusted(url),false);
});
test('external navigation permits HTTPS only and downloads stay on the site',()=>{
 assert.equal(isExternal('https://beian.miit.gov.cn/'),true);assert.equal(isExternal('file:///tmp/test'),false);assert.equal(isExternal('https://gloriouscarnivorousplants.top'),false);
 assert.equal(isDownload('blob:https://gloriouscarnivorousplants.top/uuid'),true);assert.equal(isDownload('https://gloriouscarnivorousplants.top/images/uuid'),true);assert.equal(isDownload('blob:https://evil.example/uuid'),false);
});

test('only the trusted main frame may request application exit',()=>{const {isTrustedMainFrame}=require('../src/policy.cjs');const main={url:'https://gloriouscarnivorousplants.top/account'},child={url:main.url},foreign={url:'https://evil.example'};assert.equal(isTrustedMainFrame(main,main),true);assert.equal(isTrustedMainFrame(child,main),false);assert.equal(isTrustedMainFrame(foreign,foreign),false);assert.equal(isTrustedMainFrame(null,main),false)});

test('Plant ID keeps its independent HTTPS entry inside the application',()=>{
 const {isTrustedPage}=require('../src/policy.cjs');
 for(const value of ['/plant-id','/plant-id/','/plant-id/ocr','/plant-id/apps'])
  assert.equal(isTrustedPage(new URL('https://gloriouscarnivorousplants.top'+value),'/plant-id/'),true);
 for(const value of ['/','/plant-id-mimic','/plant-id/../admin'])
  assert.equal(isTrustedPage(new URL('https://gloriouscarnivorousplants.top'+value),'/plant-id/'),false);
 assert.equal(isTrustedPage(new URL('https://example.com/plant-id/'),'/plant-id/'),false);
});
