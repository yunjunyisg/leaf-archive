"""Download pinned gbOpen ADM2/ADM3 overviews, record attribution and preserve upstream detail.
Run explicitly; cached successful snapshots are reused unless --refresh is supplied.
"""
import concurrent.futures,datetime,gzip,hashlib,json,sys,time,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parent.parent
out=root/'data/boundaries/global';out.mkdir(parents=True,exist_ok=True)
# ISO mapping is generated from the project's installed ISO-3166 dependency.
import subprocess
codes=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import c from 'i18n-iso-countries';console.log(JSON.stringify(c.getAlpha3Codes()))"],cwd=root))
refresh='--refresh' in sys.argv
old=json.loads((out/'catalog.json').read_text()) if (out/'catalog.json').exists() else {'countries':{}}
def get(url):
 for attempt in range(4):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'LeafArchive-Boundaries/1.0'}),timeout=90) as r:return r.read()
  except Exception:
   if attempt==3:raise
   time.sleep(attempt+1)
entries=[]
for level in [2,3]:
 rows=json.loads(get(f'https://www.geoboundaries.org/api/current/gbOpen/ALL/ADM{level}/'))
 for row in rows:
  code=codes.get(row['boundaryISO'])
  if not code or (level==2 and code in ['AU','US']):continue
  entries.append((code,level,row))
def task(item):
 code,level,m=item;key='ADM'+str(level);target=out/f'{code}-{key}.json.gz';prior=old['countries'].get(code,{}).get(key)
 if not refresh and prior and target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()==prior['sha256']:return code,key,prior
 url=m['simplifiedGeometryGeoJSON'].replace('https://github.com/wmgeolab/geoBoundaries/raw/','https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/')
 raw=get(url);source=json.loads(raw);features=[]
 for f in source['features']:
  if f.get('geometry',{}).get('type') not in ['Polygon','MultiPolygon']:raise ValueError('Unsupported geometry '+code)
  p=f['properties'];features.append({'type':'Feature','id':code+'-'+key+'-'+str(p['shapeID']),'properties':{'code':code,'name':p['shapeName'],'aliases':[p['shapeName']],'adminLevel':level},'geometry':f['geometry']})
 encoded=json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,separators=(',',':')).encode();packed=gzip.compress(encoded,mtime=0);target.write_bytes(packed)
 record={k:m[k] for k in ['boundaryID','boundaryName','boundaryISO','boundaryYearRepresented','boundaryCanonical','boundarySource','boundaryLicense','licenseDetail','licenseSource','boundarySourceURL','sourceDataUpdateDate','buildDate']}
 record.update(url=url,sourceSha256=hashlib.sha256(raw).hexdigest(),sha256=hashlib.sha256(packed).hexdigest(),features=len(features),bytes=len(packed))
 print(code,key,len(features),len(packed),flush=True);return code,key,record
countries={};failed=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 futures={pool.submit(task,item):item for item in entries}
 for future in concurrent.futures.as_completed(futures):
  try:
   code,key,record=future.result();countries.setdefault(code,{})[key]=record
  except Exception as error:
   code,level,_=futures[future];failed.append({'code':code,'level':level,'error':str(error)});print('FAILED',code,level,str(error),flush=True)
catalog={'snapshotDate':datetime.date.today().isoformat(),'source':'geoBoundaries gbOpen','citation':'Runfola et al. (2020), PLoS ONE 15(4): e0231866, https://doi.org/10.1371/journal.pone.0231866','countries':dict(sorted(countries.items())),'failed':failed}
(out/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
coverage={code:{key:{k:r[k] for k in ['boundaryCanonical','boundaryYearRepresented','features']} for key,r in levels.items()} for code,levels in countries.items()}
coverage.setdefault('AU',{})['ADM2']={'boundaryCanonical':'地方政府区','boundaryYearRepresented':'既有快照','features':547}
coverage.setdefault('US',{})['ADM2']={'boundaryCanonical':'县及同级区','boundaryYearRepresented':'2017','features':3233}
(root/'shared/boundary-coverage.json').write_text(json.dumps(dict(sorted(coverage.items())),ensure_ascii=False,separators=(',',':'))+'\n')
print('COUNTRIES',len(coverage),'FILES',sum(len(x) for x in countries.values()),'FAILED',len(failed),flush=True)
if failed:sys.exit(1)
