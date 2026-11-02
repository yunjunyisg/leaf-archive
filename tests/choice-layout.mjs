import test from 'node:test';import assert from 'node:assert/strict';import {choicePanelLayout} from '../shared/choice-layout.js';
const frame={left:100,right:800,top:100,bottom:700};
const fits=(r,f)=>{assert.ok(r.left>=f.left);assert.ok(r.left+r.width<=f.right+.001);assert.ok(r.top>=f.top);assert.ok(r.top+r.maxHeight<=f.bottom+.001)};
test('choice popup opens below an upper field without crossing the visible dialog',()=>{const r=choicePanelLayout({left:160,right:400,top:150,bottom:190},frame);assert.equal(r.placement,'below');assert.equal(r.top,196);fits(r,frame)});
test('choice popup moves above a low field and stays above the save buttons',()=>{const r=choicePanelLayout({left:550,right:780,top:640,bottom:680},frame);assert.equal(r.placement,'above');fits(r,frame)});
test('short mobile and keyboard-sized viewports constrain popup width and height',()=>{
 for(const height of [100,160,230,300,450])for(const offset of [.1,.5,.9]){const f={left:18,right:372,top:80,bottom:80+height},top=80+height*offset;const r=choicePanelLayout({left:210,right:360,top,bottom:top+36},f,240,260);fits(r,f)}
});
test('when neither side has room the popup uses a bounded scrollable overlay',()=>{const f={left:8,right:382,top:100,bottom:280},r=choicePanelLayout({left:12,right:180,top:170,bottom:210},f,240,260);assert.equal(r.placement,'overlay');assert.equal(r.maxHeight,180);fits(r,f)});
