"""从已校验的交付副本发布安装附件，不读取或上传签名私钥。"""
import hashlib,json,os,pathlib,re,subprocess,tempfile,urllib.request,sys
root=pathlib.Path(__file__).resolve().parent
version=sys.argv[1] if len(sys.argv)>1 else '1.0.0'
if not re.fullmatch(r'\d+\.\d+\.\d+',version):raise SystemExit('版本号无效')
manifest=json.loads((root/(version+'.json')).read_text())
if os.environ.get('GITHUB_ACTIONS')!='true':raise SystemExit('请在已授权的仓库发布工作流中运行')
headers={'User-Agent':'LeafArchive-Publisher/1.0'}
with tempfile.TemporaryDirectory() as directory:
    files=[]
    for entry in manifest['files']:
        name=entry['name']
        if pathlib.PurePath(name).name!=name:raise SystemExit('文件名无效')
        target=pathlib.Path(directory)/name;digest=hashlib.sha256()
        # Large public map packages may use checked transfer chunks; the published asset remains one archive.
        with target.open('wb') as output:
            for part in entry.get('parts',[entry]):
                url=part['url']
                if not url.startswith('https://tmpfiles.org/'):raise SystemExit('下载来源无效')
                html=urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=60).read().decode()
                match=re.search(r'href="(https://tmpfiles.org/dl/[^\"]+)"',html)
                if not match:raise SystemExit('临时副本已过期，请重新提供交付文件')
                part_digest=hashlib.sha256()
                with urllib.request.urlopen(urllib.request.Request(match.group(1),headers={**headers,'Referer':url}),timeout=180) as response:
                    while chunk:=response.read(1024*1024):output.write(chunk);digest.update(chunk);part_digest.update(chunk)
                if part_digest.hexdigest()!=part['sha256']:raise SystemExit('传输分块校验失败，未上传')
        if digest.hexdigest()!=entry['sha256']:raise SystemExit('安装包校验失败，未上传')
        files.append(str(target));print('校验通过：'+name,flush=True)
    subprocess.run(['gh','release','upload',manifest['tag'],*files,str(root/('SHA256SUMS-'+version+'.txt')),'--clobber'],check=True)
    subprocess.run(['gh','release','edit',manifest['tag'],'--draft=false','--prerelease','--notes-file',str(root/('release-notes-'+version+'.md'))],check=True)
