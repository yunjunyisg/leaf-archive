"""从已校验的交付副本发布安装附件，不读取或上传签名私钥。"""
import hashlib,json,os,pathlib,re,subprocess,tempfile,urllib.request
root=pathlib.Path(__file__).resolve().parent
manifest=json.loads((root/'1.0.0.json').read_text())
if os.environ.get('GITHUB_ACTIONS')!='true':raise SystemExit('请在已授权的仓库发布工作流中运行')
headers={'User-Agent':'LeafArchive-Publisher/1.0'}
with tempfile.TemporaryDirectory() as directory:
    files=[]
    for entry in manifest['files']:
        name=entry['name'];url=entry['url']
        if pathlib.PurePath(name).name!=name or not url.startswith('https://tmpfiles.org/'):raise SystemExit('下载来源或文件名无效')
        html=urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=60).read().decode()
        match=re.search(r'href="(https://tmpfiles.org/dl/[^\"]+)"',html)
        if not match:raise SystemExit('临时副本已过期，请重新提供交付文件')
        target=pathlib.Path(directory)/name;digest=hashlib.sha256()
        with urllib.request.urlopen(urllib.request.Request(match.group(1),headers={**headers,'Referer':url}),timeout=180) as response,target.open('wb') as output:
            while chunk:=response.read(1024*1024):output.write(chunk);digest.update(chunk)
        if digest.hexdigest()!=entry['sha256']:raise SystemExit('安装包校验失败，未上传')
        files.append(str(target));print('校验通过：'+name,flush=True)
    subprocess.run(['gh','release','upload',manifest['tag'],*files,str(root/'SHA256SUMS-1.0.0.txt'),'--clobber'],check=True)
    subprocess.run(['gh','release','edit',manifest['tag'],'--draft=false','--prerelease','--notes-file',str(root/'release-notes-1.0.0.md')],check=True)
