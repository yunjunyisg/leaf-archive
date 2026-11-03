// Read only EXIF DateTimeOriginal. Do not infer capture dates from file timestamps.
export function parsePhotoDate(bytes){
 try{
  const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
  const text=(p,n)=>String.fromCharCode(...b.subarray(p,p+n));
  function exif(start,end){
   if(text(start,6)==='Exif\0\0')start+=6;
   if(start+8>end)return '';
   const order=text(start,2),le=order==='II';if(!le&&order!=='MM')return '';
   const u16=p=>v.getUint16(p,le),u32=p=>v.getUint32(p,le);
   if(u16(start+2)!==42)return '';
   function directory(offset,original=false){
    const pos=start+offset;if(offset<8||pos+2>end)return '';
    const count=u16(pos);if(count>1024||pos+2+count*12>end)return '';
    let sub=0;
    for(let i=0;i<count;i++){
     const p=pos+2+i*12,tag=u16(p),type=u16(p+2),n=u32(p+4);
     if(!original&&tag===0x8769&&type===4&&n===1)sub=u32(p+8);
     if(original&&tag===0x9003&&type===2&&n>=20&&n<=64){
      const q=start+u32(p+8);if(q<start||q+n>end)continue;
      const raw=text(q,19),m=/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(raw);
      if(!m)continue;
      const [,y,mo,d,h,mi,s]=m,year=Number(y),month=Number(mo),day=Number(d);
      if(year<1||month<1||month>12||day<1||Number(h)>23||Number(mi)>59||Number(s)>59)continue;
      const leap=year%4===0&&(year%100!==0||year%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
      if(day>days[month-1])continue;
      return `${y}-${mo}-${d}`;
     }
    }
    return !original&&sub?directory(sub,true):'';
   }
   return directory(u32(start+4));
  }
  if(b[0]===0xff&&b[1]===0xd8){
   let p=2;
   while(p+4<=b.length){
    if(b[p++]!==0xff)return '';while(b[p]===0xff)p++;
    const marker=b[p++];if(marker===0xda||marker===0xd9)break;
    if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
    const size=v.getUint16(p);if(size<2||p+size>b.length)return '';
    if(marker===0xe1&&text(p+2,6)==='Exif\0\0'){const found=exif(p+2,p+size);if(found)return found}
    p+=size;
   }
  }else if(text(0,4)==='RIFF'&&text(8,4)==='WEBP'){
   const end=Math.min(b.length,v.getUint32(4,true)+8);let p=12;
   while(p+8<=end){const n=v.getUint32(p+4,true);if(p+8+n>end)return '';if(text(p,4)==='EXIF'){const found=exif(p+8,p+8+n);if(found)return found}p+=8+n+(n%2)}
  }else if(text(0,8)==='\x89PNG\r\n\x1a\n'){
   let p=8;while(p+12<=b.length){const n=v.getUint32(p);if(p+12+n>b.length)return '';if(text(p+4,4)==='eXIf'){const found=exif(p+8,p+8+n);if(found)return found}p+=12+n}
  }
 }catch{}
 return '';
}
export async function readPhotoDate(file){
 try{if(file.size>8*1024*1024)return '';return parsePhotoDate(await file.arrayBuffer())}catch{return ''}
}
