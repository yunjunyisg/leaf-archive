"""Build a local, public-domain geographic relief overview in Web Mercator.
Requires Pillow and NumPy only for this explicit asset refresh, not at runtime.
"""
import hashlib,io,json,math,urllib.request,zipfile
from pathlib import Path
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parent.parent
url='https://naturalearth.s3.amazonaws.com/50m_raster/NE2_50M_SR_W.zip';cached=Path('/tmp/leaf-natural-earth-relief.zip')
raw=cached.read_bytes() if cached.exists() else urllib.request.urlopen(url,timeout=120).read()
with zipfile.ZipFile(io.BytesIO(raw)) as archive:
 name=next(n for n in archive.namelist() if n.lower().endswith('.tif'))
 Image.MAX_IMAGE_PIXELS=100000000
 source=Image.open(io.BytesIO(archive.read(name))).convert('RGB');source=source.resize((4096,2048),Image.Resampling.LANCZOS)
width=height=4096;pixels=np.asarray(source);output=np.empty((height,width,3),dtype=np.uint8)
for start in range(0,height,32):
 rows=np.arange(start,min(start+32,height),dtype=np.float64)
 latitude=np.arctan(np.sinh(math.pi*(1-2*(rows+.5)/height)))
 y=np.clip((.5-latitude/math.pi)*pixels.shape[0]-.5,0,pixels.shape[0]-1)
 lo=np.floor(y).astype(int);hi=np.minimum(lo+1,pixels.shape[0]-1);weight=(y-lo).astype(np.float32)[:,None,None]
 output[start:start+len(rows)]=(pixels[lo].astype(np.float32)*(1-weight)+pixels[hi].astype(np.float32)*weight).astype(np.uint8)
target=root/'public/map-relief.webp';Image.fromarray(output).save(target,'WEBP',quality=85,method=6)
meta={'name':'Natural Earth II relief overview','source':url,'license':'Public Domain','licenseUrl':'https://www.naturalearthdata.com/about/terms-of-use/','sourceSha256':hashlib.sha256(raw).hexdigest(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'projection':'EPSG:3857','latitudeBounds':[-85.0511287798066,85.0511287798066],'size':[4096,4096],'usage':'Global terrain overview only; no street or satellite detail.'}
(root/'data/map-relief-metadata.json').write_text(json.dumps(meta,indent=2)+'\n');print(target,target.stat().st_size)
