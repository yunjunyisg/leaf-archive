"""Refresh simplified map overviews. Run explicitly; never download at search time."""
import json,urllib.request,math,hashlib,datetime,gzip
from pathlib import Path
out=Path(__file__).resolve().parent.parent/'data/boundaries'
out.mkdir(parents=True,exist_ok=True)

def download(url):
 return urllib.request.urlopen(url,timeout=90).read()
def simplify(points,tolerance=.015):
 if len(points)<=4:return points
 def distance(p,a,b):
  dx,dy=b[0]-a[0],b[1]-a[1];t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy))) if dx or dy else 0
  return (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2
 keep={0,len(points)-1};stack=[(0,len(points)-1)]
 while stack:
  a,b=stack.pop()
  if b-a<=1:continue
  i=max(range(a+1,b),key=lambda j:distance(points[j],points[a],points[b]))
  if distance(points[i],points[a],points[b])>tolerance*tolerance:keep.add(i);stack.extend([(a,i),(i,b)])
 result=[[round(points[i][0],4),round(points[i][1],4)] for i in sorted(keep)]
 return result if len(result)>=4 else [[round(p[0],4),round(p[1],4)] for p in points]
def geometry(g):
 polygons=[g['coordinates']] if g['type']=='Polygon' else g['coordinates']
 polygons=[[simplify(ring) for ring in polygon] for polygon in polygons]
 return {'type':'MultiPolygon','coordinates':polygons}
def save(name,data):
 encoded=(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n').encode()
 if name!='metadata.json':(out/(name+'.gz')).write_bytes(gzip.compress(encoded,mtime=0))
 else:(out/name).write_bytes(encoded)

urls={'admin1':'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson','us':'https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/counties-10m.json','au':'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/AUS/ADM2/geoBoundaries-AUS-ADM2_simplified.geojson'}
local={'admin1':'/tmp/leaf-admin1-10m.geojson','us':'/tmp/leaf-us-counties.json','au':'/tmp/leaf-au-counties.json'}
raw={k:Path(local[k]).read_bytes() if Path(local[k]).exists() else download(u) for k,u in urls.items()}
admin=[]
for f in json.loads(raw['admin1'])['features']:
 p=f['properties'];code=p['iso_a2']
 if not code or len(code)!=2 or not code.isalpha():continue
 aliases=list(dict.fromkeys(str(p[k]) for k in ['name','name_en','name_zh','name_local','name_alt','postal','iso_3166_2'] if p.get(k)))
 admin.append({'type':'Feature','id':p['adm1_code'],'properties':{'code':code,'name':p.get('name_en') or p['name'],'zh':p.get('name_zh') or '', 'aliases':aliases},'geometry':geometry(f['geometry'])})
save('admin1.json',{'type':'FeatureCollection','features':admin})
au=[{'type':'Feature','id':f['properties']['shapeID'],'properties':{'code':'AU','name':f['properties']['shapeName'],'aliases':[f['properties']['shapeName']]},'geometry':geometry(f['geometry'])} for f in json.loads(raw['au'])['features']]
save('AU-admin2.json',{'type':'FeatureCollection','features':au})
save('US-counties.json',json.loads(raw['us']))
save('metadata.json',{'updatedAt':datetime.date.today().isoformat(),'admin1Features':len(admin),'admin1Countries':len(set(f['properties']['code'] for f in admin)),'auAdmin2Features':len(au),'overviewToleranceDegrees':.015,'sources':{k:{'url':urls[k],'sha256':hashlib.sha256(v).hexdigest()} for k,v in raw.items()}})
print([(p.name,p.stat().st_size) for p in out.iterdir()])
