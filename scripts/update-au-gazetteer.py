"""Refresh the public GeoNames Australia snapshot; no account or API key required."""
import argparse,datetime,gzip,hashlib,io,json,re,unicodedata,urllib.request,zipfile
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--archive',help='Existing AU.zip instead of downloading');args=parser.parse_args()
url='https://download.geonames.org/export/dump/AU.zip'
data=Path(args.archive).read_bytes() if args.archive else urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'LeafArchive-OriginMap/1.1'}),timeout=90).read()
rows=[line.split('\t') for line in zipfile.ZipFile(io.BytesIO(data)).read('AU.txt').decode('utf8').splitlines()]
def fold(s):
 s=''.join(c for c in unicodedata.normalize('NFKD',s.casefold()) if not unicodedata.combining(c))
 return re.sub(r'[^\w]+',' ',s,flags=re.UNICODE).strip()
admin1={r[10]:r[1].removeprefix('State of ') for r in rows if r[7]=='ADM1'}
admin2={r[10]+'.'+r[11]:r[1] for r in rows if r[7]=='ADM2'}
output=Path(__file__).resolve().parent.parent/'data/gazetteers';output.mkdir(parents=True,exist_ok=True)
with (output/'AU.ndjson.gz').open('wb') as raw:
 with gzip.GzipFile(fileobj=raw,mode='wb',mtime=0) as gz:
  for r in rows:
   key=fold(' '.join(dict.fromkeys([r[1],r[2],r[3]])))
   record=[int(r[0]),r[1],float(r[4]),float(r[5]),r[7],r[10],r[11],key]
   gz.write((json.dumps(record,ensure_ascii=False,separators=(',',':'))+'\n').encode())
metadata={'countryCode':'AU','country':'Australia','source':'GeoNames','url':url,'license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','downloadedAt':datetime.date.today().isoformat(),'records':len(rows),'archiveSha256':hashlib.sha256(data).hexdigest(),'admin1':admin1,'admin2':admin2}
(output/'AU-metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'records':len(rows),'compressedBytes':(output/'AU.ndjson.gz').stat().st_size}))
