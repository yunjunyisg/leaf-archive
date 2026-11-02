import test from 'node:test';import assert from 'node:assert/strict';
import {taxonomySuggestions} from '../shared/taxonomy.js';
const plant={kingdom:'植物界',division:'被子植物门',className:'双子叶植物纲',order:'石竹目',family:'猪笼草科',tribe:'示例族',genus:'Nepenthes',section:'示例组',series:'示例系',species:'lowii',variety:'alba',form:'typica',identification:'species'};
test('every saved taxonomy level is suggested, without synthetic names or demo records',()=>{
 for(const rank of ['kingdom','division','className','order','family','tribe','genus','section','series','species','variety','form'])assert.deepEqual(taxonomySuggestions([plant],[],rank),[plant[rank]],rank);
 assert.deepEqual(taxonomySuggestions([{name:'昵称',latin:'Latin name'}],[],'species'),[]);assert.deepEqual(taxonomySuggestions([{...plant,demo:true},{...plant,taxonomyDetached:true}],[],'genus'),[]);
});
test('manual classification choices include ancestor ranks and do not require an attached plant',()=>{
 const taxa=[{path:[{rank:'kingdom',name:'植物界'},{rank:'genus',name:'Heliamphora'}]}];assert.deepEqual(taxonomySuggestions([],taxa,'kingdom'),['植物界']);assert.deepEqual(taxonomySuggestions([],taxa,'genus'),['Heliamphora']);
});
test('partial, case-insensitive and accent-tolerant lookup prioritizes prefixes and deduplicates saved names',()=>{
 const records=[{genus:'Nepenthes'},{genus:'nepenthes'},{genus:'  Nepenthes  '},{genus:'Pinguícula'},{genus:'Hyponepenthes'}];
 assert.deepEqual(taxonomySuggestions(records,[],'genus','nep'),['Nepenthes','Hyponepenthes']);assert.deepEqual(taxonomySuggestions(records,[],'genus','PINGU'),['Pinguícula']);assert.deepEqual(taxonomySuggestions([plant],[],'family','笼草'),['猪笼草科']);assert.deepEqual(taxonomySuggestions(records,[],'genus','不存在'),[]);
});
test('hybrid, unresolved and identification-qualified names stay in their own rank',()=>{
 const records=[plant,{...plant,identification:'hybrid',species:'lowii × veitchii'},{...plant,identification:'unresolved',species:'sp. 1'},{...plant,identification:'cf',infraspecific:'tenuis'},{...plant,identification:'aff',infraspecific:'rajah'}];
 assert.deepEqual(taxonomySuggestions(records,[],'hybrid'),['lowii × veitchii']);assert.deepEqual(taxonomySuggestions(records,[],'unresolved'),['sp. 1']);assert.deepEqual(taxonomySuggestions(records,[],'species'),['lowii']);assert.deepEqual(taxonomySuggestions(records,[],'cf'),['tenuis']);assert.deepEqual(taxonomySuggestions(records,[],'aff'),['rajah']);assert.deepEqual(taxonomySuggestions(records,[],'variety'),['alba']);
});
test('choices have no process-wide history and do not retain deleted or renamed data sources',()=>{
 assert.deepEqual(taxonomySuggestions([{genus:'User A'}],[],'genus'),['User A']);assert.deepEqual(taxonomySuggestions([{genus:'User B'}],[],'genus'),['User B']);assert.deepEqual(taxonomySuggestions([],[],'genus'),[]);assert.deepEqual(taxonomySuggestions([plant],[],'invalid-rank'),[]);
});
