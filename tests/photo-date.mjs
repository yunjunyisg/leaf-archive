import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePhotoDate,readPhotoDate} from '../shared/photo-date.js';
function tiff(date='2026:11:03 20:02:10',le=true){
 const b=Buffer.alloc(76);b.write(le?'II':'MM');const u16=(n,p)=>le?b.writeUInt16LE(n,p):b.writeUInt16BE(n,p),u32=(n,p)=>le?b.writeUInt32LE(n,p):b.writeUInt32BE(n,p);
 u16(42,2);u32(8,4);u16(1,8);u16(0x8769,10);u16(4,12);u32(1,14);u32(26,18);u16(1,26);u16(0x9003,28);u16(2,30);u32(20,32);u32(44,36);b.write(date,44);return b;
}
function jpeg(t){const data=Buffer.concat([Buffer.from('Exif\0\0'),t]),h=Buffer.from([255,216,255,225,0,0]);h.writeUInt16BE(data.length+2,4);return Buffer.concat([h,data,Buffer.from([255,217])])}
function webp(t){const h=Buffer.alloc(20);h.write('RIFF');h.writeUInt32LE(12+t.length,4);h.write('WEBP',8);h.write('EXIF',12);h.writeUInt32LE(t.length,16);return Buffer.concat([h,t])}
function png(t){const h=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,101,88,73,102]);h.writeUInt32BE(t.length,8);return Buffer.concat([h,t,Buffer.alloc(4)])}
test('capture date supports both TIFF byte orders and JPEG/PNG/WebP containers',()=>{for(const le of [true,false])for(const wrap of [jpeg,png,webp])assert.equal(parsePhotoDate(wrap(tiff(undefined,le))),'2026-11-03')});
test('capture date preserves camera calendar day without timezone conversion',()=>{assert.equal(parsePhotoDate(jpeg(tiff('2024:02:29 00:01:00'))),'2024-02-29');for(const date of ['2025:02:29 00:00:00','2026:04:31 00:00:00','0000:01:01 00:00:00','2026:11:03 24:00:00'])assert.equal(parsePhotoDate(jpeg(tiff(date))),'')});
test('malformed, truncated, no metadata and modified-date-only files return empty',()=>{const b=tiff();b.writeUInt16LE(0x0132,28);for(const bytes of [Buffer.alloc(0),Buffer.from('not an image'),jpeg(b),jpeg(tiff()).subarray(0,48)])assert.equal(parsePhotoDate(bytes),'');const bad=tiff();bad.writeUInt32LE(0xffffffff,36);assert.equal(parsePhotoDate(jpeg(bad)),'')});
test('file reader ignores lastModified, refuses oversized files and tolerates read errors',async()=>{assert.equal(await readPhotoDate(new Blob([jpeg(tiff())])),'2026-11-03');assert.equal(await readPhotoDate({size:1,lastModified:Date.now(),arrayBuffer:async()=>new ArrayBuffer(0)}),'');assert.equal(await readPhotoDate({size:21*1024*1024,arrayBuffer:()=>{throw Error('must not read')}}),'');assert.equal(await readPhotoDate({size:1,arrayBuffer:async()=>{throw Error('read failure')}}),'')});

test('capture dates remain readable above the old 8 MiB upload limit',async()=>{const bytes=Buffer.alloc(20*1024*1024);jpeg(tiff()).copy(bytes);assert.equal(await readPhotoDate(new Blob([bytes])),'2026-11-03')});
